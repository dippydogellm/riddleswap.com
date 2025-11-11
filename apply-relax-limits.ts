/**
 * Apply relaxed trait limits migration
 */

import 'dotenv/config';
import { db } from './server/db';
import { sql } from 'drizzle-orm';
import { readFileSync } from 'fs';
import { join } from 'path';

async function applyMigration() {
  console.log('🔄 Relaxing trait field limits for large collections...\n');

  try {
    const migrationPath = join(process.cwd(), 'migrations', 'relax-trait-limits.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('📝 Executing migration SQL...');
    await db.execute(sql.raw(migrationSQL));

    console.log('✅ Migration applied successfully!\n');
    console.log('Updated:');
    console.log('  - project_name: VARCHAR(255) → TEXT (unlimited)');
    console.log('  - trait_category: VARCHAR(255) → TEXT (unlimited)');
    console.log('  - issuer_address: VARCHAR(255) → TEXT (unlimited)');
    console.log('  - Unique constraint now uses MD5 hash for long values');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

applyMigration();
