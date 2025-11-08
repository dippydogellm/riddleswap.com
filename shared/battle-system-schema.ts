import { pgTable, text, serial, integer, boolean, timestamp, decimal, jsonb, index, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations, sql } from "drizzle-orm";
import { gamingPlayers, gamingNfts } from "./schema";

// ==========================================
// NFT POWER ATTRIBUTES SYSTEM
// ==========================================

// Individual NFT power contributions (extends gamingNfts)
export const nftPowerAttributes = pgTable("nft_power_attributes", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  nft_id: text("nft_id").notNull().unique().references(() => gamingNfts.id, { onDelete: 'cascade' }),
  collection_id: text("collection_id").notNull(),
  owner_address: text("owner_address").notNull(),
  
  // Power breakdown from NFT traits/metadata
  army_power: decimal("army_power", { precision: 10, scale: 2 }).default("0"),
  religion_power: decimal("religion_power", { precision: 10, scale: 2 }).default("0"),
  civilization_power: decimal("civilization_power", { precision: 10, scale: 2 }).default("0"),
  economic_power: decimal("economic_power", { precision: 10, scale: 2 }).default("0"),
  total_power: decimal("total_power", { precision: 10, scale: 2 }).default("0"),
  
  // Character class auto-detection based on dominant power types
  character_class: text("character_class"), // warrior, priest, knight, merchant, sage, lord, champion
  class_confidence: decimal("class_confidence", { precision: 5, scale: 2 }).default("0"), // 0-100%
  
  // ALL traits and attributes stored for game use
  all_traits: jsonb("all_traits").$type<Record<string, any>>().default(sql`'{}'::jsonb`),
  special_powers: jsonb("special_powers").$type<string[]>().default(sql`'[]'::jsonb`),
  materials_found: jsonb("materials_found").$type<string[]>().default(sql`'[]'::jsonb`),
  rarities_found: jsonb("rarities_found").$type<string[]>().default(sql`'[]'::jsonb`),
  keywords_detected: jsonb("keywords_detected").$type<{
    army: string[];
    religion: string[];
    civilization: string[];
    economic: string[];
  }>().default(sql`'{"army":[],"religion":[],"civilization":[],"economic":[]}'::jsonb`),
  
  // Power calculation metadata
  power_source: text("power_source").default("metadata"), // metadata, traits, manual
  trait_mapping: jsonb("trait_mapping").$type<Record<string, number>>().default({}),
  power_multiplier: decimal("power_multiplier", { precision: 5, scale: 2 }).default("1.00"),
  material_multiplier: decimal("material_multiplier", { precision: 5, scale: 2 }).default("1.00"),
  rarity_multiplier: decimal("rarity_multiplier", { precision: 5, scale: 2 }).default("1.00"),
  
  // Squadron assignment
  assigned_to_squadron: text("assigned_to_squadron"), // References squadrons.id
  squadron_role: text("squadron_role"), // leader, soldier, support
  
  // Battle statistics
  battles_participated: integer("battles_participated").default(0),
  battles_won: integer("battles_won").default(0),
  battles_lost: integer("battles_lost").default(0),
  total_damage_dealt: integer("total_damage_dealt").default(0),
  total_damage_taken: integer("total_damage_taken").default(0),
  
  // Experience and leveling system
  experience_points: integer("experience_points").default(0),
  level: integer("level").default(1),
  experience_to_next_level: integer("experience_to_next_level").default(100),
  total_experience_earned: integer("total_experience_earned").default(0),
  
  // Status
  active_in_battle: boolean("active_in_battle").default(false),
  last_battle_id: text("last_battle_id"),
  
  // Timestamps
  calculated_at: timestamp("calculated_at").defaultNow().notNull(),
  last_updated: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_nft_power_nft").on(table.nft_id),
  index("idx_nft_power_owner").on(table.owner_address),
  index("idx_nft_power_squadron").on(table.assigned_to_squadron),
  index("idx_nft_power_total").on(table.total_power),
  index("idx_nft_power_class").on(table.character_class),
]);

// ==========================================
// SQUADRON MANAGEMENT SYSTEM
// ==========================================

