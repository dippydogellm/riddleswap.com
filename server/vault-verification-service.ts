/**
 * Vault Deposit Verification Service
 * Verifies blockchain transactions for vault deposits across all 17 chains
 */

import { Client as XRPLClient } from 'xrpl';
import { ethers } from 'ethers';
import { Connection, PublicKey } from '@solana/web3.js';

/**
 * Verification result structure
 */
export interface VerificationResult {
  success: boolean;
  verified: boolean;
  error?: string;
  details?: {
    txHash: string;
    from: string;
    to: string;
    amount: string;
    memo?: string;
    timestamp?: Date;
    confirmations?: number;
  };
}

/**
 * Verify XRPL transaction
 */
export async function verifyXRPLTransaction(
  txHash: string,
  expectedMemo: string,
  expectedDestination: string,
  expectedAmount: string
): Promise<VerificationResult> {
  console.log(`🔍 [VAULT VERIFY] Checking XRPL transaction: ${txHash}`);
  
  const client = new XRPLClient('wss://s1.ripple.com');
  
  try {
    await client.connect();
    
    // Get transaction details
    const tx = await client.request({
      command: 'tx',
      transaction: txHash
    });

    // Verify it's a payment transaction
  const transactionType = (tx.result as any)?.tx_json?.TransactionType || (tx.result as any)?.TransactionType;
  if (transactionType !== 'Payment') {
      await client.disconnect();
      return {
        success: false,
        verified: false,
        error: 'Transaction is not a payment'
      };
    }

    const txData = tx.result as any;
    
    // Check destination matches
    if (txData.Destination !== expectedDestination) {
      await client.disconnect();
      return {
        success: false,
        verified: false,
        error: `Destination mismatch. Expected ${expectedDestination}, got ${txData.Destination}`
      };
    }

    // Check amount (convert drops to XRP)
    const actualAmount = (parseInt(txData.Amount) / 1000000).toString();
    if (parseFloat(actualAmount) < parseFloat(expectedAmount)) {
      await client.disconnect();
      return {
        success: false,
        verified: false,
        error: `Amount mismatch. Expected at least ${expectedAmount} XRP, got ${actualAmount} XRP`
      };
    }

    // Check memo
    let memoFound = false;
    if (txData.Memos && txData.Memos.length > 0) {
      for (const memoWrapper of txData.Memos) {
        const memo = memoWrapper.Memo;
        if (memo.MemoData) {
          const decodedMemo = Buffer.from(memo.MemoData, 'hex').toString('utf-8');
          if (decodedMemo === expectedMemo) {
            memoFound = true;
            break;
          }
        }
      }
    }

    if (!memoFound) {
      await client.disconnect();
      return {
        success: false,
        verified: false,
        error: `Memo not found or doesn't match. Expected: ${expectedMemo}`
      };
    }

    await client.disconnect();

    console.log(`✅ [VAULT VERIFY] XRPL transaction verified: ${txHash}`);

    return {
      success: true,
      verified: true,
      details: {
        txHash,
        from: txData.Account,
        to: txData.Destination,
        amount: actualAmount,
        memo: expectedMemo,
        timestamp: new Date((txData.date + 946684800) * 1000) // Ripple epoch to Unix epoch
      }
    };
  } catch (error: any) {
    await client.disconnect();
    console.error(`❌ [VAULT VERIFY] XRPL verification error:`, error);
    return {
      success: false,
      verified: false,
      error: error.message || 'Failed to verify XRPL transaction'
    };
  }
}

/**
 * Verify EVM transaction (Ethereum, BSC, Polygon, etc.)
 */
