/**
 * XRPL NFT Brokered Offer System
 * 
 * Based on XRPL XLS-20 NFT brokered sales specification
 * 
 * Flow:
 * 1. Seller creates sell offer (NFTokenCreateOffer) with Destination = broker
 * 2. Buyer creates buy offer (NFTokenCreateOffer) 
 * 3. Broker matches and accepts (NFTokenAcceptOffer) with 1% broker fee
 * 
 * Fee Calculation: BrokerFee is absolute amount (not percentage)
 * - Calculate: fee = sellAmount * 0.01
 * - Ensure: buyAmount >= sellAmount + fee
 * - Result: Buyer pays total, Broker gets fee, Seller gets net amount
 */

import * as xrpl from 'xrpl';
import { getXrplClient, disconnectClient } from './xrpl-wallet';

const BROKER_FEE_PERCENTAGE = 0.01; // 1% broker fee
const BROKER_ADDRESS = 'rGLzXKif4ksBZe2MY6RZT9m69hdgzsXG4X'; // RiddleSwap broker wallet

/**
 * Create a SELL offer for an NFT
 * Seller specifies the NET amount they want to receive (before broker fee)
 * Offer is restricted to broker address only
 */
export async function createSellOffer(
  sellerPrivateKey: string,
  nftTokenId: string,
  netAmountXRP: number,
  expirationDays?: number
): Promise<{
  success: boolean;
  offerIndex?: string;
  txHash?: string;
  error?: string;
}> {
  let client: xrpl.Client | null = null;
  
  try {
    console.log(`💰 [NFT SELL OFFER] Creating sell offer for NFT ${nftTokenId} at ${netAmountXRP} XRP net`);
    
    const wallet = xrpl.Wallet.fromSeed(sellerPrivateKey);
    client = await getXrplClient();
    
    // Build sell offer transaction
    const sellOffer: xrpl.NFTokenCreateOffer = {
      TransactionType: 'NFTokenCreateOffer',
      Account: wallet.address,
      NFTokenID: nftTokenId,
      Amount: xrpl.xrpToDrops(netAmountXRP), // NET amount seller wants
      Flags: xrpl.NFTokenCreateOfferFlags.tfSellNFToken,
      Destination: BROKER_ADDRESS, // Only broker can accept this offer
    };
    
    // Add expiration if specified
    if (expirationDays && expirationDays > 0) {
      const rippleEpoch = 946684800; // Ripple epoch offset (2000-01-01)
      const currentTime = Math.floor(Date.now() / 1000);
      const expirationTime = currentTime + (expirationDays * 24 * 60 * 60);
      sellOffer.Expiration = expirationTime - rippleEpoch;
      console.log(`⏰ [NFT SELL OFFER] Expiration set to ${expirationDays} days from now`);
    }
    
    // Prepare and sign transaction
    const prepared = await client.autofill(sellOffer);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);
    
    const meta = result.result.meta as any;
    if (meta?.TransactionResult === 'tesSUCCESS') {
      // Extract offer index from transaction metadata
      const offerIndex = meta.offer_index || meta.nft_offer_index;
      
      console.log(`✅ [NFT SELL OFFER] Created successfully!`);
      console.log(`   Offer Index: ${offerIndex}`);
      console.log(`   Transaction: ${result.result.hash}`);
      
      return {
        success: true,
        offerIndex: offerIndex,
        txHash: result.result.hash
      };
    } else {
      throw new Error(`Transaction failed: ${meta?.TransactionResult}`);
    }
    
  } catch (error) {
    console.error('❌ [NFT SELL OFFER] Failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create sell offer'
    };
  } finally {
    if (client) {
      await disconnectClient(client);
    }
  }
}

/**
 * Create a BUY offer for an NFT
 * Buyer must offer >= (seller net amount + 1% broker fee)
 */
