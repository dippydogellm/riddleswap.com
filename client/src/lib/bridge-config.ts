// Bridge configuration with all supported tokens - using local chain logos
const XRPLogo = '/images/chains/xrp-logo.png';
const ETHLogo = '/images/chains/ethereum-logo.png';
const SOLLogo = '/images/chains/solana-logo.png';
const BTCLogo = '/images/chains/bitcoin-logo.png';
const BNBLogo = '/images/chains/bnb-logo.png';
const BaseLogo = '/images/chains/base-logo.png';
const ArbitrumLogo = '/images/chains/arbitrum-logo.png';
const PolygonLogo = '/images/chains/polygon-logo.png';
const OptimismLogo = '/images/chains/optimism-logo.png';

export interface BridgeToken {
  symbol: string;
  name: string;
  chainId: string;
  contractAddress: string;
  decimals: number;
  logo: string;
  currency?: string; // For XRPL tokens
  issuer?: string; // For XRPL tokens
  isSourceOnly?: boolean;
  isDestinationOnly?: boolean;
  comingSoon?: boolean;
}

export const BRIDGE_TOKENS: BridgeToken[] = [
  // Source tokens (FROM) - Multiple chains and tokens
  {
    symbol: 'XRP',
    name: 'XRP',
    chainId: 'xrpl',
    contractAddress: '',
    decimals: 6,
    logo: XRPLogo,
    isSourceOnly: true
  },
  {
    symbol: 'SOL',
    name: 'Solana',
    chainId: 'solana',
    contractAddress: '',
    decimals: 9,
    logo: SOLLogo,
    isSourceOnly: true
  },
  {
    symbol: 'ETH',
    name: 'Ethereum',
    chainId: 'ethereum',
    contractAddress: '0x0000000000000000000000000000000000000000',
    decimals: 18,
    logo: ETHLogo,
    isSourceOnly: true
  },
  {
    symbol: 'ETH',
    name: 'ETH on Base',
    chainId: 'base',
    contractAddress: '0x0000000000000000000000000000000000000000',
    decimals: 18,
    logo: BaseLogo,
    isSourceOnly: true
  },
  
  // Destination tokens (TO) - Comprehensive cross-chain support
  {
    symbol: 'RDL',
    name: 'Riddle',
    chainId: 'xrpl',
    contractAddress: '',
    decimals: 15,
    logo: '/images/chains/xrp-logo.png', // RDL uses XRPL logo
    currency: '52444C0000000000000000000000000000000000',
    issuer: 'rLjUKWxm7vfbyTGNHHDhf9SEHWqrW9eFYs',
    isDestinationOnly: true
  },
  {
    symbol: 'SRDL',
    name: 'Riddle on Solana',
    chainId: 'solana',
    contractAddress: 'HzHjhFqnQCQvvBbthdexQWz3Q3ii5UpJtqS5wdvqJPLW',
    decimals: 6,
    logo: SOLLogo, // SRDL uses Solana logo
    isDestinationOnly: true
  },
];

// Get tokens available for source (FROM)
export function getSourceTokens(): BridgeToken[] {
  return BRIDGE_TOKENS.filter(token => token.isSourceOnly && !token.comingSoon);
}

// Get tokens available for destination (TO)
export function getDestinationTokens(): BridgeToken[] {
  return BRIDGE_TOKENS.filter(token => token.isDestinationOnly && !token.comingSoon);
}

// Find token by symbol and chain
export function findToken(symbol: string, chainId?: string): BridgeToken | undefined {
  return BRIDGE_TOKENS.find(token => 
    token.symbol === symbol && 
    (!chainId || token.chainId === chainId)
  );
}

// Export all tokens for compatibility
export const ALL_BRIDGE_TOKENS = BRIDGE_TOKENS;

// Bank wallet addresses for each chain
export const BANK_WALLET_ADDRESSES = {
  xrpl: 'rsFbZ33Zr3BCVyiVPw8pFvbtnrG1i8FwA3',
  ethereum: '0xf7802d7522a45CB6a6f2eFa246f4B5489768b673',
  solana: 'AtzvJY1BvHQihWRxS3VCzqfzmx6p7Xjwu3z2JjLwNLsC',
  base: '0xf7802d7522a45CB6a6f2eFa246f4B5489768b673' // Same as Ethereum for EVM compatibility
};

