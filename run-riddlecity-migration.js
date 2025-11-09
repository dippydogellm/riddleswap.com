#!/usr/bin/env node
import 'dotenv/config';
import fs from 'fs';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function runRiddleCityMigration() {
  console.log('🚀 Running RiddleCity Database Migration...\n');

  try {
    // Read the migration file
    const migrationSQL = fs.readFileSync('./migrations/riddlecity-complete-schema.sql', 'utf8');
    
    console.log('📋 Executing migration SQL...');
    
    // Split into individual statements and categorize them
    const allStatements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    // Group statements by type for proper execution order
    const createTables = allStatements.filter(s => s.includes('CREATE TABLE') || s.includes('DROP TABLE'));
    const createIndexes = allStatements.filter(s => s.includes('CREATE INDEX'));
    const alterTables = allStatements.filter(s => s.includes('ALTER TABLE'));
    const inserts = allStatements.filter(s => s.includes('INSERT INTO'));
    const updates = allStatements.filter(s => s.includes('UPDATE'));
    
    console.log(`   Found ${allStatements.length} SQL statements\n`);
    console.log(`   Phase 1: CREATE/DROP TABLES (${createTables.length} statements)`);
    console.log(`   Phase 2: ALTER TABLES (${alterTables.length} statements)`);
    console.log(`   Phase 3: CREATE INDEXES (${createIndexes.length} statements)`);
    console.log(`   Phase 4: INSERT DATA (${inserts.length} statements)`);
    console.log(`   Phase 5: UPDATE DATA (${updates.length} statements)\n`);
    
    let successCount = 0;
    
    // Execute in proper order
    const phases = [
      { name: 'CREATE/DROP TABLES', statements: createTables },
      { name: 'ALTER TABLES', statements: alterTables },
      { name: 'CREATE INDEXES', statements: createIndexes },
      { name: 'INSERT DATA', statements: inserts },
      { name: 'UPDATE DATA', statements: updates }
    ];
    
    for (const phase of phases) {
      if (phase.statements.length === 0) continue;
      
      console.log(`\n📍 Phase: ${phase.name}`);
      
      for (const statement of phase.statements) {
        try {
          await sql(statement);
          successCount++;
          
          // Show progress for major operations
          if (statement.includes('CREATE TABLE')) {
            const tableName = statement.match(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)/)?.[1];
            console.log(`   ✓ Created table: ${tableName}`);
          } else if (statement.includes('DROP TABLE')) {
            const tableName = statement.match(/DROP TABLE (?:IF EXISTS )?(\w+)/)?.[1];
            console.log(`   ✓ Dropped table: ${tableName}`);
          } else if (statement.includes('CREATE INDEX')) {
            const indexName = statement.match(/CREATE INDEX (?:IF NOT EXISTS )?(\w+)/)?.[1];
            console.log(`   ✓ Created index: ${indexName}`);
          } else if (statement.includes('INSERT INTO building_types')) {
            console.log(`   ✓ Inserted building types seed data (20 buildings)`);
          } else if (statement.includes('UPDATE building_types')) {
            console.log(`   ✓ Updated building production rates`);
          } else if (statement.includes('ALTER TABLE')) {
            console.log(`   ✓ Altered table`);
          }
        } catch (err) {
          // Ignore "already exists" errors for idempotency
          if (err.message.includes('already exists') || err.code === '42P07' || 
              err.message.includes('does not exist') && statement.includes('DROP') ||
              err.code === '42P16') { // duplicate_table for DROP IF EXISTS
            console.log(`   ⚠ Skipped: ${statement.substring(0, 60)}...`);
          } else {
            console.error(`   ✗ Failed: ${err.message}`);
            console.error(`   Statement: ${statement.substring(0, 100)}...`);
            throw err;
          }
        }
      }
    }
    
    console.log(`\n✅ RiddleCity migration completed successfully! (${successCount} statements)\n`);
    console.log('📊 Created/Updated:');
    console.log('   - building_types table (with 20 building types)');
    console.log('   - city_buildings table');
    console.log('   - resource_production_log table');
    console.log('   - city_surveys table');
    console.log('   - survey_votes table');
    console.log('   - city_policies table (enhanced)');
    console.log('   - city_defenses table (enhanced)');
    console.log('   - city_citizens table (enhanced)');
    console.log('   - All indexes and foreign keys');
    console.log('\n🎮 RiddleCity game system is now ready!\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

runRiddleCityMigration();
