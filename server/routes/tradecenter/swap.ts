import express from 'express';
import { z } from 'zod';
import { Client } from 'xrpl';
import fetch from 'node-fetch';
import { bithompAPI } from '../../bithomp-api-v2';

const router = express.Router();

// API Endpoints
const JUPITER_API = 'https://quote-api.jup.ag/v6';
const ONEINCH_API = 'https://api.1inch.dev/swap/v6.0';
const ONEINCH_API_KEY = process.env.ONEINCH_API_KEY || '';

// XRPL Client
const XRPL_SERVER = 'wss://s1.ripple.com';

// Chain IDs for 1inch
const CHAIN_IDS: Record<string, number> = {
  eth: 1,
  bsc: 56,
  polygon: 137,
  arbitrum: 42161,
  optimism: 10
};

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const SwapRequestSchema = z.object({
  fromToken: z.string().min(1, 'From token is required'),
  toToken: z.string().min(1, 'To token is required'),
  amount: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
    message: 'Amount must be a positive number'
  }),
  chain: z.enum(['xrp', 'eth', 'sol', 'btc']),
  slippage: z.number().min(0.1).max(50).default(1), // 0.1% to 50%
  walletAddress: z.string().min(1, 'Wallet address is required')
});

const QuoteRequestSchema = z.object({
  fromToken: z.string().min(1),
  toToken: z.string().min(1),
  amount: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0),
  chain: z.enum(['xrp', 'eth', 'sol', 'btc']),
  slippage: z.string().optional().transform(val => val ? parseFloat(val) : 0.5) // Default 0.5%
});

// ============================================================================
// MIDDLEWARE - SESSION & AUTHENTICATION
// ============================================================================

const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const handle = req.session?.handle;
  
  if (!handle) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }
  
  // Session already attached by express-session
  next();
};

// ============================================================================
// GET /api/tradecenter/swap/quote
// Get swap quote without executing
// ============================================================================

router.get('/quote', requireAuth, async (req, res) => {
  try {
    const validation = QuoteRequestSchema.safeParse(req.query);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request parameters',
        details: validation.error.errors
      });
    }
    
    const { fromToken, toToken, amount, chain, slippage } = validation.data;
    const handle = req.session?.handle;
    
    console.log(`💱 [Swap Quote] ${handle} requesting quote: ${amount} ${fromToken} -> ${toToken} on ${chain} (${slippage}% slippage)`);
    
    // Route to appropriate chain handler
    let quoteData;
    switch (chain) {
      case 'xrp':
        quoteData = await getXRPSwapQuote(fromToken, toToken, amount, slippage, req.session);
        break;
      case 'eth':
        quoteData = await getETHSwapQuote(fromToken, toToken, amount, slippage, req.session);
        break;
      case 'sol':
        quoteData = await getSOLSwapQuote(fromToken, toToken, amount, slippage, req.session);
        break;
      case 'btc':
        return res.status(400).json({
          success: false,
          error: 'BTC swaps not yet supported - use bridge instead'
        });
      default:
        return res.status(400).json({
          success: false,
          error: 'Unsupported chain'
        });
    }
    
    res.json({
      success: true,
      quote: quoteData,
      timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('❌ [Swap Quote Error]:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get swap quote'
    });
  }
});

// ============================================================================
// POST /api/tradecenter/swap/execute
// Execute a swap transaction
// ============================================================================

router.post('/execute', requireAuth, async (req, res) => {
  try {
    const validation = SwapRequestSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid swap request',
        details: validation.error.errors
      });
    }
    
    const { fromToken, toToken, amount, chain, slippage, walletAddress } = validation.data;
    const handle = req.session?.handle;
    const walletData = req.session?.walletData;
    
    console.log(`💱 [Swap Execute] ${handle} executing: ${amount} ${fromToken} -> ${toToken} on ${chain}`);
    
    // Verify wallet ownership
    if (!walletData) {
      return res.status(403).json({
        success: false,
        error: 'No wallet data found in session'
      });
    }
    
    // Validate wallet address matches session
    const chainKey = `${chain}Address`;
    if (walletData[chainKey] !== walletAddress) {
      return res.status(403).json({
        success: false,
        error: 'Wallet address does not match session'
      });
    }
    
    // Execute swap based on chain
    let swapResult;
    switch (chain) {
      case 'xrp':
        swapResult = await executeXRPSwap(fromToken, toToken, amount, slippage, walletAddress, req.session);
        break;
      case 'eth':
        swapResult = await executeETHSwap(fromToken, toToken, amount, slippage, walletAddress, req.session);
        break;
      case 'sol':
        swapResult = await executeSOLSwap(fromToken, toToken, amount, slippage, walletAddress, req.session);
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Unsupported chain'
        });
    }
    
    res.json({
      success: true,
      transaction: swapResult,
      timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('❌ [Swap Execute Error]:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Swap execution failed'
    });
  }
});

