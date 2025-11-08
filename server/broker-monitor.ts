import { Client, NFTokenAcceptOffer, Payment, Wallet } from 'xrpl';
import { db } from './db';
import { brokerEscrow } from '../shared/nft-schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

const BROKER_WALLET_ADDRESS = process.env.BROKER_WALLET_ADDRESS;
const BROKER_WALLET_SEED = process.env.BROKER_WALLET_SEED;
const BROKER_FEE_PERCENTAGE = 1.589; // 1.589% broker fee
const XRPL_WSS = 'wss://xrplcluster.com';
const RECONNECT_DELAY_MS = 3000; // Fast reconnection for real-time monitoring
const HEARTBEAT_INTERVAL_MS = 120000; // Keep connection alive (reduced CPU usage)

interface BrokerMonitorConfig {
  enabled: boolean;
  client?: Client;
  lastTransactionTime?: Date;
  reconnectAttempts: number;
}

const config: BrokerMonitorConfig = {
  enabled: false,
  reconnectAttempts: 0
};

let heartbeatInterval: NodeJS.Timeout | null = null;

/**
 * Start monitoring XRPL blockchain for broker wallet transactions
 * Real-time websocket monitoring with fast reconnection
 * DISABLED in development to prevent RAM hammering
 * NOTE: Has schema mismatches - needs database schema updates before production use
 */
export async function startBrokerMonitor() {
  console.log('❌ [BROKER MONITOR] Disabled - schema mismatches need to be fixed');
  console.log('💡 [BROKER MONITOR] Run schema migration to add missing fields before enabling');
  return;
  
  /* TEMPORARILY DISABLED DUE TO SCHEMA ISSUES
  if (!BROKER_WALLET_ADDRESS || !BROKER_WALLET_SEED) {
    console.error('❌ [BROKER MONITOR] Missing broker wallet credentials');
    return;
  }

  // Skip broker monitor in development mode to prevent RAM issues
  if (process.env.NODE_ENV === 'development') {
    console.log('💓 [BROKER MONITOR] Skipping broker monitor in development mode');
    console.log('💡 [BROKER MONITOR] Enable in production with NODE_ENV=production');
    return;
  }
  */

  try {
    const client = new Client(XRPL_WSS);
    await client.connect();
    config.client = client;
    config.enabled = true;
    config.reconnectAttempts = 0;

    console.log('✅ [BROKER MONITOR] Connected to XRPL (Real-time monitoring active)');
    console.log(`🔍 [BROKER MONITOR] Watching broker wallet: ${BROKER_WALLET_ADDRESS}`);

    // Subscribe to broker wallet transactions for instant detection
    await client.request({
      command: 'subscribe',
      accounts: [BROKER_WALLET_ADDRESS]
    });

    // Start heartbeat to keep connection alive
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
    
    heartbeatInterval = setInterval(async () => {
      try {
        if (config.client && config.enabled) {
          await config.client.request({ command: 'ping' });
          console.log('💓 [BROKER MONITOR] Heartbeat - connection alive');
        }
      } catch (error) {
        console.error('❌ [BROKER MONITOR] Heartbeat failed, reconnecting...');
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        config.enabled = false;
        setTimeout(() => startBrokerMonitor(), RECONNECT_DELAY_MS);
      }
    }, HEARTBEAT_INTERVAL_MS);

    // Listen for validated transactions (REAL-TIME)
    client.on('transaction', async (tx: any) => {
      try {
        const startTime = Date.now();
        config.lastTransactionTime = new Date();
        
        await handleBrokerTransaction(tx, client);
        
        const processingTime = Date.now() - startTime;
        console.log(`⚡ [BROKER MONITOR] Transaction processed in ${processingTime}ms`);
      } catch (error) {
        console.error('❌ [BROKER MONITOR] Transaction handler error:', error);
      }
    });

    // Handle disconnections with fast reconnect
    client.on('disconnected', async () => {
      console.log(`⚠️ [BROKER MONITOR] Disconnected (attempt ${config.reconnectAttempts + 1}), reconnecting in ${RECONNECT_DELAY_MS}ms...`);
      config.enabled = false;
      config.reconnectAttempts++;
      
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
      
      setTimeout(() => startBrokerMonitor(), RECONNECT_DELAY_MS);
    });

  } catch (error) {
    console.error('❌ [BROKER MONITOR] Failed to start:', error);
    config.reconnectAttempts++;
    const delay = Math.min(RECONNECT_DELAY_MS * config.reconnectAttempts, 30000);
    console.log(`🔄 [BROKER MONITOR] Retrying in ${delay}ms...`);
    setTimeout(() => startBrokerMonitor(), delay);
  }
}

