import { pgTable, text, serial, integer, boolean, timestamp, decimal, jsonb, index, varchar, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations, sql } from "drizzle-orm";

/**
 * Inquisition NFT Collections
 * Tracks the 4 main NFT collections for the game
 */
export const inquisitionCollections = pgTable("inquisition_collections", {
  id: serial("id").primaryKey(),
  collection_name: text("collection_name").notNull().unique(),
  issuer_address: text("issuer_address").notNull(),
  taxon: bigint("taxon", { mode: "number" }).notNull(),
  
  // Project linking
  project_id: integer("project_id"), // Links to partner project for master trait card
  
  // Collection metadata
  expected_supply: integer("expected_supply").default(0),
  actual_supply: integer("actual_supply").default(0),
  game_role: text("game_role"), // inquiry, army, bank, merchant, special
  base_power_level: integer("base_power_level").default(100),
  
  // Scanning status
  last_scanned_at: timestamp("last_scanned_at"),
  scan_status: text("scan_status").default("pending"), // pending, scanning, completed, error
  total_mints_tracked: integer("total_mints_tracked").default(0),
  
  // Timestamps
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_inq_collections_issuer_taxon").on(table.issuer_address, table.taxon),
  index("idx_inq_collections_scan_status").on(table.scan_status),
]);

/**
 * Inquisition NFT Audit
 * Stores every minted NFT with full trait data and calculated points
 */
export const inquisitionNftAudit = pgTable("inquisition_nft_audit", {
  id: serial("id").primaryKey(),
  collection_id: integer("collection_id").references(() => inquisitionCollections.id).notNull(),
  
  // NFT identification
  nft_token_id: text("nft_token_id").notNull().unique(),
  sequence_number: integer("sequence_number").notNull(),
  issuer_address: text("issuer_address").notNull(),
  taxon: bigint("taxon", { mode: "number" }).notNull(),
  
  // Current ownership
  current_owner: text("current_owner"),
  owner_updated_at: timestamp("owner_updated_at"),
  
  // Metadata
  name: text("name"),
  description: text("description"),
  image_url: text("image_url"),
  metadata_uri: text("metadata_uri"),
  full_metadata: jsonb("full_metadata").$type<Record<string, any>>().default(sql`'{}'::jsonb`),
  
  // Traits (stored as key-value pairs)
  traits: jsonb("traits").$type<Record<string, any>>().default(sql`'{}'::jsonb`),
  
  // Individual trait rarity scores (each trait type has its own rarity %)
  trait_rarity_scores: jsonb("trait_rarity_scores").$type<Record<string, number>>().default(sql`'{}'::jsonb`),
  
  // Points calculation
  base_points: integer("base_points").default(0),
  trait_points: integer("trait_points").default(0),
  rarity_multiplier: decimal("rarity_multiplier", { precision: 5, scale: 2 }).default("1.00"),
  total_points: integer("total_points").default(0), // base + trait * multiplier
  
  // Power attributes (for gaming)
  power_strength: decimal("power_strength", { precision: 10, scale: 2 }).default("0"),
  power_defense: decimal("power_defense", { precision: 10, scale: 2 }).default("0"),
  power_magic: decimal("power_magic", { precision: 10, scale: 2 }).default("0"),
  power_speed: decimal("power_speed", { precision: 10, scale: 2 }).default("0"),
  
  // Character classification (Inquisition collection only)
  material_type: text("material_type"), // gold, silver, bronze, steel, celestial, etc.
  character_class: text("character_class"), // warrior, priest, wizard, scholar, merchant, etc.
  battle_specialization: text("battle_specialization"), // army, religion, civilization, economic
  
  // Mint tracking
  minted_at: timestamp("minted_at"),
  mint_transaction_hash: text("mint_transaction_hash"),
  mint_ledger_index: integer("mint_ledger_index"),
  
  // Scan tracking
  first_seen_at: timestamp("first_seen_at").defaultNow().notNull(),
  last_updated_at: timestamp("last_updated_at").defaultNow().notNull(),
  scan_source: text("scan_source").default("hourly_scan"), // hourly_scan, manual, initial_load
  
  // Status
  is_active: boolean("is_active").default(true),
  is_burned: boolean("is_burned").default(false),
  burned_at: timestamp("burned_at"),
}, (table) => [
  index("idx_inq_audit_collection").on(table.collection_id),
  index("idx_inq_audit_nft_token").on(table.nft_token_id),
  index("idx_inq_audit_owner").on(table.current_owner),
  index("idx_inq_audit_issuer_taxon").on(table.issuer_address, table.taxon),
  index("idx_inq_audit_points").on(table.total_points),
  index("idx_inq_audit_active").on(table.is_active),
]);

/**
 * Inquisition Scan History
 * Tracks every hourly scan for monitoring and debugging
 */
export const inquisitionScanHistory = pgTable("inquisition_scan_history", {
  id: serial("id").primaryKey(),
  collection_id: integer("collection_id").references(() => inquisitionCollections.id),
  
  // Scan details
  scan_started_at: timestamp("scan_started_at").defaultNow().notNull(),
  scan_completed_at: timestamp("scan_completed_at"),
  scan_status: text("scan_status").default("started"), // started, completed, failed
  
  // Results
  nfts_found: integer("nfts_found").default(0),
  nfts_new: integer("nfts_new").default(0),
  nfts_updated: integer("nfts_updated").default(0),
  nfts_errors: integer("nfts_errors").default(0),
  
  // Error tracking
  error_message: text("error_message"),
  error_details: jsonb("error_details").$type<Record<string, any>>(),
  
  // Performance
  scan_duration_ms: integer("scan_duration_ms"),
  api_calls_made: integer("api_calls_made").default(0),
}, (table) => [
  index("idx_inq_scan_history_collection").on(table.collection_id),
  index("idx_inq_scan_history_started").on(table.scan_started_at),
  index("idx_inq_scan_history_status").on(table.scan_status),
]);

