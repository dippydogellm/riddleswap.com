/**
 * XRPL Swap Payload Manager
 * Handles creation and management of swap transaction payloads
 */

import { TokenSearchResult } from './token-api';

export interface SwapPayload {
  fromCurrency: string;
  fromIssuer: string;
  toCurrency: string;
  toIssuer: string;
  amount: string;
  walletAddress: string;
  slippage: number;
  platformFeeXRP?: string;
}

export interface SwapQuote {
  inputAmount: string;
  outputAmount: string;
  exchangeRate: string;
  platformFeeXRP: string;
  priceImpact: number;
  route?: string[];
}

export interface SwapResult {
  success: boolean;
  txHash?: string;
  outputAmount?: string;
  platformFeeXRP?: string;
  error?: string;
}

export class XRPLSwapPayloadManager {
  private readonly FEE_PERCENTAGE = 0.01; // 1% platform fee
  private readonly DEFAULT_SLIPPAGE = 5; // 5% default slippage
  
  constructor() {}
  
  /**
   * Create a swap payload from token selections
   */
  createSwapPayload(
    fromToken: TokenSearchResult,
    toToken: TokenSearchResult,
    amount: string,
    walletAddress: string,
    slippage?: number
  ): SwapPayload {
    return {
      fromCurrency: fromToken.currency_code || fromToken.symbol,
      fromIssuer: fromToken.issuer || '',
      toCurrency: toToken.currency_code || toToken.symbol,
      toIssuer: toToken.issuer || '',
      amount,
      walletAddress,
      slippage: slippage || this.DEFAULT_SLIPPAGE
    };
  }
  
  /**
   * Get a quote for a swap using real mainnet exchange rates
   */
  async getSwapQuote(payload: SwapPayload): Promise<SwapQuote | null> {
    try {
      // ➡️ Use NEW EXCHANGE SYSTEM for quotes
      const toIssuer = payload.toIssuer || 
        (payload.toCurrency === 'RDL' ? 'r9xvnzUWZJpDu3NA6MKHmKhKJQTRqCRgu9' : '');

      const requestBody = {
        fromToken: payload.fromCurrency,
        toToken: payload.toCurrency,
        amount: payload.amount,
        slippage: payload.slippage,
        ...(toIssuer && { toIssuer })
      };

      const response = await fetch('/api/xrpl/swap/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        console.error('Exchange quote API error:', response.status, response.statusText);
        return null;
      }
      
      const data = await response.json() as any;
      console.log('Exchange quote API response:', data);
      
      if (data.success && data.outputAmount && data.exchangeRate) {
        return {
          inputAmount: payload.amount,
          outputAmount: data.outputAmount,
          exchangeRate: data.exchangeRate,
          platformFeeXRP: data.platformFee || '0.01',
          priceImpact: parseFloat(data.priceImpact.replace('< ', '').replace('%', '')) || 0,
          route: data.route || 'Direct'
        };
      }
      
      return null;
    } catch (error) {
      console.error('Exchange quote fetch error:', error);
      return null;
    }
  }
  
