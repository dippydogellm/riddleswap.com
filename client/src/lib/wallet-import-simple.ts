// Simplified Universal Wallet Import - Client Interface Only
// All crypto operations handled server-side to avoid WebAssembly issues

export type SupportedChain = 'ethereum' | 'bitcoin' | 'solana' | 'xrpl' | 'base' | 'bsc' | 'polygon';

// Chain configuration for derivation paths
export const DERIVATION_PATHS = {
  ethereum: "m/44'/60'/0'/0/0",
  bitcoin: "m/44'/0'/0'/0/0", 
  solana: "m/44'/501'/0'/0'",
  xrpl: "m/44'/144'/0'/0/0",
  base: "m/44'/60'/0'/0/0",
  bsc: "m/44'/60'/0'/0/0", 
  polygon: "m/44'/60'/0'/0/0"
};

export interface WalletData {
  address: string;
  chain: SupportedChain;
  privateKey: string;
  mnemonic?: string;
  derivationPath?: string;
  publicKey?: string;
}

export interface WalletImportResult {
  success: boolean;
  wallet?: WalletData;
  error?: string;
}

// Simple validation functions
export function validateMnemonic(mnemonic: string): boolean {
  const words = mnemonic.trim().split(/\s+/);
  return words.length === 12 || words.length === 24;
}

export function validatePrivateKey(privateKey: string, chain: SupportedChain): boolean {
  const cleanKey = privateKey.trim();
  
  switch (chain) {
    case 'ethereum':
    case 'base':
    case 'bsc':
    case 'polygon':
      return /^(0x)?[a-fA-F0-9]{64}$/.test(cleanKey);
    case 'bitcoin':
      return /^[a-fA-F0-9]{64}$/.test(cleanKey) || /^[5KL][1-9A-HJ-NP-Za-km-z]{50,51}$/.test(cleanKey);
    case 'solana':
      return /^[1-9A-HJ-NP-Za-km-z]{87,88}$/.test(cleanKey) || /^[a-fA-F0-9]{128}$/.test(cleanKey);
    case 'xrpl':
      return /^s[a-zA-Z0-9]{25,34}$/.test(cleanKey) || /^[a-fA-F0-9]{64}$/.test(cleanKey);
    default:
      return false;
  }
}

// Generate wallet from mnemonic phrase - Server-side processing
export async function generateWalletFromMnemonic(
  mnemonic: string,
  chain: SupportedChain,
  derivationPath?: string
): Promise<WalletImportResult> {
  try {
    const response = await fetch('/api/wallets/generate-from-mnemonic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mnemonic: mnemonic.trim(),
        chain,
        derivationPath: derivationPath || DERIVATION_PATHS[chain]
      })
    });

    const result = await response.json() as any;
    return result;
    
  } catch (error) {
    console.error('Mnemonic wallet generation error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to generate wallet from mnemonic' 
    };
  }
}

// Generate wallet from private key - Server-side processing
export async function generateWalletFromPrivateKey(
  privateKey: string,
  chain: SupportedChain
): Promise<WalletImportResult> {
  try {
    if (!validatePrivateKey(privateKey, chain)) {
      return { success: false, error: `Invalid private key format for ${chain}` };
    }

    const response = await fetch('/api/wallets/generate-from-private-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        privateKey: privateKey.trim(),
        chain
      })
    });

    const result = await response.json() as any;
    return result;
    
  } catch (error) {
    console.error('Private key wallet generation error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to generate wallet from private key' 
    };
  }
}

// Generate random mnemonic - Server-side processing
export function generateRandomMnemonic(): string {
  // For now, generate a placeholder mnemonic on client-side
  // In a real implementation, this should be done server-side for better security
  const words = [
    'abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract',
    'absurd', 'abuse', 'access', 'accident', 'account', 'accuse', 'achieve', 'acid',
    'acoustic', 'acquire', 'across', 'act', 'action', 'actor', 'actress', 'actual'
  ];
  
  const mnemonic = Array.from({ length: 12 }, () => 
    words[Math.floor(Math.random() * words.length)]
  ).join(' ');
  
  return mnemonic;
}

// Save imported wallet to database
export async function saveImportedWallet(
  walletData: WalletData & { 
    wallet_name: string; 
    import_method: 'private_key' | 'mnemonic' | 'generated';
  },
  password: string
): Promise<boolean> {
  try {
    const response = await fetch('/api/wallets/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...walletData,
        password
      })
    });

    const result = await response.json() as any;
    return result.success;
    
  } catch (error) {
    console.error('Save wallet error:', error);
    return false;
  }
}