/**
 * Handle incoming transaction to broker wallet
 */
async function handleBrokerTransaction(tx: any, client: Client) {
  const transaction = tx.transaction;
  const meta = tx.meta;

  // Ensure transaction is validated
  if (tx.status !== 'closed' || tx.validated !== true) {
    return;
  }

  const txHash = transaction.hash;
  const txType = transaction.TransactionType;

  console.log(`📥 [BROKER MONITOR] Detected ${txType} transaction: ${txHash}`);

  // Handle different transaction types
  switch (txType) {
    case 'Payment':
      await handlePaymentToEscrow(transaction, txHash, client);
      break;
    
    case 'NFTokenAcceptOffer':
      await handleOfferAcceptance(transaction, txHash, client);
      break;
    
    case 'NFTokenCancelOffer':
      await handleOfferCancellation(transaction, txHash, client);
      break;
    
    default:
      console.log(`ℹ️ [BROKER MONITOR] Ignoring ${txType} transaction`);
  }
}

/**
 * Step 1: Handle payment to broker wallet (buyer sends XRP with NFT info in memo)
 * Supports both BUY and SELL escrow flows
 */
async function handlePaymentToEscrow(payment: Payment, txHash: string, client: Client) {
  // Check if payment is TO broker wallet
  if (payment.Destination !== BROKER_WALLET_ADDRESS) {
    return;
  }

  const amountDrops = typeof payment.Amount === 'string' ? payment.Amount : payment.Amount.value;
  const amountXRP = parseFloat(amountDrops) / 1000000;
  const buyerAddress = payment.Account;

  console.log(`💰 [ESCROW] Received ${amountXRP} XRP from ${buyerAddress}`);

  // Parse memo for NFT token ID
  const memo = payment.Memos?.[0];
  if (!memo) {
    console.log('⚠️ [ESCROW] Payment missing memo with NFT info');
    return;
  }

  const memoData = Buffer.from(memo.Memo.MemoData || '', 'hex').toString('utf-8');
  let nftInfo: any;
  
  try {
    nftInfo = JSON.parse(memoData);
  } catch {
    console.log('⚠️ [ESCROW] Invalid memo format');
    return;
  }

  const { nftTokenId, nftOwner, buyerHandle, buyerOfferIndex, sellerOfferIndex } = nftInfo;

  if (!nftTokenId || !nftOwner || !buyerOfferIndex) {
    console.log('⚠️ [ESCROW] Memo missing required fields (nftTokenId, nftOwner, or buyerOfferIndex)');
    return;
  }

  // Determine escrow type based on sellerOfferIndex presence
  const escrowType = sellerOfferIndex ? 'sell' : 'buy';
  
  console.log(`📋 [ESCROW] Type: ${escrowType.toUpperCase()} escrow`);
  console.log(`  └─ Buyer offer: ${buyerOfferIndex}`);
  if (sellerOfferIndex) {
    console.log(`  └─ Seller offer: ${sellerOfferIndex}`);
  }

  // Calculate fees
  const totalAmountDrops = parseFloat(amountDrops);
  const brokerFeeDrops = Math.floor(totalAmountDrops * (BROKER_FEE_PERCENTAGE / 100));
  const sellerAmountDrops = totalAmountDrops - brokerFeeDrops;

  // Store escrow record
  const escrowId = nanoid();
  await db.insert(brokerEscrow).values({
    id: escrowId,
    escrowType,
    userAddress: buyerAddress,
    userHandle: buyerHandle || null,
    nftTokenId,
    nftOwner,
    buyerOfferIndex,
    sellerOfferIndex: sellerOfferIndex || null,
    escrowAmount: amountDrops,
    brokerFee: brokerFeeDrops.toString(),
    royaltyAmount: '0',
    sellerAmount: sellerAmountDrops.toString(),
    paymentTxHash: txHash,
    paymentValidated: new Date(),
    status: 'escrow_received'
  } as any);

  console.log(`✅ [ESCROW] Created ${escrowType} escrow ${escrowId} for NFT ${nftTokenId}`);

  // Execute appropriate flow based on type
  if (escrowType === 'sell') {
    // SELL escrow: Broker accepts seller's stagnant offer
    await acceptSellerOffer(escrowId, client);
  } else {
    // BUY escrow: Broker creates buy offer to owner
    await createBrokerBuyOffer(escrowId, client);
  }
}

