/**
 * POPULATE GAMING COLLECTIONS & SCAN ALL NFTs
 * 
 * Step 1: Populates the inquisition_collections table with all 13 gaming collections
 * Step 2: Scans all NFTs from Bithomp and stores them with power scores
 */

const BITHOMP_API_KEY = '95b64250-f24f-4654-9b4b-b155a3a6867b';

const GAMING_COLLECTIONS = [
  {
    name: 'The Inquisition',
    issuer: 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH',
    taxon: 0,
    power_role: 'army',
    description: 'Original Inquisition collection'
  },
  {
    name: 'Patriot',
    issuer: 'rGR4MCACFZg95TpxBncVPzB3o4oUxb9gF7',
    taxon: 0,
    power_role: 'army',
    description: 'Patriot warriors collection'
  },
  {
    name: 'The Inquiry',
    issuer: 'rBxhkL9zpckT7wf8nTLpVDEJwLxPJoNVCh',
    taxon: 0,
    power_role: 'religion',
    description: 'Religious inquiry collection'
  },
  {
    name: 'XRPL Legends',
    issuer: 'rJd8Hs1vNMb73nxC9auBqsF1wRLjmhfPpz',
    taxon: 0,
    power_role: 'balanced',
    description: 'Legendary XRPL collection'
  },
  {
    name: 'Casino Society',
    issuer: 'rJV6oSozcXYoyWSCrZBfN2MSvjGLMpt5HK',
    taxon: 0,
    power_role: 'economic',
    description: 'Casino themed collection'
  },
  {
    name: 'The Lost Emporium',
    issuer: 'rKz4K3y5n7VqcTR6uYbSUKVfaHGH66pUPT',
    taxon: 0,
    power_role: 'economic',
    description: 'Lost treasures collection'
  },
  {
    name: 'Made with Miracles 589',
    issuer: 'rDhzwyR2ykL75bxLW1Zk6gzgT2kXsmCnGp',
    taxon: 589,
    power_role: 'religion',
    description: 'Made with Miracles Little book'
  },
  {
    name: 'BunnyX',
    issuer: 'rw1R8cfHGMySmbj7gJ1HkiCqTY1xhLGYAs',
    taxon: 0,
    power_role: 'balanced',
    description: 'BunnyX collection'
  },
  {
    name: 'DANTES AURUM',
    issuer: 'rHVqLmh8qfXvYPZXFnRCvZSF3rNLNt6tXJ',
    taxon: 0,
    power_role: 'economic',
    description: 'Dantes Aurum collection'
  },
  {
    name: 'PEPE on XRP',
    issuer: 'rN4mKL6vCKWjDkYhT5bW5E5LJCxKD1iiFL',
    taxon: 0,
    power_role: 'balanced',
    description: 'PEPE meme collection'
  },
  {
    name: 'Under the Bridge: Troll',
    issuer: 'rwvWUfYL1mKsKZ4rnp2TMsYvQQNp4vw8zd',
    taxon: 0,
    power_role: 'army',
    description: 'Troll warriors collection'
  },
  {
    name: 'Made with Miracles Angels',
    issuer: 'rDhzwyR2ykL75bxLW1Zk6gzgT2kXsmCnGp',
    taxon: 74,
    power_role: 'religion',
    description: 'Made with Miracles Founders Angels'
  },
  {
    name: 'Tazz',
    issuer: 'rBwabNNMNhzN8WpyY9s3K1d2m1JmkMKw1V',
    taxon: 0,
    power_role: 'balanced',
    description: 'Tazz collection'
  }
];

