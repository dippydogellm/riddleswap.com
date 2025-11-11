import express from 'express';
import { z } from 'zod';
import { Client } from 'xrpl';
import { bithompAPI } from '../../bithomp-api-v2';

const router = express.Router();

// XRPL Client
const XRPL_SERVER = 'wss://s1.ripple.com';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const AddLiquiditySchema = z.object({
  tokenA: z.string().min(1),
  tokenB: z.string().min(1),
  amountA: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0),
  amountB: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0),
  chain: z.enum(['xrp', 'eth', 'sol']),
  walletAddress: z.string().min(1)
});

const RemoveLiquiditySchema = z.object({
  poolId: z.string().min(1),
  lpTokenAmount: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0),
  chain: z.enum(['xrp', 'eth', 'sol']),
  walletAddress: z.string().min(1)
});

// ============================================================================
// MIDDLEWARE
// ============================================================================

const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!req.session?.handle) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }
  next();
};

// ============================================================================
// GET /api/tradecenter/liquidity/pools
// Get available liquidity pools with comprehensive data
// ============================================================================

router.get('/pools', async (req, res) => {
  try {
    const { chain = 'xrp', limit = '20', userAddress } = req.query;
    
    console.log(`💧 [Liquidity Pools] Requesting pools for ${chain}${userAddress ? ` (user: ${userAddress})` : ''}`);
    
    if (chain === 'xrp') {
      const client = new Client(XRPL_SERVER);
      await client.connect();
      
      try {
        // Get featured tokens to find popular AMM pools
        const featuredTokens = await bithompAPI.getAllTokens(100).catch(() => []);
        
        const pools: any[] = [];
        
        // Try to get AMM info for popular token pairs
        for (const token of featuredTokens.slice(0, parseInt(limit as string))) {
          try {
            // Try to get AMM pool for this token paired with XRP
            const ammInfo: any = await client.request({
              command: 'amm_info',
              asset: { currency: 'XRP' },
              asset2: { currency: token.currency, issuer: token.issuer }
            } as any);
            
            if (ammInfo.result?.amm) {
              const amm = ammInfo.result.amm;
              const pool1 = amm.amount;
              const pool2 = amm.amount2;
              
              const pool1Amount = typeof pool1 === 'string' ? parseFloat(pool1) / 1e6 : parseFloat(pool1.value || '0');
              const pool2Amount = typeof pool2 === 'string' ? parseFloat(pool2) / 1e6 : parseFloat(pool2.value || '0');
              
              // Calculate TVL and price
              const price = pool1Amount / pool2Amount;
              const tvl = pool1Amount + (pool2Amount * price); // Rough TVL in XRP
              
              // If user address provided, calculate their LP share
              let userShare = null;
              if (userAddress) {
                const userBalances = await bithompAPI.getAddressTokenBalances(userAddress as string).catch(() => []);
                const lpToken = userBalances.find((b: any) => 
                  b.currency === amm.lp_token?.currency && b.issuer === amm.account
                );
                
                if (lpToken) {
                  const userLPBalance = parseFloat(lpToken.balance || '0');
                  const totalLP = parseFloat(amm.lp_token?.value || '1');
                  const sharePercent = (userLPBalance / totalLP) * 100;
                  
                  userShare = {
                    lpBalance: userLPBalance.toFixed(6),
                    sharePercent: sharePercent.toFixed(4),
                    asset1Share: (pool1Amount * sharePercent / 100).toFixed(6),
                    asset2Share: (pool2Amount * sharePercent / 100).toFixed(6)
                  };
                }
              }
              
              pools.push({
                ammAccount: amm.account,
                asset1: {
                  currency: typeof pool1 === 'string' ? 'XRP' : pool1.currency,
                  issuer: typeof pool1 === 'string' ? null : pool1.issuer,
                  amount: pool1Amount.toFixed(6),
                  name: 'XRP'
                },
                asset2: {
                  currency: typeof pool2 === 'string' ? 'XRP' : pool2.currency,
                  issuer: typeof pool2 === 'string' ? null : pool2.issuer,
                  amount: pool2Amount.toFixed(6),
                  name: token.name || token.currency,
                  icon: token.icon
                },
                lpToken: {
                  currency: amm.lp_token?.currency,
                  total: amm.lp_token?.value
                },
                tvl: tvl.toFixed(2),
                price: price.toFixed(8),
                tradingFee: amm.trading_fee || 0,
                tradingFeePercent: ((amm.trading_fee || 0) / 1000).toFixed(3),
                volume24h: token.volume_24h || 0,
                change24h: token.change_24h || 0,
                userShare // Only present if userAddress provided
              });
            }
          } catch (ammError) {
            // Pool doesn't exist or error - skip
          }
        }
        
        await client.disconnect();
        
        // Sort by TVL descending
        pools.sort((a, b) => parseFloat(b.tvl) - parseFloat(a.tvl));
        
        res.json({
          success: true,
          pools,
          totalPools: pools.length,
          chain,
          timestamp: Date.now()
        });
        
      } finally {
        if (client.isConnected()) {
          await client.disconnect();
        }
      }
    } else {
      // For other chains, return placeholder
      res.json({
        success: true,
        pools: [],
        totalPools: 0,
        chain,
        message: 'Liquidity pools currently only available for XRPL',
        timestamp: Date.now()
      });
    }
    
  } catch (error) {
    console.error('❌ [Liquidity Pools Error]:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch pools'
    });
  }
});

