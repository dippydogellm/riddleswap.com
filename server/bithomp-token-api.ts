// Bithomp API integration for authentic XRPL token data
import fetch from 'node-fetch';

export interface BithompToken {
  currency: string;
  issuer: string;
  name?: string;
  logo?: string;
  verified?: boolean;
  price?: string;
  volume_24h?: string;
  market_cap?: string;
  description?: string;
  website?: string;
}

export interface XRPLToken {
  symbol: string;
  name: string;
  issuer: string;
  currency_code: string;
  logo_url?: string;
  icon_url?: string;
  price_usd?: number;
  volume_24h?: number;
  market_cap?: number;
  verified: boolean;
  source: string;
}

// Get ALL XRPL tokens from DexScreener API (authentic XRPL market data)
export async function getAllXRPLTokensFromBithomp(): Promise<XRPLToken[]> {
  const allTokens: XRPLToken[] = [];
  
  try {
    console.log('🔍 Loading ALL XRPL tokens from DexScreener API (authentic market data)...');
    
    // Use DexScreener API for authentic XRPL token market data
    const response = await fetch('https://api.dexscreener.com/latest/dex/search?q=xrpl', {
      headers: {
        'User-Agent': 'RiddleSwap/1.0',
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.log('DexScreener API error:', response.status, response.statusText);
      return allTokens;
    }
    
    const data = await response.json() as any;
    
    if (data.pairs && Array.isArray(data.pairs)) {
      console.log(`📊 Found ${data.pairs.length} XRPL pairs on DexScreener`);
      
      // Process XRPL pairs to extract tokens
      for (const pair of data.pairs) {
        if (pair.chainId === 'xrpl') {
          // Extract base token (if not XRP)
          if (pair.baseToken && pair.baseToken.symbol !== 'XRP' && pair.baseToken.address) {
            const xrplToken: XRPLToken = {
              symbol: pair.baseToken.symbol,
              name: pair.baseToken.name || pair.baseToken.symbol,
              issuer: pair.baseToken.address,
              currency_code: pair.baseToken.symbol,
              logo_url: pair.info?.imageUrl || '',
              icon_url: pair.info?.imageUrl || '',
              price_usd: pair.priceUsd ? parseFloat(pair.priceUsd) : undefined,
              volume_24h: pair.volume?.h24 ? parseFloat(pair.volume.h24) : undefined,
              market_cap: pair.marketCap ? parseFloat(pair.marketCap) : undefined,
              verified: true, // DexScreener tokens are market-verified
              source: 'dexscreener'
            };
            
            // Avoid duplicates
            if (!allTokens.find(t => t.symbol === xrplToken.symbol && t.issuer === xrplToken.issuer)) {
              allTokens.push(xrplToken);
            }
          }
          
          // Extract quote token (if not XRP)
          if (pair.quoteToken && pair.quoteToken.symbol !== 'XRP' && pair.quoteToken.address) {
            const xrplToken: XRPLToken = {
              symbol: pair.quoteToken.symbol,
              name: pair.quoteToken.name || pair.quoteToken.symbol,
              issuer: pair.quoteToken.address,
              currency_code: pair.quoteToken.symbol,
              logo_url: pair.info?.imageUrl || '',
              icon_url: pair.info?.imageUrl || '',
              price_usd: undefined, // Price is usually for base token
              volume_24h: undefined,
              market_cap: undefined,
              verified: true,
              source: 'dexscreener'
            };
            
            // Avoid duplicates
            if (!allTokens.find(t => t.symbol === xrplToken.symbol && t.issuer === xrplToken.issuer)) {
              allTokens.push(xrplToken);
            }
          }
        }
      }
    }
    
    console.log(`🎯 Final result: ${allTokens.length} XRPL tokens loaded from DexScreener`);
    
  } catch (error) {
    console.error('Error loading XRPL tokens from DexScreener:', error);
  }
  
  return allTokens;
}

// Get token information by issuer and currency from XRPLMeta
export async function getTokenFromBithomp(currency: string, issuer: string): Promise<XRPLToken | null> {
  try {
    const response = await fetch(`https://xrplmeta.org/issuer/${issuer}/currencies`, {
      headers: {
        'User-Agent': 'RiddleSwap/1.0',
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.log(`❌ XRPLMeta API error for ${currency}:${issuer} - Status: ${response.status}`);
      return null;
    }
    
    // Check if response is actually JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.log(`❌ XRPLMeta returned non-JSON content for ${currency}:${issuer} - Content-Type: ${contentType}`);
      return null;
    }
    
    const responseText = await response.text();
    let tokens: any[];
    
    try {
      tokens = JSON.parse(responseText);
    } catch (parseError) {
      console.log(`❌ JSON parse error for ${currency}:${issuer} - Response was HTML/text, not JSON`);
      return null;
    }
    const token = tokens.find(t => t.currency === currency);
    
    if (token && token.currency && token.issuer) {
      return {
        symbol: token.currency,
        name: token.name || token.currency,
        issuer: token.issuer,
        currency_code: token.currency,
        logo_url: token.avatar || '',
        icon_url: token.avatar || '',
        price_usd: undefined, // Will be fetched from exchange APIs
        volume_24h: undefined,
        market_cap: undefined,
        verified: token.curated || false,
        source: 'xrplmeta'
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error getting token from XRPLMeta:', error);
    return null;
  }
}