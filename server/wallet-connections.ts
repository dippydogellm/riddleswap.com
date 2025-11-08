// Multi-Wallet Connection System for RiddleSwap NFT Marketplace
// Supports Riddle Wallet, Joey Wallet, Xaman Wallet, and new wallet creation

import { Wallet } from 'xrpl';
import crypto from 'crypto';

export interface WalletConnection {
  type: 'riddle' | 'joey' | 'xaman' | 'generated';
  address: string;
  publicKey?: string;
  nickname?: string;
  isConnected: boolean;
  balance?: string;
}

export interface WalletCredentials {
  address: string;
  secret: string;
  publicKey: string;
  privateKey: string;
  mnemonic?: string;
}

export class MultiWalletManager {
  private connectedWallets: Map<string, WalletConnection> = new Map();
  private walletSecrets: Map<string, string> = new Map(); // Encrypted storage

  constructor(private encryptionKey: string) {
    console.log('🔐 MultiWalletManager initialized with encryption');
  }

  // Connect Riddle Wallet
  async connectRiddleWallet(
    address: string,
    secret: string,
    nickname?: string
  ): Promise<WalletConnection> {
    try {
      // Validate wallet credentials
      const wallet = Wallet.fromSeed(secret);
      if (wallet.classicAddress !== address) {
        throw new Error('Address does not match secret');
      }

      const connection: WalletConnection = {
        type: 'riddle',
        address,
        nickname: nickname || 'Riddle Wallet',
        isConnected: true
      };

      // Store encrypted secret
      const encryptedSecret = this.encrypt(secret);
      this.walletSecrets.set(address, encryptedSecret);
      this.connectedWallets.set(address, connection);

      console.log(`✅ Riddle Wallet connected: ${address}`);
      return connection;
    } catch (error) {
      console.error('❌ Failed to connect Riddle Wallet:', error);
      throw error;
    }
  }

  // Connect Joey Wallet
  async connectJoeyWallet(
    address: string,
    secret: string,
    nickname?: string
  ): Promise<WalletConnection> {
    try {
      const wallet = Wallet.fromSeed(secret);
      if (wallet.classicAddress !== address) {
        throw new Error('Address does not match secret');
      }

      const connection: WalletConnection = {
        type: 'joey',
        address,
        nickname: nickname || 'Joey Wallet',
        isConnected: true
      };

      const encryptedSecret = this.encrypt(secret);
      this.walletSecrets.set(address, encryptedSecret);
      this.connectedWallets.set(address, connection);

      console.log(`✅ Joey Wallet connected: ${address}`);
      return connection;
    } catch (error) {
      console.error('❌ Failed to connect Joey Wallet:', error);
      throw error;
    }
  }

  // Connect Xaman Wallet (usually external connection)
  async connectXamanWallet(
    address: string,
    publicKey?: string,
    nickname?: string
  ): Promise<WalletConnection> {
    try {
      const connection: WalletConnection = {
        type: 'xaman',
        address,
        publicKey,
        nickname: nickname || 'Xaman Wallet',
        isConnected: true
      };

      this.connectedWallets.set(address, connection);

      console.log(`✅ Xaman Wallet connected: ${address}`);
      return connection;
    } catch (error) {
      console.error('❌ Failed to connect Xaman Wallet:', error);
      throw error;
    }
  }

  // Generate new wallet
  async generateNewWallet(nickname?: string): Promise<WalletCredentials> {
    try {
      const wallet = Wallet.generate();
      
      const credentials: WalletCredentials = {
        address: wallet.classicAddress,
        secret: wallet.seed!,
        publicKey: wallet.publicKey,
        privateKey: wallet.privateKey
      };

      const connection: WalletConnection = {
        type: 'generated',
        address: credentials.address,
        publicKey: credentials.publicKey,
        nickname: nickname || 'Generated Wallet',
        isConnected: true
      };

      // Store encrypted secret
      const encryptedSecret = this.encrypt(credentials.secret);
      this.walletSecrets.set(credentials.address, encryptedSecret);
      this.connectedWallets.set(credentials.address, connection);

      console.log(`✅ New wallet generated: ${credentials.address}`);
      console.log(`🔑 Secret: ${credentials.secret}`);
      console.log(`🔐 IMPORTANT: Save your secret key securely!`);

      return credentials;
    } catch (error) {
      console.error('❌ Failed to generate new wallet:', error);
      throw error;
    }
  }

  // Get wallet secret (decrypted)
  getWalletSecret(address: string): string | null {
    const encryptedSecret = this.walletSecrets.get(address);
    if (!encryptedSecret) {
      return null;
    }
    return this.decrypt(encryptedSecret);
  }

  // Get all connected wallets
  getConnectedWallets(): WalletConnection[] {
    return Array.from(this.connectedWallets.values());
  }

  // Get specific wallet
  getWallet(address: string): WalletConnection | null {
    return this.connectedWallets.get(address) || null;
  }

  // Disconnect wallet
  disconnectWallet(address: string): boolean {
    const wallet = this.connectedWallets.get(address);
    if (wallet) {
      wallet.isConnected = false;
      this.walletSecrets.delete(address);
      this.connectedWallets.delete(address);
      console.log(`🔌 Wallet disconnected: ${address}`);
      return true;
    }
    return false;
  }

  // Update wallet balance
  updateWalletBalance(address: string, balance: string): void {
    const wallet = this.connectedWallets.get(address);
    if (wallet) {
      wallet.balance = balance;
    }
  }

  // Validate wallet address
  static isValidXRPLAddress(address: string): boolean {
    return /^r[a-zA-Z0-9]{24,34}$/.test(address);
  }

  // Encrypt secret
  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  // Decrypt secret
  private decrypt(encryptedText: string): string {
    const [ivHex, encrypted] = encryptedText.split(':');
    const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  // Get wallet statistics
  getWalletStats(): {
    totalWallets: number;
    connectedWallets: number;
    walletTypes: { [key: string]: number };
  } {
    const wallets = this.getConnectedWallets();
    const types: { [key: string]: number } = {};
    
    wallets.forEach(wallet => {
      types[wallet.type] = (types[wallet.type] || 0) + 1;
    });

    return {
      totalWallets: wallets.length,
      connectedWallets: wallets.filter(w => w.isConnected).length,
      walletTypes: types
    };
  }
}

// Singleton wallet manager
let walletManagerInstance: MultiWalletManager | null = null;

export function createWalletManager(encryptionKey: string): MultiWalletManager {
  if (!walletManagerInstance) {
    walletManagerInstance = new MultiWalletManager(encryptionKey);
  }
  return walletManagerInstance;
}

export function getWalletManager(): MultiWalletManager | null {
  return walletManagerInstance;
}

// Wallet connection utilities
export function formatWalletAddress(address: string): string {
  return `${address.slice(0, 8)}...${address.slice(-8)}`;
}

export function getWalletTypeIcon(type: string): string {
  const icons = {
    riddle: '🧩',
    joey: '🦘', 
    xaman: '🔺',
    generated: '⚡'
  };
  return icons[type as keyof typeof icons] || '💰';
}