// Squadrons (groups of NFTs organized for battle)
export const squadrons = pgTable("squadrons", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  player_id: text("player_id").notNull().references(() => gamingPlayers.id, { onDelete: 'cascade' }),
  
  // Squadron details
  name: text("name").notNull(),
  description: text("description"),
  squadron_type: text("squadron_type").notNull(), // military, religious, diplomatic, economic
  
  // Power totals
  total_army_power: decimal("total_army_power", { precision: 10, scale: 2 }).default("0"),
  total_religion_power: decimal("total_religion_power", { precision: 10, scale: 2 }).default("0"),
  total_civilization_power: decimal("total_civilization_power", { precision: 10, scale: 2 }).default("0"),
  total_economic_power: decimal("total_economic_power", { precision: 10, scale: 2 }).default("0"),
  total_power: decimal("total_power", { precision: 10, scale: 2 }).default("0"),
  
  // Composition
  nft_count: integer("nft_count").default(0),
  max_nft_capacity: integer("max_nft_capacity").default(10),
  
  // Status
  is_active: boolean("is_active").default(true),
  is_public: boolean("is_public").default(true), // Allow others to join if not full
  in_battle: boolean("in_battle").default(false),
  current_battle_id: text("current_battle_id"),
  
  // Statistics
  battles_won: integer("battles_won").default(0),
  battles_lost: integer("battles_lost").default(0),
  total_xrp_won: decimal("total_xrp_won", { precision: 20, scale: 8 }).default("0"),
  
  // Timestamps
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_squadrons_player").on(table.player_id),
  index("idx_squadrons_type").on(table.squadron_type),
  index("idx_squadrons_active").on(table.is_active),
  index("idx_squadrons_battle").on(table.current_battle_id),
]);

// Squadron NFT assignments
export const squadronNfts = pgTable("squadron_nfts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  squadron_id: text("squadron_id").notNull().references(() => squadrons.id, { onDelete: 'cascade' }),
  nft_id: text("nft_id").notNull().references(() => gamingNfts.id, { onDelete: 'cascade' }),
  
  // Role in squadron
  role: text("role").default("soldier"), // leader, soldier, support, specialist
  position: integer("position").default(0), // Order/position in squadron
  
  // Power contribution
  army_contribution: integer("army_contribution").default(0),
  religion_contribution: integer("religion_contribution").default(0),
  civilization_contribution: integer("civilization_contribution").default(0),
  economic_contribution: integer("economic_contribution").default(0),
  
  // Status
  is_active: boolean("is_active").default(true),
  
  // Timestamps
  assigned_at: timestamp("assigned_at").defaultNow().notNull(),
}, (table) => [
  index("idx_squadron_nfts_squadron").on(table.squadron_id),
  index("idx_squadron_nfts_nft").on(table.nft_id),
  uniqueIndex("idx_squadron_nfts_unique").on(table.squadron_id, table.nft_id),
]);

// ==========================================
// BATTLE PARTNERS / PROJECTS SYSTEM
// ==========================================

// Battle Partners (Projects that can host restricted battles for their NFT holders)
export const battlePartners = pgTable("battle_partners", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  
  // Partner project details
  project_name: text("project_name").notNull(),
  project_description: text("project_description"),
  logo_url: text("logo_url"),
  website_url: text("website_url"),
  discord_url: text("discord_url"),
  twitter_url: text("twitter_url"),
  
  // Collection identification
  collection_id: text("collection_id").notNull().unique(), // Issuer:Taxon format
  issuer_address: text("issuer_address").notNull(),
  taxon: integer("taxon").notNull(),
  
  // Verification status
  is_verified: boolean("is_verified").default(false),
  verified_at: timestamp("verified_at"),
  verified_by: text("verified_by"), // Admin handle who verified
  
  // Battle restrictions
  min_nft_holdings: integer("min_nft_holdings").default(1), // Min NFTs required to participate
  allow_cross_project_battles: boolean("allow_cross_project_battles").default(true),
  
  // Statistics
  total_battles_hosted: integer("total_battles_hosted").default(0),
  total_participants: integer("total_participants").default(0),
  total_prizes_distributed: decimal("total_prizes_distributed", { precision: 20, scale: 8 }).default("0"),
  
  // Status
  is_active: boolean("is_active").default(true),
  
  // Timestamps
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_battle_partners_collection").on(table.collection_id),
  index("idx_battle_partners_verified").on(table.is_verified),
  index("idx_battle_partners_active").on(table.is_active),
]);

// ==========================================
// BATTLE SYSTEM
// ==========================================

