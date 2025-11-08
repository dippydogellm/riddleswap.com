// Traders Tools API Routes - Comprehensive Trading Functionality
import { Router, Request, Response } from 'express';
import { requireAuthentication } from './middleware/session-auth';
import cors from 'cors';

const router = Router();

// Note: CORS is already configured globally in server/index.ts
// Removed duplicate CORS middleware to prevent conflicts

// Apply authentication middleware to all routes
router.use(requireAuthentication);

// =============================================================================
// WALLET SEARCH ROUTES
// =============================================================================

// Search wallet across all supported chains
router.get('/wallet-search/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    const { chains } = req.query;
    
    console.log(`🔍 [TRADERS] Searching wallet: ${address}`);
    
    if (!address) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address is required'
      });
    }

    const searchChains = chains ? (chains as string).split(',') : ['xrpl', 'ethereum', 'solana', 'bitcoin'];
    const results = [];

    // Search XRPL
    if (searchChains.includes('xrpl')) {
      try {
        const xrplResponse = await fetch(`https://bithomp.com/api/v2/address/${address}?assets=true`, {
          headers: {
            'x-bithomp-token': process.env.BITHOMP_API_KEY || '',
            'User-Agent': 'RiddleSwap/1.0'
          }
        });
        
        if (xrplResponse.ok) {
          const xrplData = await xrplResponse.json();
          results.push({
            chain: 'XRPL',
            address: address,
            balance: (parseFloat(xrplData.balance || '0') / 1000000).toFixed(6),
            usdValue: ((parseFloat(xrplData.balance || '0') / 1000000) * 3.08).toFixed(2),
            tokens: xrplData.assets?.currencies?.slice(0, 10) || [],
            nfts: xrplData.assets?.nfts?.slice(0, 10) || [],
            totalTxs: xrplData.statistics?.txs || 0,
            lastActivity: xrplData.statistics?.last || null
          });
        }
      } catch (error) {
        console.error('XRPL wallet search failed:', error);
      }
    }

    // Search Ethereum and EVM chains
    const evmChains = searchChains.filter(chain => 
      ['ethereum', 'bsc', 'polygon', 'arbitrum', 'base'].includes(chain)
    );
    
    for (const chain of evmChains) {
      try {
        let rpcUrl = '';
        switch (chain) {
          case 'ethereum':
            rpcUrl = 'https://eth.llamarpc.com';
            break;
          case 'bsc':
            rpcUrl = 'https://bsc-dataseed.binance.org/';
            break;
          case 'polygon':
            rpcUrl = 'https://polygon-rpc.com';
            break;
          case 'arbitrum':
            rpcUrl = 'https://arb1.arbitrum.io/rpc';
            break;
          case 'base':
            rpcUrl = 'https://mainnet.base.org';
            break;
        }

        const balanceResponse = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_getBalance',
            params: [address, 'latest'],
            id: 1
          })
        });

        const balanceData = await balanceResponse.json();
        if (balanceData.result) {
          const balance = parseInt(balanceData.result, 16) / Math.pow(10, 18);
          const usdValue = balance * (chain === 'ethereum' ? 3300 : 650); // Rough price estimates
          
          results.push({
            chain: chain.toUpperCase(),
            address: address,
            balance: balance.toFixed(6),
            usdValue: usdValue.toFixed(2),
            tokens: [],
            nfts: [],
            totalTxs: 0,
            lastActivity: null
          });
        }
      } catch (error) {
        console.error(`${chain} wallet search failed:`, error);
      }
    }

    // Search Solana
    if (searchChains.includes('solana')) {
      try {
        const solanaResponse = await fetch('https://api.mainnet-beta.solana.com', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getBalance',
            params: [address]
          })
        });

        const solanaData = await solanaResponse.json();
        if (solanaData.result?.value) {
          const balance = solanaData.result.value / Math.pow(10, 9);
          const usdValue = balance * 250; // Rough SOL price
          
          results.push({
            chain: 'SOLANA',
            address: address,
            balance: balance.toFixed(6),
            usdValue: usdValue.toFixed(2),
            tokens: [],
            nfts: [],
            totalTxs: 0,
            lastActivity: null
          });
        }
      } catch (error) {
        console.error('Solana wallet search failed:', error);
      }
    }

    console.log(`✅ [TRADERS] Found wallet data on ${results.length} chains`);

    res.json({
      success: true,
      results: results
    });

  } catch (error) {
    console.error('Wallet search error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search wallet'
    });
  }
});

