/**
 * NFT Broker Offer Service
 * Handles XRPL NFT offers with proper broker fee injection (1% fee)
 * Based on xrp.cafe brokered sale mechanism
 */

import * as xrpl from 'xrpl';
import { db } from './db';
import { brokerNftSales, feeTransactions, rewards } from '../shared/schema';
import { getXrplClient, disconnectClient } from './xrpl/xrpl-wallet';

const BROKER_ADDRESS = 'rGLzXKif4ksBZe2MY6RZT9m69hdgzsXG4X';
const BROKER_FEE_PERCENTAGE = 0.01; // 1% broker fee

// Get broker wallet from environment
const BROKER_SEED = process.env.BROKER_WALLET_SEED || '';

interface OfferValidation {
  valid: boolean;
  error?: string;
  sellOffer?: any;
  buyOffer?: any;
  brokerFee?: number;
}

/**
 * Validate offers to prevent same-account exploitation (xrp.cafe vulnerability fix)
 */
export async function validateBrokeredOffers(
  sellOfferId: string,
  buyOfferId: string
): Promise<OfferValidation> {
  let client: xrpl.Client | null = null;
  
  try {
    client = await getXrplClient();
    
    // Fetch both offer objects from ledger
    const sellOfferRequest = await client.request({
      command: 'ledger_entry',
      nft_offer: sellOfferId
    });
    
    const buyOfferRequest = await client.request({
      command: 'ledger_entry',
      nft_offer: buyOfferId
    });
    
    const sellOffer = (sellOfferRequest.result as any).node;
    const buyOffer = (buyOfferRequest.result as any).node;
    
    if (!sellOffer || !buyOffer) {
      return {
        valid: false,
        error: 'One or both offers not found'
      };
    }
    
    // Validate: Different owners (prevent same-account exploit)
    if (sellOffer.Owner === buyOffer.Owner) {
      console.error('❌ [BROKER] Attempted same-account offer brokering!');
      return {
        valid: false,
        error: 'Cannot broker offers from same account'
      };
    }
    
    // Validate: Same NFT
    if (sellOffer.NFTokenID !== buyOffer.NFTokenID) {
      return {
        valid: false,
        error: 'Offers must be for same NFT'
      };
    }
    
    // Validate: Sell offer restricted to broker
    if (sellOffer.Destination && sellOffer.Destination !== BROKER_ADDRESS) {
      return {
        valid: false,
        error: 'Sell offer must be restricted to broker'
      };
    }
    
    // Calculate broker fee (buy amount - sell amount)
    const sellAmountDrops = parseInt(sellOffer.Amount);
    const buyAmountDrops = parseInt(buyOffer.Amount);
    const brokerFeeDrops = buyAmountDrops - sellAmountDrops;
    
    // Validate: Buy price must exceed sell price for broker fee
    if (brokerFeeDrops <= 0) {
      return {
        valid: false,
        error: 'Buy price must exceed sell price for broker fee'
      };
    }
    
    // Calculate expected 1% fee
    const expectedFeeDrops = Math.floor(sellAmountDrops * BROKER_FEE_PERCENTAGE);
    if (brokerFeeDrops < expectedFeeDrops) {
      return {
        valid: false,
        error: `Broker fee too low. Expected at least ${xrpl.dropsToXrp(expectedFeeDrops)} XRP`
      };
    }
    
    return {
      valid: true,
      sellOffer,
      buyOffer,
      brokerFee: brokerFeeDrops
    };
    
  } catch (error) {
    console.error('❌ [BROKER] Offer validation error:', error);
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Validation failed'
    };
  } finally {
    if (client) {
      await disconnectClient(client);
    }
  }
}

/**
 * Accept brokered offers with fee injection
 * This is the core function that matches sell and buy offers
 */
