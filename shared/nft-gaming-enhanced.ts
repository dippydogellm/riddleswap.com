// @ts-nocheck
import { pgTable, text, serial, integer, boolean, timestamp, decimal, jsonb, index, uniqueIndex, varchar, bigint, date, check, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations, sql } from "drizzle-orm";

// Enhanced NFT Ownership History - tracks all ownership changes over time
export const nftOwnershipHistory = pgTable("nft_ownership_history", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  nft_id: text("nft_id").notNull(), // References gaming_nfts.id or nfts.nftId
  collection_issuer: text("collection_issuer").notNull(), // XRPL issuer address
  nft_token_id: text("nft_token_id").notNull(), // XRPL NFTokenID
  
  // Ownership tracking
  previous_owner: text("previous_owner"), // Previous wallet address (null for initial mint)
  new_owner: text("new_owner").notNull(), // Current wallet address
  change_reason: text("change_reason").notNull(), // 'scan', 'transfer', 'burn', 'initial'
  
  // Metadata at time of change
  power_level: integer("power_level").default(100),
  status: text("status").default("active"), // active, mercenary, burned
  
  // Timestamps
  changed_at: timestamp("changed_at").defaultNow().notNull(),
  scan_source: text("scan_source"), // 'bithomp', 'manual', 'webhook'
  transaction_hash: text("transaction_hash"), // XRPL transaction hash if applicable
}, (table) => [
  index("idx_nft_ownership_history_nft").on(table.nft_id),
  index("idx_nft_ownership_history_owner").on(table.new_owner),
  index("idx_nft_ownership_history_issuer").on(table.collection_issuer),
  index("idx_nft_ownership_history_changed").on(table.changed_at),
]);

// NFT Training Sessions - track training activities for power growth
export const nftTrainingSessions = pgTable("nft_training_sessions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  nft_id: text("nft_id").notNull(),
  owner_address: text("owner_address").notNull(),
  
  // Training details
  training_type: text("training_type").notNull(), // 'drill', 'campaign', 'meditation', 'combat'
  duration_minutes: integer("duration_minutes").default(60),
  xp_gained: integer("xp_gained").default(0),
  power_delta: integer("power_delta").default(0), // Power increase from this session
  
  // Cost and rewards
  cost_xrp: decimal("cost_xrp", { precision: 20, scale: 8 }).default("0"),
  reward_items: jsonb("reward_items").$type<string[]>().default(sql`'[]'::jsonb`),
  
  // Session tracking
  started_at: timestamp("started_at").defaultNow().notNull(),
  completed_at: timestamp("completed_at"),
  status: text("status").default("active"), // active, completed, cancelled
  result: text("result"), // success, failure, critical_success
  
  // Metadata
  training_notes: text("training_notes"),
  instructor: text("instructor"), // NPC or player instructor
}, (table) => [
  index("idx_nft_training_nft").on(table.nft_id),
  index("idx_nft_training_owner").on(table.owner_address),
  index("idx_nft_training_started").on(table.started_at),
  index("idx_nft_training_status").on(table.status),
]);

// AI Image Generation Requests - track custom army-colored NFT images
export const nftAiImageRequests = pgTable("nft_ai_image_requests", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  nft_id: text("nft_id").notNull(),
  requested_by: text("requested_by").notNull(), // User handle
  owner_address: text("owner_address").notNull(),
  
  // Request details
  month_key: text("month_key").notNull(), // YYYY-MM for quota tracking
  prompt_variant: text("prompt_variant").default("army_colors"), // army_colors, battle_ready, ceremonial
  custom_prompt: text("custom_prompt"),
  
  // Payment and quota
  is_free_monthly: boolean("is_free_monthly").default(false),
  payment_required: boolean("payment_required").default(false),
  cost_xrp: decimal("cost_xrp", { precision: 20, scale: 8 }).default("1.0"),
  payment_tx_hash: text("payment_tx_hash"),
  payment_confirmed: boolean("payment_confirmed").default(false),
  
  // Generation status
  status: text("status").default("pending"), // pending, generating, completed, failed, payment_pending
  openai_request_id: text("openai_request_id"),
  generated_image_url: text("generated_image_url"),
  error_message: text("error_message"),
  
  // Timestamps
  requested_at: timestamp("requested_at").defaultNow().notNull(),
  payment_due_at: timestamp("payment_due_at"),
  generated_at: timestamp("generated_at"),
  expires_at: timestamp("expires_at"), // Generated images expire after 6 months
}, (table) => [
  index("idx_nft_ai_requests_nft").on(table.nft_id),
  index("idx_nft_ai_requests_user").on(table.requested_by),
  index("idx_nft_ai_requests_month").on(table.month_key),
  index("idx_nft_ai_requests_status").on(table.status),
  index("idx_nft_ai_requests_payment").on(table.payment_tx_hash),
]);

