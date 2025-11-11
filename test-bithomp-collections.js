/**
 * TEST BITHOMP API FOR ALL GAMING COLLECTIONS
 * 
 * This script tests each registered gaming collection to verify:
 * 1. Bithomp API responds successfully
 * 2. NFT data is returned
 * 3. Metadata is accessible
 * 4. Collection details are correct
 */

import fetch from 'node-fetch';

const BITHOMP_API_KEY = process.env.BITHOMP_API_KEY || '95b64250-f24f-4654-9b4b-b155a3a6867b';

// All registered gaming collections from the system
const COLLECTIONS = [
  {
    name: 'The Inquisition',
    issuer: 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH',
    taxon: 0,
    powerRole: 'Army',
    expectedNFTs: 1011
  },
  {
    name: 'Patriot',
    issuer: 'rGR4MCACFZg95TpxBncVPzB3o4oUxb9gF7',
    taxon: 0,
    powerRole: 'Army',
    expectedNFTs: 1000
  },
  {
    name: 'The Inquiry',
    issuer: 'rBxhkL9zpckT7wf8nTLpVDEJwLxPJoNVCh',
    taxon: 0,
    powerRole: 'Religion',
    expectedNFTs: 135
  },
  {
    name: 'XRPL Legends',
    issuer: 'rJd8Hs1vNMb73nxC9auBqsF1wRLjmhfPpz',
    taxon: 0,
    powerRole: 'Balanced',
    expectedNFTs: 1414
  },
  {
    name: 'Casino Society',
    issuer: 'rJV6oSozcXYoyWSCrZBfN2MSvjGLMpt5HK',
    taxon: 0,
    powerRole: 'Economic',
    expectedNFTs: 300
  },
  {
    name: 'The Lost Emporium',
    issuer: 'rKz4K3y5n7VqcTR6uYbSUKVfaHGH66pUPT',
    taxon: 0,
    powerRole: 'Economic',
    expectedNFTs: 123
  },
  {
    name: 'Made with Miracles 589 Little book',
    issuer: 'rDhzwyR2ykL75bxLW1Zk6gzgT2kXsmCnGp',
    taxon: 589,
    powerRole: 'Religion',
    expectedNFTs: 82
  },
  {
    name: 'BunnyX',
    issuer: 'rw1R8cfHGMySmbj7gJ1HkiCqTY1xhLGYAs',
    taxon: 0,
    powerRole: 'Balanced',
    expectedNFTs: 791
  },
  {
    name: 'DANTES AURUM',
    issuer: 'rHVqLmh8qfXvYPZXFnRCvZSF3rNLNt6tXJ',
    taxon: 0,
    powerRole: 'Economic',
    expectedNFTs: 43
  },
  {
    name: 'PEPE on XRP',
    issuer: 'rN4mKL6vCKWjDkYhT5bW5E5LJCxKD1iiFL',
    taxon: 0,
    powerRole: 'Balanced',
    expectedNFTs: 250
  },
  {
    name: 'Under the Bridge: Troll',
    issuer: 'rwvWUfYL1mKsKZ4rnp2TMsYvQQNp4vw8zd',
    taxon: 0,
    powerRole: 'Army',
    expectedNFTs: 720
  },
  {
    name: 'Made with Miracles Founders Angels',
    issuer: 'rDhzwyR2ykL75bxLW1Zk6gzgT2kXsmCnGp',
    taxon: 74,
    powerRole: 'Religion',
    expectedNFTs: 92
  },
  {
    name: 'Tazz',
    issuer: 'rBwabNNMNhzN8WpyY9s3K1d2m1JmkMKw1V',
    taxon: 0,
    powerRole: 'Balanced',
    expectedNFTs: 3
  }
];

const BITHOMP_BASE_URL = 'https://bithomp.com/api/v2';