export async function verifyEVMTransaction(
  chain: string,
  txHash: string,
  expectedMemo: string,
  expectedDestination: string,
  expectedAmount: string
): Promise<VerificationResult> {
  console.log(`🔍 [VAULT VERIFY] Checking ${chain} transaction: ${txHash}`);
  
  // Get RPC URL based on chain
  const rpcUrl = getEVMRpcUrl(chain);
  if (!rpcUrl) {
    return {
      success: false,
      verified: false,
      error: `No RPC URL configured for chain: ${chain}`
    };
  }

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Get transaction receipt
    const tx = await provider.getTransaction(txHash);
    const receipt = await provider.getTransactionReceipt(txHash);

    if (!tx || !receipt) {
      return {
        success: false,
        verified: false,
        error: 'Transaction not found'
      };
    }

    // Check if transaction succeeded
    if (receipt.status !== 1) {
      return {
        success: false,
        verified: false,
        error: 'Transaction failed on blockchain'
      };
    }

    // Verify destination
    if (tx.to?.toLowerCase() !== expectedDestination.toLowerCase()) {
      return {
        success: false,
        verified: false,
        error: `Destination mismatch. Expected ${expectedDestination}, got ${tx.to}`
      };
    }

    // Verify amount (convert from wei to ETH/native token)
    const actualAmount = ethers.formatEther(tx.value);
    if (parseFloat(actualAmount) < parseFloat(expectedAmount)) {
      return {
        success: false,
        verified: false,
        error: `Amount mismatch. Expected at least ${expectedAmount}, got ${actualAmount}`
      };
    }

    // Check memo in transaction data
    // For EVM, memo is typically in the input data field
    let memoFound = false;
    if (tx.data && tx.data !== '0x') {
      try {
        // Try to decode as UTF-8 string
        const decodedData = Buffer.from(tx.data.slice(2), 'hex').toString('utf-8');
        if (decodedData.includes(expectedMemo)) {
          memoFound = true;
        }
      } catch (e) {
        // If decoding fails, check raw hex
        if (tx.data.includes(Buffer.from(expectedMemo).toString('hex'))) {
          memoFound = true;
        }
      }
    }

    if (!memoFound) {
      return {
        success: false,
        verified: false,
        error: `Memo not found in transaction data. Expected: ${expectedMemo}`
      };
    }

    // Get confirmations
    const currentBlock = await provider.getBlockNumber();
    const confirmations = receipt.blockNumber ? currentBlock - receipt.blockNumber : 0;

    console.log(`✅ [VAULT VERIFY] ${chain} transaction verified: ${txHash} (${confirmations} confirmations)`);

    return {
      success: true,
      verified: true,
      details: {
        txHash,
        from: tx.from,
        to: tx.to || '',
        amount: actualAmount,
        memo: expectedMemo,
        confirmations
      }
    };
  } catch (error: any) {
    console.error(`❌ [VAULT VERIFY] ${chain} verification error:`, error);
    return {
      success: false,
      verified: false,
      error: error.message || `Failed to verify ${chain} transaction`
    };
  }
}

/**
 * Verify Solana transaction
 */
