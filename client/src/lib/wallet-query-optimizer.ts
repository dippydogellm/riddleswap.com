/**
 * Wallet Query Optimizer
 * Provides optimized query patterns with proper enabled guards for all wallet endpoints
 */

import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { fetchChainBalance, fetchChainPortfolio, getBalanceQueryKey, getPortfolioQueryKey } from '@/lib/balance-fetcher';

// Supported chain types for wallet queries
export type WalletChain = 'xrp' | 'eth' | 'sol' | 'btc' | 'arbitrum' | 'base' | 'polygon' | 'optimism' | 'bsc' | 'avalanche' | 'fantom' | 'linea' | 'mantle' | 'metis' | 'scroll' | 'taiko' | 'unichain' | 'soneium' | 'zksync';

// Query configuration interface
interface WalletQueryConfig {
  chain: WalletChain;
  address?: string;
  enabled?: boolean;
  refetchInterval?: number | false;
  staleTime?: number;
  sessionToken?: string;
}

// Enhanced query options with proper guards
interface OptimizedQueryOptions extends Omit<UseQueryOptions, 'queryKey' | 'queryFn' | 'enabled'> {
  enabled?: boolean;
}

/**
 * Optimized Balance Query Hook
 * Includes proper authentication and address validation guards
 */
export function useOptimizedBalanceQuery(
  chain: WalletChain, 
  address?: string, 
  options?: OptimizedQueryOptions
) {
  const { sessionToken } = useAuth();
  
  return useQuery({
    queryKey: getBalanceQueryKey(chain, address || ''),
    queryFn: async () => {
      if (!address) throw new Error(`${chain.toUpperCase()} address required`);
      
      console.log(`🔍 [BALANCE] Fetching ${chain.toUpperCase()} balance for: ${address}`);
      // Balance is public data - session token is optional
      return fetchChainBalance(chain, address, sessionToken);
    },
    enabled: !!(address && (options?.enabled !== false)),
    refetchInterval: 30000, // Default 30 seconds
    staleTime: 15000, // Cache for 15 seconds
    retry: 2,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...options,
  });
}

/**
 * Optimized Portfolio Query Hook
 * Depends on authentication and provides comprehensive portfolio data
 */
export function useOptimizedPortfolioQuery(
  chain: WalletChain, 
  address?: string, 
  options?: OptimizedQueryOptions
) {
  const { isAuthenticated, sessionToken } = useAuth();
  
  return useQuery({
    queryKey: getPortfolioQueryKey(chain, address || ''),
    queryFn: async () => {
      if (!address) throw new Error(`${chain.toUpperCase()} address required`);
      if (!sessionToken) throw new Error('Authentication required');
      
      console.log(`📊 [PORTFOLIO] Fetching ${chain.toUpperCase()} portfolio for: ${address}`);
      return fetchChainPortfolio(chain, address, sessionToken);
    },
    enabled: !!(isAuthenticated && address && sessionToken && (options?.enabled !== false)),
    refetchInterval: 60000, // Default 60 seconds (less frequent than balance)
    staleTime: 30000, // Cache for 30 seconds
    retry: 2,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...options,
  });
}

/**
 * Optimized Tokens Query Hook
 * Fetches token list with proper authentication guards
 */
export function useOptimizedTokensQuery(
  chain: WalletChain, 
  address?: string, 
  options?: OptimizedQueryOptions
) {
  const { isAuthenticated, sessionToken } = useAuth();
  
  return useQuery({
    queryKey: ['api', 'wallets', `${chain}/tokens/${address}`],
    queryFn: async () => {
      if (!address) throw new Error(`${chain.toUpperCase()} address required`);
      if (!sessionToken) throw new Error('Authentication required');
      
      console.log(`🪙 [TOKENS] Fetching ${chain.toUpperCase()} tokens for: ${address}`);
      
      const response = await fetch(`/api/wallets/${chain}/tokens/${address}`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch ${chain.toUpperCase()} tokens: ${response.status} ${response.statusText}`);
      }
      
      return response.json();
    },
    enabled: !!(isAuthenticated && address && sessionToken && (options?.enabled !== false)),
    refetchInterval: 45000, // Default 45 seconds
    staleTime: 20000, // Cache for 20 seconds
    retry: 2,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...options,
  });
}

/**
 * Optimized NFTs Query Hook
 * Fetches NFT collection with proper authentication guards
 */
export function useOptimizedNFTsQuery(
  chain: WalletChain, 
  address?: string, 
  options?: OptimizedQueryOptions
) {
  const { isAuthenticated, sessionToken } = useAuth();
  
  return useQuery({
    queryKey: ['api', 'wallets', `${chain}/nfts/${address}`],
    queryFn: async () => {
      if (!address) throw new Error(`${chain.toUpperCase()} address required`);
      if (!sessionToken) throw new Error('Authentication required');
      
      console.log(`🖼️ [NFTS] Fetching ${chain.toUpperCase()} NFTs for: ${address}`);
      
      const response = await fetch(`/api/wallets/${chain}/nfts/${address}`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch ${chain.toUpperCase()} NFTs: ${response.status} ${response.statusText}`);
      }
      
      return response.json();
    },
    enabled: !!(isAuthenticated && address && sessionToken && (options?.enabled !== false)),
    refetchInterval: 60000, // Default 60 seconds (NFTs change less frequently)
    staleTime: 30000, // Cache for 30 seconds
    retry: 2,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...options,
  });
}

