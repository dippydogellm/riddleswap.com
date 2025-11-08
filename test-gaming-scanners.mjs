/**
 * Gaming Scanner Endpoint Testing Script
 * Tests each collection by issuer:taxon to ensure correct data retrieval
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5001';

// Collections with their unique issuer:taxon identifiers
const COLLECTIONS = [
  {
    name: 'The Inquisition',
    issuer: 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH',
    taxon: 2,
    game_role: 'army',
    expected_supply: 916
  },
  {
    name: 'The Inquiry',
    issuer: 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH',
    taxon: 0,
    game_role: 'special',
    expected_supply: 123
  },
  {
    name: 'The Lost Emporium',
    issuer: 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH',
    taxon: 3,
    game_role: 'merchant',
    expected_supply: 42
  },
  {
    name: 'DANTES AURUM',
    issuer: 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH',
    taxon: 4,
    game_role: 'special',
    expected_supply: 100
  },
  {
    name: 'Under the Bridge: Troll',
    issuer: 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH',
    taxon: 9,
    game_role: 'bank',
    expected_supply: 339
  },
  {
    name: 'Fuzzy Cubs',
    issuer: 'rhcAT4onBm19PRkUm9M5rH79BbqU32y6jY',
    taxon: 2539302139,
    game_role: 'partner',
    expected_supply: 1534
  },
  {
    name: 'Casino Society',
    issuer: 'rJV6oSozcXYoyWSCrZBfN2MSvjGLMpt5HK',
    taxon: 0,
    game_role: 'partner',
    expected_supply: 0
  },
  {
    name: 'XRPL Legends',
    issuer: 'rf2Z67ZtsGADMk6q1SuJ9D4UFBtSu7DSXz',
    taxon: 0,
    game_role: 'partner',
    expected_supply: 0
  },
  {
    name: 'BunnyX',
    issuer: 'rH4SjkWsbNBRaecDnbFyd2nNn2bdkRJeoX',
    taxon: 0,
    game_role: 'partner',
    expected_supply: 0
  },
  {
    name: 'PEPE on XRP',
    issuer: 'rU6GcvpnAg4GstRCGobgSL7XiZqiDUPEki',
    taxon: 0,
    game_role: 'partner',
    expected_supply: 0
  }
];

// Test results tracker
const results = {
  passed: [],
  failed: [],
  warnings: []
};

console.log('🎮 GAMING SCANNER ENDPOINT AUDIT');
console.log('═'.repeat(80));
console.log(`Testing ${COLLECTIONS.length} collections with issuer:taxon identifiers\n`);

/**
 * Test a single collection's endpoints
 */