// Battles (1v1 and group battles)
export const battles = pgTable("battles", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  
  // Battle details
  battle_type: text("battle_type").notNull(), // 1v1, group, tournament
  combat_type: text("combat_type").notNull(), // military, social, religious
  land_type: text("land_type").default("plains"), // plains, mountains, forest, desert, swamp, coastal, volcanic, tundra
  wager_amount: decimal("wager_amount", { precision: 20, scale: 8 }).default("0"),
  is_friendly: boolean("is_friendly").default(false),
  
  // Partner project restriction (OPTIONAL - null means open to all)
  partner_project_id: text("partner_project_id").references(() => battlePartners.id, { onDelete: 'set null' }),
  restricted_to_collection: text("restricted_to_collection"), // If set, only holders of this collection can join
  min_nfts_from_collection: integer("min_nfts_from_collection").default(1), // Min NFTs from partner collection required
  
  // Battle type specialization (optional restrictions)
  required_specialization: text("required_specialization"), // army, religion, civilization, economic - only NFTs with this specialization get bonus
  time_limit_minutes: integer("time_limit_minutes"), // Optional: Time limit for battle to complete (in minutes)
  
  // Team coordination settings
  response_timeout_minutes: integer("response_timeout_minutes").default(60), // Time for opponent to respond (in minutes)
  
  // Participants (creator is the battle leader)
  creator_player_id: text("creator_player_id").notNull().references(() => gamingPlayers.id, { onDelete: 'cascade' }), // Battle leader
  creator_squadron_id: text("creator_squadron_id").references(() => squadrons.id, { onDelete: 'set null' }),
  creator_wallet_address: text("creator_wallet_address"), // Leader's wallet address for tracking
  
  // Opponent (null until accepted)
  opponent_player_id: text("opponent_player_id").references(() => gamingPlayers.id, { onDelete: 'set null' }),
  opponent_squadron_id: text("opponent_squadron_id").references(() => squadrons.id, { onDelete: 'set null' }),
  
  // AI opponent option
  is_ai_battle: boolean("is_ai_battle").default(false),
  ai_difficulty: text("ai_difficulty"), // easy, medium, hard, expert
  
  // NFT limits per battle type
  max_nfts_limit: integer("max_nfts_limit").default(1000), // Max NFTs allowed: 1vAI (1-1000), 1v1 (10-1000), Mass War (10-1000)
  
  // Alliance battle support (Mass War)
  team_1_alliance_id: text("team_1_alliance_id"),
  team_2_alliance_id: text("team_2_alliance_id"),
  
  // NFT offer entry option
  nft_entry_offer_id: text("nft_entry_offer_id"), // Optional NFT offer ID for entry fee instead of tokens
  nft_entry_price: decimal("nft_entry_price", { precision: 20, scale: 8 }), // Price in XRP/RDL if using NFT entry
  
  // Battle state
  status: text("status").default("open"), // open, in_progress, completed, cancelled
  winner_player_id: text("winner_player_id"),
  winner_squadron_id: text("winner_squadron_id"),
  
  // Results
  creator_power_used: integer("creator_power_used").default(0),
  opponent_power_used: integer("opponent_power_used").default(0),
  winner_prize: decimal("winner_prize", { precision: 20, scale: 8 }).default("0"),
  
  // AI Story & Gameplay
  custom_prompt: text("custom_prompt"), // User's custom scenario prompt for The Oracle
  battle_storyline: text("battle_storyline"), // AI-generated story based on prompt
  battle_map_image_url: text("battle_map_image_url"), // AI-generated battle map visualization URL
  strategic_options: jsonb("strategic_options").$type<Array<{
    option: string;
    risk_level: string; // low, medium, high
    reward_potential: string; // low, medium, high
    description: string;
    ai_analysis: string;
  }>>().default(sql`'[]'::jsonb`),
  
  // Move history
  battle_log: jsonb("battle_log").$type<Array<{
    round: number;
    player_id: string;
    action: string;
    result: string;
    power_change: number;
    timestamp: string;
  }>>().default(sql`'[]'::jsonb`),
  
  // Oracle AI persistent memory (for continuous narration across sessions)
  oracle_assistant_id: text("oracle_assistant_id"), // OpenAI Assistant ID for player
  oracle_thread_id: text("oracle_thread_id"), // OpenAI Thread ID for this battle
  
  // Anti-cheat verification
  creator_hash: text("creator_hash"), // Hash of creator's squadron state
  opponent_hash: text("opponent_hash"), // Hash of opponent's squadron state
  verification_signature: text("verification_signature"),
  
  // Multiplayer fields (2-20 players)
  max_players: integer("max_players").default(2), // 2-20 players
  battle_mode: text("battle_mode").default("1v1"), // 1v1, multiplayer
  response_timeout_seconds: integer("response_timeout_seconds").default(300), // 10s - 30min
  battle_length_minutes: integer("battle_length_minutes").default(30), // 5-120 minutes
  entry_fee: decimal("entry_fee", { precision: 20, scale: 8 }).default("0"),
  entry_currency: text("entry_currency").default("XRP"), // XRP, RDL
  first_place_percent: decimal("first_place_percent", { precision: 5, scale: 2 }).default("70.00"),
  second_place_percent: decimal("second_place_percent", { precision: 5, scale: 2 }).default("20.00"),
  third_place_percent: decimal("third_place_percent", { precision: 5, scale: 2 }).default("10.00"),
  total_prize_pool: decimal("total_prize_pool", { precision: 20, scale: 8 }).default("0"),
  riddle_fee: decimal("riddle_fee", { precision: 20, scale: 8 }).default("0"), // 20% platform fee
  first_place_prize: decimal("first_place_prize", { precision: 20, scale: 8 }).default("0"),
  second_place_prize: decimal("second_place_prize", { precision: 20, scale: 8 }).default("0"),
  third_place_prize: decimal("third_place_prize", { precision: 20, scale: 8 }).default("0"),
  first_place_nft_id: text("first_place_nft_id"),
  second_place_nft_id: text("second_place_nft_id"),
  third_place_nft_id: text("third_place_nft_id"),
  escrow_wallet_address: text("escrow_wallet_address"),
  escrow_transaction_hash: text("escrow_transaction_hash"),
  is_private: boolean("is_private").default(false),
  
  // Timestamps
  created_at: timestamp("created_at").defaultNow().notNull(),
  started_at: timestamp("started_at"),
  completed_at: timestamp("completed_at"),
  expires_at: timestamp("expires_at"), // Auto-cancel if not accepted
}, (table) => [
  index("idx_battles_creator").on(table.creator_player_id),
  index("idx_battles_opponent").on(table.opponent_player_id),
  index("idx_battles_status").on(table.status),
  index("idx_battles_type").on(table.battle_type),
  index("idx_battles_combat").on(table.combat_type),
  index("idx_battles_created").on(table.created_at),
]);

