/**
 * XRPL Balance Manager
 * Handles all balance-related operations for XRPL tokens
 */

export interface TokenBalance {
  currency: string;
  issuer: string;
  balance: string;
  symbol?: string;
}

export class XRPLBalanceManager {
  private tokenBalances: Map<string, string> = new Map();
  private xrpBalance: string = '0';
  
  constructor() {}
  
  /**
   * Get the key for storing token balances
   */
  private getTokenKey(currency: string, issuer?: string): string {
    return currency === 'XRP' ? 'XRP' : `${currency}_${issuer}`;
  }
  
  /**
   * Load all token balances for a wallet
   */
  async loadTokenBalances(walletAddress: string): Promise<{ [key: string]: string }> {
    try {
      console.log(`📊 Loading balances for wallet: ${walletAddress}`);
      
      // Fetch XRP balance using the working V2 balance API
      const xrpResponse = await fetch(`/api/balance-v2/XRP/${walletAddress}`);
      if (xrpResponse.ok) {
        const xrpData = await xrpResponse.json();
        if (xrpData.success) {
          this.xrpBalance = xrpData.balance || '0';
          this.tokenBalances.set('XRP', this.xrpBalance);
          console.log(`✅ XRP balance loaded: ${this.xrpBalance}`);
        }
      }
      
      // Fetch token balances via trustlines
      const trustlineResponse = await fetch(`/api/xrpl/trustlines/${walletAddress}`);
      if (trustlineResponse.ok) {
        const trustlineData = await trustlineResponse.json();
        if (trustlineData.success && Array.isArray(trustlineData.trustlines)) {
          console.log(`✅ Loading ${trustlineData.trustlines.length} token balances`);
          trustlineData.trustlines.forEach((trustline: any) => {
            const key = this.getTokenKey(trustline.currency, trustline.issuer);
            this.tokenBalances.set(key, trustline.balance || '0');
          });
        }
      }
      
      const allBalances = this.getAllBalances();
      console.log(`✅ Total balances loaded:`, Object.keys(allBalances).length);
      return allBalances;
    } catch (error) {
      console.error('❌ Error loading balances:', error);
      return {};
    }
  }
  
  /**
   * Get balance for a specific token
   */
  getTokenBalance(currency: string, issuer?: string): string {
    const key = this.getTokenKey(currency, issuer);
    return this.tokenBalances.get(key) || '0';
  }
  
  /**
   * Get all balances as an object
   */
  getAllBalances(): { [key: string]: string } {
    const balances: { [key: string]: string } = {};
    this.tokenBalances.forEach((value, key) => {
      balances[key] = value;
    });
    return balances;
  }
  
  /**
   * Update a specific token balance
   */
  updateTokenBalance(currency: string, issuer: string | undefined, balance: string) {
    const key = this.getTokenKey(currency, issuer);
    this.tokenBalances.set(key, balance);
  }
  
  /**
   * Clear all cached balances
   */
  clearBalances() {
    this.tokenBalances.clear();
    this.xrpBalance = '0';
  }
  
  /**
   * Get XRP balance
   */
  getXRPBalance(): string {
    return this.xrpBalance;
  }
  
  /**
   * Check if user has sufficient balance for a swap
   */
  hasSufficientBalance(currency: string, issuer: string | undefined, amount: string): boolean {
    const balance = this.getTokenBalance(currency, issuer);
    return parseFloat(balance) >= parseFloat(amount);
  }
  
  /**
   * Calculate available balance after reserves
   */
  async getAvailableBalance(walletAddress: string): Promise<{
    totalBalance: string;
    reserve: string;
    availableBalance: string;
  }> {
    try {
      const response = await fetch(`/api/xrpl/account-info/${walletAddress}`);
      if (response.ok) {
        const data = await response.json() as any;
        const totalBalance = data.balance || '0';
        const reserve = data.reserve || '0';
        const availableBalance = (parseFloat(totalBalance) - parseFloat(reserve)).toString();
        
        return {
          totalBalance,
          reserve,
          availableBalance: availableBalance < '0' ? '0' : availableBalance
        };
      }
      return {
        totalBalance: '0',
        reserve: '0',
        availableBalance: '0'
      };
    } catch (error) {

      return {
        totalBalance: '0',
        reserve: '0',
        availableBalance: '0'
      };
    }
  }
}

// Export instance methods for convenience
export const balanceManager = new XRPLBalanceManager();
