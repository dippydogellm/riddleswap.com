// Unified 1inch Swap Service - Production Ready
// Supports ALL EVM chains with cached session keys
import fetch from 'node-fetch';

// 1inch API v6.0 - Production endpoints
const ONEINCH_API_BASE = 'https://api.1inch.dev';
const ONEINCH_API_VERSION = 'v6.0';

// Supported chain IDs (1inch Classic Swap - EVM ONLY)
// Note: 1inch v6 API does NOT support Solana - use Jupiter for Solana swaps
// Only chains with RPC endpoints configured are listed
export const SUPPORTED_CHAINS = {
  ethereum: 1,
  bsc: 56,
  polygon: 137,
  arbitrum: 42161,
  optimism: 10,
  base: 8453,
  avalanche: 43114,
  gnosis: 100,
  fantom: 250,
  zksync: 324
  // Aurora (1313161554) and Klaytn (8217) are supported by 1inch but RPC not configured
} as const;

export type SupportedChain = number;

// 1inch Quote Response
export interface OneInchQuote {
  srcToken: {
    address: string;
    decimals: number;
    symbol: string;
    name: string;
  };
  dstToken: {
    address: string;
    decimals: number;
    symbol: string;
    name: string;
  };
  srcAmount: string;
  dstAmount: string;
  protocols: any[][];
  gas: string;
}

// 1inch Swap Response
export interface OneInchSwap {
  tx: {
    from: string;
    to: string;
    data: string;
    value: string;
    gas: string;
    gasPrice: string;
  };
  srcToken: any;
  dstToken: any;
  srcAmount: string;
  dstAmount: string;
  protocols: any[][];
}

// 1inch Token Info
export interface OneInchToken {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  logoURI?: string;
  eip2612?: boolean;
  tags?: string[];
}

/**
 * Get 1inch API key from environment
 */
export function getOneInchApiKey(): string {
  const apiKey = process.env.ONEINCH_API_KEY;
  if (!apiKey) {
    throw new Error('ONEINCH_API_KEY not configured in environment');
  }
  return apiKey;
}

/**
 * Get quote from 1inch aggregator
 * @param chainId - Chain ID (1=Ethereum, 56=BSC, etc.)
 * @param fromTokenAddress - Source token address
 * @param toTokenAddress - Destination token address
 * @param amount - Amount in smallest units (wei)
 * @param fromAddress - User wallet address
 * @param slippage - Slippage tolerance (1 = 1%)
 */
export async function getOneInchQuote(
  chainId: SupportedChain,
  fromTokenAddress: string,
  toTokenAddress: string,
  amount: string,
  fromAddress: string,
  slippage: number = 1
): Promise<OneInchQuote> {
  const apiKey = getOneInchApiKey();
  
  const params = new URLSearchParams({
    src: fromTokenAddress,
    dst: toTokenAddress,
    amount: amount,
    from: fromAddress,
    slippage: slippage.toString(),
    includeProtocols: 'true',
    includeGas: 'true'
  });

  const url = `${ONEINCH_API_BASE}/swap/${ONEINCH_API_VERSION}/${chainId}/quote?${params}`;
  
  console.log(`🔍 [1INCH] Getting quote on chain ${chainId}: ${fromTokenAddress} → ${toTokenAddress}`);
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ [1INCH] Quote error (${response.status}):`, errorText);
    throw new Error(`1inch quote failed: ${errorText}`);
  }

  const quote = await response.json() as OneInchQuote;
  console.log(`✅ [1INCH] Quote: ${quote.dstAmount} ${quote.dstToken.symbol} (estimated)`);
  
  return quote;
}

/**
 * Get swap transaction data from 1inch
 * @param chainId - Chain ID
 * @param fromTokenAddress - Source token address
 * @param toTokenAddress - Destination token address
 * @param amount - Amount in smallest units (wei)
 * @param fromAddress - User wallet address
 * @param slippage - Slippage tolerance (1 = 1%)
 * @param referrerAddress - Optional referrer for fee collection
 * @param fee - Optional fee in basis points (25 = 0.25%)
 */
export async function getOneInchSwap(
  chainId: SupportedChain,
  fromTokenAddress: string,
  toTokenAddress: string,
  amount: string,
  fromAddress: string,
  slippage: number = 1,
  referrerAddress?: string,
  fee?: number
): Promise<OneInchSwap> {
  const apiKey = getOneInchApiKey();
  
  const params = new URLSearchParams({
    src: fromTokenAddress,
    dst: toTokenAddress,
    amount: amount,
    from: fromAddress,
    slippage: slippage.toString(),
    disableEstimate: 'true',
    allowPartialFill: 'false'
  });

  // Add fee parameters if provided
  if (referrerAddress && fee) {
    params.append('referrer', referrerAddress);
    params.append('fee', fee.toString());
    console.log(`💰 [1INCH] Platform fee: ${fee} bps → ${referrerAddress}`);
  }

  const url = `${ONEINCH_API_BASE}/swap/${ONEINCH_API_VERSION}/${chainId}/swap?${params}`;
  
  console.log(`🔄 [1INCH] Getting swap transaction on chain ${chainId}`);
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ [1INCH] Swap error (${response.status}):`, errorText);
    throw new Error(`1inch swap failed: ${errorText}`);
  }

  const swapData = await response.json() as OneInchSwap;
  console.log(`✅ [1INCH] Swap data ready: ${swapData.dstAmount} ${swapData.dstToken.symbol}`);
  
  return swapData;
}

