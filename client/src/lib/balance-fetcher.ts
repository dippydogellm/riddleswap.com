/**
 * Centralized Balance Fetching Utility
 * 
 * This utility provides a consistent way to fetch balance data for all supported chains.
 * It uses the correct API paths that are mounted under /api/wallets/<chain>/
 */

export interface BalanceData {
  success: boolean;
  address: string;
  balance: string;
  balanceUsd?: number;
  usdValue?: string;
  totalBalance?: string;
  availableBalance?: string;
  reservedBalance?: string;
  ownerCount?: number;
  unfunded?: boolean;
  error?: string;
}

export interface PortfolioData {
  success: boolean;
  address: string;
  chain: string;
  balance: string;
  usdValue: string;
  tokens?: any[];
  nfts?: any[];
  error?: string;
}

/**
 * Fetch balance for a specific chain and address
 * Uses the correct API path: /api/wallets/<chain>/balance/:address
 */
export async function fetchChainBalance(
  chain: string, 
  address: string, 
  sessionToken?: string
): Promise<BalanceData> {
  if (!address) {
    return {
      success: false,
      address: '',
      balance: '0',
      error: 'Address is required'
    };
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    // Add authorization header if session token is provided
    if (sessionToken) {
      headers['Authorization'] = `Bearer ${sessionToken}`;
    }

    // Use PUBLIC API path (balance data doesn't require authentication)
    const response = await fetch(`/api/public/wallets/${chain}/balance/${address}`, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      console.error(`Balance fetch failed for ${chain}/${address}: ${response.status} ${response.statusText}`);
      return {
        success: false,
        address,
        balance: '0',
        error: `HTTP ${response.status}: ${response.statusText}`
      };
    }

    const data = await response.json() as any;
    console.log(`✅ Balance fetched for ${chain}/${address}:`, data);
    
    return {
      success: true,
      address: data.address || address,
      balance: data.balance || '0',
      balanceUsd: data.balanceUsd,
      usdValue: data.usdValue,
      totalBalance: data.totalBalance,
      availableBalance: data.availableBalance,
      reservedBalance: data.reservedBalance,
      ownerCount: data.ownerCount,
      unfunded: data.unfunded
    };

  } catch (error) {
    console.error(`❌ Balance fetch error for ${chain}/${address}:`, error);
    return {
      success: false,
      address,
      balance: '0',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Fetch portfolio data for a specific chain and address
 * Uses the correct API path: /api/wallets/<chain>/portfolio/:address
 */
export async function fetchChainPortfolio(
  chain: string, 
  address: string, 
  sessionToken?: string
): Promise<PortfolioData> {
  if (!address) {
    return {
      success: false,
      address: '',
      chain,
      balance: '0',
      usdValue: '0',
      error: 'Address is required'
    };
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (sessionToken) {
      headers['Authorization'] = `Bearer ${sessionToken}`;
    }

    // Use PUBLIC API path (portfolio data doesn't require authentication)
    const response = await fetch(`/api/public/wallets/${chain}/portfolio/${address}`, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      console.error(`Portfolio fetch failed for ${chain}/${address}: ${response.status} ${response.statusText}`);
      return {
        success: false,
        address,
        chain,
        balance: '0',
        usdValue: '0',
        error: `HTTP ${response.status}: ${response.statusText}`
      };
    }

    const data = await response.json() as any;
    console.log(`✅ Portfolio fetched for ${chain}/${address}:`, data);
    
    return {
      success: true,
      address: data.address || address,
      chain: data.chain || chain,
      balance: data.balance || '0',
      usdValue: data.usdValue || '0',
      tokens: data.tokens || [],
      nfts: data.nfts || []
    };

  } catch (error) {
    console.error(`❌ Portfolio fetch error for ${chain}/${address}:`, error);
    return {
      success: false,
      address,
      chain,
      balance: '0',
      usdValue: '0',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Chain-specific balance fetchers using the centralized fetch function
 */
export const balanceFetchers = {
  xrp: (address: string, sessionToken?: string) => 
    fetchChainBalance('xrp', address, sessionToken),
    
  eth: (address: string, sessionToken?: string) => 
    fetchChainBalance('eth', address, sessionToken),
    
  btc: (address: string, sessionToken?: string) => 
    fetchChainBalance('btc', address, sessionToken),
    
  sol: (address: string, sessionToken?: string) => 
    fetchChainBalance('sol', address, sessionToken),
    
  arbitrum: (address: string, sessionToken?: string) => 
    fetchChainBalance('arbitrum', address, sessionToken),
    
  base: (address: string, sessionToken?: string) => 
    fetchChainBalance('base', address, sessionToken),
    
  polygon: (address: string, sessionToken?: string) => 
    fetchChainBalance('polygon', address, sessionToken),
    
  optimism: (address: string, sessionToken?: string) => 
    fetchChainBalance('optimism', address, sessionToken)
};

/**
 * Portfolio fetchers for supported chains
 */
export const portfolioFetchers = {
  xrp: (address: string, sessionToken?: string) => 
    fetchChainPortfolio('xrp', address, sessionToken),
    
  eth: (address: string, sessionToken?: string) => 
    fetchChainPortfolio('eth', address, sessionToken),
    
  btc: (address: string, sessionToken?: string) => 
    fetchChainPortfolio('btc', address, sessionToken),
    
  sol: (address: string, sessionToken?: string) => 
    fetchChainPortfolio('sol', address, sessionToken)
};

/**
 * Get the correct query key for balance queries
 * Uses array format for proper cache invalidation
 */
export function getBalanceQueryKey(chain: string, address: string): [string, string, string] {
  return ['api', 'wallets', `${chain}/balance/${address}`];
}

/**
 * Get the correct query key for portfolio queries
 * Uses array format for proper cache invalidation
 */
export function getPortfolioQueryKey(chain: string, address: string): [string, string, string] {
  return ['api', 'wallets', `${chain}/portfolio/${address}`];
}
