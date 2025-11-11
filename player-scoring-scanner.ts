/**
 * Player Scoring Scanner
 * 
 * Comprehensive player scoring system that:
 * - Scans all gaming NFT owners hourly
 * - Aggregates player data (NFTs, power, activity, social profiles)
 * - Generates player scorecards for ranking
 * - Creates leaderboard data for display/Twitter posting
 * 
 * This runs as a scheduled job to keep player scores current.
 */

import dotenv from 'dotenv';
dotenv.config();

import { db } from './server/db';
import { eq, desc, sql, and, or, isNotNull, inArray } from 'drizzle-orm';
import { 
  gamingPlayers, 
  gamingNfts, 
  gamingNftCollections,
  nftPowerAttributes,
  socialProfiles,
  riddleWallets
} from './shared/schema';
import { inquisitionUserOwnership, inquisitionNftAudit } from './shared/inquisition-audit-schema';

interface PlayerScore {
  user_handle: string;
  player_name: string;
  twitter_handle?: string;
  riddle_profile_url: string;
  // Wallet linkage
  primary_wallet_address?: string;
  wallet_addresses?: string[];
  
  // NFT Stats
  total_nfts: number;
  unique_collections: number;
  rarest_nft_rank?: number;
  
  // Power Stats
  total_power: number;
  army_power: number;
  religion_power: number;
  civilization_power: number;
  economic_power: number;
  
  // Activity Stats
  account_age_days: number;
  last_active?: Date;
  
  // Social Presence
  has_twitter: boolean;
  has_social_profile: boolean;
  
  // Computed Score
  overall_score: number;
  rank?: number;
  
  // Metadata
  scored_at: Date;
}

interface LeaderboardEntry extends PlayerScore {
  rank: number;
  rank_change?: number; // Compared to previous leaderboard
  badge?: 'top_collector' | 'power_player' | 'rising_star' | 'veteran';
}

