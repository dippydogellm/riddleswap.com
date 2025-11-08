/**
 * RiddleCity Database Schema
 * Complete SimCity-style city-building game with economy, defense, politics, and NFT integration
 */

import { 
  pgTable, 
  text, 
  integer, 
  decimal, 
  timestamp, 
  boolean, 
  jsonb, 
  varchar,
  serial,
  unique,
  index
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { medievalLandPlots } from "./schema";

// ============================================================================
// CITIES - Core city instances owned by users
// ============================================================================
export const cities = pgTable("cities", {
  id: serial("id").primaryKey(),
  userHandle: varchar("user_handle", { length: 255 }).notNull(),
  cityName: varchar("city_name", { length: 255 }).notNull(),
  
  // Land plot integration - REQUIRED to build a city
  landPlotId: text("land_plot_id").references(() => medievalLandPlots.id, { onDelete: 'set null' }),
  terrainType: text("terrain_type"), // Inherited from land plot
  plotSize: text("plot_size"), // Inherited from land plot (standard, large, massive)
  
  // Resources
  credits: decimal("credits", { precision: 20, scale: 2 }).default("10000.00"),
  materials: decimal("materials", { precision: 20, scale: 2 }).default("500.00"),
  energy: decimal("energy", { precision: 20, scale: 2 }).default("1000.00"),
  food: decimal("food", { precision: 20, scale: 2 }).default("500.00"),
  
  // Population & Capacity
  population: integer("population").default(0),
  populationCapacity: integer("population_capacity").default(100),
  happiness: integer("happiness").default(50), // 0-100
  
  // Stats
  totalBuildings: integer("total_buildings").default(0),
  economicValue: decimal("economic_value", { precision: 20, scale: 2 }).default("0.00"),
  defenseRating: integer("defense_rating").default(0),
  
  // Tier & Progression
  cityLevel: integer("city_level").default(1),
  experiencePoints: integer("experience_points").default(0),
  
  // Project economy integration
  linkedProjectId: varchar("linked_project_id", { length: 255 }),
  contributeToProject: boolean("contribute_to_project").default(false),
  economySharePercent: integer("economy_share_percent").default(0), // % revenue shared with project
  
  // Metadata
  cityDescription: text("city_description"),
  cityImage: text("city_image"),
  foundedAt: timestamp("founded_at").defaultNow(),
  lastActive: timestamp("last_active").defaultNow(),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}, (table) => [
  index("idx_cities_user_handle").on(table.userHandle),
  index("idx_cities_city_level").on(table.cityLevel),
  index("idx_cities_last_active").on(table.lastActive),
]);

// ============================================================================
// BUILDING CATALOG - Templates for all building types
// ============================================================================
export const buildingCatalog = pgTable("building_catalog", {
  id: serial("id").primaryKey(),
  buildingType: varchar("building_type", { length: 100 }).notNull().unique(), // 'house', 'shop', 'factory', etc.
  category: varchar("category", { length: 50 }).notNull(), // 'residential', 'commercial', 'industrial', 'defense', 'civic'
  
  // Display
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 255 }),
  image: varchar("image", { length: 255 }),
  
  // Construction costs
  creditCost: decimal("credit_cost", { precision: 20, scale: 2 }).notNull(),
  materialCost: decimal("material_cost", { precision: 20, scale: 2 }).notNull(),
  energyCost: decimal("energy_cost", { precision: 20, scale: 2 }).default("0.00"),
  constructionTime: integer("construction_time").default(60), // seconds
  
  // Requirements
  requiredCityLevel: integer("required_city_level").default(1),
  requiredPopulation: integer("required_population").default(0),
  plotSpaceRequired: integer("plot_space_required").default(1),
  
  // Production & Capacity
  producesCredits: decimal("produces_credits", { precision: 20, scale: 2 }).default("0.00"), // per tick
  producesEnergy: decimal("produces_energy", { precision: 20, scale: 2 }).default("0.00"),
  producesFood: decimal("produces_food", { precision: 20, scale: 2 }).default("0.00"),
  producesMaterials: decimal("produces_materials", { precision: 20, scale: 2 }).default("0.00"),
  
  consumesEnergy: decimal("consumes_energy", { precision: 20, scale: 2 }).default("0.00"), // per tick
  consumesFood: decimal("consumes_food", { precision: 20, scale: 2 }).default("0.00"),
  
  upkeepCost: decimal("upkeep_cost", { precision: 20, scale: 2 }).default("0.00"), // credits per tick
  
  housingCapacity: integer("housing_capacity").default(0), // population slots
  shopSlots: integer("shop_slots").default(0), // online shop slots for commerce
  defenseBonus: integer("defense_bonus").default(0),
  happinessBonus: integer("happiness_bonus").default(0),
  
  // Upgrade path
  canUpgrade: boolean("can_upgrade").default(false),
  upgradesTo: varchar("upgrades_to", { length: 100 }), // buildingType of next tier
  
  // Flags
  isActive: boolean("is_active").default(true),
  isSpecial: boolean("is_special").default(false), // landmark buildings
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}, (table) => [
  index("idx_building_catalog_category").on(table.category),
  index("idx_building_catalog_is_active").on(table.isActive),
]);

