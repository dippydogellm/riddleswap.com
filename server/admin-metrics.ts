// Admin Metrics Service
// Provides comprehensive platform metrics for admin dashboard

import { db } from './db';
import { 
  swapHistory, 
  bridgeTransactions, 
  feeTransactions, 
  rewards, 
  walletConnections,
  users,
  riddleWallets,
  posts
} from '../shared/schema';
import { desc, eq, count, sum, sql, gte } from 'drizzle-orm';

export class AdminMetricsService {
  
  // Get comprehensive platform overview
  async getPlatformOverview() {
    console.log('📊 [ADMIN METRICS] Fetching platform overview...');
    
    try {
      // Get total counts
      const [totalUsers] = await db.select({ count: count() }).from(users);
      const [totalWallets] = await db.select({ count: count() }).from(riddleWallets);
      const [totalSwaps] = await db.select({ count: count() }).from(swapHistory);
      const [totalBridges] = await db.select({ count: count() }).from(bridgeTransactions);
      const [totalFeeTransactions] = await db.select({ count: count() }).from(feeTransactions);
      
      // Get total platform fees collected (in USD)
      const [totalFeesUSD] = await db.select({ 
        total: sql<string>`COALESCE(SUM(CAST(fee_usd_value AS DECIMAL)), 0)` 
      }).from(feeTransactions);
      
      // Get total rewards distributed (in USD)
      const [totalRewardsUSD] = await db.select({ 
        total: sql<string>`COALESCE(SUM(CAST(reward_usd_value AS DECIMAL)), 0)` 
      }).from(feeTransactions);

      return {
        users: totalUsers.count,
        wallets: totalWallets.count,
        swaps: totalSwaps.count,
        bridges: totalBridges.count,
        feeTransactions: totalFeeTransactions.count,
        totalFeesCollectedUSD: parseFloat(totalFeesUSD.total || '0'),
        totalRewardsDistributedUSD: parseFloat(totalRewardsUSD.total || '0'),
        netPlatformRevenueUSD: parseFloat(totalFeesUSD.total || '0') - parseFloat(totalRewardsUSD.total || '0')
      };
    } catch (error) {
      console.error('❌ [ADMIN METRICS] Error fetching platform overview:', error);
      throw error;
    }
  }

  // Get swap metrics and analytics
  async getSwapMetrics() {
    console.log('📊 [ADMIN METRICS] Fetching swap metrics...');
    
    try {
      // Total swap volume in USD
      const [totalVolumeUSD] = await db.select({ 
        total: sql<string>`COALESCE(SUM(CAST(total_value_usd AS DECIMAL)), 0)` 
      }).from(swapHistory);
      
      // Swaps by status
      const swapsByStatus = await db.select({
        status: swapHistory.status,
        count: count()
      }).from(swapHistory).groupBy(swapHistory.status);
      
      // Swaps by chain
      const swapsByChain = await db.select({
        chain: swapHistory.chain,
        count: count(),
        volume: sql<string>`COALESCE(SUM(CAST(total_value_usd AS DECIMAL)), 0)`
      }).from(swapHistory).groupBy(swapHistory.chain);
      
      // Recent swaps (last 24 hours)
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentSwaps = await db.select()
        .from(swapHistory)
        .where(gte(swapHistory.created_at, yesterday))
        .orderBy(desc(swapHistory.created_at))
        .limit(10);

      return {
        totalVolumeUSD: parseFloat(totalVolumeUSD.total || '0'),
        swapsByStatus,
        swapsByChain: swapsByChain.map(item => ({
          chain: item.chain,
          count: item.count,
          volumeUSD: parseFloat(item.volume || '0')
        })),
        recentSwaps
      };
    } catch (error) {
      console.error('❌ [ADMIN METRICS] Error fetching swap metrics:', error);
      throw error;
    }
  }

  // Get bridge metrics and analytics
  async getBridgeMetrics() {
    console.log('📊 [ADMIN METRICS] Fetching bridge metrics...');
    
    try {
      // Total bridge volume
      const [totalBridgeVolume] = await db.select({ 
        total: sql<string>`COALESCE(SUM(CAST(input_amount AS DECIMAL)), 0)` 
      }).from(bridgeTransactions);
      
      // Bridge transactions by status
      const bridgesByStatus = await db.select({
        status: bridgeTransactions.status,
        count: count()
      }).from(bridgeTransactions).groupBy(bridgeTransactions.status);
      
      // Bridge transactions by chain pairs
      const bridgesByChainPair = await db.select({
        sourceChain: bridgeTransactions.source_chain,
        destinationChain: bridgeTransactions.destination_chain,
        count: count(),
        totalVolume: sql<string>`COALESCE(SUM(CAST(input_amount AS DECIMAL)), 0)`
      }).from(bridgeTransactions).groupBy(bridgeTransactions.source_chain, bridgeTransactions.destination_chain);
      
      // Recent bridge transactions
      const recentBridges = await db.select()
        .from(bridgeTransactions)
        .orderBy(desc(bridgeTransactions.created_at))
        .limit(10);

      return {
        totalBridgeVolume: parseFloat(totalBridgeVolume.total || '0'),
        bridgesByStatus,
        bridgesByChainPair: bridgesByChainPair.map(item => ({
          sourceChain: item.sourceChain,
          destinationChain: item.destinationChain,
          count: item.count,
          totalVolume: parseFloat(item.totalVolume || '0')
        })),
        recentBridges
      };
    } catch (error) {
      console.error('❌ [ADMIN METRICS] Error fetching bridge metrics:', error);
      throw error;
    }
  }

