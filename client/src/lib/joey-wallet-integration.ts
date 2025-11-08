// Joey Wallet Integration for XRPL with WalletConnect v2
// Based on Joey Wallet documentation: https://docs.joeywallet.xyz/

import SignClient from '@walletconnect/sign-client';
import { getSdkError } from '@walletconnect/utils';
import QRCode from 'qrcode';

interface JoeyWalletConnection {
  address: string;
  publicKey: string;
  isConnected: boolean;
}

interface JoeyWalletAPI {
  connect(): Promise<JoeyWalletConnection>;
  disconnect(): Promise<void>;
  signTransaction(transaction: any): Promise<string>;
  getAccount(): Promise<{ address: string; balance: string }>;
}

declare global {
  interface Window {
    joey?: JoeyWalletAPI;
  }
}

export class JoeyWalletConnector {
  private isConnected: boolean = false;
  private account: string | null = null;
  private signClient: SignClient | null = null;
  private session: any = null;
  private isInitializing: boolean = false;

  constructor() {
    this.checkJoeyWalletAvailability();
  }

  // Check if Joey Wallet is installed and available
  private checkJoeyWalletAvailability(): boolean {
    if (typeof window !== 'undefined' && window.joey) {
      console.log('🟢 Joey Wallet detected');
      return true;
    }
    
    console.log('🟡 Joey Wallet not detected - will use WalletConnect v2');
    return false;
  }

