#!/usr/bin/env node
/**
 * Quick Page Test - Opens pages in browser for visual verification
 * Usage: node quick-test-pages.js
 */

import { exec } from 'child_process';

const BASE_URL = 'http://localhost:5000';

const testPages = [
  // Critical public pages
  { name: 'Home', path: '/', priority: 'HIGH' },
  { name: 'Trade V3', path: '/trade-v3', priority: 'HIGH' },
  { name: 'Gaming V3', path: '/inquisition-gaming-v3', priority: 'HIGH' },
  { name: 'NFT Marketplace', path: '/nft-marketplace', priority: 'HIGH' },
  
  // Critical auth pages (test after login)
  { name: 'Wallet Dashboard', path: '/wallet-dashboard', priority: 'HIGH', requiresAuth: true },
  { name: 'Social Profile', path: '/social/profile', priority: 'HIGH', requiresAuth: true },
  { name: 'Messaging', path: '/messaging', priority: 'HIGH', requiresAuth: true },
  
  // Auth flow
  { name: 'Login', path: '/wallet-login', priority: 'MEDIUM', isAuth: true },
  { name: 'Create Wallet', path: '/create-wallet', priority: 'MEDIUM', isAuth: true },
  
  // Other important pages
  { name: 'News Feed', path: '/newsfeed', priority: 'MEDIUM' },
  { name: 'DexScreener', path: '/dexscreener', priority: 'MEDIUM' },
  { name: 'Liquidity', path: '/liquidity', priority: 'LOW' },
  { name: 'Portfolio', path: '/portfolio', priority: 'LOW', requiresAuth: true },
];

function openInBrowser(url) {
  const command = process.platform === 'win32' ? 'start' :
                  process.platform === 'darwin' ? 'open' : 'xdg-open';
  
  exec(`${command} ${url}`, (error) => {
    if (error) {
      console.error(`Failed to open browser: ${error.message}`);
    }
  });
}

async function runTest() {
  console.log('\n🧪 QUICK PAGE TEST SUITE\n');
  console.log('═'.repeat(70));
  console.log(`\nBase URL: ${BASE_URL}`);
  console.log('\n📝 TESTING INSTRUCTIONS:\n');
  console.log('1. Ensure server is running: npm run dev');
  console.log('2. Pages will open in your default browser');
  console.log('3. Test public pages first (no login required)');
  console.log('4. Then login at /wallet-login');
  console.log('5. Test auth-required pages after login');
  console.log('6. Check browser console for errors\n');
  console.log('═'.repeat(70));
  
  console.log('\n🌐 PUBLIC PAGES (No Authentication Required)\n');
  const publicPages = testPages.filter(p => !p.requiresAuth && !p.isAuth);
  publicPages.forEach((page, i) => {
    const priorityEmoji = page.priority === 'HIGH' ? '🔴' : 
                         page.priority === 'MEDIUM' ? '🟡' : '🟢';
    console.log(`${i + 1}. ${priorityEmoji} ${page.name}`);
    console.log(`   URL: ${BASE_URL}${page.path}`);
    console.log(`   Priority: ${page.priority}\n`);
  });
  
  console.log('\n🔐 AUTH PAGES (Login/Registration)\n');
  const authPages = testPages.filter(p => p.isAuth);
  authPages.forEach((page, i) => {
    console.log(`${i + 1}. ${page.name}`);
    console.log(`   URL: ${BASE_URL}${page.path}\n`);
  });
  
  console.log('\n🔒 PROTECTED PAGES (Requires Authentication)\n');
  const protectedPages = testPages.filter(p => p.requiresAuth);
  protectedPages.forEach((page, i) => {
    const priorityEmoji = page.priority === 'HIGH' ? '🔴' : 
                         page.priority === 'MEDIUM' ? '🟡' : '🟢';
    console.log(`${i + 1}. ${priorityEmoji} ${page.name}`);
    console.log(`   URL: ${BASE_URL}${page.path}`);
    console.log(`   Priority: ${page.priority}\n`);
  });
  
  console.log('═'.repeat(70));
  console.log('\n💡 TIP: Check each page for:\n');
  console.log('  ✅ Page loads without errors');
  console.log('  ✅ Content displays correctly');
  console.log('  ✅ Session state is preserved (if logged in)');
  console.log('  ✅ API calls work (check Network tab)');
  console.log('  ✅ No console errors or warnings\n');
  
  // Ask user if they want to open pages automatically
  console.log('🚀 Ready to start testing?');
  console.log('\nOptions:');
  console.log('  1. Press ENTER to open all HIGH priority pages automatically');
  console.log('  2. Type "all" to open ALL pages');
  console.log('  3. Type "public" to open only public pages');
  console.log('  4. Type "auth" to open only auth-required pages');
  console.log('  5. Type "manual" to test manually\n');
  
  process.stdin.setEncoding('utf8');
  process.stdin.once('data', (input) => {
    const choice = input.trim().toLowerCase();
    
    let pagesToOpen = [];
    
    if (choice === '' || choice === '1') {
      pagesToOpen = testPages.filter(p => p.priority === 'HIGH');
      console.log('\n🚀 Opening HIGH priority pages...\n');
    } else if (choice === 'all' || choice === '2') {
      pagesToOpen = testPages;
      console.log('\n🚀 Opening ALL pages...\n');
    } else if (choice === 'public' || choice === '3') {
      pagesToOpen = publicPages;
      console.log('\n🚀 Opening public pages...\n');
    } else if (choice === 'auth' || choice === '4') {
      pagesToOpen = protectedPages;
      console.log('\n🚀 Opening auth-required pages...\n');
      console.log('⚠️  Make sure you login first!\n');
    } else {
      console.log('\n📖 Manual testing mode - visit pages in your browser\n');
      process.exit(0);
    }
    
    // Open pages with 1 second delay between each
    let delay = 0;
    pagesToOpen.forEach((page, i) => {
      setTimeout(() => {
        console.log(`${i + 1}/${pagesToOpen.length} Opening: ${page.name}`);
        openInBrowser(`${BASE_URL}${page.path}`);
      }, delay);
      delay += 1000; // 1 second between each
    });
    
    setTimeout(() => {
      console.log('\n✅ All pages opened! Check your browser tabs.\n');
      process.exit(0);
    }, delay + 1000);
  });
}

// Check if server is running first
import fetch from 'node-fetch';

async function checkServer() {
  try {
    const response = await fetch(`${BASE_URL}/health`, { timeout: 3000 });
    if (response.ok) {
      return true;
    }
  } catch (error) {
    return false;
  }
  return false;
}

(async () => {
  console.log('\n🔍 Checking if server is running...');
  const serverRunning = await checkServer();
  
  if (!serverRunning) {
    console.log('\n❌ ERROR: Server is not running!');
    console.log('\nPlease start the server first:');
    console.log('  npm run dev\n');
    process.exit(1);
  }
  
  console.log('✅ Server is running!\n');
  await runTest();
})();