// =============================================================================
// TOKEN SAFETY ROUTES
// =============================================================================

// Analyze token safety and security
router.post('/token-safety/analyze', async (req: Request, res: Response) => {
  try {
    const { tokenAddress, chain } = req.body;
    
    console.log(`🛡️ [TRADERS] Analyzing token safety: ${tokenAddress} on ${chain}`);
    
    if (!tokenAddress || !chain) {
      return res.status(400).json({
        success: false,
        error: 'Token address and chain are required'
      });
    }

    // Mock safety analysis for now - in production, integrate with real security APIs
    const safetyReport = {
      address: tokenAddress,
      chain: chain,
      safetyScore: Math.floor(Math.random() * 100),
      riskLevel: (['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const)[Math.floor(Math.random() * 4)],
      checks: {
        contractVerified: Math.random() > 0.3,
        liquidityLocked: Math.random() > 0.4,
        ownershipRenounced: Math.random() > 0.5,
        honeypotCheck: Math.random() > 0.8,
        rugPullRisk: Math.random() > 0.7,
        highTax: Math.random() > 0.6,
        mintFunction: Math.random() > 0.4,
        proxyContract: Math.random() > 0.6,
        teamTokens: Math.floor(Math.random() * 50),
        liquidityAmount: `$${Math.floor(Math.random() * 1000000).toLocaleString()}`,
        holderCount: Math.floor(Math.random() * 10000),
        tradingVolume: `$${Math.floor(Math.random() * 500000).toLocaleString()}`
      },
      warnings: [] as string[],
      recommendations: [
        'Always verify contract on official blockchain explorer',
        'Check liquidity and trading volume before investing',
        'Start with small amounts for testing',
        'Monitor token activity for suspicious behavior'
      ]
    };

    // Generate warnings based on checks
    if (!safetyReport.checks.contractVerified) {
      safetyReport.warnings.push('Contract is not verified on blockchain explorer');
    }
    if (!safetyReport.checks.liquidityLocked) {
      safetyReport.warnings.push('Liquidity is not locked - risk of rug pull');
    }
    if (safetyReport.checks.honeypotCheck) {
      safetyReport.warnings.push('Potential honeypot detected - selling may be restricted');
    }

    console.log(`✅ [TRADERS] Safety analysis complete for ${tokenAddress}`);

    res.json({
      success: true,
      report: safetyReport
    });

  } catch (error) {
    console.error('Token safety analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze token safety'
    });
  }
});

// =============================================================================
// TRADING DESK ROUTES  
// =============================================================================

// Get trading desk watchlist
router.get('/trading-desk/watchlist', async (req: Request, res: Response) => {
  try {
    console.log(`📊 [TRADERS] Fetching trading desk watchlist`);
    
    // Mock watchlist data - in production, fetch from user's saved watchlist
    const watchlist = [
      {
        symbol: 'USDC',
        name: 'USD Coin',
        price: '1.00',
        change24h: '0.01',
        volume24h: '2,345,678,901',
        marketCap: '32,456,789,012',
        chain: 'ethereum',
        address: '0xA0b86a33E6441d0f93C0eaa21c130BA65E4A9a2b'
      },
      {
        symbol: 'WETH',
        name: 'Wrapped Ether',
        price: '3,245.67',
        change24h: '-2.34',
        volume24h: '1,234,567,890',
        marketCap: '15,678,901,234',
        chain: 'ethereum',
        address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
      }
    ];

    res.json({
      success: true,
      watchlist: watchlist
    });

  } catch (error) {
    console.error('Trading desk watchlist error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch watchlist'
    });
  }
});