/**
 * Optimized Transactions Query Hook
 * Fetches transaction history with proper authentication guards
 */
export function useOptimizedTransactionsQuery(
  chain: WalletChain, 
  address?: string, 
  options?: OptimizedQueryOptions
) {
  const { isAuthenticated, sessionToken } = useAuth();
  
  return useQuery({
    queryKey: ['api', 'wallets', `${chain}/transactions/${address}`],
    queryFn: async () => {
      if (!address) throw new Error(`${chain.toUpperCase()} address required`);
      if (!sessionToken) throw new Error('Authentication required');
      
      console.log(`📜 [TRANSACTIONS] Fetching ${chain.toUpperCase()} transactions for: ${address}`);
      
      const response = await fetch(`/api/wallets/${chain}/transactions/${address}`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch ${chain.toUpperCase()} transactions: ${response.status} ${response.statusText}`);
      }
      
      return response.json();
    },
    enabled: !!(isAuthenticated && address && sessionToken && (options?.enabled !== false)),
    refetchInterval: 30000, // Default 30 seconds
    staleTime: 15000, // Cache for 15 seconds
    retry: 2,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...options,
  });
}

/**
 * Comprehensive Wallet Data Hook
 * Fetches all wallet data with optimized dependency chains
 */
export function useOptimizedWalletData(
  chain: WalletChain, 
  address?: string, 
  options?: {
    includeTokens?: boolean;
    includeNFTs?: boolean;
    includeTransactions?: boolean;
    includePortfolio?: boolean;
  }
) {
  const { includeTokens = true, includeNFTs = true, includeTransactions = true, includePortfolio = true } = options || {};
  
  // Primary balance query - everything depends on this
  const balanceQuery = useOptimizedBalanceQuery(chain, address);
  
  // Secondary queries depend on successful balance fetch
  const tokensQuery = useOptimizedTokensQuery(chain, address, { 
    enabled: includeTokens && balanceQuery.isSuccess 
  });
  
  const nftsQuery = useOptimizedNFTsQuery(chain, address, { 
    enabled: includeNFTs && balanceQuery.isSuccess 
  });
  
  const transactionsQuery = useOptimizedTransactionsQuery(chain, address, { 
    enabled: includeTransactions && balanceQuery.isSuccess 
  });
  
  const portfolioQuery = useOptimizedPortfolioQuery(chain, address, { 
    enabled: includePortfolio && balanceQuery.isSuccess 
  });

  // Aggregate loading state
  const isLoading = balanceQuery.isLoading || 
    (includeTokens && tokensQuery.isLoading) ||
    (includeNFTs && nftsQuery.isLoading) ||
    (includeTransactions && transactionsQuery.isLoading) ||
    (includePortfolio && portfolioQuery.isLoading);

  // Aggregate error state
  const error = balanceQuery.error || tokensQuery.error || nftsQuery.error || transactionsQuery.error || portfolioQuery.error;

  // Refetch all queries
  const refetchAll = async () => {
    const promises = [balanceQuery.refetch()];
    if (includeTokens) promises.push(tokensQuery.refetch());
    if (includeNFTs) promises.push(nftsQuery.refetch());
    if (includeTransactions) promises.push(transactionsQuery.refetch());
    if (includePortfolio) promises.push(portfolioQuery.refetch());
    
    await Promise.all(promises);
  };

  return {
    // Individual query results
    balance: balanceQuery,
    tokens: tokensQuery,
    nfts: nftsQuery,
    transactions: transactionsQuery,
    portfolio: portfolioQuery,
    
    // Aggregate states
    isLoading,
    error,
    refetchAll,
    
    // Data extraction helpers
    walletData: {
      address,
      chain,
      balance: balanceQuery.data,
      tokens: tokensQuery.data,
      nfts: nftsQuery.data,
      transactions: transactionsQuery.data,
      portfolio: portfolioQuery.data,
    }
  };
}

/**
 * Error Recovery Hook
 * Provides intelligent retry strategies for failed queries
 */
export function useWalletErrorRecovery(chain: WalletChain, address?: string) {
  const { sessionToken } = useAuth();
  
  const testEndpoint = async (endpoint: string) => {
    try {
      const response = await fetch(`/api/wallets/${chain}/${endpoint}/${address}`, {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });
      return { endpoint, success: response.ok, status: response.status };
    } catch (error) {
      return { endpoint, success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  };

  const testAllEndpoints = async () => {
    if (!address || !sessionToken) return [];
    
    const endpoints = ['balance', 'tokens', 'nfts', 'transactions'];
    return Promise.all(endpoints.map(endpoint => testEndpoint(endpoint)));
  };

  return { testAllEndpoints };
}

export default {
  useOptimizedBalanceQuery,
  useOptimizedPortfolioQuery,
  useOptimizedTokensQuery,
  useOptimizedNFTsQuery,
  useOptimizedTransactionsQuery,
  useOptimizedWalletData,
  useWalletErrorRecovery
};
