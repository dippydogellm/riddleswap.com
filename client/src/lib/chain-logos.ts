// Comprehensive chain logos for all supported networks with dynamic fallback
export interface ChainInfo {
  name: string;
  symbol: string;
  logo: string;
  type: 'layer1' | 'layer2' | 'sidechain';
  rpcUrl?: string;
  explorerUrl?: string;
}

// Chain logo paths - using local organized genuine PNG logos downloaded from official sources
const LOCAL_CHAIN_LOGOS = {
  1: '/images/chains/ethereum-logo.png',
  56: '/images/chains/bnb-logo.png',
  43114: '/images/chains/avalanche-logo.png',
  137: '/images/chains/polygon-logo.png',
  42161: '/images/chains/arbitrum-logo.png',
  10: '/images/chains/optimism-logo.png',
  8453: '/images/chains/base-logo.png',
  59144: '/images/chains/linea-logo.png',
  534352: '/images/chains/scroll-logo.png',
  5000: '/images/chains/mantle-logo.png',
  1088: '/images/chains/metis-logo.png',
  1868: '/images/chains/soneium-logo.png',
  167000: '/images/chains/taiko-logo.png',
  'solana': '/images/chains/solana-logo.png',
  'xrpl': '/images/chains/xrp-logo.png',
  'bitcoin': '/images/chains/bitcoin-logo.png'
};

