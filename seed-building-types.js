#!/usr/bin/env node
import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function seedBuildingTypes() {
  console.log('🌱 Seeding Building Types...\n');

  try {
    const buildings = [
      // RESIDENTIAL
      { name: 'Small House', category: 'residential', desc: 'A cozy home for 2 citizens', cost_credits: 100, cost_materials: 50, time: 300, level: 1, pop: 2, happiness: 5, icon: 'home' },
      { name: 'Apartment Building', category: 'residential', desc: 'Multi-family housing for 10 citizens', cost_credits: 500, cost_materials: 200, time: 900, level: 3, pop: 10, happiness: 3, icon: 'apartment' },
      { name: 'Luxury Villa', category: 'residential', desc: 'Prestigious home for wealthy citizens', cost_credits: 2000, cost_materials: 500, time: 1800, level: 8, pop: 4, happiness: 20, icon: 'villa' },
      
      // COMMERCIAL
      { name: 'Market Stall', category: 'commercial', desc: 'Basic trading post', cost_credits: 200, cost_materials: 100, time: 600, level: 1, pop: 0, happiness: 2, icon: 'store' },
      { name: 'Shopping Center', category: 'commercial', desc: 'Large retail complex', cost_credits: 1000, cost_materials: 400, time: 1200, level: 5, pop: 0, happiness: 10, icon: 'shopping_cart' },
      { name: 'Bank', category: 'commercial', desc: 'Financial institution', cost_credits: 3000, cost_materials: 800, time: 2400, level: 10, pop: 0, happiness: 5, icon: 'account_balance' },
      
      // INDUSTRIAL
      { name: 'Farm', category: 'industrial', desc: 'Produces food', cost_credits: 300, cost_materials: 150, time: 900, level: 1, pop: 0, happiness: 0, icon: 'agriculture' },
      { name: 'Mine', category: 'industrial', desc: 'Extracts materials', cost_credits: 400, cost_materials: 200, time: 1200, level: 3, pop: 0, happiness: -5, icon: 'construction' },
      { name: 'Power Plant', category: 'industrial', desc: 'Generates energy', cost_credits: 1500, cost_materials: 600, time: 1800, level: 6, pop: 0, happiness: -10, icon: 'bolt' },
      
      // MILITARY
      { name: 'Guard Tower', category: 'military', desc: 'Basic defense structure', cost_credits: 250, cost_materials: 150, time: 600, level: 2, pop: 0, happiness: 0, icon: 'shield' },
      { name: 'Barracks', category: 'military', desc: 'Trains soldiers', cost_credits: 800, cost_materials: 400, time: 1500, level: 5, pop: 0, happiness: -5, icon: 'security' },
      { name: 'Fortress', category: 'military', desc: 'Ultimate defensive structure', cost_credits: 5000, cost_materials: 2000, time: 3600, level: 15, pop: 0, happiness: -15, icon: 'castle' },
      
      // CIVIC
      { name: 'City Hall', category: 'civic', desc: 'Administrative center', cost_credits: 1000, cost_materials: 500, time: 2400, level: 1, pop: 0, happiness: 15, icon: 'account_balance' },
      { name: 'Hospital', category: 'civic', desc: 'Healthcare facility', cost_credits: 1500, cost_materials: 700, time: 1800, level: 7, pop: 0, happiness: 20, icon: 'local_hospital' },
      { name: 'School', category: 'civic', desc: 'Education center', cost_credits: 800, cost_materials: 400, time: 1200, level: 4, pop: 0, happiness: 15, icon: 'school' },
      { name: 'Police Station', category: 'civic', desc: 'Law enforcement HQ', cost_credits: 1200, cost_materials: 600, time: 1500, level: 6, pop: 0, happiness: 10, icon: 'local_police' },
      { name: 'Fire Station', category: 'civic', desc: 'Emergency services', cost_credits: 900, cost_materials: 500, time: 1200, level: 5, pop: 0, happiness: 12, icon: 'local_fire_department' },
      
      // SPECIAL
      { name: 'Wonder Monument', category: 'special', desc: 'Iconic city landmark', cost_credits: 10000, cost_materials: 5000, time: 7200, level: 20, pop: 0, happiness: 50, icon: 'emoji_events' },
      { name: 'Research Lab', category: 'special', desc: 'Advanced technology center', cost_credits: 4000, cost_materials: 2000, time: 3600, level: 12, pop: 0, happiness: 10, icon: 'science' },
      { name: 'Sports Stadium', category: 'special', desc: 'Entertainment mega-structure', cost_credits: 6000, cost_materials: 3000, time: 4800, level: 18, pop: 0, happiness: 40, icon: 'stadium' }
    ];

    console.log(`Inserting ${buildings.length} building types...\n`);
    
    for (const b of buildings) {
      await sql`
        INSERT INTO building_types (
          building_name, building_category, description,
          base_cost_credits, base_cost_materials, construction_time_seconds,
          required_level, provides_population_capacity, provides_happiness_bonus, icon_name
        ) VALUES (
          ${b.name}, ${b.category}, ${b.desc},
          ${b.cost_credits}, ${b.cost_materials}, ${b.time},
          ${b.level}, ${b.pop}, ${b.happiness}, ${b.icon}
        )
        ON CONFLICT (building_name) DO NOTHING
      `;
      console.log(`   ✓ ${b.name}`);
    }

    // Update production rates for resource buildings
    console.log('\n📍 Setting production rates...');
    
    await sql`UPDATE building_types SET produces_resource_type = 'food', production_rate_per_hour = 50.00 WHERE building_name = 'Farm'`;
    console.log('   ✓ Farm produces 50 food/hour');
    
    await sql`UPDATE building_types SET produces_resource_type = 'materials', production_rate_per_hour = 30.00, energy_consumption_per_hour = 10.00 WHERE building_name = 'Mine'`;
    console.log('   ✓ Mine produces 30 materials/hour (uses 10 energy)');
    
    await sql`UPDATE building_types SET produces_resource_type = 'energy', production_rate_per_hour = 100.00 WHERE building_name = 'Power Plant'`;
    console.log('   ✓ Power Plant produces 100 energy/hour');
    
    await sql`UPDATE building_types SET produces_resource_type = 'credits', production_rate_per_hour = 75.00 WHERE building_name = 'Shopping Center'`;
    console.log('   ✓ Shopping Center produces 75 credits/hour');
    
    await sql`UPDATE building_types SET produces_resource_type = 'credits', production_rate_per_hour = 25.00 WHERE building_name = 'Market Stall'`;
    console.log('   ✓ Market Stall produces 25 credits/hour');

    // Set defense bonuses
    console.log('\n📍 Setting defense ratings...');
    
    await sql`UPDATE building_types SET provides_defense_bonus = 15 WHERE building_name = 'Guard Tower'`;
    console.log('   ✓ Guard Tower: +15 defense');
    
    await sql`UPDATE building_types SET provides_defense_bonus = 30 WHERE building_name = 'Barracks'`;
    console.log('   ✓ Barracks: +30 defense');
    
    await sql`UPDATE building_types SET provides_defense_bonus = 75 WHERE building_name = 'Fortress'`;
    console.log('   ✓ Fortress: +75 defense');

    console.log('\n✅ Seed data inserted successfully!\n');
    console.log('🎮 RiddleCity database is now complete and ready for gameplay!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

seedBuildingTypes();
