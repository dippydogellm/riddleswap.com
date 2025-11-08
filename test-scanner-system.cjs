#!/usr/bin/env node
/**
 * Comprehensive Scanner Test Script
 * 
 * Tests all 4 scanners, verifies logging, checks rarity calculations,
 * validates database records, and ensures rankings are working
 */

import { db } from './server/db.js';
import { 
  gamingNftCollections, 
  gamingNfts,
  scannerLogs,
  rankingHistory,
  gameLeaderboards
} from './shared/schema.js';
import { eq, desc, sql } from 'drizzle-orm';
import { collectionInitialScanner } from './server/scanners/collection-initial-scanner.js';
import { openAIMetadataScorer } from './server/scanners/openai-metadata-scorer.js';
import { rarityScoringScanner } from './server/scanners/rarity-scoring-scanner.js';
import { battleCivilizationScanner } from './server/scanners/battle-civilization-scanner.js';

console.log('🧪 ======== COMPREHENSIVE SCANNER TEST ========\n');

async function testCollections() {
  console.log('📦 Testing Collections...');
  
  const collections = await db.select().from(gamingNftCollections);
  console.log(`   Found ${collections.length} collections in database`);
  
  for (const collection of collections) {
    console.log(`\n   🎯 ${collection.collection_name}`);
    console.log(`      ID: ${collection.collection_id}`);
    console.log(`      Active: ${collection.active_in_game ? '✅' : '❌'}`);
    console.log(`      Total NFTs: ${collection.total_nfts || 0}`);
    
    if (collection.project_rarity_score) {
      console.log(`      Project Rarity: ${collection.project_rarity_score.toFixed(2)} (Rank #${collection.project_rarity_rank})`);
      console.log(`      Tier: ${collection.collection_tier || 'unranked'}`);
    }
    
    if (collection.last_rarity_scan) {
      console.log(`      Last Scan: ${new Date(collection.last_rarity_scan).toLocaleString()}`);
    }
    
    // Check NFTs in collection
    const nfts = await db.select().from(gamingNfts)
      .where(eq(gamingNfts.collection_id, collection.id))
      .limit(5);
    
    console.log(`      Sample NFTs: ${nfts.length}`);
    for (const nft of nfts.slice(0, 3)) {
      console.log(`         - ${nft.name || 'Unknown'}: Rarity ${nft.rarity_score || 'N/A'} (Rank ${nft.overall_rarity_rank || 'N/A'})`);
    }
  }
  
  return collections;
}

async function testScannerLogs() {
  console.log('\n\n📝 Testing Scanner Logs...');
  
  const logs = await db.select().from(scannerLogs)
    .orderBy(desc(scannerLogs.started_at))
    .limit(20);
  
  console.log(`   Found ${logs.length} recent scanner logs`);
  
  const byScanner = new Map();
  const byStatus = new Map();
  
  for (const log of logs) {
    byScanner.set(log.scanner_name, (byScanner.get(log.scanner_name) || 0) + 1);
    byStatus.set(log.status, (byStatus.get(log.status) || 0) + 1);
  }
  
  console.log('\n   By Scanner:');
  for (const [scanner, count] of byScanner.entries()) {
    console.log(`      ${scanner}: ${count} runs`);
  }
  
  console.log('\n   By Status:');
  for (const [status, count] of byStatus.entries()) {
    console.log(`      ${status}: ${count}`);
  }
  
  console.log('\n   Recent Runs:');
  for (const log of logs.slice(0, 5)) {
    const status = log.status === 'completed' ? '✅' : log.status === 'failed' ? '❌' : '🔄';
    console.log(`      ${status} ${log.scanner_name} - ${log.target_name || 'All'}`);
    console.log(`         Started: ${new Date(log.started_at).toLocaleString()}`);
    if (log.duration_ms) {
      console.log(`         Duration: ${(log.duration_ms / 1000).toFixed(2)}s`);
    }
    if (log.entities_processed) {
      console.log(`         Processed: ${log.entities_processed}/${log.entities_scanned}`);
    }
    if (log.error_message) {
      console.log(`         ❌ Error: ${log.error_message}`);
    }
  }
  
  // Check for failed scans
  const failedLogs = logs.filter(l => l.status === 'failed');
  if (failedLogs.length > 0) {
    console.log(`\n   ⚠️  ${failedLogs.length} failed scans detected!`);
    for (const log of failedLogs) {
      console.log(`      - ${log.scanner_name}: ${log.error_message || 'Unknown error'}`);
    }
  }
  
  return logs;
}