// Execute quick trade
router.post('/trading-desk/quick-trade', async (req: Request, res: Response) => {
  try {
    const { tokenAddress, action, amount, chain } = req.body;
    
    console.log(`⚡ [TRADERS] Quick trade: ${action} ${amount} of ${tokenAddress} on ${chain}`);
    
    if (!tokenAddress || !action || !amount || !chain) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }

    // Route to appropriate swap endpoint
    let swapEndpoint = '';
    switch (chain) {
      case 'xrpl':
        swapEndpoint = '/api/xrpl/swap/v2';
        break;
      case 'solana':
        swapEndpoint = '/api/solana/swap';
        break;
      default:
        swapEndpoint = '/api/ethereum/swap';
    }

    res.json({
      success: true,
      tradeId: Date.now().toString(),
      swapEndpoint: swapEndpoint,
      message: 'Trade initiated successfully'
    });

  } catch (error) {
    console.error('Quick trade error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute trade'
    });
  }
});

// =============================================================================
// COPY TRADING ROUTES
// =============================================================================

// Get top traders
router.get('/copy-trading/traders', async (req: Request, res: Response) => {
  try {
    console.log(`👥 [TRADERS] Fetching top traders list`);
    
    // Mock top traders data - in production, fetch from database
    const topTraders = [
      {
        id: '1',
        username: 'cryptowizard',
        displayName: 'Crypto Wizard',
        verified: true,
        followers: 15420,
        winRate: 78.5,
        totalTrades: 1247,
        avgReturn: '23.4%',
        totalPnl: '+$234,567',
        chains: ['ethereum', 'bsc', 'polygon'],
        lastActive: '2 hours ago',
        copiers: 892,
        minCopyAmount: '100',
        description: 'Professional DeFi trader with 5+ years experience.'
      },
      {
        id: '2',
        username: 'defi_master',
        displayName: 'DeFi Master',
        verified: true,
        followers: 12830,
        winRate: 71.2,
        totalTrades: 2156,
        avgReturn: '18.7%',
        totalPnl: '+$189,234',
        chains: ['ethereum', 'arbitrum', 'base'],
        lastActive: '1 hour ago',
        copiers: 743,
        minCopyAmount: '250',
        description: 'Specialized in Layer 2 trading and MEV strategies.'
      }
    ];

    res.json({
      success: true,
      traders: topTraders
    });

  } catch (error) {
    console.error('Top traders fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch traders'
    });
  }
});

// Start copying a trader
router.post('/copy-trading/start', async (req: Request, res: Response) => {
  try {
    const { traderId, amount } = req.body;
    
    console.log(`🔄 [TRADERS] Starting copy trading for trader: ${traderId}, amount: ${amount}`);
    
    if (!traderId || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Trader ID and amount are required'
      });
    }

    // Mock copy trading setup
    const copyPosition = {
      id: Date.now().toString(),
      traderId: traderId,
      amount: amount,
      status: 'active',
      startTime: new Date().toISOString()
    };

    res.json({
      success: true,
      position: copyPosition,
      message: 'Copy trading started successfully'
    });

  } catch (error) {
    console.error('Copy trading start error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start copy trading'
    });
  }
});

// =============================================================================
// STAKING ROUTES
// =============================================================================

// Get staking pools
router.get('/staking/pools', async (req: Request, res: Response) => {
  try {
    console.log(`🪙 [TRADERS] Fetching staking pools`);
    
    // Mock staking pools - in production, fetch from database
    const stakingPools = [
      {
        id: 'rdl-basic',
        name: 'RDL Basic Staking',
        token: 'RDL',
        apy: '15.5%',
        lockPeriod: '30 days',
        minStake: '1000',
        totalStaked: '2,456,789',
        userStaked: '0',
        pendingRewards: '0',
        nextRewardDate: '2025-01-30',
        status: 'active',
        rewardSource: 'trading_fees'
      },
      {
        id: 'rdl-premium',
        name: 'RDL Premium Staking',
        token: 'RDL',
        apy: '28.0%',
        lockPeriod: '90 days',
        minStake: '10000',
        totalStaked: '1,234,567',
        userStaked: '0',
        pendingRewards: '0',
        nextRewardDate: '2025-01-30',
        status: 'active',
        rewardSource: 'platform_revenue'
      }
    ];

    res.json({
      success: true,
      pools: stakingPools
    });

  } catch (error) {
    console.error('Staking pools fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch staking pools'
    });
  }
});

