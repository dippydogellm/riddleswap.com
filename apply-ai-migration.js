/**
 * Apply database migration for AI scoring fields
 */

import { db } from './server/db.ts';
import { sql } from 'drizzle-orm';
import fs from 'fs';

async function applyMigration() {
  console.log('📊 Applying AI scoring fields migration...\n');

  try {
    // Read migration file
    const migrationSQL = fs.readFileSync('migrations/add-ai-scoring-fields.sql', 'utf8');
    
    // Split into individual statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));

    // Execute each statement
    for (const statement of statements) {
      if (statement) {
        console.log('Executing:', statement.substring(0, 80) + '...');
        await db.execute(sql.raw(statement));
      }
    }

    console.log('\n✅ Migration applied successfully!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

applyMigration();
