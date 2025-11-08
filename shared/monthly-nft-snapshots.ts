/**
 * MONTHLY NFT SNAPSHOTS SCHEMA
 * Complete monthly tracking system for NFT ownership and listing status
 * - Every month on snapshot day: download all NFTs
 * - Track wallet ownership for each NFT
 * - Check if NFTs are listed for sale
 * - Store issuer information for each NFT
 */

import { pgTable, varchar, integer, decimal, timestamp, boolean, text, index } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Monthly NFT snapshot master table
export const monthlyNftSnapshots = pgTable('monthly_nft_snapshots', {
  id: varchar('id').primaryKey(),
  snapshot_date: varchar('snapshot_date').notNull(), // YYYY-MM format
  snapshot_day: timestamp('snapshot_day').notNull(), // Exact timestamp of snapshot
  total_nfts_tracked: integer('total_nfts_tracked').default(0),
  total_collections: integer('total_collections').default(0),
  total_owners: integer('total_owners').default(0),
  total_listed: integer('total_listed').default(0),
  processing_status: varchar('processing_status').default('pending'), // pending, processing, completed, failed
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  snapshotDateIdx: index('monthly_snapshots_date_idx').on(table.snapshot_date),
  statusIdx: index('monthly_snapshots_status_idx').on(table.processing_status),
}));

// Individual NFT records per month
export const monthlyNftOwnership = pgTable('monthly_nft_ownership', {
  id: varchar('id').primaryKey(),
  snapshot_month: varchar('snapshot_month').notNull(), // YYYY-MM format
  nft_token_id: varchar('nft_token_id').notNull(), // NFT unique identifier
  nft_issuer: varchar('nft_issuer').notNull(), // NFT issuer address
  collection_name: varchar('collection_name').notNull(),
  owner_wallet: varchar('owner_wallet').notNull(), // Current owner
  is_listed: boolean('is_listed').default(false), // Listed for sale
  listing_price_xrp: decimal('listing_price_xrp', { precision: 20, scale: 6 }),
  listing_price_usd: decimal('listing_price_usd', { precision: 20, scale: 2 }),
  market_value_xrp: decimal('market_value_xrp', { precision: 20, scale: 6 }),
  market_value_usd: decimal('market_value_usd', { precision: 20, scale: 2 }),
  rarity_rank: integer('rarity_rank'),
  metadata_uri: text('metadata_uri'),
  image_url: text('image_url'),
  attributes: text('attributes'), // JSON string of NFT attributes
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  monthIdx: index('monthly_ownership_month_idx').on(table.snapshot_month),
  ownerIdx: index('monthly_ownership_owner_idx').on(table.owner_wallet),
  collectionIdx: index('monthly_ownership_collection_idx').on(table.collection_name),
  issuerIdx: index('monthly_ownership_issuer_idx').on(table.nft_issuer),
  listedIdx: index('monthly_ownership_listed_idx').on(table.is_listed),
  tokenIdx: index('monthly_ownership_token_idx').on(table.nft_token_id),
}));

// Collection-level monthly statistics 
export const monthlyCollectionStats = pgTable('monthly_collection_stats', {
  id: varchar('id').primaryKey(),
  snapshot_month: varchar('snapshot_month').notNull(), // YYYY-MM format
  collection_name: varchar('collection_name').notNull(),
  issuer_address: varchar('issuer_address').notNull(),
  total_supply: integer('total_supply').default(0),
  total_owners: integer('total_owners').default(0),
  total_listed: integer('total_listed').default(0),
  floor_price_xrp: decimal('floor_price_xrp', { precision: 20, scale: 6 }),
  floor_price_usd: decimal('floor_price_usd', { precision: 20, scale: 2 }),
  volume_month_xrp: decimal('volume_month_xrp', { precision: 20, scale: 6 }).default('0'),
  volume_month_usd: decimal('volume_month_usd', { precision: 20, scale: 2 }).default('0'),
  royalties_collected_xrp: decimal('royalties_collected_xrp', { precision: 20, scale: 6 }).default('0'),
  royalties_collected_usd: decimal('royalties_collected_usd', { precision: 20, scale: 2 }).default('0'),
  rewards_distributed_usd: decimal('rewards_distributed_usd', { precision: 20, scale: 2 }).default('0'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  monthIdx: index('monthly_collection_stats_month_idx').on(table.snapshot_month),
  collectionIdx: index('monthly_collection_stats_collection_idx').on(table.collection_name),
  issuerIdx: index('monthly_collection_stats_issuer_idx').on(table.issuer_address),
}));

// User rewards eligibility per month (based on NFT holdings)
export const monthlyRewardEligibility = pgTable('monthly_reward_eligibility', {
  id: varchar('id').primaryKey(),
  snapshot_month: varchar('snapshot_month').notNull(), // YYYY-MM format
  wallet_address: varchar('wallet_address').notNull(),
  collection_name: varchar('collection_name').notNull(),
  nfts_held: integer('nfts_held').default(0),
  nfts_listed: integer('nfts_listed').default(0),
  penalty_applied: boolean('penalty_applied').default(false), // True if any NFTs listed during month
  reward_percentage: decimal('reward_percentage', { precision: 5, scale: 4 }).default('0.5'), // 50% of royalties
  estimated_reward_usd: decimal('estimated_reward_usd', { precision: 20, scale: 2 }).default('0'),
  reward_status: varchar('reward_status').default('pending'), // pending, calculated, distributed, forfeited
  penalty_reason: text('penalty_reason'), // Reason for penalty if applied
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  monthIdx: index('monthly_eligibility_month_idx').on(table.snapshot_month),
  walletIdx: index('monthly_eligibility_wallet_idx').on(table.wallet_address),
  collectionIdx: index('monthly_eligibility_collection_idx').on(table.collection_name),
  statusIdx: index('monthly_eligibility_status_idx').on(table.reward_status),
  penaltyIdx: index('monthly_eligibility_penalty_idx').on(table.penalty_applied),
}));

// Zod schemas for validation
export const insertMonthlyNftSnapshotSchema = createInsertSchema(monthlyNftSnapshots);
export const insertMonthlyNftOwnershipSchema = createInsertSchema(monthlyNftOwnership);
export const insertMonthlyCollectionStatsSchema = createInsertSchema(monthlyCollectionStats);
export const insertMonthlyRewardEligibilitySchema = createInsertSchema(monthlyRewardEligibility);

// TypeScript types
export type MonthlyNftSnapshot = typeof monthlyNftSnapshots.$inferSelect;
export type InsertMonthlyNftSnapshot = z.infer<typeof insertMonthlyNftSnapshotSchema>;

export type MonthlyNftOwnership = typeof monthlyNftOwnership.$inferSelect;
export type InsertMonthlyNftOwnership = z.infer<typeof insertMonthlyNftOwnershipSchema>;

export type MonthlyCollectionStats = typeof monthlyCollectionStats.$inferSelect;
export type InsertMonthlyCollectionStats = z.infer<typeof insertMonthlyCollectionStatsSchema>;

export type MonthlyRewardEligibility = typeof monthlyRewardEligibility.$inferSelect;
export type InsertMonthlyRewardEligibility = z.infer<typeof insertMonthlyRewardEligibilitySchema>;