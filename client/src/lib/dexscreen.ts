// DexScreen API integration for token data
export interface DexScreenToken {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceNative: string;
  priceUsd: string;
  txns: {
    m5: { buys: number; sells: number };
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  volume: {
    h24: number;
    h6: number;
    h1: number;
    m5: number;
  };
  priceChange: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  liquidity?: {
    usd?: number;
    base: number;
    quote: number;
  };
  fdv?: number;
  marketCap?: number;
}

export interface DexScreenResponse {
  schemaVersion: string;
  pairs: DexScreenToken[];
}

export async function fetchTokenData(chainId: string, pairAddress: string): Promise<DexScreenToken[]> {
  try {
    const response = await fetch(`/api/dexscreen/${chainId}/${pairAddress}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch token data: ${response.status}`);
    }
    
    const data: DexScreenResponse = await response.json() as any;
    return data.pairs || [];
  } catch (error) {
    // console.error("Error fetching token data from DexScreen:", error);
    throw error;
  }
}

export async function searchTokens(query: string): Promise<DexScreenToken[]> {
  try {
    const response = await fetch(`/api/dexscreen/search/${encodeURIComponent(query)}`);
    
    if (!response.ok) {
      throw new Error(`Failed to search tokens: ${response.status}`);
    }
    
    const data: DexScreenResponse = await response.json() as any;
    return data.pairs || [];
  } catch (error) {
    // console.error("Error searching tokens on DexScreen:", error);
    throw error;
  }
}

export function calculateExchangeRate(
  fromToken: DexScreenToken | null,
  toToken: DexScreenToken | null
): number {
  if (!fromToken || !toToken) return 0;
  
  try {
    const fromPriceUsd = parseFloat(fromToken.priceUsd);
    const toPriceUsd = parseFloat(toToken.priceUsd);
    
    if (fromPriceUsd === 0 || toPriceUsd === 0) return 0;
    
    return fromPriceUsd / toPriceUsd;
  } catch (error) {
    // console.error("Error calculating exchange rate:", error);
    return 0;
  }
}

export function formatTokenAmount(amount: string | number, decimals: number = 6): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "0";
  
  return num.toFixed(decimals).replace(/\.?0+$/, "");
}

export function formatUsdValue(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "$0.00";
  
  if (num < 0.01) {
    return `$${num.toFixed(6)}`;
  } else if (num < 1) {
    return `$${num.toFixed(4)}`;
  } else {
    return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}