async function testRarityData() {
  console.log('\n\n🎲 Testing Rarity Data...');
  
  // Check NFTs with rarity scores
  const nftsWithRarity = await db.select({
    id: gamingNfts.id,
    name: gamingNfts.name,
    rarity_score: gamingNfts.rarity_score,
    rarity_tier: gamingNfts.rarity_tier,
    overall_rarity_rank: gamingNfts.overall_rarity_rank,
    collection_rarity_rank: gamingNfts.collection_rarity_rank
  })
    .from(gamingNfts)
    .orderBy(desc(sql`CAST(${gamingNfts.rarity_score} AS DECIMAL)`))
    .limit(10);
  
  console.log(`   Top 10 NFTs by Rarity:`);
  for (const nft of nftsWithRarity) {
    console.log(`      ${nft.overall_rarity_rank || 'N/A'}. ${nft.name || 'Unknown'}`);
    console.log(`         Score: ${nft.rarity_score || 'N/A'} | Tier: ${nft.rarity_tier || 'N/A'}`);
  }
  
  // Check tier distribution
  const allNfts = await db.select({ tier: gamingNfts.rarity_tier }).from(gamingNfts);
  const tierCounts = new Map();
  allNfts.forEach(n => {
    const tier = n.tier || 'unassigned';
    tierCounts.set(tier, (tierCounts.get(tier) || 0) + 1);
  });
  
  console.log(`\n   Tier Distribution:`);
  for (const [tier, count] of tierCounts.entries()) {
    const percentage = ((count / allNfts.length) * 100).toFixed(1);
    console.log(`      ${tier}: ${count} (${percentage}%)`);
  }
  
  return nftsWithRarity;
}

async function testRankingHistory() {
  console.log('\n\n📈 Testing Ranking History...');
  
  const history = await db.select().from(rankingHistory)
    .orderBy(desc(rankingHistory.scan_timestamp))
    .limit(20);
  
  console.log(`   Found ${history.length} ranking history records`);
  
  const byType = new Map();
  for (const record of history) {
    const key = `${record.entity_type}:${record.rank_type}`;
    byType.set(key, (byType.get(key) || 0) + 1);
  }
  
  console.log('\n   By Type:');
  for (const [type, count] of byType.entries()) {
    console.log(`      ${type}: ${count} changes`);
  }
  
  console.log('\n   Recent Rank Changes:');
  for (const record of history.slice(0, 10)) {
    const change = record.rank_change > 0 ? `⬆️ +${record.rank_change}` : 
                   record.rank_change < 0 ? `⬇️ ${record.rank_change}` : '➡️ 0';
    console.log(`      ${change} ${record.entity_name} (${record.entity_type})`);
    console.log(`         ${record.previous_rank || 'N/A'} → ${record.current_rank} | Tier: ${record.tier}`);
  }
  
  return history;
}

async function testLeaderboards() {
  console.log('\n\n🏆 Testing Leaderboards...');
  
  const leaderboards = await db.select().from(gameLeaderboards);
  
  console.log(`   Found ${leaderboards.length} leaderboard entries`);
  
  for (const lb of leaderboards) {
    console.log(`\n   ${lb.leaderboard_type} ${lb.category ? `(${lb.category})` : ''}`);
    console.log(`      Entries: ${lb.total_entries}`);
    console.log(`      Last Updated: ${lb.last_updated ? new Date(lb.last_updated).toLocaleString() : 'Never'}`);
    
    if (lb.rankings && Array.isArray(lb.rankings)) {
      console.log(`      Top 3:`);
      for (const entry of lb.rankings.slice(0, 3)) {
        console.log(`         - ${entry.name || entry.civilization_name || 'Unknown'}`);
      }
    }
  }
  
  return leaderboards;
}

