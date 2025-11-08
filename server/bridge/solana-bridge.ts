// Solana Bridge - Riddle Wallet + WalletConnect integration
import { Connection, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { db } from "../db";
import { bridge_payloads, riddleWallets } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import crypto from 'crypto';
// Removed decryption import - using session-cached keys only
import { BridgeExchangeRates } from './exchange-rates';

const SOLANA_CONFIG = {
  rpcUrl: 'https://api.mainnet-beta.solana.com',
  bankAddress: 'AtzvJY1BvHQihWRxS3VCzqfzmx6p7Xjwu3z2JjLwNLsC' // Updated bank address
};

export class SolanaBridgeHandler {
  
  /**
   * Create Solana bridge payload for Riddle Wallet or WalletConnect
   */
  static async createSolanaBridge(params: {
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
      console.log('🟣 Creating Solana bridge payload:', params);
      
      const { fromToken, toToken, amount, destinationAddress, walletType, riddleWalletId, walletHandle, sessionToken, cachedKeys } = params;
      
      const transactionId = crypto.randomUUID();
      const numAmount = parseFloat(amount);
      
      // Get real-time exchange rate with 1% fee included
      const exchangeRate = await BridgeExchangeRates.getExchangeRate(fromToken, toToken, numAmount);
      const outputAmount = exchangeRate.rate * numAmount;
      const bridgeFee = exchangeRate.totalFee;
      
      console.log(`💱 Solana Exchange rate: 1 ${fromToken} = ${exchangeRate.rate} ${toToken} (after 1% fee)`);
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
      
      console.log(`💰 Solana Bridge Payload Created with Fee:`);
      console.log(`   - Input: ${amount} ${fromToken}`);
      console.log(`   - Platform Fee (1%): ${bridgeFee} ${toToken}`);
      console.log(`   - Output After Fee: ${outputAmount} ${toToken}`);
      
      if (walletType === 'riddle' && cachedKeys?.solAddress) {
        // Use session-cached SOL private key only - no decryption fallback  
        const solPrivateKey = cachedKeys.solPrivateKey;
        
        if (!solPrivateKey) {
          throw new Error('SOL private key not available in session cache');
        }
        
        // Create Solana transaction payload
        const connection = new Connection(SOLANA_CONFIG.rpcUrl, 'confirmed');
        
        // Handle Solana private key - could be base58 or comma-separated bytes
        let fromKeypair: Keypair;
        try {
          // First try as comma-separated bytes (like BTC)
          if (solPrivateKey.includes(',')) {
            const keyBytes = solPrivateKey.split(',').map((b: string) => parseInt(b.trim()));
            fromKeypair = Keypair.fromSecretKey(new Uint8Array(keyBytes));
          } else {
            // Try as base58 encoded
            const bs58 = await import('bs58');
            const keyBytes = bs58.default.decode(solPrivateKey);
            fromKeypair = Keypair.fromSecretKey(keyBytes);
          }
        } catch (e) {
          console.error('Failed to parse SOL key, trying base64:', e);
          // Last resort - try base64
          fromKeypair = Keypair.fromSecretKey(
            Uint8Array.from(Buffer.from(solPrivateKey, 'base64'))
          );
        }
        
        const amountLamports = Math.floor(numAmount * LAMPORTS_PER_SOL);
        
        // Use the bank address directly
        const bankPubkey = new PublicKey(SOLANA_CONFIG.bankAddress);
        
        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: fromKeypair.publicKey,
            toPubkey: bankPubkey,
            lamports: amountLamports
          })
        );
        
        return {
          success: true,
          transactionId,
          walletType: 'riddle',
          payload: transaction,
          fromAddress: fromKeypair.publicKey.toString(),
          amount: amount,
          estimatedOutput: outputAmount.toFixed(6),
          bridgeFee: bridgeFee.toFixed(6),
          bankWalletAddress: SOLANA_CONFIG.bankAddress,
          instructions: `Riddle Wallet will sign: Send ${amount} SOL to bank ${SOLANA_CONFIG.bankAddress}`
        };
        
      } else if (walletType === 'riddle') {
        // Session-only path without private key access (just create payload)
        return {
          success: true,
          transactionId,
          walletType: 'riddle',
          payload: { memo: transactionId, amount: amount },
          amount: amount,
          estimatedOutput: outputAmount.toFixed(6),
          bridgeFee: bridgeFee.toFixed(6),
          bankWalletAddress: SOLANA_CONFIG.bankAddress,
          instructions: `Use Riddle Wallet to send ${amount} SOL to bank ${SOLANA_CONFIG.bankAddress}`
        };
      } else if (walletType === 'walletconnect') {
        // Create WalletConnect payload
        const amountLamports = Math.floor(numAmount * LAMPORTS_PER_SOL);
        
        const wcPayload = {
          fromPubkey: '', // Will be filled by WalletConnect
          toPubkey: SOLANA_CONFIG.bankAddress,
          lamports: amountLamports,
          memo: transactionId
        };
        
        return {
          success: true,
          transactionId,
          walletType: 'walletconnect',
          payload: wcPayload,
          amount: amount,
          estimatedOutput: outputAmount.toFixed(6),
          bridgeFee: bridgeFee.toFixed(6),
          bankWalletAddress: SOLANA_CONFIG.bankAddress,
          instructions: `WalletConnect will prompt: Send ${amount} SOL to bank ${SOLANA_CONFIG.bankAddress}`
        };
      }
      
      throw new Error('Invalid wallet type or missing parameters');
      
    } catch (error) {
      console.error('❌ Solana bridge creation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create Solana bridge'
      };
    }
  }
  
  /**
   * Execute Solana transaction with Riddle Wallet - NO PASSWORD NEEDED
   */
  static async executeSolanaWithCachedKeys(
    transactionId: string,
    sessionToken: string
  ) {
    try {
      console.log('🟣 Executing Solana transaction with cached keys (NO PASSWORD)');
      
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
      console.log('✅ Solana Bridge using cached keys for handle:', handle);
      
      // Get bridge payload
      const [bridgePayload] = await db
        .select()
        .from(bridge_payloads)
        .where(eq(bridge_payloads.transaction_id, transactionId))
        .limit(1);
      
      if (!bridgePayload) {
        throw new Error('Bridge transaction not found');
      }
      
      // 🚨 CRITICAL: Check if already executed to prevent duplicates
      if (bridgePayload.step >= 2 && bridgePayload.txHash) {
        console.log('⚠️ Step 1 transaction already executed - preventing duplicate');
        console.log(`   - Transaction ID: ${transactionId}`);
        console.log(`   - Existing TX Hash: ${bridgePayload.txHash}`);
        console.log('   - Returning existing transaction result');
        
        return {
          success: true,
          txHash: bridgePayload.txHash,
          amount: bridgePayload.amount,
          fromAddress: bridgePayload.userWalletAddress || '',
          message: 'Transaction already executed previously'
        };
      }
      
      // 🔒 LOCK: Check if execution is already in progress
      if (bridgePayload.status === 'executing') {
        console.log('⚠️ Step 1 execution already in progress - preventing duplicate');
        console.log(`   - Transaction ID: ${transactionId}`);
        console.log('   - Status: Execution in progress by another process');
        
        // Wait a moment and check if it completed
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const [updatedPayload] = await db
          .select()
          .from(bridge_payloads)
          .where(eq(bridge_payloads.transaction_id, transactionId))
          .limit(1);
          
        if (updatedPayload?.txHash) {
          return {
            success: true,
            txHash: updatedPayload.txHash,
            amount: updatedPayload.amount,
            fromAddress: updatedPayload.userWalletAddress || '',
            message: 'Transaction was executed by another process'
          };
        }
        
        throw new Error('Transaction execution in progress - please wait');
      }
      
      // 🔒 IMMEDIATE LOCK: Mark as executing to prevent race conditions
      const lockResult = await db.update(bridge_payloads)
        .set({  
          status: 'executing',
          updatedAt: new Date()
         } as any)
        .where(eq(bridge_payloads.transaction_id, transactionId))
        .returning({ status: bridge_payloads.status });
      
      // If we couldn't set the lock, another process got there first
      if (!lockResult || lockResult.length === 0) {
        console.log('⚠️ Failed to acquire execution lock - another process is handling this');
        throw new Error('Transaction execution already in progress');
      }
      
      console.log('🔒 Execution lock acquired for transaction:', transactionId)
      
      // Use cached SOL private key - NO DECRYPTION NEEDED
      const solPrivateKey = cachedKeys.solPrivateKey;
      if (!solPrivateKey) {
        throw new Error('SOL private key not found in cache');
      }
      
      // Execute Solana transaction
      const connection = new Connection(SOLANA_CONFIG.rpcUrl, 'confirmed');
      
      // Parse base58 SOL private key
      const bs58 = await import('bs58');
      const privateKeyBytes = bs58.default.decode(solPrivateKey);
      const fromKeypair = Keypair.fromSecretKey(privateKeyBytes);
      
      const numAmount = parseFloat(bridgePayload.amount?.toString() || '0');
      const amountLamports = Math.floor(numAmount * LAMPORTS_PER_SOL);
      
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: fromKeypair.publicKey,
          toPubkey: new PublicKey(SOLANA_CONFIG.bankAddress),
          lamports: amountLamports
        })
      );
      
      console.log('📤 Submitting Solana transaction to mainnet...');
      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [fromKeypair]
      );
      
      // Update bridge payload with correct field names (we have the lock from earlier)
      await db.update(bridge_payloads)
        .set({ 
          step: 2,
          status: 'verified',
          txHash: signature,
          userWalletAddress: fromKeypair.publicKey.toString(),
          updatedAt: new Date()
         } as any)
        .where(eq(bridge_payloads.transaction_id, transactionId));
      
      console.log(`✅ Solana transaction successful: ${signature}`);
      return {
        success: true,
        txHash: signature,
        amount: bridgePayload.amount,
        fromAddress: fromKeypair.publicKey.toString()
      };
      
    } catch (error) {
      console.error('❌ Solana Riddle wallet execution error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Solana transaction failed'
      };
    }
  }
  
  /**
   * Complete Solana to RDL bridge
   */
  static async completeSolanaBridge(transactionId: string, destinationAddress: string) {
    try {
      console.log('🚀 Completing Solana bridge with RDL distribution');
      
      const [bridgePayload] = await db
        .select()
        .from(bridge_payloads)
        .where(eq(bridge_payloads.transaction_id, transactionId))
        .limit(1);
      
      if (!bridgePayload || bridgePayload.status !== 'verified') {
        throw new Error('Bridge transaction not verified');
      }
      
      // Execute RDL distribution using XRPL bank wallet
      const bankPrivateKey = process.env.BANK_SOL_PRIVATE_KEY;
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
      console.error('❌ Solana bridge completion error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'RDL distribution failed'
      };
    }
  }
}