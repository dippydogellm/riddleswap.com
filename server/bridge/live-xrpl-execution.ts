// Live XRPL transaction execution using cached private keys
import { Client, Wallet, xrpToDrops } from 'xrpl';
import { db } from '../db';
import { bridge_payloads } from '../../shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Execute a real XRPL transaction using cached session keys
 */
export async function executeLiveXRPLTransaction(
  transactionId: string,
  sessionToken: string
) {
  try {
    console.log('🌐 EXECUTING LIVE XRPL TRANSACTION');
    console.log(`🔗 Transaction ID: ${transactionId}`);
    
    // Get session with cached private keys
    const authModule = await import('../riddle-wallet-auth');
    const session = authModule.getActiveSession(sessionToken);
    
    if (!session || !session.cachedKeys) {
      throw new Error('Invalid session or no cached keys available');
    }

    if (Date.now() > session.expiresAt) {
      throw new Error('Session expired');
    }

    console.log('✅ Valid session found with cached keys');
    
    // Get bridge payload from database
    const [bridgePayload] = await db
      .select()
      .from(bridge_payloads)
      .where(eq(bridge_payloads.transaction_id, transactionId))
      .limit(1);
    
    if (!bridgePayload) {
      throw new Error(`Bridge transaction ${transactionId} not found`);
    }
    
    console.log(`💰 Amount to send: ${bridgePayload.amount} XRP`);
    console.log(`🎯 Destination: ${bridgePayload.destinationAddress}`);
    
    // Use cached XRP private key
    const xrpPrivateKey = session.cachedKeys.xrpPrivateKey;
    
    if (!xrpPrivateKey) {
      throw new Error('XRP private key not found in cached session');
    }
    
    console.log('🔑 Using cached XRP private key for transaction');
    
    // Create XRPL wallet from cached private key
    const wallet = Wallet.fromSecret(xrpPrivateKey);
    console.log(`📍 Sending from: ${wallet.address}`);
    
    // Connect to XRPL Mainnet
    const client = new Client('wss://xrpl.ws');
    await client.connect();
    console.log('🌐 Connected to XRPL Mainnet');
    
    // Prepare payment transaction
    const amountInXRP = parseFloat(bridgePayload.amount || '0');
    if (!bridgePayload.destinationAddress) {
      throw new Error('Destination address is required');
    }
    const amountInDrops = xrpToDrops(amountInXRP.toString());
    
    const payment = {
      TransactionType: 'Payment' as const,
      Account: wallet.address,
      Destination: bridgePayload.destinationAddress,
      Amount: amountInDrops,
      Flags: 131072, // tfPartialPayment for security
      Memos: [{
        Memo: {
          MemoData: Buffer.from(transactionId, 'utf8').toString('hex').toUpperCase()
        }
      }]
    };
    
    console.log('📦 Payment prepared:', {
      from: payment.Account,
      to: payment.Destination,
      amount: `${amountInXRP} XRP (${amountInDrops} drops)`,
      memo: transactionId
    });
    
    // Submit and wait for validation
    console.log('🚀 Submitting transaction to XRPL network...');
    const response = await client.submitAndWait(payment, { wallet });
    
    console.log('✅ TRANSACTION SUBMITTED TO XRPL NETWORK!');
    console.log(`🔗 Transaction Hash: ${response.result.hash}`);
    console.log(`⛽ Fee paid: ${(response.result as any).Fee || 'unknown'} drops`);
    console.log(`📊 Ledger index: ${response.result.ledger_index}`);
    
    // Update bridge payload status
    await db
      .update(bridge_payloads)
      .set({  
        status: 'completed',
        txHash: response.result.hash,
        updatedAt: new Date()
       } as any)
      .where(eq(bridge_payloads.transaction_id, transactionId));
    
    console.log('💾 Bridge payload updated in database');
    
    // Disconnect from XRPL
    await client.disconnect();
    console.log('🌐 Disconnected from XRPL network');
    
    return {
      success: true,
      txHash: response.result.hash,
      fee: (response.result as any).Fee || '0',
      ledgerIndex: response.result.ledger_index,
      amount: amountInXRP,
      destination: bridgePayload.destinationAddress,
      explorerUrl: `https://xrpscan.com/tx/${response.result.hash}`,
      message: 'Transaction successfully executed on XRPL Mainnet'
    };
    
  } catch (error) {
    console.error('❌ Live XRPL transaction failed:', error);
    
    // Update bridge payload with error status
    try {
      await db
        .update(bridge_payloads)
        .set({  
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
         } as any)
        .where(eq(bridge_payloads.transaction_id, transactionId));
    } catch (dbError) {
      console.error('Failed to update bridge payload status:', dbError);
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}