// ============================================================================
// CITY BUILDINGS - Placed building instances in cities
// ============================================================================
export const cityBuildings = pgTable("city_buildings", {
  id: serial("id").primaryKey(),
  cityId: integer("city_id").notNull().references(() => cities.id, { onDelete: 'cascade' }),
  buildingType: varchar("building_type", { length: 100 }).notNull(),
  
  // Placement
  positionX: integer("position_x").notNull(),
  positionY: integer("position_y").notNull(),
  rotation: integer("rotation").default(0), // 0, 90, 180, 270
  
  // State
  level: integer("level").default(1),
  constructionStatus: varchar("construction_status", { length: 50 }).default("constructing"), // 'constructing', 'active', 'upgrading', 'damaged'
  constructionStarted: timestamp("construction_started").defaultNow(),
  constructionEnds: timestamp("construction_ends"),
  
  // Performance
  productionMultiplier: decimal("production_multiplier", { precision: 5, scale: 2 }).default("1.00"),
  efficiency: integer("efficiency").default(100), // 0-100%
  
  // Custom name
  customName: varchar("custom_name", { length: 255 }),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}, (table) => [
  index("idx_city_buildings_city_id").on(table.cityId),
  index("idx_city_buildings_building_type").on(table.buildingType),
  index("idx_city_buildings_status").on(table.constructionStatus),
]);

// ============================================================================
// FURNISHING CATALOG - Templates for furniture and decorations
// ============================================================================
export const furnishingCatalog = pgTable("furnishing_catalog", {
  id: serial("id").primaryKey(),
  furnishingType: varchar("furnishing_type", { length: 100 }).notNull().unique(),
  category: varchar("category", { length: 50 }).notNull(), // 'furniture', 'decoration', 'equipment'
  
  // Display
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 255 }),
  model: varchar("model", { length: 255 }), // 3D model reference
  
  // Purchase
  creditCost: decimal("credit_cost", { precision: 20, scale: 2 }).notNull(),
  
  // Placement
  canPlaceIn: jsonb("can_place_in").$type<string[]>(), // Building types this can be placed in
  sizeX: integer("size_x").default(1),
  sizeY: integer("size_y").default(1),
  
  // Bonuses
  happinessBonus: integer("happiness_bonus").default(0),
  productionBonus: decimal("production_bonus", { precision: 5, scale: 2 }).default("0.00"), // % multiplier
  
  isActive: boolean("is_active").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}, (table) => [
  index("idx_furnishing_catalog_category").on(table.category),
  index("idx_furnishing_catalog_is_active").on(table.isActive),
]);

