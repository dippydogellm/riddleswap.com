import 'dotenv/config';
import { db } from './server/db';
import { sql } from 'drizzle-orm';

(async () => {
  const result = await db.execute(sql`
    SELECT 
      collection_id, 
      COUNT(*) as total, 
      MIN(rarity_rank) as best, 
      MAX(rarity_rank) as worst 
    FROM gaming_nfts 
    WHERE rarity_rank IS NOT NULL 
    GROUP BY collection_id 
    LIMIT 5
  `);
  
  console.log('📊 Sample Collections:\n');
  result.rows.forEach(x => {
    console.log(`  ${x.collection_id}: ${x.total} NFTs, ranks ${x.best}-${x.worst}`);
  });
  
  process.exit(0);
})();