/**
 * Step 2: Broker automatically creates buy offer to NFT owner
 */
async function createBrokerBuyOffer(escrowId: string, client: Client) {
  const escrow = await db.query.brokerEscrow.findFirst({
    where: eq(brokerEscrow.id, escrowId)
  });

  if (!escrow) {
    console.error(`❌ [BROKER OFFER] Escrow ${escrowId} not found`);
    return;
  }

  const wallet = Wallet.fromSeed(BROKER_WALLET_SEED!);
  const offerAmountDrops = escrow.sellerAmount; // Offer amount to owner (minus broker fee)

  console.log(`📤 [BROKER OFFER] Creating buy offer for NFT ${escrow.nftTokenId}`);

  try {
    const tx = {
      TransactionType: 'NFTokenCreateOffer' as const,
      Account: wallet.address,
      NFTokenID: escrow.nftTokenId,
      Amount: offerAmountDrops,
      Owner: escrow.nftOwner, // Offer to NFT owner
      Flags: 0 // Buy offer
    };

    const prepared = await client.autofill(tx);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    if (result.result.meta && typeof result.result.meta === 'object') {
      const meta = result.result.meta as any;
      let offerIndex: string | null = null;

      // Extract offer index from AffectedNodes
      if (meta.AffectedNodes && Array.isArray(meta.AffectedNodes)) {
        for (const node of meta.AffectedNodes) {
          if (node.CreatedNode?.LedgerEntryType === 'NFTokenOffer') {
            offerIndex = node.CreatedNode.LedgerIndex;
            console.log(`📍 [BROKER OFFER] Found offer index in CreatedNode: ${offerIndex}`);
            break;
          }
        }
      }

      if (!offerIndex) {
        console.error('❌ [BROKER OFFER] Could not extract offer index from transaction meta');
        throw new Error('Failed to extract offer index from blockchain');
      }

      // Update escrow with broker offer info
      await db.update(brokerEscrow)
        .set({
          brokerOfferIndex: offerIndex,
          brokerOfferTxHash: result.result.hash,
          brokerOfferCreated: new Date(),
          status: 'offer_created',
          updatedAt: new Date()
        } as any)
        .where(eq(brokerEscrow.id, escrowId));

      console.log(`✅ [BROKER OFFER] Created offer ${offerIndex} to owner ${escrow.nftOwner}`);
    }
  } catch (error) {
    console.error('❌ [BROKER OFFER] Failed to create offer:', error);
    
    // Update escrow status to failed
    await db.update(brokerEscrow)
      .set({
        status: 'failed',
        cancellationReason: `Failed to create broker offer: ${error}`,
        updatedAt: new Date()
      } as any)
      .where(eq(brokerEscrow.id, escrowId));
  }
}

/**
 * Step 2 (SELL escrow): Broker accepts seller's stagnant sell offer
 */
async function acceptSellerOffer(escrowId: string, client: Client) {
  const escrow = await db.query.brokerEscrow.findFirst({
    where: eq(brokerEscrow.id, escrowId)
  });

  if (!escrow || !escrow.sellerOfferIndex) {
    console.error('❌ [SELL ESCROW] Escrow or seller offer index not found');
    return;
  }

  console.log(`🛒 [SELL ESCROW] Accepting seller's offer ${escrow.sellerOfferIndex} for NFT ${escrow.nftTokenId}`);

  try {
    const wallet = Wallet.fromSeed(BROKER_WALLET_SEED!);

    // Accept seller's sell offer to get NFT
    const tx: NFTokenAcceptOffer = {
      TransactionType: 'NFTokenAcceptOffer',
      Account: wallet.address,
      NFTokenSellOffer: escrow.sellerOfferIndex
    };

    const prepared = await client.autofill(tx);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    console.log(`✅ [SELL ESCROW] Accepted seller's offer, NFT transferred to broker`);

    // Update escrow with acceptance info
    await db.update(brokerEscrow)
      .set({
        acceptedTxHash: result.result.hash,
        acceptedAt: new Date(),
        status: 'offer_accepted',
        updatedAt: new Date()
      } as any)
      .where(eq(brokerEscrow.id, escrowId));

    // Step 3: Auto-transfer NFT to buyer using buyer's stagnant offer
    await transferNftToBuyer(escrowId, client);

  } catch (error) {
    console.error('❌ [SELL ESCROW] Failed to accept seller offer:', error);
    
    await db.update(brokerEscrow)
      .set({
        status: 'failed',
        cancellationReason: `Failed to accept seller offer: ${error}`,
        updatedAt: new Date()
      } as any)
      .where(eq(brokerEscrow.id, escrowId));
  }
}

