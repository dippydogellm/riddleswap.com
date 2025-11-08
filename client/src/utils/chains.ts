export interface ChainInfo {
  id: string;
  name: string;
  type: string;
  nativeCurrency: string;
  logoPath: string;
  color: string;
  blockTime?: string;
  avgFee?: string;
  security?: string;
  explorerUrl?: string;
}

export const CHAIN_MAP: Record<string, ChainInfo> = {
  // Layer 1 Blockchains
  ethereum: {
    id: "ethereum",
    name: "Ethereum",
    type: "evm",
    nativeCurrency: "ETH",
    logoPath: "/images/chains/ethereum-logo.png",
    color: "bg-purple-500",
    blockTime: "12s",
    avgFee: "$8-25",
    security: "Highest",
    explorerUrl: "https://etherscan.io"
  },
  bitcoin: {
    id: "bitcoin",
    name: "Bitcoin",
    type: "utxo",
    nativeCurrency: "BTC",
    logoPath: "/images/chains/bitcoin-logo.png",
    color: "bg-orange-500",
    blockTime: "10m",
    avgFee: "$2-8",
    security: "Highest",
    explorerUrl: "https://blockstream.info"
  },
  solana: {
    id: "solana",
    name: "Solana",
    type: "spl",
    nativeCurrency: "SOL",
    logoPath: "/images/chains/solana-logo.png",
    color: "bg-green-500",
    blockTime: "400ms",
    avgFee: "$0.0001",
    security: "High",
    explorerUrl: "https://solscan.io"
  },
  xrpl: {
    id: "xrpl",
    name: "XRPL",
    type: "xrpl",
    nativeCurrency: "XRP",
    logoPath: "/images/chains/xrp-logo.png",
    color: "bg-blue-500",
    blockTime: "3-5s",
    avgFee: "$0.00001",
    security: "High",
    explorerUrl: "https://xrpscan.com"
  },
  avalanche: {
    id: "avalanche",
    name: "Avalanche",
    type: "evm",
    nativeCurrency: "AVAX",
    logoPath: "/images/chains/avalanche-logo.png",
    color: "bg-red-500",
    blockTime: "2s",
    avgFee: "$0.5-2",
    security: "High",
    explorerUrl: "https://snowtrace.io"
  },
  
  // Layer 2 & Side Chains
  polygon: {
    id: "polygon",
    name: "Polygon",
    type: "evm",
    nativeCurrency: "MATIC",
    logoPath: "/images/chains/polygon-logo.png",
    color: "bg-indigo-500",
    blockTime: "2s",
    avgFee: "$0.01-0.1",
    security: "High",
    explorerUrl: "https://polygonscan.com"
  },
  arbitrum: {
    id: "arbitrum",
    name: "Arbitrum",
    type: "evm",
    nativeCurrency: "ETH",
    logoPath: "/images/chains/arbitrum-logo.png",
    color: "bg-blue-700",
    blockTime: "250ms",
    avgFee: "$0.1-1",
    security: "High",
    explorerUrl: "https://arbiscan.io"
  },
  optimism: {
    id: "optimism",
    name: "Optimism",
    type: "evm",
    nativeCurrency: "ETH",
    logoPath: "/images/chains/optimism-logo.png",
    color: "bg-red-600",
    blockTime: "2s",
    avgFee: "$0.1-1",
    security: "High",
    explorerUrl: "https://optimistic.etherscan.io"
  },
  base: {
    id: "base",
    name: "Base",
    type: "evm",
    nativeCurrency: "ETH",
    logoPath: "/images/chains/base-logo.png",
    color: "bg-blue-600",
    blockTime: "2s",
    avgFee: "$0.01-0.5",
    security: "High",
    explorerUrl: "https://basescan.org"
  },
  mantle: {
    id: "mantle",
    name: "Mantle",
    type: "evm",
    nativeCurrency: "MNT",
    logoPath: "/images/chains/mantle-logo.png",
    color: "bg-amber-700",
    blockTime: "2s",
    avgFee: "$0.001-0.01",
    security: "Medium",
    explorerUrl: "https://explorer.mantle.xyz"
  },
  metis: {
    id: "metis",
    name: "Metis",
    type: "evm",
    nativeCurrency: "METIS",
    logoPath: "/images/chains/metis-logo.png",
    color: "bg-cyan-500",
    blockTime: "4s",
    avgFee: "$0.01-0.1",
    security: "Medium",
    explorerUrl: "https://andromeda-explorer.metis.io"
  },
  scroll: {
    id: "scroll",
    name: "Scroll",
    type: "evm",
    nativeCurrency: "ETH",
    logoPath: "/images/chains/scroll-logo.png",
    color: "bg-emerald-600",
    blockTime: "3s",
    avgFee: "$0.1-0.5",
    security: "Medium",
    explorerUrl: "https://scrollscan.com"
  },
  zksync: {
    id: "zksync",
    name: "zkSync",
    type: "evm",
    nativeCurrency: "ETH",
    logoPath: "/images/chains/zksync-logo.png",
    color: "bg-slate-600",
    blockTime: "1s",
    avgFee: "$0.1-0.5",
    security: "High",
    explorerUrl: "https://explorer.zksync.io"
  },
  linea: {
    id: "linea",
    name: "Linea",
    type: "evm",
    nativeCurrency: "ETH",
    logoPath: "/images/chains/linea-logo.png",
    color: "bg-green-600",
    blockTime: "2s",
    avgFee: "$0.1-1",
    security: "High",
    explorerUrl: "https://lineascan.build"
  },
  taiko: {
    id: "taiko",
    name: "Taiko",
    type: "evm",
    nativeCurrency: "ETH",
    logoPath: "/images/chains/taiko-logo.png",
    color: "bg-pink-500",
    blockTime: "12s",
    avgFee: "$0.01-0.1",
    security: "Medium",
    explorerUrl: "https://taikoscan.io"
  },
  
  // BSC & Alternative EVM (mapping bsc to bnb-logo.png)
  bsc: {
    id: "bsc",
    name: "BSC",
    type: "evm",
    nativeCurrency: "BNB",
    logoPath: "/images/chains/bnb-logo.png",
    color: "bg-yellow-500",
    blockTime: "3s",
    avgFee: "$0.1-0.5",
    security: "Medium",
    explorerUrl: "https://bscscan.com"
  },
  fantom: {
    id: "fantom",
    name: "Fantom",
    type: "evm",
    nativeCurrency: "FTM",
    logoPath: "/images/chains/fantom-logo.png",
    color: "bg-blue-400",
    blockTime: "1s",
    avgFee: "$0.01-0.1",
    security: "Medium",
    explorerUrl: "https://ftmscan.com"
  },
  unichain: {
    id: "unichain",
    name: "Unichain",
    type: "evm",
    nativeCurrency: "ETH",
    logoPath: "/images/chains/unichain-logo.png",
    color: "bg-pink-600",
    blockTime: "1s",
    avgFee: "$0.01-0.1",
    security: "Medium",
    explorerUrl: "https://unichain-sepolia.blockscout.com"
  },
  soneium: {
    id: "soneium",
    name: "Soneium",
    type: "evm",
    nativeCurrency: "ETH",
    logoPath: "/images/chains/soneium-logo.png",
    color: "bg-purple-600",
    blockTime: "2s",
    avgFee: "$0.01-0.1",
    security: "Medium",
    explorerUrl: "https://soneium-minato.blockscout.com"
  }
};