export async function createBuyOffer(
  buyerPrivateKey: string,
  nftTokenId: string,
  ownerAddress: string,
  totalAmountXRP: number,
  expirationDays?: number
): Promise<{
  success: boolean;
  offerIndex?: string;
  txHash?: string;
  error?: string;
}> {
  let client: xrpl.Client | null = null;
  
  try {
    console.log(`💰 [NFT BUY OFFER] Creating buy offer for NFT ${nftTokenId} at ${totalAmountXRP} XRP total`);
    
    const wallet = xrpl.Wallet.fromSeed(buyerPrivateKey);
    client = await getXrplClient();
    
    // Build buy offer transaction
    const buyOffer: xrpl.NFTokenCreateOffer = {
      TransactionType: 'NFTokenCreateOffer',
      Account: wallet.address,
      NFTokenID: nftTokenId,
      Owner: ownerAddress, // Current NFT owner
      Amount: xrpl.xrpToDrops(totalAmountXRP), // Total amount buyer is willing to pay
    };
    
    // Add expiration if specified
    if (expirationDays && expirationDays > 0) {
      const rippleEpoch = 946684800;
      const currentTime = Math.floor(Date.now() / 1000);
      const expirationTime = currentTime + (expirationDays * 24 * 60 * 60);
      buyOffer.Expiration = expirationTime - rippleEpoch;
      console.log(`⏰ [NFT BUY OFFER] Expiration set to ${expirationDays} days from now`);
    }
    
    // Prepare and sign transaction
    const prepared = await client.autofill(buyOffer);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);
    
    const meta = result.result.meta as any;
    if (meta?.TransactionResult === 'tesSUCCESS') {
      const offerIndex = meta.offer_index || meta.nft_offer_index;
      
      console.log(`✅ [NFT BUY OFFER] Created successfully!`);
      console.log(`   Offer Index: ${offerIndex}`);
      console.log(`   Transaction: ${result.result.hash}`);
      
      return {
        success: true,
        offerIndex: offerIndex,
        txHash: result.result.hash
      };
    } else {
      throw new Error(`Transaction failed: ${meta?.TransactionResult}`);
    }
    
  } catch (error) {
    console.error('❌ [NFT BUY OFFER] Failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create buy offer'
    };
  } finally {
    if (client) {
      await disconnectClient(client);
    }
  }
}

/**
 * Broker accepts a matched sell/buy offer pair
 * Atomically transfers NFT and distributes payment with 1% broker fee
 * 
 * SECURITY: Fetches authoritative sell/buy offer amounts from XRPL ledger
 * to prevent fee manipulation by caller
 * 
 * Payment Flow:
 * - Buyer pays totalAmount
 * - Broker receives brokerFee (1% of seller net)
 * - Seller receives sellAmount (net amount from their offer)
 * - Any NFT transfer fee goes to issuer
 */