  // Initialize WalletConnect v2 SignClient
  private async initializeSignClient(): Promise<SignClient | null> {
    if (this.signClient) {
      return this.signClient;
    }

    if (this.isInitializing) {
      // Wait for initialization to complete
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (!this.isInitializing) {
            clearInterval(checkInterval);
            resolve(this.signClient);
          }
        }, 100);
      });
    }

    this.isInitializing = true;

    try {
  const { getWalletConnectProjectId } = await import('@/lib/wallet-env');
  const projectId = getWalletConnectProjectId();
      
      this.signClient = await SignClient.init({
        projectId: projectId,
        relayUrl: 'wss://relay.walletconnect.com',
        metadata: {
          name: 'RiddleSwap',
          description: 'Multi-chain DEX and DeFi platform',
          url: window.location.origin,
          icons: [`${window.location.origin}/icon.png`]
        }
      });

      console.log('✅ WalletConnect v2 SignClient initialized');
      
      // Set up event listeners
      this.signClient.on('session_event', (args) => {
        console.log('📱 Session event:', args);
      });

      this.signClient.on('session_update', ({ topic, params }) => {
        console.log('📱 Session update:', { topic, params });
        const { namespaces } = params;
        const session = this.signClient?.session.get(topic);
        if (session) {
          this.session = { ...session, namespaces };
        }
      });

      this.signClient.on('session_delete', () => {
        console.log('📱 Session deleted');
        this.reset();
      });

      this.isInitializing = false;
      return this.signClient;
    } catch (error) {
      console.error('❌ Failed to initialize SignClient:', error);
      this.isInitializing = false;
      return null;
    }
  }

  // Connect to Joey Wallet
  async connect(): Promise<JoeyWalletConnection | null> {
    try {
      if (window.joey) {
        // Direct Joey Wallet connection
        const connection = await window.joey.connect();
        this.isConnected = true;
        this.account = connection.address;
        
        console.log('✅ Joey Wallet connected:', connection.address);
        return connection;
      } else {
        // Use WalletConnect v2 protocol
        return await this.connectViaWalletConnectV2();
      }
    } catch (error) {
      console.error('❌ Joey Wallet connection failed:', error);
      throw error;
    }
  }

  // Connect via WalletConnect v2 protocol
  private async connectViaWalletConnectV2(): Promise<JoeyWalletConnection | null> {
    try {
      console.log('🔗 Using WalletConnect v2 for Joey Wallet connection');
      
      // Initialize SignClient if needed
      const client = await this.initializeSignClient();
      if (!client) {
        throw new Error('Failed to initialize WalletConnect SignClient');
      }

      // Create connection with proper namespaces for XRPL
      const { uri, approval } = await client.connect({
        requiredNamespaces: {
          xrpl: {
            methods: [
              'xrpl_signTransaction',
              'xrpl_signMessage',
              'xrpl_getAccount'
            ],
            chains: ['xrpl:1'], // XRPL mainnet
            events: ['accountsChanged', 'chainChanged']
          }
        },
        optionalNamespaces: {
          xrpl: {
            methods: [
              'xrpl_signTransaction',
              'xrpl_signMessage',
              'xrpl_getAccount'
            ],
            chains: ['xrpl:0', 'xrpl:2'], // Also support testnet and devnet
            events: ['accountsChanged', 'chainChanged']
          }
        }
      });

      console.log('📱 WalletConnect v2 URI created:', uri);

      // Generate QR code
      const qrCodeUrl = await QRCode.toDataURL(uri || '', {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      // Emit event for UI components to display QR code
      window.dispatchEvent(new CustomEvent('joey-walletconnect-qr-ready', {
        detail: {
          qrUrl: qrCodeUrl,
          uri: uri,
          deepLink: `https://joey.app/wc?uri=${encodeURIComponent(uri || '')}`
        }
      }));
      
      // For mobile devices, try to open Joey Wallet directly
      if (this.isMobile()) {
        const joeyDeepLink = `https://joey.app/wc?uri=${encodeURIComponent(uri || '')}`;
        window.open(joeyDeepLink, '_blank');
      }
      
      // Wait for session approval
      try {
        const session = await approval();
        this.session = session;
        
        console.log('✅ Session approved:', session);
        
        // Extract XRPL address from the session
        const xrplAccounts = session.namespaces.xrpl?.accounts || [];
        if (xrplAccounts.length > 0) {
          // Format: "xrpl:1:rAddress" - extract the address part
          const fullAccount = xrplAccounts[0];
          const address = fullAccount.split(':')[2] || fullAccount;
          
          this.isConnected = true;
          this.account = address;
          
          console.log('✅ Joey Wallet connected via WalletConnect v2:', address);
          
          return {
            address: address,
            publicKey: '',
            isConnected: true
          };
        } else {
          throw new Error('No XRPL accounts in session');
        }
      } catch (error) {
        console.error('❌ Session approval failed:', error);
        throw error;
      }
    } catch (error) {
      console.error('❌ WalletConnect v2 connection failed:', error);
      return null;
    }
  }

  // Generate WalletConnect URI - DEPRECATED (keeping for backward compatibility)
  private generateWCURI(): string {
    console.warn('⚠️ generateWCURI is deprecated - use WalletConnect v2 SignClient instead');
    const sessionId = this.generateRandomKey();
    const bridge = 'https://bridge.walletconnect.org';
    const key = this.generateRandomKey();
    return `wc:${sessionId}@1?bridge=${encodeURIComponent(bridge)}&key=${key}`;
  }

  // Wait for WalletConnect response - DEPRECATED (keeping for backward compatibility)
  private async waitForWalletConnectResponse(): Promise<JoeyWalletConnection | null> {
    console.warn('⚠️ waitForWalletConnectResponse is deprecated - use WalletConnect v2 SignClient instead');
    return null;
  }

  // Disconnect from Joey Wallet
  async disconnect(): Promise<void> {
    try {
      if (window.joey) {
        await window.joey.disconnect();
      } else if (this.signClient && this.session) {
        // Disconnect WalletConnect v2 session
        await this.signClient.disconnect({
          topic: this.session.topic,
          reason: getSdkError('USER_DISCONNECTED')
        });
      }
      
      this.reset();
      console.log('✅ Joey Wallet disconnected');
    } catch (error) {
      console.error('❌ Joey Wallet disconnect failed:', error);
    }
  }

  // Reset connection state
  private reset(): void {
    this.isConnected = false;
    this.account = null;
    this.session = null;
  }

  // Sign transaction with Joey Wallet
  async signTransaction(transaction: any): Promise<string> {
    if (!this.isConnected) {
      throw new Error('Joey Wallet not connected');
    }

    try {
      if (window.joey) {
        return await window.joey.signTransaction(transaction);
      } else if (this.signClient && this.session) {
        // Sign via WalletConnect v2
        return await this.signViaWalletConnectV2(transaction);
      } else {
        throw new Error('No valid connection method available');
      }
    } catch (error) {
      console.error('❌ Transaction signing failed:', error);
      throw error;
    }
  }

  // Sign transaction via WalletConnect v2
  private async signViaWalletConnectV2(transaction: any): Promise<string> {
    if (!this.signClient || !this.session) {
      throw new Error('WalletConnect session not established');
    }

    try {
      console.log('📝 Sending transaction to Joey Wallet via WalletConnect v2:', transaction);
      
      const result = await this.signClient.request({
        topic: this.session.topic,
        chainId: 'xrpl:1', // XRPL mainnet
        request: {
          method: 'xrpl_signTransaction',
          params: {
            transaction: transaction
          }
        }
      });

      console.log('✅ Transaction signed:', result);
      return result as string;
    } catch (error) {
      console.error('❌ WalletConnect v2 signing failed:', error);
      throw error;
    }
  }

  // Get account info from Joey Wallet
  async getAccount(): Promise<{ address: string; balance: string } | null> {
    if (!this.isConnected) {
      return null;
    }

    try {
      if (window.joey) {
        return await window.joey.getAccount();
      } else if (this.signClient && this.session) {
        // Get account info via WalletConnect v2
        try {
          const result = await this.signClient.request({
            topic: this.session.topic,
            chainId: 'xrpl:1',
            request: {
              method: 'xrpl_getAccount',
              params: {}
            }
          });
          
          return result as { address: string; balance: string };
        } catch (error) {
          // Fallback to stored address if method not supported
          console.warn('xrpl_getAccount not supported, using stored address');
          return {
            address: this.account || '',
            balance: '0.000000'
          };
        }
      } else {
        return {
          address: this.account || '',
          balance: '0.000000'
        };
      }
    } catch (error) {
      console.error('❌ Failed to get account info:', error);
      return null;
    }
  }

  // Utility functions
  private isMobile(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  private generateRandomKey(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
  
  // Create QR code - Updated for WalletConnect v2
  private async createQRCode(uri: string): Promise<string> {
    try {
      return await QRCode.toDataURL(uri, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
    } catch (error) {
      console.error('Failed to generate QR code:', error);
      // Fallback to external service
      const size = 200;
      return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(uri)}`;
    }
  }

  private showQRCode(uri: string): void {
    console.log('📱 Show QR code for Joey Wallet connection:', uri);
  }

  // Check connection status
  get connected(): boolean {
    return this.isConnected;
  }

  get walletAddress(): string | null {
    return this.account;
  }
}

// Export singleton instance
export const joeyWallet = new JoeyWalletConnector();

// Export utility functions for easy integration
export const connectJoeyWallet = () => joeyWallet.connect();
export const disconnectJoeyWallet = () => joeyWallet.disconnect();
export const isJoeyWalletConnected = () => joeyWallet.connected;
export const getJoeyWalletAddress = () => joeyWallet.walletAddress;
