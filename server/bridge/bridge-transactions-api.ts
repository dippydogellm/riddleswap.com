// Bridge Transactions API - Backend endpoints for transaction history and receipts
import express from 'express';
import { db } from '../db';
import { bridge_payloads } from '../../shared/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { requireAuthentication } from '../middleware/session-auth';

const router = express.Router();

// CORS middleware for bridge transactions API
const bridgeTransactionsCorsMiddleware = (req: any, res: any, next: any) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
};

/**
 * Get bridge transaction history for authenticated user
 */
router.get('/transactions', bridgeTransactionsCorsMiddleware, requireAuthentication, async (req: any, res) => {
  try {
    console.log('📜 Fetching bridge transaction history for user');
    
    const userHandle = req.session?.userHandle;
    if (!userHandle) {
      return res.status(401).json({
        success: false,
        error: 'User session not found'
      });
    }
    
    // Get bridge transactions for this specific user only
    const transactions = await db
      .select()
      .from(bridge_payloads)
      .where(eq(bridge_payloads.riddleWalletId, userHandle))
      .orderBy(desc(bridge_payloads.createdAt))
      .limit(50);
    
    // Transform to frontend format
    const formattedTransactions = transactions.map(tx => ({
      // Riddle-bridge transaction ID
      transactionId: tx.transaction_id,
      
      // Sent amount - chain token
      sentAmount: tx.amount?.toString() || '0',
      sentChain: getChainFromToken(tx.fromCurrency || ''),
      sentToken: tx.fromCurrency || '',
      
      // Fee amount
      feeAmount: tx.fee_amount?.toString() || '0',
      
      // Receive amount - chain token
      receiveAmount: tx.outputAmount?.toString() || '0', 
      receiveChain: getChainFromToken(tx.toCurrency || ''),
      receiveToken: tx.toCurrency || '',
      
      // Status
      status: tx.status || 'pending',
      
      // Additional data
      timestamp: tx.createdAt?.toISOString() || new Date().toISOString(),
      txHash: tx.tx_hash,
      outputTxHash: tx.step3TxHash,
      errorMessage: tx.errorMessage,
      usdValue: calculateUSDValue(tx.amount?.toString() || '0', tx.fromCurrency || '')
    }));
    
    console.log(`📜 Found ${formattedTransactions.length} bridge transactions`);
    
    res.json({
      success: true,
      transactions: formattedTransactions
    });
    
  } catch (error) {
    console.error('❌ Failed to fetch transactions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch transaction history'
    });
  }
});

/**
 * Restart a failed bridge transaction
 */
router.post('/restart/:transactionId', requireAuthentication, async (req: any, res) => {
  try {
    const { transactionId } = req.params;
    console.log('🔄 Attempting to restart transaction:', transactionId);
    
    // Get the transaction
    const [transaction] = await db
      .select()
      .from(bridge_payloads)
      .where(eq(bridge_payloads.transaction_id, transactionId))
      .limit(1);
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }
    
    if (transaction.status !== 'failed') {
      return res.status(400).json({
        success: false,
        error: 'Only failed transactions can be restarted'
      });
    }
    
    // Reset transaction status
    await db.update(bridge_payloads)
      .set({ 
        status: 'pending',
        errorMessage: null,
        step: 1,
        updatedAt: new Date()
       } as any)
      .where(eq(bridge_payloads.transaction_id, transactionId));
    
    console.log('✅ Transaction restart initiated:', transactionId);
    
    res.json({
      success: true,
      message: 'Transaction queued for retry'
    });
    
  } catch (error) {
    console.error('❌ Failed to restart transaction:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to restart transaction'
    });
  }
});

/**
 * Generate and download transaction receipt
 */
