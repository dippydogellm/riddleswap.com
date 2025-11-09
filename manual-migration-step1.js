#!/usr/bin/env node
import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function runManualMigration() {
  console.log('🚀 Running Manual RiddleCity Migration...\n');

  try {
    // Step 1: Drop existing tables
    console.log('📍 Step 1: Dropping existing tables...');
    try {
      await sql`DROP TABLE IF EXISTS building_types CASCADE`;
      console.log('   ✓ Dropped building_types');
    } catch (e) {
      console.log('   ⚠ building_types not found');
    }
    
    try {
      await sql`DROP TABLE IF EXISTS city_buildings CASCADE`;
      console.log('   ✓ Dropped city_buildings');
    } catch (e) {
      console.log('   ⚠ city_buildings not found');
    }
    
    try {
      await sql`DROP TABLE IF EXISTS resource_production_log CASCADE`;
      console.log('   ✓ Dropped resource_production_log');
    } catch (e) {
      console.log('   ⚠ resource_production_log not found');
    }
    
    try {
      await sql`DROP TABLE IF EXISTS city_surveys CASCADE`;
      console.log('   ✓ Dropped city_surveys');
    } catch (e) {
      console.log('   ⚠ city_surveys not found');
    }
    
    try {
      await sql`DROP TABLE IF EXISTS survey_votes CASCADE`;
      console.log('   ✓ Dropped survey_votes');
    } catch (e) {
      console.log('   ⚠ survey_votes not found');
    }
    
    try {
      await sql`DROP TABLE IF EXISTS city_policies CASCADE`;
      console.log('   ✓ Dropped city_policies');
    } catch (e) {
      console.log('   ⚠ city_policies not found');
    }
    
    try {
      await sql`DROP TABLE IF EXISTS city_defenses CASCADE`;
      console.log('   ✓ Dropped city_defenses');
    } catch (e) {
      console.log('   ⚠ city_defenses not found');
    }
    
    try {
      await sql`DROP TABLE IF EXISTS city_citizens CASCADE`;
      console.log('   ✓ Dropped city_citizens');
    } catch (e) {
      console.log('   ⚠ city_citizens not found');
    }
    
    console.log('\n📍 Step 2: Creating building_types table...');
    await sql`
      CREATE TABLE building_types (
        id SERIAL PRIMARY KEY,
        building_name VARCHAR(100) NOT NULL UNIQUE,
        building_category VARCHAR(50) NOT NULL,
        description TEXT,
        base_cost_credits INTEGER NOT NULL DEFAULT 0,
        base_cost_materials INTEGER NOT NULL DEFAULT 0,
        base_cost_energy INTEGER NOT NULL DEFAULT 0,
        construction_time_seconds INTEGER NOT NULL DEFAULT 300,
        required_level INTEGER NOT NULL DEFAULT 1,
        required_population INTEGER NOT NULL DEFAULT 0,
        provides_population_capacity INTEGER NOT NULL DEFAULT 0,
        provides_happiness_bonus INTEGER NOT NULL DEFAULT 0,
        provides_defense_bonus INTEGER NOT NULL DEFAULT 0,
        produces_resource_type VARCHAR(50),
        production_rate_per_hour DECIMAL(10,2) DEFAULT 0,
        energy_consumption_per_hour DECIMAL(10,2) DEFAULT 0,
        max_level INTEGER NOT NULL DEFAULT 10,
        image_url TEXT,
        icon_name VARCHAR(100),
        is_unlockable BOOLEAN DEFAULT true,
        unlock_quest_id INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('   ✓ Created building_types table');
    
    console.log('\n📍 Step 3: Creating indexes for building_types...');
    await sql`CREATE INDEX idx_building_types_category ON building_types(building_category)`;
    await sql`CREATE INDEX idx_building_types_level ON building_types(required_level)`;
    console.log('   ✓ Created indexes');
    
    console.log('\n✅ Migration Phase 1 Complete!\n');
    console.log('Now run: node run-riddlecity-migration.js');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runManualMigration();
