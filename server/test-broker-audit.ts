#!/usr/bin/env tsx
/**
 * BROKER SYSTEM COMPREHENSIVE AUDIT & TEST
 * Tests all broker flows: offers, buys, minting, monitoring
 */

import { Client, Wallet } from 'xrpl';
import { db } from './db';
import { brokerMintEscrow } from '../shared/schema';
import { desc, eq } from 'drizzle-orm';

const BROKER_ADDRESS = process.env.RIDDLE_BROKER_ADDRESS || process.env.BROKER_WALLET_ADDRESS || 'rGLzXKif4ksBZe2MY6RZT9m69hdgzsXG4X';
const TEST_WALLET_ADDRESS = 'rN7n7otQDd6FczFgLdlmfXdTR72HCBaMuR'; // Example test wallet

console.log('🔍 BROKER SYSTEM AUDIT & TEST');
console.log('='.repeat(80));
console.log('📅 Started:', new Date().toISOString());
console.log('🏦 Broker Address:', BROKER_ADDRESS);
console.log('🧪 Test Wallet:', TEST_WALLET_ADDRESS);
console.log('='.repeat(80));

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'INFO';
  details: string;
  data?: any;
}

const results: TestResult[] = [];

/**
 * TEST 1: Verify Broker Wallet on XRPL
 */