export async function acceptBrokeredOffer(
  brokerPrivateKey: string,
  sellOfferIndex: string,
  buyOfferIndex: string
): Promise<{
  success: boolean;
  txHash?: string;
  balanceChanges?: any;
  sellAmountXRP?: number;
  brokerFeeXRP?: number;
  error?: string;
}> {
  let client: xrpl.Client | null = null;
  
  try {
    console.log(`🤝 [NFT BROKER ACCEPT] Matching offers...`);
    console.log(`   Sell Offer: ${sellOfferIndex}`);
    console.log(`   Buy Offer: ${buyOfferIndex}`);
    
    const wallet = xrpl.Wallet.fromSeed(brokerPrivateKey);
    
    // Verify this is the broker wallet
    if (wallet.address !== BROKER_ADDRESS) {
      throw new Error(`Unauthorized: This is not the broker wallet`);
    }
    
    client = await getXrplClient();
    
    // SECURITY FIX: Fetch authoritative sell offer from XRPL ledger
    console.log(`🔍 [NFT BROKER ACCEPT] Fetching authoritative offer amounts from ledger...`);
    let sellOfferData: any;
    let buyOfferData: any;
    
    try {
      // Get sell offer details
      const sellOfferResponse = await client.request({
        command: 'ledger_entry',
        index: sellOfferIndex,
        ledger_index: 'validated'
      });
      sellOfferData = sellOfferResponse.result.node;
      
      // Get buy offer details
      const buyOfferResponse = await client.request({
        command: 'ledger_entry',
        index: buyOfferIndex,
        ledger_index: 'validated'
      });
      buyOfferData = buyOfferResponse.result.node;
    } catch (error) {
      throw new Error(`Failed to fetch offer data from ledger: ${error}`);
    }
    
    // Validate offer details before processing
    const sellNFTokenID = sellOfferData.NFTokenID;
    const buyNFTokenID = buyOfferData.NFTokenID;
    const sellDestination = sellOfferData.Destination;
    
    // Validate offers match the same NFT
    if (sellNFTokenID !== buyNFTokenID) {
      throw new Error(`NFT mismatch: sell offer ${sellNFTokenID} != buy offer ${buyNFTokenID}`);
    }
    
    // Validate sell offer is restricted to broker
    if (sellDestination !== BROKER_ADDRESS) {
      throw new Error(
        `Sell offer destination ${sellDestination} does not match broker ${BROKER_ADDRESS}`
      );
    }
    
    // Extract amounts from offers (XRP only for now)
    // Guard against non-XRP (IOU/token) offers
    if (typeof sellOfferData.Amount !== 'string') {
      throw new Error(
        `Non-XRP sell offers not supported. Sell offer uses issued currency: ${JSON.stringify(sellOfferData.Amount)}`
      );
    }
    if (typeof buyOfferData.Amount !== 'string') {
      throw new Error(
        `Non-XRP buy offers not supported. Buy offer uses issued currency: ${JSON.stringify(buyOfferData.Amount)}`
      );
    }
    
    const sellAmountDrops = sellOfferData.Amount;
  const sellAmountXRP = parseFloat(String(xrpl.dropsToXrp(String(sellAmountDrops))));
    
    const buyAmountDrops = buyOfferData.Amount;
  const buyAmountXRP = parseFloat(String(xrpl.dropsToXrp(String(buyAmountDrops))));
    
    console.log(`✅ [NFT BROKER ACCEPT] Authoritative amounts from ledger:`);
    console.log(`   NFT Token ID: ${sellNFTokenID}`);
    console.log(`   Sell Offer Amount: ${sellAmountXRP} XRP (seller's net)`);
    console.log(`   Buy Offer Amount: ${buyAmountXRP} XRP (buyer's total)`);
    console.log(`   Sell Destination: ${sellDestination} (verified = broker)`);
    
    // Calculate 1% broker fee on seller's authoritative net amount
    const brokerFeeXRP = sellAmountXRP * BROKER_FEE_PERCENTAGE;
    const brokerFeeDrops = xrpl.xrpToDrops(brokerFeeXRP);
    const requiredBuyAmount = sellAmountXRP + brokerFeeXRP;
    
    console.log(`💰 [NFT BROKER ACCEPT] Fee breakdown:`);
    console.log(`   Seller receives: ${sellAmountXRP} XRP (net)`);
    console.log(`   Broker fee (1%): ${brokerFeeXRP} XRP`);
    console.log(`   Required buy amount: ${requiredBuyAmount} XRP`);
    console.log(`   Actual buy amount: ${buyAmountXRP} XRP`);
    
    // Validate buy offer is sufficient
    if (buyAmountXRP < requiredBuyAmount) {
      throw new Error(
        `Insufficient buy offer: ${buyAmountXRP} XRP < ${requiredBuyAmount} XRP (seller ${sellAmountXRP} + broker fee ${brokerFeeXRP})`
      );
    }
    
    // Build brokered accept transaction
    const acceptOffer: xrpl.NFTokenAcceptOffer = {
      TransactionType: 'NFTokenAcceptOffer',
      Account: wallet.address, // Broker address
      NFTokenSellOffer: sellOfferIndex,
      NFTokenBuyOffer: buyOfferIndex,
      NFTokenBrokerFee: brokerFeeDrops, // Absolute fee amount in drops (1% of authoritative sell amount)
    };
    
    // Prepare and sign transaction
    const prepared = await client.autofill(acceptOffer);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);
    
    const meta = result.result.meta as any;
    if (meta?.TransactionResult === 'tesSUCCESS') {
      // Get balance changes to verify payment distribution
      const balanceChanges = xrpl.getBalanceChanges(meta);
      
      console.log(`✅ [NFT BROKER ACCEPT] Trade completed successfully!`);
      console.log(`   Transaction: ${result.result.hash}`);
      console.log(`   Balance Changes:`, JSON.stringify(balanceChanges, null, 2));
      
      return {
        success: true,
        txHash: result.result.hash,
        balanceChanges: balanceChanges,
        sellAmountXRP: sellAmountXRP,
        brokerFeeXRP: brokerFeeXRP
      };
    } else {
      throw new Error(`Transaction failed: ${meta?.TransactionResult}`);
    }
    
  } catch (error) {
    console.error('❌ [NFT BROKER ACCEPT] Failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to accept brokered offer'
    };
  } finally {
    if (client) {
      await disconnectClient(client);
    }
  }
}

/**
 * Cancel an NFT offer (sell or buy)
 * Only the offer creator can cancel their own offer
 */