async function main() {
  const startTime = Date.now();
  console.log(`\n🏆 [PLAYER SCORING] ===== STARTING COMPREHENSIVE PLAYER SCAN =====`);
  console.log(`   Started at: ${new Date().toISOString()}\n`);

  try {
    // STEP 1: Get all unique NFT owners from inquisition_user_ownership
    console.log(`📊 [STEP 1] Fetching all active NFT owners...`);
    
    const activeOwners = await db
      .select({
        user_handle: inquisitionUserOwnership.user_handle,
        wallet_address: inquisitionUserOwnership.wallet_address,
        nft_count: sql<number>`count(*)`.as('nft_count')
      })
      .from(inquisitionUserOwnership)
      .where(eq(inquisitionUserOwnership.is_current_owner, true))
      .groupBy(inquisitionUserOwnership.user_handle, inquisitionUserOwnership.wallet_address);
    
    console.log(`   ✅ Found ${activeOwners.length} active NFT owners`);

    // Build wallet-address -> handle map from riddle wallets
    const walletRecords = await db
      .select({
        handle: riddleWallets.handle,
        linked: riddleWallets.linkedWalletAddress,
        eth: riddleWallets.ethAddress,
        xrp: riddleWallets.xrpAddress,
        sol: riddleWallets.solAddress,
        btc: riddleWallets.btcAddress,
      })
      .from(riddleWallets);

    const addressToHandle = new Map<string, string>();
    for (const w of walletRecords) {
      [w.linked, w.eth, w.xrp, w.sol, w.btc]
        .filter((a): a is string => !!a)
        .forEach(addr => addressToHandle.set(addr, w.handle));
    }

    // Group by resolved handle and collect all wallet addresses per handle
    const handleToAddresses = new Map<string, Set<string>>();
    for (const row of activeOwners) {
      const addr = row.wallet_address || '';
      const resolved = row.user_handle || (addr ? addressToHandle.get(addr) || null : null);
      let handle: string;
      if (resolved) {
        handle = resolved;
      } else {
        // Fallback synthetic handle for unmatched wallets
        const short = addr ? `${addr.slice(0,6)}…${addr.slice(-4)}` : 'unknown';
        handle = `wallet:${short}`;
      }

      if (!handleToAddresses.has(handle)) handleToAddresses.set(handle, new Set<string>());
      if (addr) handleToAddresses.get(handle)!.add(addr);
    }

    const participants = Array.from(handleToAddresses.entries()).map(([handle, addrs]) => ({
      handle,
      addresses: Array.from(addrs)
    }));

    console.log(`   📋 Unique players (handles incl. wallet-only): ${participants.length}\n`);
    
    if (participants.length === 0) {
      console.log(`⚠️  No players found with NFTs. Exiting.`);
      process.exit(0);
    }

    // STEP 2: Score each player
    console.log(`🎯 [STEP 2] Calculating scores for ${participants.length} players...\n`);
    
    const playerScores: PlayerScore[] = [];
    
    for (const p of participants) {
      try {
        const score = await calculatePlayerScore(p.handle, p.addresses);
        playerScores.push(score);
        
        if (playerScores.length % 10 === 0) {
          console.log(`   Processed ${playerScores.length}/${participants.length} players...`);
        }
      } catch (error: any) {
        console.error(`   ❌ Failed to score player ${p.handle}:`, error.message);
        continue;
      }
    }
    
    console.log(`\n   ✅ Scored ${playerScores.length} players\n`);
    
    // STEP 3: Rank players and assign badges
    console.log(`🏅 [STEP 3] Ranking players and assigning badges...\n`);
    
    const leaderboard = generateLeaderboard(playerScores);
    
    // STEP 4: Update database with scores
    console.log(`💾 [STEP 4] Updating player scores in database...\n`);
    
    await updatePlayerScores(leaderboard);
    
    // STEP 5: Display summary
    const duration = Date.now() - startTime;
    console.log(`\n✅ [COMPLETE] Player scoring finished!`);
    console.log(`   Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log(`   Players scored: ${playerScores.length}`);
    console.log(`\n📊 TOP 10 LEADERBOARD:`);
    console.log(`${'='.repeat(80)}\n`);
    
    leaderboard.slice(0, 10).forEach(entry => {
      const twitterTag = entry.twitter_handle ? `@${entry.twitter_handle}` : 'no twitter';
      const badge = entry.badge ? `[${entry.badge.toUpperCase()}]` : '';
      console.log(`   ${entry.rank}. ${entry.player_name} (${twitterTag}) ${badge}`);
      console.log(`      Power: ${entry.total_power.toLocaleString()} | NFTs: ${entry.total_nfts} | Score: ${entry.overall_score.toFixed(0)}`);
      console.log(`      ${entry.riddle_profile_url}\n`);
    });
    
    console.log(`${'='.repeat(80)}\n`);
    
    // Success exit
    process.exit(0);
    
  } catch (error: any) {
    console.error(`\n❌ [ERROR] Player scoring failed:`, error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

/**
 * Calculate comprehensive score for a single player
 */
async function calculatePlayerScore(userHandle: string, walletAddresses: string[] = []): Promise<PlayerScore> {
  // Get player record
  const player = await db.query.gamingPlayers.findFirst({
    where: eq(gamingPlayers.user_handle, userHandle)
  });
  
  // Get Riddle wallet for profile URL and creation date
  const riddleWallet = await db.query.riddleWallets.findFirst({
    where: eq(riddleWallets.handle, userHandle)
  });
  
  // Get social profile (using handle field, not user_handle)
  const socialProfile = await db.query.socialProfiles.findFirst({
    where: eq(socialProfiles.handle, userHandle)
  });
  
  // Prepare wallet address set for lookups
  const walletAddrSet = new Set<string>(walletAddresses.filter(Boolean));
  if (riddleWallet?.linkedWalletAddress) walletAddrSet.add(riddleWallet.linkedWalletAddress);
  if (riddleWallet?.xrpAddress) walletAddrSet.add(riddleWallet.xrpAddress);
  if (riddleWallet?.ethAddress) walletAddrSet.add(riddleWallet.ethAddress);
  if (riddleWallet?.solAddress) walletAddrSet.add(riddleWallet.solAddress);
  if (riddleWallet?.btcAddress) walletAddrSet.add(riddleWallet.btcAddress);

  const walletAddrArray = Array.from(walletAddrSet);

  // Get all owned NFTs with their power attributes
  const ownedNfts = await db
    .select({
      nft_id: inquisitionUserOwnership.nft_token_id,
      collection_id: gamingNfts.collection_id,
      rarity_rank: gamingNfts.rarity_rank,
      army_power: nftPowerAttributes.army_power,
      religion_power: nftPowerAttributes.religion_power,
      civilization_power: nftPowerAttributes.civilization_power,
      economic_power: nftPowerAttributes.economic_power,
      total_power: nftPowerAttributes.total_power
    })
    .from(inquisitionUserOwnership)
    .leftJoin(gamingNfts, eq(gamingNfts.token_id, inquisitionUserOwnership.nft_token_id))
    .leftJoin(nftPowerAttributes, eq(nftPowerAttributes.nft_id, gamingNfts.id))
    .where(and(
      eq(inquisitionUserOwnership.is_current_owner, true),
      (walletAddrArray.length > 0
        ? or(
            eq(inquisitionUserOwnership.user_handle, userHandle),
            inArray(inquisitionUserOwnership.wallet_address, walletAddrArray)
          )
        : eq(inquisitionUserOwnership.user_handle, userHandle))
    ));
  
  // Aggregate stats
  const totalNfts = ownedNfts.length;
  const uniqueCollections = new Set(ownedNfts.map(n => n.collection_id).filter(c => c)).size;
  const rarestRank = ownedNfts
    .map(n => n.rarity_rank)
    .filter(r => r !== null)
    .sort((a, b) => (a || 0) - (b || 0))[0];
  
  // Power totals (convert to number, handle string|number types)
  const totalPower = ownedNfts.reduce((sum, nft) => {
    const power = typeof nft.total_power === 'string' ? parseFloat(nft.total_power) : nft.total_power;
    return sum + (power || 0);
  }, 0);
  const armyPower = ownedNfts.reduce((sum, nft) => {
    const power = typeof nft.army_power === 'string' ? parseFloat(nft.army_power) : nft.army_power;
    return sum + (power || 0);
  }, 0);
  const religionPower = ownedNfts.reduce((sum, nft) => {
    const power = typeof nft.religion_power === 'string' ? parseFloat(nft.religion_power) : nft.religion_power;
    return sum + (power || 0);
  }, 0);
  const civilizationPower = ownedNfts.reduce((sum, nft) => {
    const power = typeof nft.civilization_power === 'string' ? parseFloat(nft.civilization_power) : nft.civilization_power;
    return sum + (power || 0);
  }, 0);
  const economicPower = ownedNfts.reduce((sum, nft) => {
    const power = typeof nft.economic_power === 'string' ? parseFloat(nft.economic_power) : nft.economic_power;
    return sum + (power || 0);
  }, 0);
  
  // Account age (use createdAt field, not created_at)
  const accountCreated = riddleWallet?.createdAt || player?.created_at || new Date();
  const accountAgeDays = Math.floor((Date.now() - accountCreated.getTime()) / (1000 * 60 * 60 * 24));
  
  // Calculate overall score (weighted formula)
  const overallScore = calculateOverallScore({
    totalNfts,
    uniqueCollections,
    totalPower,
    accountAgeDays,
    rarestRank: rarestRank || 9999,
    hasSocialProfile: !!socialProfile
  });
  
  // Determine primary wallet address preference
  const primaryWallet = riddleWallet?.linkedWalletAddress
    || riddleWallet?.xrpAddress
    || riddleWallet?.ethAddress
    || riddleWallet?.solAddress
    || riddleWallet?.btcAddress
    || walletAddrArray[0];

  return {
    user_handle: userHandle,
    player_name: player?.player_name || userHandle,
    twitter_handle: socialProfile?.twitterUsername || undefined, // Use twitterUsername field
    riddle_profile_url: `https://riddleswap.com/@${userHandle}`,
    primary_wallet_address: primaryWallet,
    wallet_addresses: walletAddrArray,
    
    total_nfts: totalNfts,
    unique_collections: uniqueCollections,
    rarest_nft_rank: rarestRank || undefined,
    
    total_power: totalPower,
    army_power: armyPower,
    religion_power: religionPower,
    civilization_power: civilizationPower,
    economic_power: economicPower,
    
    account_age_days: accountAgeDays,
    last_active: player?.last_active || undefined,
    
    has_twitter: !!socialProfile?.twitterUsername, // Use twitterUsername field
    has_social_profile: !!socialProfile,
    
    overall_score: overallScore,
    scored_at: new Date()
  };
}

/**
 * Calculate weighted overall score
 */
function calculateOverallScore(stats: {
  totalNfts: number;
  uniqueCollections: number;
  totalPower: number;
  accountAgeDays: number;
  rarestRank: number;
  hasSocialProfile: boolean;
}): number {
  // Weighted scoring formula
  let score = 0;
  
  // NFT quantity (max 1000 points)
  score += Math.min(stats.totalNfts * 10, 1000);
  
  // Collection diversity (max 500 points)
  score += Math.min(stats.uniqueCollections * 50, 500);
  
  // Total power (max 2000 points)
  score += Math.min(stats.totalPower / 10, 2000);
  
  // Rarity bonus (inverse of rank - lower rank = higher score, max 500 points)
  if (stats.rarestRank < 9999) {
    score += Math.max(500 - stats.rarestRank, 0);
  }
  
  // Veteran bonus (max 300 points)
  score += Math.min(stats.accountAgeDays * 2, 300);
  
  // Social presence bonus (100 points)
  if (stats.hasSocialProfile) {
    score += 100;
  }
  
  return score;
}

/**
 * Generate ranked leaderboard with badges
 */
function generateLeaderboard(scores: PlayerScore[]): LeaderboardEntry[] {
  // Sort by overall score descending
  const sorted = [...scores].sort((a, b) => b.overall_score - a.overall_score);
  
  // Assign ranks and badges
  const leaderboard: LeaderboardEntry[] = sorted.map((score, index) => {
    const rank = index + 1;
    let badge: LeaderboardEntry['badge'] = undefined;
    
    // Assign badges based on criteria
    if (rank <= 3) {
      badge = 'top_collector';
    } else if (score.total_power > 10000) {
      badge = 'power_player';
    } else if (score.account_age_days > 365) {
      badge = 'veteran';
    } else if (score.total_nfts >= 50 && score.account_age_days < 90) {
      badge = 'rising_star';
    }
    
    return {
      ...score,
      rank,
      badge
    };
  });
  
  return leaderboard;
}

/**
 * Update player scores in database
 */
async function updatePlayerScores(leaderboard: LeaderboardEntry[]): Promise<void> {
  let updated = 0;
  
  // Only persist scores for real Riddle handles
  const walletHandlesRows = await db
    .select({ handle: riddleWallets.handle })
    .from(riddleWallets);
  const validHandles = new Set<string>(walletHandlesRows.map(r => r.handle));
  
  for (const entry of leaderboard) {
    try {
      // Skip synthetic wallet-only identities and unknown handles
      if (!validHandles.has(entry.user_handle)) {
        continue;
      }

      // Upsert by user_handle to ensure a single record per handle
      await (db.insert(gamingPlayers).values({
        user_handle: entry.user_handle,
        player_name: entry.player_name,
        wallet_address: entry.primary_wallet_address || '',
        chain: 'xrpl',
        total_power_level: entry.total_power,
        army_power: entry.army_power,
        religion_power: entry.religion_power,
        civilization_power: entry.civilization_power,
        economic_power: entry.economic_power,
        total_nfts_owned: entry.total_nfts,
        overall_score: Math.round(entry.overall_score),
        gaming_rank: getRankTitle(entry.rank),
        created_at: new Date(),
        updated_at: new Date()
      } as any) as any)
      .onConflictDoUpdate?.({
        target: gamingPlayers.user_handle as any,
        set: {
          player_name: entry.player_name,
          wallet_address: entry.primary_wallet_address || '',
          total_power_level: entry.total_power as any,
          army_power: entry.army_power as any,
          religion_power: entry.religion_power as any,
          civilization_power: entry.civilization_power as any,
          economic_power: entry.economic_power as any,
          total_nfts_owned: entry.total_nfts,
          overall_score: Math.round(entry.overall_score),
          gaming_rank: getRankTitle(entry.rank),
          updated_at: new Date()
        } as any
      });
      updated++;
    } catch (error: any) {
      console.error(`   ❌ Failed to update player ${entry.user_handle}:`, error.message);
    }
  }
  
  console.log(`   ✅ Updated ${updated}/${leaderboard.length} player records`);
}

/**
 * Get rank title based on position
 */
function getRankTitle(rank: number): string {
  if (rank === 1) return 'Champion';
  if (rank <= 3) return 'Legend';
  if (rank <= 10) return 'Master';
  if (rank <= 25) return 'Expert';
  if (rank <= 50) return 'Veteran';
  if (rank <= 100) return 'Elite';
  return 'Adventurer';
}

// Run the scanner
main();
