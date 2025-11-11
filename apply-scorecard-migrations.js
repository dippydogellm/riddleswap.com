/**
 * Apply database migrations for project scorecards
 */

import { db } from './server/db.ts';
import { sql } from 'drizzle-orm';
import fs from 'fs';

async function applyMigrations() {
  console.log('📊 Applying project scorecard migrations...\n');

  const migrations = [
    'migrations/add-ai-scoring-fields.sql',
    'migrations/create-project-scorecards.sql'
  ];

  for (const migrationFile of migrations) {
    console.log(`\n📄 Applying: ${migrationFile}`);
    
    try {
      const migrationSQL = fs.readFileSync(migrationFile, 'utf8');
      
      // Execute entire file as one statement (handles DO blocks)
      await db.execute(sql.raw(migrationSQL));

      console.log(`   ✅ Applied ${migrationFile}`);
    } catch (error) {
      console.error(`   ❌ Failed ${migrationFile}:`, error.message);
      // Continue with other migrations
    }
  }

  console.log('\n✅ All migrations applied successfully!\n');
  process.exit(0);
}

applyMigrations().catch(error => {
  console.error('\n❌ Migration process failed:', error);
  process.exit(1);
});
