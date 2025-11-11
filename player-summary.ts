import 'dotenv/config';
import { db } from './server/db';
import { sql } from 'drizzle-orm';

console.log('📊 PLAYER & CIVILIZATION SUMMARY\n');
console.log('='.repeat(70));

(async () => {
  try {
    // Get total stats
    const stats = await db.execute(sql`
      SELECT 
        COUNT(*) as total_civilizations,
        SUM(army_count) as total_army,
        SUM(religion_count) as total_religion,
        SUM(bank_count) as total_bank,
        SUM(merchant_count) as total_merchant,
        SUM(land_count) as total_land,
        SUM(ship_count) as total_ships,
        AVG(total_power) as avg_power,
        MAX(overall_rank) as max_score
      FROM player_civilizations
    `);
    
    const s = stats.rows[0];
    
    console.log('\n🌍 GLOBAL STATISTICS:\n');
    console.log(`   Total Civilizations: ${Number(s.total_civilizations).toLocaleString()}`);
    console.log(`   Total Army Units: ${Number(s.total_army || 0).toLocaleString()}`);
    console.log(`   Total Religious Sites: ${Number(s.total_religion || 0).toLocaleString()}`);
    console.log(`   Total Banks: ${Number(s.total_bank || 0).toLocaleString()}`);
    console.log(`   Total Merchants: ${Number(s.total_merchant || 0).toLocaleString()}`);
    console.log(`   Total Land Plots: ${Number(s.total_land || 0).toLocaleString()}`);
    console.log(`   Total Ships: ${Number(s.total_ships || 0).toLocaleString()}`);
    console.log(`   Average Power: ${Math.round(Number(s.avg_power || 0)).toLocaleString()}`);
    console.log(`   Highest Score: ${Math.round(Number(s.max_score || 0)).toLocaleString()}`);
    
    // Get top 10
    const top10 = await db.execute(sql`
      SELECT 
        wallet_address,
        civilization_name,
        total_power,
        overall_rank,
        army_count,
        religion_count,
        bank_count,
        land_count,
        battle_readiness
      FROM player_civilizations
      ORDER BY overall_rank ASC
      LIMIT 10
    `);
    
    console.log('\n🏆 TOP 10 CIVILIZATIONS:\n');
    top10.rows.forEach((civ, idx) => {
      console.log(`   ${idx + 1}. ${String(civ.wallet_address).substring(0, 14)}...`);
      console.log(`      Score: ${Math.round(Number(civ.overall_rank)).toLocaleString()} | Power: ${Math.round(Number(civ.total_power)).toLocaleString()}`);
      console.log(`      Army: ${civ.army_count} | Religion: ${civ.religion_count} | Bank: ${civ.bank_count} | Land: ${civ.land_count}`);
      console.log(`      Battle Readiness: ${Math.round(Number(civ.battle_readiness)).toLocaleString()}`);
      console.log('');
    });
    
    console.log('='.repeat(70));
    console.log('\n✅ Summary complete!\n');
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
