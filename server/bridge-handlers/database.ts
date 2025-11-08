// Database operations for bridge transactions

import { db } from '../db';
import { bridge_payloads } from '../shared/schema';
import { eq } from 'drizzle-orm';

export interface SaveTransactionParams {
  transactionId: string;
  userWalletAddress: string;
  destinationAddress: string;
  fromCurrency: string;
  toCurrency: string;
  amount: string;
  txHash: string;
  status: string;
}

export async function saveBridgeTransaction(params: SaveTransactionParams): Promise<void> {
  try {
    console.log('💾 Saving bridge transaction:', {
      id: params.transactionId,
      amount: params.amount,
      from: params.fromCurrency,
      to: params.toCurrency
    });

    // Use UPSERT to prevent duplicates
    await db.insert(bridge_payloads).values({
      transaction_id: params.transactionId,
      step: 1,
      uuid: params.transactionId,
      status: params.status,
      userWalletAddress: params.userWalletAddress,
      destinationAddress: params.destinationAddress,
      fromCurrency: params.fromCurrency,
      toCurrency: params.toCurrency,
      amount: String(params.amount as any),
      txHash: params.txHash,
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      step3TxHash: null,
      outputAmount: null
    }).onConflictDoUpdate({
      target: bridge_payloads.transaction_id,
      set: {
        txHash: params.txHash,
        status: params.status,
        updatedAt: new Date()
      }
    });

    console.log('✅ Transaction saved to database');
  } catch (error) {
    console.error('❌ Failed to save transaction:', error);
    // Don't throw - transaction was successful even if DB save failed
  }
}

export async function checkDuplicateTransaction(transactionId: string): Promise<boolean> {
  try {
    const [existing] = await db.select()
      .from(bridge_payloads)
      .where(eq(bridge_payloads.transaction_id, transactionId))
      .limit(1);
    
    if (existing) {
      console.log(`⚠️ Duplicate transaction found: ${transactionId}`);
      console.log(`⚠️ Status: ${existing.status}, Hash: ${existing.txHash}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking duplicate:', error);
    return false;
  }
}