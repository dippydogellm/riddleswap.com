#!/usr/bin/env node
import { drizzle } from 'drizzle-orm/neon-serverless';
import { migrate } from 'drizzle-orm/neon-serverless/migrator';
import { neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configure WebSocket for Neon serverless
neonConfig.webSocketConstructor = ws;

console.log('🚀 Applying database migration...');

try {
  const db = drizzle(process.env.DATABASE_URL);
  
  console.log('📋 Running migration from ./migrations folder...');
  await migrate(db, { migrationsFolder: './migrations' });
  
  console.log('✅ Migration applied successfully!');
  console.log('🔧 Database schema is now synchronized.');
  
} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
}