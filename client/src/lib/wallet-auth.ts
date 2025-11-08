/**
 * Wallet Authentication Utilities
 * Handles SIWE (Sign-in with Ethereum) and multi-chain wallet authentication for Riddle Wallet system
 */

// DISABLED: AppKit/Reown imports - using direct wallet APIs only
// Only Riddle wallet + external wallets (Xaman, Joey, Phantom, MetaMask)
// import { createAppKit } from '@reown/appkit/react'
// import { EthersAdapter } from '@reown/appkit-adapter-ethers'
// import { SolanaAdapter } from '@reown/appkit-adapter-solana'

export interface WalletSignature {
  address: string;
  signature: string;
  message: string;
  timestamp: number;
  chain: 'ETH' | 'XRP' | 'SOL' | 'BTC';
}

export interface SIWESession {
  handle: string;
  address: string;
  chainId: number;
  signature: string;
  message: string;
  sessionToken: string;
  expiresAt: Date;
  createdAt: Date;
}

/**
 * Generate SIWE (Sign-in with Ethereum) message for wallet authentication
 */
export function generateSIWEMessage(handle: string, address: string, action: 'create' | 'login'): string {
  const domain = window.location.host;
  const origin = window.location.origin;
  const timestamp = new Date().toISOString();
  const nonce = crypto.randomUUID();
  const statement = `${action === 'create' ? 'Create' : 'Sign in to'} Riddle Wallet with handle @${handle}`;
  
  return `${domain} wants you to sign in with your Ethereum account:
${address}

${statement}

URI: ${origin}
Version: 1
Chain ID: 1
Nonce: ${nonce}
Issued At: ${timestamp}`;
}

/**
 * Generate authentication message for non-Ethereum chains
 */
export function generateAuthMessage(handle: string, address: string, action: 'create' | 'login', chain: string): string {
  const timestamp = Date.now();
  const nonce = crypto.randomUUID();
  
  return `Riddle Wallet ${action === 'create' ? 'Creation' : 'Login'}

Handle: @${handle}
Address: ${address}
Chain: ${chain}
Action: ${action}
Timestamp: ${timestamp}
Nonce: ${nonce}

Sign this message to authenticate with Riddle Wallet.`;
}

/**
 * DISABLED: AppKit/Reown signing - using direct MetaMask API
 * Sign SIWE message with Ethereum wallet using direct MetaMask API
 */
export async function signSIWEWithMetaMask(handle: string): Promise<{ signature: string; address: string; message: string }> {
  try {
    if (!window.ethereum) {
      throw new Error('MetaMask not detected');
    }

    // Request account access
    const accounts = await (window.ethereum as any).request({ method: 'eth_requestAccounts' });
    if (!accounts?.[0]) {
      throw new Error('No wallet connected');
    }

    const address = accounts[0];
    
    // Generate SIWE message
    const message = generateSIWEMessage(handle, address, 'login');

    // Sign the SIWE message
    const signature = await (window.ethereum as any).request({
      method: 'personal_sign',
      params: [message, address],
    });

    return { signature, address, message };
  } catch (error: any) {
    throw new Error('Failed to sign SIWE message: ' + (error?.message || 'Unknown error'));
  }
}

/**
 * Legacy Ethereum signing for backwards compatibility
 */
export async function signWithEthereum(message: string): Promise<{ signature: string; address: string }> {
  if (!window.ethereum) {
    throw new Error('Ethereum wallet not found');
  }

  try {
    // Request account access
    const accounts = await (window.ethereum as any).request({ method: 'eth_requestAccounts' });
    const address = accounts[0];

    // Sign the message
    const signature = await (window.ethereum as any).request({
      method: 'personal_sign',
      params: [message, address],
    });

    return { signature, address };
  } catch (error: any) {
    throw new Error('Failed to sign with Ethereum wallet: ' + (error?.message || 'Unknown error'));
  }
}

/**
 * Sign message with Solana wallet
 */
export async function signWithSolana(message: string): Promise<{ signature: string; address: string }> {
  if (!window.solana || !window.solana.isPhantom) {
    throw new Error('Solana wallet not found');
  }

  try {
    // Connect wallet
    const response = await window.solana?.connect?.();
    if (!response?.publicKey) throw new Error('Failed to connect to Solana wallet');
    const address = response.publicKey.toString();

    // Sign the message
    const encodedMessage = new TextEncoder().encode(message);
    const signedMessage = await window.solana?.signMessage?.(encodedMessage);
    if (!signedMessage?.signature) throw new Error('Failed to sign message');
    const signature = Buffer.from(signedMessage.signature).toString('hex');

    return { signature, address };
  } catch (error: any) {
    throw new Error('Failed to sign with Solana wallet: ' + (error?.message || 'Unknown error'));
  }
}

/**
 * Sign message with XRPL wallet (Xaman)
 */
