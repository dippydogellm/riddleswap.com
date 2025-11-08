// Token response parsers for different APIs

export interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  // Support numeric EVM chain IDs plus special string identifiers (e.g. 'xrpl')
  chainId: number | string;
  price?: number;
  marketCap?: number;
  volume24h?: number;
}

// Parse EVM tokens from 0x Protocol and other sources
export function parseEVMTokenResponse(data: any, chainId: number): Token[] {
  try {
    let tokens: Token[] = [];
    
    // Handle 0x Protocol format (primary)
    if (data.records && Array.isArray(data.records)) {
      tokens = data.records.map((token: any) => ({
        address: token.address,
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals || 18,
        logoURI: token.logoURI || generateTokenLogo(token.address, chainId),
          // Coerce chainId to number to satisfy Token interface typing
          chainId: typeof token.chainId === 'string' ? Number(token.chainId) : token.chainId,
        price: token.price,
        marketCap: token.marketCap,
        volume24h: token.volume24h
      }));
    }
    // Handle direct array format (Uniswap, Trust Wallet, etc.)
    else if (Array.isArray(data)) {
      tokens = data.map((token: any) => ({
        address: token.address || token.contract_address,
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals || 18,
        logoURI: token.logoURI || token.logo || token.image || generateTokenLogo(token.address, chainId),
        chainId: chainId,
        price: token.price || token.current_price,
        marketCap: token.market_cap,
        volume24h: token.total_volume
      }));
    }
    // Handle Uniswap token list format (tokens array)
    else if (data.tokens && Array.isArray(data.tokens)) {
      tokens = data.tokens.filter((token: any) => token.chainId === chainId).map((token: any) => ({
        address: token.address,
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals || 18,
        logoURI: token.logoURI || generateTokenLogo(token.address, chainId),
        chainId: chainId
      }));
    }
    // Handle 0x Protocol records format
    else if (data.records && Array.isArray(data.records)) {
      tokens = data.records.map((token: any) => ({
        address: token.address,
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals || 18,
        logoURI: token.logoURI || generateTokenLogo(token.address, chainId),
        chainId: chainId
      }));
    }
    // Handle CoinGecko format
    else if (data.tokens && Array.isArray(data.tokens)) {
      tokens = data.tokens.map((token: any) => ({
        address: token.platforms?.[getCoingeckoChainId(chainId)] || token.address,
        symbol: token.symbol.toUpperCase(),
        name: token.name,
        decimals: token.decimals || 18,
        logoURI: token.image || generateTokenLogo(token.address, chainId),
        chainId: chainId,
        price: token.current_price,
        marketCap: token.market_cap
      }));
    }
    // Handle 1inch format
    else if (typeof data === 'object' && !Array.isArray(data)) {
      tokens = Object.values(data as any).map((token: any) => ({
        address: token.address,
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals || 18,
        logoURI: token.logoURI || `https://tokens.1inch.io/${token.address}.png`,
        chainId: chainId,
        price: token.price,
        marketCap: token.marketCap
      }));
    }
    
    return tokens.filter(token => 
      token.address && 
      token.symbol && 
      token.name && 
      token.symbol.length <= 15 && 
      token.address.startsWith('0x')
    );
  } catch (error) {
    return [];
  }
}