// ============================================================================
// GET /api/tradecenter/liquidity/positions
// Get user's liquidity positions
// ============================================================================

router.get('/positions', requireAuth, async (req, res) => {
  try {
    const session = (req as any).userSession;
    const walletData = session.walletData;
    
    if (!walletData) {
      return res.status(403).json({
        success: false,
        error: 'No wallet data found'
      });
    }
    
    console.log(`💧 [Liquidity] ${session.handle} requesting positions`);
    
    // TODO: Fetch user's LP positions across all chains
    const positions = [];
    
    res.json({
      success: true,
      positions,
      timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('❌ [Liquidity Positions Error]:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch positions'
    });
  }
});

// ============================================================================
// POST /api/tradecenter/liquidity/add
// Add liquidity to a pool
// ============================================================================

router.post('/add', requireAuth, async (req, res) => {
  try {
    const { asset1, asset2, amount1, amount2, walletAddress, createNew, mode } = req.body;
    
    if (!asset1 || !asset2 || !amount1 || !amount2 || !walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }
    
    const session = (req as any).userSession;
    console.log(`💧 [Add Liquidity] ${session.handle}: ${amount1} + ${amount2} (${mode} mode, createNew: ${createNew})`);
    
    const client = new Client(XRPL_SERVER);
    await client.connect();
    
    try {
      // Parse assets
      const parseAsset = (asset: string): any => {
        if (asset === 'XRP') {
          return { currency: 'XRP' };
        }
        const [currency, issuer] = asset.split('.');
        return issuer ? { currency, issuer } : { currency };
      };

      const asset1Obj = parseAsset(asset1);
      const asset2Obj = parseAsset(asset2);

      // Convert amounts to proper format
      const formatAmount = (amount: string, currency: string): any => {
        const numAmount = parseFloat(amount);
        if (currency === 'XRP') {
          return (numAmount * 1e6).toString(); // Convert to drops
        }
        return {
          currency: asset1Obj.currency || asset2Obj.currency,
          value: numAmount.toString(),
          issuer: asset1Obj.issuer || asset2Obj.issuer
        };
      };

      let transaction: any;

      if (createNew) {
        // Create new AMM pool (AMMCreate transaction)
        transaction = {
          TransactionType: 'AMMCreate',
          Account: walletAddress,
          Amount: formatAmount(amount1, asset1),
          Amount2: formatAmount(amount2, asset2),
          TradingFee: 500 // 0.5% default trading fee
        };
        
        console.log(`🆕 Creating new AMM pool for ${asset1}/${asset2}`);
      } else {
        // Add to existing pool (AMMDeposit transaction)
        transaction = {
          TransactionType: 'AMMDeposit',
          Account: walletAddress,
          Asset: asset1Obj,
          Asset2: asset2Obj,
          Amount: formatAmount(amount1, asset1),
          Amount2: formatAmount(amount2, asset2)
        };
        
        console.log(`➕ Adding liquidity to existing ${asset1}/${asset2} pool`);
      }

      await client.disconnect();

      // Return transaction payload for frontend signing
      res.json({
        success: true,
        transaction,
        requiresSigning: true,
        message: createNew ? 'Pool creation transaction ready' : 'Liquidity deposit transaction ready',
        details: {
          asset1,
          asset2,
          amount1,
          amount2,
          mode,
          createNew
        },
        timestamp: Date.now()
      });
      
    } finally {
      if (client.isConnected()) {
        await client.disconnect();
      }
    }
    
  } catch (error) {
    console.error('❌ [Add Liquidity Error]:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add liquidity'
    });
  }
});