async function testCollection(collection) {
  const { name, issuer, taxon, game_role } = collection;
  const identifier = `${issuer}:${taxon}`;
  
  console.log(`\n📦 Testing: ${name}`);
  console.log(`   Identifier: ${identifier}`);
  console.log(`   Game Role: ${game_role}`);
  
  const testResults = {
    collection: name,
    identifier,
    tests: {}
  };

  // Test 1: Database Collection Data
  try {
    console.log(`   🔍 Testing database collection endpoint...`);
    const response = await fetch(`${BASE_URL}/api/inquisition-audit/collections`);
    const data = await response.json();
    
    if (data.success && data.data) {
      // Find this specific collection by issuer:taxon
      const collectionData = data.data.find(c => 
        c.issuer_address === issuer && c.taxon === taxon
      );
      
      if (collectionData) {
        testResults.tests.database = {
          status: 'PASS',
          data: {
            collection_name: collectionData.collection_name,
            actual_supply: collectionData.actual_supply,
            total_points: collectionData.stats?.total_nfts || 0,
            last_scanned: collectionData.last_scanned_at,
            scan_status: collectionData.scan_status
          }
        };
        console.log(`   ✅ Database: Found ${collectionData.actual_supply} NFTs`);
      } else {
        testResults.tests.database = {
          status: 'WARN',
          message: `Collection ${identifier} not found in database`
        };
        console.log(`   ⚠️  Database: Collection not found (may need scanning)`);
      }
    } else {
      throw new Error('Invalid response format');
    }
  } catch (error) {
    testResults.tests.database = {
      status: 'FAIL',
      error: error.message
    };
    console.log(`   ❌ Database: ${error.message}`);
  }

  // Test 2: NFT Scanner by Issuer (will get all taxons for this issuer)
  try {
    console.log(`   🔍 Testing XRPL scanner endpoint...`);
    const response = await fetch(`${BASE_URL}/api/scanner/xrpl/nfts/${issuer}?limit=5`);
    const data = await response.json();
    
    if (data.success && data.nfts) {
      // Filter by taxon to get correct collection
      const nftsForTaxon = data.nfts.filter(nft => nft.NFTokenTaxon === taxon);
      
      testResults.tests.scanner = {
        status: 'PASS',
        data: {
          total_from_issuer: data.nfts.length,
          matching_taxon: nftsForTaxon.length,
          sample_nft: nftsForTaxon[0] || null
        }
      };
      console.log(`   ✅ Scanner: Found ${data.nfts.length} NFTs from issuer (${nftsForTaxon.length} with taxon ${taxon})`);
      
      if (nftsForTaxon.length === 0 && data.nfts.length > 0) {
        console.log(`   ⚠️  Warning: Issuer has NFTs but none match taxon ${taxon}`);
      }
    } else {
      throw new Error(data.error || 'Invalid response format');
    }
  } catch (error) {
    testResults.tests.scanner = {
      status: 'FAIL',
      error: error.message
    };
    console.log(`   ❌ Scanner: ${error.message}`);
  }

  // Test 3: Gaming NFTs Endpoint (get NFTs from database by collection_id)
  try {
    console.log(`   🔍 Testing gaming NFTs database endpoint...`);
    // First get the collection_id for this issuer:taxon
    const collectionsResponse = await fetch(`${BASE_URL}/api/inquisition-audit/collections`);
    const collectionsData = await collectionsResponse.json();
    const collectionInfo = collectionsData.data?.find(c => 
      c.issuer_address === issuer && c.taxon === taxon
    );
    
    if (!collectionInfo) {
      throw new Error(`Collection not found in database for ${issuer}:${taxon}`);
    }
    
    const response = await fetch(`${BASE_URL}/api/inquisition-audit/nfts?collection_id=${collectionInfo.id}&limit=5`);
    const data = await response.json();
    
    if (data.success && data.data) {
      testResults.tests.gaming_nfts = {
        status: 'PASS',
        data: {
          count: data.data.length,
          sample_nft: data.data[0] ? {
            name: data.data[0].name,
            power: data.data[0].total_points,
            owner: data.data[0].current_owner?.substring(0, 10) + '...'
          } : null
        }
      };
      console.log(`   ✅ Gaming NFTs: Retrieved ${data.data.length} NFTs from database`);
      
      if (data.data[0]) {
        console.log(`      Sample: "${data.data[0].name}" (${data.data[0].total_points} power)`);
      }
    } else {
      throw new Error(data.error || 'Invalid response format');
    }
  } catch (error) {
    testResults.tests.gaming_nfts = {
      status: 'FAIL',
      error: error.message
    };
    console.log(`   ❌ Gaming NFTs: ${error.message}`);
  }

  // Determine overall status
  const allTests = Object.values(testResults.tests);
  const failedTests = allTests.filter(t => t.status === 'FAIL');
  const warnTests = allTests.filter(t => t.status === 'WARN');
  
  if (failedTests.length > 0) {
    results.failed.push(testResults);
    console.log(`   🔴 OVERALL: FAILED (${failedTests.length} test(s) failed)`);
  } else if (warnTests.length > 0) {
    results.warnings.push(testResults);
    console.log(`   🟡 OVERALL: WARNING (${warnTests.length} warning(s))`);
  } else {
    results.passed.push(testResults);
    console.log(`   🟢 OVERALL: PASSED`);
  }

  return testResults;
}

