// Admin Routes
// Comprehensive admin dashboard endpoints for dippydoge user only

import express from 'express';
import { requireAuthentication, type AuthenticatedRequest } from './middleware/session-auth';
import { requireAdminAccess, isAdminUser } from './middleware/admin-auth';
import { adminMetricsService, apiMonitorService } from './admin-metrics';
import { nftRewardsService } from './nft-rewards-service';
import { db } from './db';
import { swapHistory, bridgeTransactions, walletConnections, riddleWallets, userActivityTracking, monthlyRewardDistributions, nftRewards, nftRewardTransfers } from '../shared/schema';
import { desc, sql, eq, or, and } from 'drizzle-orm';

const router = express.Router();

// Apply authentication to all routes
router.use(requireAuthentication);

/**
 * Check if current user has admin access (for frontend auth check)
 * This endpoint is available to ALL authenticated users (no admin requirement)
 */
router.get('/check', async (req: AuthenticatedRequest, res) => {
  try {
    const userHandle = req.user?.userHandle;
    
    const response = {
      success: true,
      isAdmin: userHandle ? isAdminUser(userHandle) : false,
      user: userHandle,
      timestamp: new Date().toISOString()
    };
    
    console.log('✅ [ADMIN CHECK] Admin access check for user:', userHandle);
    res.json(response);

  } catch (error) {
    console.error('❌ [ADMIN API] Error checking admin access:', error);
    res.status(500).json({ 
      error: 'Failed to check admin access',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Apply admin access requirement to remaining routes
router.use(requireAdminAccess);


/**
 * Get comprehensive platform metrics overview
 */
router.get('/metrics/overview', async (req: AuthenticatedRequest, res) => {
  try {
    console.log('📊 [ADMIN API] Fetching comprehensive platform metrics...');
    const metrics = await adminMetricsService.getAllMetrics();
    
    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [ADMIN API] Error fetching overview metrics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch platform metrics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get swap-specific metrics and analytics
 */
router.get('/metrics/swaps', async (req: AuthenticatedRequest, res) => {
  try {
    console.log('📊 [ADMIN API] Fetching swap metrics...');
    const swapMetrics = await adminMetricsService.getSwapMetrics();
    
    res.json({
      success: true,
      data: swapMetrics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [ADMIN API] Error fetching swap metrics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch swap metrics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get bridge-specific metrics and analytics
 */
router.get('/metrics/bridges', async (req: AuthenticatedRequest, res) => {
  try {
    console.log('📊 [ADMIN API] Fetching bridge metrics...');
    const bridgeMetrics = await adminMetricsService.getBridgeMetrics();
    
    res.json({
      success: true,
      data: bridgeMetrics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [ADMIN API] Error fetching bridge metrics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch bridge metrics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get wallet and user analytics
 */
router.get('/metrics/wallets', async (req: AuthenticatedRequest, res) => {
  try {
    console.log('📊 [ADMIN API] Fetching wallet metrics...');
    const walletMetrics = await adminMetricsService.getWalletMetrics();
    
    res.json({
      success: true,
      data: walletMetrics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [ADMIN API] Error fetching wallet metrics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch wallet metrics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get revenue and fee analytics
 */
router.get('/metrics/revenue', async (req: AuthenticatedRequest, res) => {
  try {
    console.log('📊 [ADMIN API] Fetching revenue metrics...');
    const revenueMetrics = await adminMetricsService.getRevenueMetrics();
    
    res.json({
      success: true,
      data: revenueMetrics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [ADMIN API] Error fetching revenue metrics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch revenue metrics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get platform activity and system health metrics
 */
router.get('/metrics/activity', async (req: AuthenticatedRequest, res) => {
  try {
    console.log('📊 [ADMIN API] Fetching activity metrics...');
    const activityMetrics = await adminMetricsService.getActivityMetrics();
    
    res.json({
      success: true,
      data: activityMetrics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [ADMIN API] Error fetching activity metrics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch activity metrics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * API Status Monitoring - checks if external APIs are operational
 */
router.get('/api/status', async (req: AuthenticatedRequest, res) => {
  try {
    console.log('🔍 [ADMIN API] Checking API status...');
    const apiStatus = await apiMonitorService.checkApiStatus();
    res.json({
      success: true,
      apis: apiStatus,
      timestamp: new Date().toISOString(),
      summary: {
        total: apiStatus.length,
        online: apiStatus.filter(api => api.status === 'online').length,
        offline: apiStatus.filter(api => api.status === 'offline').length,
        errors: apiStatus.filter(api => api.status === 'error').length
      }
    });
  } catch (error) {
    console.error('❌ [ADMIN API] Error checking API status:', error);
    res.status(500).json({ 
      error: 'Failed to check API status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Real-time activity feed for comprehensive monitoring
 */
router.get('/activity/live', async (req: AuthenticatedRequest, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    console.log('📡 [ADMIN API] Fetching live activity feed...');
    
    // Get recent activity from multiple sources
    const recentSwaps = await db.select({
      type: sql<string>`'swap'`,
      data: sql<any>`json_build_object('chain', chain, 'from_token', from_token_symbol, 'to_token', to_token_symbol, 'amount_usd', total_value_usd)`,
      timestamp: swapHistory.created_at
    }).from(swapHistory).orderBy(desc(swapHistory.created_at)).limit(20);
    
    const recentBridges = await db.select({
      type: sql<string>`'bridge'`,
      data: sql<any>`json_build_object('source_chain', source_chain, 'dest_chain', destination_chain, 'amount', input_amount, 'status', status)`,
      timestamp: bridgeTransactions.created_at
    }).from(bridgeTransactions).orderBy(desc(bridgeTransactions.created_at)).limit(20);
    
    const recentWallets = await db.select({
      type: sql<string>`'wallet_connection'`,
      data: sql<any>`json_build_object('chain', chain, 'address', wallet_address)`,
      timestamp: walletConnections.created_at
    }).from(walletConnections).orderBy(desc(walletConnections.created_at)).limit(10);
    
    // Combine and sort by timestamp
    const allActivity = [...recentSwaps, ...recentBridges, ...recentWallets]
      .filter(item => item.timestamp !== null) // Only include items with timestamps
      .sort((a, b) => {
        const timestampA = a.timestamp ? new Date(a.timestamp) : new Date(0);
        const timestampB = b.timestamp ? new Date(b.timestamp) : new Date(0);
        return timestampB.getTime() - timestampA.getTime();
      })
      .slice(0, limit);
      
    res.json({
      success: true,
      activity: allActivity,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [ADMIN API] Error fetching live activity:', error);
    res.status(500).json({ error: 'Failed to fetch activity feed' });
  }
});

/**
 * Get active user sessions
 */
router.get('/sessions', async (req: AuthenticatedRequest, res) => {
  try {
    console.log('📊 [ADMIN API] Fetching user sessions...');
    
    // Query active sessions from database
    const sessions = await db.execute(sql`
      SELECT 
        sess->'user'->>'userHandle' as user_handle,
        sess->'user'->>'walletAddress' as wallet_address,
        sess->>'lastActive' as last_active,
        expire,
        sid
      FROM sessions 
      WHERE expire > NOW() 
      ORDER BY expire DESC
    `);

    const sessionData = sessions.rows.map((session: any) => ({
      userHandle: session.user_handle || 'Unknown',
      walletAddress: session.wallet_address || 'Not connected',
      lastActive: session.last_active ? new Date(session.last_active) : new Date(),
      expires: new Date(session.expire),
      sessionId: session.sid
    }));

    res.json({
      success: true,
      sessions: sessionData,
      summary: {
        activeSessions: sessionData.length,
        authenticatedUsers: sessionData.filter(s => s.userHandle !== 'Unknown').length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [ADMIN API] Error fetching sessions:', error);
    res.status(500).json({ 
      error: 'Failed to fetch user sessions',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Wallet Query - get all transactions for a specific wallet address
 */
router.get('/wallet/query', async (req: AuthenticatedRequest, res) => {
  try {
    const { address } = req.query;
    
    if (!address || typeof address !== 'string') {
      return res.status(400).json({ 
        error: 'Wallet address is required',
        message: 'Please provide a valid wallet address'
      });
    }

    console.log(`🔍 [ADMIN API] Querying wallet: ${address}`);
    
    // Query swaps for this wallet address
    const swaps = await db.select({
      id: swapHistory.id,
      type: sql<string>`'swap'`,
      chain: swapHistory.chain,
      from_token_symbol: swapHistory.from_token_symbol,
      to_token_symbol: swapHistory.to_token_symbol,
      status: swapHistory.status,
      transaction_hash: swapHistory.transaction_hash,
      value_usd: swapHistory.total_value_usd,
      fee_usd: swapHistory.platform_fee_usd,
      created_at: swapHistory.created_at,
      from_amount: swapHistory.from_amount,
      to_amount: swapHistory.to_amount
    })
    .from(swapHistory)
    .where(eq(swapHistory.wallet_address, address))
    .orderBy(desc(swapHistory.created_at));

    // Query bridges from bridge_payloads (where the real data is)
    const bridges = await db.execute(sql`
      SELECT 
        id,
        'bridge' as type,
        'bridge' as chain,
        'bridge' as source_chain,
        'bridge' as destination_chain,
        status,
        tx_hash as transaction_hash,
        amount as value_usd,
        fee_amount as fee_usd,
        createdat as created_at,
        amount as input_amount,
        outputamount as output_amount
      FROM bridge_payloads
      WHERE userwalletaddress = ${address}
      ORDER BY createdat DESC
    `);

    // Check if this is a Riddle wallet
    const riddleWallet = await db.select()
      .from(riddleWallets)
      .where(
        or(
          eq(riddleWallets.ethAddress, address),
          eq(riddleWallets.xrpAddress, address),
          eq(riddleWallets.solAddress, address),
          eq(riddleWallets.btcAddress, address)
        )
      )
      .limit(1);

    // Check wallet connections
    const walletConnectionsList = await db.select()
      .from(walletConnections)
      .where(eq(walletConnections.wallet_address, address))
      .orderBy(desc(walletConnections.created_at));

    // Process bridge results from raw SQL
    const bridgesList = bridges.rows.map((row: any) => ({
      id: row.id,
      type: 'bridge',
      chain: 'bridge',
      source_chain: 'bridge',
      destination_chain: 'bridge',
      status: row.status,
      transaction_hash: row.transaction_hash,
      value_usd: row.value_usd,
      fee_usd: row.fee_usd,
      created_at: row.created_at,
      input_amount: row.input_amount,
      output_amount: row.output_amount
    }));

    // Combine all transactions and sort by timestamp
    const allTransactions = [...swaps, ...bridgesList]
      .sort((a, b) => {
        const timestampA = a.created_at ? new Date(a.created_at) : new Date(0);
        const timestampB = b.created_at ? new Date(b.created_at) : new Date(0);
        return timestampB.getTime() - timestampA.getTime();
      });

    // Calculate summary statistics
    const summary = {
      totalSwaps: swaps.length,
      totalBridges: bridgesList.length,
      totalVolumeUSD: allTransactions.reduce((sum, tx) => sum + (parseFloat(tx.value_usd?.toString() || '0') || 0), 0),
      totalFeesUSD: allTransactions.reduce((sum, tx) => sum + (parseFloat(tx.fee_usd?.toString() || '0') || 0), 0),
      isRiddleWallet: riddleWallet.length > 0,
      walletConnections: walletConnectionsList.length
    };

    console.log(`📊 [ADMIN API] Wallet query complete: ${swaps.length} swaps, ${bridgesList.length} bridges`);
    
    res.json({
      success: true,
      address,
      summary,
      transactions: allTransactions,
      walletConnections: walletConnectionsList,
      riddleWallet: riddleWallet[0] || null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [ADMIN API] Error querying wallet:', error);
    res.status(500).json({ 
      error: 'Failed to query wallet',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get leaderboard data - top traders, time spent, social media leaders
 */
router.get('/leaderboard', async (req: AuthenticatedRequest, res) => {
  try {
    console.log('🏆 [ADMIN API] Fetching leaderboard data...');
    
    // Top traders by transaction volume and count - using real bridge data from bridge_payloads
    const topTradersData = await db.execute(sql`
      WITH user_stats AS (
        SELECT 
          wallet_address,
          COUNT(*) as total_transactions,
          SUM(COALESCE(total_value_usd::numeric, 0)) as total_volume_usd,
          COUNT(CASE WHEN chain IS NOT NULL THEN 1 END) as swap_count,
          0 as bridge_count
        FROM swap_history 
        WHERE status = 'completed'
        GROUP BY wallet_address
        
        UNION ALL
        
        SELECT 
          userwalletaddress as wallet_address,
          COUNT(*) as total_transactions,
          SUM(COALESCE(amount::numeric, 0)) as total_volume_usd,
          0 as swap_count,
          COUNT(*) as bridge_count
        FROM bridge_payloads
        WHERE status = 'completed'
        GROUP BY userwalletaddress
      ),
      combined_stats AS (
        SELECT 
          wallet_address,
          SUM(total_transactions) as total_transactions,
          SUM(total_volume_usd) as total_volume_usd,
          SUM(swap_count) as swap_count,
          SUM(bridge_count) as bridge_count
        FROM user_stats
        GROUP BY wallet_address
        HAVING SUM(total_transactions) > 0
      )
      SELECT 
        wallet_address,
        total_transactions,
        total_volume_usd,
        swap_count,
        bridge_count
      FROM combined_stats
      ORDER BY total_volume_usd DESC
      LIMIT 10
    `);

    // For time spent tracking, we need to first check if the tracking table exists
    let timeSpentData: any = [];
    try {
      const timeSpentResult = await db.execute(sql`
        SELECT 
          user_handle as "userHandle",
          total_time_minutes,
          session_count,
          last_active,
          CASE 
            WHEN total_time_minutes >= 1440 THEN CONCAT(FLOOR(total_time_minutes / 1440), 'd ', FLOOR((total_time_minutes % 1440) / 60), 'h ', (total_time_minutes % 60), 'm')
            WHEN total_time_minutes >= 60 THEN CONCAT(FLOOR(total_time_minutes / 60), 'h ', (total_time_minutes % 60), 'm')
            ELSE CONCAT(total_time_minutes, 'm')
          END as total_time_formatted
        FROM user_activity_tracking
        ORDER BY total_time_minutes DESC
        LIMIT 10
      `);
      timeSpentData = timeSpentResult.rows || [];
    } catch (timeError) {
      console.log('⚠️ [ADMIN API] User activity tracking table not found, returning empty data');
    }

    res.json({
      success: true,
      topTraders: topTradersData.rows.map((row: any) => ({
        wallet_address: row.wallet_address,
        totalTransactions: parseInt(row.total_transactions),
        totalVolumeUSD: parseFloat(row.total_volume_usd),
        swapCount: parseInt(row.swap_count),
        bridgeCount: parseInt(row.bridge_count)
      })),
      timeSpent: Array.isArray(timeSpentData) ? timeSpentData : (timeSpentData as any)?.rows || [],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [ADMIN API] Error fetching leaderboard:', error);
    res.status(500).json({ 
      error: 'Failed to fetch leaderboard data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ADMIN FUNCTION: Fix broken XRPL addresses
router.post('/fix-broken-xrpl-addresses', async (req: AuthenticatedRequest, res) => {
  try {
    console.log('🔧 [ADMIN] Starting XRPL address repair process...');
    
    // Import XRPL library
    const { Wallet: XRPLWallet } = await import('xrpl');
    
    // Get all wallets with invalid XRPL addresses (shorter than 33 characters)
    const brokenWallets = await db.execute(sql`
      SELECT id, handle, xrp_address, LENGTH(xrp_address) as addr_length
      FROM riddle_wallets 
      WHERE xrp_address IS NOT NULL 
      AND LENGTH(xrp_address) < 33
      ORDER BY created_at
    `);
    
    console.log(`🔍 [ADMIN] Found ${brokenWallets.rows.length} wallets with invalid XRPL addresses`);
    
    const fixedWallets = [];
    
    // Fix each broken wallet
    for (const wallet of brokenWallets.rows) {
      const walletData = wallet as any;
      console.log(`🔧 [ADMIN] Fixing wallet: ${walletData.handle} (${walletData.xrp_address})`);
      
      // Generate new valid XRPL address
      const newXrpWallet = XRPLWallet.generate();
      const newXrpAddress = newXrpWallet.address;
      
      // Verify new address is valid (33-34 characters, starts with 'r')
      if (newXrpAddress.length < 33 || newXrpAddress.length > 34 || !newXrpAddress.startsWith('r')) {
        throw new Error(`Generated invalid XRPL address: ${newXrpAddress}`);
      }
      
      // Update the wallet record
      const updateResult = await db.execute(sql`
        UPDATE riddle_wallets 
        SET xrp_address = ${newXrpAddress},
            updated_at = NOW()
        WHERE id = ${walletData.id}
      `);
      
      fixedWallets.push({
        handle: walletData.handle,
        oldAddress: walletData.xrp_address,
        newAddress: newXrpAddress,
        oldLength: walletData.addr_length,
        newLength: newXrpAddress.length
      });
      
      console.log(`✅ [ADMIN] Fixed ${walletData.handle}: ${walletData.xrp_address} → ${newXrpAddress}`);
    }
    
    // Verify all fixes
    const verificationResult = await db.execute(sql`
      SELECT 
        COUNT(*) as total_wallets,
        COUNT(CASE WHEN LENGTH(xrp_address) >= 33 THEN 1 END) as valid_addresses,
        COUNT(CASE WHEN LENGTH(xrp_address) < 33 THEN 1 END) as invalid_addresses
      FROM riddle_wallets 
      WHERE xrp_address IS NOT NULL
    `);
    
    const verification = verificationResult.rows[0] as any;
    
    console.log('🎉 [ADMIN] XRPL address repair completed successfully!');
    
    res.json({
      success: true,
      message: 'XRPL addresses fixed successfully',
      summary: {
        walletsFixed: fixedWallets.length,
        totalWallets: verification.total_wallets,
        validAddresses: verification.valid_addresses,
        invalidAddresses: verification.invalid_addresses
      },
      fixedWallets,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [ADMIN] Error fixing XRPL addresses:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fix XRPL addresses',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// =============================================================================
// NFT REWARDS ADMIN ENDPOINTS
// =============================================================================

/**
 * Get NFT rewards overview for admin dashboard
 */
router.get('/nft-rewards/overview', async (req: AuthenticatedRequest, res) => {
  try {
    console.log('🎨 [ADMIN API] Fetching NFT rewards overview...');
    
    // Get all holders
    const holders = await nftRewardsService.getAllHoldersForAdmin();
    
    // Get recent distributions
    const distributions = await db
      .select()
      .from(monthlyRewardDistributions)
      .orderBy(desc(monthlyRewardDistributions.created_at))
      .limit(5);

    // Get pending transfers
    const pendingTransfers = await db
      .select()
      .from(nftRewardTransfers)
      .where(eq(nftRewardTransfers.status, 'pending'))
      .limit(20);

    // Calculate summary stats
    const totalHolders = holders.totalHolders || 0;
    const totalDistributed = distributions.reduce((sum, dist) => 
      sum + parseFloat(dist.nft_holder_allocation_usd || '0'), 0
    );
    
    res.json({
      success: true,
      data: {
        totalHolders,
        totalDistributed,
        recentDistributions: distributions,
        pendingTransfers: pendingTransfers.length,
        holders: holders.holders?.slice(0, 10) || [] // Latest 10 holders
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [ADMIN API] Error fetching NFT rewards overview:', error);
    res.status(500).json({ 
      error: 'Failed to fetch NFT rewards overview',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get all NFT holders with filtering
 */
router.get('/nft-rewards/holders', async (req: AuthenticatedRequest, res) => {
  try {
    console.log('🎨 [ADMIN API] Fetching all NFT holders...');
    
    const holders = await nftRewardsService.getAllHoldersForAdmin();
    
    res.json({
      success: true,
      data: holders,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [ADMIN API] Error fetching NFT holders:', error);
    res.status(500).json({ 
      error: 'Failed to fetch NFT holders',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Create monthly reward calculation
 */
router.post('/nft-rewards/calculate-monthly', async (req: AuthenticatedRequest, res) => {
  try {
    const { month, revenue } = req.body;
    
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'Valid month in YYYY-MM format required' });
    }

    console.log(`🎨 [ADMIN API] Creating monthly calculation for ${month}...`);
    
    const calculation = await nftRewardsService.calculateMonthlyRewards(month);
    
    res.json({
      success: true,
      data: calculation,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [ADMIN API] Error creating monthly calculation:', error);
    res.status(500).json({ 
      error: 'Failed to create monthly calculation',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Open monthly collection window (Called on 1st of each month)
 */
router.post('/nft-rewards/open-collection-window', async (req: AuthenticatedRequest, res) => {
  try {
    const { distributionId } = req.body;
    
    if (!distributionId) {
      return res.status(400).json({ error: 'distributionId is required' });
    }

    console.log(`🕐 [ADMIN API] Opening collection window for ${distributionId}...`);
    
    const result = await nftRewardsService.openCollectionWindow(distributionId);
    
    res.json({
      success: true,
      data: result,
      message: 'Collection window opened! Users have 24 hours to collect their rewards.',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [ADMIN API] Error opening collection window:', error);
    res.status(500).json({ 
      error: 'Failed to open collection window',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Close collection window and burn uncollected rewards (Called after 24 hours)
 */
router.post('/nft-rewards/close-collection-window', async (req: AuthenticatedRequest, res) => {
  try {
    const { distributionId } = req.body;
    
    if (!distributionId) {
      return res.status(400).json({ error: 'distributionId is required' });
    }

    console.log(`🔥 [ADMIN API] Closing collection window for ${distributionId}...`);
    
    const result = await nftRewardsService.closeCollectionWindow(distributionId);
    
    res.json({
      success: true,
      data: result,
      message: `Collection window closed! ${result.totalBurnt} RDL burnt from ${result.uncollectedCount} uncollected rewards.`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [ADMIN API] Error closing collection window:', error);
    res.status(500).json({ 
      error: 'Failed to close collection window',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Update a specific wallet's NFT holdings
 */
router.post('/nft-rewards/update-holdings', async (req: AuthenticatedRequest, res) => {
  try {
    const { walletAddress, userHandle } = req.body;
    
    if (!walletAddress) {
      return res.status(400).json({ error: 'walletAddress is required' });
    }

    console.log(`🎨 [ADMIN API] Updating holdings for ${walletAddress}...`);
    
    const result = await nftRewardsService.checkAndUpdateNFTHoldings(walletAddress, userHandle);
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [ADMIN API] Error updating holdings:', error);
    res.status(500).json({ 
      error: 'Failed to update holdings',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get detailed distribution report
 */
router.get('/nft-rewards/distribution/:distributionId', async (req: AuthenticatedRequest, res) => {
  try {
    const { distributionId } = req.params;
    
    console.log(`🎨 [ADMIN API] Fetching distribution report for ${distributionId}...`);
    
    // Get distribution details
    const [distribution] = await db
      .select()
      .from(monthlyRewardDistributions)
      .where(eq(monthlyRewardDistributions.id, distributionId));

    if (!distribution) {
      return res.status(404).json({ error: 'Distribution not found' });
    }

    // Get all transfers for this distribution
    const transfers = await db
      .select()
      .from(nftRewardTransfers)
      .where(eq(nftRewardTransfers.distribution_id, distributionId))
      .orderBy(desc(nftRewardTransfers.created_at));

    res.json({
      success: true,
      data: {
        distribution,
        transfers,
        summary: {
          totalTransfers: transfers.length,
          completed: transfers.filter(t => t.status === 'completed').length,
          pending: transfers.filter(t => t.status === 'pending').length,
          failed: transfers.filter(t => t.status === 'failed').length
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [ADMIN API] Error fetching distribution report:', error);
    res.status(500).json({ 
      error: 'Failed to fetch distribution report',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============== AUTOMATIC MARKET MAKER ADMIN CONTROLS ==============

/**
 * Get all AMM configurations with project info (Admin Central Manager)
 */
router.get('/amm/all-configs', async (req: AuthenticatedRequest, res) => {
  try {
    console.log('🤖 [ADMIN API] Fetching all AMM configurations...');
    
    const { marketMakerConfigs, devtoolsProjects } = await import('@shared/schema');
    
    // Get all AMM configs with project details
    const configs = await db
      .select({
        config: marketMakerConfigs,
        project: devtoolsProjects
      })
      .from(marketMakerConfigs)
      .leftJoin(devtoolsProjects, eq(marketMakerConfigs.project_id, devtoolsProjects.id))
      .orderBy(desc(marketMakerConfigs.created_at));

    // Get active configs count
    const activeCount = configs.filter(c => c.config.is_active).length;
    const totalTransactions = configs.reduce((sum, c) => sum + (c.config.total_transactions || 0), 0);
    const totalFeesCollected = configs.reduce((sum, c) => sum + parseFloat(c.config.total_fees_collected || '0'), 0);

    res.json({
      success: true,
      data: {
        configs: configs.map(c => ({
          ...c.config,
          project_name: c.project?.name,
          project_logo: c.project?.logo_url
        })),
        stats: {
          total_configs: configs.length,
          active_configs: activeCount,
          inactive_configs: configs.length - activeCount,
          total_transactions: totalTransactions,
          total_fees_collected: totalFeesCollected.toFixed(8),
          platform_fee_percentage: 0.25
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [ADMIN API] Error fetching AMM configs:', error);
    res.status(500).json({ 
      error: 'Failed to fetch AMM configurations',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get running/active AMM projects
 */
router.get('/amm/active-projects', async (req: AuthenticatedRequest, res) => {
  try {
    console.log('🤖 [ADMIN API] Fetching active AMM projects...');
    
    const { marketMakerConfigs, devtoolsProjects } = await import('@shared/schema');
    
    const activeConfigs = await db
      .select({
        config: marketMakerConfigs,
        project: devtoolsProjects
      })
      .from(marketMakerConfigs)
      .leftJoin(devtoolsProjects, eq(marketMakerConfigs.project_id, devtoolsProjects.id))
      .where(eq(marketMakerConfigs.is_active, true))
      .orderBy(desc(marketMakerConfigs.next_execution));

    res.json({
      success: true,
      data: {
        active_projects: activeConfigs.map(c => ({
          config_id: c.config.id,
          project_id: c.config.project_id,
          project_name: c.project?.name,
          project_logo: c.project?.logo_url,
          riddle_handle: c.config.riddle_handle,
          chain: c.config.chain,
          trading_pair: `${c.config.base_token}/${c.config.quote_token}`,
          payment_amount: c.config.payment_amount,
          payment_frequency: c.config.payment_frequency,
          last_execution: c.config.last_execution,
          next_execution: c.config.next_execution,
          total_transactions: c.config.total_transactions,
          total_fees_collected: c.config.total_fees_collected
        })),
        count: activeConfigs.length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [ADMIN API] Error fetching active AMM projects:', error);
    res.status(500).json({ 
      error: 'Failed to fetch active AMM projects',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Admin toggle AMM config (emergency stop/start)
 */
router.post('/amm/:configId/admin-toggle', async (req: AuthenticatedRequest, res) => {
  try {
    const { configId } = req.params;
    const { isActive, reason } = req.body;

    console.log(`🤖 [ADMIN API] Admin toggling AMM config ${configId} to ${isActive ? 'active' : 'inactive'}...`);
    
    const { marketMakerConfigs } = await import('@shared/schema');
    
    const [config] = await db
      .select()
      .from(marketMakerConfigs)
      .where(eq(marketMakerConfigs.id, configId))
      .limit(1);

    if (!config) {
      return res.status(404).json({ error: 'AMM config not found' });
    }

    // Calculate next execution if activating
    let nextExecution = null;
    if (isActive) {
      const now = new Date();
      const freqMinutes = config.frequency_minutes || (
        config.payment_frequency === 'hourly' ? 60 :
        config.payment_frequency === 'daily' ? 1440 :
        config.payment_frequency === 'weekly' ? 10080 : 60
      );
      nextExecution = new Date(now.getTime() + freqMinutes * 60000);
    }

    await db.update(marketMakerConfigs)
      .set({ 
        is_active: isActive,
        next_execution: nextExecution,
        updated_at: new Date()
       } as any)
      .where(eq(marketMakerConfigs.id, configId));

    // Log admin action
    console.log(`✅ [ADMIN] AMM config ${configId} ${isActive ? 'activated' : 'deactivated'} by ${req.user?.userHandle}. Reason: ${reason || 'N/A'}`);

    res.json({
      success: true,
      message: `AMM config ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: {
        config_id: configId,
        is_active: isActive,
        next_execution: nextExecution,
        admin_action_by: req.user?.userHandle,
        reason: reason || 'Admin action'
      }
    });

  } catch (error) {
    console.error('❌ [ADMIN API] Error admin toggling AMM config:', error);
    res.status(500).json({ 
      error: 'Failed to toggle AMM config',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get AMM transaction history across all configs
 */
router.get('/amm/all-transactions', async (req: AuthenticatedRequest, res) => {
  try {
    const { limit = 100, status } = req.query;

    // Validate and sanitize limit parameter
    const parsedLimit = Math.min(Math.max(parseInt(limit as string) || 100, 1), 1000);
    
    console.log(`🤖 [ADMIN API] Fetching AMM transaction history (limit: ${parsedLimit})...`);
    
    const { marketMakerTransactions, marketMakerConfigs, devtoolsProjects } = await import('@shared/schema');
    
    const baseQuery = db
      .select({
        transaction: marketMakerTransactions,
        config: marketMakerConfigs,
        project: devtoolsProjects
      })
      .from(marketMakerTransactions)
      .leftJoin(marketMakerConfigs, eq(marketMakerTransactions.config_id, marketMakerConfigs.id))
      .leftJoin(devtoolsProjects, eq(marketMakerConfigs.project_id, devtoolsProjects.id));

    // Use deterministic ordering: executed_at DESC, then id DESC for tie-breaking
    const transactions = status
      ? await baseQuery
          .where(eq(marketMakerTransactions.status, status as string))
          .orderBy(desc(marketMakerTransactions.executed_at), desc(marketMakerTransactions.id))
          .limit(parsedLimit)
      : await baseQuery
          .orderBy(desc(marketMakerTransactions.executed_at), desc(marketMakerTransactions.id))
          .limit(parsedLimit);

    // Calculate totals
    const totalVolume = transactions.reduce((sum, t) => sum + parseFloat(t.transaction.amount || '0'), 0);
    const totalFees = transactions.reduce((sum, t) => sum + parseFloat(t.transaction.fee_amount || '0'), 0);

    res.json({
      success: true,
      data: {
        transactions: transactions.map(t => ({
          ...t.transaction,
          project_name: t.project?.name,
          config_chain: t.config?.chain,
          trading_pair: t.config ? `${t.config.base_token}/${t.config.quote_token}` : null
        })),
        stats: {
          total_transactions: transactions.length,
          total_volume: totalVolume.toFixed(8),
          total_fees: totalFees.toFixed(8),
          success_count: transactions.filter(t => t.transaction.status === 'success').length,
          pending_count: transactions.filter(t => t.transaction.status === 'pending').length,
          failed_count: transactions.filter(t => t.transaction.status === 'failed').length
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [ADMIN API] Error fetching AMM transactions:', error);
    res.status(500).json({ 
      error: 'Failed to fetch AMM transactions',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get AMM statistics and performance metrics
 */
router.get('/amm/statistics', async (req: AuthenticatedRequest, res) => {
  try {
    console.log('🤖 [ADMIN API] Fetching AMM statistics...');
    
    const { marketMakerConfigs, marketMakerTransactions } = await import('@shared/schema');
    
    // Get all configs
    const allConfigs = await db.select().from(marketMakerConfigs);
    
    // Get all transactions
    const allTransactions = await db.select().from(marketMakerTransactions);
    
    // Get transactions from last 24 hours
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = allTransactions.filter(t => new Date(t.executed_at) > last24h);
    
    // Calculate statistics
    const totalFees = allConfigs.reduce((sum, c) => sum + parseFloat(c.total_fees_collected || '0'), 0);
    const totalVolume = allTransactions.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0);
    const recentVolume = recent.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0);
    const recentFees = recent.reduce((sum, t) => sum + parseFloat(t.fee_amount || '0'), 0);

    res.json({
      success: true,
      data: {
        overview: {
          total_configs: allConfigs.length,
          active_configs: allConfigs.filter(c => c.is_active).length,
          total_transactions: allTransactions.length,
          total_volume: totalVolume.toFixed(8),
          total_fees_collected: totalFees.toFixed(8),
          platform_fee_rate: '0.25%'
        },
        last_24_hours: {
          transactions: recent.length,
          volume: recentVolume.toFixed(8),
          fees: recentFees.toFixed(8),
          success_rate: recent.length > 0 
            ? ((recent.filter(t => t.status === 'success').length / recent.length) * 100).toFixed(2) + '%'
            : '0%'
        },
        by_chain: Object.entries(
          allConfigs.reduce((acc, c) => {
            acc[c.chain] = (acc[c.chain] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        ).map(([chain, count]) => ({ chain, count })),
        by_frequency: Object.entries(
          allConfigs.reduce((acc, c) => {
            acc[c.payment_frequency] = (acc[c.payment_frequency] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        ).map(([frequency, count]) => ({ frequency, count }))
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [ADMIN API] Error fetching AMM statistics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch AMM statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Manual AMM execution trigger (for testing)
 */
router.post('/amm/execute-now', async (req: AuthenticatedRequest, res) => {
  try {
    console.log(`🤖 [ADMIN API] Manual AMM execution triggered by ${req.user?.userHandle}...`);
    
    const { processAmmTrades } = await import('./amm-executor-service');
    const result = await processAmmTrades();
    
    console.log(`✅ [ADMIN API] Manual AMM execution complete: ${result.processed} processed, ${result.successful} successful, ${result.failed} failed`);
    
    res.json({
      success: true,
      message: 'AMM trades executed successfully',
      data: {
        processed: result.processed,
        successful: result.successful,
        failed: result.failed,
        executed_by: req.user?.userHandle,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ [ADMIN API] Error executing AMM trades:', error);
    res.status(500).json({ 
      error: 'Failed to execute AMM trades',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;