// Stake tokens
router.post('/staking/stake', async (req: Request, res: Response) => {
  try {
    const { poolId, amount } = req.body;
    
    console.log(`🔒 [TRADERS] Staking ${amount} tokens in pool: ${poolId}`);
    
    if (!poolId || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Pool ID and amount are required'
      });
    }

    // Mock staking transaction
    const stakingPosition = {
      id: Date.now().toString(),
      poolId: poolId,
      amount: amount,
      status: 'active',
      stakeTime: new Date().toISOString()
    };

    res.json({
      success: true,
      position: stakingPosition,
      message: 'Tokens staked successfully'
    });

  } catch (error) {
    console.error('Token staking error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stake tokens'
    });
  }
});

// =============================================================================
// GROUP SNIPER ROUTES
// =============================================================================

// Get new XRPL tokens
router.get('/group-sniper/new-tokens', async (req: Request, res: Response) => {
  try {
    console.log(`🎯 [TRADERS] Fetching new XRPL tokens`);
    
    // Mock new tokens data - in production, monitor XRPL for new token issuances
    const newTokens = [
      {
        id: '1',
        name: 'RiddleMoon',
        symbol: 'RMOON',
        address: 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH',
        issuer: 'rMoonIssuer123...xyz',
        taxon: '12345',
        created: '2 minutes ago',
        initialPrice: '0.001',
        currentPrice: '0.0012',
        priceChange: '+20.0%',
        volume24h: '15,430',
        holders: 127,
        liquidityLocked: true,
        verified: false,
        riskScore: 25
      }
    ];

    res.json({
      success: true,
      tokens: newTokens
    });

  } catch (error) {
    console.error('New tokens fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch new tokens'
    });
  }
});

// Get sniper groups
router.get('/group-sniper/groups', async (req: Request, res: Response) => {
  try {
    console.log(`👥 [TRADERS] Fetching sniper groups`);
    
    // Mock sniper groups data
    const sniperGroups = [
      {
        id: 'alpha-hunters',
        name: 'Alpha Hunters',
        description: 'Elite XRPL token hunters with proven track record',
        members: 156,
        leader: 'XRPLKing',
        successRate: 73.2,
        totalSnipes: 847,
        avgReturn: '+142%',
        minBuy: '50',
        maxBuy: '1000',
        isPrivate: true,
        requirements: ['Minimum 10,000 RDL staked', 'Verified KYC']
      }
    ];

    res.json({
      success: true,
      groups: sniperGroups
    });

  } catch (error) {
    console.error('Sniper groups fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sniper groups'
    });
  }
});

// Execute snipe
router.post('/group-sniper/snipe', async (req: Request, res: Response) => {
  try {
    const { tokenAddress, amount, groupId } = req.body;
    
    console.log(`⚡ [TRADERS] Executing snipe: ${tokenAddress}, amount: ${amount}, group: ${groupId}`);
    
    if (!tokenAddress || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Token address and amount are required'
      });
    }

    // Route to XRPL swap endpoint for execution
    const snipeOrder = {
      id: Date.now().toString(),
      tokenAddress: tokenAddress,
      amount: amount,
      groupId: groupId,
      status: 'pending',
      timestamp: new Date().toISOString()
    };

    res.json({
      success: true,
      order: snipeOrder,
      swapEndpoint: '/api/xrpl/swap/v2',
      message: 'Snipe order executed successfully'
    });

  } catch (error) {
    console.error('Snipe execution error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute snipe'
    });
  }
});

// =============================================================================
// ADMIN ROUTES FOR TRADERS TOOLS MANAGEMENT
// =============================================================================

// Admin - Get all sniper bots status
router.get('/admin/sniper-bots', async (req: Request, res: Response) => {
  try {
    console.log('🤖 [ADMIN] Fetching sniper bots status');
    
    // Mock sniper bots data - in production, fetch from database
    const sniperBots = [
      {
        id: 'sniper-1',
        name: 'Alpha Hunter Bot',
        status: 'running',
        targetToken: 'XRPL-NewTokens',
        participants: 45,
        totalInvestment: '$12,450',
        successRate: 78.5,
        activeSnipes: 3,
        profitsToday: '+$2,847',
        lastActive: new Date().toISOString()
      },
      {
        id: 'sniper-2',
        name: 'Quick Strike Bot',
        status: 'paused',
        targetToken: 'ETH-Gems',
        participants: 23,
        totalInvestment: '$8,920',
        successRate: 65.2,
        activeSnipes: 0,
        profitsToday: '+$1,234',
        lastActive: new Date().toISOString()
      }
    ];

    res.json({
      success: true,
      bots: sniperBots
    });

  } catch (error) {
    console.error('Admin sniper bots fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sniper bots'
    });
  }
});

