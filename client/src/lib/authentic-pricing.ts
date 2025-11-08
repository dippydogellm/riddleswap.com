// Authentic Pricing API - AUTHENTIC DATA ONLY
// Uses exclusively xrpl.to API and CoinGecko for authentic pricing

interface AuthenticTokenPrice {
  symbol: string;
  issuer: string;
  price_usd: number;
  volume_24h: number;
  change_24h: number;
  last_updated: string;
}

// Get authentic XRP price from CoinGecko
export async function getAuthenticXRPPrice(): Promise<number | null> {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd');
    if (!response.ok) return null;
    
    const data = await response.json() as any;
    if (data.ripple?.usd) {
      return data.ripple.usd;
    }
    
    return null;
  } catch (error) {
    // Removed console statement for production
    return null;
  }
}

// Get authentic token price from xrpl.to API
export async function getAuthenticTokenPrice(tokenSymbol: string, issuer?: string): Promise<number | null> {
  try {
    // For tokens with $ prefix, search without the $ symbol
    let searchTerm = tokenSymbol;
    if (tokenSymbol.startsWith('$')) {
      searchTerm = tokenSymbol.substring(1);
    }
    
    const response = await fetch(`https://api.xrpl.to/api/tokens?filter=${encodeURIComponent(searchTerm)}&limit=50&sortBy=vol24hxrp&sortType=desc`);
    if (!response.ok) return null;
    
    const data = await response.json() as any;
    
    if (data.tokens && data.tokens.length > 0) {
      for (const token of data.tokens) {
        let currencySymbol = token.currency;
        
        // Convert hex currency to ASCII if needed
        if (currencySymbol && currencySymbol.length > 3) {
          try {
            const hexMatch = currencySymbol.match(/^[0-9A-F]+$/i);
            if (hexMatch) {
              // Convert hex to UTF-8 using browser-compatible method
              const bytes = new Uint8Array(currencySymbol.match(/.{1,2}/g)?.map((byte: string) => parseInt(byte, 16)) || []);
              currencySymbol = new TextDecoder('utf-8').decode(bytes).replace(/\0/g, '');
            }
          } catch (e) {
            // Keep original if conversion fails
          }
        }
        
        // Match by symbol and optionally by issuer
        const symbolMatch = (currencySymbol === tokenSymbol || token.currency === tokenSymbol || 
                           currencySymbol === searchTerm || token.currency === searchTerm);
        
        if (symbolMatch) {
          if (!issuer || token.issuer === issuer) {
            // ONLY use direct priceUsd from xrpl.to API - NO calculations
            if (token.priceUsd && token.priceUsd > 0) {
              return parseFloat(token.priceUsd);
            }
          }
        }
      }
    }
    
    return null;
  } catch (error) {
    // Removed console statement for production
    return null;
  }
}

// Get authentic token prices for multiple tokens
export async function getAuthenticTokenPrices(tokenSymbols: string[]): Promise<Record<string, number>> {
  const prices: Record<string, number> = {};
  
  // Get XRP price first
  const xrpPrice = await getAuthenticXRPPrice();
  if (xrpPrice) {
    prices['XRP'] = xrpPrice;
  }
  
  // Get prices for other tokens
  for (const tokenSymbol of tokenSymbols) {
    if (tokenSymbol !== 'XRP') {
      const price = await getAuthenticTokenPrice(tokenSymbol);
      if (price) {
        prices[tokenSymbol] = price;
      }
    }
  }
  
  return prices;
}