  // Get wallet and user analytics
  async getWalletMetrics() {
    console.log('📊 [ADMIN METRICS] Fetching wallet metrics...');
    
    try {
      // Get riddle wallets count
      const [riddleWalletsCount] = await db.select({ count: count() }).from(riddleWallets);
      
      // Get wallet connections by chain (actual distribution)
      const walletsByChain = await db.select({
        chain: walletConnections.chain,
        count: sql<number>`COUNT(DISTINCT wallet_address)`
      }).from(walletConnections).groupBy(walletConnections.chain);
      
      // Active vs inactive wallet connections
      const [activeConnections] = await db.select({ 
        count: count() 
      }).from(walletConnections).where(eq(walletConnections.is_active, true));
      
      // Recent wallet activity
      const recentActivity = await db.select()
        .from(walletConnections)
        .orderBy(desc(walletConnections.last_used))
        .limit(10);

      // Get Riddle wallet creation activity (24h)
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [newRiddleWallets24h] = await db.select({ count: count() })
        .from(riddleWallets)
        .where(gte(riddleWallets.createdAt, yesterday));

      return {
        totalRiddleWallets: riddleWalletsCount.count,
        activeWalletConnections: activeConnections.count,
        walletsByChain,
        recentActivity,
        newWallets24h: newRiddleWallets24h.count
      };
    } catch (error) {
      console.error('❌ [ADMIN METRICS] Error fetching wallet metrics:', error);
      throw error;
    }
  }

  // Get fee and revenue analytics
  async getRevenueMetrics() {
    console.log('📊 [ADMIN METRICS] Fetching revenue metrics...');
    
    try {
      // Revenue by chain
      const revenueByChain = await db.select({
        chain: feeTransactions.source_chain,
        totalFeesUSD: sql<string>`COALESCE(SUM(CAST(fee_usd_value AS DECIMAL)), 0)`,
        totalRewardsUSD: sql<string>`COALESCE(SUM(CAST(reward_usd_value AS DECIMAL)), 0)`,
        transactionCount: count()
      }).from(feeTransactions).groupBy(feeTransactions.source_chain);
      
      // Revenue by operation type
      const revenueByOperation = await db.select({
        operationType: feeTransactions.operation_type,
        totalFeesUSD: sql<string>`COALESCE(SUM(CAST(fee_usd_value AS DECIMAL)), 0)`,
        transactionCount: count()
      }).from(feeTransactions).groupBy(feeTransactions.operation_type);
      
      // Daily revenue (last 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const dailyRevenue = await db.select({
        date: sql<string>`DATE(created_at)`,
        totalFeesUSD: sql<string>`COALESCE(SUM(CAST(fee_usd_value AS DECIMAL)), 0)`,
        transactionCount: count()
      }).from(feeTransactions)
        .where(gte(feeTransactions.created_at, sevenDaysAgo))
        .groupBy(sql`DATE(created_at)`)
        .orderBy(sql`DATE(created_at)`);