export async function cancelOffer(
  ownerPrivateKey: string,
  offerIndex: string
): Promise<{
  success: boolean;
  txHash?: string;
  error?: string;
}> {
  let client: xrpl.Client | null = null;
  
  try {
    console.log(`🗑️ [NFT CANCEL OFFER] Canceling offer ${offerIndex}`);
    
    const wallet = xrpl.Wallet.fromSeed(ownerPrivateKey);
    client = await getXrplClient();
    
    const cancelTx: xrpl.NFTokenCancelOffer = {
      TransactionType: 'NFTokenCancelOffer',
      Account: wallet.address,
      NFTokenOffers: [offerIndex]
    };
    
    const prepared = await client.autofill(cancelTx);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);
    
    const meta = result.result.meta as any;
    if (meta?.TransactionResult === 'tesSUCCESS') {
      console.log(`✅ [NFT CANCEL OFFER] Offer canceled: ${result.result.hash}`);
      
      return {
        success: true,
        txHash: result.result.hash
      };
    } else {
      throw new Error(`Transaction failed: ${meta?.TransactionResult}`);
    }
    
  } catch (error) {
    console.error('❌ [NFT CANCEL OFFER] Failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel offer'
    };
  } finally {
    if (client) {
      await disconnectClient(client);
    }
  }
}

/**
 * Get all offers for a specific NFT
 */
export async function getNFTOffers(
  nftTokenId: string
): Promise<{
  success: boolean;
  sellOffers?: any[];
  buyOffers?: any[];
  error?: string;
}> {
  let client: xrpl.Client | null = null;
  
  try {
    client = await getXrplClient();
    
    // Get sell offers
    const sellOffersResponse = await client.request({
      command: 'nft_sell_offers',
      nft_id: nftTokenId
    });
    
    // Get buy offers
    const buyOffersResponse = await client.request({
      command: 'nft_buy_offers',
      nft_id: nftTokenId
    });
    
    return {
      success: true,
      sellOffers: sellOffersResponse.result.offers || [],
      buyOffers: buyOffersResponse.result.offers || []
    };
    
  } catch (error) {
    console.error('❌ [GET NFT OFFERS] Failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get NFT offers'
    };
  } finally {
    if (client) {
      await disconnectClient(client);
    }
  }
}

/**
 * IMMEDIATE BUY NOW with Broker Fee (Atomic Transaction)
 * 
 * This enables "Buy Now" functionality when a sell offer already exists:
 * 1. Fetches existing sell offer from ledger
 * 2. Buyer creates buy offer for (sell amount + 1% fee)
 * 3. Broker immediately accepts both offers atomically
 * 
 * All happens in rapid succession (~5-10 seconds total)
 * 
 * @param buyerPrivateKey - Buyer's XRPL wallet seed/private key
 * @param brokerPrivateKey - Broker's XRPL wallet seed/private key  
 * @param sellOfferIndex - The existing sell offer to purchase
 * @returns Transaction details and amounts
 */