export async function acceptBrokeredOffers(
  sellOfferId: string,
  buyOfferId: string,
  nftTokenId: string,
  sellerAddress: string,
  buyerAddress: string,
  sellerHandle?: string,
  buyerHandle?: string
): Promise<{
  success: boolean;
  txHash?: string;
  brokerFee?: number;
  saleId?: string;
  error?: string;
}> {
  let client: xrpl.Client | null = null;
  
  try {
    // Validate broker seed is configured
    if (!BROKER_SEED) {
      throw new Error('Broker wallet not configured');
    }
    
    // First validate the offers
    const validation = await validateBrokeredOffers(sellOfferId, buyOfferId);
    if (!validation.valid) {
      throw new Error(validation.error || 'Offer validation failed');
    }
    
    console.log(`✅ [BROKER] Offers validated. Broker fee: ${xrpl.dropsToXrp(validation.brokerFee!)} XRP`);
    
    // Connect and prepare broker wallet
    const brokerWallet = xrpl.Wallet.fromSeed(BROKER_SEED);
    client = await getXrplClient();
    
    // Build NFTokenAcceptOffer transaction with both offers
    const acceptOffer: xrpl.NFTokenAcceptOffer = {
      TransactionType: 'NFTokenAcceptOffer',
      Account: brokerWallet.address,
      NFTokenSellOffer: sellOfferId,
      NFTokenBuyOffer: buyOfferId,
      NFTokenBrokerFee: validation.brokerFee!.toString(), // Fee in drops
    };
    
    // Prepare and sign transaction
    const prepared = await client.autofill(acceptOffer);
    const signed = brokerWallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);
    
    const meta = result.result.meta as any;
    if (meta?.TransactionResult !== 'tesSUCCESS') {
      throw new Error(`Transaction failed: ${meta?.TransactionResult}`);
    }
    
    const txHash = result.result.hash;
    const ledgerIndex = result.result.ledger_index;
    
    // Calculate amounts
  // Safely convert drop amounts to XRP strings before parsing – xrpl.dropsToXrp expects a string
  // Convert drops to XRP manually to avoid type mismatches
  const sellAmountXrp = Number(validation.sellOffer!.Amount) / 1_000_000;
  const buyAmountXrp = Number(validation.buyOffer!.Amount) / 1_000_000;
  const brokerFeeXrp = Number(validation.brokerFee!) / 1_000_000;
    
    // Record sale in database
    const [saleRecord] = await db.insert(brokerNftSales).values({
      nft_token_id: nftTokenId,
      seller_address: sellerAddress,
      seller_handle: sellerHandle,
      buyer_address: buyerAddress,
      buyer_handle: buyerHandle,
      broker_address: BROKER_ADDRESS,
      sale_price: sellAmountXrp.toString(),
      broker_fee: brokerFeeXrp.toString(),
      total_amount: buyAmountXrp.toString(),
      sell_offer_id: sellOfferId,
      buy_offer_id: buyOfferId,
      transaction_hash: txHash!,
      ledger_index: ledgerIndex,
      transaction_result: 'tesSUCCESS',
      status: 'completed'
    } as any).returning();
    
    // Record fee transaction for rewards system
    if (buyerHandle) {
      await db.insert(feeTransactions).values({
        user_handle: buyerHandle,
        wallet_address: buyerAddress,
        operation_type: 'marketplace_purchase',
        source_chain: 'xrp',
        fee_amount: brokerFeeXrp.toString(),
        fee_token: 'XRP',
        fee_usd_value: (brokerFeeXrp * 0.5).toString(), // Approximate USD value
        reward_amount: (brokerFeeXrp * 0.25).toString(), // 25% cashback in RDL
        reward_token: 'RDL',
        reward_usd_value: (brokerFeeXrp * 0.125).toString(),
        operation_id: saleRecord.id,
        transaction_hash: txHash
      } as any);
      
      // Create reward record
      await db.insert(rewards).values({
        user_handle: buyerHandle,
        wallet_address: buyerAddress,
        reward_type: 'fee_cashback',
        source_operation: 'marketplace_purchase',
        source_chain: 'xrp',
        reward_token: 'RDL',
        amount: (brokerFeeXrp * 0.25).toString(),
        usd_value: (brokerFeeXrp * 0.125).toString(),
        status: 'claimable',
        description: `NFT purchase cashback (25% of ${brokerFeeXrp} XRP fee)`,
        fee_transaction_id: saleRecord.id
      } as any);
    }
    
    console.log(`✅ [BROKER] NFT sale completed!`);
    console.log(`   Transaction: ${txHash}`);
    console.log(`   Seller receives: ${sellAmountXrp} XRP`);
    console.log(`   Buyer pays: ${buyAmountXrp} XRP`);
    console.log(`   Broker fee: ${brokerFeeXrp} XRP`);
    
    return {
      success: true,
      txHash: txHash!,
      brokerFee: validation.brokerFee,
      saleId: saleRecord.id
    };
    
  } catch (error) {
    console.error('❌ [BROKER] Accept offers failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to accept offers'
    };
  } finally {
    if (client) {
      await disconnectClient(client);
    }
  }
}