/**
 * Inquisition User NFT Ownership
 * Tracks which NFTs each user owns (works for all users, not just dippydog)
 */
export const inquisitionUserOwnership = pgTable("inquisition_user_ownership", {
  id: serial("id").primaryKey(),
  
  // User identification
  wallet_address: text("wallet_address").notNull(),
  user_handle: text("user_handle"), // Optional, from auth system
  
  // NFT reference
  nft_id: integer("nft_id").references(() => inquisitionNftAudit.id).notNull(),
  nft_token_id: text("nft_token_id").notNull(),
  
  // Ownership tracking
  acquired_at: timestamp("acquired_at").defaultNow().notNull(),
  previous_owner: text("previous_owner"),
  acquisition_type: text("acquisition_type").default("scan"), // scan, transfer, mint
  
  // Status
  is_current_owner: boolean("is_current_owner").default(true),
  lost_ownership_at: timestamp("lost_ownership_at"),
  
  // Timestamps
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_inq_ownership_wallet").on(table.wallet_address),
  index("idx_inq_ownership_nft").on(table.nft_id),
  index("idx_inq_ownership_current").on(table.is_current_owner),
  index("idx_inq_ownership_user_handle").on(table.user_handle),
]);

/**
 * Inquisition Player Profiles
 * Stores player character data with Oracle-generated profile images and crests
 * Includes monthly rate limiting for image regeneration
 */
export const inquisitionPlayerProfiles = pgTable("inquisition_player_profiles", {
  id: serial("id").primaryKey(),
  
  // Player identification
  wallet_address: text("wallet_address").notNull().unique(),
  user_handle: text("user_handle"), // From auth system
  
  // Character information
  character_name: text("character_name").notNull(),
  character_class: text("character_class"), // warrior, mage, rogue, paladin, etc.
  character_bio: text("character_bio"),
  
  // Oracle-generated images
  profile_image_url: text("profile_image_url"), // Character portrait
  crest_image_url: text("crest_image_url"), // Personal emblem/coat of arms
  
  // Rate limiting for image generation (once per month)
  last_profile_generation_at: timestamp("last_profile_generation_at"),
  last_crest_generation_at: timestamp("last_crest_generation_at"),
  total_generations: integer("total_generations").default(0),
  
  // Profile metadata (stores NFT themes, personality traits, etc. for Oracle context)
  profile_metadata: jsonb("profile_metadata").$type<Record<string, any>>().default(sql`'{}'::jsonb`),
  
  // Setup tracking
  is_profile_complete: boolean("is_profile_complete").default(false),
  wizard_completed_at: timestamp("wizard_completed_at"),
  
  // Timestamps
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_inq_player_wallet").on(table.wallet_address),
  index("idx_inq_player_handle").on(table.user_handle),
  index("idx_inq_player_complete").on(table.is_profile_complete),
]);

// Relations
export const inquisitionCollectionsRelations = relations(inquisitionCollections, ({ many }) => ({
  nfts: many(inquisitionNftAudit),
  scans: many(inquisitionScanHistory),
}));

export const inquisitionNftAuditRelations = relations(inquisitionNftAudit, ({ one, many }) => ({
  collection: one(inquisitionCollections, {
    fields: [inquisitionNftAudit.collection_id],
    references: [inquisitionCollections.id],
  }),
  ownerships: many(inquisitionUserOwnership),
}));

export const inquisitionUserOwnershipRelations = relations(inquisitionUserOwnership, ({ one }) => ({
  nft: one(inquisitionNftAudit, {
    fields: [inquisitionUserOwnership.nft_id],
    references: [inquisitionNftAudit.id],
  }),
}));

// Zod schemas for validation
export const insertInquisitionCollectionSchema = createInsertSchema(inquisitionCollections);
export const insertInquisitionNftAuditSchema = createInsertSchema(inquisitionNftAudit);
export const insertInquisitionScanHistorySchema = createInsertSchema(inquisitionScanHistory);
export const insertInquisitionUserOwnershipSchema = createInsertSchema(inquisitionUserOwnership);
export const insertInquisitionPlayerProfileSchema = createInsertSchema(inquisitionPlayerProfiles);

export type InquisitionCollection = typeof inquisitionCollections.$inferSelect;
export type InsertInquisitionCollection = typeof inquisitionCollections.$inferInsert;
export type InquisitionNftAudit = typeof inquisitionNftAudit.$inferSelect;
export type InsertInquisitionNftAudit = typeof inquisitionNftAudit.$inferInsert;
export type InquisitionScanHistory = typeof inquisitionScanHistory.$inferSelect;
export type InsertInquisitionScanHistory = typeof inquisitionScanHistory.$inferInsert;
export type InquisitionUserOwnership = typeof inquisitionUserOwnership.$inferSelect;
export type InsertInquisitionUserOwnership = typeof inquisitionUserOwnership.$inferInsert;
export type InquisitionPlayerProfile = typeof inquisitionPlayerProfiles.$inferSelect;
export type InsertInquisitionPlayerProfile = typeof inquisitionPlayerProfiles.$inferInsert;
