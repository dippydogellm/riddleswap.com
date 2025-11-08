// Bridge Handler Types - Shared across all chain handlers

export interface BridgePaymentRequest {
  handle: string;
  password: string;
  fromToken: string;
  toToken: string;
  amount: string;
  destinationAddress: string;
  transactionId?: string;
}

export interface BridgePaymentResponse {
  success: boolean;
  txHash?: string;
  error?: string;
  message?: string;
  bankWalletAddress?: string;
  memo?: string;
}

export interface ChainHandler {
  execute(params: ChainPaymentParams): Promise<BridgePaymentResponse>;
  validateAddress(address: string): boolean;
  getBankWallet(): string;
}

export interface ChainPaymentParams {
  privateKey: string;
  fromAddress: string;
  toAddress: string;
  amount: string;
  memo: string;
  fromToken: string;
}

// SECURITY: Bank wallets loaded from environment variables only
export const BANK_WALLETS = {
  XRP: process.env.RIDDLE_BANK_XRP_ADDRESS || '',
  ETH: process.env.RIDDLE_BANK_EVM_ADDRESS || '', // Universal EVM bank address
  SOL: process.env.RIDDLE_BANK_SOL_ADDRESS || '',
  BTC: process.env.RIDDLE_BANK_BTC_ADDRESS || '',
  BNB: process.env.RIDDLE_BANK_EVM_ADDRESS || '', // Universal EVM bank address
  MATIC: process.env.RIDDLE_BANK_EVM_ADDRESS || '', // Universal EVM bank address
  BASE: process.env.RIDDLE_BANK_EVM_ADDRESS || '', // Universal EVM bank address
  ARBITRUM: process.env.RIDDLE_BANK_EVM_ADDRESS || '', // Universal EVM bank address (Layer 2)
  OPTIMISM: process.env.RIDDLE_BANK_EVM_ADDRESS || '', // Universal EVM bank address (Layer 2)
  AVAX: process.env.RIDDLE_BANK_EVM_ADDRESS || '',  // Universal EVM bank address
  FANTOM: process.env.RIDDLE_BANK_EVM_ADDRESS || '', // Universal EVM bank address
  CRONOS: process.env.RIDDLE_BANK_EVM_ADDRESS || '', // Universal EVM bank address
  GNOSIS: process.env.RIDDLE_BANK_EVM_ADDRESS || '', // Universal EVM bank address
  CELO: process.env.RIDDLE_BANK_EVM_ADDRESS || '', // Universal EVM bank address
  MOONBEAM: process.env.RIDDLE_BANK_EVM_ADDRESS || '', // Universal EVM bank address
  ZKSYNC: process.env.RIDDLE_BANK_EVM_ADDRESS || '', // Universal EVM bank address (Layer 2)
  LINEA: process.env.RIDDLE_BANK_EVM_ADDRESS || '' // Universal EVM bank address (Layer 2)
} as const;

// Token to chain mapping - Native tokens map to their respective chains
export const TOKEN_CHAIN_MAP: Record<string, keyof typeof BANK_WALLETS> = {
  'XRP': 'XRP',
  'RDL': 'XRP',
  'ETH': 'ETH',      // ETH on Ethereum mainnet
  'WETH': 'ETH',     // Wrapped ETH on Ethereum
  'SOL': 'SOL',
  'WSOL': 'SOL',
  'SRDL': 'SOL',
  'BNB': 'BNB',      // Native BNB on BSC
  'BNBRDL': 'BNB',
  'MATIC': 'MATIC',  // Native MATIC on Polygon
  'BASE-ETH': 'BASE', // Native ETH on Base chain
  'BASRDL': 'BASE',
  'ARB': 'ARBITRUM', // Native ETH on Arbitrum
  'ARBRDL': 'ARBITRUM', // RDL on Arbitrum
  'OP': 'OPTIMISM',  // Native ETH on Optimism
  'OPRDL': 'OPTIMISM', // RDL on Optimism
  'BTC': 'BTC',
  'WBTC': 'ETH',
  'AVAX': 'AVAX',
  'ERDL': 'ETH',
  'FTM': 'FANTOM',   // Native FTM on Fantom
  'FTMRDL': 'FANTOM', // RDL on Fantom
  'CRO': 'CRONOS',   // Native CRO on Cronos
  'CRORDL': 'CRONOS', // RDL on Cronos
  'XDAI': 'GNOSIS',  // Native xDAI on Gnosis
  'GNOSISRDL': 'GNOSIS', // RDL on Gnosis
  'CELO': 'CELO',    // Native CELO on Celo
  'CELORDL': 'CELO', // RDL on Celo
  'GLMR': 'MOONBEAM', // Native GLMR on Moonbeam
  'GLMRRDL': 'MOONBEAM', // RDL on Moonbeam
  'ZKSYNC-ETH': 'ZKSYNC', // Native ETH on zkSync Era
  'ZKSYNCRDL': 'ZKSYNC', // RDL on zkSync Era
  'LINEA-ETH': 'LINEA', // Native ETH on Linea
  'LINEARDL': 'LINEA' // RDL on Linea
};