/**
 * WalletOrchestrator - Unified wallet management system supporting 100+ concurrent connections
 * Manages Riddle wallet (primary) and external wallets (MetaMask, Phantom, Xaman, WalletConnect, etc.)
 */

import { sessionManager } from '@/utils/sessionManager';

// Chain types supported by the orchestrator
export type ChainType = 'xrpl' | 'evm' | 'solana' | 'bitcoin';
export type WalletType = 
  | 'riddle'        // Primary Riddle wallet
  | 'xaman'         // XRPL: Xaman
  | 'metamask'      // EVM: MetaMask
  | 'phantom'       // Solana: Phantom
  | 'walletconnect' // Multi-chain: WalletConnect
  | 'reown'         // Multi-chain: Reown AppKit
  | 'coinbase'      // Multi-chain: Coinbase Wallet
  | 'trust'         // Multi-chain: Trust Wallet
  | 'ledger'        // Hardware: Ledger
  | 'trezor'        // Hardware: Trezor
  | 'external';     // Generic external wallet

// Wallet connection interface
export interface WalletConnection {
  id: string;                    // Unique connection ID (e.g., "riddle-main", "metamask-0x123...")
  chain: ChainType;              // Blockchain network
  address: string;               // Wallet address
  walletType: WalletType;        // Type of wallet
  connectedAt: string;           // ISO timestamp of connection
  balance?: string;              // Current balance (optional)
  chainId?: string | number;     // Network chain ID (for EVM)
  label?: string;                // User-friendly label
  isPrimary?: boolean;           // Is this the primary (Riddle) wallet?
  isActive?: boolean;            // Is this the active wallet for its chain?
  metadata?: Record<string, any>; // Additional wallet-specific data
}

// Legacy wallet state interface (for backward compatibility)
export interface WalletState {
  isConnected: boolean;
  address: string | null;
  chainId?: string | number;
  balance?: string;
  walletType?: WalletType;
  connectedAt?: string;
}

// Event types for wallet state changes
export type WalletEventType = 
  | 'wallet-connected'
  | 'wallet-disconnected'
  | 'wallet-updated'
  | 'active-wallet-changed'
  | 'balance-updated'
  | 'chain-switched';

export interface WalletEvent {
  type: WalletEventType;
  connectionId: string;
  chain: ChainType;
  data?: any;
}

// Event listener type
type WalletEventListener = (event: WalletEvent) => void;

/**
 * WalletOrchestrator - Core wallet management system
 */
class WalletOrchestrator {
  // Connection registry - supports 100+ wallets
  private connections: Map<string, WalletConnection> = new Map();
  
  // Active wallet per chain
  private activeWallets: Map<ChainType, string> = new Map();
  
  // Event listeners
  private eventListeners: Map<WalletEventType, Set<WalletEventListener>> = new Map();
  
  // Storage keys for persistence
  private readonly STORAGE_PREFIX = 'wallet_orchestrator_';
  private readonly CONNECTIONS_KEY = 'wallet_orchestrator_connections';
  private readonly ACTIVE_WALLETS_KEY = 'wallet_orchestrator_active';
  
  // Legacy storage keys for migration
  private readonly LEGACY_KEYS = {
    xrpl: 'xrpl_wallet_state',
    evm: 'evm_wallet_state',
    solana: 'solana_wallet_state',
    bitcoin: 'bitcoin_wallet_state'
  } as const;

  constructor() {
    // Initialize event listener maps
    const eventTypes: WalletEventType[] = [
      'wallet-connected', 
      'wallet-disconnected', 
      'wallet-updated',
      'active-wallet-changed', 
      'balance-updated', 
      'chain-switched'
    ];
    eventTypes.forEach(type => this.eventListeners.set(type, new Set()));
    
    // Load persisted state
    this.loadFromStorage();
    
    // Migrate legacy wallets
    this.migrateLegacyWallets();
    
    // Listen for storage changes (multi-tab sync)
    window.addEventListener('storage', this.handleStorageChange);
    
    // Subscribe to Riddle wallet session changes
    sessionManager.subscribe(() => this.syncRiddleWallet());
    
    // Initial Riddle wallet sync
    this.syncRiddleWallet();
    
    console.log('🎯 WalletOrchestrator initialized with', this.connections.size, 'connections');
  }

