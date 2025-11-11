import 'dotenv/config';
import { db } from './server/db';
import { sql } from 'drizzle-orm';

console.log('🚀 FAST NFT SCANNER - Optimized Version\n');

async function fastScan() {
  try {
    console.log('1️⃣  Updating rarity ranks using SQL...');
    const start = Date.now();
    
    // Update all rarity ranks in one SQL query
    await db.execute(sql`
      UPDATE gaming_nfts
      SET rarity_rank = subquery.rank
      FROM (
        SELECT 
          id,
          ROW_NUMBER() OVER (
            PARTITION BY collection_id 
            ORDER BY rarity_score DESC
          ) as rank
        FROM gaming_nfts
        WHERE collection_id IS NOT NULL
      ) AS subquery
      WHERE gaming_nfts.id = subquery.id
    `);
    
    const elapsed = Date.now() - start;
    console.log(`✅ Updated all rarity ranks in ${(elapsed/1000).toFixed(2)}s\n`);
    
    // Get counts
    const stats = await db.execute(sql`
      SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT collection_id) as collections
      FROM gaming_nfts
      WHERE rarity_rank IS NOT NULL
    `);
    
    console.log('📊 Results:');
    console.log(`   Collections: ${stats.rows[0].collections}`);
    console.log(`   NFTs ranked: ${stats.rows[0].total}`);
    
    console.log('\n✅ Fast scan complete!');
    process.exit(0);
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fastScan();
