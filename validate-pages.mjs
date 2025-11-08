#!/usr/bin/env node
/**
 * Server-side Page Validation Script
 * Runs automated checks on all critical pages to ensure they load properly
 */

import fetch from 'node-fetch';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const TEST_SESSION_TOKEN = process.env.TEST_SESSION_TOKEN || null;

const pages = [
  // Public pages that should work without auth
  { path: '/', name: 'Home', expectsAuth: false, critical: true },
  { path: '/trade-v3', name: 'Trade V3', expectsAuth: false, critical: true },
  { path: '/nft-marketplace', name: 'NFT Marketplace', expectsAuth: false, critical: true },
  { path: '/inquisition-gaming-v3', name: 'Gaming V3', expectsAuth: false, critical: true },
  { path: '/newsfeed', name: 'News Feed', expectsAuth: false, critical: false },
  
  // Auth-required pages
  { path: '/wallet-dashboard', name: 'Wallet Dashboard', expectsAuth: true, critical: true },
  { path: '/social/profile', name: 'Social Profile', expectsAuth: true, critical: true },
  { path: '/messaging', name: 'Messaging', expectsAuth: true, critical: true },
  { path: '/battle-dashboard', name: 'Battle Dashboard', expectsAuth: true, critical: false },
  { path: '/weapons-arsenal', name: 'Weapons Arsenal', expectsAuth: true, critical: false }
];

const apiEndpoints = [
  { path: '/api/health', name: 'Health Check', method: 'GET', expectsAuth: false, critical: true },
  { path: '/api/riddle-wallet/session', name: 'Session Check', method: 'GET', expectsAuth: true, critical: true },
  { path: '/api/inquisition-audit/nfts?limit=10', name: 'Gaming NFTs', method: 'GET', expectsAuth: false, critical: true },
  { path: '/api/social/profile', name: 'Social Profile API', method: 'GET', expectsAuth: true, critical: true }
];

async function testPage(page) {
  const url = `${BASE_URL}${page.path}`;
  const headers = {};
  
  if (page.expectsAuth && TEST_SESSION_TOKEN) {
    headers['Authorization'] = `Bearer ${TEST_SESSION_TOKEN}`;
  }
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
      redirect: 'manual', // Don't follow redirects
      timeout: 10000
    });
    
    const success = response.status >= 200 && response.status < 400;
    const isRedirect = response.status >= 300 && response.status < 400;
    
    return {
      name: page.name,
      path: page.path,
      status: response.status,
      success,
      isRedirect,
      redirectTo: response.headers.get('location'),
      expectsAuth: page.expectsAuth,
      critical: page.critical
    };
  } catch (error) {
    return {
      name: page.name,
      path: page.path,
      status: 0,
      success: false,
      error: error.message,
      expectsAuth: page.expectsAuth,
      critical: page.critical
    };
  }
}

async function testAPI(endpoint) {
  const url = `${BASE_URL}${endpoint.path}`;
  const headers = { 'Content-Type': 'application/json' };
  
  if (endpoint.expectsAuth && TEST_SESSION_TOKEN) {
    headers['Authorization'] = `Bearer ${TEST_SESSION_TOKEN}`;
  }
  
  try {
    const response = await fetch(url, {
      method: endpoint.method,
      headers,
      timeout: 10000
    });
    
    const contentType = response.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');
    let body = null;
    
    if (isJson) {
      try {
        body = await response.json();
      } catch (e) {
        body = { error: 'Failed to parse JSON' };
      }
    }
    
    const success = response.status >= 200 && response.status < 400;
    
    return {
      name: endpoint.name,
      path: endpoint.path,
      status: response.status,
      success,
      isJson,
      body,
      expectsAuth: endpoint.expectsAuth,
      critical: endpoint.critical
    };
  } catch (error) {
    return {
      name: endpoint.name,
      path: endpoint.path,
      status: 0,
      success: false,
      error: error.message,
      expectsAuth: endpoint.expectsAuth,
      critical: endpoint.critical
    };
  }
}

async function runTests() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('🧪 PAGE & API VALIDATION TEST SUITE');
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log(`Testing server: ${BASE_URL}`);
  console.log(`Session token: ${TEST_SESSION_TOKEN ? 'PROVIDED' : 'NOT PROVIDED (auth tests will fail)'}\n`);
  
  // Test pages
  console.log('📄 TESTING PAGE LOADS\n');
  console.log('─'.repeat(70));
  
  const pageResults = [];
  for (const page of pages) {
    const result = await testPage(page);
    pageResults.push(result);
    
    const statusEmoji = result.success ? '✅' : (result.isRedirect ? '↪️' : '❌');
    const criticalTag = result.critical ? '[CRITICAL]' : '';
    const authTag = result.expectsAuth ? '[AUTH]' : '[PUBLIC]';
    
    console.log(`${statusEmoji} ${result.name} ${authTag} ${criticalTag}`);
    console.log(`   Status: ${result.status || 'ERROR'}`);
    
    if (result.isRedirect) {
      console.log(`   Redirect: ${result.redirectTo}`);
    }
    
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    
    console.log('');
  }
  
  // Test API endpoints
  console.log('\n🔌 TESTING API ENDPOINTS\n');
  console.log('─'.repeat(70));
  
  const apiResults = [];
  for (const endpoint of apiEndpoints) {
    const result = await testAPI(endpoint);
    apiResults.push(result);
    
    const statusEmoji = result.success ? '✅' : '❌';
    const criticalTag = result.critical ? '[CRITICAL]' : '';
    const authTag = result.expectsAuth ? '[AUTH]' : '[PUBLIC]';
    
    console.log(`${statusEmoji} ${result.name} ${authTag} ${criticalTag}`);
    console.log(`   Status: ${result.status || 'ERROR'}`);
    
    if (result.body) {
      console.log(`   Response: ${JSON.stringify(result.body).substring(0, 100)}...`);
    }
    
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    
    console.log('');
  }
  
  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📊 TEST SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  const allResults = [...pageResults, ...apiResults];
  const total = allResults.length;
  const passed = allResults.filter(r => r.success).length;
  const failed = allResults.filter(r => !r.success && !r.isRedirect).length;
  const redirected = pageResults.filter(r => r.isRedirect).length;
  const criticalFailed = allResults.filter(r => !r.success && r.critical).length;
  
  console.log(`Total Tests:     ${total}`);
  console.log(`Passed:          ${passed} ✅`);
  console.log(`Failed:          ${failed} ❌`);
  console.log(`Redirected:      ${redirected} ↪️`);
  console.log(`Critical Failed: ${criticalFailed} 🚨\n`);
  
  if (criticalFailed > 0) {
    console.log('⚠️  CRITICAL FAILURES DETECTED!\n');
    allResults.filter(r => !r.success && r.critical).forEach(r => {
      console.log(`   - ${r.name} (${r.path}): ${r.error || `Status ${r.status}`}`);
    });
    process.exit(1);
  } else if (failed > 0) {
    console.log('⚠️  Some non-critical tests failed\n');
    process.exit(0);
  } else {
    console.log('✅ ALL TESTS PASSED!\n');
    process.exit(0);
  }
}

// Run tests
runTests().catch(error => {
  console.error('🚨 Test suite crashed:', error);
  process.exit(1);
});