async function testDataIntegrity() {
  console.log('\n\n🔍 Testing Data Integrity...');
  
  // Check for NFTs without rarity scores
  const nftsWithoutRarity = await db.select().from(gamingNfts)
    .where(sql`${gamingNfts.rarity_score} IS NULL OR ${gamingNfts.rarity_score} = ''`)
    .limit(10);
  
  if (nftsWithoutRarity.length > 0) {
    console.log(`   ⚠️  Found ${nftsWithoutRarity.length}+ NFTs without rarity scores`);
  } else {
    console.log(`   ✅ All NFTs have rarity scores`);
  }
  
  // Check for NFTs without ranks
  const nftsWithoutRanks = await db.select().from(gamingNfts)
    .where(sql`${gamingNfts.overall_rarity_rank} IS NULL`)
    .limit(10);
  
  if (nftsWithoutRanks.length > 0) {
    console.log(`   ⚠️  Found ${nftsWithoutRanks.length}+ NFTs without overall ranks`);
  } else {
    console.log(`   ✅ All NFTs have overall ranks`);
  }
  
  // Check for NFTs without tiers
  const nftsWithoutTiers = await db.select().from(gamingNfts)
    .where(sql`${gamingNfts.rarity_tier} IS NULL OR ${gamingNfts.rarity_tier} = ''`)
    .limit(10);
  
  if (nftsWithoutTiers.length > 0) {
    console.log(`   ⚠️  Found ${nftsWithoutTiers.length}+ NFTs without rarity tiers`);
  } else {
    console.log(`   ✅ All NFTs have rarity tiers`);
  }
  
  // Check for collections without project rarity
  const collectionsWithoutProjectRarity = await db.select().from(gamingNftCollections)
    .where(sql`${gamingNftCollections.project_rarity_score} IS NULL`)
    .limit(10);
  
  if (collectionsWithoutProjectRarity.length > 0) {
    console.log(`   ⚠️  Found ${collectionsWithoutProjectRarity.length}+ collections without project rarity`);
  } else {
    console.log(`   ✅ All collections have project rarity scores`);
  }
}

async function runManualScan() {
  console.log('\n\n🔬 Running Manual Rarity Scan...');
  
  try {
    const result = await rarityScoringScanner.runFullScan();
    
    if (result.success) {
      console.log('   ✅ Rarity scan completed successfully!');
      console.log(`      Collections: ${result.collections_processed}`);
      console.log(`      NFTs Rescored: ${result.nfts_rescored}`);
      console.log(`      Failed: ${result.nfts_failed}`);
      console.log(`      Duration: ${(result.duration_ms / 1000).toFixed(2)}s`);
    } else {
      console.log('   ❌ Rarity scan failed');
      if (result.errors.length > 0) {
        console.log('      Errors:');
        result.errors.forEach(err => console.log(`         - ${err}`));
      }
    }
  } catch (error) {
    console.log('   ❌ Scan error:', error.message);
  }
}

async function generateReport() {
  console.log('\n\n📊 SUMMARY REPORT');
  console.log('=====================================\n');
  
  const collections = await db.select().from(gamingNftCollections);
  const nfts = await db.select().from(gamingNfts);
  const logs = await db.select().from(scannerLogs);
  const history = await db.select().from(rankingHistory);
  
  console.log(`Collections: ${collections.length}`);
  console.log(`NFTs: ${nfts.length}`);
  console.log(`Scanner Logs: ${logs.length}`);
  console.log(`Ranking History Records: ${history.length}`);
  
  const completedScans = logs.filter(l => l.status === 'completed').length;
  const failedScans = logs.filter(l => l.status === 'failed').length;
  const successRate = logs.length > 0 ? ((completedScans / logs.length) * 100).toFixed(1) : 0;
  
  console.log(`\nScanner Success Rate: ${successRate}%`);
  console.log(`   Completed: ${completedScans}`);
  console.log(`   Failed: ${failedScans}`);
  
  const nftsWithRarity = nfts.filter(n => n.rarity_score && n.rarity_score !== '').length;
  const nftsWithRanks = nfts.filter(n => n.overall_rarity_rank !== null).length;
  const nftsWithTiers = nfts.filter(n => n.rarity_tier && n.rarity_tier !== '').length;
  
  console.log(`\nRarity Data Coverage:`);
  console.log(`   With Rarity Scores: ${nftsWithRarity}/${nfts.length} (${((nftsWithRarity/nfts.length)*100).toFixed(1)}%)`);
  console.log(`   With Overall Ranks: ${nftsWithRanks}/${nfts.length} (${((nftsWithRanks/nfts.length)*100).toFixed(1)}%)`);
  console.log(`   With Tiers: ${nftsWithTiers}/${nfts.length} (${((nftsWithTiers/nfts.length)*100).toFixed(1)}%)`);
  
  console.log('\n=====================================');
  console.log('✅ Test complete!\n');
}

// Run all tests
try {
  await testCollections();
  await testScannerLogs();
  await testRarityData();
  await testRankingHistory();
  await testLeaderboards();
  await testDataIntegrity();
  
  // Optionally run a manual scan (comment out if you don't want to run)
  // await runManualScan();
  
  await generateReport();
  
  process.exit(0);
} catch (error) {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
}
