import 'dotenv/config';
import { db } from './server/db';
import { sql } from 'drizzle-orm';

(async () => {
  const civs = await db.execute(sql`SELECT COUNT(*) as total FROM player_civilizations`);
  console.log('✅ Civilizations:', civs.rows[0].total);
  
  const players = await db.execute(sql`SELECT COUNT(*) as total FROM gaming_players`);
  console.log('✅ Players:', players.rows[0].total);
  
  const nfts = await db.execute(sql`SELECT COUNT(DISTINCT owner_address) as owners FROM gaming_nfts WHERE owner_address IS NOT NULL`);
  console.log('✅ Unique NFT Owners:', nfts.rows[0].owners);
  
  process.exit(0);
})();