async function testCollection(collection) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 Testing: ${collection.name}`);
  console.log(`   Issuer: ${collection.issuer}`);
  console.log(`   Taxon: ${collection.taxon}`);
  console.log(`   Expected NFTs: ${collection.expectedNFTs}`);
  console.log(`${'='.repeat(60)}`);

  try {
    // Test 1: Fetch NFTs by issuer + taxon
    const url = `${BITHOMP_BASE_URL}/nfts?issuer=${collection.issuer}&taxon=${collection.taxon}&assets=true&limit=10`;
    console.log(`\n📡 Fetching: ${url}`);
    
    const startTime = Date.now();
    const response = await fetch(url, {
      headers: {
        'x-bithomp-token': BITHOMP_API_KEY,
        'Accept': 'application/json',
        'User-Agent': 'RiddleSwap-Test/1.0'
      }
    });
    const responseTime = Date.now() - startTime;

    console.log(`⏱️  Response time: ${responseTime}ms`);
    console.log(`📊 Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      console.log(`❌ FAILED: HTTP ${response.status}`);
      const errorText = await response.text();
      console.log(`   Error: ${errorText.substring(0, 200)}`);
      return {
        collection: collection.name,
        status: 'FAILED',
        error: `HTTP ${response.status}`,
        issuer: collection.issuer,
        taxon: collection.taxon
      };
    }

    const data = await response.json();
    const nftCount = data.nfts?.length || 0;

    console.log(`✅ SUCCESS: Received ${nftCount} NFTs`);

    // Test 2: Check if metadata is accessible
    if (nftCount > 0) {
      const firstNFT = data.nfts[0];
      console.log(`\n📝 Sample NFT:`);
      console.log(`   Token ID: ${firstNFT.nftokenID?.substring(0, 20)}...`);
      console.log(`   Owner: ${firstNFT.owner?.substring(0, 15)}...`);
      console.log(`   Has URI: ${!!firstNFT.uri}`);
      console.log(`   Has Metadata: ${!!firstNFT.metadata}`);
      
      if (firstNFT.metadata) {
        console.log(`   NFT Name: ${firstNFT.metadata.name || 'N/A'}`);
        console.log(`   Has Image: ${!!firstNFT.metadata.image}`);
        console.log(`   Attributes: ${firstNFT.metadata.attributes?.length || 0}`);
      }
    }

    // Test 3: Verify total count (if available in response)
    if (data.count !== undefined) {
      console.log(`\n📊 Total Collection NFTs: ${data.count}`);
      if (data.count !== collection.expectedNFTs) {
        console.log(`⚠️  WARNING: Expected ${collection.expectedNFTs}, got ${data.count}`);
      }
    }

    return {
      collection: collection.name,
      status: 'SUCCESS',
      nftsReturned: nftCount,
      responseTime: responseTime,
      hasMetadata: nftCount > 0 && !!data.nfts[0].metadata,
      issuer: collection.issuer,
      taxon: collection.taxon
    };

  } catch (error) {
    console.log(`❌ EXCEPTION: ${error.message}`);
    console.log(`   Stack: ${error.stack?.substring(0, 200)}`);
    return {
      collection: collection.name,
      status: 'EXCEPTION',
      error: error.message,
      issuer: collection.issuer,
      taxon: collection.taxon
    };
  }
}

async function runAllTests() {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🧪 BITHOMP COLLECTION CONNECTIVITY TEST                ║
║                                                           ║
║   Testing ${COLLECTIONS.length} gaming collections                        ║
║   API: ${BITHOMP_BASE_URL}                   ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

  const results = [];

  for (const collection of COLLECTIONS) {
    const result = await testCollection(collection);
    results.push(result);
    
    // Rate limiting: wait 500ms between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Summary Report
  console.log(`\n\n${'═'.repeat(60)}`);
  console.log(`📊 SUMMARY REPORT`);
  console.log(`${'═'.repeat(60)}\n`);

  const successful = results.filter(r => r.status === 'SUCCESS');
  const failed = results.filter(r => r.status === 'FAILED');
  const exceptions = results.filter(r => r.status === 'EXCEPTION');

  console.log(`✅ Successful: ${successful.length}/${results.length}`);
  console.log(`❌ Failed: ${failed.length}/${results.length}`);
  console.log(`⚠️  Exceptions: ${exceptions.length}/${results.length}`);

  if (successful.length > 0) {
    console.log(`\n✅ WORKING COLLECTIONS:\n`);
    successful.forEach(r => {
      console.log(`   ✓ ${r.collection.padEnd(40)} - ${r.nftsReturned} NFTs (${r.responseTime}ms)`);
    });
  }

  if (failed.length > 0) {
    console.log(`\n❌ FAILED COLLECTIONS:\n`);
    failed.forEach(r => {
      console.log(`   ✗ ${r.collection.padEnd(40)} - ${r.error}`);
      console.log(`     Issuer: ${r.issuer}, Taxon: ${r.taxon}`);
    });
  }

  if (exceptions.length > 0) {
    console.log(`\n⚠️  EXCEPTION COLLECTIONS:\n`);
    exceptions.forEach(r => {
      console.log(`   ! ${r.collection.padEnd(40)} - ${r.error}`);
      console.log(`     Issuer: ${r.issuer}, Taxon: ${r.taxon}`);
    });
  }

  // Average response time
  const avgResponseTime = successful.reduce((sum, r) => sum + r.responseTime, 0) / successful.length;
  console.log(`\n⏱️  Average Response Time: ${Math.round(avgResponseTime)}ms`);

  // Collections with metadata
  const withMetadata = successful.filter(r => r.hasMetadata).length;
  console.log(`📝 Collections with Metadata: ${withMetadata}/${successful.length}`);

  console.log(`\n${'═'.repeat(60)}\n`);

  // Exit code
  process.exit(failed.length + exceptions.length > 0 ? 1 : 0);
}

// Run the tests
runAllTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
