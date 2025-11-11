import dotenv from 'dotenv';
dotenv.config();

import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function checkMigrationStatus() {
  console.log('\n🔍 Checking Migration Status...\n');
  
  try {
    // Check if overall_score column exists
    const result = await db.execute(sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'gaming_players' 
      AND column_name = 'overall_score'
    `);
    
    if (result.rows.length > 0) {
      const col = result.rows[0] as any;
      console.log('✅ overall_score column EXISTS');
      console.log(`   Type: ${col.data_type}`);
      console.log(`   Nullable: ${col.is_nullable}`);
      
      // Check if there's data
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total, 
               COUNT(overall_score) as with_score,
               MAX(overall_score) as max_score
        FROM gaming_players
      `);
      
      const stats = countResult.rows[0] as any;
      console.log(`\n📊 Data Status:`);
      console.log(`   Total players: ${stats.total}`);
      console.log(`   Players with score: ${stats.with_score}`);
      console.log(`   Max score: ${stats.max_score || 0}`);
      
      if (Number(stats.with_score) > 0) {
        console.log('\n✅ MIGRATION COMPLETE - Data exists!');
        console.log('👉 Ready to run: npm run scan:players');
      } else {
        console.log('\n⚠️  Column exists but no scores yet');
        console.log('👉 Ready to run: npm run scan:players');
      }
    } else {
      console.log('❌ overall_score column DOES NOT EXIST');
      console.log('👉 Need to run: npm run db:push');
    }
    
  } catch (error: any) {
    console.error('❌ Error checking status:', error.message);
    console.log('\n💡 If you see "column does not exist", run: npm run db:push');
  }
  
  process.exit(0);
}

checkMigrationStatus();
