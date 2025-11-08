/**
 * Trustline Cache Service
 * 
 * Provides cached access to user-specific trustline information.
 * Uses the unified cache manager with 1-minute TTL for fast trustline operations.
 */

import { cacheManager, CACHE_TYPES } from './unified-cache-manager';
import { Client } from 'xrpl';

export interface TrustlineInfo {
  currency: string;
  issuer: string;
  balance: string;
  limit: string;
  quality_in: number;
  quality_out: number;
  no_ripple: boolean;
  no_ripple_peer: boolean;
  authorized: boolean;
  peer_authorized: boolean;
  freeze: boolean;
  obligation: boolean;
}

export interface AccountTrustlines {
  address: string;
  trustlines: TrustlineInfo[];
  total_count: number;
  last_updated: number;
  ledger_index: number;
  source: 'xrpl_network';
}

export interface TrustlineCheckResult {
  address: string;
  currency: string;
  issuer: string;
  has_trustline: boolean;
  trustline_details?: TrustlineInfo;
  message: string;
  last_updated: number;
  cached: boolean;
}

export class TrustlineCacheService {
  private static instance: TrustlineCacheService | null = null;
  
  // XRPL network servers for redundancy
  private readonly xrplServers = [
    'wss://s1.ripple.com',
    'wss://s2.ripple.com',
    'wss://xrplcluster.com'
  ];

  public static getInstance(): TrustlineCacheService {
    if (!TrustlineCacheService.instance) {
      TrustlineCacheService.instance = new TrustlineCacheService();
    }
    return TrustlineCacheService.instance;
  }

  /**
   * Get all trustlines for an account with caching
   */
  public async getAccountTrustlines(address: string): Promise<AccountTrustlines | null> {
    const cacheKey = `account_trustlines:${address}`;
    
    return await cacheManager.get(
      CACHE_TYPES.TRUSTLINE_DATA,
      cacheKey,
      async () => {
        console.log(`🔗 [TRUSTLINE-CACHE] Fetching trustlines for account: ${address}`);
        return await this.fetchAccountTrustlines(address);
      }
    );
  }

  /**
   * Check if specific trustline exists with caching
   */
  public async checkTrustline(address: string, currency: string, issuer: string): Promise<TrustlineCheckResult | null> {
    const cleanedIssuer = this.cleanIssuerAddress(issuer);
    const cacheKey = `trustline_check:${address}:${currency}:${cleanedIssuer}`;
    
    return await cacheManager.get(
      CACHE_TYPES.TRUSTLINE_DATA,
      cacheKey,
      async () => {
        console.log(`🔍 [TRUSTLINE-CACHE] Checking trustline: ${address} -> ${currency}:${cleanedIssuer}`);
        return await this.performTrustlineCheck(address, currency, cleanedIssuer);
      }
    );
  }

  /**
   * Batch check multiple trustlines
   */
  public async batchCheckTrustlines(
    address: string,
    checks: Array<{ currency: string; issuer: string }>
  ): Promise<TrustlineCheckResult[]> {
    const batchKey = `batch_trustline_check:${address}:${checks.map(c => `${c.currency}:${c.issuer}`).join(',')}`;
    
    const cached = await cacheManager.get(
      CACHE_TYPES.TRUSTLINE_DATA,
      batchKey,
      async () => {
        console.log(`📦 [TRUSTLINE-CACHE] Batch checking ${checks.length} trustlines for ${address}`);
        return await this.performBatchTrustlineCheck(address, checks);
      }
    );

    return cached || [];
  }

  /**
   * Invalidate trustline cache for specific account
   */
  public async invalidateAccountTrustlines(address: string): Promise<boolean> {
    const accountKey = `account_trustlines:${address}`;
    const success1 = await cacheManager.delete(CACHE_TYPES.TRUSTLINE_DATA, accountKey);
    
    // Also invalidate any specific trustline checks for this account
    let invalidatedCount = 0;
    const stats = cacheManager.getStats();
    
    // This is a simplified approach - in a production system, we'd maintain
    // a reverse index for efficient invalidation by account
    if (stats.cachesByType.TRUSTLINE_DATA) {
      await cacheManager.clear(CACHE_TYPES.TRUSTLINE_DATA);
      invalidatedCount = stats.cachesByType.TRUSTLINE_DATA.entries;
    }
    
    console.log(`🗑️ [TRUSTLINE-CACHE] Invalidated trustline cache for ${address} (${invalidatedCount} total entries cleared)`);
    return success1;
  }