// NFT Image Generation History - track all generated images with full metadata
export const nftImageGenerationHistory = pgTable("nft_image_generation_history", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  nft_id: text("nft_id").notNull(),
  nft_token_id: text("nft_token_id").notNull(),
  collection_id: text("collection_id"),
  
  // Generation details
  generation_request_id: text("generation_request_id"), // References nft_ai_image_requests.id
  prompt_used: text("prompt_used").notNull(),
  prompt_variant: text("prompt_variant"),
  model_used: text("model_used").default("dall-e-3"),
  quality: text("quality").default("standard"), // standard, hd
  
  // Image data
  openai_image_url: text("openai_image_url").notNull(),
  stored_image_url: text("stored_image_url"), // GCS/permanent storage URL
  storage_path: text("storage_path"),
  storage_backend: text("storage_backend").default("gcs"), // gcs, replit, s3
  file_size_bytes: integer("file_size_bytes"),
  image_hash: text("image_hash"), // SHA256 for deduplication
  
  // Metadata snapshot at generation time (for historical reference)
  nft_metadata_snapshot: jsonb("nft_metadata_snapshot").$type<Record<string, any>>().default({}),
  nft_traits_snapshot: jsonb("nft_traits_snapshot").$type<Record<string, any>>().default({}),
  power_levels_snapshot: jsonb("power_levels_snapshot").$type<Record<string, any>>().default({}),
  player_info_snapshot: jsonb("player_info_snapshot").$type<Record<string, any>>().default({}),
  rarity_score_snapshot: decimal("rarity_score_snapshot", { precision: 10, scale: 4 }),
  
  // Status
  is_current_image: boolean("is_current_image").default(true),
  storage_status: text("storage_status").default("stored"), // stored, pending, expired, failed, deleted
  download_status: text("download_status").default("pending"), // pending, downloaded, failed
  
  // Timestamps
  generated_at: timestamp("generated_at").defaultNow().notNull(),
  downloaded_at: timestamp("downloaded_at"),
  stored_at: timestamp("stored_at"),
  openai_url_expires_at: timestamp("openai_url_expires_at"), // OpenAI URLs expire after 60 days
  marked_current_at: timestamp("marked_current_at"),
  
  // Analytics
  generation_duration_ms: integer("generation_duration_ms"),
  download_duration_ms: integer("download_duration_ms"),
  storage_duration_ms: integer("storage_duration_ms"),
  
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_nft_image_history_nft_id").on(table.nft_id),
  index("idx_nft_image_history_token").on(table.nft_token_id),
  index("idx_nft_image_history_current").on(table.is_current_image),
  index("idx_nft_image_history_generated").on(table.generated_at),
  index("idx_nft_image_history_collection").on(table.collection_id),
  index("idx_nft_image_history_storage_status").on(table.storage_status),
  index("idx_nft_image_history_hash").on(table.image_hash),
]);

// NFT Ownership Notifications - notify users of NFT changes
export const nftOwnershipNotifications = pgTable("nft_ownership_notifications", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  user_handle: text("user_handle").notNull(),
  wallet_address: text("wallet_address").notNull(),
  
  // Notification details
  notification_type: text("notification_type").notNull(), // 'nft_added', 'nft_removed', 'training_complete', 'image_ready'
  title: text("title").notNull(),
  message: text("message").notNull(),
  
  // Related data
  nft_id: text("nft_id"),
  collection_name: text("collection_name"),
  nft_name: text("nft_name"),
  payload: jsonb("payload").$type<Record<string, any>>().default(sql`'{}'::jsonb`),
  
  // Status
  read_at: timestamp("read_at"),
  dismissed_at: timestamp("dismissed_at"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  
  // Priority and category
  priority: text("priority").default("normal"), // low, normal, high, urgent
  category: text("category").default("ownership"), // ownership, training, image, system
}, (table) => [
  index("idx_nft_notifications_user").on(table.user_handle),
  index("idx_nft_notifications_wallet").on(table.wallet_address),
  index("idx_nft_notifications_type").on(table.notification_type),
  index("idx_nft_notifications_created").on(table.created_at),
  index("idx_nft_notifications_read").on(table.read_at),
]);