// Admin - Control sniper bot (start/stop/pause)
router.post('/admin/sniper-bot/:action', async (req: Request, res: Response) => {
  try {
    const { action } = req.params;
    const { botId } = req.body;
    
    console.log(`🤖 [ADMIN] ${action}ing sniper bot: ${botId}`);
    
    if (!botId || !['start', 'stop', 'pause'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid action or missing botId'
      });
    }

    // Mock bot control - in production, update database and control actual bots
    const botAction = {
      botId: botId,
      action: action,
      timestamp: new Date().toISOString(),
      status: action === 'start' ? 'running' : action === 'stop' ? 'stopped' : 'paused'
    };

    res.json({
      success: true,
      action: botAction,
      message: `Sniper bot ${action}ed successfully`
    });

  } catch (error) {
    console.error('Sniper bot control error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to control sniper bot'
    });
  }
});

// Admin - Get all copy trading status
router.get('/admin/copy-trades', async (req: Request, res: Response) => {
  try {
    console.log('📊 [ADMIN] Fetching copy trades status');
    
    // Mock copy trades data
    const copyTrades = [
      {
        id: 'copy-1',
        traderId: 'trader-1',
        traderName: 'CryptoWizard',
        followers: 156,
        status: 'active',
        totalVolume: '$45,678',
        profitsToday: '+$3,456',
        activeTrades: 7,
        lastUpdate: new Date().toISOString()
      },
      {
        id: 'copy-2',
        traderId: 'trader-2',
        traderName: 'DeFiMaster',
        followers: 89,
        status: 'active',
        totalVolume: '$23,890',
        profitsToday: '+$1,567',
        activeTrades: 4,
        lastUpdate: new Date().toISOString()
      }
    ];

    res.json({
      success: true,
      copyTrades: copyTrades
    });

  } catch (error) {
    console.error('Admin copy trades fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch copy trades'
    });
  }
});

// Admin - Control copy trading (pause/stop/resume)
router.post('/admin/copy-trade/:action', async (req: Request, res: Response) => {
  try {
    const { action } = req.params;
    const { tradeId } = req.body;
    
    console.log(`📊 [ADMIN] ${action}ing copy trade: ${tradeId}`);
    
    if (!tradeId || !['pause', 'stop', 'resume'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid action or missing tradeId'
      });
    }

    // Mock copy trade control
    const tradeAction = {
      tradeId: tradeId,
      action: action,
      timestamp: new Date().toISOString(),
      status: action === 'resume' ? 'active' : action === 'pause' ? 'paused' : 'stopped'
    };

    res.json({
      success: true,
      action: tradeAction,
      message: `Copy trading ${action}ed successfully`
    });

  } catch (error) {
    console.error('Copy trade control error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to control copy trading'
    });
  }
});

