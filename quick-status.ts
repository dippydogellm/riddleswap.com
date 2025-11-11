import 'dotenv/config';
import { db } from './server/db';
import { sql } from 'drizzle-orm';

console.log('🔍 Quick Database Status Check\n');

(async () => {
  try {
    // Check key tables
    const checks = [
      { name: 'gaming_nfts', query: 'SELECT COUNT(*) as count FROM gaming_nfts' },
      { name: 'gaming_nft_collections', query: 'SELECT COUNT(*) as count FROM gaming_nft_collections' },
      { name: 'gaming_players', query: 'SELECT COUNT(*) as count FROM gaming_players' },
      { name: 'player_civilizations', query: 'SELECT COUNT(*) as count FROM player_civilizations' },
      { name: 'riddle_wallets', query: 'SELECT COUNT(*) as count FROM riddle_wallets' },
      { name: 'tokens', query: 'SELECT COUNT(*) as count FROM tokens' },
    ];

    for (const check of checks) {
      try {
        const result = await db.execute(sql.raw(check.query));
        console.log(`✅ ${check.name}: ${result.rows[0].count} rows`);
      } catch (error: any) {
        console.log(`❌ ${check.name}: ${error.message}`);
      }
    }

    console.log('\n✅ Database check complete!');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