// ============================================================================
// CITY FURNISHINGS - Placed furnishings in buildings
// ============================================================================
export const cityFurnishings = pgTable("city_furnishings", {
  id: serial("id").primaryKey(),
  cityId: integer("city_id").notNull().references(() => cities.id, { onDelete: 'cascade' }),
  buildingId: integer("building_id").notNull().references(() => cityBuildings.id, { onDelete: 'cascade' }),
  furnishingType: varchar("furnishing_type", { length: 100 }).notNull(),
  
  // Placement within building
  positionX: integer("position_x").notNull(),
  positionY: integer("position_y").notNull(),
  rotation: integer("rotation").default(0),
  
  createdAt: timestamp("created_at").defaultNow()
}, (table) => [
  index("idx_city_furnishings_city_id").on(table.cityId),
  index("idx_city_furnishings_building_id").on(table.buildingId),
]);

// ============================================================================
// CITY SHOPS - Online commerce in cities
// ============================================================================
export const cityShops = pgTable("city_shops", {
  id: serial("id").primaryKey(),
  cityId: integer("city_id").notNull().references(() => cities.id, { onDelete: 'cascade' }),
  buildingId: integer("building_id").notNull().references(() => cityBuildings.id, { onDelete: 'cascade' }),
  
  // Shop details
  shopName: varchar("shop_name", { length: 255 }).notNull(),
  shopType: varchar("shop_type", { length: 100 }).notNull(), // 'market', 'craftshop', 'tavern', 'bank'
  description: text("description"),
  
  // Economy
  dailyRevenue: decimal("daily_revenue", { precision: 20, scale: 2 }).default("0.00"),
  inventory: jsonb("inventory").$type<{ itemId: string; quantity: number; price: string }[]>(),
  
  // Status
  isOpen: boolean("is_open").default(true),
  customersToday: integer("customers_today").default(0),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}, (table) => [
  index("idx_city_shops_city_id").on(table.cityId),
  index("idx_city_shops_building_id").on(table.buildingId),
]);

// ============================================================================
// RESOURCE TICKS - Historical ledger of resource changes
// ============================================================================
export const resourceTicks = pgTable("resource_ticks", {
  id: serial("id").primaryKey(),
  cityId: integer("city_id").notNull().references(() => cities.id, { onDelete: 'cascade' }),
  
  // Deltas
  creditsDelta: decimal("credits_delta", { precision: 20, scale: 2 }).default("0.00"),
  materialsDelta: decimal("materials_delta", { precision: 20, scale: 2 }).default("0.00"),
  energyDelta: decimal("energy_delta", { precision: 20, scale: 2 }).default("0.00"),
  foodDelta: decimal("food_delta", { precision: 20, scale: 2 }).default("0.00"),
  
  // Breakdown
  source: varchar("source", { length: 100 }), // 'production', 'upkeep', 'construction', 'trade', 'policy'
  details: jsonb("details"),
  
  tickedAt: timestamp("ticked_at").defaultNow()
}, (table) => [
  index("idx_resource_ticks_city_id").on(table.cityId),
  index("idx_resource_ticks_ticked_at").on(table.tickedAt),
]);