// ============================================================================
// POST /api/tradecenter/liquidity/remove
// Remove liquidity from a pool
// ============================================================================

router.post('/remove', requireAuth, async (req, res) => {
  try {
    const validation = RemoveLiquiditySchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: validation.error.errors
      });
    }
    
    const { poolId, lpTokenAmount, chain, walletAddress } = validation.data;
    const session = (req as any).userSession;
    
    // Verify wallet ownership
    const chainKey = `${chain}Address`;
    if (session.walletData?.[chainKey] !== walletAddress) {
      return res.status(403).json({
        success: false,
        error: 'Wallet address mismatch'
      });
    }
    
    console.log(`💧 [Remove Liquidity] ${session.handle}: ${lpTokenAmount} LP from pool ${poolId} on ${chain}`);
    
    // TODO: Execute remove liquidity transaction
    
    res.json({
      success: true,
      message: 'Liquidity removal not yet implemented',
      timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('❌ [Remove Liquidity Error]:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove liquidity'
    });
  }
});

// ============================================================================
// GET /api/tradecenter/liquidity/balances/:address
// Get LP positions and balances with Bithomp data
// ============================================================================

router.get('/balances/:address', requireAuth, async (req, res) => {
  try {
    const { address } = req.params;
    
    console.log(`💰 [LP Balance] Fetching LP positions for ${address}`);
    
    // Get all token balances which may include LP tokens
    const tokenBalances = await bithompAPI.getAddressTokenBalances(address);
    
    // Get AMM pools where user has LP tokens
    const client = new Client(XRPL_SERVER);
    await client.connect();
    
    try {
      // Get account AMM info (LP token balances)
      const ammBalances: any[] = [];
      
      for (const token of tokenBalances) {
        // Check if this is an LP token (AMM pool token)
        if (token.currency?.startsWith('03')) { // AMM LP tokens start with 03
          try {
            // Get detailed AMM info
            const ammInfo = await client.request({
              command: 'amm_info',
              amm_account: token.issuer
            });
            
            if (ammInfo.result.amm) {
              const amm = ammInfo.result.amm;
              const lpBalance = parseFloat(token.balance || '0');
              const totalLPTokens = parseFloat(amm.lp_token?.value || '1');
              const userSharePercent = (lpBalance / totalLPTokens) * 100;
              
              // Calculate user's share of pool
              const asset1 = amm.amount;
              const asset2 = amm.amount2;
              
              const asset1Amount = typeof asset1 === 'string' 
                ? parseFloat(asset1) 
                : parseFloat(asset1.value || '0');
              const asset2Amount = typeof asset2 === 'string'
                ? parseFloat(asset2)
                : parseFloat(asset2.value || '0');
              
              ammBalances.push({
                ammAccount: amm.account,
                lpTokenBalance: lpBalance,
                totalLPTokens,
                sharePercent: userSharePercent.toFixed(4),
                pool: {
                  asset1: {
                    currency: typeof asset1 === 'string' ? 'XRP' : asset1.currency,
                    issuer: typeof asset1 === 'string' ? null : asset1.issuer,
                    amount: asset1Amount,
                    userShare: (asset1Amount * userSharePercent / 100).toFixed(6)
                  },
                  asset2: {
                    currency: typeof asset2 === 'string' ? 'XRP' : asset2.currency,
                    issuer: typeof asset2 === 'string' ? null : asset2.issuer,
                    amount: asset2Amount,
                    userShare: (asset2Amount * userSharePercent / 100).toFixed(6)
                  }
                },
                tradingFee: amm.trading_fee || 0,
                auctionSlot: amm.auction_slot || null
              });
            }
          } catch (ammError) {
            console.warn(`Could not fetch AMM info for ${token.currency}:`, ammError);
          }
        }
      }
      
      await client.disconnect();
      
      res.json({
        success: true,
        address,
        liquidityPositions: ammBalances,
        totalPositions: ammBalances.length,
        totalValueLocked: ammBalances.reduce((sum, pos) => {
          // Simple TVL calculation (just counting both assets)
          return sum + parseFloat(pos.pool.asset1.userShare) + parseFloat(pos.pool.asset2.userShare);
        }, 0).toFixed(6),
        timestamp: Date.now()
      });
      
    } finally {
      if (client.isConnected()) {
        await client.disconnect();
      }
    }
    
  } catch (error) {
    console.error('❌ [LP Balance Error]:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch LP balances'
    });
  }
});