export async function immediatelyBuyWithBrokerFee(
  buyerPrivateKey: string,
  brokerPrivateKey: string,
  sellOfferIndex: string
): Promise<{
  success: boolean;
  buyOfferTxHash?: string;
  acceptTxHash?: string;
  sellAmountXRP?: number;
  brokerFeeXRP?: number;
  totalPaidXRP?: number;
  nftTokenId?: string;
  error?: string;
}> {
  let client: xrpl.Client | null = null;
  
  try {
    console.log(`🛒 [IMMEDIATE BUY] Starting immediate brokered purchase...`);
    console.log(`   Sell Offer Index: ${sellOfferIndex}`);
    
    const buyerWallet = xrpl.Wallet.fromSeed(buyerPrivateKey);
    const brokerWallet = xrpl.Wallet.fromSeed(brokerPrivateKey);
    
    // Verify broker wallet
    if (brokerWallet.address !== BROKER_ADDRESS) {
      throw new Error(`Unauthorized: Invalid broker wallet`);
    }
    
    client = await getXrplClient();
    
    // STEP 1: Fetch existing sell offer from ledger
    console.log(`🔍 [IMMEDIATE BUY] Fetching sell offer details from ledger...`);
    let sellOfferData: any;
    
    try {
      const sellOfferResponse = await client.request({
        command: 'ledger_entry',
        index: sellOfferIndex,
        ledger_index: 'validated'
      });
      sellOfferData = sellOfferResponse.result.node;
    } catch (error) {
      throw new Error(`Sell offer not found or expired: ${error}`);
    }
    
    // Extract sell offer details
    const nftTokenId = sellOfferData.NFTokenID;
    const sellDestination = sellOfferData.Destination;
    
    // Validate sell offer uses XRP only
    if (typeof sellOfferData.Amount !== 'string') {
      throw new Error(
        `Non-XRP sell offers not supported. Sell offer uses issued currency: ${JSON.stringify(sellOfferData.Amount)}`
      );
    }
    
    const sellAmountDrops = sellOfferData.Amount;
  const sellAmountXRP = parseFloat(String(xrpl.dropsToXrp(String(sellAmountDrops))));
    
    // Calculate 1% broker fee
    const brokerFeeXRP = sellAmountXRP * BROKER_FEE_PERCENTAGE;
    const totalAmountXRP = sellAmountXRP + brokerFeeXRP;
    const totalAmountDrops = xrpl.xrpToDrops(totalAmountXRP);
    
    console.log(`💰 [IMMEDIATE BUY] Price breakdown:`);
    console.log(`   NFT: ${nftTokenId}`);
    console.log(`   Sell Amount: ${sellAmountXRP} XRP (seller's net)`);
    console.log(`   Broker Fee (1%): ${brokerFeeXRP} XRP`);
    console.log(`   Total to Pay: ${totalAmountXRP} XRP`);
    console.log(`   Sell Destination: ${sellDestination || 'None'}`);
    
    // STEP 2: Buyer creates buy offer for total amount (sell + fee)
    console.log(`📝 [IMMEDIATE BUY] Buyer creating buy offer...`);
    
    const buyOffer: xrpl.NFTokenCreateOffer = {
      TransactionType: 'NFTokenCreateOffer',
      Account: buyerWallet.address,
      NFTokenID: nftTokenId,
      Amount: totalAmountDrops, // Total amount (seller net + broker fee)
      Owner: sellOfferData.Owner, // Target the seller
      // No Flags for buy offer (only sell offers use tfSellNFToken)
    };
    
    const preparedBuyOffer = await client.autofill(buyOffer);
    const signedBuyOffer = buyerWallet.sign(preparedBuyOffer);
    console.log(`✍️ [IMMEDIATE BUY] Submitting buy offer transaction...`);
    
    const buyResult = await client.submitAndWait(signedBuyOffer.tx_blob);
    const buyMeta = buyResult.result.meta as any;
    
    if (buyMeta?.TransactionResult !== 'tesSUCCESS') {
      throw new Error(`Buy offer failed: ${buyMeta?.TransactionResult}`);
    }
    
    // Extract buy offer index
    const buyOfferIndex = buyMeta.offer_index || buyMeta.nft_offer_index;
    const buyOfferTxHash = buyResult.result.hash;
    
    console.log(`✅ [IMMEDIATE BUY] Buy offer created successfully!`);
    console.log(`   Buy Offer Index: ${buyOfferIndex}`);
    console.log(`   Transaction: ${buyOfferTxHash}`);
    
    // STEP 3: Broker immediately accepts both offers atomically
    console.log(`🤝 [IMMEDIATE BUY] Broker accepting offers atomically...`);
    
    const brokerFeeDrops = xrpl.xrpToDrops(brokerFeeXRP);
    
    const acceptOffer: xrpl.NFTokenAcceptOffer = {
      TransactionType: 'NFTokenAcceptOffer',
      Account: brokerWallet.address,
      NFTokenSellOffer: sellOfferIndex,
      NFTokenBuyOffer: buyOfferIndex,
      NFTokenBrokerFee: brokerFeeDrops, // 1% fee in drops
    };
    
    const preparedAccept = await client.autofill(acceptOffer);
    const signedAccept = brokerWallet.sign(preparedAccept);
    console.log(`✍️ [IMMEDIATE BUY] Submitting acceptance transaction...`);
    
    const acceptResult = await client.submitAndWait(signedAccept.tx_blob);
    const acceptMeta = acceptResult.result.meta as any;
    
    if (acceptMeta?.TransactionResult !== 'tesSUCCESS') {
      throw new Error(`Acceptance failed: ${acceptMeta?.TransactionResult}`);
    }
    
    const acceptTxHash = acceptResult.result.hash;
    
    console.log(`🎉 [IMMEDIATE BUY] Purchase completed successfully!`);
    console.log(`   NFT transferred to: ${buyerWallet.address}`);
    console.log(`   Seller received: ${sellAmountXRP} XRP`);
    console.log(`   Broker received: ${brokerFeeXRP} XRP`);
    console.log(`   Acceptance Transaction: ${acceptTxHash}`);
    
    return {
      success: true,
      buyOfferTxHash: buyOfferTxHash,
      acceptTxHash: acceptTxHash,
      sellAmountXRP: sellAmountXRP,
      brokerFeeXRP: brokerFeeXRP,
      totalPaidXRP: totalAmountXRP,
      nftTokenId: nftTokenId
    };
    
  } catch (error) {
    console.error('❌ [IMMEDIATE BUY] Failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Immediate buy failed'
    };
  } finally {
    if (client) {
      await disconnectClient(client);
    }
  }
}
