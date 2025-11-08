/**
 * XRPL Trustline Manager
 * Handles all trustline operations including creation, removal, and status checking
 */

import { TokenSearchResult } from './token-api';

export interface TrustlineInfo {
  currency: string;
  issuer: string;
  balance: string;
  limit: string;
  quality_in: number;
  quality_out: number;
  no_ripple?: boolean;
  freeze?: boolean;
  symbol?: string;
}

export interface TrustlineStatus {
  hasTrustline: boolean;
  balance?: string;
  limit?: string;
}

export class XRPLTrustlineManager {
  private trustlineCache: Map<string, TrustlineStatus> = new Map();
  private trustlines: TrustlineInfo[] = [];
  
  constructor() {}
  
  /**
   * Get the cache key for a trustline
   */
  private getTrustlineKey(currency: string, issuer: string): string {
    return `${currency}_${issuer}`;
  }
  
  /**
   * Load all trustlines for a wallet
   */
  async loadTrustlines(walletAddress: string): Promise<TrustlineInfo[]> {
    try {
      // Use the correct endpoint that's working
      const response = await fetch(`/api/xrpl/trustlines/${walletAddress}`);
      if (!response.ok) {
        throw new Error('Failed to fetch trustlines');
      }
      
      const data = await response.json() as any;


      // Handle the response structure properly
      if (data.success && Array.isArray(data.trustlines)) {
        // Convert hex currency codes to readable names
        this.trustlines = data.trustlines.map((trustline: any) => {
          let symbol = trustline.currency;
          
          // Convert hex to ASCII for readable token names
          if (trustline.currency && trustline.currency.length === 40 && /^[0-9A-F]+$/i.test(trustline.currency)) {
            try {
              const cleanHex = trustline.currency.replace(/0+$/, '');
              const decoded = Buffer.from(cleanHex, 'hex').toString('utf8').replace(/\0/g, '');
              symbol = decoded.length > 0 ? decoded : trustline.currency.substring(0, 8);
            } catch {
              symbol = trustline.currency.substring(0, 8);
            }
          }
          
          return {
            ...trustline,
            symbol
          };
        });
        
        // Update cache
        this.trustlines.forEach(trustline => {
          const key = this.getTrustlineKey(trustline.currency, trustline.issuer);
          this.trustlineCache.set(key, {
            hasTrustline: true,
            balance: trustline.balance,
            limit: trustline.limit
          });
        });
        
        console.log(`✅ Loaded ${this.trustlines.length} trustlines:`, this.trustlines);
        return this.trustlines;
      }
      return [];
    } catch (error) {
      console.error('Error loading trustlines:', error);
      return [];
    }
  }
  
  /**
   * Check if a specific trustline exists
   */
  async checkTrustlineStatus(
    walletAddress: string, 
    currency: string, 
    issuer: string
  ): Promise<TrustlineStatus> {
    // Check cache first
    const key = this.getTrustlineKey(currency, issuer);
    const cached = this.trustlineCache.get(key);
    if (cached) {
      return cached;
    }
    
    try {
      const response = await fetch('/api/xrpl/trustline/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: walletAddress,
          currency,
          issuer
        })
      });
      
      if (response.ok) {
        const data = await response.json() as any;
        const status: TrustlineStatus = {
          hasTrustline: data.hasTrustline,
          balance: data.balance,
          limit: data.limit
        };
        
        // Cache the result
        this.trustlineCache.set(key, status);
        return status;
      }
      
      return { hasTrustline: false };
    } catch (error) {

      return { hasTrustline: false };
    }
  }
  
  /**
   * Create a new trustline
   */
  async createTrustline(
    walletAddress: string,
    token: TokenSearchResult,
    limit: string = '1000000000',
    password?: string
  ): Promise<{ success: boolean; txHash?: string; error?: string; requiresPassword?: boolean }> {
    try {
      // Get session token from storage
      const sessionData = sessionStorage.getItem('riddle_wallet_session');
      if (!sessionData) {
        throw new Error('No active session found - please login first');
      }
      
      const session = JSON.parse(sessionData);
      
      const response = await fetch('/api/xrpl/riddle-trustline', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.sessionToken}`
        },
        body: JSON.stringify({
          currency: token.currency_code,
          issuer: token.issuer,
          limit,
          walletAddress,
          password // Include password if provided
        })
      });
      
      const data = await response.json() as any;
      
      if (response.ok && data.success) {
        
        // Update cache to show the trustline exists
        const key = this.getTrustlineKey(token.currency_code, token.issuer);
        this.trustlineCache.set(key, {
          hasTrustline: true,
          balance: '0',
          limit
        });
        
        // Add to local trustlines list for immediate display
        const newTrustline = {
          currency: token.currency_code,
          issuer: token.issuer,
          balance: '0',
          limit,
          quality_in: 0,
          quality_out: 0,
          symbol: token.symbol
        };
        
        // Check if already exists to avoid duplicates
        const existingIndex = this.trustlines.findIndex(t => 
          t.currency === newTrustline.currency && t.issuer === newTrustline.issuer
        );
        
        if (existingIndex === -1) {
          this.trustlines.push(newTrustline);
        }
        
        return { success: true, txHash: data.txHash };
      } else if (data.requiresPassword) {
        // Password is required
        return {
          success: false,
          requiresPassword: true,
          error: data.message || 'Password required for trustline creation'
        };
      } else {
        throw new Error(data.error || 'Failed to create trustline');
      }
    } catch (error) {

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create trustline'
      };
    }
  }
  
  /**
   * Remove a trustline
   */
  async removeTrustline(
    walletAddress: string,
    currency: string,
    issuer: string,
    password?: string
  ): Promise<{ success: boolean; txHash?: string; error?: string; requiresPassword?: boolean }> {
    try {
      const sessionData = sessionStorage.getItem('riddle_wallet_session');
      if (!sessionData) {
        throw new Error('No active session found');
      }
      
      const session = JSON.parse(sessionData);
      
      const response = await fetch('/api/xrpl/riddle-remove-trustline', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.sessionToken}`
        },
        body: JSON.stringify({
          currency,
          issuer,
          walletAddress,
          password
        })
      });
      
      const data = await response.json() as any;
      
      if (response.ok && data.success) {
        // Remove from cache
        const key = this.getTrustlineKey(currency, issuer);
        this.trustlineCache.delete(key);
        
        // Remove from local list
        this.trustlines = this.trustlines.filter(
          tl => !(tl.currency === currency && tl.issuer === issuer)
        );
        
        return { success: true, txHash: data.txHash };
      } else if (data.requiresPassword) {
        // Password is required
        return {
          success: false,
          requiresPassword: true,
          error: data.error || 'Password required for trustline removal'
        };
      } else {
        throw new Error(data.error || 'Failed to remove trustline');
      }
    } catch (error) {

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove trustline'
      };
    }
  }
  
  /**
   * Get all cached trustlines
   */
  getTrustlines(): TrustlineInfo[] {
    return this.trustlines;
  }
  
  /**
   * Clear all cached data
   */
  clearCache() {
    this.trustlineCache.clear();
    this.trustlines = [];
  }
  
  /**
   * Check if a token requires a trustline
   */
  requiresTrustline(token: TokenSearchResult): boolean {
    return token.symbol !== 'XRP' && !!token.issuer;
  }
}

// Export instance
export const trustlineManager = new XRPLTrustlineManager();