/**
 * Step 3 & 4: Handle NFT owner accepting broker's offer (BUY escrow only)
 * When owner accepts, NFT transfers to broker, then broker auto-transfers to buyer
 */
async function handleOfferAcceptance(acceptTx: NFTokenAcceptOffer, txHash: string, client: Client) {
  const offerIndex = acceptTx.NFTokenSellOffer || acceptTx.NFTokenBuyOffer;
  
  if (!offerIndex) {
    return;
  }

  // Find escrow by broker offer index
  const escrow = await db.query.brokerEscrow.findFirst({
    where: eq(brokerEscrow.brokerOfferIndex, offerIndex)
  });

  if (!escrow) {
    console.log(`ℹ️ [ACCEPT] Not a broker escrow offer: ${offerIndex}`);
    return;
  }

  console.log(`🎯 [ACCEPT] Owner accepted broker offer for escrow ${escrow.id}`);

  // Update escrow with acceptance info
  await db.update(brokerEscrow)
    .set({
      acceptedTxHash: txHash,
      acceptedAt: new Date(),
      status: 'offer_accepted',
      updatedAt: new Date()
    } as any)
    .where(eq(brokerEscrow.id, escrow.id));

  // Step 5: Auto-transfer NFT to buyer using buyer's stagnant offer
  await transferNftToBuyer(escrow.id, client);
}

/**
 * Step 5: Broker auto-accepts buyer's stagnant offer to transfer NFT
 */
async function transferNftToBuyer(escrowId: string, client: Client) {
  const escrow = await db.query.brokerEscrow.findFirst({
    where: eq(brokerEscrow.id, escrowId)
  });

  if (!escrow) {
    return;
  }

  console.log(`🚚 [TRANSFER] Using buyer's stagnant offer ${escrow.buyerOfferIndex} for NFT ${escrow.nftTokenId}`);

  try {
    if (!escrow.buyerOfferIndex) {
      console.error('❌ [TRANSFER] Buyer offer index not found in escrow record');
      await db.update(brokerEscrow)
        .set({
          status: 'transfer_failed',
          cancellationReason: 'Buyer offer index missing from escrow',
          updatedAt: new Date()
        } as any)
        .where(eq(brokerEscrow.id, escrowId));
      return;
    }

    const wallet = Wallet.fromSeed(BROKER_WALLET_SEED!);

    // Accept buyer's stagnant buy offer to transfer NFT
    const tx: NFTokenAcceptOffer = {
      TransactionType: 'NFTokenAcceptOffer',
      Account: wallet.address,
      NFTokenBuyOffer: escrow.buyerOfferIndex // Accept buyer's BUY offer
    };

    const prepared = await client.autofill(tx);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    // Update escrow as completed
    await db.update(brokerEscrow)
      .set({
        nftTransferTxHash: result.result.hash,
        nftTransferredAt: new Date(),
        status: 'completed',
        updatedAt: new Date()
      } as any)
      .where(eq(brokerEscrow.id, escrowId));

    console.log(`✅ [TRANSFER] NFT transferred to buyer ${escrow.userAddress}`);
    console.log(`🎉 [ESCROW] Escrow ${escrowId} completed successfully!`);

  } catch (error) {
    console.error('❌ [TRANSFER] Failed to transfer NFT:', error);
    
    await db.update(brokerEscrow)
      .set({
        status: 'transfer_failed',
        cancellationReason: `NFT transfer failed: ${error}`,
        updatedAt: new Date()
      } as any)
      .where(eq(brokerEscrow.id, escrowId));
  }
}

/**
 * Step 6 & 7: Handle buyer cancelling offers - auto-refund with fee
 * XRPL allows up to 16 offers to be cancelled in one transaction
 */
