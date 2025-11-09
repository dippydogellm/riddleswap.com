/**
 * Project Scorecard Schema
 * Trait-based rarity scoring and NFT ranking system for projects
 * Updated: 2025-01-09
 */

import { pgTable, text, integer, numeric, timestamp, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Project Trait Scores
 * Stores rarity scores for each trait value in a project/collection
 */
export const projectTraitScores = pgTable("project_trait_scores", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  project_id: integer("project_id"), // References devtools_projects.id
  collection_id: text("collection_id").notNull(), // issuer:taxon format
  collection_name: text("collection_name"),
  trait_type: text("trait_type").notNull(),
  trait_value: text("trait_value").notNull(),
  trait_count: integer("trait_count").default(0).notNull(), // How many NFTs have this trait
  total_nfts: integer("total_nfts").default(0).notNull(), // Total NFTs in collection
  rarity_percentage: numeric("rarity_percentage", { precision: 5, scale: 2 }), // 0.01 to 100.00
  rarity_score: integer("rarity_score").default(0), // 1-100 scale (100 = rarest)
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_trait_scores_project").on(table.project_id),
  index("idx_trait_scores_collection").on(table.collection_id),
  index("idx_trait_scores_trait_type").on(table.trait_type),
  uniqueIndex("idx_trait_scores_unique").on(table.collection_id, table.trait_type, table.trait_value),
]);

/**
 * NFT Rarity Scorecards
 * Individual NFT rarity scores based on trait combinations
 */
export const nftRarityScorecards = pgTable("nft_rarity_scorecards", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  nft_id: text("nft_id").notNull().unique(), // nftokenID
  project_id: integer("project_id"),
  collection_id: text("collection_id").notNull(),
  collection_name: text("collection_name"),
  nft_name: text("nft_name"),
  
  // Trait scores breakdown
  trait_scores: jsonb("trait_scores").$type<Record<string, {
    value: string;
    count: number;
    percentage: number;
    score: number;
  }>>().default(sql`'{}'::jsonb`),
  
  // Overall scores
  total_rarity_score: integer("total_rarity_score").default(0).notNull(), // Sum of all trait scores
  average_rarity_score: numeric("average_rarity_score", { precision: 5, scale: 2 }), // Average trait score
  rarity_tier: text("rarity_tier"), // 'legendary', 'epic', 'rare', 'uncommon', 'common'
  rarity_rank: integer("rarity_rank"), // Position in collection (1 = rarest)
  
  // Metadata
  total_traits: integer("total_traits").default(0),
  calculated_at: timestamp("calculated_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_rarity_scorecards_nft").on(table.nft_id),
  index("idx_rarity_scorecards_project").on(table.project_id),
  index("idx_rarity_scorecards_collection").on(table.collection_id),
  index("idx_rarity_scorecards_score").on(table.collection_id, table.total_rarity_score),
  index("idx_rarity_scorecards_rank").on(table.collection_id, table.rarity_rank),
]);

/**
 * Project Collection Stats
 * Aggregate stats for each project's collection
 */
export const projectCollectionStats = pgTable("project_collection_stats", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  project_id: integer("project_id"),
  collection_id: text("collection_id").notNull().unique(),
  collection_name: text("collection_name"),
  
  // Collection metrics
  total_nfts: integer("total_nfts").default(0),
  total_traits: integer("total_traits").default(0), // Unique trait types
  total_trait_values: integer("total_trait_values").default(0), // All unique trait values
  
  // Trait distribution
  trait_distribution: jsonb("trait_distribution").$type<Record<string, {
    count: number;
    values: Record<string, number>;
  }>>().default(sql`'{}'::jsonb`),
  
  // Rarity distribution
  rarity_distribution: jsonb("rarity_distribution").$type<{
    legendary: number; // Top 1%
    epic: number;      // Top 5%
    rare: number;      // Top 15%
    uncommon: number;  // Top 40%
    common: number;    // Rest
  }>().default(sql`'{"legendary":0,"epic":0,"rare":0,"uncommon":0,"common":0}'::jsonb`),
  
  // Timestamps
  last_scan: timestamp("last_scan"),
  last_rarity_calculation: timestamp("last_rarity_calculation"),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_collection_stats_project").on(table.project_id),
  index("idx_collection_stats_collection").on(table.collection_id),
]);

/**
 * Rarity Calculation History
 * Track when rarity calculations were performed
 */
export const rarityCalculationHistory = pgTable("rarity_calculation_history", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  project_id: integer("project_id"),
  collection_id: text("collection_id").notNull(),
  calculation_type: text("calculation_type").notNull(), // 'full', 'incremental', 'manual'
  nfts_processed: integer("nfts_processed").default(0),
  traits_analyzed: integer("traits_analyzed").default(0),
  duration_ms: integer("duration_ms"),
  status: text("status").notNull(), // 'success', 'failed', 'partial', 'started'
  error_message: text("error_message"),
  started_at: timestamp("started_at").notNull(),
  completed_at: timestamp("completed_at"),
}, (table) => [
  index("idx_calculation_history_project").on(table.project_id),
  index("idx_calculation_history_collection").on(table.collection_id),
  index("idx_calculation_history_status").on(table.status),
]);