export async function signWithXaman(message: string, handle: string): Promise<{ signature: string; address: string }> {
  try {
    // Create Xaman sign request
    const response = await fetch('/api/xaman/sign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        handle
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create Xaman signing request');
    }

    const data = await response.json() as any;
    return {
      signature: data.signature,
      address: data.address
    };
  } catch (error: any) {
    throw new Error('Failed to sign with Xaman wallet: ' + (error?.message || 'Unknown error'));
  }
}

/**
 * Sign message with Bitcoin wallet
 */
export async function signWithBitcoin(message: string): Promise<{ signature: string; address: string }> {
  if (!window.unisat) {
    throw new Error('Bitcoin wallet not found');
  }

  try {
    // Request account access
    const accounts = await window.unisat?.requestAccounts?.();
    if (!accounts?.[0]) throw new Error('Failed to get Bitcoin wallet accounts');
    const address = accounts[0];

    // Sign the message
    const signature = await window.unisat?.signMessage?.(message);
    if (!signature) throw new Error('Failed to sign message');

    return { signature, address };
  } catch (error: any) {
    throw new Error('Failed to sign with Bitcoin wallet: ' + (error?.message || 'Unknown error'));
  }
}

/**
 * Sign authentication message with appropriate wallet
 */
export async function signAuthMessage(
  chain: 'ETH' | 'XRP' | 'SOL' | 'BTC',
  message: string,
  handle?: string
): Promise<WalletSignature> {
  let result: { signature: string; address: string };

  switch (chain) {
    case 'ETH':
      result = await signWithEthereum(message);
      break;
    case 'SOL':
      result = await signWithSolana(message);
      break;
    case 'XRP':
      if (!handle) throw new Error('Handle required for XRP signing');
      result = await signWithXaman(message, handle);
      break;
    case 'BTC':
      result = await signWithBitcoin(message);
      break;
    default:
      throw new Error('Unsupported chain');
  }

  return {
    address: result.address,
    signature: result.signature,
    message,
    timestamp: Date.now(),
    chain
  };
}

/**
 * Verify wallet signature (client-side verification)
 */
export function verifySignature(signature: WalletSignature): boolean {
  // Basic validation
  if (!signature.address || !signature.signature || !signature.message) {
    return false;
  }

  // Check timestamp (signature should be recent - within 5 minutes)
  const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
  if (signature.timestamp < fiveMinutesAgo) {
    return false;
  }

  // Note: Full cryptographic verification would be done server-side
  // This is just basic structure validation
  return true;
}

/**
 * Create SIWE authenticated session
 */
export function createSIWESession(
  handle: string,
  address: string,
  signature: string,
  message: string,
  autoLogoutMinutes: number = 30
): SIWESession {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + (autoLogoutMinutes * 60 * 1000));
  
  const session: SIWESession = {
    handle,
    address,
    chainId: 1, // Ethereum mainnet
    signature,
    message,
    sessionToken: crypto.randomUUID(),
    expiresAt,
    createdAt: now
  };

  // Store session
  sessionStorage.setItem('riddle_siwe_session', JSON.stringify(session));
  
  // Set auto-logout if enabled
  if (autoLogoutMinutes > 0) {
    setTimeout(() => {
      sessionStorage.removeItem('riddle_siwe_session');
      window.location.href = '/wallet-login';
    }, autoLogoutMinutes * 60 * 1000);
  }

  return session;
}

/**
 * Get current SIWE session
 */
export function getCurrentSIWESession(): SIWESession | null {
  try {
    const sessionData = sessionStorage.getItem('riddle_siwe_session');
    if (!sessionData) return null;

    const session: SIWESession = JSON.parse(sessionData);
    
    // Check if session is expired
    if (new Date() > new Date(session.expiresAt)) {
      sessionStorage.removeItem('riddle_siwe_session');
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

/**
 * Create authenticated session with wallet signature (legacy)
 */
export function createAuthenticatedSession(
  handle: string,
  signature: WalletSignature,
  autoLogoutMinutes: number = 30,
  walletData?: any
): void {
  const sessionData = {
    handle,
    walletId: `wallet_${handle}_${Date.now()}`,
    sessionToken: crypto.randomUUID(),
    linkedWalletAddress: signature.address,
    linkedWalletChain: signature.chain,
    loginTime: new Date().toISOString(),
    autoLogoutEnabled: autoLogoutMinutes > 0,
    autoLogoutMinutes,
    lastActivity: new Date().toISOString(),
    // Include wallet data if provided (for new wallet creation)
    walletData: walletData || null
  };


  // Store session with structure expected by WalletDashboard
  sessionStorage.setItem('riddle_wallet_session', JSON.stringify(sessionData));
  
  // Set auto-logout if enabled
  if (autoLogoutMinutes > 0) {
    setTimeout(() => {
      sessionStorage.removeItem('riddle_wallet_session');
      window.location.href = '/wallet-login';
    }, autoLogoutMinutes * 60 * 1000);
  }
}

// Type declarations for wallet objects
// Global wallet type extensions
export interface ExtendedWindow extends Window {
  ethereum?: any;
  solana?: any;
  unisat?: any;
}

// Extend global Window interface
declare global {
  interface Window {
    ethereum?: any;
    solana?: any;
    unisat?: any;
  }
}
