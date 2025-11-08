// EVM Wallet Connection Utilities for MetaMask and Phantom
import { ethers } from 'ethers';

export type EVMWalletType = 'riddle' | 'metamask' | 'phantom';

export interface EVMWalletConnection {
  type: EVMWalletType;
  address: string;
  provider: any;
  signer?: any;
}

declare global {
  interface Window {
    ethereum?: any;
    phantom?: {
      ethereum?: any;
    };
  }
}

// Check if MetaMask is installed
export function isMetaMaskInstalled(): boolean {
  return typeof window !== 'undefined' && Boolean(window.ethereum?.isMetaMask);
}

// Check if Phantom is installed
export function isPhantomInstalled(): boolean {
  return typeof window !== 'undefined' && Boolean(window.phantom?.ethereum);
}

// Connect to MetaMask
export async function connectMetaMask(chainId?: number): Promise<EVMWalletConnection> {
  if (!isMetaMaskInstalled()) {
    throw new Error('MetaMask is not installed. Please install it from metamask.io');
  }

  try {
    const provider = new ethers.BrowserProvider(window.ethereum);
    
    // Request account access
    const accounts = await window.ethereum.request({ 
      method: 'eth_requestAccounts' 
    });
    
    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts found in MetaMask');
    }

    // Switch to requested chain if specified
    if (chainId) {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${chainId.toString(16)}` }],
        });
      } catch (switchError: any) {
        // Chain doesn't exist, try to add it
        if (switchError.code === 4902) {
          await addChainToMetaMask(chainId);
        } else {
          throw switchError;
        }
      }
    }

    const signer = await provider.getSigner();
    const address = accounts[0];

    // Store connection
    localStorage.setItem('evm_wallet_type', 'metamask');
    localStorage.setItem('evm_wallet_address', address);

    return {
      type: 'metamask',
      address,
      provider,
      signer
    };
  } catch (error) {
    console.error('MetaMask connection error:', error);
    throw error;
  }
}

// Connect to Phantom (EVM mode)
export async function connectPhantom(chainId?: number): Promise<EVMWalletConnection> {
  if (!isPhantomInstalled()) {
    throw new Error('Phantom is not installed. Please install it from phantom.app');
  }

  try {
    const phantomProvider = window.phantom?.ethereum;
    if (!phantomProvider) {
      throw new Error('Phantom Ethereum provider not found');
    }

    const provider = new ethers.BrowserProvider(phantomProvider);
    
    // Request account access
    const accounts = await phantomProvider.request({ 
      method: 'eth_requestAccounts' 
    });
    
    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts found in Phantom');
    }

    // Switch to requested chain if specified
    if (chainId) {
      try {
        await phantomProvider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${chainId.toString(16)}` }],
        });
      } catch (switchError: any) {
        if (switchError.code === 4902) {
          await addChainToPhantom(chainId);
        } else {
          throw switchError;
        }
      }
    }

    const signer = await provider.getSigner();
    const address = accounts[0];

    // Store connection
    localStorage.setItem('evm_wallet_type', 'phantom');
    localStorage.setItem('evm_wallet_address', address);

    return {
      type: 'phantom',
      address,
      provider,
      signer
    };
  } catch (error) {
    console.error('Phantom connection error:', error);
    throw error;
  }
}

// Get stored wallet connection
export function getStoredEVMWallet(): { type: EVMWalletType; address: string } | null {
  const type = localStorage.getItem('evm_wallet_type') as EVMWalletType;
  const address = localStorage.getItem('evm_wallet_address');
  
  if (type && address) {
    return { type, address };
  }
  
  return null;
}

// Disconnect wallet
export function disconnectEVMWallet(): void {
  localStorage.removeItem('evm_wallet_type');
  localStorage.removeItem('evm_wallet_address');
}

// Helper: Add chain to MetaMask
async function addChainToMetaMask(chainId: number): Promise<void> {
  const chainData = getChainData(chainId);
  
  await window.ethereum.request({
    method: 'wallet_addEthereumChain',
    params: [chainData],
  });
}