// NFT Wallet Scans - track scanning operations and their results
export const nftWalletScans = pgTable("nft_wallet_scans", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  wallet_address: text("wallet_address").notNull(),
  chain: text("chain").notNull(), // xrp, eth, sol
  user_handle: text("user_handle"),
  
  // Scan details
  scan_type: text("scan_type").notNull(), // 'login', 'manual', 'scheduled', 'ownership_verification'
  scan_source: text("scan_source").default("bithomp"), // bithomp, direct_xrpl, manual
  
  // Results
  nfts_found: integer("nfts_found").default(0),
  collections_found: integer("collections_found").default(0),
  new_nfts: integer("new_nfts").default(0),
  removed_nfts: integer("removed_nfts").default(0),
  
  // Metadata
  scan_stats: jsonb("scan_stats").$type<{
    collections: Record<string, { count: number; power: number }>;
    total_power: number;
    new_collections?: string[];
    removed_collections?: string[];
  }>().default(sql`'{}'::jsonb`),
  
  // Status and timing
  status: text("status").default("pending"), // pending, in_progress, completed, failed
  started_at: timestamp("started_at").defaultNow().notNull(),
  completed_at: timestamp("completed_at"),
  duration_ms: integer("duration_ms"),
  
  // Error handling
  error_message: text("error_message"),
  retry_count: integer("retry_count").default(0),
  
  // API usage tracking
  api_calls_made: integer("api_calls_made").default(0),
  api_rate_limited: boolean("api_rate_limited").default(false),
}, (table) => [
  index("idx_nft_wallet_scans_wallet").on(table.wallet_address),
  index("idx_nft_wallet_scans_user").on(table.user_handle),
  index("idx_nft_wallet_scans_started").on(table.started_at),
  index("idx_nft_wallet_scans_type").on(table.scan_type),
  index("idx_nft_wallet_scans_status").on(table.status),
]);

// Enhanced weapon definitions building on existing nftAddons
export const weaponDefinitions = pgTable("weapon_definitions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  weapon_key: text("weapon_key").notNull().unique(), // 'steel_sword', 'fire_staff', etc.
  name: text("name").notNull(),
  description: text("description"),
  
  // Weapon properties
  weapon_type: text("weapon_type").notNull(), // 'melee', 'ranged', 'magical', 'defensive'
  slot_type: text("slot_type").notNull(), // 'main_hand', 'off_hand', 'two_handed', 'armor', 'accessory'
  rarity: text("rarity").default("common"), // common, uncommon, rare, epic, legendary
  
  // Power modifications
  attack_bonus: integer("attack_bonus").default(0),
  defense_bonus: integer("defense_bonus").default(0),
  power_multiplier: decimal("power_multiplier", { precision: 5, scale: 2 }).default("1.0"),
  
  // Requirements and restrictions
  min_power_level: integer("min_power_level").default(0),
  required_class: jsonb("required_class").$type<string[]>().default(sql`'[]'::jsonb`), // ['warrior', 'paladin']
  required_collections: jsonb("required_collections").$type<string[]>().default(sql`'[]'::jsonb`), // Collection restrictions
  
  // Acquisition
  cost_xrp: decimal("cost_xrp", { precision: 20, scale: 8 }),
  craftable: boolean("craftable").default(false),
  tradeable: boolean("tradeable").default(true),
  
  // Metadata
  image_url: text("image_url"),
  lore_text: text("lore_text"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
  active: boolean("active").default(true),
}, (table) => [
  index("idx_weapon_definitions_key").on(table.weapon_key),
  index("idx_weapon_definitions_type").on(table.weapon_type),
  index("idx_weapon_definitions_slot").on(table.slot_type),
  index("idx_weapon_definitions_rarity").on(table.rarity),
]);

