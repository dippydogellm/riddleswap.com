/**
 * Apply Missing Scanner Fields Migration
 * Adds ai_score, ai_analysis, and trait_rarity_breakdown fields
 */

import 'dotenv/config';
import { db } from './server/db';
import { sql } from 'drizzle-orm';
import { readFileSync } from 'fs';
import { join } from 'path';

async function applyMigration() {
  console.log('🔄 Applying missing scanner fields migration...\n');

  try {
    const migrationPath = join(process.cwd(), 'migrations', 'add-missing-scanner-fields.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('📝 Executing migration SQL...');
    await db.execute(sql.raw(migrationSQL));

    console.log('✅ Migration applied successfully!\n');
    console.log('Added fields:');
    console.log('  - gaming_nft_collections.ai_score (INTEGER)');
    console.log('  - gaming_nft_collections.ai_analysis (JSONB)');
    console.log('  - gaming_nfts.trait_rarity_breakdown (JSONB)');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

applyMigration();