  /**
   * Warm trustline cache for frequently accessed accounts
   */
  public async warmTrustlineCache(addresses: string[]): Promise<number> {
    return await cacheManager.warmCache(
      CACHE_TYPES.TRUSTLINE_DATA,
      async () => {
        console.log(`🔥 [TRUSTLINE-CACHE] Warming trustline cache for ${addresses.length} addresses`);
        
        const entries: Array<{key: string, data: any}> = [];
        
        for (const address of addresses) {
          try {
            const trustlines = await this.fetchAccountTrustlines(address);
            if (trustlines) {
              entries.push({
                key: `account_trustlines:${address}`,
                data: trustlines
              });
            }
          } catch (error) {
            console.error(`❌ [TRUSTLINE-CACHE] Failed to warm cache for ${address}:`, error);
          }
        }
        
        return entries;
      }
    );
  }

  /**
   * Get cache statistics for trustlines
   */
  public getTrustlineCacheStats(): any {
    const stats = cacheManager.getStats();
    return stats.cachesByType.TRUSTLINE_DATA || {
      entries: 0,
      size: 0,
      hitRate: 0,
      avgTtl: 0
    };
  }

  // Private methods for fetching data

  private async fetchAccountTrustlines(address: string): Promise<AccountTrustlines | null> {
    let client: Client | null = null;
    
    try {
      // Clean address format
      const cleanAddress = address.replace(/[^a-zA-Z0-9]/g, '');
      
      // Try to connect to XRPL servers
      client = await this.connectToXrpl();
      if (!client) {
        throw new Error('Failed to connect to XRPL network');
      }

      // Get account lines (trustlines)
      const accountLines = await client.request({
        command: 'account_lines',
        account: cleanAddress,
        ledger_index: 'validated'
      });

      const trustlines: TrustlineInfo[] = accountLines.result.lines.map((line: any) => ({
        currency: line.currency,
        issuer: line.account,
        balance: line.balance || '0',
        limit: line.limit || '0',
        quality_in: line.quality_in || 0,
        quality_out: line.quality_out || 0,
        no_ripple: line.no_ripple || false,
        no_ripple_peer: line.no_ripple_peer || false,
        authorized: line.authorized || false,
        peer_authorized: line.peer_authorized || false,
        freeze: line.freeze || false,
        obligation: line.obligation || false
      }));

      console.log(`✅ [TRUSTLINE-CACHE] Fetched ${trustlines.length} trustlines for ${address}`);

      return {
        address: cleanAddress,
        trustlines,
        total_count: trustlines.length,
        last_updated: Date.now(),
        ledger_index: accountLines.result.ledger_index,
        source: 'xrpl_network'
      };

    } catch (error) {
      console.error(`❌ [TRUSTLINE-CACHE] Error fetching trustlines for ${address}:`, error);
      
      // Handle timeout errors gracefully
      if (error instanceof Error && error.message.includes('timeout')) {
        console.log(`⏰ [TRUSTLINE-CACHE] Network timeout for ${address} - returning empty trustlines`);
        return {
          address,
          trustlines: [],
          total_count: 0,
          last_updated: Date.now(),
          ledger_index: 0,
          source: 'xrpl_network'
        };
      }
      
      return null;
    } finally {
      if (client) {
        await client.disconnect();
      }
    }
  }

  private async performTrustlineCheck(address: string, currency: string, issuer: string): Promise<TrustlineCheckResult | null> {
    try {
      const accountTrustlines = await this.fetchAccountTrustlines(address);
      
      if (!accountTrustlines) {
        return {
          address,
          currency,
          issuer,
          has_trustline: false,
          message: 'Failed to fetch account trustlines',
          last_updated: Date.now(),
          cached: false
        };
      }

      // Check if trustline exists
      const currencyMatch = this.createCurrencyMatcher(currency);
      const trustline = accountTrustlines.trustlines.find(line => {
        const currencyMatches = currencyMatch(line.currency);
        const issuerMatches = line.issuer === issuer;
        return currencyMatches && issuerMatches;
      });

      const result: TrustlineCheckResult = {
        address,
        currency,
        issuer,
        has_trustline: !!trustline,
        trustline_details: trustline,
        message: trustline 
          ? `Trustline exists for ${currency}` 
          : `No trustline found for ${currency} from ${issuer}`,
        last_updated: Date.now(),
        cached: false
      };

      console.log(`${result.has_trustline ? '✅' : '❌'} [TRUSTLINE-CACHE] ${result.message}`);
      return result;

    } catch (error) {
      console.error(`❌ [TRUSTLINE-CACHE] Error checking trustline:`, error);
      
      return {
        address,
        currency,
        issuer,
        has_trustline: false,
        message: `Error checking trustline: ${error instanceof Error ? error.message : 'Unknown error'}`,
        last_updated: Date.now(),
        cached: false
      };
    }
  }