// Battle wagers and escrow tracking
export const battleWagers = pgTable("battle_wagers", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  battle_id: text("battle_id").notNull().references(() => battles.id, { onDelete: 'cascade' }),
  player_id: text("player_id").notNull().references(() => gamingPlayers.id, { onDelete: 'cascade' }),
  
  // Wager details
  amount: decimal("amount", { precision: 20, scale: 8 }).notNull(),
  currency: text("currency").default("RDL").notNull(), // RDL, XRP, etc.
  
  // Escrow status
  status: text("status").default("pending").notNull(), // pending, locked, refunded, paid_out
  
  // Transaction details
  deposit_tx_hash: text("deposit_tx_hash"), // Blockchain transaction hash for deposit
  payout_tx_hash: text("payout_tx_hash"), // Blockchain transaction hash for payout
  
  // Payout info (if winner)
  payout_amount: decimal("payout_amount", { precision: 20, scale: 8 }),
  payout_percentage: decimal("payout_percentage", { precision: 5, scale: 2 }), // For group battles with split payouts
  
  // Timestamps
  deposited_at: timestamp("deposited_at").defaultNow().notNull(),
  locked_at: timestamp("locked_at"), // When battle starts
  paid_out_at: timestamp("paid_out_at"),
  refunded_at: timestamp("refunded_at"),
}, (table) => [
  index("idx_battle_wagers_battle").on(table.battle_id),
  index("idx_battle_wagers_player").on(table.player_id),
  index("idx_battle_wagers_status").on(table.status),
]);

// Battle moves and strategic decisions
export const battleMoves = pgTable("battle_moves", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  battle_id: text("battle_id").notNull().references(() => battles.id, { onDelete: 'cascade' }),
  round_number: integer("round_number").notNull(),
  player_id: text("player_id").notNull().references(() => gamingPlayers.id, { onDelete: 'cascade' }),
  
  // Move details
  move_type: text("move_type").notNull(), // attack, defend, strategic, special
  strategic_choice: text("strategic_choice").notNull(), // The option chosen
  risk_level: text("risk_level").notNull(), // low, medium, high
  
  // Outcome
  success: boolean("success").default(false),
  power_change: integer("power_change").default(0),
  result_description: text("result_description"),
  
  // AI narration
  ai_narration: text("ai_narration"), // OpenAI-generated battle narration
  ai_image_url: text("ai_image_url"), // OpenAI-generated battle image
  
  // Timestamps
  made_at: timestamp("made_at").defaultNow().notNull(),
}, (table) => [
  index("idx_battle_moves_battle").on(table.battle_id),
  index("idx_battle_moves_player").on(table.player_id),
  index("idx_battle_moves_round").on(table.round_number),
]);