/**
 * Test gaming API endpoints
 */
async function testGamingEndpoints() {
  console.log('\n\n🎯 TESTING CORE GAMING ENDPOINTS');
  console.log('─'.repeat(80));

  const endpoints = [
    {
      name: 'Collections List',
      url: '/api/inquisition-audit/collections',
      expectedFields: ['collection_name', 'issuer_address', 'taxon', 'actual_supply']
    },
    {
      name: 'All NFTs (paginated)',
      url: '/api/inquisition-audit/nfts?limit=10',
      expectedFields: ['id', 'nft_token_id', 'name', 'total_points', 'current_owner']
    },
    {
      name: 'Health Check',
      url: '/health',
      expectedFields: ['status']
    }
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`\n🔗 ${endpoint.name}`);
      console.log(`   URL: ${endpoint.url}`);
      
      const response = await fetch(`${BASE_URL}${endpoint.url}`);
      const data = await response.json();
      
      if (response.ok) {
        // Check if expected fields exist
        const sampleData = data.data?.[0] || data;
        const hasExpectedFields = endpoint.expectedFields.every(field => 
          field in sampleData || field in data
        );
        
        if (hasExpectedFields) {
          console.log(`   ✅ PASS - Status ${response.status}, data structure valid`);
          if (data.data?.length) {
            console.log(`      Retrieved ${data.data.length} records`);
          }
        } else {
          console.log(`   ⚠️  WARN - Missing expected fields`);
        }
      } else {
        console.log(`   ❌ FAIL - Status ${response.status}: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.log(`   ❌ FAIL - ${error.message}`);
    }
  }
}

/**
 * Main test execution
 */
async function runTests() {
  try {
    // Test core endpoints first
    await testGamingEndpoints();
    
    // Test each collection with issuer:taxon
    console.log('\n\n🔍 TESTING INDIVIDUAL COLLECTIONS (by issuer:taxon)');
    console.log('═'.repeat(80));
    
    for (const collection of COLLECTIONS) {
      await testCollection(collection);
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Print summary
    console.log('\n\n📊 TEST SUMMARY');
    console.log('═'.repeat(80));
    console.log(`✅ Passed: ${results.passed.length} collections`);
    console.log(`🟡 Warnings: ${results.warnings.length} collections`);
    console.log(`❌ Failed: ${results.failed.length} collections`);
    
    if (results.failed.length > 0) {
      console.log('\n❌ FAILED COLLECTIONS:');
      results.failed.forEach(r => {
        console.log(`   - ${r.collection} (${r.identifier})`);
        Object.entries(r.tests).forEach(([test, result]) => {
          if (result.status === 'FAIL') {
            console.log(`      └─ ${test}: ${result.error}`);
          }
        });
      });
    }
    
    if (results.warnings.length > 0) {
      console.log('\n⚠️  COLLECTIONS WITH WARNINGS:');
      results.warnings.forEach(r => {
        console.log(`   - ${r.collection} (${r.identifier})`);
        Object.entries(r.tests).forEach(([test, result]) => {
          if (result.status === 'WARN') {
            console.log(`      └─ ${test}: ${result.message}`);
          }
        });
      });
    }
    
    console.log('\n' + '═'.repeat(80));
    console.log(`🎮 Gaming Scanner Audit Complete`);
    console.log(`   Server: ${BASE_URL}`);
    console.log(`   Total Collections Tested: ${COLLECTIONS.length}`);
    console.log(`   Success Rate: ${((results.passed.length / COLLECTIONS.length) * 100).toFixed(1)}%`);
    console.log('═'.repeat(80));
    
    // Exit with error code if any tests failed
    process.exit(results.failed.length > 0 ? 1 : 0);
    
  } catch (error) {
    console.error('\n💥 Fatal error during test execution:', error);
    process.exit(1);
  }
}

// Run tests
runTests();
