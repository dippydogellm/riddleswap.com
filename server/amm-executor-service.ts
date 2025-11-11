/**
 * AMM Executor Service
 * 
 * Automated Market Maker Transaction Executor
 * Runs scheduled trades on blockchain for active AMM configurations
 */

import { db } from './db';
import { marketMakerConfigs, marketMakerTransactions } from '../shared/schema';
import { eq, and, lte, isNotNull } from 'drizzle-orm';
import { Client as XRPLClient, Wallet } from 'xrpl';
import crypto from 'crypto';

const XRPL_RPC_URL = process.env.XRPL_RPC_URL || 'wss://xrplcluster.com';
const ENCRYPTION_KEY = process.env.SESSION_SECRET || 'default-key-change-in-production';

// Decrypt wallet from database
function decryptWallet(encryptedData: string, encryptedIv: string): string {
  try {
    const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
    const iv = Buffer.from(encryptedIv, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('❌ [AMM-EXECUTOR] Decryption error:', error);
    throw new Error('Failed to decrypt wallet');
  }
}

/**
 * Execute a single AMM trade on blockchain
 */
async function executeAmmTrade(config: any): Promise<{
  success: boolean;
  txHash?: string;
  amountSold?: string;
  amountBought?: string;
  error?: string;
}> {
  const client = new XRPLClient(XRPL_RPC_URL);
  
  try {
    console.log(`🤖 [AMM-EXECUTOR] Executing trade for config ${config.id}...`);
    console.log(`📊 [AMM-EXECUTOR] Trading pair: ${config.base_token}/${config.quote_token}`);
    console.log(`💰 [AMM-EXECUTOR] Amount: ${config.payment_amount}`);
    
    // Connect to XRPL
    await client.connect();
    
    // Get wallet from database using riddle_handle
    const { riddleWallets } = await import('@shared/schema');
    const [walletRecord] = await db
      .select()
      .from(riddleWallets)
      .where(eq(riddleWallets.handle, config.riddle_handle))
      .limit(1);
    
    if (!walletRecord || !walletRecord.encryptedSeedPhrase) {
      throw new Error(`Wallet not found for handle: ${config.riddle_handle}`);
    }
    
    // Decrypt seed phrase
    const seedPhrase = decryptWallet(walletRecord.encryptedSeedPhrase, walletRecord.salt);
    const wallet = Wallet.fromSeed(seedPhrase);
    
    console.log(`🔐 [AMM-EXECUTOR] Using wallet: ${wallet.address}`);
    
    // Determine trade direction based on strategy
    let fromToken = config.base_token;
    let toToken = config.quote_token;
    let fromIssuer = config.base_issuer;
    let toIssuer = config.quote_issuer;
    
    // For buy_and_sell strategy, alternate direction
    // TODO: Add trade_type field to marketMakerTransactions schema
    // if (config.strategy === 'buy_and_sell') {
    //   const lastTx = await db
    //     .select()
    //     .from(marketMakerTransactions)
    //     .where(eq(marketMakerTransactions.config_id, config.id))
    //     .orderBy(marketMakerTransactions.executed_at)
    //     .limit(1);
      
    //   // If last trade was buy, now sell (and vice versa)
    //   if (lastTx.length > 0 && lastTx[0].trade_type === 'buy') {
    //     fromToken = config.quote_token;
    //     toToken = config.base_token;
    //     fromIssuer = config.quote_issuer;
    //     toIssuer = config.base_issuer;
    //   }
    // }
    
    // Execute swap using XRPL
    const swapAmount = parseFloat(config.payment_amount);
    
    console.log(`🔄 [AMM-EXECUTOR] Swapping ${swapAmount} ${fromToken} -> ${toToken}`);
    
    // Build payment transaction
    const payment: any = {
      TransactionType: 'Payment',
      Account: wallet.address,
      Destination: wallet.address, // Self-swap for liquidity
      Amount: fromToken === 'XRP' 
        ? String(Math.floor(swapAmount * 1_000_000)) // Convert to drops
        : {
            currency: fromToken.length <= 3 
              ? fromToken.padEnd(3) 
              : Buffer.from(fromToken.padEnd(20, '\0')).toString('hex').toUpperCase(),
            issuer: fromIssuer,
            value: swapAmount.toString()
          },
      SendMax: fromToken === 'XRP'
        ? String(Math.floor(swapAmount * 1.01 * 1_000_000)) // 1% slippage
        : {
            currency: fromToken.length <= 3 
              ? fromToken.padEnd(3) 
              : Buffer.from(fromToken.padEnd(20, '\0')).toString('hex').toUpperCase(),
            issuer: fromIssuer,
            value: (swapAmount * 1.01).toString()
          },
      DeliverMin: toToken === 'XRP'
        ? String(Math.floor(swapAmount * 0.99 * 1_000_000)) // Min 99% delivery
        : {
            currency: toToken.length <= 3 
              ? toToken.padEnd(3) 
              : Buffer.from(toToken.padEnd(20, '\0')).toString('hex').toUpperCase(),
            issuer: toIssuer,
            value: (swapAmount * 0.99).toString()
          },
      Flags: 0x00020000 // PartialPayment flag
    };
    
    // Autofill, sign, and submit
    const prepared = await client.autofill(payment);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);
    
    const meta = result.result.meta as any;
    const txHash = result.result.hash;
    
    if (meta?.TransactionResult === 'tesSUCCESS') {
      console.log(`✅ [AMM-EXECUTOR] Trade successful! Hash: ${txHash}`);
      
      // Parse delivered amounts from metadata
      const deliveredAmount = meta.delivered_amount || swapAmount.toString();
      
      return {
        success: true,
        txHash,
        amountSold: swapAmount.toString(),
        amountBought: deliveredAmount
      };
    } else {
      throw new Error(`Transaction failed: ${meta?.TransactionResult}`);
    }
    
  } catch (error) {
    console.error(`❌ [AMM-EXECUTOR] Trade execution failed:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  } finally {
    await client.disconnect();
  }
}

/**
 * Process all pending AMM configurations
 */
export async function processAmmTrades(): Promise<{
  processed: number;
  successful: number;
  failed: number;
}> {
  console.log('🤖 [AMM-EXECUTOR] Starting AMM trade processing...');
  
  try {
    // Get all active configs where next_execution <= now
    const now = new Date();
    const pendingConfigs = await db
      .select()
      .from(marketMakerConfigs)
      .where(
        and(
          eq(marketMakerConfigs.is_active, true),
          lte(marketMakerConfigs.next_execution, now),
          isNotNull(marketMakerConfigs.next_execution)
        )
      );
    
    console.log(`📋 [AMM-EXECUTOR] Found ${pendingConfigs.length} pending AMM configs`);
    
    let successful = 0;
    let failed = 0;
    
    for (const config of pendingConfigs) {
      try {
        // Execute trade
        const result = await executeAmmTrade(config);
        
        // Record transaction
        await db.insert(marketMakerTransactions).values({
          config_id: config.id,
          tx_hash: result.txHash,
          chain: config.chain,
          amount: result.amountSold || config.payment_amount,
          fee_amount: '0',
          status: result.success ? 'success' : 'failed',
          error_message: result.error,
        } as any);
        
        // Calculate next execution time
        const freqMinutes = config.frequency_minutes || (
          config.payment_frequency === 'hourly' ? 60 :
          config.payment_frequency === 'daily' ? 1440 :
          config.payment_frequency === 'weekly' ? 10080 : 60
        );
        const nextExecution = new Date(now.getTime() + freqMinutes * 60000);
        
        // Update config
        await db.update(marketMakerConfigs)
          .set({ 
            last_execution: now,
            next_execution: nextExecution,
            total_transactions: (config.total_transactions || 0) + 1,
            total_fees_collected: (parseFloat(config.total_fees_collected || '0') + 
              parseFloat(result.amountSold || '0') * 0.0025).toString(), // 0.25% fee
            updated_at: now
           } as any)
          .where(eq(marketMakerConfigs.id, config.id));
        
        if (result.success) {
          successful++;
          console.log(`✅ [AMM-EXECUTOR] Config ${config.id} executed successfully`);
        } else {
          failed++;
          console.log(`❌ [AMM-EXECUTOR] Config ${config.id} failed: ${result.error}`);
        }
        
      } catch (error) {
        failed++;
        console.error(`❌ [AMM-EXECUTOR] Error processing config ${config.id}:`, error);
      }
    }
    
    console.log(`🎉 [AMM-EXECUTOR] Processing complete! Successful: ${successful}, Failed: ${failed}`);
    
    return {
      processed: pendingConfigs.length,
      successful,
      failed
    };
    
  } catch (error) {
    console.error('❌ [AMM-EXECUTOR] Fatal error in AMM processor:', error);
    throw error;
  }
}

// Export for manual execution via API
export default {
  processAmmTrades,
  executeAmmTrade
};
