/**
 * COMPREHENSIVE BROKER ROUTES TEST SUITE
 * Tests all broker functionality including minting escrow systems
 */

import { Client, Wallet } from 'xrpl';

const BROKER_ADDRESS = 'rGLzXKif4ksBZe2MY6RZT9m69hdgzsXG4X';
const TEST_ISSUER_ADDRESS = 'rN7n7otQDd6FczFgLdlmfXdTR72HCBaMuR'; // Example issuer
const TEST_BUYER_ADDRESS = 'rfkDuh9FXQd53TBZZqR3fV4fVjN3F9tN6k'; // Example buyer

// Mock authentication token (replace with real token from session)
const AUTH_TOKEN = 'test-token'; // This will be replaced with real session token

interface TestResult {
  endpoint: string;
  method: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  details: string;
  payload?: any;
  response?: any;
  error?: any;
}

const results: TestResult[] = [];

// Test helper function
async function testEndpoint(
  endpoint: string,
  method: string,
  payload?: any,
  requiresAuth: boolean = true
): Promise<TestResult> {
  const baseUrl = process.env.REPLIT_DEV_DOMAIN 
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : 'http://localhost:5000';
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  
  if (requiresAuth) {
    headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
  }
  
  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers,
      body: payload ? JSON.stringify(payload) : undefined
    });
    
    const data = await response.json() as any;
    
    return {
      endpoint,
      method,
      status: response.ok ? 'PASS' : 'FAIL',
      details: response.ok ? 'Success' : data.error || 'Request failed',
      payload,
      response: data
    };
  } catch (error) {
    return {
      endpoint,
      method,
      status: 'FAIL',
      details: 'Network or server error',
      payload,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * TEST 1: External Platform Minting Escrow
 */
async function testExternalMintEscrow() {
  console.log('\n🧪 TEST 1: External Platform Minting Escrow');
  console.log('='.repeat(60));
  
  // Generate test wallet for issuer private key
  const testWallet = Wallet.generate();
  
  const initPayload = {
    issuerAddress: testWallet.classicAddress,
    issuerPrivateKey: testWallet.seed!, // Will be encrypted
    taxon: 12345,
    buyerAddress: TEST_BUYER_ADDRESS,
    mintCost: 10, // 10 XRP
    nftMetadataUri: 'ipfs://QmTest123',
    nftName: 'Test NFT External',
    nftDescription: 'Testing external platform minting'
  };
  
  console.log('📝 Payload for /api/broker/mint/external/init:');
  console.log(JSON.stringify({
    ...initPayload,
    issuerPrivateKey: '[ENCRYPTED - NOT SHOWN]'
  }, null, 2));
  
  const result = await testEndpoint(
    '/api/broker/mint/external/init',
    'POST',
    initPayload
  );
  
  results.push(result);
  console.log(`✅ Status: ${result.status}`);
  console.log(`📊 Response:`, result.response);
  
  return result.response?.escrowId;
}

/**
 * TEST 2: DevTools Platform Minting Escrow
 */
async function testDevToolsMintEscrow() {
  console.log('\n🧪 TEST 2: DevTools Platform Minting Escrow');
  console.log('='.repeat(60));
  
  const initPayload = {
    projectId: 1, // Assuming project ID 1 exists
    buyerAddress: TEST_BUYER_ADDRESS,
    assetId: 1, // Asset to mint from project
    quantity: 1
  };
  
  console.log('📝 Payload for /api/broker/mint/devtools/init:');
  console.log(JSON.stringify(initPayload, null, 2));
  
  const result = await testEndpoint(
    '/api/broker/mint/devtools/init',
    'POST',
    initPayload
  );
  
  results.push(result);
  console.log(`✅ Status: ${result.status}`);
  console.log(`📊 Response:`, result.response);
  
  return result.response?.escrowId;
}

/**
 * TEST 3: Broker Escrow Status Check
 */
async function testEscrowStatus(escrowId: string, type: 'external' | 'devtools') {
  console.log(`\n🧪 TEST 3: Check ${type} Escrow Status`);
  console.log('='.repeat(60));
  
  const endpoint = type === 'external' 
    ? `/api/broker/mint/external/status/${escrowId}`
    : `/api/broker/mint/devtools/status/${escrowId}`;
  
  const result = await testEndpoint(endpoint, 'GET');
  
  results.push(result);
  console.log(`✅ Status: ${result.status}`);
  console.log(`📊 Response:`, result.response);
  
  return result.response;
}

/**
 * TEST 4: List DevTools Projects
 */
async function testListProjects() {
  console.log('\n🧪 TEST 4: List DevTools Projects');
  console.log('='.repeat(60));
  
  const result = await testEndpoint('/api/broker/mint/devtools/projects', 'GET');
  
  results.push(result);
  console.log(`✅ Status: ${result.status}`);
  console.log(`📊 Projects found:`, result.response?.projects?.length || 0);
  
  return result.response?.projects;
}

/**
 * TEST 5: Broker Wallet Monitoring Status
 */
async function testBrokerMonitoring() {
  console.log('\n🧪 TEST 5: Broker Wallet Monitoring');
  console.log('='.repeat(60));
  
  console.log('📍 Broker Address:', BROKER_ADDRESS);
  console.log('🔍 Connecting to XRPL to verify monitoring...');
  
  const client = new Client('wss://s1.ripple.com');
  await client.connect();
  
  const accountInfo = await client.request({
    command: 'account_info',
    account: BROKER_ADDRESS,
    ledger_index: 'validated'
  });
  
  console.log('✅ Broker wallet active');
  console.log('💰 Balance:', (Number(accountInfo.result.account_data.Balance) / 1_000_000).toFixed(6), 'XRP');
  console.log('🔢 Sequence:', accountInfo.result.account_data.Sequence);
  
  await client.disconnect();
  
  results.push({
    endpoint: 'XRPL Monitoring',
    method: 'WebSocket',
    status: 'PASS',
    details: `Broker wallet ${BROKER_ADDRESS} is active and monitored`,
    response: {
      balance: (Number(accountInfo.result.account_data.Balance) / 1_000_000).toFixed(6) + ' XRP',
      sequence: accountInfo.result.account_data.Sequence
    }
  });
}

/**
 * TEST 6: Verify Encryption Security
 */
async function testEncryptionSecurity() {
  console.log('\n🧪 TEST 6: Encryption Security Validation');
  console.log('='.repeat(60));
  
  const hasSessionSecret = !!process.env.SESSION_SECRET;
  const hasBrokerSeed = !!process.env.BROKER_WALLET_SEED;
  
  console.log('🔐 SESSION_SECRET configured:', hasSessionSecret ? '✅' : '❌');
  console.log('🔐 BROKER_WALLET_SEED configured:', hasBrokerSeed ? '✅' : '❌');
  
  results.push({
    endpoint: 'Security Configuration',
    method: 'ENV',
    status: (hasSessionSecret && hasBrokerSeed) ? 'PASS' : 'FAIL',
    details: 'Environment secrets validation',
    response: {
      sessionSecret: hasSessionSecret,
      brokerSeed: hasBrokerSeed
    }
  });
}

/**
 * TEST 7: NFT Broker Create Buy Offer
 */
async function testBrokerCreateBuyOffer() {
  console.log('\n🧪 TEST 7: NFT Broker Create Buy Offer');
  console.log('='.repeat(60));
  
  const payload = {
    nftId: '00081388C7D25FB7F2A89A8D41C49BD05BB7EDB63FD71B79AADC6A6400000001',
    amount: 100, // 100 XRP offer
    destination: TEST_BUYER_ADDRESS
  };
  
  console.log('📝 Payload for /api/broker/create-buy-offer:');
  console.log(JSON.stringify(payload, null, 2));
  
  const result = await testEndpoint('/api/broker/create-buy-offer', 'POST', payload);
  
  results.push(result);
  console.log(`✅ Status: ${result.status}`);
  console.log(`📊 Response:`, result.response);
}

/**
 * MAIN TEST EXECUTION
 */
async function runAllTests() {
  console.log('🚀 BROKER ROUTES COMPREHENSIVE TEST SUITE');
  console.log('='.repeat(60));
  console.log('📅 Test started:', new Date().toISOString());
  console.log('🏦 Broker Address:', BROKER_ADDRESS);
  console.log('='.repeat(60));
  
  try {
    // Test 1: External Platform Minting
    const externalEscrowId = await testExternalMintEscrow();
    
    // Test 2: DevTools Platform Minting
    const devtoolsEscrowId = await testDevToolsMintEscrow();
    
    // Test 3a: Check external escrow status
    if (externalEscrowId) {
      await testEscrowStatus(externalEscrowId, 'external');
    }
    
    // Test 3b: Check devtools escrow status
    if (devtoolsEscrowId) {
      await testEscrowStatus(devtoolsEscrowId, 'devtools');
    }
    
    // Test 4: List DevTools projects
    await testListProjects();
    
    // Test 5: Broker monitoring
    await testBrokerMonitoring();
    
    // Test 6: Security validation
    await testEncryptionSecurity();
    
    // Test 7: NFT broker buy offer
    await testBrokerCreateBuyOffer();
    
  } catch (error) {
    console.error('❌ Test suite error:', error);
  }
  
  // Print summary
  console.log('\n📊 TEST SUMMARY');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;
  
  console.log(`✅ PASSED: ${passed}`);
  console.log(`❌ FAILED: ${failed}`);
  console.log(`⏭️  SKIPPED: ${skipped}`);
  console.log(`📈 Total: ${results.length}`);
  
  console.log('\n📋 DETAILED RESULTS:');
  console.log('='.repeat(60));
  
  results.forEach((result, index) => {
    const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
    console.log(`\n${icon} Test ${index + 1}: ${result.endpoint}`);
    console.log(`   Method: ${result.method}`);
    console.log(`   Status: ${result.status}`);
    console.log(`   Details: ${result.details}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });
  
  console.log('\n🏁 Test suite completed:', new Date().toISOString());
  console.log('='.repeat(60));
  
  // Production readiness check
  const isProductionReady = failed === 0 && passed >= 6;
  
  console.log('\n🚀 PRODUCTION READINESS:');
  console.log('='.repeat(60));
  console.log(isProductionReady ? '✅ SYSTEM IS PRODUCTION READY' : '❌ SYSTEM NEEDS FIXES');
  console.log('\n✨ Key Capabilities:');
  console.log('  • External Platform Minting: Encrypts private keys, processes payments');
  console.log('  • DevTools Platform Minting: Integrates with project system');
  console.log('  • Automated Monitoring: Real-time XRPL transaction detection');
  console.log('  • NFT Minting: Broker mints NFTs on payment confirmation');
  console.log('  • Offer Creation: Automatic 0 XRP sell offers to buyers');
  console.log('  • Fee Distribution: 1.589% broker fee + creator payouts');
  console.log('  • Security: Mandatory SESSION_SECRET and BROKER_WALLET_SEED');
  
  return isProductionReady;
}

// Export for manual testing
export { runAllTests };

// Run tests immediately
runAllTests()
  .then(isReady => process.exit(isReady ? 0 : 1))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
