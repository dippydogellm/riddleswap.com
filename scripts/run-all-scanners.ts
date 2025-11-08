/**
 * RUN ALL SCANNERS - Populate NFT Database
 * 
 * This script runs all scanners to populate the database with:
 * - NFT power attributes (army, religion, civilization, economic)
 * - Civilization scores and classifications
 * - Rarity scores
 * - Theme analysis
 * - Complete NFT metadata
 */

import { db } from '../server/db';
import { gamingNfts, nftPowerAttributes } from '../shared/schema';
import { eq } from 'drizzle-orm';

console.log('🚀 Starting Comprehensive NFT Scanner System');
console.log('═'.repeat(60));

async function runComprehensiveScanner() {
  try {
    console.log('\n📊 Step 1: Scanning all collections...');
    
    // Import scanner functions
    const { scanAllCollections } = await import('../server/comprehensive-nft-scanner');
    
    console.log('🔍 Fetching NFTs from XRPL and analyzing with OpenAI...');
    const results = await scanAllCollections();
    
    console.log(`\n✅ Scanner completed successfully!`);
    console.log(`   - Collections scanned: ${results.collections_scanned}`);
    console.log(`   - Total NFTs found: ${results.total_nfts_found}`);
    console.log(`   - Errors: ${results.errors.length}`);
    
    // Verify data in database
    console.log('\n📋 Verifying database population...');
    const nftCount = await db.select().from(gamingNfts);
    const powerCount = await db.select().from(nftPowerAttributes);
    
    console.log(`   - Gaming NFTs: ${nftCount.length}`);
    console.log(`   - Power Attributes: ${powerCount.length}`);
    
    // Sample data check
    if (powerCount.length > 0) {
      const sample = powerCount[0];
      console.log('\n🎯 Sample NFT Data:');
      console.log(`   - NFT ID: ${sample.nft_id}`);
      console.log(`   - Army Power: ${sample.army_power}`);
      console.log(`   - Religion Power: ${sample.religion_power}`);
      console.log(`   - Civilization Power: ${sample.civilization_power}`);
      console.log(`   - Economic Power: ${sample.economic_power}`);
      console.log(`   - Civilization Theme: ${(sample as any).civilization_theme || 'Not set'}`);
      console.log(`   - Battle Theme: ${(sample as any).battle_theme || 'Not set'}`);
    }
    
    console.log('\n🎉 All scanners completed successfully!');
    console.log('═'.repeat(60));
    
  } catch (error: any) {
    console.error('\n❌ Scanner failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the scanner
runComprehensiveScanner()
  .then(() => {
    console.log('\n✅ Process complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