// All supported chains with metadata
export const SUPPORTED_CHAINS = {
  // Ethereum & L2s
  1: { name: 'Ethereum', logo: '🔷', trustWallet: 'ethereum', coingecko: 'ethereum' },
  42161: { name: 'Arbitrum', logo: '🔵', trustWallet: 'arbitrum', coingecko: 'arbitrum-one' },
  10: { name: 'Optimism', logo: '🔴', trustWallet: 'optimism', coingecko: 'optimistic-ethereum' },
  8453: { name: 'Base', logo: '⚾', trustWallet: 'base', coingecko: 'base' },
  137: { name: 'Polygon', logo: '🟣', trustWallet: 'polygon', coingecko: 'polygon-pos' },
  324: { name: 'zkSync Era', logo: '⚡', trustWallet: 'zksync', coingecko: 'zksync' },
  59144: { name: 'Linea', logo: '📏', trustWallet: 'linea', coingecko: 'linea' },
  534352: { name: 'Scroll', logo: '📜', trustWallet: 'scroll', coingecko: 'scroll' },
  1101: { name: 'Polygon zkEVM', logo: '🟪', trustWallet: 'polygonzkevm', coingecko: 'polygon-zkevm' },
  81457: { name: 'Blast', logo: '💥', trustWallet: 'blast', coingecko: 'blast' },
  5000: { name: 'Mantle', logo: '🧥', trustWallet: 'mantle', coingecko: 'mantle' },
  
  // Other Major Chains  
  56: { name: 'BNB Smart Chain', logo: '🟡', trustWallet: 'smartchain', coingecko: 'binance-smart-chain' },
  43114: { name: 'Avalanche', logo: '🔺', trustWallet: 'avalanchec', coingecko: 'avalanche' },
  250: { name: 'Fantom', logo: '👻', trustWallet: 'fantom', coingecko: 'fantom' },
  25: { name: 'Cronos', logo: '⚫', trustWallet: 'cronos', coingecko: 'cronos' },
  100: { name: 'Gnosis Chain', logo: '🟢', trustWallet: 'xdai', coingecko: 'xdai' },
  1284: { name: 'Moonbeam', logo: '🌙', trustWallet: 'moonbeam', coingecko: 'moonbeam' },
  1285: { name: 'Moonriver', logo: '🌊', trustWallet: 'moonriver', coingecko: 'moonriver' },
  42220: { name: 'Celo', logo: '💚', trustWallet: 'celo', coingecko: 'celo' },
  199: { name: 'BitTorrent Chain', logo: '🏴‍☠️', trustWallet: 'bittorrent', coingecko: 'tron' },
  122: { name: 'Fuse', logo: '🔥', trustWallet: 'fuse', coingecko: 'fuse' },
  1666600000: { name: 'Harmony', logo: '🎵', trustWallet: 'harmony', coingecko: 'harmony-shard-0' },
  128: { name: 'Heco', logo: '🔥', trustWallet: 'heco', coingecko: 'huobi-token' },
  66: { name: 'OKExChain', logo: '🅾️', trustWallet: 'okexchain', coingecko: 'okex-chain' },
  321: { name: 'KCC', logo: '🔗', trustWallet: 'kcc', coingecko: 'kucoin-community-chain' },
  288: { name: 'Boba Network', logo: '🧋', trustWallet: 'boba', coingecko: 'boba' },
  1313161554: { name: 'Aurora', logo: '🌌', trustWallet: 'aurora', coingecko: 'aurora' },
  2000: { name: 'Dogechain', logo: '🐕', trustWallet: 'dogechain', coingecko: 'dogechain' },
  1088: { name: 'Metis', logo: '💎', trustWallet: 'metis', coingecko: 'metis-andromeda' },
  592: { name: 'Astar', logo: '⭐', trustWallet: 'astar', coingecko: 'astar' },
  
  // Special chains
  0: { name: 'Solana', logo: '🟢', trustWallet: 'solana', coingecko: 'solana' },
  'xrpl': { name: 'XRPL', logo: '⚡', trustWallet: 'xrp', coingecko: 'ripple' }
};

// Known token addresses with correct logos (for popular tokens)
const KNOWN_TOKEN_LOGOS: Record<string, string> = {
  // Ethereum mainnet
  '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png', // WETH
  '0xA0b86991c06DAD5C3A23d08a4Bc61F898835cdcd': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c06DAD5C3A23d08a4Bc61F898835cdcd/logo.png', // USDC (correct address)
  '0xA0b86a33E6417c9C2b3c7bA5C0e4Ba4d5F1f0B2A': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c06DAD5C3A23d08a4Bc61F898835cdcd/logo.png', // USDC (incorrect address mapped to correct logo)
  '0xdAC17F958D2ee523a2206206994597C13D831ec7': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png', // USDT
  '0x6B175474E89094C44Da98b954EedeAC495271d0F': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x6B175474E89094C44Da98b954EedeAC495271d0F/logo.png', // DAI
};