  private async performBatchTrustlineCheck(
    address: string,
    checks: Array<{ currency: string; issuer: string }>
  ): Promise<TrustlineCheckResult[]> {
    try {
      // Fetch account trustlines once for all checks
      const accountTrustlines = await this.fetchAccountTrustlines(address);
      
      if (!accountTrustlines) {
        return checks.map(check => ({
          address,
          currency: check.currency,
          issuer: check.issuer,
          has_trustline: false,
          message: 'Failed to fetch account trustlines',
          last_updated: Date.now(),
          cached: false
        }));
      }

      return checks.map(check => {
        const cleanedIssuer = this.cleanIssuerAddress(check.issuer);
        const currencyMatch = this.createCurrencyMatcher(check.currency);
        
        const trustline = accountTrustlines.trustlines.find(line => {
          const currencyMatches = currencyMatch(line.currency);
          const issuerMatches = line.issuer === cleanedIssuer;
          return currencyMatches && issuerMatches;
        });

        return {
          address,
          currency: check.currency,
          issuer: cleanedIssuer,
          has_trustline: !!trustline,
          trustline_details: trustline,
          message: trustline 
            ? `Trustline exists for ${check.currency}` 
            : `No trustline found for ${check.currency} from ${cleanedIssuer}`,
          last_updated: Date.now(),
          cached: false
        };
      });

    } catch (error) {
      console.error(`❌ [TRUSTLINE-CACHE] Error in batch trustline check:`, error);
      
      return checks.map(check => ({
        address,
        currency: check.currency,
        issuer: check.issuer,
        has_trustline: false,
        message: `Error checking trustline: ${error instanceof Error ? error.message : 'Unknown error'}`,
        last_updated: Date.now(),
        cached: false
      }));
    }
  }

  private async connectToXrpl(): Promise<Client | null> {
    for (const server of this.xrplServers) {
      try {
        const client = new Client(server, {
          timeout: 10000, // 10 second timeout
          connectionTimeout: 5000 // 5 second connection timeout
        });
        
        await client.connect();
        console.log(`🔗 [TRUSTLINE-CACHE] Connected to XRPL server: ${server}`);
        return client;
      } catch (error) {
        console.log(`⚠️ [TRUSTLINE-CACHE] Server ${server} unavailable, trying next...`);
        continue;
      }
    }
    
    console.error(`❌ [TRUSTLINE-CACHE] All XRPL servers unavailable`);
    return null;
  }

  private cleanIssuerAddress(issuer: string): string {
    // Clean issuer address - remove any prefix like "RDL.r9xvnzUWZJpDu3NA6MKHmKhKJQTRqCRgu9"
    return issuer.includes('.') ? issuer.split('.')[1] : issuer;
  }

  private createCurrencyMatcher(currency: string): (lineCurrency: string) => boolean {
    return (lineCurrency: string) => {
      // Direct match
      if (lineCurrency === currency) {
        return true;
      }
      
      // Hex-encoded currency match (for currencies longer than 3 characters)
      if (currency.length > 3) {
        const hexCurrency = Buffer.from(currency).toString('hex').toUpperCase().padEnd(40, '0');
        return lineCurrency === hexCurrency;
      }
      
      // Decode hex currency back to string for comparison
      if (lineCurrency.length === 40) {
        try {
          const decodedCurrency = Buffer.from(lineCurrency.replace(/0+$/, ''), 'hex').toString();
          return decodedCurrency === currency;
        } catch {
          return false;
        }
      }
      
      return false;
    };
  }
}

// Export singleton instance
export const trustlineCacheService = TrustlineCacheService.getInstance();