// Generated Inquisition Members - AI-generated characters for the gaming system
export const gamingInquisitionMembers = pgTable("gaming_inquisition_members", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  user_id: text("user_id").notNull(), // User who generated this member
  chain: text("chain").notNull().default("xrp"), // Always XRPL for now
  
  // Generation status
  status: text("status").notNull().default("generated"), // generated, minted, failed
  
  // Character details
  name: text("name").notNull(),
  material: text("material").notNull(), // steel, iron, gold, etc.
  player_type: text("player_type").notNull(), // priest, knight, warrior, etc.
  role: text("role").notNull(), // Combined: "Steel Knight"
  rarity: text("rarity").notNull().default("common"), // common, rare, epic, legendary
  
  // Game mechanics
  traits: jsonb("traits").$type<Record<string, any>>().default(sql`'{}'::jsonb`),
  abilities: jsonb("abilities").$type<Record<string, any>>().default(sql`'{}'::jsonb`),
  stats: jsonb("stats").$type<{
    base_power: number;
    combat_effectiveness: number;
    leadership_value: number;
    magical_power: number;
    division_boost: number;
    religion_control: number;
  }>().notNull(),
  
  // AI-generated content
  image_url: text("image_url"),
  popup_story: text("popup_story"), // ChatGPT-generated character story
  oracle_job_id: text("oracle_job_id"), // AI Oracle generation job ID
  
  // On-chain data (when minted)
  token_id: text("token_id"), // XRPL NFTokenID when minted
  
  // Timestamps
  created_at: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_inquisition_members_user").on(table.user_id),
  index("idx_inquisition_members_status").on(table.status),
  index("idx_inquisition_members_role").on(table.role),
  index("idx_inquisition_members_rarity").on(table.rarity),
  index("idx_inquisition_members_created").on(table.created_at),
]);

// Schema exports for enhanced NFT gaming
export const insertNftOwnershipHistorySchema = createInsertSchema(nftOwnershipHistory).omit({
  id: true,
  changed_at: true,
});

export const insertNftTrainingSessionSchema = createInsertSchema(nftTrainingSessions).omit({
  id: true,
  started_at: true,
});

export const insertNftAiImageRequestSchema = createInsertSchema(nftAiImageRequests).omit({
  id: true,
  requested_at: true,
});

export const insertNftOwnershipNotificationSchema = createInsertSchema(nftOwnershipNotifications).omit({
  id: true,
  created_at: true,
});

export const insertNftWalletScanSchema = createInsertSchema(nftWalletScans).omit({
  id: true,
  started_at: true,
});

export const insertWeaponDefinitionSchema = createInsertSchema(weaponDefinitions).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const insertGamingInquisitionMemberSchema = createInsertSchema(gamingInquisitionMembers).omit({
  id: true,
  created_at: true,
});

export const insertNftImageGenerationHistorySchema = createInsertSchema(nftImageGenerationHistory).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

// Ranking History Table - Track all ranking changes
export const rankingHistory = pgTable("ranking_history", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  entity_type: text("entity_type").notNull(), // 'nft', 'collection', 'civilization'
  entity_id: text("entity_id").notNull(),
  entity_name: text("entity_name"),
  
  // Ranking data
  rank_type: text("rank_type").notNull(), // 'overall', 'collection', 'global', 'regional'
  current_rank: integer("current_rank").notNull(),
  previous_rank: integer("previous_rank"),
  rank_change: integer("rank_change").default(0),
  
  // Score data
  current_score: decimal("current_score", { precision: 20, scale: 4 }),
  previous_score: decimal("previous_score", { precision: 20, scale: 4 }),
  score_change: decimal("score_change", { precision: 20, scale: 4 }),
  
  // Percentile
  percentile: decimal("percentile", { precision: 5, scale: 2 }),
  tier: text("tier"),
  
  // Metadata
  scan_timestamp: timestamp("scan_timestamp").defaultNow(),
  scan_type: text("scan_type"), // 'rarity_scan', 'civilization_scan', 'daily_update'
  
  created_at: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_ranking_history_entity").on(table.entity_type, table.entity_id),
  index("idx_ranking_history_timestamp").on(table.scan_timestamp),
  index("idx_ranking_history_type").on(table.rank_type),
]);

// Scanner Logs Table - Track all scanner executions
export const scannerLogs = pgTable("scanner_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  scanner_name: text("scanner_name").notNull(),
  scanner_type: text("scanner_type").notNull(),
  
  // Execution data
  status: text("status").notNull(), // 'running', 'completed', 'failed', 'partial'
  started_at: timestamp("started_at").notNull(),
  completed_at: timestamp("completed_at"),
  duration_ms: integer("duration_ms"),
  
  // Results
  entities_scanned: integer("entities_scanned").default(0),
  entities_processed: integer("entities_processed").default(0),
  entities_failed: integer("entities_failed").default(0),
  
  // Details
  target_id: text("target_id"),
  target_name: text("target_name"),
  error_message: text("error_message"),
  error_details: jsonb("error_details").$type<Record<string, any>>(),
  warnings: jsonb("warnings").$type<string[]>().default(sql`'[]'::jsonb`),
  
  // Statistics
  statistics: jsonb("statistics").$type<Record<string, any>>().default(sql`'{}'::jsonb`),
  
  created_at: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_scanner_logs_scanner").on(table.scanner_name),
  index("idx_scanner_logs_status").on(table.status),
  index("idx_scanner_logs_started").on(table.started_at),
  index("idx_scanner_logs_target").on(table.target_id),
]);