async function handleOfferCancellation(cancelTx: any, txHash: string, client: Client) {
  const cancelledOffers = cancelTx.NFTokenOffers;
  
  if (!cancelledOffers || !Array.isArray(cancelledOffers) || cancelledOffers.length === 0) {
    return;
  }

  console.log(`📋 [CANCEL] Processing ${cancelledOffers.length} cancelled offer(s) in transaction ${txHash}`);

  // Process each cancelled offer
  for (const cancelledOfferIndex of cancelledOffers) {
    // Find escrow by matching the cancelled offer index to buyer's stagnant offer
    // Support all refundable states: escrow_received, offer_created, transfer_failed
    const escrows = await db.query.brokerEscrow.findMany({
      where: eq(brokerEscrow.buyerOfferIndex, cancelledOfferIndex)
    });

    const refundableStatuses = ['escrow_received', 'offer_created', 'transfer_failed', 'failed'];
    const escrow = escrows.find(e => refundableStatuses.includes(e.status));

    if (!escrow) {
      console.log(`ℹ️ [CANCEL] Cancelled offer ${cancelledOfferIndex} not found in refundable escrows`);
      continue; // Check next cancelled offer
    }

    console.log(`❌ [CANCEL] Buyer cancelled offer ${cancelledOfferIndex}, initiating refund for escrow ${escrow.id} (status: ${escrow.status})`);

    // Cancel broker's offer to owner (if it exists)
    if (escrow.brokerOfferIndex && escrow.status === 'offer_created') {
      await cancelBrokerOffer(escrow, client);
    } else {
      console.log(`ℹ️ [CANCEL] No broker offer to cancel (status: ${escrow.status})`);
    }

    // Refund buyer (full amount with fee)
    await refundBuyer(escrow, client);
  }

  console.log(`✅ [CANCEL] Processed all cancelled offers in transaction ${txHash}`);
}

/**
 * Cancel broker's offer to NFT owner
 */
async function cancelBrokerOffer(escrow: any, client: Client) {
  if (!escrow.brokerOfferIndex) {
    return;
  }

  try {
    const wallet = Wallet.fromSeed(BROKER_WALLET_SEED!);

    const tx = {
      TransactionType: 'NFTokenCancelOffer' as const,
      Account: wallet.address,
      NFTokenOffers: [escrow.brokerOfferIndex]
    };

    const prepared = await client.autofill(tx as any);
    const signed = wallet.sign(prepared);
    await client.submitAndWait(signed.tx_blob);

    console.log(`✅ [CANCEL] Cancelled broker offer ${escrow.brokerOfferIndex}`);
  } catch (error) {
    console.error('❌ [CANCEL] Failed to cancel broker offer:', error);
  }
}

/**
 * Refund buyer with full amount including fee
 */
async function refundBuyer(escrow: any, client: Client) {
  try {
    const wallet = (await import('xrpl')).Wallet.fromSeed(BROKER_WALLET_SEED!);
    const refundAmount = escrow.escrowAmount; // Full amount with fee

    const tx: Payment = {
      TransactionType: 'Payment',
      Account: wallet.address,
      Destination: escrow.userAddress,
      Amount: refundAmount,
      Memos: [{
        Memo: {
          MemoData: Buffer.from(`Refund for cancelled NFT offer: ${escrow.nftTokenId}`, 'utf-8').toString('hex').toUpperCase(),
          MemoType: Buffer.from('REFUND', 'utf-8').toString('hex').toUpperCase()
        }
      }]
    };

    const prepared = await client.autofill(tx);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    // Update escrow as refunded
    await db.update(brokerEscrow)
      .set({
        refundTxHash: result.result.hash,
        refundedAt: new Date(),
        status: 'refunded',
        cancellationReason: 'Buyer cancelled offer',
        updatedAt: new Date()
      } as any)
      .where(eq(brokerEscrow.id, escrow.id));

    console.log(`✅ [REFUND] Refunded ${parseFloat(refundAmount) / 1000000} XRP to ${escrow.userAddress}`);

  } catch (error) {
    console.error('❌ [REFUND] Failed to refund buyer:', error);
    
    await db.update(brokerEscrow)
      .set({
        status: 'refund_failed',
        cancellationReason: `Refund failed: ${error}`,
        updatedAt: new Date()
      } as any)
      .where(eq(brokerEscrow.id, escrow.id));
  }
}

/**
 * Stop monitoring
 */
export async function stopBrokerMonitor() {
  if (config.client) {
    await config.client.disconnect();
    config.enabled = false;
    console.log('🛑 [BROKER MONITOR] Stopped');
  }
}

/**
 * Get monitor status
 */
export function getBrokerMonitorStatus() {
  return {
    enabled: config.enabled,
    connected: config.client?.isConnected() || false,
    brokerAddress: BROKER_WALLET_ADDRESS,
    lastTransactionTime: config.lastTransactionTime,
    reconnectAttempts: config.reconnectAttempts,
    monitoring: config.enabled && config.client?.isConnected() ? 'real-time' : 'offline'
  };
}