// ============================================================================
// GET /api/tradecenter/liquidity/pool-exists
// Check if AMM pool exists for asset pair
// ============================================================================

router.get('/pool-exists', async (req, res) => {
  try {
    const { asset1, asset2 } = req.query;
    
    if (!asset1 || !asset2) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: asset1, asset2'
      });
    }
    
    const client = new Client(XRPL_SERVER);
    await client.connect();
    
    try {
      const parseAsset = (asset: string): any => {
        if (asset === 'XRP') return { currency: 'XRP' };
        const [currency, issuer] = asset.split('.');
        return issuer ? { currency, issuer } : { currency };
      };
      
      const ammInfo: any = await client.request({
        command: 'amm_info',
        asset: parseAsset(asset1 as string),
        asset2: parseAsset(asset2 as string)
      } as any);
      
      const exists = !!ammInfo.result?.amm;
      
      await client.disconnect();
      
      res.json({
        success: true,
        exists,
        pool: exists ? {
          ammAccount: ammInfo.result.amm.account,
          asset1: ammInfo.result.amm.amount,
          asset2: ammInfo.result.amm.amount2,
          lpToken: ammInfo.result.amm.lp_token
        } : null
      });
    } finally {
      if (client.isConnected()) {
        await client.disconnect();
      }
    }
  } catch (error) {
    console.error('❌ [Pool Exists Error]:', error);
    res.json({
      success: true,
      exists: false,
      pool: null
    });
  }
});

// ============================================================================
// GET /api/tradecenter/liquidity/calculate
// Calculate pool share and amounts for single or double-sided input
// ============================================================================

