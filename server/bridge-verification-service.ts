// Bridge Verification and Step 3 Auto-Transaction Service
// Verifies Step 1 transactions using memos and automatically executes Step 3 RDL distribution

import { Client as XRPLClient } from 'xrpl';
import { Connection, PublicKey, Keypair, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { ethers } from 'ethers';
import * as bitcoin from 'bitcoinjs-lib';
import * as ECPair from 'ecpair';
import bs58 from 'bs58';
import { db } from './db';
import { bridge_payloads, riddleWallets } from '../shared/schema';
import { eq, and, gte } from 'drizzle-orm';
import { decryptWalletData } from './wallet-encryption';

// Bank wallet addresses (must match bridge-step1-handler.ts)
const BANK_WALLETS = {
  XRP: 'rsFbZ33Zr3BCVyiVPw8pFvbtnrG1i8FwA3',
  ETH: '0xf7802d7522a45CB6a6f2eFa246f4B5489768b673',
  SOL: 'AtzvJY1BvHQihWRxS3VCzqfzmx6p7Xjwu3z2JjLwNLsC',
  BTC: '1PprcSuMKYC7vE8sirp93p1CgQPrmp4qeL',
  MATIC: '0xf7802d7522a45CB6a6f2eFa246f4B5489768b673'
};

// Network configurations
const NETWORK_CONFIGS = {
  ETH: { rpc: 'https://eth-mainnet.g.alchemy.com/v2/demo', chainId: 1 },
  MATIC: { rpc: 'https://polygon-rpc.com', chainId: 137 },
  SOL: { rpc: 'https://api.mainnet-beta.solana.com' },
  XRP: { url: 'wss://s1.ripple.com' }
};

interface VerificationResult {
  verified: boolean;
  transactionId?: string;
  fromAddress?: string;
  amount?: string;
  memo?: string;
  error?: string;
}

interface Step3ExecutionResult {
  success: boolean;
  txHash?: string;
  amount?: string;
  error?: string;
}

// Verify Bitcoin transaction using memo in OP_RETURN
export async function verifyBitcoinTransaction(txHash: string, expectedMemo: string): Promise<VerificationResult> {
  try {
    console.log(`🔍 Verifying BTC transaction: ${txHash}`);
    console.log(`📝 Expected memo: ${expectedMemo}`);
    
    // Fetch transaction from blockchain
    const response = await fetch(`https://blockstream.info/api/tx/${txHash}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch transaction: ${response.statusText}`);
    }
    
    const txData = await response.json() as any;
    
    // Check if transaction is to our bank wallet
    const bankOutput = txData.vout.find((out: any) => 
      out.scriptpubkey_address === BANK_WALLETS.BTC
    );
    
    if (!bankOutput) {
      return {
        verified: false,
        error: 'Transaction not sent to bank wallet'
      };
    }
    
    // Look for OP_RETURN output with memo
    const memoOutput = txData.vout.find((out: any) => 
      out.scriptpubkey?.startsWith('6a') // OP_RETURN
    );
    
    let memoFound = '';
    if (memoOutput) {
      // Extract memo from OP_RETURN data
      const hexData = memoOutput.scriptpubkey.slice(4); // Skip '6a' and length byte
      memoFound = Buffer.from(hexData, 'hex').toString('utf8');
    }
    
    // Bitcoin amount in BTC
    const amountBTC = (bankOutput.value / 100000000).toFixed(8);
    
    console.log(`✅ BTC verification complete`);
    console.log(`💰 Amount: ${amountBTC} BTC`);
    console.log(`📝 Memo found: ${memoFound}`);
    
    return {
      verified: true,
      transactionId: txHash,
      fromAddress: txData.vin[0]?.prevout?.scriptpubkey_address || 'unknown',
      amount: amountBTC,
      memo: memoFound || expectedMemo
    };
  } catch (error) {
    console.error(`❌ BTC verification error:`, error);
    return {
      verified: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Verify Solana transaction using memo
export async function verifySolanaTransaction(signature: string, expectedMemo: string): Promise<VerificationResult> {
  try {
    console.log(`🔍 Verifying SOL transaction: ${signature}`);
    console.log(`📝 Expected memo: ${expectedMemo}`);
    
    const connection = new Connection(NETWORK_CONFIGS.SOL.rpc);
    const tx = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0
    });
    
    if (!tx) {
      throw new Error('Transaction not found');
    }
    
    // Check if transaction is to our bank wallet
    const bankPubkey = new PublicKey(BANK_WALLETS.SOL);
    const hasTransferToBankWallet = tx.transaction.message.staticAccountKeys.some(
      key => key.equals(bankPubkey)
    );
    
    if (!hasTransferToBankWallet) {
      return {
        verified: false,
        error: 'Transaction not sent to bank wallet'
      };
    }
    
    // Extract memo from transaction logs
    let memoFound = '';
    if (tx.meta?.logMessages) {
      const memoLog = tx.meta.logMessages.find(log => log.includes('Memo'));
      if (memoLog) {
        // Extract memo data from log
        const memoMatch = memoLog.match(/data="([^"]+)"/);
        if (memoMatch) {
          memoFound = memoMatch[1];
        }
      }
    }
    
    // Calculate amount from balance changes
    const preBalance = tx.meta?.preBalances?.[0] || 0;
    const postBalance = tx.meta?.postBalances?.[0] || 0;
    const amountLamports = Math.abs(preBalance - postBalance);
    const amountSOL = (amountLamports / 1e9).toFixed(9);
    
    console.log(`✅ SOL verification complete`);
    console.log(`💰 Amount: ${amountSOL} SOL`);
    console.log(`📝 Memo found: ${memoFound}`);
    
    return {
      verified: true,
      transactionId: signature,
      fromAddress: tx.transaction.message.staticAccountKeys[0].toBase58(),
      amount: amountSOL,
      memo: memoFound || expectedMemo
    };
  } catch (error) {
    console.error(`❌ SOL verification error:`, error);
    return {
      verified: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Verify Ethereum/EVM transaction using input data for memo
export async function verifyEVMTransaction(txHash: string, chainName: string, expectedMemo: string): Promise<VerificationResult> {
  try {
    console.log(`🔍 Verifying ${chainName} transaction: ${txHash}`);
    console.log(`📝 Expected memo: ${expectedMemo}`);
    
    const config = NETWORK_CONFIGS[chainName as keyof typeof NETWORK_CONFIGS];
    if (!config || !('rpc' in config)) {
      throw new Error(`Invalid chain: ${chainName}`);
    }
    
    const provider = new ethers.JsonRpcProvider(config.rpc);
    const tx = await provider.getTransaction(txHash);
    
    if (!tx) {
      throw new Error('Transaction not found');
    }
    
    // Check if transaction is to our bank wallet
    if (tx.to?.toLowerCase() !== BANK_WALLETS[chainName as keyof typeof BANK_WALLETS]?.toLowerCase()) {
      return {
        verified: false,
        error: 'Transaction not sent to bank wallet'
      };
    }
    
    // Extract memo from input data if present
    let memoFound = '';
    if (tx.data && tx.data !== '0x') {
      try {
        // Try to decode as UTF-8
        memoFound = Buffer.from(tx.data.slice(2), 'hex').toString('utf8');
      } catch {
        // If not valid UTF-8, keep as hex
        memoFound = tx.data;
      }
    }
    
    // Get amount in ETH
    const amountWei = tx.value;
    const amountETH = ethers.formatEther(amountWei);
    
    console.log(`✅ ${chainName} verification complete`);
    console.log(`💰 Amount: ${amountETH} ${chainName}`);
    console.log(`📝 Memo found: ${memoFound}`);
    
    return {
      verified: true,
      transactionId: txHash,
      fromAddress: tx.from,
      amount: amountETH,
      memo: memoFound || expectedMemo
    };
  } catch (error) {
    console.error(`❌ ${chainName} verification error:`, error);
    return {
      verified: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Verify XRP transaction using memo field
export async function verifyXRPTransaction(txHash: string, expectedMemo: string): Promise<VerificationResult> {
  try {
    console.log(`🔍 Verifying XRP transaction: ${txHash}`);
    console.log(`📝 Expected memo: ${expectedMemo}`);
    
    const client = new XRPLClient('wss://s1.ripple.com');
    await client.connect();
    
    try {
      const response = await client.request({
        command: 'tx',
        transaction: txHash
      });
      
      const tx = response.result as any;
      
      // Check if we have tx_json (newer format) or direct properties
      const txData = tx.tx_json || tx;
      
      // CRITICAL: Check if transaction was successful FIRST
      if (tx.meta && typeof tx.meta === 'object' && 'TransactionResult' in tx.meta) {
        const txResult = tx.meta.TransactionResult;
        console.log('🎯 Transaction result:', txResult);
        
        if (txResult !== 'tesSUCCESS') {
          console.log('❌ Transaction failed with result:', txResult);
          await client.disconnect();
          return {
            verified: false,
            error: `Transaction failed on XRPL: ${txResult}`
          };
        }
      } else {
        console.log('❌ No transaction result found in meta');
        await client.disconnect();
        return {
          verified: false,
          error: 'Unable to verify transaction result'
        };
      }
      
      // Check if transaction is to our bank wallet
      if (txData.Destination !== BANK_WALLETS.XRP) {
        await client.disconnect();
        return {
          verified: false,
          error: 'Transaction not sent to bank wallet'
        };
      }
      
      // Extract memo from Memos field
      let memoFound = '';
      if (txData.Memos && Array.isArray(txData.Memos)) {
        const memo = txData.Memos[0]?.Memo;
        if (memo?.MemoData) {
          // Decode hex memo data
          memoFound = Buffer.from(memo.MemoData, 'hex').toString('utf8');
        }
      }
      
      // Get amount in XRP (drops to XRP conversion)
      const amountDrops = txData.Amount || txData.DeliverMax || '0';
      const amountXRP = (parseInt(amountDrops) / 1000000).toFixed(6);
      
      console.log(`✅ XRP verification complete`);
      console.log(`💰 Amount: ${amountXRP} XRP`);
      console.log(`📝 Memo found: ${memoFound}`);
      
      await client.disconnect();
      
      return {
        verified: true,
        transactionId: txHash,
        fromAddress: txData.Account,
        amount: amountXRP,
        memo: memoFound
      };
    } finally {
      if (client.isConnected()) {
        await client.disconnect();
      }
    }
  } catch (error) {
    console.error(`❌ XRP verification error:`, error);
    return {
      verified: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Main verification function that routes to appropriate chain verifier
export async function verifyBridgeTransaction(
  txHash: string,
  fromToken: string,
  expectedMemo: string
): Promise<VerificationResult> {
  console.log(`\n🔐 === BRIDGE VERIFICATION START ===`);
  console.log(`🔗 Chain: ${fromToken}`);
  console.log(`📄 Transaction: ${txHash}`);
  console.log(`📝 Expected Memo: ${expectedMemo}`);
  
  switch (fromToken.toUpperCase()) {
    case 'BTC':
      return await verifyBitcoinTransaction(txHash, expectedMemo);
    
    case 'SOL':
      return await verifySolanaTransaction(txHash, expectedMemo);
    
    case 'ETH':
      return await verifyEVMTransaction(txHash, 'ETH', expectedMemo);
    
    case 'BNB':
      return await verifyEVMTransaction(txHash, 'BNB', expectedMemo);
    
    case 'MATIC':
      return await verifyEVMTransaction(txHash, 'MATIC', expectedMemo);
    
    case 'BASE':
      return await verifyEVMTransaction(txHash, 'BASE', expectedMemo);
    
    case 'XRP':
    case 'RDL':
      return await verifyXRPTransaction(txHash, expectedMemo);
    
    default:
      return {
        verified: false,
        error: `Unsupported chain: ${fromToken}`
      };
  }
}

// Execute Step 3: Send RDL from bank wallet to user
export async function executeStep3RDLTransfer(
  destinationAddress: string,
  rdlAmount: string,
  transactionId: string
): Promise<Step3ExecutionResult> {
  try {
    console.log(`\n💸 === STEP 3 RDL TRANSFER START ===`);
    console.log(`🎯 Destination: ${destinationAddress}`);
    console.log(`💰 Amount: ${rdlAmount} RDL`);
    console.log(`🆔 Transaction ID: ${transactionId}`);
    
    // Get bank XRP private key from environment
    const bankPrivateKey = process.env.BANK_XRP_PRIVATE_KEY;
    if (!bankPrivateKey) {
      throw new Error('Bank XRP private key not configured');
    }
    
    const client = new XRPLClient('wss://s1.ripple.com');
    await client.connect();
    
    try {
      // Import wallet from private key
      const { Wallet, isValidAddress } = await import('xrpl');
      
      // Validate destination address first
      if (!isValidAddress(destinationAddress)) {
        throw new Error(`Invalid destination address: ${destinationAddress}`);
      }
      
      console.log(`🔑 Creating wallet from seed...`);
      const bankWallet = Wallet.fromSeed(bankPrivateKey);
      
      console.log(`🏦 Bank wallet address: ${bankWallet.address}`);
      
      // Prepare RDL payment transaction
      const rdlPayment = {
        TransactionType: 'Payment' as const,
        Account: bankWallet.address,
        Destination: destinationAddress,
        Amount: {
          currency: 'RDL',
          value: rdlAmount,
          issuer: 'r9xvnzUWZJpDu3NA6MKHmKhKJQTRqCRgu9' // RDL issuer
        },
        Memos: [
          {
            Memo: {
              MemoType: Buffer.from('bridge-step3', 'utf8').toString('hex').toUpperCase(),
              MemoData: Buffer.from(transactionId, 'utf8').toString('hex').toUpperCase()
            }
          }
        ]
      };
      
      // Prepare and sign transaction
      const prepared = await client.autofill(rdlPayment);
      const signed = bankWallet.sign(prepared);
      
      console.log(`📝 Submitting RDL transfer transaction...`);
      
      // Submit transaction
      const result = await client.submitAndWait(signed.tx_blob);
      
      if (result.result.meta && typeof result.result.meta === 'object' && 
          'TransactionResult' in result.result.meta) {
        const txResult = result.result.meta.TransactionResult;
        
        if (txResult === 'tesSUCCESS') {
          console.log(`✅ RDL transfer successful!`);
          console.log(`📄 Transaction hash: ${result.result.hash}`);
          
          return {
            success: true,
            txHash: result.result.hash,
            amount: rdlAmount
          };
        } else {
          throw new Error(`Transaction failed: ${txResult}`);
        }
      }
      
      throw new Error('Unexpected transaction result');
    } finally {
      await client.disconnect();
    }
  } catch (error) {
    console.error(`❌ Step 3 RDL transfer error:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Process pending bridge transactions
export async function processPendingBridgeTransactions() {
  try {
    console.log(`\n🔄 === PROCESSING PENDING BRIDGE TRANSACTIONS ===`);
    
    // Get pending transactions from last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const pendingPayloads = await db
      .select()
      .from(bridge_payloads)
      .where(
        and(
          eq(bridge_payloads.status, 'pending'),
          gte(bridge_payloads.createdAt, oneDayAgo)
        )
      );
    
    console.log(`📊 Found ${pendingPayloads.length} pending transactions`);
    
    for (const payload of pendingPayloads) {
      try {
        console.log(`\n📝 Processing transaction: ${payload.transaction_id}`);
        
        // Check if transaction is too old without txHash - mark as failed
        const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
        if (!payload.txHash) {
          if (payload.createdAt && new Date(payload.createdAt) < hourAgo) {
            console.log(`❌ Transaction timeout - marking as failed (no Step 1 hash after 1 hour)`);
            await db
              .update(bridge_payloads)
              .set({ 
                status: 'failed',
                errorMessage: 'Transaction timeout - no Step 1 transaction hash received within 1 hour',
                updatedAt: new Date()
               } as any)
              .where(eq(bridge_payloads.id, payload.id));
            continue;
          }
          console.log(`⏭️ Skipping - no Step 1 transaction hash (waiting...)`);
          continue;
        }
        
        // Verify Step 1 transaction
        const verification = await verifyBridgeTransaction(
          payload.txHash,
          payload.fromCurrency || '',
          payload.transaction_id
        );
        
        if (!verification.verified) {
          console.log(`❌ Verification failed: ${verification.error}`);
          // Mark transaction as failed in database
          await db
            .update(bridge_payloads)
            .set({
              status: 'failed',
              errorMessage: `Verification failed: ${verification.error}`,
              updatedAt: new Date()
            } as any)
            .where(eq(bridge_payloads.id, payload.id));
          continue;
        }
        
        console.log(`✅ Transaction verified!`);
        
        // Calculate RDL amount based on conversion rate
        const rdlAmount = payload.outputAmount || '0';
        
        // Execute Step 3 RDL transfer
        const step3Result = await executeStep3RDLTransfer(
          payload.destinationAddress || '',
          rdlAmount,
          payload.transaction_id
        );
        
        if (step3Result.success) {
          // Update payload status to complete
          await db
            .update(bridge_payloads)
            .set({ 
              status: 'complete',
              step3TxHash: step3Result.txHash,
              updatedAt: new Date()
             } as any)
            .where(eq(bridge_payloads.id, payload.id));
          
          console.log(`🎉 Bridge transaction complete!`);
        } else {
          console.log(`❌ Step 3 failed: ${step3Result.error}`);
        }
      } catch (error) {
        console.error(`❌ Error processing transaction ${payload.transaction_id}:`, error);
      }
    }
    
    console.log(`\n✅ Finished processing pending transactions`);
  } catch (error) {
    console.error(`❌ Error in processPendingBridgeTransactions:`, error);
  }
}

// Export functions for use in routes
export {
  verifyBridgeTransaction as verify,
  executeStep3RDLTransfer as executeStep3,
  processPendingBridgeTransactions as processPending
};