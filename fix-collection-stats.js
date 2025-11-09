#!/usr/bin/env node
import { neonConfig, Pool } from '@neondatabase/serverless';
import ws from 'ws';
import dotenv from 'dotenv';

dotenv.config();
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

console.log('🔧 Fixing project_collection_stats schema...');

try {
  const client = await pool.connect();
  
  try {
    console.log('Altering project_collection_stats to allow NULL project_id...');
    await client.query(`
      ALTER TABLE "project_collection_stats" 
      ALTER COLUMN "project_id" DROP NOT NULL
    `);
    
    console.log('Dropping unique constraint on project_id...');
    await client.query(`
      ALTER TABLE "project_collection_stats" 
      DROP CONSTRAINT IF EXISTS "project_collection_stats_project_id_unique"
    `);
    
    console.log('✅ Schema updated successfully!');
    console.log('🔧 Collections can now be tracked without requiring project_id.');
    
  } finally {
    client.release();
  }
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
} finally {
  await pool.end();
}