// ==========================================
// TOURNAMENT SYSTEM
// ==========================================

// Tournaments (admin-controlled and player-created)
export const tournaments = pgTable("tournaments", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  
  // Tournament details
  name: text("name").notNull(),
  description: text("description"),
  tournament_type: text("tournament_type").notNull(), // weekly_admin, player_created, special_event
  combat_type: text("combat_type").notNull(), // military, social, religious, mixed
  
  // Entry requirements
  entry_fee: decimal("entry_fee", { precision: 20, scale: 8 }).default("0"),
  min_power_required: integer("min_power_required").default(0),
  max_participants: integer("max_participants").default(16),
  
  // Prize pool
  total_prize_pool: decimal("total_prize_pool", { precision: 20, scale: 8 }).default("0"),
  first_place_prize: decimal("first_place_prize", { precision: 20, scale: 8 }).default("0"),
  second_place_prize: decimal("second_place_prize", { precision: 20, scale: 8 }).default("0"),
  third_place_prize: decimal("third_place_prize", { precision: 20, scale: 8 }).default("0"),
  loot_rewards: jsonb("loot_rewards").$type<Array<{
    item: string;
    rarity: string;
    winner_rank: number;
  }>>().default(sql`'[]'::jsonb`),
  
  // Schedule
  registration_opens: timestamp("registration_opens").notNull(),
  registration_closes: timestamp("registration_closes").notNull(),
  starts_at: timestamp("starts_at").notNull(),
  ends_at: timestamp("ends_at"),
  
  // Admin controls
  created_by: text("created_by").notNull(), // admin handle or player handle
  is_admin_tournament: boolean("is_admin_tournament").default(false),
  
  // Status
  status: text("status").default("upcoming"), // upcoming, registration_open, in_progress, completed, cancelled
  current_round: integer("current_round").default(0),
  total_rounds: integer("total_rounds").default(4), // e.g., 16 players = 4 rounds
  
  // Participants
  registered_count: integer("registered_count").default(0),
  
  // Timestamps
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_tournaments_status").on(table.status),
  index("idx_tournaments_type").on(table.tournament_type),
  index("idx_tournaments_combat").on(table.combat_type),
  index("idx_tournaments_created").on(table.created_at),
  index("idx_tournaments_starts").on(table.starts_at),
]);

// Tournament participants
export const tournamentParticipants = pgTable("tournament_participants", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  tournament_id: text("tournament_id").notNull().references(() => tournaments.id, { onDelete: 'cascade' }),
  player_id: text("player_id").notNull().references(() => gamingPlayers.id, { onDelete: 'cascade' }),
  squadron_id: text("squadron_id").notNull().references(() => squadrons.id, { onDelete: 'cascade' }),
  
  // Registration
  registered_at: timestamp("registered_at").defaultNow().notNull(),
  entry_fee_paid: boolean("entry_fee_paid").default(false),
  payment_tx_hash: text("payment_tx_hash"),
  
  // Tournament progress
  current_round: integer("current_round").default(0),
  is_eliminated: boolean("is_eliminated").default(false),
  final_rank: integer("final_rank"),
  
  // Prizes won
  prize_won: decimal("prize_won", { precision: 20, scale: 8 }).default("0"),
  loot_won: jsonb("loot_won").$type<string[]>().default(sql`'[]'::jsonb`),
  
  // Statistics
  battles_won: integer("battles_won").default(0),
  battles_lost: integer("battles_lost").default(0),
  
  // Timestamps
  eliminated_at: timestamp("eliminated_at"),
}, (table) => [
  index("idx_tournament_participants_tournament").on(table.tournament_id),
  index("idx_tournament_participants_player").on(table.player_id),
  uniqueIndex("idx_tournament_participants_unique").on(table.tournament_id, table.player_id),
]);

// ==========================================
// LEADERBOARD TRACKING SYSTEM
// ==========================================