export const comprehensiveChains: Record<number | string, ChainInfo> = {
  // Major Layer 1 Networks
  1: {
    name: 'Ethereum',
    symbol: 'ETH',
    logo: LOCAL_CHAIN_LOGOS[1],
    type: 'layer1',
    rpcUrl: 'https://mainnet.infura.io/v3/',
    explorerUrl: 'https://etherscan.io'
  },
  56: {
    name: 'BNB Smart Chain',
    symbol: 'BNB',
    logo: LOCAL_CHAIN_LOGOS[56],
    type: 'layer1',
    explorerUrl: 'https://bscscan.com'
  },
  43114: {
    name: 'Avalanche C-Chain',
    symbol: 'AVAX',
    logo: LOCAL_CHAIN_LOGOS[43114],
    type: 'layer1',
    explorerUrl: 'https://snowtrace.io'
  },
  250: {
    name: 'Fantom',
    symbol: 'FTM',
    logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/fantom/info/logo.png',
    type: 'layer1',
    explorerUrl: 'https://ftmscan.com'
  },
  
  // Major Layer 2 Networks - 2025 Complete List
  137: {
    name: 'Polygon',
    symbol: 'MATIC',
    logo: LOCAL_CHAIN_LOGOS[137],
    type: 'layer2',
    explorerUrl: 'https://polygonscan.com'
  },
  42161: {
    name: 'Arbitrum One',
    symbol: 'ARB',
    logo: LOCAL_CHAIN_LOGOS[42161],
    type: 'layer2',
    explorerUrl: 'https://arbiscan.io'
  },
  10: {
    name: 'Optimism',
    symbol: 'OP',
    logo: LOCAL_CHAIN_LOGOS[10],
    type: 'layer2',
    explorerUrl: 'https://optimistic.etherscan.io'
  },
  8453: {
    name: 'Base',
    symbol: 'ETH',
    logo: LOCAL_CHAIN_LOGOS[8453],
    type: 'layer2',
    explorerUrl: 'https://basescan.org'
  },
  324: {
    name: 'zkSync Era',
    symbol: 'ETH',
    logo: 'https://era.zksync.io/favicon/favicon-32x32.png',
    type: 'layer2',
    explorerUrl: 'https://explorer.zksync.io'
  },
  59144: {
    name: 'Linea',
    symbol: 'ETH',
    logo: LOCAL_CHAIN_LOGOS[59144],
    type: 'layer2',
    explorerUrl: 'https://lineascan.build'
  },
  1101: {
    name: 'Polygon zkEVM',
    symbol: 'ETH',
    logo: 'https://polygon.technology/favicon.ico',
    type: 'layer2',
    explorerUrl: 'https://zkevm.polygonscan.com'
  },
  534352: {
    name: 'Scroll',
    symbol: 'ETH',
    logo: LOCAL_CHAIN_LOGOS[534352],
    type: 'layer2',
    explorerUrl: 'https://scrollscan.com'
  },
  5000: {
    name: 'Mantle Network',
    symbol: 'MNT',
    logo: LOCAL_CHAIN_LOGOS[5000],
    type: 'layer2',
    explorerUrl: 'https://explorer.mantle.xyz'
  },
  42170: {
    name: 'Arbitrum Nova',
    symbol: 'ETH',
    logo: 'https://arbitrum.io/favicon.ico',
    type: 'layer2',
    explorerUrl: 'https://nova.arbiscan.io'
  },
  81457: {
    name: 'Blast',
    symbol: 'ETH',
    logo: 'https://blast.io/favicon.ico',
    type: 'layer2',
    explorerUrl: 'https://blastscan.io'
  },
  34443: {
    name: 'Mode',
    symbol: 'ETH',
    logo: 'https://mode.network/favicon.ico',
    type: 'layer2',
    explorerUrl: 'https://explorer.mode.network'
  },
  48900: {
    name: 'Zircuit',
    symbol: 'ETH',
    logo: 'https://zircuit.com/favicon.ico',
    type: 'layer2',
    explorerUrl: 'https://explorer.zircuit.com'
  },
  2522: {
    name: 'Fraxtal',
    symbol: 'frxETH',
    logo: 'https://frax.finance/favicon.ico',
    type: 'layer2',
    explorerUrl: 'https://fraxscan.com'
  },
  169: {
    name: 'Manta Pacific',
    symbol: 'ETH',
    logo: 'https://manta.network/favicon.ico',
    type: 'layer2',
    explorerUrl: 'https://pacific-explorer.manta.network'
  },
  
  // Additional Layer 2s and Sidechains
  1088: {
    name: 'Metis Andromeda',
    symbol: 'METIS',
    logo: LOCAL_CHAIN_LOGOS[1088],
    type: 'layer2',
    explorerUrl: 'https://andromeda-explorer.metis.io'
  },
  288: {
    name: 'Boba Network',
    symbol: 'ETH',
    logo: 'https://boba.network/favicon.ico',
    type: 'layer2',
    explorerUrl: 'https://blockexplorer.boba.network'
  },
  100: {
    name: 'Gnosis Chain',
    symbol: 'xDAI',
    logo: 'https://gnosis.io/favicon.ico',
    type: 'sidechain',
    explorerUrl: 'https://gnosisscan.io'
  },
  25: {
    name: 'Cronos',
    symbol: 'CRO',
    logo: 'https://cronos.org/favicon.ico',
    type: 'sidechain',
    explorerUrl: 'https://cronoscan.com'
  },
  42220: {
    name: 'Celo',
    symbol: 'CELO',
    logo: 'https://celo.org/favicon.ico',
    type: 'sidechain',
    explorerUrl: 'https://celoscan.io'
  },
  1284: {
    name: 'Moonbeam',
    symbol: 'GLMR',
    logo: 'https://moonbeam.network/favicon.ico',
    type: 'sidechain',
    explorerUrl: 'https://moonscan.io'
  },
  1285: {
    name: 'Moonriver',
    symbol: 'MOVR',
    logo: 'https://moonriver.moonbeam.network/favicon.ico',
    type: 'sidechain',
    explorerUrl: 'https://moonriver.moonscan.io'
  },
  1313161554: {
    name: 'Aurora',
    symbol: 'ETH',
    logo: 'https://aurora.dev/favicon.ico',
    type: 'sidechain',
    explorerUrl: 'https://aurorascan.dev'
  },
  122: {
    name: 'Fuse',
    symbol: 'FUSE',
    logo: 'https://fuse.io/favicon.ico',
    type: 'sidechain',
    explorerUrl: 'https://explorer.fuse.io'
  },
  9001: {
    name: 'Evmos',
    symbol: 'EVMOS',
    logo: 'https://evmos.org/favicon.ico',
    type: 'sidechain',
    explorerUrl: 'https://evm.evmos.org'
  },
  2222: {
    name: 'Kava EVM',
    symbol: 'KAVA',
    logo: 'https://kava.io/favicon.ico',
    type: 'sidechain',
    explorerUrl: 'https://explorer.kava.io'
  },
  8217: {
    name: 'Klaytn',
    symbol: 'KLAY',
    logo: 'https://klaytn.foundation/favicon.ico',
    type: 'sidechain',
    explorerUrl: 'https://scope.klaytn.com'
  },
  
  
  // Non-EVM Chains
  'solana': {
    name: 'Solana',
    symbol: 'SOL',
    logo: LOCAL_CHAIN_LOGOS['solana'] || 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png',
    type: 'layer1',
    explorerUrl: 'https://solscan.io'
  },
  'xrpl': {
    name: 'XRP Ledger', 
    symbol: 'XRP',
    logo: LOCAL_CHAIN_LOGOS['xrpl'] || 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/xrp/info/logo.png',
    type: 'layer1',
    explorerUrl: 'https://xrpscan.com'
  },
  'bitcoin': {
    name: 'Bitcoin',
    symbol: 'BTC',
    logo: LOCAL_CHAIN_LOGOS['bitcoin'] || 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/bitcoin/info/logo.png',
    type: 'layer1',
    explorerUrl: 'https://blockstream.info'
  },
  
  // Sony's Soneium Blockchain
  1868: {
    name: 'Soneium',
    symbol: 'ETH',
    logo: LOCAL_CHAIN_LOGOS[1868],
    type: 'layer2',
    explorerUrl: 'https://soneium.blockscout.com'
  },
  
  // Taiko Blockchain  
  167000: {
    name: 'Taiko',
    symbol: 'ETH',
    logo: LOCAL_CHAIN_LOGOS[167000],
    type: 'layer2',
    explorerUrl: 'https://taikoscan.io'
  }
};

