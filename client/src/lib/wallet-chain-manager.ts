// Wallet-Chain Connection Manager
// Stores and manages individual wallet connections by wallet-chain combination

export interface WalletChainConnection {
  wallet: string; // metamask, phantom, xaman, etc.
  chain: string; // ETH, BSC, SOLANA, XRP, etc.
  address: string;
  connected: boolean;
  connectedAt: number;
}

interface ExternalWallet {
  id: number;
  wallet_type: string;
  address: string;
  chain: string;
  verified: boolean;
  connected_at: string;
  last_used: string;
}

export interface WalletChainState {
  [walletChain: string]: WalletChainConnection;
}

class WalletChainManager {
  private connections: WalletChainState = {};
  private storageKey = 'riddle_wallet_connections';

  constructor() {
    this.loadFromStorage();
  }

  // AUTHENTICATION BUG FIX: Check authentication dynamically instead of caching
  private isAuthenticated(): boolean {
    try {
      // Support both new standardized key and legacy key
      const sessionToken = localStorage.getItem('riddle_session_token') || 
                           localStorage.getItem('sessionToken');
      return !!sessionToken;
    } catch (error) {
      console.error('❌ Failed to check authentication:', error);
      return false;
    }
  }

  // Get session token with proper key priority
  private getSessionToken(): string | null {
    try {
      return localStorage.getItem('riddle_session_token') || 
             localStorage.getItem('sessionToken');
    } catch (error) {
      console.error('❌ Failed to get session token:', error);
      return null;
    }
  }

  // AUTHENTICATION BUG FIX: Make API request with proper authentication using updated token handling
  private async apiRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    try {
      const sessionToken = this.getSessionToken();
      if (!sessionToken) {
        throw new Error('No session token available');
      }

      const response = await fetch(endpoint, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
          ...options.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      return await response.json() as any;
    } catch (error) {
      console.error('❌ API request failed:', error);
      throw error;
    }
  }

  // AUTHENTICATION BUG FIX: Load external wallets from database with dynamic authentication check
  private async loadFromDatabase(): Promise<void> {
    if (!this.isAuthenticated()) {
      console.log('🔒 WalletChainManager: Not authenticated, skipping database load');
      return;
    }

    try {
      const data = await this.apiRequest('/api/external-wallets/list');
      if (data?.wallets?.length) {
        data.wallets.forEach((wallet: ExternalWallet) => {
          if (wallet.verified) {
            const key = this.getWalletChainKey(wallet.wallet_type, wallet.chain);
            this.connections[key] = {
              wallet: wallet.wallet_type,
              chain: wallet.chain,
              address: wallet.address,
              connected: true,
              connectedAt: new Date(wallet.connected_at).getTime(),
            };
          }
        });
        this.saveToStorage();
        console.log(`🔄 Loaded ${data.wallets.length} external wallets from database`);
      }
    } catch (error) {
      console.error('❌ Failed to load external wallets:', error);
    }
  }

  // AUTHENTICATION BUG FIX: Save wallet connection to database with dynamic authentication check
  private async saveToDatabase(wallet: string, chain: string, address: string): Promise<void> {
    if (!this.isAuthenticated()) {
      console.log('🔒 WalletChainManager: Not authenticated, skipping database save');
      return; // Don't throw - allow local storage to work for unauthenticated users
    }

    console.log(`💾 Saving to database: ${wallet} on ${chain} with address ${address}`);
    
    try {
      
      // SECURITY FIX: Default to unverified unless we have actual signature verification
      // This connects to the fixed external-wallet-routes.ts endpoint
      await this.apiRequest('/api/external-wallets/connect', {
        method: 'POST',
        body: JSON.stringify({
          wallet_type: wallet,
          chain: chain,
          address: address,
          verified: false // SECURITY: Default to unverified, require separate verification
        })
      });
      
      console.log(`✅ Successfully saved ${wallet} wallet to database (unverified)`);
    } catch (error) {
      console.error('❌ Failed to save to database:', error);
      throw error;
    }
  }

