#!/usr/bin/env node
import { neonConfig, Pool } from '@neondatabase/serverless';
import ws from 'ws';
import dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables
dotenv.config();

// Configure WebSocket for Neon serverless
neonConfig.webSocketConstructor = ws;

console.log('🚀 Applying scorecard tables migration...');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  // Read the migration file
  const migrationSQL = fs.readFileSync('./migrations/0002_scorecard_tables.sql', 'utf8');
  
  // Execute the entire migration as one transaction
  console.log(`📋 Executing migration...`);
  
  const client = await pool.connect();
  
  try {
    // Split by statement breakpoint
    const statements = migrationSQL
      .split('--> statement-breakpoint')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`📋 Found ${statements.length} statements`);
    
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      console.log(`⚙️  [${i + 1}/${statements.length}] ${stmt.substring(0, 50)}...`);
      try {
        await client.query(stmt);
        console.log(`   ✅ Success`);
      } catch (err) {
        console.log(`   ❌ Failed: ${err.message}`);
        throw err;
      }
    }
    
    console.log('✅ Migration completed successfully!');
    console.log('🔧 Scorecard tables are now ready.');
    
  } finally {
    client.release();
  }
  
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
} finally {
  await pool.end();
}
