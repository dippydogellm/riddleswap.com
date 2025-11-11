/**
 * Apply collection tracking migration
 */

import 'dotenv/config';
import { db } from './server/db';
import { sql } from 'drizzle-orm';
import { readFileSync } from 'fs';
import { join } from 'path';

async function applyMigration() {
  console.log('🔄 Adding collection tracking, floor prices, and scan history...\n');

  try {
    const migrationPath = join(process.cwd(), 'migrations', 'add-collection-tracking.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('📝 Executing migration SQL...');
    await db.execute(sql.raw(migrationSQL));

    console.log('✅ Migration applied successfully!\n');
    console.log('Added to gaming_nft_collections:');
    console.log('  - floor_price, total_volume, market_cap');
    console.log('  - holders_count, importance_level');
    console.log('  - bithomp_metadata, bithomp_assets (JSONB)');
    console.log('  - last_scan_id, last_floor_check');
    console.log('\nCreated tables:');
    console.log('  - collection_scan_history (scan tracking)');
    console.log('  - collection_floor_history (price history)');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

applyMigration();