router.get('/receipt/:transactionId', requireAuthentication, async (req: any, res) => {
  try {
    const { transactionId } = req.params;
    console.log('📄 Generating receipt for transaction:', transactionId);
    
    // Get the transaction
    const [transaction] = await db
      .select()
      .from(bridge_payloads)
      .where(eq(bridge_payloads.transaction_id, transactionId))
      .limit(1);
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }
    
    // Generate HTML receipt
    const receiptHtml = generateReceiptHTML(transaction);
    
    // Set appropriate headers for PDF download
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename=riddle-bridge-receipt-${transactionId}.html`);
    
    console.log('✅ Receipt generated for transaction:', transactionId);
    
    res.send(receiptHtml);
    
  } catch (error) {
    console.error('❌ Failed to generate receipt:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate receipt'
    });
  }
});

/**
 * Helper function to map token to chain
 */
function getChainFromToken(token: string): string {
  const tokenChainMap: { [key: string]: string } = {
    'XRP': 'XRP',
    'RDL': 'XRP',
    'SRDL': 'XRP',
    'ETH': 'Ethereum',
    'BNB': 'Binance Smart Chain',
    'MATIC': 'Polygon',
    'BASE': 'Base',
    'ARB': 'Arbitrum',
    'OP': 'Optimism',
    'SOL': 'Solana',
    'BTC': 'Bitcoin'
  };
  
  return tokenChainMap[token.toUpperCase()] || token;
}

/**
 * Helper function to calculate USD value (simplified)
 */
function calculateUSDValue(amount: string, token: string): string {
  // This would normally fetch real-time prices
  // For now, using approximate values
  const priceMap: { [key: string]: number } = {
    'BTC': 45000,
    'ETH': 2500,
    'XRP': 0.60,
    'SOL': 100,
    'BNB': 300,
    'MATIC': 0.80,
    'RDL': 0.001
  };
  
  const price = priceMap[token.toUpperCase()] || 0;
  const usdValue = parseFloat(amount) * price;
  
  return usdValue.toFixed(2);
}

/**
 * Generate HTML receipt with RDL logo
 */
function generateReceiptHTML(transaction: any): string {
  const date = new Date(transaction.createdAt).toLocaleDateString();
  const time = new Date(transaction.createdAt).toLocaleTimeString();
  
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Riddle Bridge Receipt</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            max-width: 800px; 
            margin: 0 auto; 
            padding: 20px;
            line-height: 1.6;
        }
        .header { 
            text-align: center; 
            border-bottom: 2px solid #333; 
            padding-bottom: 20px; 
            margin-bottom: 30px;
        }
        .logo {
            width: 120px;
            height: 120px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 50%;
            margin: 0 auto 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 36px;
            font-weight: bold;
        }
        .receipt-details { 
            background: #f9f9f9; 
            padding: 20px; 
            border-radius: 8px; 
            margin-bottom: 20px;
        }
        .detail-row { 
            display: flex; 
            justify-content: space-between; 
            margin-bottom: 10px; 
            padding: 5px 0;
            border-bottom: 1px dotted #ccc;
        }
        .detail-row:last-child { border-bottom: none; }
        .label { font-weight: bold; color: #333; }
        .value { color: #666; }
        .transaction-flow {
            background: white;
            border: 2px solid #e1e5e9;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            text-align: center;
        }
        .flow-arrow {
            font-size: 24px;
            color: #667eea;
            margin: 0 20px;
        }
        .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
        }
        .status-completed { background: #d4edda; color: #155724; }
        .status-pending { background: #fff3cd; color: #856404; }
        .status-failed { background: #f8d7da; color: #721c24; }
        .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            color: #666;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">RDL</div>
        <h1>Riddle Bridge Transaction Receipt</h1>
        <p>Generated on ${date} at ${time}</p>
    </div>

    <div class="receipt-details">
        <h2>Transaction Details</h2>
        <div class="detail-row">
            <span class="label">Transaction ID:</span>
            <span class="value">${transaction.transaction_id}</span>
        </div>
        <div class="detail-row">
            <span class="label">Date:</span>
            <span class="value">${date}</span>
        </div>
        <div class="detail-row">
            <span class="label">Status:</span>
            <span class="value">
                <span class="status-badge status-${transaction.status}">${transaction.status}</span>
            </span>
        </div>
        ${transaction.tx_hash ? `
        <div class="detail-row">
            <span class="label">Transaction Hash:</span>
            <span class="value">${transaction.tx_hash}</span>
        </div>
        ` : ''}
    </div>

    <div class="transaction-flow">
        <h2>Bridge Transaction Flow</h2>
        <div style="display: flex; align-items: center; justify-content: center; margin: 20px 0;">
            <div>
                <strong>${transaction.amount || '0'} ${transaction.fromCurrency || ''}</strong>
                <br>
                <small>(${getChainFromToken(transaction.fromCurrency || '')})</small>
            </div>
            <span class="flow-arrow">→</span>
            <div>
                <strong>${transaction.outputAmount || '0'} ${transaction.toCurrency || ''}</strong>
                <br>
                <small>(${getChainFromToken(transaction.toCurrency || '')})</small>
            </div>
        </div>
    </div>

    <div class="receipt-details">
        <h2>Fee Information</h2>
        <div class="detail-row">
            <span class="label">Platform Fee (1%):</span>
            <span class="value">${transaction.fee_amount || '0'} ${transaction.toCurrency || ''}</span>
        </div>
        <div class="detail-row">
            <span class="label">Total Sent:</span>
            <span class="value">${transaction.amount || '0'} ${transaction.fromCurrency || ''}</span>
        </div>
        <div class="detail-row">
            <span class="label">Net Received:</span>
            <span class="value">${transaction.outputAmount || '0'} ${transaction.toCurrency || ''}</span>
        </div>
    </div>

    <div class="footer">
        <p><strong>RiddleSwap Bridge Service</strong></p>
        <p>This receipt serves as proof of your cross-chain bridge transaction.</p>
        <p>For support, please contact us with your transaction ID.</p>
    </div>
</body>
</html>
  `;
}

export default router;