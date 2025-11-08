// BTC Wallet Endpoints - Simple & Working
import { Router, Request, Response } from 'express';

const router = Router();

// Simple in-memory cache for BTC balance to prevent rate limiting
interface CacheEntry {
  data: any;
  timestamp: number;
}

const btcCache = new Map<string, CacheEntry>();
const CACHE_DURATION = 60 * 1000; // 60 seconds cache
const MIN_REQUEST_INTERVAL = 1000; // Minimum 1 second between API requests
let lastApiCall = 0;

// Helper to check if cache is still valid
const isCacheValid = (entry: CacheEntry | undefined): boolean => {
  if (!entry) return false;
  return Date.now() - entry.timestamp < CACHE_DURATION;
};

// Helper to rate limit API calls
const rateLimitApiCall = async (): Promise<void> => {
  const now = Date.now();
  const timeSinceLastCall = now - lastApiCall;
  if (timeSinceLastCall < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastCall));
  }
  lastApiCall = Date.now();
};

// BTC Balance - Real blockchain data  
router.get('/btc/balance/:address', async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    const cacheKey = `balance_${address}`;
    console.log(`🔍 [BTC] Getting balance for: ${address}`);
    
    // Check cache first
    const cachedEntry = btcCache.get(cacheKey);
    if (isCacheValid(cachedEntry)) {
      console.log(`📦 [BTC] Returning cached balance for: ${address}`);
      return res.json(cachedEntry!.data);
    }
    
    try {
      // Rate limit API calls
      await rateLimitApiCall();
      
      // Use BlockCypher API for BTC balance
      const btcResponse = await fetch(`https://api.blockcypher.com/v1/btc/main/addrs/${address}/balance`);
      const btcData = await btcResponse.json();
      
      if (btcData.error) {
        throw new Error(`BTC API Error: ${btcData.error}`);
      }
      
      // Convert satoshis to BTC
      const balance = (btcData.balance || 0) / 100000000;
      
      console.log(`💰 [BTC] Balance: ${balance.toFixed(8)} BTC`);
      
      // Get BTC price for USD value
      let usdValue = 0;
      try {
        const priceResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
        const priceData = await priceResponse.json();
        const btcPrice = priceData.bitcoin?.usd || 110000;
        usdValue = parseFloat((balance * btcPrice).toFixed(2));
      } catch (priceError) {
        console.log('⚠️ [BTC] Price fetch failed, using default');
        usdValue = parseFloat((balance * 110000).toFixed(2)); // Use default price
      }
      
      const responseData = {
        success: true,
        address,
        balance: balance.toFixed(8),
        balanceUsd: usdValue,
        transactions: btcData.n_tx || 0
      };
      
      // Cache the result
      btcCache.set(cacheKey, { data: responseData, timestamp: Date.now() });
      
      res.json(responseData);
      
    } catch (apiError: any) {
      // If API rate limit error, return zero balance with warning
      if (apiError.message?.includes('Limits reached') || apiError.message?.includes('rate limit')) {
        console.log(`⚠️ [BTC] Rate limited, returning zero balance for ${address}`);
        const fallbackData = {
          success: true,
          address,
          balance: '0.00000000',
          balanceUsd: 0,
          transactions: 0,
          warning: 'Rate limited - showing cached or zero balance'
        };
        // Cache even the fallback to prevent hammering
        btcCache.set(cacheKey, { data: fallbackData, timestamp: Date.now() });
        return res.json(fallbackData);
      }
      throw apiError;
    }
    
  } catch (error) {
    console.error(`❌ [BTC] Balance fetch failed:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'BTC balance fetch failed'
    });
  }
});

// BTC Portfolio data
router.get('/btc/portfolio/:address', async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    const cacheKey = `portfolio_${address}`;
    
    // Check cache first
    const cachedEntry = btcCache.get(cacheKey);
    if (isCacheValid(cachedEntry)) {
      console.log(`📦 [BTC] Returning cached portfolio for: ${address}`);
      return res.json(cachedEntry!.data);
    }
    
    try {
      // Rate limit API calls
      await rateLimitApiCall();
      
      // Use BlockCypher API for BTC balance
      const btcResponse = await fetch(`https://api.blockcypher.com/v1/btc/main/addrs/${address}/balance`);
      const btcData = await btcResponse.json();
      
      if (btcData.error) {
        throw new Error(`BTC API Error: ${btcData.error}`);
      }
      
      // Convert satoshis to BTC
      const balance = (btcData.balance || 0) / 100000000;
      const balanceData = { balance: balance.toFixed(8), transactions: btcData.n_tx || 0 };
      
      
      // Get BTC price
      let btcPrice = 110000; // Default price
      try {
        const priceResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
        const priceData = await priceResponse.json();
        btcPrice = priceData.bitcoin?.usd || 110000;
      } catch (priceError) {
        console.log('⚠️ [BTC] Price fetch failed, using default');
      }
      
      const usdValue = (parseFloat(balanceData.balance) * btcPrice).toFixed(2);
      
      const responseData = {
        success: true,
        chain: 'btc',
        address,
        balance: balanceData.balance,
        usdValue,
        transactions: balanceData.transactions
      };
      
      // Cache the result
      btcCache.set(cacheKey, { data: responseData, timestamp: Date.now() });
      
      res.json(responseData);
      
    } catch (apiError: any) {
      // If API rate limit error, return zero balance with warning
      if (apiError.message?.includes('Limits reached') || apiError.message?.includes('rate limit')) {
        console.log(`⚠️ [BTC] Rate limited, returning zero portfolio for ${address}`);
        const fallbackData = {
          success: true,
          chain: 'btc',
          address,
          balance: '0.00000000',
          usdValue: '0.00',
          transactions: 0,
          warning: 'Rate limited - showing cached or zero balance'
        };
        btcCache.set(cacheKey, { data: fallbackData, timestamp: Date.now() });
        return res.json(fallbackData);
      }
      throw apiError;
    }
    
  } catch (error) {
    console.error(`❌ [BTC] Portfolio fetch failed:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'BTC portfolio fetch failed'
    });
  }
});

// BTC Transactions - Real blockchain data
router.get('/btc/transactions/:address', async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    const { limit = 20 } = req.query;
    const cacheKey = `transactions_${address}_${limit}`;
    console.log(`📊 [BTC] Getting transactions for: ${address}`);
    
    // Check cache first
    const cachedEntry = btcCache.get(cacheKey);
    if (isCacheValid(cachedEntry)) {
      console.log(`📦 [BTC] Returning cached transactions for: ${address}`);
      return res.json(cachedEntry!.data);
    }
    
    try {
      // Rate limit API calls
      await rateLimitApiCall();
      
      const response = await fetch(`https://api.blockcypher.com/v1/btc/main/addrs/${address}/full?limit=${limit}`);
      const data = await response.json() as any;
      
      if (data.error) {
        throw new Error(`BTC API Error: ${data.error}`);
      }
      
      const transactions = data.txs || [];
      console.log(`📊 [BTC] Found ${transactions.length} transactions`);
      
      const responseData = {
        success: true,
        address,
        transactions: transactions.map((tx: any) => ({
          hash: tx.hash,
          time: tx.received,
          confirmations: tx.confirmations,
          total: tx.total / 100000000, // Convert to BTC
          fees: tx.fees / 100000000
        }))
      };
      
      // Cache the result
      btcCache.set(cacheKey, { data: responseData, timestamp: Date.now() });
      
      res.json(responseData);
      
    } catch (apiError: any) {
      // If API rate limit error, return empty transactions with warning
      if (apiError.message?.includes('Limits reached') || apiError.message?.includes('rate limit')) {
        console.log(`⚠️ [BTC] Rate limited, returning empty transactions for ${address}`);
        const fallbackData = {
          success: true,
          address,
          transactions: [],
          warning: 'Rate limited - unable to fetch transactions at this time'
        };
        btcCache.set(cacheKey, { data: fallbackData, timestamp: Date.now() });
        return res.json(fallbackData);
      }
      throw apiError;
    }
    
  } catch (error) {
    console.error(`❌ [BTC] Transactions fetch failed:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'BTC transactions fetch failed'
    });
  }
});

export default router;