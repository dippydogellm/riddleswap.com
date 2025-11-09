#!/usr/bin/env node
import { neonConfig, Pool } from '@neondatabase/serverless';
import ws from 'ws';
import dotenv from 'dotenv';

dotenv.config();
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

console.log('🔧 Creating scorecard tables...');

try {
  const client = await pool.connect();
  
  try {
    // Create tables one by one
    console.log('Creating project_trait_scores...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "project_trait_scores" (
        "id" text PRIMARY KEY NOT NULL,
        "project_id" integer,
        "collection_id" text NOT NULL,
        "collection_name" text,
        "trait_type" text NOT NULL,
        "trait_value" text NOT NULL,
        "trait_count" integer DEFAULT 0 NOT NULL,
        "total_nfts" integer DEFAULT 0 NOT NULL,
        "rarity_percentage" numeric(5, 2) DEFAULT 0 NOT NULL,
        "rarity_score" integer DEFAULT 0 NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    
    console.log('Creating indexes for project_trait_scores...');
    await client.query('CREATE INDEX IF NOT EXISTS "idx_trait_scores_project" ON "project_trait_scores" ("project_id")');
    await client.query('CREATE INDEX IF NOT EXISTS "idx_trait_scores_collection" ON "project_trait_scores" ("collection_id")');
    await client.query('CREATE INDEX IF NOT EXISTS "idx_trait_scores_trait_type" ON "project_trait_scores" ("trait_type")');
    await client.query('CREATE INDEX IF NOT EXISTS "idx_trait_scores_rarity" ON "project_trait_scores" ("collection_id","rarity_score")');
    
    console.log('Creating nft_rarity_scorecards...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "nft_rarity_scorecards" (
        "id" text PRIMARY KEY NOT NULL,
        "nft_id" text NOT NULL UNIQUE,
        "project_id" integer,
        "collection_id" text NOT NULL,
        "collection_name" text,
        "nft_name" text,
        "trait_scores" jsonb DEFAULT '{}'::jsonb,
        "total_rarity_score" integer DEFAULT 0 NOT NULL,
        "average_rarity_score" numeric(5, 2),
        "rarity_tier" text,
        "total_traits" integer DEFAULT 0,
        "calculated_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    
    console.log('Creating indexes for nft_rarity_scorecards...');
    await client.query('CREATE INDEX IF NOT EXISTS "idx_rarity_scorecards_nft" ON "nft_rarity_scorecards" ("nft_id")');
    await client.query('CREATE INDEX IF NOT EXISTS "idx_rarity_scorecards_project" ON "nft_rarity_scorecards" ("project_id")');
    await client.query('CREATE INDEX IF NOT EXISTS "idx_rarity_scorecards_collection" ON "nft_rarity_scorecards" ("collection_id")');
    await client.query('CREATE INDEX IF NOT EXISTS "idx_rarity_scorecards_score" ON "nft_rarity_scorecards" ("collection_id","total_rarity_score")');
    
    console.log('Creating project_collection_stats...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "project_collection_stats" (
        "id" text PRIMARY KEY NOT NULL,
        "project_id" integer NOT NULL UNIQUE,
        "collection_id" text NOT NULL,
        "collection_name" text,
        "total_nfts" integer DEFAULT 0,
        "total_traits" integer DEFAULT 0,
        "total_trait_values" integer DEFAULT 0,
        "trait_distribution" jsonb DEFAULT '{}'::jsonb,
        "rarity_distribution" jsonb DEFAULT '{"legendary":0,"epic":0,"rare":0,"uncommon":0,"common":0}'::jsonb,
        "last_scan" timestamp,
        "last_rarity_calculation" timestamp,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    
    console.log('Creating indexes for project_collection_stats...');
    await client.query('CREATE INDEX IF NOT EXISTS "idx_collection_stats_project" ON "project_collection_stats" ("project_id")');
    await client.query('CREATE INDEX IF NOT EXISTS "idx_collection_stats_collection" ON "project_collection_stats" ("collection_id")');
    
    console.log('Creating rarity_calculation_history...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "rarity_calculation_history" (
        "id" text PRIMARY KEY NOT NULL,
        "project_id" integer,
        "collection_id" text NOT NULL,
        "calculation_type" text NOT NULL,
        "nfts_processed" integer DEFAULT 0,
        "traits_analyzed" integer DEFAULT 0,
        "duration_ms" integer,
        "status" text NOT NULL,
        "error_message" text,
        "started_at" timestamp NOT NULL,
        "completed_at" timestamp
      )
    `);
    
    console.log('Creating indexes for rarity_calculation_history...');
    await client.query('CREATE INDEX IF NOT EXISTS "idx_calculation_history_project" ON "rarity_calculation_history" ("project_id")');
    await client.query('CREATE INDEX IF NOT EXISTS "idx_calculation_history_collection" ON "rarity_calculation_history" ("collection_id")');
    await client.query('CREATE INDEX IF NOT EXISTS "idx_calculation_history_status" ON "rarity_calculation_history" ("status")');
    
    console.log('✅ All tables and indexes created successfully!');
    console.log('🔧 Scorecard system is now ready.');
    
  } finally {
    client.release();
  }
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
} finally {
  await pool.end();
}