// Player leaderboard history (track rank changes)
export const playerLeaderboardHistory = pgTable("player_leaderboard_history", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  player_handle: text("player_handle").notNull(),
  
  // Rankings
  global_rank: integer("global_rank").notNull(),
  previous_rank: integer("previous_rank"),
  rank_change: integer("rank_change").default(0), // Positive = moved up, negative = moved down
  rank_change_percentage: decimal("rank_change_percentage", { precision: 5, scale: 2 }).default("0"), // % change
  
  // Stats snapshot
  total_power: integer("total_power").default(0),
  total_victories: integer("total_victories").default(0),
  total_defeats: integer("total_defeats").default(0),
  win_rate: decimal("win_rate", { precision: 5, scale: 2 }).default("0"),
  
  // Timestamp
  recorded_at: timestamp("recorded_at").defaultNow().notNull(),
}, (table) => [
  index("idx_player_leaderboard_player").on(table.player_handle),
  index("idx_player_leaderboard_rank").on(table.global_rank),
  index("idx_player_leaderboard_recorded").on(table.recorded_at),
]);

// Alliance leaderboard history (track alliance rank changes)
export const allianceLeaderboardHistory = pgTable("alliance_leaderboard_history", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  alliance_id: text("alliance_id").notNull(),
  alliance_tag: text("alliance_tag").notNull(),
  
  // Rankings
  global_rank: integer("global_rank").notNull(),
  previous_rank: integer("previous_rank"),
  rank_change: integer("rank_change").default(0),
  rank_change_percentage: decimal("rank_change_percentage", { precision: 5, scale: 2 }).default("0"),
  
  // Stats snapshot
  total_power: integer("total_power").default(0),
  total_victories: integer("total_victories").default(0),
  total_defeats: integer("total_defeats").default(0),
  member_count: integer("member_count").default(0),
  
  // Timestamp
  recorded_at: timestamp("recorded_at").defaultNow().notNull(),
}, (table) => [
  index("idx_alliance_leaderboard_alliance").on(table.alliance_id),
  index("idx_alliance_leaderboard_rank").on(table.global_rank),
  index("idx_alliance_leaderboard_recorded").on(table.recorded_at),
]);

// Alliance battle logs (track alliance battle participation and contributions)
export const allianceBattleLogs = pgTable("alliance_battle_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  battle_id: text("battle_id").notNull().references(() => battles.id, { onDelete: 'cascade' }),
  alliance_id: text("alliance_id").notNull(),
  
  // Battle details
  battle_type: text("battle_type").notNull(), // mass_war, tournament
  was_victorious: boolean("was_victorious").default(false),
  
  // Member contributions
  members_participated: integer("members_participated").default(0),
  total_power_contributed: integer("total_power_contributed").default(0),
  total_damage_dealt: integer("total_damage_dealt").default(0),
  total_damage_taken: integer("total_damage_taken").default(0),
  
  // Member details
  participant_handles: jsonb("participant_handles").$type<string[]>().default(sql`'[]'::jsonb`),
  member_contributions: jsonb("member_contributions").$type<Record<string, {
    power: number;
    damage_dealt: number;
    damage_taken: number;
    nfts_used: number;
  }>>().default(sql`'{}'::jsonb`),
  
  // Rewards
  prize_won: decimal("prize_won", { precision: 20, scale: 8 }).default("0"),
  treasury_contribution: decimal("treasury_contribution", { precision: 20, scale: 8 }).default("0"),
  
  // Timestamp
  battle_completed_at: timestamp("battle_completed_at").defaultNow().notNull(),
}, (table) => [
  index("idx_alliance_battle_logs_battle").on(table.battle_id),
  index("idx_alliance_battle_logs_alliance").on(table.alliance_id),
  index("idx_alliance_battle_logs_completed").on(table.battle_completed_at),
]);

// ==========================================
// SCHEMA EXPORTS
// ==========================================

export const insertNftPowerAttributesSchema = (createInsertSchema(nftPowerAttributes) as any).omit({
  id: true,
  calculated_at: true,
  last_updated: true,
});

export const insertSquadronSchema = (createInsertSchema(squadrons) as any).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const insertSquadronNftSchema = (createInsertSchema(squadronNfts) as any).omit({
  id: true,
  assigned_at: true,
});

export const insertBattlePartnerSchema = (createInsertSchema(battlePartners) as any).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const insertBattleSchema = (createInsertSchema(battles) as any).omit({
  id: true,
  created_at: true,
});

export const insertBattleMoveSchema = (createInsertSchema(battleMoves) as any).omit({
  id: true,
  made_at: true,
});

export const insertTournamentSchema = (createInsertSchema(tournaments) as any).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const insertTournamentParticipantSchema = (createInsertSchema(tournamentParticipants) as any).omit({
  id: true,
  registered_at: true,
});

// ==========================================
// TYPE EXPORTS
// ==========================================

