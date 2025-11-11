import { db } from '../server/db';
import { gamingPlayers, riddleWallets } from '../shared/schema';
import { sql, desc, notLike } from 'drizzle-orm';

async function testLeaderboard() {
  console.log('\n🧪 Testing Leaderboard & Score Persistence\n');

  // 1. Check if overall_score field exists and has data
  console.log('1️⃣ Checking overall_score field...');
  const scoreCheck = await db.execute(sql`
    SELECT COUNT(*) as total, 
           COUNT(overall_score) as with_score,
           MAX(overall_score) as max_score,
           MIN(overall_score) as min_score
    FROM gaming_players;
  `);
  console.log('   Score field stats:', scoreCheck.rows[0]);

  // 2. Get all riddle_wallets handles
  console.log('\n2️⃣ Fetching all riddle wallet handles...');
  const riddleHandles = await db
    .select({ handle: riddleWallets.handle })
    .from(riddleWallets);
  console.log(`   Total riddle handles: ${riddleHandles.length}`);

  // 3. Check how many players are actual riddle handles vs synthetic wallets
  console.log('\n3️⃣ Analyzing player types...');
  const playerTypes = await db.execute(sql`
    SELECT 
      COUNT(*) FILTER (WHERE user_handle LIKE 'wallet:%') as synthetic_wallets,
      COUNT(*) FILTER (WHERE user_handle NOT LIKE 'wallet:%') as riddle_handles,
      COUNT(*) as total
    FROM gaming_players;
  `);
  console.log('   Player types:', playerTypes.rows[0]);

  // 4. Get top 10 leaderboard (only riddle handles)
  console.log('\n4️⃣ Top 10 Leaderboard (Riddle Handles Only)...');
  const leaderboard = await db
    .select({
      rank: sql<number>`ROW_NUMBER() OVER (ORDER BY overall_score DESC, total_power_level DESC)`.as('rank'),
      user_handle: gamingPlayers.user_handle,
      player_name: gamingPlayers.player_name,
      total_nfts: gamingPlayers.total_nfts_owned,
      total_power: gamingPlayers.total_power_level,
      overall_score: gamingPlayers.overall_score,
      gaming_rank: gamingPlayers.gaming_rank
    })
    .from(gamingPlayers)
    .where(notLike(gamingPlayers.user_handle, 'wallet:%'))
    .orderBy(desc(gamingPlayers.overall_score), desc(gamingPlayers.total_power_level))
    .limit(10);

  leaderboard.forEach((p, i) => {
    console.log(`   ${i + 1}. ${p.user_handle} - Score: ${p.overall_score} | Power: ${p.total_power} | NFTs: ${p.total_nfts} | Rank: ${p.gaming_rank}`);
  });

  // 5. Check for any synthetic wallet entries that shouldn't be there
  console.log('\n5️⃣ Checking for synthetic wallet entries...');
  const syntheticCount = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(gamingPlayers)
    .where(sql`${gamingPlayers.user_handle} LIKE 'wallet:%'`);
  console.log(`   Synthetic wallet entries: ${syntheticCount[0]?.count || 0}`);

  if (Number(syntheticCount[0]?.count || 0) > 0) {
    const samples = await db
      .select({
        handle: gamingPlayers.user_handle,
        nfts: gamingPlayers.total_nfts_owned,
        power: gamingPlayers.total_power_level
      })
      .from(gamingPlayers)
      .where(sql`${gamingPlayers.user_handle} LIKE 'wallet:%'`)
      .limit(5);
    console.log('   Sample synthetic entries:', samples);
  }

  console.log('\n✅ Test complete');
  process.exit(0);
}

testLeaderboard().catch((e) => {
  console.error('❌ Test failed:', e);
  process.exit(1);
});