      return {
        revenueByChain: revenueByChain.map(item => ({
          chain: item.chain,
          totalFeesUSD: parseFloat(item.totalFeesUSD || '0'),
          totalRewardsUSD: parseFloat(item.totalRewardsUSD || '0'),
          netRevenueUSD: parseFloat(item.totalFeesUSD || '0') - parseFloat(item.totalRewardsUSD || '0'),
          transactionCount: item.transactionCount
        })),
        revenueByOperation: revenueByOperation.map(item => ({
          operationType: item.operationType,
          totalFeesUSD: parseFloat(item.totalFeesUSD || '0'),
          transactionCount: item.transactionCount
        })),
        dailyRevenue: dailyRevenue.map(item => ({
          date: item.date,
          totalFeesUSD: parseFloat(item.totalFeesUSD || '0'),
          transactionCount: item.transactionCount
        }))
      };
    } catch (error) {
      console.error('❌ [ADMIN METRICS] Error fetching revenue metrics:', error);
      throw error;
    }
  }

  // Get comprehensive platform activity metrics
  async getActivityMetrics() {
    console.log('📊 [ADMIN METRICS] Fetching activity metrics...');
    
    try {
      // Server uptime
      const uptimeSeconds = process.uptime();
      const uptimeFormatted = uptimeSeconds > 3600 
        ? `${Math.floor(uptimeSeconds / 3600)}h ${Math.floor((uptimeSeconds % 3600) / 60)}m`
        : `${Math.floor(uptimeSeconds / 60)}m`;
      
      // Memory usage
      const memoryUsage = process.memoryUsage();
      const memoryUsedMB = (memoryUsage.heapUsed / 1024 / 1024).toFixed(1);

      // Get latest transaction times for context
      const [latestSwap] = await db.select({ created_at: swapHistory.created_at })
        .from(swapHistory)
        .orderBy(desc(swapHistory.created_at))
        .limit(1);
      
      const [latestBridge] = await db.select({ created_at: bridgeTransactions.created_at })
        .from(bridgeTransactions)
        .orderBy(desc(bridgeTransactions.created_at))
        .limit(1);
      
      // Comprehensive activity in last 24 hours
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const [swapsLast24h] = await db.select({ count: count() })
        .from(swapHistory)
        .where(gte(swapHistory.created_at, yesterday));
      
      const [bridgesLast24h] = await db.select({ count: count() })
        .from(bridgeTransactions)
        .where(gte(bridgeTransactions.created_at, yesterday));
      
      const [newWalletConnectionsLast24h] = await db.select({ count: count() })
        .from(walletConnections)
        .where(gte(walletConnections.created_at, yesterday));
      
      const [newRiddleWalletsLast24h] = await db.select({ count: count() })
        .from(riddleWallets)
        .where(gte(riddleWallets.createdAt, yesterday));
      
      // Get recent posts activity
      const [socialActivityLast24h] = await db.select({ count: count() })
        .from(posts)
        .where(gte(posts.createdAt, yesterday));
      
      // Fee collection in last 24h
      const [feesLast24h] = await db.select({ 
        total: sql<string>`COALESCE(SUM(CAST(fee_usd_value AS DECIMAL)), 0)` 
      }).from(feeTransactions).where(gte(feeTransactions.created_at, yesterday));

      return {
        serverUptime: uptimeFormatted,
        memoryUsageMB: memoryUsedMB,
        activity24h: {
          swaps: swapsLast24h.count,
          bridges: bridgesLast24h.count,
          newWalletConnections: newWalletConnectionsLast24h.count,
          newRiddleWallets: newRiddleWalletsLast24h.count,
          socialPosts: socialActivityLast24h.count,
          feesCollectedUSD: parseFloat(feesLast24h.total || '0')
        },
        lastActivity: {
          lastSwap: latestSwap?.created_at || null,
          lastBridge: latestBridge?.created_at || null
        }
      };
    } catch (error) {
      console.error('❌ [ADMIN METRICS] Error fetching activity metrics:', error);
      throw error;
    }
  }

  // Get all metrics in one call
  async getAllMetrics() {
    console.log('📊 [ADMIN METRICS] Fetching comprehensive admin metrics...');
    
    try {
      const [overview, swaps, bridges, wallets, revenue, activity] = await Promise.all([
        this.getPlatformOverview(),
        this.getSwapMetrics(),
        this.getBridgeMetrics(),
        this.getWalletMetrics(),
        this.getRevenueMetrics(),
        this.getActivityMetrics()
      ]);

      return {
        overview,
        swaps,
        bridges,
        wallets,
        revenue,
        activity,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ [ADMIN METRICS] Error fetching all metrics:', error);
      throw error;
    }
  }
}

// API Downtime Monitor
export class ApiMonitorService {
  private apiEndpoints = [
    { name: 'DexScreener', url: 'https://api.dexscreener.com/latest/dex/tokens/rXRP', chain: 'XRPL' },
    { name: 'Jupiter (Solana)', url: 'https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=1000000', chain: 'Solana' },
    { name: '1inch (Ethereum)', url: 'https://api.1inch.dev/swap/v6.0/1/healthcheck', chain: 'Ethereum' },
    { name: 'Bithomp XRPL', url: 'https://api.bithomp.com/api/v2/server_info', chain: 'XRPL' },
    { name: 'CoinGecko', url: 'https://api.coingecko.com/api/v3/ping', chain: 'All' }
  ];

  async checkApiStatus() {
    console.log('🔍 [API MONITOR] Checking API status...');
    const results = [];

    for (const api of this.apiEndpoints) {
      try {
        const startTime = Date.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(api.url, { 
          method: 'GET',
          signal: controller.signal,
          headers: { 'User-Agent': 'RiddleSwap/1.0' }
        });
        
        clearTimeout(timeoutId);
        const responseTime = Date.now() - startTime;
        
        const status = {
          name: api.name,
          chain: api.chain,
          status: response.ok ? 'online' : 'error',
          responseTime,
          statusCode: response.status,
          error: response.ok ? null : `HTTP ${response.status}: ${response.statusText}`,
          lastChecked: new Date().toISOString()
        };
        
        if (!response.ok) {
          console.error(`❌ [API MONITOR] ${api.name} failed: HTTP ${response.status}`);
        }
        
        results.push(status);
      } catch (error: any) {
        const errorStatus = {
          name: api.name,
          chain: api.chain,
          status: 'offline',
          responseTime: null,
          statusCode: null,
          error: error.message || 'Connection failed',
          lastChecked: new Date().toISOString()
        };
        
        console.error(`❌ [API MONITOR] ${api.name} offline: ${error.message}`);
        results.push(errorStatus);
      }
    }
    
    return results;
  }
}

export const adminMetricsService = new AdminMetricsService();
export const apiMonitorService = new ApiMonitorService();