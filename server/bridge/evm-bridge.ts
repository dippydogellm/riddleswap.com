// EVM Bridge - Riddle Wallet + WalletConnect integration
import { ethers } from 'ethers';
import { db } from "../db";
import { bridge_payloads, riddleWallets } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import crypto from 'crypto';
// Removed decryption import - using session-cached keys only
import { BridgeExchangeRates } from './exchange-rates';

const EVM_CONFIG = {
  ETH: {
    rpcUrl: 'https://eth.llamarpc.com',
    bankAddress: '0xf7802d7522a45CB6a6f2eFa246f4B5489768b673',
    chainId: 1,
    nativeToken: 'ETH'
  },
  BNB: {
    rpcUrl: 'https://bsc-dataseed.binance.org',
    bankAddress: '0xf7802d7522a45CB6a6f2eFa246f4B5489768b673', // Universal EVM bank address
    chainId: 56,
    nativeToken: 'BNB'
  },
  MATIC: {
    rpcUrl: 'https://polygon-rpc.com',
    bankAddress: '0xf7802d7522a45CB6a6f2eFa246f4B5489768b673', // Universal EVM bank address
    chainId: 137,
    nativeToken: 'MATIC'
  },
  BASE: {
    rpcUrl: 'https://mainnet.base.org',
    bankAddress: '0xf7802d7522a45CB6a6f2eFa246f4B5489768b673', // Universal EVM bank address
    chainId: 8453,
    nativeToken: 'ETH'
  },
  ARB: {
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    bankAddress: '0xf7802d7522a45CB6a6f2eFa246f4B5489768b673', // Universal EVM bank address
    chainId: 42161,
    nativeToken: 'ETH'
  },
  OP: {
    rpcUrl: 'https://mainnet.optimism.io',
    bankAddress: '0xf7802d7522a45CB6a6f2eFa246f4B5489768b673', // Universal EVM bank address
    chainId: 10,
    nativeToken: 'ETH'
  }
};

export class EVMBridgeHandler {
  