// Admin - Get all trades with filtering
router.get('/admin/trades', async (req: Request, res: Response) => {
  try {
    const { botId, traderId, status, limit = 50 } = req.query;
    
    console.log('📈 [ADMIN] Fetching trades with filters:', { botId, traderId, status });
    
    // Mock trades data
    let trades = [
      {
        id: 'trade-1',
        type: 'snipe',
        token: 'RMOON',
        amount: '$5,430',
        status: 'success',
        participants: 45,
        profit: '+$1,247',
        timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
        botId: 'sniper-1',
        details: {
          entryPrice: '0.001',
          exitPrice: '0.0012',
          slippage: '2.1%',
          gasUsed: '$12'
        }
      },
      {
        id: 'trade-2',
        type: 'copy',
        token: 'USDC',
        amount: '$12,000',
        status: 'distributed',
        participants: 156,
        profit: '+$892',
        timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        traderId: 'trader-1',
        details: {
          entryPrice: '1.000',
          exitPrice: '1.074',
          duration: '45 minutes',
          fees: '$18'
        }
      },
      {
        id: 'trade-3',
        type: 'snipe',
        token: 'XGEM',
        amount: '$3,200',
        status: 'failed',
        participants: 23,
        profit: '-$450',
        timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        botId: 'sniper-2',
        details: {
          failureReason: 'High slippage detected',
          maxSlippage: '15%',
          actualSlippage: '22%'
        }
      }
    ];

    // Apply filters
    if (botId && botId !== 'all') {
      trades = trades.filter(trade => trade.botId === botId);
    }
    if (traderId && traderId !== 'all') {
      trades = trades.filter(trade => trade.traderId === traderId);
    }
    if (status) {
      trades = trades.filter(trade => trade.status === status);
    }

    res.json({
      success: true,
      trades: trades.slice(0, parseInt(limit as string))
    });

  } catch (error) {
    console.error('Admin trades fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trades'
    });
  }
});

// Admin - Distribute profits to participants
router.post('/admin/distribute-profits', async (req: Request, res: Response) => {
  try {
    const { tradeId } = req.body;
    
    console.log('💰 [ADMIN] Distributing profits for trade:', tradeId);
    
    if (!tradeId) {
      return res.status(400).json({
        success: false,
        error: 'Trade ID is required'
      });
    }

    // Mock profit distribution process
    const distribution = {
      id: `dist-${Date.now()}`,
      tradeId: tradeId,
      totalProfit: '$1,247',
      participantCount: 45,
      distributedAmount: '$1,122.30',
      feeAmount: '$124.70', // 10% platform fee
      timestamp: new Date().toISOString(),
      status: 'completed',
      participants: [
        { wallet: 'rABC123...', amount: '$124.70', percentage: '10%' },
        { wallet: 'rDEF456...', amount: '$87.29', percentage: '7%' },
        // ... more participants
      ]
    };

    // In production, this would:
    // 1. Calculate each participant's share based on investment
    // 2. Execute XRPL transactions to distribute profits
    // 3. Update database with distribution records
    // 4. Send notifications to participants

    res.json({
      success: true,
      distribution: distribution,
      message: `Profits distributed to ${distribution.participantCount} wallets`
    });

  } catch (error) {
    console.error('Profit distribution error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to distribute profits'
    });
  }
});

// Admin - Get distribution history
router.get('/admin/distributions', async (req: Request, res: Response) => {
  try {
    const { status, limit = 20 } = req.query;
    
    console.log('💸 [ADMIN] Fetching distribution history');
    
    // Mock distribution history
    let distributions = [
      {
        id: 'dist-1',
        tradeId: 'trade-2',
        totalProfit: '$892',
        participantCount: 156,
        distributedAmount: '$802.80',
        feeAmount: '$89.20',
        timestamp: new Date(Date.now() - 16 * 60 * 1000).toISOString(),
        status: 'completed'
      },
      {
        id: 'dist-2',
        tradeId: 'trade-1',
        totalProfit: '$1,247',
        participantCount: 45,
        distributedAmount: '$1,122.30',
        feeAmount: '$124.70',
        timestamp: new Date().toISOString(),
        status: 'pending'
      }
    ];

    // Apply status filter
    if (status && status !== 'all') {
      distributions = distributions.filter(dist => dist.status === status);
    }

    res.json({
      success: true,
      distributions: distributions.slice(0, parseInt(limit as string))
    });

  } catch (error) {
    console.error('Distribution history fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch distribution history'
    });
  }
});

// Admin - Get system metrics
router.get('/admin/metrics', async (req: Request, res: Response) => {
  try {
    console.log('📊 [ADMIN] Fetching system metrics');
    
    const metrics = {
      totalParticipants: 234,
      activeBots: 2,
      activeCopyTrades: 2,
      totalVolume24h: '$156,789',
      totalProfits24h: '+$8,104',
      successRate: 72.3,
      distributionsToday: 12,
      uptime: process.uptime()
    };

    res.json({
      success: true,
      metrics: metrics
    });

  } catch (error) {
    console.error('System metrics fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch system metrics'
    });
  }
});

export { router as tradersToolsRoutes };
export default router;