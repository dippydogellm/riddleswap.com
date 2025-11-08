// Transaction Status Endpoints - Complete transaction history and status tracking
import express from 'express';
import { db } from './db';
import { bridge_payloads, swapHistory } from '../shared/schema';
import { eq, desc, and } from 'drizzle-orm';
import { requireAuthentication } from './middleware/session-auth';

// Get comprehensive transaction status for a user
export async function getUserTransactionStatus(req: express.Request, res: express.Response) {
  try {
    const { riddle_wallet_id, wallet_address } = req.query;

    if (!riddle_wallet_id && !wallet_address) {
      return res.status(400).json({
        success: false,
        error: 'Either riddle_wallet_id or wallet_address is required'
      });
    }

    // Build conditions first, then construct the query in a single chain to avoid type mismatch
    const bridgeConditions: any[] = [];
    if (riddle_wallet_id) {
      bridgeConditions.push(eq(bridge_payloads.riddleWalletId, riddle_wallet_id as string));
    }
    if (wallet_address) {
      bridgeConditions.push(eq(bridge_payloads.userWalletAddress, wallet_address as string));
    }

    const bridgeTransactions = await db
      .select()
      .from(bridge_payloads)
      .where(bridgeConditions.length > 0 ? and(...bridgeConditions) : undefined as any)
      .orderBy(desc(bridge_payloads.createdAt));

    // Get swap transactions
    const swapTransactions = wallet_address ? 
      await db.select()
        .from(swapHistory)
        .where(eq(swapHistory.wallet_address, wallet_address as string))
        .orderBy(desc(swapHistory.created_at)) :
      [];

    // Process bridge transactions
    const processedBridge = bridgeTransactions.map(tx => ({
      id: tx.transaction_id,
      type: 'bridge',
      status: tx.status,
      from_token: tx.fromCurrency,
      to_token: tx.toCurrency,
      amount: tx.amount,
      output_amount: tx.outputAmount,
      transaction_hash: tx.txHash,
      step3_hash: tx.step3TxHash,
      error_message: tx.errorMessage,
      created_at: tx.createdAt,
      updated_at: tx.updatedAt,
      step: tx.step,
      wallet_address: tx.userWalletAddress,
      destination_address: tx.destinationAddress
    }));

    // Process swap transactions
    const processedSwaps = swapTransactions.map(tx => ({
      id: tx.id,
      type: 'swap',
      status: tx.status,
      from_token: tx.from_token_symbol,
      to_token: tx.to_token_symbol,
      amount: tx.from_amount,
      output_amount: tx.to_amount,
      transaction_hash: tx.transaction_hash,
      error_message: tx.failure_reason,
      created_at: tx.created_at,
      updated_at: tx.completed_at,
      chain: tx.chain,
      wallet_address: tx.wallet_address,
      platform_fee_usd: tx.platform_fee_usd
    }));

    // Combine and sort all transactions
    const allTransactions = [...processedBridge, ...processedSwaps]
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

    // Get status counts
    const statusCounts = {
      pending: allTransactions.filter(tx => tx.status === 'pending').length,
      completed: allTransactions.filter(tx => ['completed', 'complete'].includes(tx.status || '')).length,
      failed: allTransactions.filter(tx => tx.status === 'failed').length,
      paid: allTransactions.filter(tx => tx.status === 'paid').length
    };

    res.json({
      success: true,
      data: {
        transactions: allTransactions,
        counts: statusCounts,
        total: allTransactions.length
      }
    });

  } catch (error) {
    console.error('❌ Error getting transaction status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get transaction status'
    });
  }
}

// Get specific transaction details
export async function getTransactionDetails(req: express.Request, res: express.Response) {
  try {
    const { transaction_id } = req.params;

    // Check bridge transactions first
    const [bridgeTransaction] = await db
      .select()
      .from(bridge_payloads)
      .where(eq(bridge_payloads.transaction_id, transaction_id))
      .limit(1);

    if (bridgeTransaction) {
      return res.json({
        success: true,
        data: {
          type: 'bridge',
          transaction: {
            id: bridgeTransaction.transaction_id,
            status: bridgeTransaction.status,
            from_token: bridgeTransaction.fromCurrency,
            to_token: bridgeTransaction.toCurrency,
            amount: bridgeTransaction.amount,
            output_amount: bridgeTransaction.outputAmount,
            transaction_hash: bridgeTransaction.txHash,
            step3_hash: bridgeTransaction.step3TxHash,
            error_message: bridgeTransaction.errorMessage,
            created_at: bridgeTransaction.createdAt,
            updated_at: bridgeTransaction.updatedAt,
            step: bridgeTransaction.step,
            wallet_address: bridgeTransaction.userWalletAddress,
            destination_address: bridgeTransaction.destinationAddress,
            verification_status: bridgeTransaction.verification_status,
            payload: bridgeTransaction.payload
          }
        }
      });
    }

    // Check swap transactions
    const [swapTransaction] = await db
      .select()
      .from(swapHistory)
      .where(eq(swapHistory.id, transaction_id))
      .limit(1);

    if (swapTransaction) {
      return res.json({
        success: true,
        data: {
          type: 'swap',
          transaction: {
            id: swapTransaction.id,
            status: swapTransaction.status,
            from_token: swapTransaction.from_token_symbol,
            to_token: swapTransaction.to_token_symbol,
            amount: swapTransaction.from_amount,
            output_amount: swapTransaction.to_amount,
            transaction_hash: swapTransaction.transaction_hash,
            error_message: swapTransaction.failure_reason,
            created_at: swapTransaction.created_at,
            updated_at: swapTransaction.completed_at,
            chain: swapTransaction.chain,
            wallet_address: swapTransaction.wallet_address,
            exchange_rate: swapTransaction.exchange_rate,
            platform_fee_usd: swapTransaction.platform_fee_usd
          }
        }
      });
    }

    res.status(404).json({
      success: false,
      error: 'Transaction not found'
    });

  } catch (error) {
    console.error('❌ Error getting transaction details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get transaction details'
    });
  }
}

// Export route registration function
export function registerTransactionStatusRoutes(app: express.Application) {
  // Protected routes require authentication
  app.get('/api/transactions/status', requireAuthentication, getUserTransactionStatus);
  app.get('/api/transactions/:transaction_id', requireAuthentication, getTransactionDetails);
  
  console.log('✅ Transaction status endpoints registered');
}