// ============================================================================
// CHAIN-SPECIFIC HANDLERS
// ============================================================================

async function getXRPSwapQuote(fromToken: string, toToken: string, amount: string, slippage: number, session: any) {
  const client = new Client(XRPL_SERVER);
  
  try {
    await client.connect();
    console.log(`💱 [XRPL AMM] Getting quote: ${amount} ${fromToken} → ${toToken} (${slippage}% slippage)`);
    
    // Parse token currencies (XRP or IOU format)
    const fromCurrency = fromToken === 'XRP' ? { currency: 'XRP' } : parseCurrency(fromToken);
    const toCurrency = toToken === 'XRP' ? { currency: 'XRP' } : parseCurrency(toToken);
    
    // Get AMM info
    const ammInfo = await client.request({
      command: 'amm_info',
      asset: fromCurrency,
      asset2: toCurrency
    });
    
    if (!ammInfo.result.amm) {
      throw new Error('No AMM pool found for this token pair');
    }
    
    const amm = ammInfo.result.amm;
    const pool = amm.amount;
    const pool2 = amm.amount2;
    
    // Calculate output using constant product formula (x * y = k)
    const fromReserve = parseFloat(typeof pool === 'string' ? pool : pool.value);
    const toReserve = parseFloat(typeof pool2 === 'string' ? pool2 : pool2.value);
    const inputAmount = parseFloat(amount);
    
    // Calculate output with 0.6% trading fee
    const feeMultiplier = 0.994; // 1 - 0.006
    const inputWithFee = inputAmount * feeMultiplier;
    const outputAmount = (toReserve * inputWithFee) / (fromReserve + inputWithFee);
    
    // Calculate slippage and price impact
    const priceImpact = ((inputAmount / fromReserve) * 100);
    const minimumReceived = outputAmount * (1 - slippage / 100); // Use actual slippage from user
    
    console.log(`✅ [XRPL AMM] Quote: ${outputAmount.toFixed(6)} ${toToken} (${priceImpact.toFixed(2)}% impact, min: ${minimumReceived.toFixed(6)})`);
    
    return {
      fromToken,
      toToken,
      fromAmount: amount,
      toAmount: outputAmount.toFixed(6),
      priceImpact: parseFloat(priceImpact.toFixed(4)),
      minimumReceived: minimumReceived.toFixed(6),
      slippage: slippage,
      route: ['XRPL-AMM'],
      fee: '0.6%',
      ammAccount: amm.account,
      lpTokenBalance: amm.lp_token
    };
    
  } catch (error) {
    console.error('❌ [XRPL AMM] Quote error:', error);
    throw new Error(`XRPL AMM quote failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    await client.disconnect();
  }
}

function parseCurrency(token: string): any {
  // Token format: "CURRENCY.ISSUER" or just "CURRENCY"
  const parts = token.split('.');
  if (parts.length === 2) {
    return {
      currency: parts[0],
      issuer: parts[1]
    };
  }
  return { currency: token };
}

// ============================================================================
// GET /api/tradecenter/swap/balances/:address
// Get wallet token balances with full Bithomp data
// ============================================================================

router.get('/balances/:address', requireAuth, async (req, res) => {
  try {
    const { address } = req.params;
    const { chain = 'xrp' } = req.query;
    
    console.log(`💰 [Balance] Fetching balances for ${address} on ${chain}`);
    
    if (chain === 'xrp') {
      // Get comprehensive XRPL data from Bithomp
      const [tokenBalances, nfts, xrpBalance] = await Promise.all([
        bithompAPI.getAddressTokenBalances(address),
        bithompAPI.getAddressNFTs(address).catch(() => []),
        getXRPBalance(address)
      ]);
      
      // Enrich token data with Bithomp info
      const enrichedTokens = await Promise.all(
        tokenBalances.map(async (token: any) => {
          try {
            const tokenInfo = await bithompAPI.getToken(token.issuer || token.counterparty, token.currency);
            return {
              currency: token.currency,
              issuer: token.issuer || token.counterparty,
              balance: token.balance || token.value,
              limit: token.limit,
              // Bithomp enriched data
              name: tokenInfo?.name,
              icon: tokenInfo?.icon,
              description: tokenInfo?.description,
              website: tokenInfo?.website,
              verification_status: tokenInfo?.verification_status,
              volume_24h: tokenInfo?.volume_24h,
              change_24h: tokenInfo?.change_24h,
              holders: tokenInfo?.holders,
              // Social links
              twitter: tokenInfo?.twitter,
              telegram: tokenInfo?.telegram,
              discord: tokenInfo?.discord
            };
          } catch (error) {
            return {
              currency: token.currency,
              issuer: token.issuer || token.counterparty,
              balance: token.balance || token.value,
              limit: token.limit
            };
          }
        })
      );
      
      res.json({
        success: true,
        chain: 'xrp',
        address,
        balances: {
          xrp: xrpBalance,
          tokens: enrichedTokens,
          nfts: nfts.length
        },
        totalTokens: enrichedTokens.length,
        totalNFTs: nfts.length,
        timestamp: Date.now()
      });
    } else {
      // EVM/SOL chains - simplified balance check
      res.json({
        success: true,
        chain,
        address,
        message: 'Balance checking for non-XRPL chains requires web3 provider',
        timestamp: Date.now()
      });
    }
    
  } catch (error) {
    console.error('❌ [Balance Error]:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch balances'
    });
  }
});

// ============================================================================
// GET /api/tradecenter/swap/tokens
// Get available tokens for swapping with full Bithomp data
// ============================================================================

router.get('/tokens', requireAuth, async (req, res) => {
  try {
    const { chain = 'xrp', search, limit = 50 } = req.query;
    
    console.log(`🪙 [Tokens] Fetching tokens for ${chain}${search ? ` matching "${search}"` : ''}`);
    
    if (chain === 'xrp') {
      let tokens;
      
      if (search && typeof search === 'string') {
        // Search tokens with Bithomp
        tokens = await bithompAPI.searchTokens(search, parseInt(limit as string));
      } else {
        // Get all tokens
        tokens = await bithompAPI.getAllTokens(parseInt(limit as string));
      }
      
      // Add XRP as native token
      const xrpToken = bithompAPI.getXRPToken();
      
      res.json({
        success: true,
        chain: 'xrp',
        tokens: [
          {
            currency: xrpToken.currency,
            name: xrpToken.name,
            issuer: null,
            native: true,
            icon: 'https://cdn.bithomp.com/chains/xrp.svg'
          },
          ...tokens.map(t => ({
            currency: t.currency,
            issuer: t.issuer,
            name: t.name,
            icon: t.icon,
            description: t.description,
            website: t.website,
            verification_status: t.verification_status,
            volume_24h: t.volume_24h,
            change_24h: t.change_24h,
            holders: t.holders,
            // Social links
            twitter: t.twitter,
            telegram: t.telegram,
            discord: t.discord,
            reddit: t.reddit
          }))
        ],
        count: tokens.length + 1,
        timestamp: Date.now()
      });
    } else {
      res.json({
        success: true,
        chain,
        message: 'Token list for non-XRPL chains uses 1inch/Jupiter APIs',
        timestamp: Date.now()
      });
    }
    
  } catch (error) {
    console.error('❌ [Tokens Error]:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch tokens'
    });
  }
});

// ============================================================================
// GET /api/tradecenter/swap/token/:issuer/:currency
// Get detailed token information from Bithomp
// ============================================================================

router.get('/token/:issuer/:currency', requireAuth, async (req, res) => {
  try {
    const { issuer, currency } = req.params;
    
    console.log(`🔍 [Token Info] Fetching ${currency} from ${issuer}`);
    
    const tokenInfo = await bithompAPI.getToken(issuer, currency);
    
    if (!tokenInfo) {
      return res.status(404).json({
        success: false,
        error: 'Token not found'
      });
    }
    
    res.json({
      success: true,
      token: {
        currency: tokenInfo.currency,
        issuer: tokenInfo.issuer,
        name: tokenInfo.name,
        description: tokenInfo.description,
        icon: tokenInfo.icon,
        website: tokenInfo.website,
        verification_status: tokenInfo.verification_status,
        // Statistics
        holders: tokenInfo.holders,
        volume_24h: tokenInfo.volume_24h,
        volume_7d: tokenInfo.volume_7d,
        volume_30d: tokenInfo.volume_30d,
        change_24h: tokenInfo.change_24h,
        change_7d: tokenInfo.change_7d,
        change_30d: tokenInfo.change_30d,
        // Social links
        twitter: tokenInfo.twitter,
        telegram: tokenInfo.telegram,
        discord: tokenInfo.discord,
        reddit: tokenInfo.reddit,
        // Timestamps
        created: tokenInfo.created,
        updated: tokenInfo.updated
      },
      timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('❌ [Token Info Error]:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch token info'
    });
  }
});

// Helper to get XRP balance
async function getXRPBalance(address: string): Promise<string> {
  const client = new Client(XRPL_SERVER);
  try {
    await client.connect();
    const response = await client.request({
      command: 'account_info',
      account: address,
      ledger_index: 'validated'
    });
    await client.disconnect();
    
    const balance = response.result.account_data.Balance;
    return (parseInt(balance) / 1000000).toFixed(6);
  } catch (error) {
    console.error('Failed to get XRP balance:', error);
    return '0';
  }
}

async function getETHSwapQuote(fromToken: string, toToken: string, amount: string, slippage: number, session: any) {
  try {
    console.log(`💱 [1INCH] Getting quote: ${amount} ${fromToken} → ${toToken} (${slippage}% slippage)`);
    
    const chainId = CHAIN_IDS.eth;
    const amountWei = (parseFloat(amount) * 1e18).toString();
    
    const params = new URLSearchParams({
      src: fromToken,
      dst: toToken,
      amount: amountWei,
      includeGas: 'true'
    });
    
    const url = `${ONEINCH_API}/${chainId}/quote?${params}`;
    const headers: any = { 'Accept': 'application/json' };
    
    if (ONEINCH_API_KEY) {
      headers['Authorization'] = `Bearer ${ONEINCH_API_KEY}`;
    }
    
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      throw new Error(`1inch API error: ${response.status}`);
    }
    
    const quote = await response.json() as any;
    const outputAmount = (parseInt(quote.dstAmount) / 1e18);
    const minimumReceived = outputAmount * (1 - slippage / 100);
    
    console.log(`✅ [1INCH] Quote: ${outputAmount.toFixed(6)} ${toToken} (min: ${minimumReceived.toFixed(6)})`);
    
    return {
      fromToken,
      toToken,
      fromAmount: amount,
      toAmount: outputAmount.toFixed(6),
      priceImpact: 0,
      minimumReceived: minimumReceived.toFixed(6),
      slippage: slippage,
      route: ['1inch'],
      fee: '0-1%',
      gasEstimate: quote.gas || '0',
      dex: '1inch Aggregator'
    };
    
  } catch (error) {
    console.error('❌ [1INCH] Quote error:', error);
    const outputAmount = (parseFloat(amount) * 0.99);
    const minimumReceived = outputAmount * (1 - slippage / 100);
    
    return {
      fromToken,
      toToken,
      fromAmount: amount,
      toAmount: outputAmount.toFixed(6),
      priceImpact: 1,
      minimumReceived: minimumReceived.toFixed(6),
      slippage: slippage,
      route: ['uniswap-v3'],
      fee: '0.3%',
      warning: '1inch API unavailable - estimated quote'
    };
  }
}

async function getSOLSwapQuote(fromToken: string, toToken: string, amount: string, slippage: number, session: any) {
  try {
    console.log(`💱 [JUPITER] Getting quote: ${amount} ${fromToken} → ${toToken} (${slippage}% slippage)`);
    
    const amountLamports = fromToken === 'So11111111111111111111111111111111111111112' 
      ? (parseFloat(amount) * 1e9).toString()
      : (parseFloat(amount) * 1e6).toString();
    
    // Convert slippage to basis points (1% = 100 bps)
    const slippageBps = Math.floor(slippage * 100);
    
    const params = new URLSearchParams({
      inputMint: fromToken,
      outputMint: toToken,
      amount: amountLamports,
      slippageBps: slippageBps.toString(),
      onlyDirectRoutes: 'false'
    });
    
    const response = await fetch(`${JUPITER_API}/quote?${params}`);
    
    if (!response.ok) {
      throw new Error(`Jupiter API error: ${response.status}`);
    }
    
    const quote = await response.json() as any;
    const outputAmount = (parseInt(quote.outAmount) / 1e6);
    const minimumReceived = outputAmount * (1 - slippage / 100);
    const priceImpact = parseFloat(quote.priceImpactPct || '0');
    
    console.log(`✅ [JUPITER] Quote: ${outputAmount.toFixed(6)} (${priceImpact}% impact, min: ${minimumReceived.toFixed(6)})`);
    
    return {
      fromToken,
      toToken,
      fromAmount: amount,
      toAmount: outputAmount.toFixed(6),
      priceImpact,
      minimumReceived: minimumReceived.toFixed(6),
      slippage: slippage,
      route: quote.routePlan?.map((r: any) => r.swapInfo?.label) || ['Jupiter'],
      fee: '0.25%',
      quoteResponse: quote,
      dex: 'Jupiter Aggregator'
    };
    
  } catch (error) {
    console.error('❌ [JUPITER] Quote error:', error);
    const outputAmount = (parseFloat(amount) * 0.98);
    const minimumReceived = outputAmount * (1 - slippage / 100);
    
    return {
      fromToken,
      toToken,
      fromAmount: amount,
      toAmount: outputAmount.toFixed(6),
      priceImpact: 1,
      minimumReceived: minimumReceived.toFixed(6),
      slippage: slippage,
      route: ['raydium'],
      fee: '0.25%',
      warning: 'Jupiter API unavailable - estimated quote'
    };
  }
}

async function executeXRPSwap(fromToken: string, toToken: string, amount: string, slippage: number, walletAddress: string, session: any) {
  console.log(`🚀 [XRPL] Executing swap: ${amount} ${fromToken} → ${toToken}`);
  
  // TODO: Implement actual XRPL swap execution
  // 1. Get cached private key from session
  // 2. Create AMMDeposit transaction
  // 3. Sign and submit to XRPL
  // 4. Return transaction hash
  
  return {
    success: true,
    chain: 'xrp',
    hash: 'MOCK_TX_HASH',
    fromToken,
    toToken,
    fromAmount: amount,
    explorerUrl: `https://livenet.xrpl.org/transactions/MOCK_TX_HASH`,
    message: 'XRP swap execution requires wallet integration - returning mock result'
  };
}

async function executeETHSwap(fromToken: string, toToken: string, amount: string, slippage: number, walletAddress: string, session: any) {
  console.log(`🚀 [ETH] Executing swap: ${amount} ${fromToken} → ${toToken}`);
  
  // TODO: Implement actual ETH swap execution
  // 1. Get cached private key from session
  // 2. Use 1inch swap endpoint to get transaction data
  // 3. Sign and broadcast transaction
  // 4. Return transaction hash
  
  return {
    success: true,
    chain: 'eth',
    hash: '0xMOCK_TX_HASH',
    fromToken,
    toToken,
    fromAmount: amount,
    explorerUrl: `https://etherscan.io/tx/0xMOCK_TX_HASH`,
    message: 'ETH swap execution requires wallet integration - returning mock result'
  };
}

async function executeSOLSwap(fromToken: string, toToken: string, amount: string, slippage: number, walletAddress: string, session: any) {
  console.log(`🚀 [SOL] Executing swap: ${amount} ${fromToken} → ${toToken}`);
  
  // TODO: Implement actual SOL swap execution
  // 1. Get cached private key from session
  // 2. Use Jupiter swap endpoint to get transaction
  // 3. Sign and submit to Solana network
  // 4. Return signature
  
  return {
    success: true,
    chain: 'sol',
    signature: 'MOCK_SIGNATURE',
    fromToken,
    toToken,
    fromAmount: amount,
    explorerUrl: `https://solscan.io/tx/MOCK_SIGNATURE`,
    message: 'SOL swap execution requires wallet integration - returning mock result'
  };
}

export default router;
