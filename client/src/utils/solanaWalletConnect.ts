// Solana Wallet Connection Utilities for Phantom
import { Connection, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';

export type SolanaWalletType = 'riddle' | 'phantom';

export interface SolanaWalletConnection {
  type: SolanaWalletType;
  publicKey: PublicKey;
  signTransaction?: (transaction: Transaction | VersionedTransaction) => Promise<Transaction | VersionedTransaction>;
  signAllTransactions?: (transactions: (Transaction | VersionedTransaction)[]) => Promise<(Transaction | VersionedTransaction)[]>;
}

declare global {
  interface Window {
    solana?: {
      isPhantom?: boolean;
      connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: PublicKey }>;
      disconnect: () => Promise<void>;
      signTransaction: (transaction: Transaction | VersionedTransaction) => Promise<Transaction | VersionedTransaction>;
      signAllTransactions: (transactions: (Transaction | VersionedTransaction)[]) => Promise<(Transaction | VersionedTransaction)[]>;
      publicKey: PublicKey | null;
      on: (event: string, callback: (...args: any[]) => void) => void;
      off: (event: string, callback: (...args: any[]) => void) => void;
    };
    phantom?: {
      solana?: any;
    };
  }
}

// Check if Phantom wallet is installed
export function isPhantomInstalled(): boolean {
  return typeof window !== 'undefined' && (Boolean(window.solana?.isPhantom) || Boolean(window.phantom?.solana));
}

// Get Phantom provider
function getPhantomProvider() {
  if (window.solana?.isPhantom) {
    return window.solana;
  }
  if (window.phantom?.solana) {
    return window.phantom.solana;
  }
  return null;
}

// Connect to Phantom wallet
export async function connectPhantom(): Promise<SolanaWalletConnection> {
  if (!isPhantomInstalled()) {
    throw new Error('Phantom wallet is not installed. Please install it from phantom.app');
  }

  try {
    const provider = getPhantomProvider();
    if (!provider) {
      throw new Error('Phantom provider not found');
    }

    // Request connection
    const response = await provider.connect();
    
    if (!response.publicKey) {
      throw new Error('Failed to get Phantom public key');
    }

    const publicKey = response.publicKey;

    // Store connection
    localStorage.setItem('solana_wallet_type', 'phantom');
    localStorage.setItem('solana_wallet_address', publicKey.toString());

    console.log('✅ Phantom connected:', publicKey.toString());

    return {
      type: 'phantom',
      publicKey,
      signTransaction: provider.signTransaction?.bind(provider),
      signAllTransactions: provider.signAllTransactions?.bind(provider)
    };
  } catch (error) {
    console.error('Phantom connection error:', error);
    throw error;
  }
}

// Disconnect Phantom wallet
export async function disconnectPhantom(): Promise<void> {
  try {
    const provider = getPhantomProvider();
    if (provider) {
      await provider.disconnect();
    }
    localStorage.removeItem('solana_wallet_type');
    localStorage.removeItem('solana_wallet_address');
    console.log('✅ Phantom disconnected');
  } catch (error) {
    console.error('Phantom disconnect error:', error);
    throw error;
  }
}

// Get stored Solana wallet connection
export function getStoredSolanaWallet(): { type: SolanaWalletType; address: string } | null {
  const type = localStorage.getItem('solana_wallet_type') as SolanaWalletType;
  const address = localStorage.getItem('solana_wallet_address');
  
  if (type && address) {
    return { type, address };
  }
  
  return null;
}

// Check if Phantom is connected
export function isPhantomConnected(): boolean {
  const provider = getPhantomProvider();
  return Boolean(provider?.publicKey);
}

// Get current Phantom public key
export function getPhantomPublicKey(): PublicKey | null {
  const provider = getPhantomProvider();
  return provider?.publicKey || null;
}

// Sign and send transaction with Phantom
export async function signAndSendTransactionPhantom(
  transaction: Transaction | VersionedTransaction,
  connection: Connection
): Promise<string> {
  const provider = getPhantomProvider();
  if (!provider) {
    throw new Error('Phantom not connected');
  }

  try {
    // Sign transaction
    const signedTransaction = await provider.signTransaction(transaction);
    
    // Send signed transaction
    const signature = await connection.sendRawTransaction(
      (signedTransaction as any).serialize()
    );

    console.log('✅ Transaction sent:', signature);
    return signature;
  } catch (error) {
    console.error('Transaction error:', error);
    throw error;
  }
}

// Listen for account changes
export function onPhantomAccountChanged(callback: (publicKey: PublicKey | null) => void): () => void {
  const provider = getPhantomProvider();
  
  if (provider) {
    const handler = (publicKey: PublicKey | null) => {
      console.log('Phantom account changed:', publicKey?.toString());
      callback(publicKey);
      
      // Update stored address
      if (publicKey) {
        localStorage.setItem('solana_wallet_address', publicKey.toString());
      } else {
        localStorage.removeItem('solana_wallet_address');
      }
    };

    provider.on('accountChanged', handler);
    
    return () => {
      provider.off('accountChanged', handler);
    };
  }

  return () => {};
}

// Listen for disconnect
export function onPhantomDisconnect(callback: () => void): () => void {
  const provider = getPhantomProvider();
  
  if (provider) {
    const handler = () => {
      console.log('Phantom disconnected');
      callback();
      localStorage.removeItem('solana_wallet_type');
      localStorage.removeItem('solana_wallet_address');
    };

    provider.on('disconnect', handler);
    
    return () => {
      provider.off('disconnect', handler);
    };
  }

  return () => {};
}

// Auto-connect if previously connected
export async function autoConnectPhantom(): Promise<SolanaWalletConnection | null> {
  if (!isPhantomInstalled()) {
    return null;
  }

  try {
    const provider = getPhantomProvider();
    if (!provider) {
      return null;
    }

    // Try to connect silently
    const response = await provider.connect({ onlyIfTrusted: true });
    
    if (response.publicKey) {
      console.log('✅ Phantom auto-connected:', response.publicKey.toString());
      
      localStorage.setItem('solana_wallet_type', 'phantom');
      localStorage.setItem('solana_wallet_address', response.publicKey.toString());

      return {
        type: 'phantom',
        publicKey: response.publicKey,
        signTransaction: provider.signTransaction?.bind(provider),
        signAllTransactions: provider.signAllTransactions?.bind(provider)
      };
    }
  } catch (error) {
    // Silent failure for auto-connect
    console.log('Phantom auto-connect failed (expected if not previously approved)');
  }

  return null;
}