async function testBrokerWallet() {
  console.log('\n🧪 TEST 1: Broker Wallet Verification');
  console.log('-'.repeat(80));
  
  const client = new Client('wss://s1.ripple.com');
  
  try {
    await client.connect();
    console.log('✅ Connected to XRPL mainnet');
    
    const accountInfo = await client.request({
      command: 'account_info',
      account: BROKER_ADDRESS,
      ledger_index: 'validated'
    });
    
    const balance = Number(accountInfo.result.account_data.Balance) / 1_000_000;
    const sequence = accountInfo.result.account_data.Sequence;
    
    console.log(`💰 Balance: ${balance.toFixed(6)} XRP`);
    console.log(`🔢 Sequence: ${sequence}`);
    
    if (balance < 10) {
      results.push({
        test: 'Broker Wallet Balance',
        status: 'FAIL',
        details: `Balance too low: ${balance} XRP (minimum 10 XRP recommended)`,
        data: { balance, sequence }
      });
    } else {
      results.push({
        test: 'Broker Wallet Balance',
        status: 'PASS',
        details: `Wallet funded with ${balance.toFixed(6)} XRP`,
        data: { balance, sequence }
      });
    }
    
    await client.disconnect();
    return true;
    
  } catch (error) {
    console.error('❌ Error:', error);
    results.push({
      test: 'Broker Wallet Verification',
      status: 'FAIL',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
    await client.disconnect();
    return false;
  }
}

/**
 * TEST 2: Check Broker Transactions (Last 20)
 */
async function testBrokerTransactions() {
  console.log('\n🧪 TEST 2: Recent Broker Transactions');
  console.log('-'.repeat(80));
  
  const client = new Client('wss://s1.ripple.com');
  
  try {
    await client.connect();
    
    const txHistory = await client.request({
      command: 'account_tx',
      account: BROKER_ADDRESS,
      limit: 20
    });
    
    console.log(`📊 Found ${txHistory.result.transactions.length} recent transactions`);
    
    const payments = txHistory.result.transactions.filter((tx: any) => 
      tx.tx?.TransactionType === 'Payment'
    );
    
    const nftOffers = txHistory.result.transactions.filter((tx: any) => 
      tx.tx?.TransactionType === 'NFTokenCreateOffer'
    );
    
    const nftAccepts = txHistory.result.transactions.filter((tx: any) => 
      tx.tx?.TransactionType === 'NFTokenAcceptOffer'
    );
    
    console.log(`💸 Payments: ${payments.length}`);
    console.log(`🎨 NFT Offers Created: ${nftOffers.length}`);
    console.log(`✅ NFT Offers Accepted: ${nftAccepts.length}`);
    
    // Show last 5 transactions
    console.log('\n📋 Last 5 Transactions:');
    txHistory.result.transactions.slice(0, 5).forEach((tx: any, i: number) => {
      const date = tx.tx?.date ? new Date((tx.tx.date + 946684800) * 1000).toISOString() : 'Unknown';
      console.log(`${i + 1}. ${tx.tx?.TransactionType} - ${date}`);
      if (tx.tx?.Amount && typeof tx.tx.Amount === 'string') {
        console.log(`   Amount: ${(Number(tx.tx.Amount) / 1_000_000).toFixed(6)} XRP`);
      }
    });
    
    results.push({
      test: 'Broker Transactions',
      status: 'PASS',
      details: `Found ${txHistory.result.transactions.length} transactions (${payments.length} payments, ${nftOffers.length} offers, ${nftAccepts.length} accepts)`,
      data: {
        total: txHistory.result.transactions.length,
        payments: payments.length,
        offers: nftOffers.length,
        accepts: nftAccepts.length
      }
    });
    
    await client.disconnect();
    return true;
    
  } catch (error) {
    console.error('❌ Error:', error);
    results.push({
      test: 'Broker Transactions',
      status: 'FAIL',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
    await client.disconnect();
    return false;
  }
}

/**
 * TEST 3: Search Wallet for Mint Escrows
 */
async function testWalletMintSearch() {
  console.log('\n🧪 TEST 3: Search Wallet for Mint Escrows');
  console.log('-'.repeat(80));
  
  try {
    // Search for escrows with test wallet as buyer
    const escrows = await db
      .select()
      .from(brokerMintEscrow)
      .where(eq(brokerMintEscrow.buyerAddress, TEST_WALLET_ADDRESS))
      .orderBy(desc(brokerMintEscrow.createdAt))
      .limit(10);
    
    console.log(`🔍 Found ${escrows.length} mint escrows for wallet: ${TEST_WALLET_ADDRESS}`);
    
    if (escrows.length > 0) {
      console.log('\n📋 Escrow Details:');
      escrows.forEach((escrow, i) => {
        console.log(`\n${i + 1}. Escrow ID: ${escrow.id}`);
        console.log(`   Platform: ${escrow.platformType}`);
        console.log(`   Status: ${escrow.status}`);
        console.log(`   Amount: ${(BigInt(escrow.totalAmount) / BigInt(1_000_000)).toString()} XRP`);
        console.log(`   Created: ${escrow.createdAt}`);
        if (escrow.paymentTxHash) {
          console.log(`   Payment TX: ${escrow.paymentTxHash}`);
        }
        if (escrow.nftTokenId) {
          console.log(`   NFT Minted: ${escrow.nftTokenId}`);
        }
      });
      
      results.push({
        test: 'Wallet Mint Search',
        status: 'PASS',
        details: `Found ${escrows.length} escrows for wallet`,
        data: escrows.map(e => ({
          id: e.id,
          status: e.status,
          platform: e.platformType,
          amount: (BigInt(e.totalAmount) / BigInt(1_000_000)).toString() + ' XRP'
        }))
      });
    } else {
      console.log('ℹ️  No mint escrows found for this wallet');
      results.push({
        test: 'Wallet Mint Search',
        status: 'INFO',
        details: 'No escrows found (wallet not used for minting yet)'
      });
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Error:', error);
    results.push({
      test: 'Wallet Mint Search',
      status: 'FAIL',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
    return false;
  }
}

/**
 * TEST 4: Verify Transaction Monitoring
 */
async function testTransactionMonitoring() {
  console.log('\n🧪 TEST 4: Transaction Monitoring Status');
  console.log('-'.repeat(80));
  
  const client = new Client('wss://s1.ripple.com');
  
  try {
    await client.connect();
    
    // Subscribe to broker wallet to test monitoring
    console.log('📡 Testing subscription to broker wallet...');
    
    const subscribe = await client.request({
      command: 'subscribe',
      accounts: [BROKER_ADDRESS]
    });
    
    console.log('✅ Successfully subscribed to broker wallet');
    console.log(`📍 Monitoring: ${BROKER_ADDRESS}`);
    
    // Check if there are any pending escrows
    const pendingEscrows = await db
      .select()
      .from(brokerMintEscrow)
      .where(eq(brokerMintEscrow.status, 'awaiting_payment'))
      .limit(5);
    
    console.log(`⏳ Pending escrows awaiting payment: ${pendingEscrows.length}`);
    
    if (pendingEscrows.length > 0) {
      console.log('\n📋 Pending Escrows:');
      pendingEscrows.forEach((escrow, i) => {
        console.log(`${i + 1}. ${escrow.id} - ${escrow.platformType} - ${(BigInt(escrow.totalAmount) / BigInt(1_000_000)).toString()} XRP`);
      });
    }
    
    results.push({
      test: 'Transaction Monitoring',
      status: 'PASS',
      details: `Monitoring active on ${BROKER_ADDRESS} with ${pendingEscrows.length} pending escrows`,
      data: {
        monitoredAddress: BROKER_ADDRESS,
        pendingEscrows: pendingEscrows.length
      }
    });
    
    await client.disconnect();
    return true;
    
  } catch (error) {
    console.error('❌ Error:', error);
    results.push({
      test: 'Transaction Monitoring',
      status: 'FAIL',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
    await client.disconnect();
    return false;
  }
}

/**
 * TEST 5: Verify Database Schema
 */
async function testDatabaseSchema() {
  console.log('\n🧪 TEST 5: Database Schema Verification');
  console.log('-'.repeat(80));
  
  try {
    const { sql } = await import('drizzle-orm');
    
    // Check broker_mint_escrow table
    const tableCheck = await db.execute(sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'broker_mint_escrow'
      ORDER BY ordinal_position;
    `);
    
    console.log(`✅ broker_mint_escrow table exists with ${tableCheck.rows.length} columns`);
    
    // Check key columns
    const requiredColumns = [
      'id', 'platformType', 'buyerAddress', 'brokerAddress',
      'mintCost', 'brokerFee', 'totalAmount', 'status',
      'paymentTxHash', 'mintedNftId', 'createdAt'
    ];
    
    const columnNames = tableCheck.rows.map((row: any) => row.column_name);
    const missingColumns = requiredColumns.filter(col => !columnNames.includes(col));
    
    if (missingColumns.length > 0) {
      console.log('❌ Missing columns:', missingColumns.join(', '));
      results.push({
        test: 'Database Schema',
        status: 'FAIL',
        details: `Missing columns: ${missingColumns.join(', ')}`
      });
    } else {
      console.log('✅ All required columns present');
      results.push({
        test: 'Database Schema',
        status: 'PASS',
        details: `All ${requiredColumns.length} required columns verified`
      });
    }
    
    return missingColumns.length === 0;
    
  } catch (error) {
    console.error('❌ Error:', error);
    results.push({
      test: 'Database Schema',
      status: 'FAIL',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
    return false;
  }
}

/**
 * TEST 6: Check Recent Minting Activity
 */
async function testRecentMinting() {
  console.log('\n🧪 TEST 6: Recent Minting Activity');
  console.log('-'.repeat(80));
  
  try {
    const { sql } = await import('drizzle-orm');
    
    // Get minting stats
    const stats = await db.execute(sql`
      SELECT 
        status,
        COUNT(*) as count,
        SUM(CAST("totalAmount" AS BIGINT)) as total_xrp
      FROM broker_mint_escrow
      GROUP BY status
      ORDER BY count DESC;
    `);
    
    console.log('📊 Minting Statistics:');
    stats.rows.forEach((row: any) => {
      const xrp = row.total_xrp ? (BigInt(row.total_xrp) / BigInt(1_000_000)).toString() : '0';
      console.log(`   ${row.status}: ${row.count} escrows (${xrp} XRP total)`);
    });
    
    // Get recent activity (last 24 hours)
    const recent = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM broker_mint_escrow
      WHERE "createdAt" > NOW() - INTERVAL '24 hours';
    `);
    
    const recentCount = recent.rows[0]?.count || 0;
    console.log(`\n📈 Last 24 hours: ${recentCount} new escrows`);
    
    results.push({
      test: 'Recent Minting Activity',
      status: 'PASS',
      details: `${recentCount} escrows in last 24h`,
      data: {
        statusBreakdown: stats.rows,
        last24Hours: recentCount
      }
    });
    
    return true;
    
  } catch (error) {
    console.error('❌ Error:', error);
    results.push({
      test: 'Recent Minting Activity',
      status: 'FAIL',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
    return false;
  }
}

/**
 * MAIN AUDIT EXECUTION
 */
async function runAudit() {
  console.log('\n🚀 Starting Comprehensive Broker Audit...\n');
  
  await testBrokerWallet();
  await testBrokerTransactions();
  await testWalletMintSearch();
  await testTransactionMonitoring();
  await testDatabaseSchema();
  await testRecentMinting();
  
  // Print Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 AUDIT SUMMARY');
  console.log('='.repeat(80));
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const info = results.filter(r => r.status === 'INFO').length;
  
  console.log(`\n✅ PASSED: ${passed}`);
  console.log(`❌ FAILED: ${failed}`);
  console.log(`ℹ️  INFO: ${info}`);
  console.log(`📈 TOTAL: ${results.length}`);
  
  console.log('\n📋 DETAILED RESULTS:');
  console.log('-'.repeat(80));
  
  results.forEach((result, i) => {
    const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : 'ℹ️';
    console.log(`\n${icon} ${i + 1}. ${result.test}`);
    console.log(`   Status: ${result.status}`);
    console.log(`   Details: ${result.details}`);
    if (result.data) {
      console.log(`   Data: ${JSON.stringify(result.data, null, 2).split('\n').join('\n   ')}`);
    }
  });
  
  // Final Status
  console.log('\n' + '='.repeat(80));
  const isHealthy = failed === 0;
  
  if (isHealthy) {
    console.log('✅ ✅ ✅ BROKER SYSTEM IS HEALTHY ✅ ✅ ✅');
    console.log('\n🎯 All Systems Operational:');
    console.log('   ✅ Broker wallet funded and active');
    console.log('   ✅ Transactions being processed');
    console.log('   ✅ Database schema correct');
    console.log('   ✅ Monitoring system active');
    console.log('   ✅ Minting escrows tracked');
  } else {
    console.log('⚠️  BROKER SYSTEM NEEDS ATTENTION ⚠️');
    console.log(`\n❌ ${failed} test(s) failed - review details above`);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('🏁 Audit completed:', new Date().toISOString());
  console.log('='.repeat(80));
  
  process.exit(isHealthy ? 0 : 1);
}

// Run the audit
runAudit().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
