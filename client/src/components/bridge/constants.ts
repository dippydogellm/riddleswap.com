// Bridge Module Constants - All 17 chains native tokens supported

export const SUPPORTED_TOKENS = [
  'BTC',    // Bitcoin
  'XRP',    // XRP Ledger
  'ETH',    // Ethereum
  'BNB',    // BNB Chain
  'MATIC',  // Polygon
  'ARB',    // Arbitrum (uses ETH)
  'OP',     // Optimism (uses ETH)
  'BASE',   // Base (uses ETH)
  'AVAX',   // Avalanche
  'FTM',    // Fantom
  'CRO',    // Cronos
  'XDAI',   // Gnosis
  'CELO',   // Celo
  'GLMR',   // Moonbeam
  'ZKSYNC', // zkSync (uses ETH but separate chain)
  'LINEA',  // Linea (uses ETH but separate chain)
  'SOL'     // Solana
];

export const TOKEN_CHAIN_MAP: Record<string, string> = {
  'BTC': 'BTC',
  'XRP': 'XRP',
  'ETH': 'ETH',
  'BNB': 'BNB',
  'MATIC': 'MATIC',
  'ARB': 'ARB',
  'OP': 'OP',
  'BASE': 'BASE',
  'AVAX': 'AVAX',
  'FTM': 'FTM',
  'CRO': 'CRO',
  'XDAI': 'XDAI',
  'CELO': 'CELO',
  'GLMR': 'GLMR',
  'ZKSYNC': 'ZKSYNC',
  'LINEA': 'LINEA',
  'SOL': 'SOL'
};

// All native tokens can ONLY bridge to XRP (as requested)
export const ALLOWED_BRIDGE_PATHS: Record<string, string[]> = {
  'BTC': ['XRP'],
  'XRP': ['XRP'],  // XRP to XRP (for RDL conversion)
  'ETH': ['XRP'],
  'BNB': ['XRP'],
  'MATIC': ['XRP'],
  'ARB': ['XRP'],
  'OP': ['XRP'],
  'BASE': ['XRP'],
  'AVAX': ['XRP'],
  'FTM': ['XRP'],
  'CRO': ['XRP'],
  'XDAI': ['XRP'],
  'CELO': ['XRP'],
  'GLMR': ['XRP'],
  'ZKSYNC': ['XRP'],
  'LINEA': ['XRP'],
  'SOL': ['XRP']
};

export const CHAIN_NAMES: Record<string, string> = {
  'XRP': 'XRP Ledger',
  'ETH': 'Ethereum',
  'BNB': 'BNB Chain',
  'MATIC': 'Polygon',
  'BASE': 'Base',
  'SOL': 'Solana',
  'BTC': 'Bitcoin'
};

export const BRIDGE_STEPS = {
  STEP_1: 'Send tokens to bridge',
  STEP_2: 'Verify transaction',
  STEP_3: 'Receive tokens'
};

export const DEFAULT_AMOUNTS = {
  BTC: '0.00000001',  // 1 satoshi
  XRP: '0.000001',
  ETH: '0.000001',
  SOL: '0.000001',
  RDL: '1',
  SRDL: '1'
};

export const BANK_WALLETS = {
  BTC: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',  // Bitcoin bank wallet
  XRP: 'rsFbZ33Zr3BCVyiVPw8pFvbtnrG1i8FwA3',
  ETH: '0xf7802d7522a45CB6a6f2eFa246f4B5489768b673',
  SOL: 'AtzvJY1BvHQihWRxS3VCzqfzmx6p7Xjwu3z2JjLwNLsC',
  BASE: '0xf7802d7522a45CB6a6f2eFa246f4B5489768b673'
};
