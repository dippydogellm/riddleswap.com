import { pgTable, text, timestamp, varchar, decimal } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// NFT Collections table
export const nftCollections = pgTable('nft_collections', {
  id: varchar('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  issuer: varchar('issuer').notNull(),
  taxon: text('taxon').notNull(),
  image: text('image'),
  floorPrice: decimal('floor_price', { precision: 20, scale: 8 }),
  totalNFTs: text('total_nfts'),
  owners: text('owners'),
  sales24h: text('sales_24h'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Individual NFTs table
export const nfts = pgTable('nfts', {
  id: varchar('id').primaryKey(),
  nftId: varchar('nft_id').notNull().unique(),
  name: text('name'),
  description: text('description'),
  image: text('image'),
  issuer: varchar('issuer').notNull(),
  taxon: text('taxon').notNull(),
  owner: varchar('owner').notNull(),
  metadata: text('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// NFT Offers table
export const nftOffers = pgTable('nft_offers', {
  id: varchar('id').primaryKey(),
  nftId: varchar('nft_id').notNull(),
  nftTokenId: varchar('nft_token_id').notNull(),
  fromWallet: varchar('from_wallet').notNull(),
  toWallet: varchar('to_wallet').notNull(),
  offerAmount: varchar('offer_amount').notNull(),
  currency: varchar('currency').notNull().default('XRP'),
  status: varchar('status').notNull().default('pending'), // pending, accepted, declined, cancelled, expired
  message: text('message'),
  responseMessage: text('response_message'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  respondedAt: timestamp('responded_at'),
});

// Broker Escrow table - tracks funds held by broker for NFT purchases
export const brokerEscrow = pgTable('broker_escrow', {
  id: varchar('id').primaryKey(),
  escrowType: varchar('escrow_type').notNull().default('buy'), // 'buy' (buyer-initiated) or 'sell' (seller-initiated)
  userAddress: varchar('user_address').notNull(), // User who sent escrow payment (buyer)
  userHandle: varchar('user_handle'), // RiddleHandle if available
  nftTokenId: varchar('nft_token_id').notNull(), // NFT being purchased
  nftOwner: varchar('nft_owner').notNull(), // Current NFT owner (seller)
  escrowAmount: varchar('escrow_amount').notNull(), // Amount in drops
  brokerFee: varchar('broker_fee').notNull(), // Broker fee in drops
  royaltyAmount: varchar('royalty_amount'), // Royalty amount if applicable
  sellerAmount: varchar('seller_amount').notNull(), // Amount seller receives
  
  // Payment tracking
  paymentTxHash: varchar('payment_tx_hash'), // User payment to broker
  paymentValidated: timestamp('payment_validated'), // When payment was confirmed
  
  // Buyer's stagnant offer tracking (both flows)
  buyerOfferIndex: varchar('buyer_offer_index'), // Buyer's buy offer created before payment
  
  // Seller's stagnant offer tracking (sell escrow only)
  sellerOfferIndex: varchar('seller_offer_index'), // Seller's sell offer to broker (sell escrow)
  
  // Broker offer tracking (buy escrow only)
  brokerOfferIndex: varchar('broker_offer_index'), // XRPL offer index created by broker (buy escrow)
  brokerOfferTxHash: varchar('broker_offer_tx_hash'), // Broker offer creation tx
  brokerOfferCreated: timestamp('broker_offer_created'),
  
  // Acceptance tracking
  acceptedTxHash: varchar('accepted_tx_hash'), // Owner/Seller acceptance tx
  acceptedAt: timestamp('accepted_at'),
  
  // NFT transfer tracking
  nftTransferTxHash: varchar('nft_transfer_tx_hash'), // Broker→Buyer NFT transfer
  nftTransferredAt: timestamp('nft_transferred_at'),
  
  // Refund tracking
  refundTxHash: varchar('refund_tx_hash'), // Refund to user if cancelled
  refundedAt: timestamp('refunded_at'),
  
  // Status: escrow_received, offer_created, offer_accepted, nft_transferred, completed, cancelled, refunded, expired, failed
  status: varchar('status').notNull().default('pending'),
  
  // Metadata
  message: text('message'), // User message with offer
  cancellationReason: text('cancellation_reason'),
  expiresAt: timestamp('expires_at'), // Escrow expiration
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Broker Minting Escrow table - tracks NFT minting payments and automated minting
export const brokerMintEscrow = pgTable('broker_mint_escrow', {
  id: varchar('id').primaryKey(),
  userHandle: varchar('userHandle'),
  // Buyer info (explicit buyer handle used across routes)
  buyerHandle: varchar('buyerHandle'),
  platformType: varchar('platformType').notNull(),
  issuerAddress: varchar('issuerAddress'),
  issuerPrivateKey: text('issuerPrivateKey'),
  taxon: varchar('taxon'),
  buyerAddress: varchar('buyerAddress').notNull(),
  brokerAddress: varchar('brokerAddress'),
  mintCost: varchar('mintCost').notNull(),
  brokerFee: varchar('brokerFee').notNull(),
  // Optional platform fee for devtools flow
  platformFee: varchar('platformFee'),
  totalAmount: varchar('totalAmount').notNull(),
  nftMetadataUri: text('nftMetadataUri'),
  nftName: text('nftName'),
  nftDescription: text('nftDescription'),
  projectId: varchar('projectId'),
  assetId: varchar('assetId'),
  quantity: varchar('quantity'),
  status: varchar('status').notNull().default('awaiting_payment'),
  paymentTxHash: varchar('paymentTxHash'),
  // Timestamp when payment was validated on-chain
  paymentValidated: timestamp('paymentValidated'),
  mintedNftId: varchar('mintedNftId'),
  // Mint tx tracking
  mintTxHash: varchar('mintTxHash'),
  mintedAt: timestamp('mintedAt'),
  // Offer tracking (some routes use offerIndex; keep both for compatibility)
  offerIndex: varchar('offerIndex'),
  sellOfferIndex: varchar('sellOfferIndex'),
  offerTxHash: varchar('offerTxHash'),
  offerAmount: varchar('offerAmount'),
  offerCreatedAt: timestamp('offerCreatedAt'),
  // Acceptance tracking
  acceptedTxHash: varchar('acceptedTxHash'),
  // Distribution/payment to creator
  creatorPaymentTxHash: varchar('creatorPaymentTxHash'),
  creatorPaymentAmount: varchar('creatorPaymentAmount'),
  creatorPaidAt: timestamp('creatorPaidAt'),
  distributionTxHash: varchar('distributionTxHash'),
  // Expiry
  expiresAt: timestamp('expiresAt'),
  // Metadata / errors
  createdAt: timestamp('createdAt').defaultNow(),
  updatedAt: timestamp('updatedAt').defaultNow(),
  error: text('error'),
  failureReason: text('failureReason'),
});

// Schema exports
export const insertNftCollectionSchema = createInsertSchema(nftCollections);
export const insertNftSchema = createInsertSchema(nfts);
export const insertNftOfferSchema = createInsertSchema(nftOffers);
export const insertBrokerEscrowSchema = createInsertSchema(brokerEscrow);
export const insertBrokerMintEscrowSchema = createInsertSchema(brokerMintEscrow);

export type NftCollection = typeof nftCollections.$inferSelect;
export type InsertNftCollection = z.infer<typeof insertNftCollectionSchema>;
export type Nft = typeof nfts.$inferSelect;
export type InsertNft = z.infer<typeof insertNftSchema>;
export type NftOffer = typeof nftOffers.$inferSelect;
export type InsertNftOffer = z.infer<typeof insertNftOfferSchema>;
export type BrokerEscrow = typeof brokerEscrow.$inferSelect;
export type InsertBrokerEscrow = z.infer<typeof insertBrokerEscrowSchema>;
export type BrokerMintEscrow = typeof brokerMintEscrow.$inferSelect;
export type InsertBrokerMintEscrow = z.infer<typeof insertBrokerMintEscrowSchema>;