/**
 * Create a sell offer restricted to broker
 */
export async function createBrokerSellOffer(
  sellerSeed: string,
  nftTokenId: string,
  priceXrp: number,
  expirationDays?: number
): Promise<{
  success: boolean;
  offerId?: string;
  txHash?: string;
  error?: string;
}> {
  let client: xrpl.Client | null = null;
  
  try {
    const wallet = xrpl.Wallet.fromSeed(sellerSeed);
    client = await getXrplClient();
    
    // Build sell offer restricted to broker
    const sellOffer: xrpl.NFTokenCreateOffer = {
      TransactionType: 'NFTokenCreateOffer',
      Account: wallet.address,
      NFTokenID: nftTokenId,
      Amount: xrpl.xrpToDrops(priceXrp),
      Flags: xrpl.NFTokenCreateOfferFlags.tfSellNFToken,
      Destination: BROKER_ADDRESS, // Only broker can accept
    };
    
    // Add expiration if specified
    if (expirationDays) {
      const rippleEpoch = 946684800;
      const expirationTime = Math.floor(Date.now() / 1000) + (expirationDays * 86400);
      sellOffer.Expiration = expirationTime - rippleEpoch;
    }
    
    const prepared = await client.autofill(sellOffer);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);
    
    const meta = result.result.meta as any;
    if (meta?.TransactionResult !== 'tesSUCCESS') {
      throw new Error(`Transaction failed: ${meta?.TransactionResult}`);
    }
    
    // Extract offer ID from metadata
    const createdOffers = meta.CreatedNodes?.filter(
      (node: any) => node.CreatedNode?.LedgerEntryType === 'NFTokenOffer'
    );
    const offerId = createdOffers?.[0]?.CreatedNode?.LedgerIndex;
    
    return {
      success: true,
      offerId,
      txHash: result.result.hash
    };
    
  } catch (error) {
    console.error('❌ [BROKER] Create sell offer failed:', error);
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
 * Create a buy offer with total amount (price + 1% broker fee)
 */
export async function createBrokerBuyOffer(
  buyerSeed: string,
  nftTokenId: string,
  ownerAddress: string,
  basePriceXrp: number,
  expirationDays?: number
): Promise<{
  success: boolean;
  offerId?: string;
  txHash?: string;
  totalAmount?: number;
  error?: string;
}> {
  let client: xrpl.Client | null = null;
  
  try {
    const wallet = xrpl.Wallet.fromSeed(buyerSeed);
    client = await getXrplClient();
    
    // Calculate total with 1% broker fee
    const brokerFee = basePriceXrp * BROKER_FEE_PERCENTAGE;
    const totalAmount = basePriceXrp + brokerFee;
    
    // Build buy offer
    const buyOffer: xrpl.NFTokenCreateOffer = {
      TransactionType: 'NFTokenCreateOffer',
      Account: wallet.address,
      NFTokenID: nftTokenId,
      Owner: ownerAddress, // Current NFT owner
      Amount: xrpl.xrpToDrops(totalAmount),
      Destination: BROKER_ADDRESS, // Offer can only be brokered
    };
    
    // Add expiration if specified
    if (expirationDays) {
      const rippleEpoch = 946684800;
      const expirationTime = Math.floor(Date.now() / 1000) + (expirationDays * 86400);
      buyOffer.Expiration = expirationTime - rippleEpoch;
    }
    
    const prepared = await client.autofill(buyOffer);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);
    
    const meta = result.result.meta as any;
    if (meta?.TransactionResult !== 'tesSUCCESS') {
      throw new Error(`Transaction failed: ${meta?.TransactionResult}`);
    }
    
    // Extract offer ID from metadata
    const createdOffers = meta.CreatedNodes?.filter(
      (node: any) => node.CreatedNode?.LedgerEntryType === 'NFTokenOffer'
    );
    const offerId = createdOffers?.[0]?.CreatedNode?.LedgerIndex;
    
    return {
      success: true,
      offerId,
      txHash: result.result.hash,
      totalAmount
    };
    
  } catch (error) {
    console.error('❌ [BROKER] Create buy offer failed:', error);
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
 * Get all active offers for an NFT
 */
export async function getNFTOffers(nftTokenId: string): Promise<{
  success: boolean;
  sellOffers: any[];
  buyOffers: any[];
  error?: string;
}> {
  let client: xrpl.Client | null = null;
  
  try {
    client = await getXrplClient();
    
    // Get sell offers
    const sellOffersRequest = await client.request({
      command: 'nft_sell_offers',
      nft_id: nftTokenId,
      ledger_index: 'validated'
    });
    
    // Get buy offers
    const buyOffersRequest = await client.request({
      command: 'nft_buy_offers',
      nft_id: nftTokenId,
      ledger_index: 'validated'
    });
    
    const sellOffers = (sellOffersRequest.result as any).offers || [];
    const buyOffers = (buyOffersRequest.result as any).offers || [];
    
    // Filter offers restricted to broker
    const brokerSellOffers = sellOffers.filter(
      (offer: any) => !offer.destination || offer.destination === BROKER_ADDRESS
    );
    
    const brokerBuyOffers = buyOffers.filter(
      (offer: any) => !offer.destination || offer.destination === BROKER_ADDRESS
    );
    
    return {
      success: true,
      sellOffers: brokerSellOffers,
      buyOffers: brokerBuyOffers
    };
    
  } catch (error) {
    console.error('❌ [BROKER] Get offers failed:', error);
    return {
      success: false,
      sellOffers: [],
      buyOffers: [],
      error: error instanceof Error ? error.message : 'Failed to get offers'
    };
  } finally {
    if (client) {
      await disconnectClient(client);
    }
  }
}

/**
 * Cancel an NFT offer
 */
export async function cancelNFTOffer(
  walletSeed: string,
  offerId: string
): Promise<{
  success: boolean;
  txHash?: string;
  error?: string;
}> {
  let client: xrpl.Client | null = null;
  
  try {
    const wallet = xrpl.Wallet.fromSeed(walletSeed);
    client = await getXrplClient();
    
    const cancelOffer: xrpl.NFTokenCancelOffer = {
      TransactionType: 'NFTokenCancelOffer',
      Account: wallet.address,
      NFTokenOffers: [offerId]
    };
    
    const prepared = await client.autofill(cancelOffer);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);
    
    const meta = result.result.meta as any;
    if (meta?.TransactionResult !== 'tesSUCCESS') {
      throw new Error(`Transaction failed: ${meta?.TransactionResult}`);
    }
    
    return {
      success: true,
      txHash: result.result.hash
    };
    
  } catch (error) {
    console.error('❌ [BROKER] Cancel offer failed:', error);
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