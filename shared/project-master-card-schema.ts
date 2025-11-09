import { pgTable, text, integer, jsonb, timestamp, numeric, boolean, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import crypto from 'crypto';

/**
 * Project Master Trait Cards
 * Defines custom rarity scoring rules for each project
 */
export const projectMasterTraitCards = pgTable("project_master_trait_cards", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  project_id: integer("project_id").notNull().unique(),
  project_name: text("project_name").notNull(),
  
  // Scoring configuration
  scoring_formula: text("scoring_formula").notNull().default('standard'), // standard, weighted, custom
  
  // Trait weights: { "Background": 1.5, "Eyes": 2.0, ... }
  trait_weights: jsonb("trait_weights").$type<Record<string, number>>().default(sql`'{}'::jsonb`),
  
  // Tier thresholds: score ranges for each tier
  tier_thresholds: jsonb("tier_thresholds").$type<{
    legendary: number;
    epic: number;
    rare: number;
    uncommon: number;
    common: number;
  }>().default(sql`'{"legendary":99,"epic":95,"rare":85,"uncommon":70,"common":0}'::jsonb`),
  
  // Custom multipliers for special traits
  custom_multipliers: jsonb("custom_multipliers").$type<Record<string, number>>().default(sql`'{}'::jsonb`),
  
  description: text("description"),
  
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_master_cards_project").on(table.project_id),
]);

/**
 * Project Trait Rarity Configuration
 * Per-trait customization for rarity scoring
 */
export const projectTraitRarityConfig = pgTable("project_trait_rarity_config", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  project_id: integer("project_id").notNull(),
  trait_type: text("trait_type").notNull(),
  trait_value: text("trait_value"), // null = applies to all values of this type
  
  // Scoring overrides
  rarity_weight: numeric("rarity_weight", { precision: 5, scale: 2 }).default('1.0'),
  custom_score: integer("custom_score"), // Override automatic calculation
  
  // Bonus traits
  is_bonus_trait: boolean("is_bonus_trait").default(false),
  bonus_points: integer("bonus_points").default(0),
  
  description: text("description"),
  
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_trait_config_project").on(table.project_id),
  index("idx_trait_config_lookup").on(table.project_id, table.trait_type, table.trait_value),
  uniqueIndex("idx_trait_config_unique").on(table.project_id, table.trait_type, table.trait_value),
]);
