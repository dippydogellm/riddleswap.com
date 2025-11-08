// Client-side token API interface
export interface TokenSearchResult {
  symbol: string;
  name: string;
  issuer: string;
  currency_code: string;
  logo_url?: string;
  logoURI?: string; // Support both logo formats
  icon_url?: string; // XRPL API uses this field
  price_usd?: number;
  volume_24h?: number;
  market_cap?: number;
  verified: boolean;
  source: string;
}

export async function searchTokens(query: string): Promise<TokenSearchResult[]> {
  if (!query || query.trim().length < 2) {
    return [];
  }
  
  const response = await fetch(`/api/tokens/search?q=${encodeURIComponent(query.trim())}`);
  if (!response.ok) {
    throw new Error('Failed to search tokens');
  }
  
  return response.json();
}

export async function getTokenByIssuer(issuer: string, currency?: string): Promise<TokenSearchResult | null> {
  const url = `/api/tokens/issuer/${issuer}${currency ? `?currency=${currency}` : ''}`;
  const response = await fetch(url);
  
  if (response.status === 404) {
    return null;
  }
  
  if (!response.ok) {
    throw new Error('Failed to fetch token');
  }
  
  return response.json();
}

export async function getPopularTokens(): Promise<TokenSearchResult[]> {
  try {
    console.log('📊 Loading popular XRPL tokens...');
    
    // Get tokens from network only - no hardcoded fallbacks
    const response = await fetch('/api/xrpl/popular-tokens');
    if (response.ok) {
      const data = await response.json() as any;
      console.log('Popular tokens data:', data);
      const tokens = data.tokens || [];
      console.log(`✅ Loaded ${tokens.length} popular tokens:`, tokens);
      return tokens;
    }
    
    // Return empty array if network fails - no hardcoded tokens
    console.log('❌ Network tokens unavailable, returning empty array');
    return [];
  } catch (error) {
    console.error('Error fetching popular tokens:', error);
    return [];
  }
}

export async function cacheToken(issuer: string, currency?: string): Promise<TokenSearchResult | null> {
  const response = await fetch('/api/tokens/cache', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ issuer, currency }),
  });
  
  if (response.status === 404) {
    return null;
  }
  
  if (!response.ok) {
    throw new Error('Failed to cache token');
  }
  
  return response.json();
}
