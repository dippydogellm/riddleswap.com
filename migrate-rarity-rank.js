#!/usr/bin/env node
import { neonConfig, Pool } from '@neondatabase/serverless';
import ws from 'ws';
import dotenv from 'dotenv';

dotenv.config();
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

console.log('🔧 Adding rarity_rank column to nft_rarity_scorecards...');

try {
  const client = await pool.connect();
  
  try {
    // Check if column exists
    const checkColumn = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='nft_rarity_scorecards' AND column_name='rarity_rank'
    `);
    
    if (checkColumn.rows.length === 0) {
      console.log('Adding rarity_rank column...');
      await client.query('ALTER TABLE nft_rarity_scorecards ADD COLUMN rarity_rank INTEGER');
      console.log('Creating index...');
      await client.query('CREATE INDEX IF NOT EXISTS idx_rarity_scorecards_rank ON nft_rarity_scorecards(collection_id, rarity_rank)');
      console.log('✅ rarity_rank column added successfully!');
    } else {
      console.log('✅ rarity_rank column already exists!');
    }
    
    // Fix project_collection_stats unique constraint
    console.log('Checking project_collection_stats constraints...');
    await client.query(`
      DO $$ 
      BEGIN
        -- Drop the incorrect UNIQUE constraint on project_id if it exists
        IF EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name LIKE '%project_collection_stats%project_id%' 
          AND constraint_type = 'UNIQUE'
        ) THEN
          ALTER TABLE project_collection_stats DROP CONSTRAINT IF EXISTS project_collection_stats_project_id_unique;
        END IF;
        
        -- Add UNIQUE constraint on collection_id if it doesn't exist
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'project_collection_stats_collection_id_unique'
        ) THEN
          ALTER TABLE project_collection_stats ADD CONSTRAINT project_collection_stats_collection_id_unique UNIQUE (collection_id);
        END IF;
      END $$;
    `);
    console.log('✅ project_collection_stats constraints fixed!');
    
  } finally {
    client.release();
  }
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
} finally {
  await pool.end();
}