export async function verifySolanaTransaction(
  txHash: string,
  expectedMemo: string,
  expectedDestination: string,
  expectedAmount: string
): Promise<VerificationResult> {
  console.log(`🔍 [VAULT VERIFY] Checking Solana transaction: ${txHash}`);
  
  try {
    const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
    
    // Get transaction
    const tx = await connection.getTransaction(txHash, {
      maxSupportedTransactionVersion: 0
    });

    if (!tx) {
      return {
        success: false,
        verified: false,
        error: 'Transaction not found'
      };
    }

    // Check if transaction succeeded
    if (tx.meta?.err) {
      return {
        success: false,
        verified: false,
        error: 'Transaction failed on blockchain'
      };
    }

    // Verify destination and amount
    // For SOL native transfers, check the account keys and balances
    const expectedDestPubkey = new PublicKey(expectedDestination);
    const accountKeys = tx.transaction.message.staticAccountKeys;
    
    let destinationFound = false;
    for (const key of accountKeys) {
      if (key.equals(expectedDestPubkey)) {
        destinationFound = true;
        break;
      }
    }

    if (!destinationFound) {
      return {
        success: false,
        verified: false,
        error: `Destination ${expectedDestination} not found in transaction`
      };
    }

    // Check memo in transaction (Solana memos are program instructions)
    let memoFound = false;
    if (tx.transaction.message.compiledInstructions) {
      for (const instruction of tx.transaction.message.compiledInstructions) {
        // Memo program ID: MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr
        // Check if data contains our expected memo
        try {
          const data = Buffer.from(instruction.data).toString('utf-8');
          if (data.includes(expectedMemo)) {
            memoFound = true;
            break;
          }
        } catch (e) {
          // Continue to next instruction
        }
      }
    }

    if (!memoFound) {
      return {
        success: false,
        verified: false,
        error: `Memo not found in transaction. Expected: ${expectedMemo}`
      };
    }

    // Get amount from balance changes
    const preBalances = tx.meta?.preBalances || [];
    const postBalances = tx.meta?.postBalances || [];
    
    // Find destination account index and calculate received amount
    let receivedAmount = 0;
    for (let i = 0; i < accountKeys.length; i++) {
      if (accountKeys[i].equals(expectedDestPubkey)) {
        const pre = preBalances[i] || 0;
        const post = postBalances[i] || 0;
        receivedAmount = (post - pre) / 1e9; // Convert lamports to SOL
        break;
      }
    }

    if (receivedAmount < parseFloat(expectedAmount)) {
      return {
        success: false,
        verified: false,
        error: `Amount mismatch. Expected at least ${expectedAmount} SOL, got ${receivedAmount} SOL`
      };
    }

    console.log(`✅ [VAULT VERIFY] Solana transaction verified: ${txHash}`);

    return {
      success: true,
      verified: true,
      details: {
        txHash,
        from: accountKeys[0].toBase58(), // First account is usually the sender
        to: expectedDestination,
        amount: receivedAmount.toString(),
        memo: expectedMemo
      }
    };
  } catch (error: any) {
    console.error(`❌ [VAULT VERIFY] Solana verification error:`, error);
    return {
      success: false,
      verified: false,
      error: error.message || 'Failed to verify Solana transaction'
    };
  }
}

/**
 * Get EVM RPC URL based on chain
 */
function getEVMRpcUrl(chain: string): string | null {
  const rpcUrls: { [key: string]: string } = {
    ethereum: 'https://eth.llamarpc.com',
    bsc: 'https://bsc-dataseed1.binance.org',
    polygon: 'https://polygon-rpc.com',
    arbitrum: 'https://arb1.arbitrum.io/rpc',
    optimism: 'https://mainnet.optimism.io',
    base: 'https://mainnet.base.org',
    avalanche: 'https://api.avax.network/ext/bc/C/rpc',
    fantom: 'https://rpc.ftm.tools',
    cronos: 'https://evm.cronos.org',
    gnosis: 'https://rpc.gnosischain.com',
    celo: 'https://forno.celo.org',
    moonbeam: 'https://rpc.api.moonbeam.network',
    zksync: 'https://mainnet.era.zksync.io',
    linea: 'https://rpc.linea.build'
  };

  return rpcUrls[chain.toLowerCase()] || null;
}

/**
 * Main verification function - routes to appropriate chain verifier
 */
export async function verifyVaultDeposit(
  chain: string,
  txHash: string,
  expectedMemo: string,
  expectedDestination: string,
  expectedAmount: string
): Promise<VerificationResult> {
  const chainLower = chain.toLowerCase();

  // XRPL
  if (chainLower === 'xrpl') {
    return verifyXRPLTransaction(txHash, expectedMemo, expectedDestination, expectedAmount);
  }

  // Solana
  if (chainLower === 'solana') {
    return verifySolanaTransaction(txHash, expectedMemo, expectedDestination, expectedAmount);
  }

  // EVM chains
  const evmChains = ['ethereum', 'bsc', 'polygon', 'arbitrum', 'optimism', 'base',
                     'avalanche', 'fantom', 'cronos', 'gnosis', 'celo', 'moonbeam',
                     'zksync', 'linea'];
  
  if (evmChains.includes(chainLower)) {
    return verifyEVMTransaction(chainLower, txHash, expectedMemo, expectedDestination, expectedAmount);
  }

  // Bitcoin (not implemented yet - requires different approach)
  if (chainLower === 'bitcoin') {
    return {
      success: false,
      verified: false,
      error: 'Bitcoin verification not yet implemented. Please contact admin for manual verification.'
    };
  }

  // Unknown chain
  return {
    success: false,
    verified: false,
    error: `Unsupported chain for verification: ${chain}`
  };
}
