// Simple Wallet Management System
// Two connection options: Reown (EVM/Solana) and Xaman (XRPL)

export type ChainType = 'xrpl' | 'ethereum' | 'solana' | 'evm' | 'bitcoin'
export type WalletType = 'reown' | 'xaman'

export interface WalletState {
  address: string
  chainType: ChainType
  walletType: WalletType
  isConnected: boolean
  chainId?: string
}

// Storage keys
const STORAGE_KEYS = {
  xrpl: 'wallet_xrpl',
  ethereum: 'wallet_ethereum', 
  solana: 'wallet_solana',
  evm: 'wallet_ethereum', // EVM uses ethereum storage
  bitcoin: 'wallet_bitcoin'
}

// Get wallet state from localStorage
export function getWallet(chainType: ChainType): WalletState | null {
  if (typeof window === 'undefined') return null
  
  try {
    // Check for Xaman wallet connection first (newer format)
    if (chainType === 'xrpl') {
      const isXamanConnected = localStorage.getItem('xrpl_wallet_connected') === 'true';
      const xamanAddress = localStorage.getItem('xrpl_wallet_address');
      
      if (isXamanConnected && xamanAddress) {
        return {
          address: xamanAddress,
          chainType: 'xrpl',
          walletType: 'xaman',
          isConnected: true
        };
      }
    }
    
    // Fallback to old format
    const stored = localStorage.getItem(STORAGE_KEYS[chainType])
    if (!stored) return null
    
    const wallet = JSON.parse(stored)
    return wallet.isConnected ? wallet : null
  } catch {
    return null
  }
}

// Save wallet state to localStorage
export function saveWallet(wallet: WalletState): void {
  if (typeof window === 'undefined') return
  
  localStorage.setItem(STORAGE_KEYS[wallet.chainType], JSON.stringify(wallet))

}

// Global state for universal wallet management
let selectedWallet: WalletState | null = null;
let walletSubscribers: ((wallets: Record<ChainType, WalletState | null>) => void)[] = [];

// Get all wallets for all chains
export function getAllWallets(): Record<ChainType, WalletState | null> {
  return {
    xrpl: getWallet('xrpl'),
    ethereum: getWallet('ethereum'),
    solana: getWallet('solana'),
    evm: getWallet('evm'),
    bitcoin: getWallet('bitcoin')
  };
}

// Remove wallet state from localStorage
export function removeWallet(chainType: ChainType): void {
  if (typeof window === 'undefined') return;
  
  localStorage.removeItem(STORAGE_KEYS[chainType]);
  
  // Also remove Xaman-specific storage for XRPL
  if (chainType === 'xrpl') {
    localStorage.removeItem('xrpl_wallet_connected');
    localStorage.removeItem('xrpl_wallet_address');
  }
}

// Get wallet for specific chain (bridge compatibility)
export function getWalletForChain(chainType: ChainType): WalletState | null {
  // Map 'evm' to 'ethereum' for compatibility
  const actualChainType = chainType === 'evm' ? 'ethereum' : chainType;
  const wallet = getWallet(actualChainType as ChainType);
  
  if (wallet && chainType === 'evm') {
    // Return with evm chainType for compatibility
    return { ...wallet, chainType: 'evm' };
  }
  
  return wallet;
}

// Get currently selected wallet
export function getSelectedWallet(): WalletState | null {
  return selectedWallet;
}

// Set selected wallet
export function setSelectedWallet(wallet: WalletState | null): void {
  selectedWallet = wallet;

  // Notify subscribers
  const allWallets = getAllWallets();
  walletSubscribers.forEach(callback => callback(allWallets));
}

// Subscribe to wallet changes
export function subscribeToWalletChanges(callback: (wallets: Record<ChainType, WalletState | null>) => void): () => void {
  walletSubscribers.push(callback);
  
  // Listen for storage events
  const handleStorageChange = () => {
    const allWallets = getAllWallets();
    callback(allWallets);
  };
  
  window.addEventListener('wallet-updated', handleStorageChange);
  
  return () => {
    // Remove from subscribers
    const index = walletSubscribers.indexOf(callback);
    if (index > -1) {
      walletSubscribers.splice(index, 1);
    }
    
    // Remove event listener
    window.removeEventListener('wallet-updated', handleStorageChange);
  };
}

// Force clear all wallets (bridge compatibility)
export function forceClearAllWallets(): void {
  const chainTypes: ChainType[] = ['xrpl', 'ethereum', 'evm', 'solana', 'bitcoin'];
  chainTypes.forEach(chainType => {
    removeWallet(chainType);
  });
  setSelectedWallet(null);

}