  /**
   * Execute a swap transaction using Riddle wallet private key
   */
  async executeSwap(payload: any): Promise<SwapResult> {
    try {
      const sessionData = sessionStorage.getItem('riddle_wallet_session');
      if (!sessionData) {
        throw new Error('No active Riddle wallet session found');
      }
      
      const session = JSON.parse(sessionData);
      
      const swapRequest = {
        fromCurrency: payload.fromCurrency || payload.fromToken?.currency_code,
        fromIssuer: payload.fromIssuer || payload.fromToken?.issuer,
        toCurrency: payload.toCurrency || payload.toToken?.currency_code,
        toIssuer: payload.toIssuer || payload.toToken?.issuer,
        amount: payload.amount,
        walletAddress: payload.walletAddress,
        slippage: payload.slippage || '5',
        password: payload.password // Include password for private key decryption
      };
      
      const response = await fetch('/api/xrpl/riddle-swap', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.sessionToken}`
        },
        body: JSON.stringify(swapRequest)
      });
      
      const data = await response.json() as any;
      
      // If we get a 401, try to re-login with the password we have
      if (response.status === 401 && payload.password) {

        // Try to re-login
        const loginResponse = await fetch('/api/riddle-wallet/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            handle: session.handle,
            masterPassword: payload.password
          })
        });
        
        if (loginResponse.ok) {
          const loginData = await loginResponse.json();
          // Update session storage with new token
          sessionStorage.setItem('riddle_wallet_session', JSON.stringify({
            ...session,
            sessionToken: loginData.sessionToken
          }));
          
          // Retry the swap with the new session token
          const retryResponse = await fetch('/api/xrpl/riddle-swap', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${loginData.sessionToken}`
            },
            body: JSON.stringify(swapRequest)
          });
          
          const retryData = await retryResponse.json();
          if (retryResponse.ok && retryData.success) {
            return {
              success: true,
              txHash: retryData.txHash,
              outputAmount: retryData.outputAmount,
              platformFeeXRP: retryData.platformFeeXRP
            };
          }
        }
      }
      
      if (response.ok && data.success) {
        return {
          success: true,
          txHash: data.txHash,
          outputAmount: data.outputAmount,
          platformFeeXRP: data.platformFeeXRP
        };
      } else {
        // Handle password requirement
        if (data.requiresPassword) {
          throw new Error('Password required for transaction signing');
        }
        throw new Error(data.error || 'Swap failed');
      }
    } catch (error) {

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute swap'
      };
    }
  }
  
  /**
   * Calculate platform fee in XRP using live XRP price
   */
  async calculatePlatformFee(inputAmount: string, fromTokenPriceUSD: number): Promise<string> {
    const feeUSD = parseFloat(inputAmount) * fromTokenPriceUSD * this.FEE_PERCENTAGE;
    
    try {
      // Use shared price utility to get live XRP price
      const { getXRPPriceStrict } = await import('@shared/price-utils');
      const liveXRPPrice = await getXRPPriceStrict();
      
      if (liveXRPPrice && liveXRPPrice > 0) {
        console.log(`💰 [SWAP] Using live XRP price $${liveXRPPrice} for fee calculation`);
        return (feeUSD / liveXRPPrice).toFixed(6);
      } else {
        console.warn('⚠️ [SWAP] Live XRP price unavailable, cannot calculate fee');
        return '0.000000'; // Return 0 fee if price unavailable
      }
    } catch (error) {
      console.error('❌ [SWAP] Fee calculation failed:', error);
      return '0.000000'; // Return 0 fee if calculation fails
    }
  }
  
  /**
   * Validate swap parameters
   */
  validateSwapParams(
    fromToken: TokenSearchResult | null,
    toToken: TokenSearchResult | null,
    amount: string
  ): { valid: boolean; error?: string } {
    if (!fromToken || !toToken) {
      return { valid: false, error: 'Please select both tokens' };
    }
    
    if (!amount || parseFloat(amount) <= 0) {
      return { valid: false, error: 'Please enter a valid amount' };
    }
    
    if (fromToken.symbol === toToken.symbol && 
        fromToken.issuer === toToken.issuer) {
      return { valid: false, error: 'Cannot swap same token' };
    }
    
    return { valid: true };
  }
  
  /**
   * Format swap summary for display
   */
  formatSwapSummary(
    fromToken: TokenSearchResult,
    toToken: TokenSearchResult,
    inputAmount: string,
    outputAmount: string,
    platformFeeXRP: string
  ): string {
    return `Swap ${inputAmount} ${fromToken.symbol} for ${outputAmount} ${toToken.symbol}\n` +
           `Platform Fee: ${platformFeeXRP} XRP`;
  }
  
  /**
   * Calculate minimum output amount based on slippage
   */
  calculateMinimumOutput(outputAmount: string, slippage: number): string {
    const minOutput = parseFloat(outputAmount) * (1 - slippage / 100);
    return minOutput.toFixed(6);
  }
}

// Export instance
export const swapPayloadManager = new XRPLSwapPayloadManager();
