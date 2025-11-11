import 'dotenv/config';
import { db } from './server/db';
import { sql } from 'drizzle-orm';

(async () => {
  console.log('📊 Checking Gaming NFTs Data...\n');
  
  const sample = await db.execute(sql`
    SELECT id, name, owner_address, collection_id, game_role, rarity_rank
    FROM gaming_nfts 
    LIMIT 3
  `);
  
  console.log('Sample NFTs:');
  sample.rows.forEach((nft, idx) => {
    console.log(`\n${idx + 1}. ${nft.name || 'Unnamed'}`);
    console.log(`   Owner: ${nft.owner_address || 'No owner'}`);
    console.log(`   Role: ${nft.game_role || 'No role'}`);
    console.log(`   Rank: ${nft.rarity_rank || 'Not ranked'}`);
  });
  
  const ownerCount = await db.execute(sql`
    SELECT COUNT(DISTINCT owner_address) as count
    FROM gaming_nfts
    WHERE owner_address IS NOT NULL AND owner_address != ''
  `);
  
  console.log(`\n📊 Unique owners: ${ownerCount.rows[0].count}`);
  
  process.exit(0);
})();