// Chain ID aliases to handle common variations
const CHAIN_ALIASES: Record<string, string> = {
  'avax': 'avalanche',
  'bnb': 'bsc',
  'eth': 'ethereum',
  'btc': 'bitcoin',
  'sol': 'solana',
  'xrp': 'xrpl',
  'matic': 'polygon'
};

/**
 * Get the logo path for a chain ID, with fallback to Ethereum logo
 */
export function getChainLogoPath(chainId: string): string {
  // CRITICAL FIX: Handle undefined/null/empty chainId to prevent crashes
  if (!chainId || typeof chainId !== 'string' || chainId.trim() === '') {
    console.warn(`Invalid chainId provided to getChainLogoPath:`, chainId);
    return "/images/chains/ethereum-logo.png";
  }
  
  // ALIAS FIX: Check for aliases first
  const resolvedChainId = CHAIN_ALIASES[chainId] || chainId;
  const chain = CHAIN_MAP[resolvedChainId];
  
  if (!chain) {
    console.warn(`Chain not found in CHAIN_MAP: ${chainId} (resolved: ${resolvedChainId})`);
    return "/images/chains/ethereum-logo.png";
  }
  console.log(`Loading logo for ${chainId}: ${chain.logoPath}`);
  return chain.logoPath;
}

/**
 * Get the display name for a chain ID
 */
export function getChainDisplayName(chainId: string): string {
  // CRITICAL FIX: Handle undefined/null/empty chainId to prevent crashes
  if (!chainId || typeof chainId !== 'string' || chainId.trim() === '') {
    console.warn(`Invalid chainId provided to getChainDisplayName:`, chainId);
    return 'Unknown Chain';
  }
  
  // ALIAS FIX: Check for aliases first
  const resolvedChainId = CHAIN_ALIASES[chainId] || chainId;
  const chain = CHAIN_MAP[resolvedChainId];
  return chain ? chain.name : chainId.charAt(0).toUpperCase() + chainId.slice(1);
}

/**
 * Get complete chain information for a chain ID
 */
export function getChainInfo(chainId: string): ChainInfo | null {
  return CHAIN_MAP[chainId] || null;
}

/**
 * Get all available chains as an array
 */
export function getAllChains(): ChainInfo[] {
  return Object.values(CHAIN_MAP);
}

/**
 * Check if a chain ID exists in our mapping
 */
export function isValidChainId(chainId: string): boolean {
  return chainId in CHAIN_MAP;
}