// Generate token logo URL with multiple fallback sources
function generateTokenLogo(address: string, chainId: number): string {
  // Check if it's a known token first
  const addressLower = address.toLowerCase();
  for (const [knownAddr, logoUrl] of Object.entries(KNOWN_TOKEN_LOGOS)) {
    if (knownAddr.toLowerCase() === addressLower) {
      return logoUrl;
    }
  }
  
  // Try 1inch logo service first (best quality)
  if (address && address.startsWith('0x')) {
    return `https://tokens.1inch.io/${address}.png`;
  }
  
  // Fallback to Trust Wallet
  const chain = SUPPORTED_CHAINS[chainId as keyof typeof SUPPORTED_CHAINS];
  if (chain?.trustWallet) {
    return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${chain.trustWallet}/assets/${address}/logo.png`;
  }
  
  // Final fallback to CoinGecko
  return `https://assets.coingecko.com/coins/images/1/small/bitcoin.png`;
}

// Parse Solana tokens from Jupiter
export function parseSolanaTokenResponse(data: any): Token[] {
  try {
    let tokens: Token[] = [];
    
    // Handle Jupiter format
    if (Array.isArray(data)) {
      tokens = data.map((token: any) => ({
        address: token.address || token.mint,
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals || 9,
        logoURI: token.logoURI || token.image,
        chainId: 0 // Solana identifier
      }));
    }
    // Handle Solana token list format
    else if (data.tokens && Array.isArray(data.tokens)) {
      tokens = data.tokens.map((token: any) => ({
        address: token.address || token.mint,
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals || 9,
        logoURI: token.logoURI,
        chainId: 0
      }));
    }
    
    return tokens.filter(token => 
      token.address && 
      token.symbol && 
      token.name
    );
  } catch (error) {
    return [];
  }
}

// Parse XRPL tokens from XRPL.to API
export function parseXRPLTokenResponse(data: any): Token[] {
  try {
    let tokens: Token[] = [];
    
    // Handle XRPL.to API format with tokens array
    if (data.tokens && Array.isArray(data.tokens)) {
      tokens = data.tokens.map((token: any) => ({
        address: token.issuer,
        symbol: token.currency,
        name: token.name || token.currency,
        decimals: 15, // XRPL standard
        logoURI: token.icon ? `https://s1.xrpl.to/token/${token.md5}` : undefined,
        chainId: 'xrpl',
        price: token.priceUSD,
        marketCap: token.marketcap,
        volume24h: token.vol24hxrp
      }));
    }
    // Handle direct array format (legacy database)
    else if (Array.isArray(data)) {
      tokens = data.map((token: any) => ({
        address: token.issuer || token.address,
        symbol: token.currency || token.symbol,
        name: token.name || token.currency,
        decimals: token.decimals || 15,
        logoURI: token.icon_url || token.logoURI,
        chainId: 'xrpl',
        price: token.price,
        marketCap: token.market_cap,
        volume24h: token.volume_24h
      }));
    }
    
    return tokens.filter(token => 
      token.address && 
      token.symbol && 
      token.symbol !== 'XRP' && // Exclude native XRP
      token.symbol.length <= 40 &&
      token.address.length > 10 // Valid XRPL address
    );
  } catch (error) {
    return [];
  }
}

// Get CoinGecko chain ID mapping
export function getCoingeckoChainId(chainId: number): string {
  const mapping: { [key: number]: string } = {
    1: 'ethereum',
    56: 'binance-smart-chain',
    137: 'polygon-pos',
    250: 'fantom',
    43114: 'avalanche',
    42161: 'arbitrum-one',
    10: 'optimistic-ethereum',
    8453: 'base',
    42220: 'celo',
    100: 'xdai',
    1284: 'moonbeam',
    1285: 'moonriver',
    25: 'cronos',
    199: 'bittorrent',
    122: 'fuse',
    128: 'huobi-token',
    66: 'okex-chain',
    321: 'kucoin-community-chain',
    288: 'boba',
    1313161554: 'aurora',
    2000: 'dogechain',
    1088: 'metis-andromeda',
    592: 'astar'
  };
  
  return mapping[chainId] || 'ethereum';
}

// Get Trust Wallet chain ID mapping
export function getTrustWalletChainId(chainId: number): string {
  const mapping: { [key: number]: string } = {
    1: 'ethereum',
    56: 'smartchain',
    137: 'polygon',
    250: 'fantom',
    43114: 'avalanchec',
    42161: 'arbitrum',
    10: 'optimism',
    8453: 'base',
    42220: 'celo',
    100: 'xdai',
    1284: 'moonbeam',
    25: 'cronos',
    199: 'bittorrent',
    122: 'fuse'
  };
  
  return mapping[chainId] || 'ethereum';
}