  /**
   * Connect a new wallet or update existing connection
   */
  public connectWallet(params: {
    address: string;
    chain: ChainType;
    walletType: WalletType;
    chainId?: string | number;
    balance?: string;
    label?: string;
    metadata?: Record<string, any>;
    setAsActive?: boolean;
  }): string {
    const connectionId = this.generateConnectionId(params.walletType, params.address);
    
    // Check if connection already exists
    const existing = this.connections.get(connectionId);
    if (existing) {
      // Update existing connection
      this.updateConnection(connectionId, {
        ...params,
        connectedAt: existing.connectedAt // Preserve original connection time
      });
      
      if (params.setAsActive) {
        this.setActiveWallet(params.chain, connectionId);
      }
      
      return connectionId;
    }
    
    // Create new connection
    const connection: WalletConnection = {
      id: connectionId,
      chain: params.chain,
      address: params.address,
      walletType: params.walletType,
      connectedAt: new Date().toISOString(),
      balance: params.balance,
      chainId: params.chainId,
      label: params.label || this.generateLabel(params.walletType, params.address),
      isPrimary: params.walletType === 'riddle',
      isActive: false,
      metadata: params.metadata || {}
    };
    
    // Add to registry
    this.connections.set(connectionId, connection);
    
    // Set as active if requested or if it's the first wallet for this chain
    if (params.setAsActive || !this.activeWallets.has(params.chain)) {
      this.setActiveWallet(params.chain, connectionId);
    }
    
    // Persist state
    this.saveToStorage();
    
    // Emit event
    this.emitEvent({
      type: 'wallet-connected',
      connectionId,
      chain: params.chain,
      data: connection
    });
    
    console.log(`✅ Connected wallet: ${connectionId} (${params.chain})`);
    return connectionId;
  }