router.get('/calculate', async (req, res) => {
  try {
    const { asset1, asset2, amount, amount1, amount2, inputAsset, mode = 'single' } = req.query;
    
    if (!asset1 || !asset2) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: asset1, asset2'
      });
    }

    if (mode === 'single' && (!amount || !inputAsset)) {
      return res.status(400).json({
        success: false,
        error: 'Single mode requires: amount, inputAsset'
      });
    }

    if (mode === 'double' && (!amount1 || !amount2)) {
      return res.status(400).json({
        success: false,
        error: 'Double mode requires: amount1, amount2'
      });
    }
    
    console.log(`🧮 [Calculate Liquidity] ${mode} mode for ${asset1}/${asset2} pool`);
    
    const client = new Client(XRPL_SERVER);
    await client.connect();
    
    try {
      // Parse assets
      const parseAsset = (asset: string): any => {
        if (asset === 'XRP') return { currency: 'XRP' };
        const [currency, issuer] = asset.split('.');
        return issuer ? { currency, issuer } : { currency };
      };
      
      const ammInfo: any = await client.request({
        command: 'amm_info',
        asset: parseAsset(asset1 as string),
        asset2: parseAsset(asset2 as string)
      } as any);
      
      if (!ammInfo.result?.amm) {
        return res.status(404).json({
          success: false,
          error: 'AMM pool not found for this pair'
        });
      }
      
      const amm = ammInfo.result.amm;
      const pool1 = amm.amount;
      const pool2 = amm.amount2;
      
      const pool1Amount = typeof pool1 === 'string' ? parseFloat(pool1) / 1e6 : parseFloat(pool1.value || '0');
      const pool2Amount = typeof pool2 === 'string' ? parseFloat(pool2) / 1e6 : parseFloat(pool2.value || '0');
      
      const totalLPTokens = parseFloat(amm.lp_token?.value || '1');
      
      let inputAmount: number;
      let otherAssetAmount: number;
      let depositAmount1: number;
      let depositAmount2: number;
      
      if (mode === 'single') {
        // Single-sided: calculate the other asset needed
        inputAmount = parseFloat(amount as string);
        const isAsset1 = inputAsset === asset1;
        
        otherAssetAmount = isAsset1 
          ? (inputAmount * pool2Amount) / pool1Amount
          : (inputAmount * pool1Amount) / pool2Amount;
        
        depositAmount1 = isAsset1 ? inputAmount : otherAssetAmount;
        depositAmount2 = isAsset1 ? otherAssetAmount : inputAmount;
      } else {
        // Double-sided: use both provided amounts
        depositAmount1 = parseFloat(amount1 as string);
        depositAmount2 = parseFloat(amount2 as string);
        inputAmount = depositAmount1;
        otherAssetAmount = depositAmount2;
      }
      
      // Calculate LP tokens to be minted
      // Formula: LP_minted = sqrt(amount1 * amount2) * total_LP / sqrt(pool1 * pool2)
      const currentK = Math.sqrt(pool1Amount * pool2Amount);
      const newK = Math.sqrt(
        (pool1Amount + depositAmount1) *
        (pool2Amount + depositAmount2)
      );
      
      const lpTokensMinted = ((newK - currentK) / currentK) * totalLPTokens;
      
      // Calculate pool share percentage
      const newTotalLP = totalLPTokens + lpTokensMinted;
      const poolSharePercent = (lpTokensMinted / newTotalLP) * 100;
      
      // Calculate TVL
      const currentTVL = pool1Amount + pool2Amount; // Simplified, both in same unit
      const newTVL = currentTVL + inputAmount + otherAssetAmount;
      
      await client.disconnect();
      
      const response: any = {
        success: true,
        mode,
        poolShare: {
          lpTokens: lpTokensMinted.toFixed(6),
          percentage: poolSharePercent.toFixed(4),
          formatted: `${poolSharePercent.toFixed(4)}%`
        },
        pool: {
          current: {
            asset1: pool1Amount.toFixed(6),
            asset2: pool2Amount.toFixed(6),
            tvl: currentTVL.toFixed(6)
          },
          afterDeposit: {
            asset1: (pool1Amount + depositAmount1).toFixed(6),
            asset2: (pool2Amount + depositAmount2).toFixed(6),
            tvl: newTVL.toFixed(6)
          }
        },
        priceImpact: {
          value: 0,
          formatted: '0.00%'
        },
        tradingFee: amm.trading_fee || 0,
        tradingFeePercent: ((amm.trading_fee || 0) / 1000).toFixed(3),
        timestamp: Date.now()
      };

      if (mode === 'single') {
        response.input = {
          asset: inputAsset,
          amount: inputAmount.toFixed(6)
        };
        response.required = {
          asset: inputAsset === asset1 ? asset2 : asset1,
          amount: otherAssetAmount.toFixed(6)
        };
      } else {
        response.amounts = {
          asset1: depositAmount1.toFixed(6),
          asset2: depositAmount2.toFixed(6)
        };
      }

      res.json(response);
      
    } finally {
      if (client.isConnected()) {
        await client.disconnect();
      }
    }
    
  } catch (error) {
    console.error('❌ [Calculate Liquidity Error]:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to calculate liquidity'
    });
  }
});