// Game Leaderboards Table - Pre-calculated leaderboards
export const gameLeaderboards = pgTable("game_leaderboards", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  leaderboard_type: text("leaderboard_type").notNull(),
  category: text("category"),
  
  // Ranking data (JSONB array for fast access)
  rankings: jsonb("rankings").$type<Array<any>>().default(sql`'[]'::jsonb`),
  
  // Metadata
  total_entries: integer("total_entries").default(0),
  last_updated: timestamp("last_updated").defaultNow(),
  next_update: timestamp("next_update"),
  
  created_at: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_game_leaderboards_type").on(table.leaderboard_type, table.category),
  index("idx_game_leaderboards_updated").on(table.last_updated),
]);

// Insert schemas - make all fields optional except required ones
export const insertRankingHistorySchema = createInsertSchema(rankingHistory).extend({
  id: z.string().optional(),
  created_at: z.date().optional(),
  scan_timestamp: z.date().optional(),
  previous_rank: z.number().optional(),
  rank_change: z.number().optional(),
  current_score: z.any().optional(),
  previous_score: z.any().optional(),
  score_change: z.any().optional(),
  percentile: z.any().optional(),
  tier: z.string().optional(),
  scan_type: z.string().optional(),
  entity_name: z.string().optional(),
});

export const insertScannerLogSchema = createInsertSchema(scannerLogs).extend({
  id: z.string().optional(),
  created_at: z.date().optional(),
  completed_at: z.date().optional(),
  duration_ms: z.number().optional(),
  entities_scanned: z.number().optional(),
  entities_processed: z.number().optional(),
  entities_failed: z.number().optional(),
  target_id: z.string().optional(),
  target_name: z.string().optional(),
  error_message: z.string().optional(),
  error_details: z.any().optional(),
  warnings: z.any().optional(),
  statistics: z.any().optional(),
});

export const insertGameLeaderboardSchema = createInsertSchema(gameLeaderboards).extend({
  id: z.string().optional(),
  created_at: z.date().optional(),
  category: z.string().optional(),
  rankings: z.any().optional(),
  total_entries: z.number().optional(),
  last_updated: z.date().optional(),
  next_update: z.date().optional(),
});

// Type exports
export type NftOwnershipHistory = typeof nftOwnershipHistory.$inferSelect;
export type InsertNftOwnershipHistory = z.infer<typeof insertNftOwnershipHistorySchema>;

export type NftTrainingSession = typeof nftTrainingSessions.$inferSelect;
export type InsertNftTrainingSession = z.infer<typeof insertNftTrainingSessionSchema>;

export type NftAiImageRequest = typeof nftAiImageRequests.$inferSelect;
export type InsertNftAiImageRequest = z.infer<typeof insertNftAiImageRequestSchema>;

export type NftOwnershipNotification = typeof nftOwnershipNotifications.$inferSelect;
export type InsertNftOwnershipNotification = z.infer<typeof insertNftOwnershipNotificationSchema>;

export type NftWalletScan = typeof nftWalletScans.$inferSelect;
export type InsertNftWalletScan = z.infer<typeof insertNftWalletScanSchema>;

export type WeaponDefinition = typeof weaponDefinitions.$inferSelect;
export type InsertWeaponDefinition = z.infer<typeof insertWeaponDefinitionSchema>;

export type GamingInquisitionMember = typeof gamingInquisitionMembers.$inferSelect;
export type InsertGamingInquisitionMember = z.infer<typeof insertGamingInquisitionMemberSchema>;

export type NftImageGenerationHistory = typeof nftImageGenerationHistory.$inferSelect;
export type InsertNftImageGenerationHistory = z.infer<typeof insertNftImageGenerationHistorySchema>;

export type RankingHistory = typeof rankingHistory.$inferSelect;
export type InsertRankingHistory = z.infer<typeof insertRankingHistorySchema>;

export type ScannerLog = typeof scannerLogs.$inferSelect;
export type InsertScannerLog = z.infer<typeof insertScannerLogSchema>;

export type GameLeaderboard = typeof gameLeaderboards.$inferSelect;
export type InsertGameLeaderboard = z.infer<typeof insertGameLeaderboardSchema>;