// Generate all possible payload combinations
export function getAllBridgePayloads() {
  return BRIDGE_PAIRS.map(pair => ({
    id: `${pair.fromChain}-${pair.from}-to-${pair.toChain}-${pair.to}`,
    fromToken: pair.from,
    fromChain: pair.fromChain,
    toToken: pair.to,
    toChain: pair.toChain,
    fromTokenData: BRIDGE_TOKENS.find(t => t.symbol === pair.from && t.chainId === pair.fromChain),
    toTokenData: BRIDGE_TOKENS.find(t => t.symbol === pair.to && t.chainId === pair.toChain),
    bankAddress: BANK_WALLET_ADDRESSES[pair.fromChain as keyof typeof BANK_WALLET_ADDRESSES],
    destinationBankAddress: BANK_WALLET_ADDRESSES[pair.toChain as keyof typeof BANK_WALLET_ADDRESSES],
    supported: true
  }));
}

// Validate if a bridge pair is supported
export function isBridgePairSupported(fromToken: string, fromChain: string, toToken: string, toChain: string): boolean {
  return BRIDGE_PAIRS.some(pair => 
    pair.from === fromToken && 
    pair.fromChain === fromChain && 
    pair.to === toToken && 
    pair.toChain === toChain
  );
}

// Supported chains for the bridge
export const SUPPORTED_CHAINS = [
  { id: 'xrpl', name: 'XRPL', rpc: 'wss://xrplcluster.com' },
  { id: 'ethereum', name: 'Ethereum', rpc: 'https://eth.llamarpc.com', chainId: 1 },
  { id: 'solana', name: 'Solana', rpc: 'https://api.mainnet-beta.solana.com' },
  { id: 'base', name: 'Base', rpc: 'https://mainnet.base.org', chainId: 8453 }
];

// All possible bridge pairs (FROM -> TO)
export const BRIDGE_PAIRS = [
  // XRPL sources to all destinations
  { from: 'XRP', fromChain: 'xrpl', to: 'RDL', toChain: 'xrpl' },
  { from: 'XRP', fromChain: 'xrpl', to: 'SRDL', toChain: 'solana' },
  
  { from: 'RDL', fromChain: 'xrpl', to: 'SRDL', toChain: 'solana' },
  
  // Ethereum sources to destinations
  { from: 'ETH', fromChain: 'ethereum', to: 'RDL', toChain: 'xrpl' },
  { from: 'ETH', fromChain: 'ethereum', to: 'SRDL', toChain: 'solana' },
  
  { from: 'USDC', fromChain: 'ethereum', to: 'RDL', toChain: 'xrpl' },
  { from: 'USDC', fromChain: 'ethereum', to: 'SRDL', toChain: 'solana' },
  
  // Solana sources to destinations  
  { from: 'SOL', fromChain: 'solana', to: 'RDL', toChain: 'xrpl' },
  
  { from: 'USDC', fromChain: 'solana', to: 'RDL', toChain: 'xrpl' },
  
  // Base sources to destinations
  { from: 'ETH', fromChain: 'base', to: 'RDL', toChain: 'xrpl' },
  { from: 'ETH', fromChain: 'base', to: 'SRDL', toChain: 'solana' },
  
  { from: 'USDC', fromChain: 'base', to: 'RDL', toChain: 'xrpl' },
  { from: 'USDC', fromChain: 'base', to: 'SRDL', toChain: 'solana' }
];

// Bridge fee percentage
export const BRIDGE_FEE_PERCENTAGE = 0.01; // 1%

// Network fees
export const NETWORK_FEES = {
  xrpl: '0.00001',
  ethereum: '0.005',
  solana: '0.00025',
  bsc: '0.001',
  base: '0.001'
};

// User XRPL address - should be dynamically set based on connected wallet
// Dynamic wallet addresses only - no hardcoded addresses