/**
 * Get spender address for token approval
 * @param chainId - Chain ID
 */
export async function getOneInchSpender(chainId: SupportedChain): Promise<string> {
  const apiKey = getOneInchApiKey();
  
  const url = `${ONEINCH_API_BASE}/swap/${ONEINCH_API_VERSION}/${chainId}/approve/spender`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get spender: ${errorText}`);
  }

  const data = await response.json() as { address: string };
  return data.address;
}

/**
 * Get approval transaction data
 * @param chainId - Chain ID
 * @param tokenAddress - Token to approve
 * @param amount - Amount to approve (optional, defaults to unlimited)
 */
export async function getOneInchApprovalTx(
  chainId: SupportedChain,
  tokenAddress: string,
  amount?: string
): Promise<{ data: string; gasPrice: string; to: string; value: string }> {
  const apiKey = getOneInchApiKey();
  
  const params = new URLSearchParams({
    tokenAddress: tokenAddress
  });

  if (amount) {
    params.append('amount', amount);
  }

  const url = `${ONEINCH_API_BASE}/swap/${ONEINCH_API_VERSION}/${chainId}/approve/transaction?${params}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get approval tx: ${errorText}`);
  }

  return await response.json() as { data: string; gasPrice: string; to: string; value: string };
}

/**
 * Get available tokens for a chain
 * @param chainId - Chain ID
 */
export async function getOneInchTokens(chainId: SupportedChain): Promise<Record<string, OneInchToken>> {
  const apiKey = getOneInchApiKey();
  
  const url = `${ONEINCH_API_BASE}/swap/${ONEINCH_API_VERSION}/${chainId}/tokens`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get tokens: ${errorText}`);
  }

  const data = await response.json() as { tokens: Record<string, OneInchToken> };
  return data.tokens;
}

/**
 * Get liquidity sources for a chain
 * @param chainId - Chain ID
 */
export async function getOneInchLiquiditySources(chainId: SupportedChain): Promise<any> {
  const apiKey = getOneInchApiKey();
  
  const url = `${ONEINCH_API_BASE}/swap/${ONEINCH_API_VERSION}/${chainId}/liquidity-sources`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get liquidity sources: ${errorText}`);
  }

  return await response.json() as any;
}

/**
 * Check if token needs approval
 * @param chainId - Chain ID
 * @param tokenAddress - Token address
 * @param walletAddress - Wallet address
 */
export async function getOneInchAllowance(
  chainId: SupportedChain,
  tokenAddress: string,
  walletAddress: string
): Promise<string> {
  const apiKey = getOneInchApiKey();
  
  const params = new URLSearchParams({
    tokenAddress: tokenAddress,
    walletAddress: walletAddress
  });

  const url = `${ONEINCH_API_BASE}/swap/${ONEINCH_API_VERSION}/${chainId}/approve/allowance?${params}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get allowance: ${errorText}`);
  }

  const data = await response.json() as { allowance: string };
  return data.allowance;
}