export type NftPowerAttributes = typeof nftPowerAttributes.$inferSelect;
export type InsertNftPowerAttributes = z.infer<typeof insertNftPowerAttributesSchema>;

export type Squadron = typeof squadrons.$inferSelect;
export type InsertSquadron = z.infer<typeof insertSquadronSchema>;

export type SquadronNft = typeof squadronNfts.$inferSelect;
export type InsertSquadronNft = z.infer<typeof insertSquadronNftSchema>;

export type BattlePartner = typeof battlePartners.$inferSelect;
export type InsertBattlePartner = z.infer<typeof insertBattlePartnerSchema>;

export type Battle = typeof battles.$inferSelect;
export type InsertBattle = z.infer<typeof insertBattleSchema>;

export type BattleMove = typeof battleMoves.$inferSelect;
export type InsertBattleMove = z.infer<typeof insertBattleMoveSchema>;

export type Tournament = typeof tournaments.$inferSelect;
export type InsertTournament = z.infer<typeof insertTournamentSchema>;

export type TournamentParticipant = typeof tournamentParticipants.$inferSelect;
export type InsertTournamentParticipant = z.infer<typeof insertTournamentParticipantSchema>;

export type PlayerLeaderboardHistory = typeof playerLeaderboardHistory.$inferSelect;
export type AllianceLeaderboardHistory = typeof allianceLeaderboardHistory.$inferSelect;
export type AllianceBattleLog = typeof allianceBattleLogs.$inferSelect;

// ==========================================
// MULTIPLAYER BATTLE TABLES
// ==========================================

// Battle timeline - Complete gameplay logging
export const battleTimeline = pgTable("battle_timeline", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  battle_id: text("battle_id").notNull().references(() => battles.id, { onDelete: 'cascade' }),
  sequence_number: integer("sequence_number").notNull(),
  
  event_type: text("event_type").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  
  actor_player_id: text("actor_player_id"),
  actor_handle: text("actor_handle"),
  target_player_id: text("target_player_id"),
  target_handle: text("target_handle"),
  
  action_type: text("action_type"),
  action_data: jsonb("action_data").$type<Record<string, any>>().default(sql`'{}'::jsonb`),
  
  ai_narrator_text: text("ai_narrator_text"),
  ai_prompt_used: text("ai_prompt_used"),
  ai_response_time_ms: integer("ai_response_time_ms"),
  
  image_url: text("image_url"),
  image_prompt: text("image_prompt"),
  image_generation_time_ms: integer("image_generation_time_ms"),
  
  damage_dealt: decimal("damage_dealt", { precision: 20, scale: 8 }).default("0"),
  health_remaining: decimal("health_remaining", { precision: 20, scale: 8 }).default("0"),
  power_used: decimal("power_used", { precision: 20, scale: 8 }).default("0"),
  
  response_time_seconds: integer("response_time_seconds"),
  timed_out: boolean("timed_out").default(false),
  
  metadata: jsonb("metadata").$type<Record<string, any>>().default(sql`'{}'::jsonb`),
}, (table) => [
  index("idx_battle_timeline_battle").on(table.battle_id),
  index("idx_battle_timeline_sequence").on(table.battle_id, table.sequence_number),
]);

// Battle participants
export const battleParticipants = pgTable("battle_participants", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  battle_id: text("battle_id").notNull().references(() => battles.id, { onDelete: 'cascade' }),
  player_id: text("player_id").notNull(),
  squadron_id: text("squadron_id").notNull(),
  
  entry_fee_paid: decimal("entry_fee_paid", { precision: 20, scale: 8 }).default("0"),
  entry_currency: text("entry_currency").default("XRP"),
  entry_transaction_hash: text("entry_transaction_hash"),
  entry_paid_at: timestamp("entry_paid_at"),
  
  joined_at: timestamp("joined_at").defaultNow().notNull(),
  is_active: boolean("is_active").default(true),
  eliminated_at: timestamp("eliminated_at"),
  final_placement: integer("final_placement"),
  
  total_damage_dealt: decimal("total_damage_dealt", { precision: 20, scale: 8 }).default("0"),
  total_damage_taken: decimal("total_damage_taken", { precision: 20, scale: 8 }).default("0"),
  turns_taken: integer("turns_taken").default(0),
  special_abilities_used: integer("special_abilities_used").default(0),
  timeouts: integer("timeouts").default(0),
  
  prize_amount: decimal("prize_amount", { precision: 20, scale: 8 }).default("0"),
  nft_prize_id: text("nft_prize_id"),
  payout_transaction_hash: text("payout_transaction_hash"),
  payout_completed_at: timestamp("payout_completed_at"),
}, (table) => [
  index("idx_battle_participants_battle").on(table.battle_id),
  index("idx_battle_participants_player").on(table.player_id),
]);