  /**
   * Disconnect a wallet
   */
  public disconnectWallet(connectionId: string): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) return false;
    
    // Remove from registry
    this.connections.delete(connectionId);
    
    // If this was the active wallet, clear it
    if (this.activeWallets.get(connection.chain) === connectionId) {
      this.activeWallets.delete(connection.chain);
      
      // Try to set another wallet as active for this chain
      const alternativeWallet = Array.from(this.connections.values())
        .find(c => c.chain === connection.chain);
      
      if (alternativeWallet) {
        this.setActiveWallet(connection.chain, alternativeWallet.id);
      }
    }
    
    // Persist state
    this.saveToStorage();
    
    // Emit event
    this.emitEvent({
      type: 'wallet-disconnected',
      connectionId,
      chain: connection.chain,
      data: connection
    });
    
    console.log(`🔌 Disconnected wallet: ${connectionId}`);
    return true;
  }

  /**
   * Get the active wallet for a specific chain
   */
  public getActiveWallet(chain: ChainType): WalletConnection | null {
    const activeId = this.activeWallets.get(chain);
    if (!activeId) return null;
    
    return this.connections.get(activeId) || null;
  }

  /**
   * Set the active wallet for a chain
   */
  public setActiveWallet(chain: ChainType, connectionId: string): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.chain !== chain) return false;
    
    // Update active wallet mapping
    const previousActiveId = this.activeWallets.get(chain);
    this.activeWallets.set(chain, connectionId);
    
    // Update isActive flags
    this.connections.forEach(conn => {
      if (conn.chain === chain) {
        conn.isActive = conn.id === connectionId;
      }
    });
    
    // Persist state
    this.saveToStorage();
    
    // Emit event if changed
    if (previousActiveId !== connectionId) {
      this.emitEvent({
        type: 'active-wallet-changed',
        connectionId,
        chain,
        data: { previousActiveId, newActiveId: connectionId }
      });
    }
    
    console.log(`🎯 Set active wallet for ${chain}: ${connectionId}`);
    return true;
  }

  /**
   * Get all connected wallets
   */
  public getAllWallets(): WalletConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get wallets for a specific chain
   */
  public getWalletsForChain(chain: ChainType): WalletConnection[] {
    return Array.from(this.connections.values())
      .filter(w => w.chain === chain);
  }

  /**
   * Get the primary (Riddle) wallet
   */
  public getPrimaryWallet(): WalletConnection | null {
    return Array.from(this.connections.values())
      .find(w => w.isPrimary) || null;
  }

  /**
   * Update wallet balance
   */
  public updateBalance(connectionId: string, balance: string): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) return false;
    
    connection.balance = balance;
    this.saveToStorage();
    
    this.emitEvent({
      type: 'balance-updated',
      connectionId,
      chain: connection.chain,
      data: { balance }
    });
    
    return true;
  }

  /**
   * Update connection data
   */
  private updateConnection(connectionId: string, updates: Partial<WalletConnection>): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) return false;
    
    Object.assign(connection, updates);
    this.saveToStorage();
    
    this.emitEvent({
      type: 'wallet-updated',
      connectionId,
      chain: connection.chain,
      data: updates
    });
    
    return true;
  }

  /**
   * Subscribe to wallet events
   */
  public subscribe(eventType: WalletEventType, listener: WalletEventListener): () => void {
    const listeners = this.eventListeners.get(eventType);
    if (!listeners) {
      console.warn(`Unknown event type: ${eventType}`);
      return () => {};
    }
    
    listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      listeners.delete(listener);
    };
  }

  /**
   * Subscribe to all wallet changes (legacy compatibility)
   */
  public subscribeToWalletChanges(callback: (state: any) => void): () => void {
    // Create a wrapper that converts to legacy format
    const wrapper = () => {
      callback(this.getLegacyState());
    };
    
    // Subscribe to all relevant events
    const unsubscribers = [
      this.subscribe('wallet-connected', wrapper),
      this.subscribe('wallet-disconnected', wrapper),
      this.subscribe('active-wallet-changed', wrapper),
      this.subscribe('balance-updated', wrapper)
    ];
    
    // Return combined unsubscribe function
    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }

  /**
   * Emit an event to all listeners
   */
  private emitEvent(event: WalletEvent): void {
    const listeners = this.eventListeners.get(event.type);
    if (!listeners) return;
    
    listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error(`Error in wallet event listener:`, error);
      }
    });
  }

  /**
   * Generate a unique connection ID
   */
  private generateConnectionId(walletType: WalletType, address: string): string {
    if (walletType === 'riddle') {
      return 'riddle-primary'; // Riddle wallet always has the same ID
    }
    return `${walletType}-${address.toLowerCase().substring(0, 10)}`;
  }

  /**
   * Generate a user-friendly label
   */
  private generateLabel(walletType: WalletType, address: string): string {
    const shortAddress = `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    return `${walletType.charAt(0).toUpperCase() + walletType.slice(1)} (${shortAddress})`;
  }

  /**
   * Sync Riddle wallet from session manager
   */
  private syncRiddleWallet(): void {
    const session = sessionManager.getSession();
    
    if (session.isLoggedIn && session.walletAddresses) {
      const addresses = session.walletAddresses;
      
      // Connect all Riddle wallet chains
      const chains: Array<{ chain: ChainType; addressKey: string }> = [
        { chain: 'evm', addressKey: 'eth' },
        { chain: 'xrpl', addressKey: 'xrp' },
        { chain: 'solana', addressKey: 'sol' },
        { chain: 'bitcoin', addressKey: 'btc' }
      ];
      
      chains.forEach(({ chain, addressKey }) => {
        const address = addresses[addressKey];
        if (address) {
          this.connectWallet({
            address,
            chain,
            walletType: 'riddle',
            label: `@${session.handle || session.username} (${chain.toUpperCase()})`,
            setAsActive: true // Riddle wallet is always active when connected
          });
        }
      });
      
      console.log('🔗 Synced Riddle wallet from session');
    } else {
      // Remove Riddle wallet connections
      const riddleConnections = Array.from(this.connections.values())
        .filter(c => c.walletType === 'riddle');
      
      riddleConnections.forEach(c => {
        this.disconnectWallet(c.id);
      });
      
      if (riddleConnections.length > 0) {
        console.log('🔓 Removed Riddle wallet connections (logged out)');
      }
    }
  }

  /**
   * Save state to localStorage
   */
  private saveToStorage(): void {
    try {
      // Save connections
      const connectionsData = Array.from(this.connections.entries());
      localStorage.setItem(this.CONNECTIONS_KEY, JSON.stringify(connectionsData));
      
      // Save active wallets
      const activeData = Array.from(this.activeWallets.entries());
      localStorage.setItem(this.ACTIVE_WALLETS_KEY, JSON.stringify(activeData));
    } catch (error) {
      console.error('Failed to save wallet orchestrator state:', error);
    }
  }

  /**
   * Load state from localStorage
   */
  private loadFromStorage(): void {
    try {
      // Load connections
      const connectionsData = localStorage.getItem(this.CONNECTIONS_KEY);
      if (connectionsData) {
        const parsed = JSON.parse(connectionsData);
        this.connections = new Map(parsed);
      }
      
      // Load active wallets
      const activeData = localStorage.getItem(this.ACTIVE_WALLETS_KEY);
      if (activeData) {
        const parsed = JSON.parse(activeData);
        this.activeWallets = new Map(parsed);
      }
    } catch (error) {
      console.error('Failed to load wallet orchestrator state:', error);
    }
  }

  /**
   * Handle storage changes from other tabs
   */
  private handleStorageChange = (event: StorageEvent): void => {
    if (event.key === this.CONNECTIONS_KEY || event.key === this.ACTIVE_WALLETS_KEY) {
      this.loadFromStorage();
      // Emit a generic update event
      this.emitEvent({
        type: 'wallet-updated',
        connectionId: 'orchestrator',
        chain: 'evm', // Default chain for generic events
        data: { source: 'storage-sync' }
      });
    }
  };

  /**
   * Migrate from legacy storage keys
   */
  private migrateLegacyWallets(): void {
    let migrated = false;
    
    Object.entries(this.LEGACY_KEYS).forEach(([chain, key]) => {
      try {
        const data = localStorage.getItem(key);
        if (!data) return;
        
        const parsed = JSON.parse(data);
        if (parsed.isConnected && parsed.address) {
          // Create connection from legacy data
          this.connectWallet({
            address: parsed.address,
            chain: chain as ChainType,
            walletType: parsed.walletType || 'external',
            chainId: parsed.chainId,
            balance: parsed.balance,
            setAsActive: true
          });
          
          migrated = true;
          console.log(`📦 Migrated legacy ${chain} wallet`);
        }
      } catch (error) {
        console.warn(`Failed to migrate legacy ${chain} wallet:`, error);
      }
    });
    
    // Also check for specific wallet connections
    const xamanConnected = localStorage.getItem('xrpl_wallet_connected') === 'true';
    const xamanAddress = localStorage.getItem('xrpl_wallet_address');
    if (xamanConnected && xamanAddress) {
      this.connectWallet({
        address: xamanAddress,
        chain: 'xrpl',
        walletType: 'xaman',
        setAsActive: !this.getActiveWallet('xrpl') // Only set active if no other active
      });
      migrated = true;
      console.log('📦 Migrated Xaman wallet');
    }
    
    if (migrated) {
      this.saveToStorage();
    }
  }

  /**
   * Clear all wallets (logout)
   */
  public clearAllWallets(): void {
    this.connections.clear();
    this.activeWallets.clear();
    this.saveToStorage();
    
    // Clear legacy keys too
    Object.values(this.LEGACY_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    
    console.log('🧹 Cleared all wallet connections');
  }

  /**
   * Get legacy state format (backward compatibility)
   */
  public getLegacyState(): Record<ChainType, WalletState> {
    const chains: ChainType[] = ['xrpl', 'evm', 'solana', 'bitcoin'];
    const state: Record<string, WalletState> = {};
    
    chains.forEach(chain => {
      const activeWallet = this.getActiveWallet(chain);
      state[chain] = {
        isConnected: !!activeWallet,
        address: activeWallet?.address || null,
        chainId: activeWallet?.chainId,
        balance: activeWallet?.balance,
        walletType: activeWallet?.walletType,
        connectedAt: activeWallet?.connectedAt
      };
    });
    
    return state as Record<ChainType, WalletState>;
  }

  /**
   * Check if any wallet is connected
   */
  public hasAnyWalletConnected(): boolean {
    return this.connections.size > 0;
  }

  /**
   * Check if specific chain has active wallet
   */
  public isChainWalletConnected(chain: ChainType): boolean {
    return !!this.getActiveWallet(chain);
  }

  /**
   * Get connection count
   */
  public getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Get wallet by connection ID
   */
  public getWalletById(connectionId: string): WalletConnection | null {
    return this.connections.get(connectionId) || null;
  }
}

// Create singleton instance
export const walletOrchestrator = new WalletOrchestrator();

// Export legacy-compatible functions for backward compatibility
export function getWalletForChain(chain: ChainType): WalletState {
  const activeWallet = walletOrchestrator.getActiveWallet(chain);
  return {
    isConnected: !!activeWallet,
    address: activeWallet?.address || null,
    chainId: activeWallet?.chainId,
    balance: activeWallet?.balance,
    walletType: activeWallet?.walletType,
    connectedAt: activeWallet?.connectedAt
  };
}

export function saveWalletForChain(chain: ChainType, wallet: Partial<WalletState>): void {
  if (!wallet.address) return;
  
  walletOrchestrator.connectWallet({
    address: wallet.address,
    chain,
    walletType: wallet.walletType || 'external',
    chainId: wallet.chainId,
    balance: wallet.balance,
    setAsActive: true
  });
}

export function removeWalletForChain(chain: ChainType): void {
  const activeWallet = walletOrchestrator.getActiveWallet(chain);
  if (activeWallet) {
    walletOrchestrator.disconnectWallet(activeWallet.id);
  }
}

export function getUniversalWalletState(): Record<ChainType, WalletState> {
  return walletOrchestrator.getLegacyState();
}

export function hasAnyWalletConnected(): boolean {
  return walletOrchestrator.hasAnyWalletConnected();
}

export function getConnectedWallets(): Array<{ chain: ChainType; wallet: WalletState }> {
  const chains: ChainType[] = ['xrpl', 'evm', 'solana', 'bitcoin'];
  return chains
    .map(chain => ({ chain, wallet: getWalletForChain(chain) }))
    .filter(({ wallet }) => wallet.isConnected);
}

export function subscribeToWalletChanges(callback: (state: any) => void): () => void {
  return walletOrchestrator.subscribeToWalletChanges(callback);
}

export function clearAllWallets(): void {
  walletOrchestrator.clearAllWallets();
}

export function updateWalletBalance(chain: ChainType, balance: string): void {
  const activeWallet = walletOrchestrator.getActiveWallet(chain);
  if (activeWallet) {
    walletOrchestrator.updateBalance(activeWallet.id, balance);
  }
}

export function isChainWalletConnected(chain: ChainType): boolean {
  return walletOrchestrator.isChainWalletConnected(chain);
}

export function getPrimaryWallet(): { chain: ChainType; wallet: WalletState } | null {
  const riddleWallet = walletOrchestrator.getPrimaryWallet();
  if (!riddleWallet) return null;
  
  return {
    chain: riddleWallet.chain,
    wallet: {
      isConnected: true,
      address: riddleWallet.address,
      chainId: riddleWallet.chainId,
      balance: riddleWallet.balance,
      walletType: riddleWallet.walletType,
      connectedAt: riddleWallet.connectedAt
    }
  };
}

// Initialize on module load
export function initializeUniversalWalletManager(): void {
  // The orchestrator is already initialized via singleton
  console.log('🚀 Universal Wallet Manager (Orchestrator) initialized');
  
  // Add global functions for backward compatibility
  if (typeof window !== 'undefined') {
    (window as any).saveWalletForChain = saveWalletForChain;
    (window as any).removeWalletForChain = removeWalletForChain;
    (window as any).getWalletForChain = getWalletForChain;
    (window as any).walletOrchestrator = walletOrchestrator;
  }
}

// Auto-initialize when module loads
if (typeof window !== 'undefined') {
  initializeUniversalWalletManager();
}

// Default export for convenience
export default walletOrchestrator;
