// Chain logos and assets for all supported networks
export interface ChainAsset {
  id: number;
  name: string;
  symbol: string;
  logoUrl: string;
  fallbackColor: string;
}

export const chainAssets: Record<number, ChainAsset> = {
  // Layer 1 Networks
  1: {
    id: 1,
    name: 'Ethereum',
    symbol: 'ETH',
    logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
    fallbackColor: '#627EEA'
  },
  56: {
    id: 56,
    name: 'BNB Smart Chain',
    symbol: 'BNB',
    logoUrl: 'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png',
    fallbackColor: '#F3BA2F'
  },
  43114: {
    id: 43114,
    name: 'Avalanche',
    symbol: 'AVAX',
    logoUrl: 'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png',
    fallbackColor: '#E84142'
  },
  250: {
    id: 250,
    name: 'Fantom',
    symbol: 'FTM',
    logoUrl: 'https://assets.coingecko.com/coins/images/4001/small/Fantom_round.png',
    fallbackColor: '#1969FF'
  },
  25: {
    id: 25,
    name: 'Cronos',
    symbol: 'CRO',
    logoUrl: 'https://assets.coingecko.com/coins/images/7310/small/cro_token_logo.png',
    fallbackColor: '#002D74'
  },
  1313161554: {
    id: 1313161554,
    name: 'Aurora',
    symbol: 'ETH',
    logoUrl: 'https://assets.coingecko.com/coins/images/20582/small/aurora.jpeg',
    fallbackColor: '#70D44B'
  },
  1284: {
    id: 1284,
    name: 'Moonbeam',
    symbol: 'GLMR',
    logoUrl: 'https://assets.coingecko.com/coins/images/22459/small/glmr.png',
    fallbackColor: '#53CBC9'
  },
  1285: {
    id: 1285,
    name: 'Moonriver',
    symbol: 'MOVR',
    logoUrl: 'https://assets.coingecko.com/coins/images/17984/small/9285.png',
    fallbackColor: '#F2B705'
  },
  42220: {
    id: 42220,
    name: 'Celo',
    symbol: 'CELO',
    logoUrl: 'https://assets.coingecko.com/coins/images/11090/small/InjXBNx9_400x400.jpg',
    fallbackColor: '#35CE78'
  },

  // Layer 2 Networks
  137: {
    id: 137,
    name: 'Polygon',
    symbol: 'MATIC',
    logoUrl: 'https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png',
    fallbackColor: '#8247E5'
  },
  42161: {
    id: 42161,
    name: 'Arbitrum One',
    symbol: 'ETH',
    logoUrl: 'https://assets.coingecko.com/coins/images/16547/small/photo_2023-03-29_21.47.00.jpeg',
    fallbackColor: '#2D374B'
  },
  42170: {
    id: 42170,
    name: 'Arbitrum Nova',
    symbol: 'ETH',
    logoUrl: 'https://assets.coingecko.com/coins/images/16547/small/photo_2023-03-29_21.47.00.jpeg',
    fallbackColor: '#FF6B35'
  },
  10: {
    id: 10,
    name: 'Optimism',
    symbol: 'ETH',
    logoUrl: 'https://assets.coingecko.com/coins/images/25244/small/Optimism.png',
    fallbackColor: '#FF0420'
  },
  8453: {
    id: 8453,
    name: 'Base',
    symbol: 'ETH',
    logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
    fallbackColor: '#0052FF'
  },
  324: {
    id: 324,
    name: 'zkSync Era',
    symbol: 'ETH',
    logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
    fallbackColor: '#8C8DFC'
  },
  59144: {
    id: 59144,
    name: 'Linea',
    symbol: 'ETH',
    logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
    fallbackColor: '#000000'
  },
  1101: {
    id: 1101,
    name: 'Polygon zkEVM',
    symbol: 'ETH',
    logoUrl: 'https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png',
    fallbackColor: '#8247E5'
  },
  534352: {
    id: 534352,
    name: 'Scroll',
    symbol: 'ETH',
    logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
    fallbackColor: '#FFEEDA'
  },
  5000: {
    id: 5000,
    name: 'Mantle',
    symbol: 'MNT',
    logoUrl: 'https://assets.coingecko.com/coins/images/30980/small/token-logo.png',
    fallbackColor: '#000000'
  },
  81457: {
    id: 81457,
    name: 'Blast',
    symbol: 'ETH',
    logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
    fallbackColor: '#FCFC03'
  },
  169: {
    id: 169,
    name: 'Manta Pacific',
    symbol: 'ETH',
    logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
    fallbackColor: '#000000'
  },
  204: {
    id: 204,
    name: 'opBNB',
    symbol: 'BNB',
    logoUrl: 'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png',
    fallbackColor: '#F3BA2F'
  },

  // Alternative Networks
  100: {
    id: 100,
    name: 'Gnosis',
    symbol: 'xDAI',
    logoUrl: 'https://assets.coingecko.com/coins/images/662/small/logo_square_simple_300px.png',
    fallbackColor: '#04795B'
  },
  122: {
    id: 122,
    name: 'Fuse',
    symbol: 'FUSE',
    logoUrl: 'https://assets.coingecko.com/coins/images/10347/small/vUXKHEe.png',
    fallbackColor: '#46E8A5'
  },
  288: {
    id: 288,
    name: 'Boba',
    symbol: 'ETH',
    logoUrl: 'https://assets.coingecko.com/coins/images/20285/small/BOBA.png',
    fallbackColor: '#CBFF00'
  },
  1088: {
    id: 1088,
    name: 'Metis',
    symbol: 'METIS',
    logoUrl: 'https://assets.coingecko.com/coins/images/15595/small/metis.PNG',
    fallbackColor: '#00DACC'
  },
  66: {
    id: 66,
    name: 'OKX Chain',
    symbol: 'OKT',
    logoUrl: 'https://assets.coingecko.com/coins/images/13708/small/WeChat_Image_20220118095654.png',
    fallbackColor: '#000000'
  },
  128: {
    id: 128,
    name: 'Heco',
    symbol: 'HT',
    logoUrl: 'https://assets.coingecko.com/coins/images/12907/small/huobi-token-logo.png',
    fallbackColor: '#1253FC'
  },
  199: {
    id: 199,
    name: 'BitTorrent',
    symbol: 'BTT',
    logoUrl: 'https://assets.coingecko.com/coins/images/17659/small/bittorrent-chain-logo.png',
    fallbackColor: '#000000'
  },
  592: {
    id: 592,
    name: 'Astar',
    symbol: 'ASTR',
    logoUrl: 'https://assets.coingecko.com/coins/images/22617/small/astar-logo.png',
    fallbackColor: '#0070F3'
  },
  1666600000: {
    id: 1666600000,
    name: 'Harmony',
    symbol: 'ONE',
    logoUrl: 'https://assets.coingecko.com/coins/images/4344/small/Y88JAze.png',
    fallbackColor: '#00AEE9'
  },
  40: {
    id: 40,
    name: 'Telos',
    symbol: 'TLOS',
    logoUrl: 'https://assets.coingecko.com/coins/images/4660/small/Telos.png',
    fallbackColor: '#571AFF'
  },
  1001: {
    id: 1001,
    name: 'Klaytn',
    symbol: 'KLAY',
    logoUrl: 'https://assets.coingecko.com/coins/images/9672/small/klaytn.png',
    fallbackColor: '#000000'
  }
};

// Special assets for non-EVM chains
export const specialChainAssets = {
  xrpl: {
    id: -1,
    name: 'XRP Ledger',
    symbol: 'XRP',
    logoUrl: '/images/chains/xrp-logo.png',
    fallbackColor: '#000000'
  },
  solana: {
    id: 0,
    name: 'Solana',
    symbol: 'SOL',
    logoUrl: '/images/chains/solana-logo.png',
    fallbackColor: '#9945FF'
  }
};

export function getChainAsset(chainId: number): ChainAsset {
  if (chainId === -1) return specialChainAssets.xrpl;
  if (chainId === 0) return specialChainAssets.solana;
  
  return chainAssets[chainId] || {
    id: chainId,
    name: `Chain ${chainId}`,
    symbol: 'ETH',
    logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
    fallbackColor: '#627EEA'
  };
}

export function getChainLogo(chainId: number): string {
  return getChainAsset(chainId).logoUrl;
}