// Legacy format for backward compatibility
export const chainLogos: Record<number | string, string> = Object.fromEntries(
  Object.entries(comprehensiveChains).map(([key, value]) => [key, value.logo])
);

// Dynamic logo fetching system
export async function fetchChainLogoFromInternet(chainName: string, chainId?: number): Promise<string> {
  const queries = [
    `${chainName} blockchain logo official`,
    `${chainName} cryptocurrency logo`,
    `${chainName} token logo`,
    chainId ? `chain id ${chainId} logo` : null
  ].filter(Boolean);
  
  // Try Trust Wallet assets first (most reliable)
  const trustWalletUrls = [
    `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${chainName.toLowerCase()}/info/logo.png`,
    `https://raw.githubusercontent.com/trustwallet/assets/master/dapps/${chainName.toLowerCase()}.png`
  ];
  
  for (const url of trustWalletUrls) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (response.ok) return url;
    } catch (e) {
      // Continue to next source
    }
  }
  
  // Fallback to CoinGecko or other reliable sources
  const fallbackUrls = [
    `https://assets.coingecko.com/coins/images/${chainName.toLowerCase()}/large/logo.png`,
    `https://cryptologos.cc/logos/${chainName.toLowerCase()}-${chainName.toLowerCase()}-logo.png`
  ];
  
  for (const url of fallbackUrls) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (response.ok) return url;
    } catch (e) {
      // Continue to next source
    }
  }
  
  return fallbackLogos.default;
}

// Fallback logos for unknown chains
export const fallbackLogos = {
  evm: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
  solana: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png',
  xrpl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/xrp/info/logo.png',
  default: '/logo.jpg'
}

// Get chain logo with dynamic fallback
export const getChainLogoUrl = async (chainId: number | string): Promise<string> => {
  // Try comprehensive chains first
  if (comprehensiveChains[chainId]) {
    return comprehensiveChains[chainId].logo;
  }
  
  // Try dynamic fetching for unknown chains
  if (typeof chainId === 'number') {
    try {
      const dynamicLogo = await fetchChainLogoFromInternet(`chain-${chainId}`, chainId);
      if (dynamicLogo !== fallbackLogos.default) {
        return dynamicLogo;
      }
    } catch (e) {

    }
  }
  
  return fallbackLogos.evm;
}

// Synchronous version for immediate use
export const getChainLogoUrlSync = (chainId: number | string): string => {
  return chainLogos[chainId] || comprehensiveChains[chainId]?.logo || fallbackLogos.evm;
}

// Get chain information
export const getChainInfo = (chainId: number | string): ChainInfo | null => {
  return comprehensiveChains[chainId] || null;
}

// Get all Layer 2 chains
export const getLayer2Chains = (): Record<string, ChainInfo> => {
  return Object.fromEntries(
    Object.entries(comprehensiveChains).filter(([_, info]) => info.type === 'layer2')
  );
}

// Get all EVM chains (Layer 1 + Layer 2 + Sidechains)
export const getEvmChains = (): Record<string, ChainInfo> => {
  return Object.fromEntries(
    Object.entries(comprehensiveChains).filter(([key, _]) => typeof key === 'number' || key === 'ethereum')
  );
}

// Chain display names
export const chainNames: Record<number | string, string> = {
  1: 'Ethereum',
  56: 'BNB Smart Chain',
  43114: 'Avalanche',
  250: 'Fantom',
  137: 'Polygon',
  42161: 'Arbitrum One',
  10: 'Optimism',
  8453: 'Base',
  324: 'zkSync Era',
  59144: 'Linea',
  1101: 'Polygon zkEVM',
  534352: 'Scroll',
  5000: 'Mantle',
  42170: 'Arbitrum Nova',
  81457: 'Blast',
  25: 'Cronos',
  42220: 'Celo',
  100: 'Gnosis',
  1284: 'Moonbeam',
  1285: 'Moonriver',
  128: 'Heco',
  66: 'OKC',
  321: 'KCC',
  40: 'Telos',
  1313161554: 'Aurora',
  42262: 'Oasis Emerald',
  122: 'Fuse',
  88: 'Velas',
  1666600000: 'Harmony One',
  10000: 'Smart Bitcoin Cash',
  361: 'Theta',
  199: 'BitTorrent',
  9001: 'Evmos',
  20: 'Elastos',
  30: 'RSK Mainnet',
  87: 'Nova Network',
  1088: 'Metis',
  2222: 'Kava',
  333999: 'Polis',
  106: 'Velas',
  820: 'Callisto',
  336: 'Shiden',
  592: 'Astar',
  71402: 'Godwoken',
  8217: 'Klaytn',
  1001: 'Klaytn Testnet',
  42: 'LUKSO',
  10242: 'Arthera',
  'solana': 'Solana',
  'xrpl': 'XRPL'
}

// Get chain display name
export const getChainName = (chainId: number | string): string => {
  return chainNames[chainId] || `Chain ${chainId}`
}