  /**
   * Create EVM bridge payload for Riddle Wallet or WalletConnect
   */
  static async createEVMBridge(params: {
    chain?: string;
    fromToken: string;
    toToken: string;
    amount: string;
    destinationAddress: string;
    walletType: 'riddle' | 'walletconnect';
    riddleWalletId?: string;
    walletHandle?: string;
    sessionToken?: string;  // Session token for cached keys
    cachedKeys?: any;       // Cached keys from session
  }) {
    try {
      console.log('⚡ Creating EVM bridge payload:', params);
      
      const { chain, fromToken, toToken, amount, destinationAddress, walletType, riddleWalletId, walletHandle, sessionToken, cachedKeys } = params;
      
      // Use chain parameter if provided, otherwise try to infer from token
      const chainKey = chain?.toUpperCase() || fromToken.toUpperCase();
      const chainConfig = EVM_CONFIG[chainKey as keyof typeof EVM_CONFIG] || 
                         EVM_CONFIG[fromToken as keyof typeof EVM_CONFIG];
      if (!chainConfig) {
        throw new Error(`Unsupported EVM chain: ${chainKey}`);
      }
      
      const transactionId = crypto.randomUUID();
      const numAmount = parseFloat(amount);
      
      // Get real-time exchange rate with 1% fee included
      const exchangeRate = await BridgeExchangeRates.getExchangeRate(fromToken, toToken, numAmount);
      const outputAmount = exchangeRate.rate * numAmount;
      const bridgeFee = exchangeRate.totalFee;
      
      console.log(`💱 EVM Exchange rate: 1 ${fromToken} = ${exchangeRate.rate} ${toToken} (after 1% fee)`);
      console.log(`💰 Output: ${numAmount} ${fromToken} = ${outputAmount} ${toToken}`);
      
      // Store bridge payload WITH FEE - using SQL for compatibility
      await db.execute(sql`
        INSERT INTO bridge_payloads (
          transaction_id, uuid, step, status, userwalletaddress, 
          destinationaddress, fromcurrency, tocurrency, amount, outputamount,
          platform_fee, fee_amount, wallet_type, riddle_wallet_id
        ) VALUES (
          ${transactionId}, ${crypto.randomUUID()}, 1, 'pending', 
          ${destinationAddress}, ${destinationAddress}, ${fromToken.toUpperCase()}, 
          ${toToken.toUpperCase()}, ${amount}, ${outputAmount.toString()},
          ${exchangeRate.platformFee}, ${bridgeFee}, ${walletType}, ${riddleWalletId || null}
        )
      `);
      
      console.log(`💰 EVM Bridge Payload Created with Fee:`);
      console.log(`   - Input: ${amount} ${fromToken}`);
      console.log(`   - Platform Fee (1%): ${bridgeFee} ${toToken}`);
      console.log(`   - Output After Fee: ${outputAmount} ${toToken}`);
      
      if (walletType === 'riddle' && cachedKeys?.ethAddress) {
        // Use session-cached ETH private key only - no decryption fallback
        const ethPrivateKey = cachedKeys.ethPrivateKey;
        
        if (!ethPrivateKey) {
          throw new Error('ETH private key not available in session cache');
        }
        
        // Convert scientific notation to fixed decimal string for ethers.js
        const amountFixed = numAmount.toFixed(18);
        
        // Create EVM transaction payload - convert BigInt to string for JSON serialization
        const payload = {
          to: chainConfig.bankAddress,
          value: ethers.parseEther(amountFixed).toString(), // Convert BigInt to string
          data: ethers.hexlify(ethers.toUtf8Bytes(transactionId)),
          gasLimit: 21000,
          chainId: chainConfig.chainId
        };
        
        return {
          success: true,
          transactionId,
          walletType: 'riddle',
          payload: payload,
          chainConfig: chainConfig,
          amount: amount,
          estimatedOutput: outputAmount.toFixed(6),
          bridgeFee: bridgeFee.toFixed(6),
          bankWalletAddress: chainConfig.bankAddress,
          instructions: `Riddle Wallet will sign: Send ${amount} ${fromToken} to bank with data ${transactionId}`
        };
        
      } else if (walletType === 'riddle') {
        // Session-only path without private key access (just create payload)
        return {
          success: true,
          transactionId,
          walletType: 'riddle',
          payload: { memo: transactionId, amount: amount },
          chainConfig: chainConfig,
          amount: amount,
          estimatedOutput: outputAmount.toFixed(6),
          bridgeFee: bridgeFee.toFixed(6),
          bankWalletAddress: chainConfig.bankAddress,
          instructions: `Use Riddle Wallet to send ${amount} ${fromToken} to bank ${chainConfig.bankAddress}`
        };
      } else if (walletType === 'walletconnect') {
        // Convert scientific notation to fixed decimal string for ethers.js
        const amountFixed = numAmount.toFixed(18);
        
        // Create WalletConnect payload
        const wcPayload = {
          to: chainConfig.bankAddress,
          value: ethers.parseEther(amountFixed).toString(),
          data: ethers.hexlify(ethers.toUtf8Bytes(transactionId)),
          gas: '21000'
        };
        
        return {
          success: true,
          transactionId,
          walletType: 'walletconnect',
          payload: wcPayload,
          chainConfig: chainConfig,
          amount: amount,
          estimatedOutput: outputAmount.toFixed(6),
          bridgeFee: bridgeFee.toFixed(6),
          bankWalletAddress: chainConfig.bankAddress,
          instructions: `WalletConnect will prompt: Send ${amount} ${fromToken} to bank with data ${transactionId}`
        };
      }
      
      throw new Error('Invalid wallet type or missing parameters');
      
    } catch (error) {
      console.error('❌ EVM bridge creation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create EVM bridge'
      };
    }
  }
  
