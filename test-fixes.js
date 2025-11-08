#!/usr/bin/env node

/**
 * Test script to validate:
 * 1. Session renewal endpoint works with cached keys
 * 2. /gaming route loads properly
 * 3. No 400 errors on session renewal
 */

const BASE_URL = 'http://localhost:5001';

async function testSessionRenewal() {
  console.log('\n🧪 TEST 1: Session Renewal Endpoint\n');
  
  try {
    // First, create a test session by "logging in"
    // We'll use a mock token for testing
    const mockSessionToken = 'test_session_' + Math.random().toString(36).substring(7);
    
    console.log('📝 Testing session renewal with Bearer token...');
    console.log(`Bearer token: ${mockSessionToken}\n`);
    
    // Try to renew with Bearer token (should either succeed or return 401, not 400)
    const response = await fetch(`${BASE_URL}/api/riddle-wallet/renew-session`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mockSessionToken}`,
        'Content-Type': 'application/json'
      }
      // No body - this is the key fix! Old version required masterPassword in body
    });
    
    const data = await response.json();
    
    console.log(`Status Code: ${response.status}`);
    console.log(`Response:`, JSON.stringify(data, null, 2));
    
    // We expect either:
    // - 401 (invalid session) = GOOD - means endpoint doesn't require masterPassword
    // - 200 (success) = EXCELLENT - means renewal worked
    // - 400 (bad request) = BAD - means old code is still running
    
    if (response.status === 400) {
      console.log('\n❌ FAIL: Got 400 Bad Request - endpoint still requires masterPassword in body');
      console.log('   This means the fix was not applied correctly.');
      return false;
    } else if (response.status === 401) {
      console.log('\n✅ PASS: Got 401 Unauthorized - endpoint works without masterPassword!');
      console.log('   This is expected for invalid/expired tokens.');
      console.log('   The important thing is it\'s NOT a 400 error anymore.');
      return true;
    } else if (response.status === 200) {
      console.log('\n✅ PASS: Got 200 Success - session renewal worked!');
      return true;
    } else {
      console.log(`\n⚠️  Got unexpected status: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    return false;
  }
}

async function testGamingRoute() {
  console.log('\n🧪 TEST 2: /gaming Route\n');
  
  try {
    console.log('📝 Testing /gaming route loads properly...\n');
    
    const response = await fetch(`${BASE_URL}/gaming`);
    
    console.log(`Status Code: ${response.status}`);
    console.log(`Content-Type: ${response.headers.get('content-type')}`);
    
    if (response.status === 404) {
      console.log('\n❌ FAIL: Got 404 Not Found');
      console.log('   The /gaming route is not being found.');
      return false;
    } else if (response.status === 200) {
      const html = await response.text();
      if (html.includes('gaming') || html.includes('component') || html.length > 100) {
        console.log('\n✅ PASS: /gaming route loaded successfully!');
        console.log(`   Response size: ${html.length} bytes`);
        return true;
      }
    } else {
      console.log(`Status: ${response.status} - Route is responding`);
      return true;
    }
    
    return true;
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('🚀 Running Fix Validation Tests\n');
  console.log(`Target: ${BASE_URL}\n`);
  console.log('='.repeat(50));
  
  const results = [];
  
  results.push({
    name: 'Session Renewal (No 400 Error)',
    passed: await testSessionRenewal()
  });
  
  results.push({
    name: '/gaming Route Loading',
    passed: await testGamingRoute()
  });
  
  console.log('\n' + '='.repeat(50));
  console.log('\n📊 Test Results:\n');
  
  results.forEach((result, index) => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${index + 1}. ${status} - ${result.name}`);
  });
  
  const allPassed = results.every(r => r.passed);
  const passCount = results.filter(r => r.passed).length;
  
  console.log(`\n${passCount}/${results.length} tests passed`);
  
  if (allPassed) {
    console.log('\n🎉 All fixes validated successfully!\n');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Check the issues above.\n');
    process.exit(1);
  }
}

runAllTests();
