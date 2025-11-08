// Bridge Database Helper - Works with existing lowercase column names
// Safe database operations that don't modify schema

import { db } from './db';
import { sql } from 'drizzle-orm';

export interface BridgePayloadData {
  id?: number;
  transaction_id: string;
  step?: number;
  uuid: string;
  status?: string;
  userwalletaddress?: string;
  destinationaddress?: string;
  fromcurrency?: string;
  tocurrency?: string;
  amount?: string;
  outputAmount?: string;
  step1TxHash?: string;
  step3txhash?: string;
  errormessage?: string;
  createdat?: Date;
  updatedat?: Date;
}

// Find bridge payload by transaction ID (safe query)
export async function findBridgePayload(transactionId: string): Promise<BridgePayloadData | null> {
  try {
    const result = await db.execute(sql`
      SELECT * FROM bridge_payloads 
      WHERE transaction_id = ${transactionId} 
      LIMIT 1
    `);
    
    return (result.rows[0] as any) || null;
  } catch (error) {
    console.error('Error finding bridge payload:', error);
    return null;
  }
}

// Update Step 3 completion (safe update)
export async function updateStep3Completion(transactionId: string, txHash: string): Promise<boolean> {
  try {
    await db.execute(sql`
      UPDATE bridge_payloads 
      SET step3txhash = ${txHash}, 
          status = 'complete', 
          updatedat = NOW()
      WHERE transaction_id = ${transactionId}
    `);
    
    return true;
  } catch (error) {
    console.error('Error updating Step 3 completion:', error);
    return false;
  }
}

// Get pending Step 3 transactions (safe query)
export async function getPendingStep3Transactions(): Promise<BridgePayloadData[]> {
  try {
    const result = await db.execute(sql`
      SELECT * FROM bridge_payloads 
      WHERE status = 'step2' 
      AND step3txhash IS NULL
      ORDER BY createdat ASC
    `);
    
    return result.rows as any[];
  } catch (error) {
    console.error('Error getting pending Step 3 transactions:', error);
    return [];
  }
}

// Get pending transactions for verification (safe query)
export async function getPendingTransactions(): Promise<BridgePayloadData[]> {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const result = await db.execute(sql`
      SELECT * FROM bridge_payloads 
      WHERE status = 'pending' 
      AND createdat >= ${oneDayAgo}
      ORDER BY createdat ASC
    `);
    
    return result.rows as any[];
  } catch (error) {
    console.error('Error getting pending transactions:', error);
    return [];
  }
}