// Helper: Add chain to Phantom
async function addChainToPhantom(chainId: number): Promise<void> {
  const chainData = getChainData(chainId);
  
  await window.phantom?.ethereum.request({
    method: 'wallet_addEthereumChain',
    params: [chainData],
  });
}

// Chain configuration data
function getChainData(chainId: number) {
  const chains: { [key: number]: any } = {
    1: {
      chainId: '0x1',
      chainName: 'Ethereum Mainnet',
      nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
      rpcUrls: ['https://eth.llamarpc.com'],
      blockExplorerUrls: ['https://etherscan.io']
    },
    8453: {
      chainId: '0x2105',
      chainName: 'Base',
      nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
      rpcUrls: ['https://base.llamarpc.com'],
      blockExplorerUrls: ['https://basescan.org']
    },
    137: {
      chainId: '0x89',
      chainName: 'Polygon',
      nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
      rpcUrls: ['https://polygon.llamarpc.com'],
      blockExplorerUrls: ['https://polygonscan.com']
    },
    42161: {
      chainId: '0xa4b1',
      chainName: 'Arbitrum One',
      nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
      rpcUrls: ['https://arbitrum.llamarpc.com'],
      blockExplorerUrls: ['https://arbiscan.io']
    },
    10: {
      chainId: '0xa',
      chainName: 'Optimism',
      nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
      rpcUrls: ['https://optimism.llamarpc.com'],
      blockExplorerUrls: ['https://optimistic.etherscan.io']
    },
    56: {
      chainId: '0x38',
      chainName: 'BNB Smart Chain',
      nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
      rpcUrls: ['https://bsc.llamarpc.com'],
      blockExplorerUrls: ['https://bscscan.com']
    },
    43114: {
      chainId: '0xa86a',
      chainName: 'Avalanche C-Chain',
      nativeCurrency: { name: 'AVAX', symbol: 'AVAX', decimals: 18 },
      rpcUrls: ['https://api.avax.network/ext/bc/C/rpc'],
      blockExplorerUrls: ['https://snowtrace.io']
    },
    250: {
      chainId: '0xfa',
      chainName: 'Fantom Opera',
      nativeCurrency: { name: 'FTM', symbol: 'FTM', decimals: 18 },
      rpcUrls: ['https://rpc.ftm.tools'],
      blockExplorerUrls: ['https://ftmscan.com']
    }
  };

  return chains[chainId] || chains[1];
}

// Get current connected account from wallet
export async function getCurrentAccount(walletType: EVMWalletType): Promise<string | null> {
  try {
    let provider: any;
    
    if (walletType === 'metamask') {
      if (!isMetaMaskInstalled()) return null;
      provider = window.ethereum;
    } else if (walletType === 'phantom') {
      if (!isPhantomInstalled()) return null;
      provider = window.phantom?.ethereum;
    } else {
      return null;
    }

    const accounts = await provider.request({ method: 'eth_accounts' });
    return accounts && accounts.length > 0 ? accounts[0] : null;
  } catch (error) {
    console.error('Error getting current account:', error);
    return null;
  }
}

// Listen for account changes
export function onAccountsChanged(callback: (accounts: string[]) => void, walletType: EVMWalletType): () => void {
  let provider: any;
  
  if (walletType === 'metamask' && window.ethereum) {
    provider = window.ethereum;
  } else if (walletType === 'phantom' && window.phantom?.ethereum) {
    provider = window.phantom.ethereum;
  }

  if (provider) {
    provider.on('accountsChanged', callback);
    
    return () => {
      provider.removeListener('accountsChanged', callback);
    };
  }

  return () => {};
}

// Listen for chain changes
export function onChainChanged(callback: (chainId: string) => void, walletType: EVMWalletType): () => void {
  let provider: any;
  
  if (walletType === 'metamask' && window.ethereum) {
    provider = window.ethereum;
  } else if (walletType === 'phantom' && window.phantom?.ethereum) {
    provider = window.phantom.ethereum;
  }

  if (provider) {
    provider.on('chainChanged', callback);
    
    return () => {
      provider.removeListener('chainChanged', callback);
    };
  }

  return () => {};
}
