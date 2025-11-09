#!/usr/bin/env node
import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function createRemainingTables() {
  console.log('🚀 Creating Remaining RiddleCity Tables...\n');

  try {
    // Step 2: city_buildings
    console.log('📍 Creating city_buildings table...');
    await sql`
      CREATE TABLE IF NOT EXISTS city_buildings (
        id SERIAL PRIMARY KEY,
        city_id INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
        building_type_id INTEGER NOT NULL REFERENCES building_types(id),
        building_level INTEGER NOT NULL DEFAULT 1,
        position_x INTEGER,
        position_y INTEGER,
        construction_status VARCHAR(50) NOT NULL DEFAULT 'active',
        construction_started_at TIMESTAMP,
        construction_completed_at TIMESTAMP,
        last_collected_at TIMESTAMP,
        total_resources_collected DECIMAL(15,2) DEFAULT 0,
        is_powered BOOLEAN DEFAULT true,
        happiness_impact INTEGER DEFAULT 0,
        defense_contribution INTEGER DEFAULT 0,
        custom_name VARCHAR(100),
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_city_buildings_city ON city_buildings(city_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_city_buildings_status ON city_buildings(construction_status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_city_buildings_type ON city_buildings(building_type_id)`;
    console.log('   ✓ Created city_buildings');

    // Step 3: resource_production_log
    console.log('📍 Creating resource_production_log table...');
    await sql`
      CREATE TABLE IF NOT EXISTS resource_production_log (
        id SERIAL PRIMARY KEY,
        city_id INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
        building_id INTEGER REFERENCES city_buildings(id) ON DELETE SET NULL,
        resource_type VARCHAR(50) NOT NULL,
        amount_produced DECIMAL(15,2) NOT NULL,
        amount_consumed DECIMAL(15,2) DEFAULT 0,
        net_amount DECIMAL(15,2) NOT NULL,
        production_source VARCHAR(100),
        collected_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_resource_log_city ON resource_production_log(city_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_resource_log_type ON resource_production_log(resource_type)`;
    console.log('   ✓ Created resource_production_log');

    // Step 4: city_surveys
    console.log('📍 Creating city_surveys table...');
    await sql`
      CREATE TABLE IF NOT EXISTS city_surveys (
        id SERIAL PRIMARY KEY,
        city_id INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
        survey_type VARCHAR(50) NOT NULL,
        survey_title VARCHAR(200) NOT NULL,
        survey_description TEXT NOT NULL,
        option_a VARCHAR(200) NOT NULL,
        option_b VARCHAR(200) NOT NULL,
        option_c VARCHAR(200),
        option_d VARCHAR(200),
        votes_option_a INTEGER DEFAULT 0,
        votes_option_b INTEGER DEFAULT 0,
        votes_option_c INTEGER DEFAULT 0,
        votes_option_d INTEGER DEFAULT 0,
        total_votes INTEGER DEFAULT 0,
        winning_option VARCHAR(10),
        survey_status VARCHAR(50) NOT NULL DEFAULT 'active',
        started_at TIMESTAMP DEFAULT NOW(),
        closes_at TIMESTAMP NOT NULL,
        closed_at TIMESTAMP,
        implemented_at TIMESTAMP,
        created_by_handle VARCHAR(100),
        minimum_votes_required INTEGER DEFAULT 10,
        happiness_impact INTEGER DEFAULT 0,
        credits_cost INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_surveys_city ON city_surveys(city_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_surveys_status ON city_surveys(survey_status)`;
    console.log('   ✓ Created city_surveys');

    // Step 5: city_citizens (needed for survey_votes foreign key)
    console.log('📍 Creating city_citizens table...');
    await sql`
      CREATE TABLE IF NOT EXISTS city_citizens (
        id SERIAL PRIMARY KEY,
        city_id INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
        citizen_name VARCHAR(200) NOT NULL,
        citizen_type VARCHAR(50) NOT NULL DEFAULT 'resident',
        profession VARCHAR(100),
        profession_level INTEGER DEFAULT 1,
        age INTEGER DEFAULT 25,
        gender VARCHAR(20) DEFAULT 'other',
        happiness_score INTEGER DEFAULT 50,
        health_score INTEGER DEFAULT 100,
        loyalty_score INTEGER DEFAULT 50,
        skill_strength INTEGER DEFAULT 50,
        skill_intelligence INTEGER DEFAULT 50,
        skill_charisma INTEGER DEFAULT 50,
        skill_craftsmanship INTEGER DEFAULT 50,
        skill_farming INTEGER DEFAULT 50,
        skill_combat INTEGER DEFAULT 50,
        credits_earned_total DECIMAL(15,2) DEFAULT 0,
        resources_produced_total DECIMAL(15,2) DEFAULT 0,
        votes_cast INTEGER DEFAULT 0,
        policies_proposed INTEGER DEFAULT 0,
        home_building_id INTEGER REFERENCES city_buildings(id),
        workplace_building_id INTEGER REFERENCES city_buildings(id),
        is_active BOOLEAN DEFAULT true,
        is_employed BOOLEAN DEFAULT false,
        employment_status VARCHAR(50) DEFAULT 'unemployed',
        family_members TEXT[],
        faction_alignment VARCHAR(100),
        arrived_at TIMESTAMP DEFAULT NOW(),
        last_active_at TIMESTAMP DEFAULT NOW(),
        left_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_citizens_city ON city_citizens(city_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_citizens_active ON city_citizens(is_active)`;
    console.log('   ✓ Created city_citizens');

    // Step 6: survey_votes
    console.log('📍 Creating survey_votes table...');
    await sql`
      CREATE TABLE IF NOT EXISTS survey_votes (
        id SERIAL PRIMARY KEY,
        survey_id INTEGER NOT NULL REFERENCES city_surveys(id) ON DELETE CASCADE,
        citizen_id INTEGER NOT NULL REFERENCES city_citizens(id) ON DELETE CASCADE,
        vote_option VARCHAR(10) NOT NULL,
        vote_weight INTEGER DEFAULT 1,
        vote_reason TEXT,
        voted_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(survey_id, citizen_id)
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_survey_votes_survey ON survey_votes(survey_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_survey_votes_citizen ON survey_votes(citizen_id)`;
    console.log('   ✓ Created survey_votes');

    // Step 7: city_policies
    console.log('📍 Creating city_policies table...');
    await sql`
      CREATE TABLE IF NOT EXISTS city_policies (
        id SERIAL PRIMARY KEY,
        city_id INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
        policy_name VARCHAR(200) NOT NULL,
        policy_description TEXT NOT NULL,
        policy_type VARCHAR(50) NOT NULL,
        policy_category VARCHAR(50),
        effect_happiness INTEGER DEFAULT 0,
        effect_credits_per_hour DECIMAL(10,2) DEFAULT 0,
        effect_energy_per_hour DECIMAL(10,2) DEFAULT 0,
        effect_food_per_hour DECIMAL(10,2) DEFAULT 0,
        effect_materials_per_hour DECIMAL(10,2) DEFAULT 0,
        effect_population_capacity INTEGER DEFAULT 0,
        effect_defense_rating INTEGER DEFAULT 0,
        implementation_cost_credits INTEGER DEFAULT 0,
        maintenance_cost_credits_per_day DECIMAL(10,2) DEFAULT 0,
        required_level INTEGER DEFAULT 1,
        required_building_type VARCHAR(100),
        is_active BOOLEAN DEFAULT false,
        enacted_at TIMESTAMP,
        repealed_at TIMESTAMP,
        enacted_by_handle VARCHAR(100),
        survey_id INTEGER REFERENCES city_surveys(id),
        popularity_rating INTEGER DEFAULT 50,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_policies_city ON city_policies(city_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_policies_active ON city_policies(is_active)`;
    console.log('   ✓ Created city_policies');

    // Step 8: city_defenses
    console.log('📍 Creating city_defenses table...');
    await sql`
      CREATE TABLE IF NOT EXISTS city_defenses (
        id SERIAL PRIMARY KEY,
        city_id INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
        defense_type VARCHAR(100) NOT NULL,
        defense_name VARCHAR(200),
        defense_level INTEGER NOT NULL DEFAULT 1,
        defense_rating_contribution INTEGER NOT NULL DEFAULT 10,
        position_x INTEGER,
        position_y INTEGER,
        construction_status VARCHAR(50) NOT NULL DEFAULT 'active',
        health_percentage INTEGER DEFAULT 100,
        max_health INTEGER DEFAULT 1000,
        current_health INTEGER DEFAULT 1000,
        attack_power INTEGER DEFAULT 0,
        defense_power INTEGER DEFAULT 0,
        range_tiles INTEGER DEFAULT 5,
        garrison_capacity INTEGER DEFAULT 0,
        current_garrison INTEGER DEFAULT 0,
        maintenance_cost_per_day DECIMAL(10,2) DEFAULT 10,
        constructed_at TIMESTAMP DEFAULT NOW(),
        last_repaired_at TIMESTAMP,
        last_attacked_at TIMESTAMP,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_defenses_city ON city_defenses(city_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_defenses_status ON city_defenses(construction_status)`;
    console.log('   ✓ Created city_defenses');

    // Step 9: Update cities table
    console.log('\n📍 Updating cities table...');
    await sql`ALTER TABLE cities ADD COLUMN IF NOT EXISTS city_image TEXT`;
    await sql`ALTER TABLE cities ADD COLUMN IF NOT EXISTS linked_project_id VARCHAR(200)`;
    await sql`ALTER TABLE cities ADD COLUMN IF NOT EXISTS contribute_to_project BOOLEAN DEFAULT false`;
    console.log('   ✓ Updated cities table');

    console.log('\n✅ All tables created successfully!\n');
    console.log('Now run: node seed-building-types.js');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

createRemainingTables();