  /**
   * Execute EVM transaction with Riddle Wallet - NO PASSWORD NEEDED
   */
  static async executeEVMWithCachedKeys(
    transactionId: string,
    sessionToken: string,
    chain: string
  ) {
    try {
      console.log('⚡ Executing EVM transaction with cached keys (NO PASSWORD)');
      
      // Get session with cached private keys
      const authModule = await import('../riddle-wallet-auth');
      const session = authModule.getActiveSession(sessionToken);
      
      if (!session || !session.cachedKeys) {
        throw new Error('Invalid session or no cached keys available');
      }

      if (Date.now() > session.expiresAt) {
        throw new Error('Session expired');
      }

      const { handle, cachedKeys } = session;
      console.log('✅ EVM Bridge using cached keys for handle:', handle);
      
      const chainConfig = EVM_CONFIG[chain as keyof typeof EVM_CONFIG];
      if (!chainConfig) {
        throw new Error(`Unsupported EVM chain: ${chain}`);
      }
      
      // Get bridge payload
      const [bridgePayload] = await db
        .select()
        .from(bridge_payloads)
        .where(eq(bridge_payloads.transaction_id, transactionId))
        .limit(1);
      
      if (!bridgePayload) {
        throw new Error('Bridge transaction not found');
      }
      
      // Use cached ETH private key - NO DECRYPTION NEEDED
      const ethPrivateKey = cachedKeys.ethPrivateKey;
      if (!ethPrivateKey) {
        throw new Error('ETH private key not found in cache');
      }
      
      // Execute EVM transaction with better error handling
      const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl);
      const wallet = new ethers.Wallet(ethPrivateKey, provider);
      
      const numAmount = parseFloat(bridgePayload.amount?.toString() || '0');
      
      // Convert scientific notation to fixed decimal string for ethers.js
      // parseEther doesn't accept scientific notation like "1e-8"
      const amountFixed = numAmount.toFixed(18); // Use 18 decimals (max for ETH)
      
      console.log(`💰 ${chain} transaction details:`);
      console.log(`   - From: ${wallet.address}`);
      console.log(`   - To: ${chainConfig.bankAddress}`);
      console.log(`   - Amount: ${numAmount} ${chain} (${amountFixed})`);
      console.log(`   - Data: ${transactionId}`);
      
      // Get current gas prices and nonce
      const [feeData, nonce] = await Promise.all([
        provider.getFeeData(),
        provider.getTransactionCount(wallet.address)
      ]);
      
      // Calculate gas limit based on data size
      const dataSize = ethers.toUtf8Bytes(transactionId).length;
      const gasLimit = 21000 + (dataSize * 68); // Base 21000 + 68 per byte for data
      
      // Use higher gas price for ETH to ensure faster confirmation
      let gasPrice = feeData.gasPrice;
      if (chain === 'ETH' && gasPrice) {
        // Increase gas price by 20% for ETH to speed up confirmation
        gasPrice = (gasPrice * BigInt(120)) / BigInt(100);
      }
      
      const tx = {
        to: chainConfig.bankAddress,
        value: ethers.parseEther(amountFixed), // Use fixed decimal string
        data: ethers.hexlify(ethers.toUtf8Bytes(transactionId)),
        gasLimit: gasLimit,
        gasPrice: gasPrice,
        nonce: nonce
      };
      
      console.log(`📤 Submitting ${chain} transaction to mainnet...`);
      console.log(`🔥 Gas details:`, {
        gasLimit: gasLimit.toString(),
        gasPrice: feeData.gasPrice?.toString(),
        nonce: nonce
      });
      
      try {
        const response = await wallet.sendTransaction(tx);
        console.log(`📋 Transaction submitted: ${response.hash}`);
        
        // Wait for transaction with timeout (ETH: 5 minutes, others: 2 minutes)
        const timeout = chain === 'ETH' ? 300000 : 120000; // 5min for ETH, 2min for others
        const receipt = await Promise.race([
          response.wait(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Transaction timeout')), timeout)
          )
        ]) as any;
        
        console.log(`✅ Transaction mined in block: ${receipt?.blockNumber}`);
      
      if (receipt?.status === 1) {
        // Update bridge payload with transaction hash
        await db.update(bridge_payloads)
          .set({ 
            step: 2,
            status: 'verified',
            txHash: receipt.hash,
            userWalletAddress: wallet.address,
            updatedAt: new Date()
           } as any)
          .where(eq(bridge_payloads.transaction_id, transactionId));
        
        console.log(`✅ ${chain} transaction successful: ${receipt.hash}`);
        return {
          success: true,
          txHash: receipt.hash,
          amount: bridgePayload.amount,
          fromAddress: wallet.address
        };
      } else {
        throw new Error(`${chain} transaction failed with status: ${receipt?.status}`);
      }
      
      } catch (txError) {
        console.error(`❌ ${chain} transaction execution failed:`, txError);
        // Return partial success with error details
        return {
          success: false,
          error: txError instanceof Error ? txError.message : 'Transaction execution failed',
          details: `${chain} transaction could not be submitted or confirmed`
        };
      }
      
    } catch (error) {
      console.error('❌ EVM Riddle wallet execution error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'EVM transaction failed'
      };
    }
  }
  
  /**
   * Complete EVM to RDL bridge
   */
  static async completeEVMBridge(transactionId: string, destinationAddress: string) {
    try {
      console.log('🚀 Completing EVM bridge with RDL distribution');
      
      const [bridgePayload] = await db
        .select()
        .from(bridge_payloads)
        .where(eq(bridge_payloads.transaction_id, transactionId))
        .limit(1);
      
      if (!bridgePayload || bridgePayload.status !== 'verified') {
        throw new Error('Bridge transaction not verified');
      }
      
      // Execute RDL distribution using XRPL bank wallet
      const bankPrivateKey = process.env.BANK_ETH_PRIVATE_KEY;
      if (!bankPrivateKey) {
        throw new Error('Bank XRP private key not configured');
      }
      
      const { Client, Wallet } = await import('xrpl');
      const client = new Client('wss://xrplcluster.com');
      await client.connect();
      
      const bankWallet = Wallet.fromSecret(bankPrivateKey);
      const rdlAmount = parseFloat(bridgePayload.outputAmount?.toString() || '0');
      
      const rdlPayment = {
        TransactionType: 'Payment',
        Account: bankWallet.address,
        Destination: destinationAddress,
        Amount: {
          currency: 'RDL',
          value: rdlAmount.toString(),
          issuer: 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH'
        },
        Memos: [{
          Memo: {
            MemoData: Buffer.from(transactionId, 'utf8').toString('hex').toUpperCase()
          }
        }]
      };
      
      console.log('📤 Distributing RDL tokens...');
      const response = await client.submitAndWait(rdlPayment as any, { wallet: bankWallet });
      await client.disconnect();
      
      if ((response.result.meta as any)?.TransactionResult === 'tesSUCCESS') {
        // Update as completed
        await db.update(bridge_payloads)
          .set({ 
            step: 3,
            status: 'completed',
            step3TxHash: response.result.hash,
            updatedAt: new Date()
           } as any)
          .where(eq(bridge_payloads.transaction_id, transactionId));
        
        console.log(`✅ RDL distribution successful: ${response.result.hash}`);
        return {
          success: true,
          txHash: response.result.hash,
          amount: rdlAmount.toString(),
          explorerUrl: `https://livenet.xrpl.org/transactions/${response.result.hash}`
        };
      } else {
        throw new Error(`RDL distribution failed: ${(response.result.meta as any)?.TransactionResult}`);
      }
      
    } catch (error) {
      console.error('❌ EVM bridge completion error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'RDL distribution failed'
      };
    }
  }
}