async function populateCollections() {
  console.log('🚀 Starting full collection population process...\n');
  
  try {
    // Step 1: Populate collections table via API
    console.log('� Step 1: Populating collections table...');
    const populateResponse = await fetch('http://localhost:5000/api/gaming/populate-collections', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!populateResponse.ok) {
      const errorText = await populateResponse.text();
      console.error('❌ Failed to populate collections:', populateResponse.status, errorText);
      throw new Error(`Failed to populate collections: ${populateResponse.status}`);
    }
    
    const populateData = await populateResponse.json();
    console.log(`✅ Collections in database: ${populateData.collections.length}`);
    populateData.collections.forEach(col => {
      console.log(`   - ${col.name} (${col.issuer.slice(0, 10)}... taxon: ${col.taxon})`);
    });
    
    console.log('\n⏳ Waiting 2 seconds before scanning...\n');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 2: Scan and populate all NFTs from collections
    console.log('🌐 Step 2: Scanning ALL collections and populating database with NFTs...');
    console.log('⚠️  This may take several minutes to fetch all NFTs from Bithomp...\n');
    
    const scanStartTime = Date.now();
    const scanResponse = await fetch('http://localhost:5000/api/gaming/scan-all-collections', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!scanResponse.ok) {
      const errorText = await scanResponse.text();
      console.error('❌ Failed to scan collections:', scanResponse.status, errorText);
      throw new Error(`Failed to scan collections: ${scanResponse.status}`);
    }
    
    const scanData = await scanResponse.json();
    const scanDuration = (Date.now() - scanStartTime) / 1000;
    
    console.log('\n✅ COLLECTION SCAN COMPLETE!\n');
    console.log('📊 Results:');
    console.log(`   Collections scanned: ${scanData.scan_result.collections_scanned}`);
    console.log(`   Total NFTs found: ${scanData.scan_result.total_nfts_found}`);
    console.log(`   Total NFTs stored: ${scanData.scan_result.total_nfts_stored || scanData.scan_result.total_nfts_found}`);
    console.log(`   Scan duration: ${scanDuration.toFixed(2)}s`);
    
    console.log('\n📈 NFTs by Collection:');
    Object.entries(scanData.scan_result.nfts_by_collection).forEach(([name, count]) => {
      console.log(`   ${name}: ${count} NFTs`);
    });
    
    console.log('\n⏳ Waiting 2 seconds before trait scoring...\n');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 3: Score traits for rarity calculation (STAGE 2)
    console.log('🎯 Step 3: STAGE 2 - Calculating trait rarity scores for ALL collections...');
    console.log('📊 This will analyze trait percentages and assign rarity scores\n');
    
    const scoreStartTime = Date.now();
    const scoreResponse = await fetch('http://localhost:5000/api/gaming/score-all-collections-traits', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!scoreResponse.ok) {
      const errorText = await scoreResponse.text();
      console.error('❌ Failed to score traits:', scoreResponse.status, errorText);
      throw new Error(`Failed to score traits: ${scoreResponse.status}`);
    }
    
    const scoreData = await scoreResponse.json();
    const scoreDuration = (Date.now() - scoreStartTime) / 1000;
    
    console.log('\n✅ TRAIT RARITY SCORING COMPLETE!\n');
    console.log('📊 Results:');
    console.log(`   Collections scored: ${scoreData.collections_scored}`);
    console.log(`   Total NFTs scored: ${scoreData.total_nfts_scored}`);
    console.log(`   Scoring duration: ${scoreDuration.toFixed(2)}s`);
    
    if (scoreData.results && scoreData.results.length > 0) {
      console.log('\n📈 Rarity Scores by Collection:');
      scoreData.results.forEach(result => {
        console.log(`   ${result.collection_name}: ${result.nfts_scored} NFTs (avg rarity: ${result.average_rarity})`);
      });
    }
    
    console.log('\n✅ DATABASE FULLY POPULATED WITH RARITY SCORES!');
    console.log('🎮 All NFTs stored with power scores AND trait rarity rankings!');
    console.log('🏆 Ready for squadron creation, gaming, and AI battle scoring!');
    console.log('📊 STAGE 2 COMPLETE - Ready for STAGE 3: Battle results integration');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error);
    process.exit(1);
  }
}

populateCollections().catch(console.error);
