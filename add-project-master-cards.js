#!/usr/bin/env node
import { neonConfig, Pool } from '@neondatabase/serverless';
import ws from 'ws';
import dotenv from 'dotenv';

dotenv.config();
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

console.log('🔧 Adding project_id to inquisition_collections and creating master trait card system...');

try {
  const client = await pool.connect();
  
  try {
    console.log('1. Adding project_id to inquisition_collections...');
    await client.query(`
      ALTER TABLE "inquisition_collections" 
      ADD COLUMN IF NOT EXISTS "project_id" INTEGER
    `);
    
    console.log('2. Creating project_master_trait_cards table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "project_master_trait_cards" (
        "id" text PRIMARY KEY NOT NULL,
        "project_id" integer NOT NULL UNIQUE,
        "project_name" text NOT NULL,
        "scoring_formula" text NOT NULL DEFAULT 'standard',
        "trait_weights" jsonb DEFAULT '{}'::jsonb,
        "tier_thresholds" jsonb DEFAULT '{"legendary":99,"epic":95,"rare":85,"uncommon":70,"common":0}'::jsonb,
        "custom_multipliers" jsonb DEFAULT '{}'::jsonb,
        "description" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    
    console.log('3. Creating indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS "idx_collections_project_id" 
      ON "inquisition_collections" ("project_id")
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS "idx_master_cards_project" 
      ON "project_master_trait_cards" ("project_id")
    `);
    
    console.log('4. Creating project_trait_rarity_config table for per-trait customization...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "project_trait_rarity_config" (
        "id" text PRIMARY KEY NOT NULL,
        "project_id" integer NOT NULL,
        "trait_type" text NOT NULL,
        "trait_value" text,
        "rarity_weight" numeric(5, 2) DEFAULT 1.0,
        "custom_score" integer,
        "is_bonus_trait" boolean DEFAULT false,
        "bonus_points" integer DEFAULT 0,
        "description" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        UNIQUE("project_id", "trait_type", "trait_value")
      )
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS "idx_trait_config_project" 
      ON "project_trait_rarity_config" ("project_id")
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS "idx_trait_config_lookup" 
      ON "project_trait_rarity_config" ("project_id", "trait_type", "trait_value")
    `);
    
    console.log('✅ Schema updated successfully!');
    console.log('📊 Projects can now have custom rarity scoring with master trait cards');
    console.log('🎯 Collections can be linked to projects via project_id');
    
  } finally {
    client.release();
  }
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
} finally {
  await pool.end();
}