// ============================================================================
// DEFENSE SYSTEMS - Defensive structures catalog
// ============================================================================
export const defenseSystemsCatalog = pgTable("defense_systems_catalog", {
  id: serial("id").primaryKey(),
  systemType: varchar("system_type", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  
  creditCost: decimal("credit_cost", { precision: 20, scale: 2 }).notNull(),
  materialCost: decimal("material_cost", { precision: 20, scale: 2 }).notNull(),
  
  defenseStrength: integer("defense_strength").notNull(),
  upkeepCost: decimal("upkeep_cost", { precision: 20, scale: 2 }).default("0.00"),
  
  requiredCityLevel: integer("required_city_level").default(1),
  
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow()
}, (table) => [
  index("idx_defense_systems_catalog_is_active").on(table.isActive),
]);

// ============================================================================
// CITY DEFENSES - Active defense systems in cities
// ============================================================================
export const cityDefenses = pgTable("city_defenses", {
  id: serial("id").primaryKey(),
  cityId: integer("city_id").notNull().references(() => cities.id, { onDelete: 'cascade' }),
  systemType: varchar("system_type", { length: 100 }).notNull(),
  
  level: integer("level").default(1),
  strength: integer("strength").notNull(),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}, (table) => [
  index("idx_city_defenses_city_id").on(table.cityId),
]);

// ============================================================================
// POLICY DEFINITIONS - Available governance policies
// ============================================================================
export const policyDefinitions = pgTable("policy_definitions", {
  id: serial("id").primaryKey(),
  policyType: varchar("policy_type", { length: 100 }).notNull().unique(),
  category: varchar("category", { length: 50 }).notNull(), // 'economy', 'social', 'military', 'environment'
  
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  
  // Effects (can be positive or negative)
  happinessModifier: integer("happiness_modifier").default(0),
  productionModifier: decimal("production_modifier", { precision: 5, scale: 2 }).default("0.00"), // % multiplier
  upkeepModifier: decimal("upkeep_modifier", { precision: 5, scale: 2 }).default("0.00"), // % multiplier
  populationGrowthModifier: decimal("population_growth_modifier", { precision: 5, scale: 2 }).default("0.00"),
  
  // Costs
  implementationCost: decimal("implementation_cost", { precision: 20, scale: 2 }).default("0.00"),
  dailyCost: decimal("daily_cost", { precision: 20, scale: 2 }).default("0.00"),
  
  requiredCityLevel: integer("required_city_level").default(1),
  
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow()
}, (table) => [
  index("idx_policy_definitions_category").on(table.category),
  index("idx_policy_definitions_is_active").on(table.isActive),
]);

// ============================================================================
// CITY POLICIES - Active policies in cities
// ============================================================================
export const cityPolicies = pgTable("city_policies", {
  id: serial("id").primaryKey(),
  cityId: integer("city_id").notNull().references(() => cities.id, { onDelete: 'cascade' }),
  policyType: varchar("policy_type", { length: 100 }).notNull(),
  
  enactedAt: timestamp("enacted_at").defaultNow(),
  expiresAt: timestamp("expires_at"), // null = permanent
  
  isActive: boolean("is_active").default(true)
}, (table) => [
  index("idx_city_policies_city_id").on(table.cityId),
  index("idx_city_policies_is_active").on(table.isActive),
]);

// ============================================================================
// CITIZEN SLOTS - NFT citizen assignments
// ============================================================================
export const cityCitizens = pgTable("city_citizens", {
  id: serial("id").primaryKey(),
  cityId: integer("city_id").notNull().references(() => cities.id, { onDelete: 'cascade' }),
  
  // NFT reference
  nftId: varchar("nft_id", { length: 255 }).notNull(),
  nftTokenId: varchar("nft_token_id", { length: 255 }).notNull(),
  nftCollection: varchar("nft_collection", { length: 255 }).notNull(),
  
  // Job assignment
  assignedRole: varchar("assigned_role", { length: 100 }), // 'worker', 'merchant', 'guard', 'leader'
  assignedBuildingId: integer("assigned_building_id").references(() => cityBuildings.id, { onDelete: 'set null' }),
  
  // Bonuses from NFT stats
  economicBonus: decimal("economic_bonus", { precision: 5, scale: 2 }).default("0.00"),
  productionBonus: decimal("production_bonus", { precision: 5, scale: 2 }).default("0.00"),
  defenseBonus: integer("defense_bonus").default(0),
  happinessBonus: integer("happiness_bonus").default(0),
  
  assignedAt: timestamp("assigned_at").defaultNow()
}, (table) => [
  index("idx_city_citizens_city_id").on(table.cityId),
  index("idx_city_citizens_nft_id").on(table.nftId),
]);

// ============================================================================
// TOKEN TRANSACTIONS - Multi-token purchases and trades
// ============================================================================
export const cityTransactions = pgTable("city_transactions", {
  id: serial("id").primaryKey(),
  cityId: integer("city_id").notNull().references(() => cities.id, { onDelete: 'cascade' }),
  userHandle: varchar("user_handle", { length: 255 }).notNull(),
  
  // Transaction details
  transactionType: varchar("transaction_type", { length: 100 }).notNull(), // 'build', 'upgrade', 'furnish', 'policy', 'trade'
  itemType: varchar("item_type", { length: 100 }),
  itemId: varchar("item_id", { length: 255 }),
  
  // Payment
  paymentToken: varchar("payment_token", { length: 50 }).notNull(), // 'XRP', 'RDL', 'ETH', etc.
  amount: decimal("amount", { precision: 20, scale: 8 }).notNull(),
  amountUsd: decimal("amount_usd", { precision: 20, scale: 2 }),
  
  // Blockchain
  txHash: varchar("tx_hash", { length: 255 }),
  chain: varchar("chain", { length: 50 }),
  
  status: varchar("status", { length: 50 }).default("pending"), // 'pending', 'completed', 'failed'
  
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at")
}, (table) => [
  index("idx_city_transactions_city_id").on(table.cityId),
  index("idx_city_transactions_user_handle").on(table.userHandle),
  index("idx_city_transactions_status").on(table.status),
]);

// ============================================================================
// GAMEPLAY EVENTS - Session and event tracking
// ============================================================================
export const gameplayEvents = pgTable("gameplay_events", {
  id: serial("id").primaryKey(),
  cityId: integer("city_id").notNull().references(() => cities.id, { onDelete: 'cascade' }),
  userHandle: varchar("user_handle", { length: 255 }).notNull(),
  
  eventType: varchar("event_type", { length: 100 }).notNull(), // 'login', 'build', 'upgrade', 'attack', 'trade'
  eventData: jsonb("event_data"),
  
  createdAt: timestamp("created_at").defaultNow()
}, (table) => [
  index("idx_gameplay_events_city_id").on(table.cityId),
  index("idx_gameplay_events_user_handle").on(table.userHandle),
  index("idx_gameplay_events_event_type").on(table.eventType),
]);

// ============================================================================
// RELATIONS
// ============================================================================
export const citiesRelations = relations(cities, ({ one, many }) => ({
  landPlot: one(medievalLandPlots, {
    fields: [cities.landPlotId],
    references: [medievalLandPlots.id]
  }),
  buildings: many(cityBuildings),
  furnishings: many(cityFurnishings),
  shops: many(cityShops),
  resourceTicks: many(resourceTicks),
  defenses: many(cityDefenses),
  policies: many(cityPolicies),
  citizens: many(cityCitizens),
  transactions: many(cityTransactions),
  events: many(gameplayEvents)
}));

export const cityBuildingsRelations = relations(cityBuildings, ({ one, many }) => ({
  city: one(cities, {
    fields: [cityBuildings.cityId],
    references: [cities.id]
  }),
  furnishings: many(cityFurnishings),
  shop: many(cityShops)
}));

export const cityFurnishingsRelations = relations(cityFurnishings, ({ one }) => ({
  city: one(cities, {
    fields: [cityFurnishings.cityId],
    references: [cities.id]
  }),
  building: one(cityBuildings, {
    fields: [cityFurnishings.buildingId],
    references: [cityBuildings.id]
  })
}));

export const cityShopsRelations = relations(cityShops, ({ one }) => ({
  city: one(cities, {
    fields: [cityShops.cityId],
    references: [cities.id]
  }),
  building: one(cityBuildings, {
    fields: [cityShops.buildingId],
    references: [cityBuildings.id]
  })
}));
