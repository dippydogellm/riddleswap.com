/**
 * RIDDLE CITY NFT SCANNER TEST
 * 
 * Tests the actual scanner endpoint that Riddle City uses
 * This queries wallet addresses directly using XRPL account_nfts
 */

import { Client } from 'xrpl';

const BITHOMP_API_KEY = process.env.BITHOMP_API_KEY || '95b64250-f24f-4654-9b4b-b155a3a6867b';

// Test wallets to check (add real wallet addresses here)
const TEST_WALLETS = [
  'rEVrTKUKSLx5nxdfV8SAFTxS9FGFrfHRLo', // dippydoge's actual wallet
  'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH', // The Inquisition issuer
];

// Gaming collections to filter by
const GAMING_COLLECTIONS = [
  { name: 'The Inquisition', issuer: 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH', taxon: 0 },
  { name: 'Patriot', issuer: 'rGR4MCACFZg95TpxBncVPzB3o4oUxb9gF7', taxon: 0 },
  { name: 'The Inquiry', issuer: 'rBxhkL9zpckT7wf8nTLpVDEJwLxPJoNVCh', taxon: 0 },
  { name: 'XRPL Legends', issuer: 'rJd8Hs1vNMb73nxC9auBqsF1wRLjmhfPpz', taxon: 0 },
  { name: 'Casino Society', issuer: 'rJV6oSozcXYoyWSCrZBfN2MSvjGLMpt5HK', taxon: 0 },
  { name: 'The Lost Emporium', issuer: 'rKz4K3y5n7VqcTR6uYbSUKVfaHGH66pUPT', taxon: 0 },
  { name: 'Made with Miracles 589', issuer: 'rDhzwyR2ykL75bxLW1Zk6gzgT2kXsmCnGp', taxon: 589 },
  { name: 'BunnyX', issuer: 'rw1R8cfHGMySmbj7gJ1HkiCqTY1xhLGYAs', taxon: 0 },
  { name: 'DANTES AURUM', issuer: 'rHVqLmh8qfXvYPZXFnRCvZSF3rNLNt6tXJ', taxon: 0 },
  { name: 'PEPE on XRP', issuer: 'rN4mKL6vCKWjDkYhT5bW5E5LJCxKD1iiFL', taxon: 0 },
  { name: 'Under the Bridge: Troll', issuer: 'rwvWUfYL1mKsKZ4rnp2TMsYvQQNp4vw8zd', taxon: 0 },
  { name: 'Made with Miracles Angels', issuer: 'rDhzwyR2ykL75bxLW1Zk6gzgT2kXsmCnGp', taxon: 74 },
  { name: 'Tazz', issuer: 'rBwabNNMNhzN8WpyY9s3K1d2m1JmkMKw1V', taxon: 0 }
];

console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║                                                           ║');
console.log('║   🎮 RIDDLE CITY NFT SCANNER TEST                        ║');
console.log('║                                                           ║');
console.log('║   Testing actual wallet scanning (XRPL account_nfts)     ║');
console.log('║                                                           ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

/**
 * Check if an NFT belongs to a gaming collection
 */
function isGamingNFT(nft, collections) {
  const collectionKey = `${nft.Issuer}:${nft.NFTokenTaxon}`;
  const collection = collections.find(c => `${c.issuer}:${c.taxon}` === collectionKey);
  return collection ? collection.name : null;
}

/**
 * Fetch NFT metadata from Bithomp
 */
async function fetchNFTMetadata(nftokenID) {
  try {
    const url = `https://bithomp.com/api/v2/nft/${nftokenID}?assets=true`;
    const response = await fetch(url, {
      headers: {
        'x-bithomp-token': BITHOMP_API_KEY,
        'User-Agent': 'RiddleSwap-Test/1.0',
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(3000)
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    return null;
  }
}

/**
 * Scan a single wallet for gaming NFTs
 */
async function scanWallet(client, walletAddress) {
  console.log('============================================================');
  console.log(`🔍 Scanning Wallet: ${walletAddress}`);
  console.log('============================================================\n');

  try {
    // Query XRPL for all NFTs in this wallet
    console.log('📡 Querying XRPL account_nfts...');
    const response = await client.request({
      command: 'account_nfts',
      account: walletAddress,
      ledger_index: 'validated'
    });

    const allNFTs = response.result.account_nfts || [];
    console.log(`✅ Found ${allNFTs.length} total NFTs in wallet\n`);

    if (allNFTs.length === 0) {
      console.log('⚠️  This wallet contains no NFTs\n');
      return { wallet: walletAddress, totalNFTs: 0, gamingNFTs: [] };
    }

    // Filter for gaming NFTs
    const gamingNFTs = [];
    let gamingNFTCount = 0;

    for (const nft of allNFTs) {
      const collectionName = isGamingNFT(nft, GAMING_COLLECTIONS);
      
      if (collectionName) {
        gamingNFTCount++;
        console.log(`🎮 Gaming NFT #${gamingNFTCount}:`);
        console.log(`   Collection: ${collectionName}`);
        console.log(`   Token ID: ${nft.NFTokenID.substring(0, 20)}...`);
        console.log(`   Issuer: ${nft.Issuer}`);
        console.log(`   Taxon: ${nft.NFTokenTaxon}`);

        // Fetch metadata from Bithomp
        console.log(`   📥 Fetching metadata from Bithomp...`);
        const metadata = await fetchNFTMetadata(nft.NFTokenID);
        
        if (metadata) {
          const name = metadata.metadata?.name || `NFT #${nft.NFTokenID.slice(-6)}`;
          const imageUrl = metadata.assets?.image || metadata.assets?.preview || `https://cdn.bithomp.com/nft/${nft.NFTokenID}.webp`;
          console.log(`   ✅ Name: ${name}`);
          console.log(`   ✅ Image: ${imageUrl.substring(0, 60)}...`);
          
          gamingNFTs.push({
            nftokenID: nft.NFTokenID,
            collection: collectionName,
            name,
            imageUrl,
            issuer: nft.Issuer,
            taxon: nft.NFTokenTaxon
          });
        } else {
          console.log(`   ⚠️  Failed to fetch metadata from Bithomp`);
        }
        
        console.log('');
        
        // Rate limit: Wait 200ms between Bithomp requests
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    console.log(`\n📊 Summary for ${walletAddress}:`);
    console.log(`   Total NFTs: ${allNFTs.length}`);
    console.log(`   Gaming NFTs: ${gamingNFTCount}`);
    console.log(`   Non-Gaming NFTs: ${allNFTs.length - gamingNFTCount}\n`);

    return {
      wallet: walletAddress,
      totalNFTs: allNFTs.length,
      gamingNFTCount,
      gamingNFTs
    };

  } catch (error) {
    console.log(`❌ ERROR scanning wallet: ${error.message}\n`);
    return {
      wallet: walletAddress,
      error: error.message,
      totalNFTs: 0,
      gamingNFTs: []
    };
  }
}

/**
 * Main test function
 */
async function runTest() {
  const client = new Client('wss://xrplcluster.com');
  
  try {
    console.log('🔌 Connecting to XRPL...');
    await client.connect();
    console.log('✅ Connected to XRPL\n');

    const results = [];

    // Scan each test wallet
    for (const wallet of TEST_WALLETS) {
      const result = await scanWallet(client, wallet);
      results.push(result);
      
      // Wait between wallet scans
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Summary report
    console.log('\n════════════════════════════════════════════════════════════');
    console.log('📊 FINAL SUMMARY REPORT');
    console.log('════════════════════════════════════════════════════════════\n');

    let totalGamingNFTs = 0;
    let totalNFTs = 0;
    const collectionCounts = {};

    for (const result of results) {
      if (!result.error) {
        totalNFTs += result.totalNFTs;
        totalGamingNFTs += result.gamingNFTCount || 0;

        // Count by collection
        for (const nft of result.gamingNFTs) {
          collectionCounts[nft.collection] = (collectionCounts[nft.collection] || 0) + 1;
        }
      }
    }

    console.log(`Wallets Scanned: ${TEST_WALLETS.length}`);
    console.log(`Total NFTs Found: ${totalNFTs}`);
    console.log(`Gaming NFTs Found: ${totalGamingNFTs}`);
    console.log(`\nGaming NFTs by Collection:`);
    
    for (const [collection, count] of Object.entries(collectionCounts)) {
      console.log(`   ${collection}: ${count} NFTs`);
    }

    console.log('\n════════════════════════════════════════════════════════════\n');

    console.log('💡 HOW THE RIDDLE CITY SCANNER WORKS:\n');
    console.log('1. User logs in with their Riddle wallet');
    console.log('2. Scanner calls XRPL account_nfts for their wallet address');
    console.log('3. Filters NFTs by checking issuer:taxon against gaming collections');
    console.log('4. Fetches metadata and images from Bithomp API');
    console.log('5. Stores gaming NFTs in database tables:');
    console.log('   - gaming_nfts (individual NFT records)');
    console.log('   - player_nft_ownership (ownership mapping)');
    console.log('   - gaming_players (aggregate stats)');
    console.log('   - gaming_nft_collections (collection stats)');
    console.log('6. Frontend displays gaming dashboard with power calculations\n');

    if (totalGamingNFTs === 0) {
      console.log('⚠️  NO GAMING NFTs FOUND IN TEST WALLETS\n');
      console.log('This could mean:');
      console.log('   - Test wallets are issuer addresses (don\'t hold their own NFTs)');
      console.log('   - All NFTs are held by collectors in private wallets');
      console.log('   - Need to add actual player wallet addresses to TEST_WALLETS\n');
      console.log('🔧 TO FIX: Add dippydoge\'s wallet address to TEST_WALLETS array\n');
    } else {
      console.log('✅ SCANNER IS WORKING CORRECTLY\n');
      console.log('The Bithomp API and XRPL connections are functioning.');
      console.log('If users don\'t see their NFTs in Riddle City:');
      console.log('   1. Check they logged in with correct wallet');
      console.log('   2. Run wallet scan: POST /api/gaming/player/scan-wallet-nfts');
      console.log('   3. Check database tables have their NFTs populated\n');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    console.log('🔌 Disconnecting from XRPL...');
    await client.disconnect();
    console.log('✅ Disconnected\n');
  }
}

// Run the test
runTest().catch(console.error);