// Battle invitations
export const battleInvitations = pgTable("battle_invitations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  battle_id: text("battle_id").notNull().references(() => battles.id, { onDelete: 'cascade' }),
  inviter_player_id: text("inviter_player_id").notNull(),
  invited_player_id: text("invited_player_id").notNull(),
  invited_handle: text("invited_handle").notNull(),
  
  status: text("status").default("pending"),
  
  invited_at: timestamp("invited_at").defaultNow().notNull(),
  responded_at: timestamp("responded_at"),
}, (table) => [
  index("idx_battle_invitations_battle").on(table.battle_id),
]);

// Battle AI content
export const battleAiContent = pgTable("battle_ai_content", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  battle_id: text("battle_id").notNull().references(() => battles.id, { onDelete: 'cascade' }),
  
  content_type: text("content_type").notNull(),
  
  ai_model: text("ai_model").default("gpt-4o"),
  prompt: text("prompt").notNull(),
  response_text: text("response_text"),
  
  image_url: text("image_url"),
  image_model: text("image_model").default("dall-e-3"),
  
  generation_time_ms: integer("generation_time_ms"),
  tokens_used: integer("tokens_used"),
  cost_usd: decimal("cost_usd", { precision: 10, scale: 6 }),
  
  created_at: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_battle_ai_content_battle").on(table.battle_id),
]);

// Battle audit log
export const battleAuditLog = pgTable("battle_audit_log", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  battle_id: text("battle_id").notNull().references(() => battles.id, { onDelete: 'cascade' }),
  
  action: text("action").notNull(),
  actor_type: text("actor_type").notNull(),
  actor_id: text("actor_id"),
  
  details: jsonb("details").$type<Record<string, any>>().default(sql`'{}'::jsonb`),
  ip_address: text("ip_address"),
  user_agent: text("user_agent"),
  
  created_at: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_battle_audit_battle").on(table.battle_id),
]);

// NFT Scorecards
export const nftScorecards = pgTable("nft_scorecards", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  nft_id: text("nft_id").notNull(),
  owner_player_id: text("owner_player_id").references(() => gamingPlayers.id, { onDelete: 'set null' }),
  collection_id: text("collection_id"),
  total_battles: integer("total_battles").default(0),
  total_kills: integer("total_kills").default(0),
  total_assists: integer("total_assists").default(0),
  total_damage_dealt: decimal("total_damage_dealt", { precision: 20, scale: 8 }).default("0"),
  total_damage_taken: decimal("total_damage_taken", { precision: 20, scale: 8 }).default("0"),
  medals: jsonb("medals").$type<string[]>().default(sql`'[]'::jsonb`),
  last_battle_id: text("last_battle_id"),
  last_updated: timestamp("last_updated").defaultNow().notNull(),
}, (table) => [
  index("idx_nft_scorecards_nft").on(table.nft_id),
  index("idx_nft_scorecards_owner").on(table.owner_player_id),
]);

// NFT Medals
export const nftMedals = pgTable("nft_medals", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  nft_id: text("nft_id").notNull(),
  player_id: text("player_id").references(() => gamingPlayers.id, { onDelete: 'set null' }),
  battle_id: text("battle_id").references(() => battles.id, { onDelete: 'set null' }),
  medal_type: text("medal_type").notNull(),
  reason: text("reason"),
  awarded_at: timestamp("awarded_at").defaultNow().notNull(),
  metadata: jsonb("metadata").$type<Record<string, any>>().default(sql`'{}'::jsonb`),
}, (table) => [
  index("idx_nft_medals_nft").on(table.nft_id),
  index("idx_nft_medals_player").on(table.player_id),
]);

// Civilization Stats
export const civilizationStats = pgTable("civilization_stats", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  civilization_key: text("civilization_key").notNull(),
  total_battles: integer("total_battles").default(0),
  total_kills: integer("total_kills").default(0),
  total_damage_dealt: decimal("total_damage_dealt", { precision: 20, scale: 8 }).default("0"),
  total_damage_taken: decimal("total_damage_taken", { precision: 20, scale: 8 }).default("0"),
  medals: jsonb("medals").$type<string[]>().default(sql`'[]'::jsonb`),
  last_updated: timestamp("last_updated").defaultNow().notNull(),
}, (table) => [
  index("idx_civilization_stats_key").on(table.civilization_key),
]);
