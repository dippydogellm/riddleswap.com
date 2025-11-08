import { ethers } from 'ethers';
import { Connection, PublicKey } from '@solana/web3.js';

interface WalletData {
  xrpAddress?: string;
  ethAddress?: string;
  solAddress?: string;
  btcAddress?: string;
}

interface ChainBalanceResult {
  chain: string;
  balance: string;
  usdValue: number;
  symbol: string;
}

interface MultiChainBalanceResult {
  totalUsd: number;
  chains: ChainBalanceResult[];
}

interface PriceMap {
  [key: string]: number;
}

// In-memory price cache to avoid rate limiting
const priceCache = new Map<string, { prices: PriceMap; timestamp: number }>();
const PRICE_CACHE_TTL = 120000; // 2 minutes cache

// Batch fetch all crypto prices in a single API call
async function getAllCryptoPrices(coins: string[]): Promise<PriceMap> {
  try {
    // Check cache first
    const cacheKey = 'all-prices';
    const cached = priceCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < PRICE_CACHE_TTL) {
      console.log('✅ [PRICES] Using cached prices');
      return cached.prices;
    }

    // Fetch all prices in a single call
    const coinIds = coins.join(',');
    console.log(`🔄 [PRICES] Fetching prices for: ${coinIds}`);
    
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds}&vs_currencies=usd`,
      { 
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000)
      }
    );
    
    if (!response.ok) {
      // If rate limited, return cached prices if available
      if (response.status === 429) {
        console.warn('⚠️ [PRICES] Rate limited, using cached prices if available');
        return cached?.prices || {};
      }
      throw new Error(`Price fetch failed: ${response.status}`);
    }
    
    const data = await response.json() as any;
    
    // Convert to simple price map
    const prices: PriceMap = {};
    for (const [coin, value] of Object.entries(data)) {
      prices[coin] = (value as any)?.usd || 0;
    }
    
    // Cache the prices
    priceCache.set(cacheKey, { prices, timestamp: Date.now() });
    
    console.log('✅ [PRICES] Fetched prices:', prices);
    return prices;
  } catch (error) {
    console.error('❌ [PRICES] Error fetching prices:', error);
    // Return cached prices if available, otherwise empty object
    const cached = priceCache.get('all-prices');
    return cached?.prices || {};
  }
}

// Get XRP balance from Bithomp API with proper error handling
async function getXRPBalance(address: string, xrpPrice: number): Promise<{ balance: string; usdValue: number }> {
  try {
    const bithompKey = process.env.BITHOMP_API_KEY;
    if (!bithompKey) {
      console.error('❌ [BALANCE] BITHOMP_API_KEY not configured - XRP balance unavailable');
      return { balance: '0', usdValue: 0 };
    }

    const response = await fetch(`https://api.bithomp.com/v2/address/${address}`, {
      headers: {
        'x-bithomp-token': bithompKey,
        'User-Agent': 'RiddleSwap/1.0',
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(10000)
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No error text');
      if (response.status === 429) {
        console.warn(`⚠️ [BALANCE] Bithomp API rate limited for ${address.substring(0, 8)}...`);
      } else if (response.status === 401 || response.status === 403) {
        console.error(`❌ [BALANCE] Bithomp API authentication failed (${response.status}): ${errorText}`);
      } else {
        console.error(`❌ [BALANCE] Bithomp API error ${response.status} for ${address.substring(0, 8)}...: ${errorText}`);
      }
      return { balance: '0', usdValue: 0 };
    }
    
    const data = await response.json() as any;
    const balance = parseFloat(data.balance || '0');
    
    return {
      balance: balance.toFixed(6),
      usdValue: balance * xrpPrice
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    // More specific error handling
    if (errorMsg.includes('fetch failed')) {
      console.error(`❌ [BALANCE] Network error fetching XRP balance for ${address.substring(0, 8)}... - check internet connection`);
    } else if (!errorMsg.includes('aborted') && !errorMsg.includes('timeout')) {
      console.error(`❌ [BALANCE] Unexpected error for ${address.substring(0, 8)}...: ${errorMsg}`);
    }
    return { balance: '0', usdValue: 0 };
  }
}

// Get ETH balance (works for all EVM chains)
async function getEVMBalance(
  address: string, 
  rpcUrl: string, 
  symbol: string,
  price: number
): Promise<{ balance: string; usdValue: number }> {
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const balanceWei = await provider.getBalance(address);
    const balance = parseFloat(ethers.formatEther(balanceWei));
    
    return {
      balance: balance.toFixed(6),
      usdValue: balance * price
    };
  } catch (error) {
    console.error(`❌ [BALANCE] Error fetching ${symbol} balance:`, error);
    return { balance: '0', usdValue: 0 };
  }
}