  // AUTHENTICATION BUG FIX: Remove wallet connection from database with dynamic authentication check
  private async removeFromDatabase(wallet: string, chain: string, address: string): Promise<void> {
    if (!this.isAuthenticated()) {
      console.log('🔒 WalletChainManager: Not authenticated, skipping database remove');
      return;
    }

    try {
      const data = await this.apiRequest('/api/external-wallets/list');
      const dbWallet = data?.wallets?.find((w: ExternalWallet) => 
        w.wallet_type === wallet && 
        w.chain === chain && 
        w.address.toLowerCase() === address.toLowerCase()
      );

      if (dbWallet) {
        await this.apiRequest(`/api/external-wallets/${dbWallet.id}`, {
          method: 'DELETE',
        });
        console.log(`🗑️ Removed from database: ${wallet} on ${chain}`);
      }
    } catch (error) {
      console.error('❌ Failed to remove from database:', error);
    }
  }

  // Generate unique key for wallet-chain combination
  private getWalletChainKey(wallet: string, chain: string): string {
    return `${wallet}-${chain}`;
  }

  // Load connections from localStorage
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        this.connections = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load wallet connections:', error);
      this.connections = {};
    }
  }

  // Save connections to localStorage
  private saveToStorage(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.connections));
    } catch (error) {
      console.error('Failed to save wallet connections:', error);
    }
  }

  // Connect a wallet to a specific chain
  connect(wallet: string, chain: string, address: string): void {
    const key = this.getWalletChainKey(wallet, chain);
    this.connections[key] = {
      wallet,
      chain,
      address,
      connected: true,
      connectedAt: Date.now(),
    };
    this.saveToStorage();
    
    // Sync to database if authenticated
    this.saveToDatabase(wallet, chain, address).catch(error => {
      console.warn('Failed to sync connection to database:', error);
    });
    
    console.log(`✅ Connected ${wallet} to ${chain}: ${address}`);
  }

  // Disconnect a wallet from a specific chain
  disconnect(wallet: string, chain: string): void {
    const key = this.getWalletChainKey(wallet, chain);
    if (this.connections[key]) {
      const address = this.connections[key].address;
      this.connections[key].connected = false;
      this.saveToStorage();
      
      // Remove from database if authenticated
      this.removeFromDatabase(wallet, chain, address).catch(error => {
        console.warn('Failed to remove connection from database:', error);
      });
      
      console.log(`❌ Disconnected ${wallet} from ${chain}`);
    }
  }

  // Check if wallet is connected to a chain
  isConnected(wallet: string, chain: string): boolean {
    const key = this.getWalletChainKey(wallet, chain);
    return this.connections[key]?.connected || false;
  }

  // Get address for wallet-chain combination
  getAddress(wallet: string, chain: string): string | null {
    const key = this.getWalletChainKey(wallet, chain);
    const connection = this.connections[key];
    return connection?.connected ? connection.address : null;
  }

  // Get all connections for a wallet
  getWalletConnections(wallet: string): WalletChainConnection[] {
    return Object.values(this.connections).filter(
      conn => conn.wallet === wallet && conn.connected
    );
  }

  // Get all connections for a chain
  getChainConnections(chain: string): WalletChainConnection[] {
    return Object.values(this.connections).filter(
      conn => conn.chain === chain && conn.connected
    );
  }

  // Get all active connections
  getAllConnections(): WalletChainConnection[] {
    return Object.values(this.connections).filter(conn => conn.connected);
  }

  // Clear all connections
  clearAll(): void {
    this.connections = {};
    this.saveToStorage();
    console.log('🧹 Cleared all wallet connections');
  }

  // Get connection summary for UI
  getConnectionSummary(): {
    totalConnections: number;
    wallets: string[];
    chains: string[];
  } {
    const activeConnections = this.getAllConnections();
    const wallets = Array.from(new Set(activeConnections.map(conn => conn.wallet)));
    const chains = Array.from(new Set(activeConnections.map(conn => conn.chain)));

    return {
      totalConnections: activeConnections.length,
      wallets,
      chains,
    };
  }

  // AUTHENTICATION BUG FIX: Public method to sync with database (call after login)
  async syncWithDatabase(): Promise<void> {
    if (this.isAuthenticated()) {
      await this.loadFromDatabase();
    } else {
      console.log('🔒 WalletChainManager: Cannot sync - not authenticated');
    }
  }

  // Public method to clear connections (call on logout)
  clearConnectionsAndDatabase(): void {
    this.clearAll();
    console.log('🧹 WalletChainManager: Cleared all connections and database state');
  }
}

// Export singleton instance
export const walletChainManager = new WalletChainManager();
export default walletChainManager;
