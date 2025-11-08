import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface TokenConfig {
  symbol: string;
  name: string;
  decimals: number;
  coingeckoId?: string;
  dexScreener?: string;
  
  // XRPL specific
  issuer?: string;
  currency?: string;
  isNative?: boolean;
  
  // EVM specific
  contracts?: Record<string, string>;
  chains?: string[];
  
  // Solana specific
  mint?: string;
  
  // Additional metadata
  note?: string;
}

export interface ChainTokens {
  [symbol: string]: TokenConfig;
}

class TokenLoader {
  private static instance: TokenLoader;
  private tokenCache = new Map<string, ChainTokens>();
  private readonly tokensDir = __dirname;

  static getInstance(): TokenLoader {
    if (!TokenLoader.instance) {
      TokenLoader.instance = new TokenLoader();
    }
    return TokenLoader.instance;
  }

  // Load tokens for a specific chain
  loadChainTokens(chain: string): ChainTokens {
    const cacheKey = chain.toLowerCase();
    
    if (this.tokenCache.has(cacheKey)) {
      return this.tokenCache.get(cacheKey)!;
    }

    const filePath = path.join(this.tokensDir, `${chain.toLowerCase()}-tokens.json`);
    
    try {
      if (!fs.existsSync(filePath)) {
        console.warn(`⚠️ Token file not found for chain: ${chain}`);
        return {};
      }

      const tokenData = fs.readFileSync(filePath, 'utf8');
      const tokens: ChainTokens = JSON.parse(tokenData);
      
      this.tokenCache.set(cacheKey, tokens);
      console.log(`✅ Loaded ${Object.keys(tokens).length} tokens for ${chain.toUpperCase()}`);
      
      return tokens;
    } catch (error) {
      console.error(`❌ Error loading tokens for ${chain}:`, error);
      return {};
    }
  }

  // Get token config for a specific token and chain
  getTokenConfig(symbol: string, chain: string): TokenConfig | null {
    const chainTokens = this.loadChainTokens(chain);
    return chainTokens[symbol.toUpperCase()] || null;
  }

  // Get all supported tokens for a chain
  getSupportedTokens(chain: string): string[] {
    const chainTokens = this.loadChainTokens(chain);
    return Object.keys(chainTokens);
  }

  // Get all chains that support a specific token
  getChainsForToken(symbol: string): string[] {
    const chains = ['xrpl', 'evm', 'solana', 'bitcoin'];
    const supportedChains: string[] = [];

    for (const chain of chains) {
      const config = this.getTokenConfig(symbol, chain);
      if (config) {
        supportedChains.push(chain);
      }
    }

    return supportedChains;
  }

  // Clear cache (useful for hot-reloading during development)
  clearCache(): void {
    this.tokenCache.clear();
    console.log('🗑️ Token cache cleared');
  }

  // Get token mapping in the old format for backward compatibility
  getTokenMapping(symbol: string, chain: string): any {
    const config = this.getTokenConfig(symbol, chain);
    if (!config) return null;

    return {
      coingeckoId: config.coingeckoId,
      dexScreener: config.dexScreener,
      decimals: config.decimals,
      issuer: config.issuer,
      currency: config.currency,
      mint: config.mint,
      contracts: config.contracts
    };
  }
}

export default TokenLoader;
export const tokenLoader = TokenLoader.getInstance();