// ============================================================================
// GET /api/tradecenter/liquidity/pool/:asset1/:asset2
// Get specific pool information with comprehensive data
// ============================================================================

router.get('/pool/:asset1/:asset2', requireAuth, async (req, res) => {
  try {
    const { asset1, asset2 } = req.params;
    
    console.log(`🏊 [Pool Info] Fetching pool ${asset1} <> ${asset2}`);
    
    const client = new Client(XRPL_SERVER);
    await client.connect();
    
    try {
      // Parse assets
      const parseAsset = (asset: string): any => {
        if (asset === 'XRP') return { currency: 'XRP' };
        const [currency, issuer] = asset.split('.');
        return issuer ? { currency, issuer } : { currency };
      };
      
      const ammInfo: any = await client.request({
        command: 'amm_info',
        asset: parseAsset(asset1),
        asset2: parseAsset(asset2)
      } as any);
      
      if (!ammInfo.result?.amm) {
        return res.status(404).json({
          success: false,
          error: 'AMM pool not found for this pair'
        });
      }
      
      const amm = ammInfo.result.amm;
      const pool1 = amm.amount;
      const pool2 = amm.amount2;
      
      const pool1Amount = typeof pool1 === 'string' ? parseFloat(pool1) : parseFloat(pool1.value || '0');
      const pool2Amount = typeof pool2 === 'string' ? parseFloat(pool2) : parseFloat(pool2.value || '0');
      
      // Calculate price
      const price1in2 = pool2Amount / pool1Amount;
      const price2in1 = pool1Amount / pool2Amount;
      
      // Get token info from Bithomp if not XRP
      const token1Info = asset1 !== 'XRP' && asset1.includes('.') 
        ? await bithompAPI.getToken(asset1.split('.')[1], asset1.split('.')[0]).catch(() => null)
        : null;
      
      const token2Info = asset2 !== 'XRP' && asset2.includes('.')
        ? await bithompAPI.getToken(asset2.split('.')[1], asset2.split('.')[0]).catch(() => null)
        : null;
      
      res.json({
        success: true,
        pool: {
          ammAccount: amm.account,
          asset1: {
            currency: typeof pool1 === 'string' ? 'XRP' : pool1.currency,
            issuer: typeof pool1 === 'string' ? null : pool1.issuer,
            amount: pool1Amount.toFixed(6),
            // Bithomp enriched data
            name: token1Info?.name,
            icon: token1Info?.icon,
            verification_status: token1Info?.verification_status
          },
          asset2: {
            currency: typeof pool2 === 'string' ? 'XRP' : pool2.currency,
            issuer: typeof pool2 === 'string' ? null : pool2.issuer,
            amount: pool2Amount.toFixed(6),
            // Bithomp enriched data
            name: token2Info?.name,
            icon: token2Info?.icon,
            verification_status: token2Info?.verification_status
          },
          prices: {
            asset1InAsset2: price1in2.toFixed(8),
            asset2InAsset1: price2in1.toFixed(8)
          },
          lpToken: {
            currency: amm.lp_token?.currency,
            value: amm.lp_token?.value
          },
          tradingFee: amm.trading_fee || 0,
          auctionSlot: amm.auction_slot || null,
          voteSlots: amm.vote_slots || []
        },
        timestamp: Date.now()
      });
      
    } finally {
      if (client.isConnected()) {
        await client.disconnect();
      }
    }
    
  } catch (error) {
    console.error('❌ [Pool Info Error]:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch pool info'
    });
  }
});

export default router;