// Get Solana balance
async function getSOLBalance(address: string, solPrice: number): Promise<{ balance: string; usdValue: number }> {
  try {
    const connection = new Connection('https://api.mainnet-beta.solana.com');
    const pubkey = new PublicKey(address);
    const balanceLamports = await connection.getBalance(pubkey);
    const balance = balanceLamports / 1e9; // Convert lamports to SOL
    
    return {
      balance: balance.toFixed(6),
      usdValue: balance * solPrice
    };
  } catch (error) {
    console.error('❌ [BALANCE] Error fetching SOL balance:', error);
    return { balance: '0', usdValue: 0 };
  }
}

// Get Bitcoin balance (using blockchain.info API)
async function getBTCBalance(address: string, btcPrice: number): Promise<{ balance: string; usdValue: number }> {
  try {
    const response = await fetch(`https://blockchain.info/q/addressbalance/${address}`, {
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error(`BTC balance fetch failed: ${response.status}`);
    
    const satoshis = await response.text();
    const balance = parseFloat(satoshis) / 1e8; // Convert satoshis to BTC
    
    return {
      balance: balance.toFixed(8),
      usdValue: balance * btcPrice
    };
  } catch (error) {
    console.error('❌ [BALANCE] Error fetching BTC balance:', error);
    return { balance: '0', usdValue: 0 };
  }
}

// Main function to get all balances
export async function getMultiChainBalances(walletData: WalletData): Promise<MultiChainBalanceResult> {
  const chains: ChainBalanceResult[] = [];
  
  try {
    console.log('💰 [BALANCE] Starting multi-chain balance fetch');
    
    // Step 1: Determine which coins we need prices for
    const requiredCoins: string[] = [];
    if (walletData.xrpAddress) requiredCoins.push('ripple');
    if (walletData.ethAddress) requiredCoins.push('ethereum');
    if (walletData.solAddress) requiredCoins.push('solana');
    if (walletData.btcAddress) requiredCoins.push('bitcoin');
    
    // Step 2: Fetch ALL prices in a single API call
    const prices = await getAllCryptoPrices(requiredCoins);
    
    // Step 3: Fetch all balances in parallel using the pre-fetched prices
    const balancePromises: Promise<void>[] = [];

    // XRP
    if (walletData.xrpAddress) {
      balancePromises.push(
        getXRPBalance(walletData.xrpAddress, prices['ripple'] || 0).then(result => {
          chains.push({
            chain: 'xrp',
            balance: result.balance,
            usdValue: result.usdValue,
            symbol: 'XRP'
          });
        })
      );
    }

    // Ethereum
    if (walletData.ethAddress) {
      balancePromises.push(
        getEVMBalance(
          walletData.ethAddress,
          'https://eth.llamarpc.com',
          'ETH',
          prices['ethereum'] || 0
        ).then(result => {
          chains.push({
            chain: 'ethereum',
            balance: result.balance,
            usdValue: result.usdValue,
            symbol: 'ETH'
          });
        })
      );
    }

    // Solana
    if (walletData.solAddress) {
      balancePromises.push(
        getSOLBalance(walletData.solAddress, prices['solana'] || 0).then(result => {
          chains.push({
            chain: 'solana',
            balance: result.balance,
            usdValue: result.usdValue,
            symbol: 'SOL'
          });
        })
      );
    }

    // Bitcoin
    if (walletData.btcAddress) {
      balancePromises.push(
        getBTCBalance(walletData.btcAddress, prices['bitcoin'] || 0).then(result => {
          chains.push({
            chain: 'bitcoin',
            balance: result.balance,
            usdValue: result.usdValue,
            symbol: 'BTC'
          });
        })
      );
    }

    // Wait for all balances to be fetched
    await Promise.allSettled(balancePromises);

    // Calculate total USD value
    const totalUsd = chains.reduce((sum, chain) => sum + chain.usdValue, 0);

    console.log('✅ [BALANCE] Multi-chain balance fetch complete:', {
      totalUsd: totalUsd.toFixed(2),
      chains: chains.length
    });

    return {
      totalUsd,
      chains
    };
  } catch (error) {
    console.error('❌ [BALANCE] Error in getMultiChainBalances:', error);
    return {
      totalUsd: 0,
      chains
    };
  }
}
