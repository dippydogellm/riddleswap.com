import { Router, Request, Response } from 'express';
import { executeXrplSwap } from './xrpl-swap';
import { executeXrplSwapWithCachedKeys, executeXrplPaymentWithCachedKeys } from './xrpl-swap-cached';
import { sendXrplPayment } from './xrpl-payment';
import { createBuyOffer, createSellOffer, acceptOffer, cancelOffer } from './xrpl-offers';
import { setTrustline, removeTrustline, getTrustlines } from './xrpl-trustline';
import { decryptXrplWallet } from './xrpl-wallet';
import { Client as XRPLClient } from 'xrpl';
import { decryptWalletData } from '../wallet-encryption';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { riddleWallets } from '../../shared/schema';
import { getSwapQuote, getSwapExchangeRate, getLiveXRPPrice } from './swap-exchange-rates';
import fetch from 'node-fetch';

/**
 * Get tokens from DexScreener with live data and logos - FIXED IMPLEMENTATION
 */
async function getTokensFromDexScreener(query?: string) {
  try {
    console.log('🔍 [DEXSCREENER] Fetching XRPL tokens for query:', query || 'all');
    
    // ALWAYS include native XRP first with live price
    const tokens: any[] = [];
    
    // Fetch live XRP price from CoinGecko
    try {
      const xrpResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd');
      if (xrpResponse.ok) {
        const xrpData = await xrpResponse.json() as any;
        const xrpPrice = xrpData.ripple?.usd || 0;
        
        // Always include XRP as first result
        tokens.push({
          currency: 'XRP',
          issuer: '',
          name: 'XRP',
          symbol: 'XRP',
          logo: '/images/chains/xrp-logo.png',
          logoURI: '/images/chains/xrp-logo.png',
          logo_url: '/images/chains/xrp-logo.png',
          icon_url: '/images/chains/xrp-logo.png',
          price_usd: xrpPrice,
          volume_24h: 1000000000,
          price_change_24h: 0,
          verified: true,
          source: 'native'
        });
        console.log(`✅ [DEXSCREENER] Added native XRP with price $${xrpPrice}`);
      }
    } catch (error) {
      console.log('⚠️ [DEXSCREENER] Could not fetch XRP price from CoinGecko');
      // Still add XRP without price
      tokens.push({
        currency: 'XRP',
        issuer: '',
        name: 'XRP',
        symbol: 'XRP',
        logo: '/images/chains/xrp-logo.png',
        logoURI: '/images/chains/xrp-logo.png',
        logo_url: '/images/chains/xrp-logo.png',
        icon_url: '/images/chains/xrp-logo.png',
        price_usd: 0,
        volume_24h: 1000000000,
        price_change_24h: 0,
        verified: true,
        source: 'native'
      });
    }

    // If there's a specific query, try to get more tokens from DexScreener
    if (query && query !== 'all') {
      try {
        const searchUrl = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`;
        console.log('🔍 [DEXSCREENER] Searching:', searchUrl);
        
        const response = await fetch(searchUrl, {
          headers: {
            'User-Agent': 'RiddleSwap/1.0',
            'Accept': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json() as any;
          console.log('📊 [DEXSCREENER] Raw response keys:', Object.keys(data));

          if (data.pairs && Array.isArray(data.pairs)) {
            const xrplTokens = data.pairs
              .filter((pair: any) => {
                // Better filtering for XRPL tokens
                return pair.chainId === 'xrpl' || 
                       pair.quoteToken?.symbol === 'XRP' ||
                       pair.url?.includes('xrpl') ||
                       pair.dexId === 'xrpl';
              })
              .map((pair: any) => {
                const logoUrl = pair.info?.imageUrl || pair.baseToken?.info?.imageUrl || '';
                return {
                  currency: pair.baseToken?.symbol || 'UNKNOWN',
                  issuer: pair.baseToken?.address || '',
                  name: pair.baseToken?.name || pair.baseToken?.symbol || 'Unknown Token',
                  symbol: pair.baseToken?.symbol || 'UNKNOWN',
                  logo: logoUrl,
                  logoURI: logoUrl,
                  logo_url: logoUrl,
                  icon_url: logoUrl,
                  price_usd: parseFloat(pair.priceUsd) || 0,
                  volume_24h: pair.volume?.h24 || 0,
                  price_change_24h: pair.priceChange?.h24 || 0,
                  verified: true,
                  source: 'dexscreener'
                };
              })
              .filter((token: any) => 
                token.currency !== 'UNKNOWN' && 
                token.currency !== 'XRP' // Don't duplicate XRP
              );
            
            tokens.push(...xrplTokens);
            console.log(`✅ [DEXSCREENER] Added ${xrplTokens.length} XRPL tokens from search`);
          }
        } else {
          console.log('❌ [DEXSCREENER] API response not ok:', response.status);
        }
      } catch (error) {
        console.error('❌ [DEXSCREENER] Search error:', error);
      }
    }

    console.log('✅ [DEXSCREENER] Total tokens found:', tokens.length);
    return tokens.slice(0, 20); // Limit to 20 tokens
    
  } catch (error) {
    console.error('❌ [DEXSCREENER] Error fetching tokens:', error);
    // Still return XRP as fallback
    return [{
      currency: 'XRP',
      issuer: '',
      name: 'XRP',
      symbol: 'XRP',
      logo: '/images/chains/xrp-logo.png',
      logoURI: '/images/chains/xrp-logo.png',
      logo_url: '/images/chains/xrp-logo.png',
      icon_url: '/images/chains/xrp-logo.png',
      price_usd: 0,
      volume_24h: 1000000000,
      price_change_24h: 0,
      verified: true,
      source: 'fallback'
    }];
  }
}

/**
 * Get all tokens from DexScreener
 */
async function getAllTokensFromDexScreener() {
  return await getTokensFromDexScreener(undefined); // Pass undefined to trigger XRP hardcoding
}

const router = Router();

import { sessionAuth } from '../middleware/session-auth';

// Test wallet decryption endpoint
router.post('/decrypt-wallet', sessionAuth, async (req: Request, res: Response) => {
  try {
    const { handle, password } = req.body;
    
    if (!handle || !password) {
      return res.status(400).json({
        success: false,
        error: 'Handle and password required'
      });
    }
    
    const wallet = await decryptXrplWallet(handle, password);
    
    res.json({
      success: true,
      address: wallet.address
    });
    
  } catch (error) {
    console.error('Wallet decryption error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to decrypt wallet'
    });
  }
});

// Swap endpoint - NO PASSWORD NEEDED, uses cached private keys
// Token search endpoint - live XRPL token data (PUBLIC)
router.get('/tokens/search', async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    console.log('🔍 [TOKEN SEARCH] Searching for tokens:', q);
    
    if (!q || typeof q !== 'string') {
      return res.json({
        success: true,
        tokens: []
      });
    }
    
    const query = q.toLowerCase();
    
    // Get tokens from DexScreener for live data and logos
    const popularTokens = await getTokensFromDexScreener(query);
    
    // Filter tokens based on search query
    const filteredTokens = popularTokens.filter(token => 
      token.name.toLowerCase().includes(query) ||
      token.symbol.toLowerCase().includes(query) ||
      token.currency.toLowerCase().includes(query)
    );
    
    console.log('✅ [TOKEN SEARCH] Found', filteredTokens.length, 'tokens for query:', q);
    
    res.json({
      success: true,
      tokens: filteredTokens
    });
    
  } catch (error) {
    console.error('❌ [TOKEN SEARCH] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Token search failed'
    });
  }
});

// Get all tokens endpoint - PUBLIC (for token selector)
router.get('/tokens/all', async (req: Request, res: Response) => {
  try {
    console.log('📋 [ALL TOKENS] Loading all available tokens...');
    
    // Get all tokens from DexScreener with live data
    const allTokens = await getAllTokensFromDexScreener();
    
    console.log('✅ [ALL TOKENS] Returning', allTokens.length, 'tokens');
    
    res.json({
      success: true,
      tokens: allTokens
    });
    
  } catch (error) {
    console.error('❌ [ALL TOKENS] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load tokens'
    });
  }
});

// Get live XRP balance endpoint - PUBLIC for swap interface
router.get('/balance/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    console.log('💰 [XRP BALANCE] Fetching AVAILABLE balance for:', address);
    
    const client = new XRPLClient('wss://s1.ripple.com');
    await client.connect();
    
    // Get account info with reserve calculation
    const accountInfo = await client.request({
      command: 'account_info',
      account: address
    });
    
    // Get server info for current reserve settings
    const serverInfo = await client.request({
      command: 'server_info'
    });
    
    await client.disconnect();
    
    // Extract balance and account data
    const accountData = accountInfo.result.account_data;
    const totalBalance = parseFloat(accountData.Balance) / 1000000; // Total XRP
    const ownerCount = accountData.OwnerCount || 0; // Number of objects owned
    
    // Get current network reserve settings
    const validatedLedger = serverInfo.result?.info?.validated_ledger;
    const baseReserve = parseFloat(String(validatedLedger?.reserve_base_xrp || '10')); // Default 10 XRP
    const ownerReserve = parseFloat(String(validatedLedger?.reserve_inc_xrp || '2')); // Default 2 XRP per object
    
    // Calculate AVAILABLE balance = Total - Base Reserve - (Owner Reserve * Objects)
    const totalReserved = baseReserve + (ownerReserve * ownerCount);
    const availableBalance = Math.max(0, totalBalance - totalReserved);
    
    console.log('📊 [XRP BALANCE] Balance breakdown:');
    console.log('  Total Balance:', totalBalance.toFixed(6), 'XRP');
    console.log('  Base Reserve:', baseReserve.toFixed(2), 'XRP');  
    console.log('  Owner Count:', ownerCount, 'objects');
    console.log('  Owner Reserve:', (ownerReserve * ownerCount).toFixed(2), 'XRP');
    console.log('  Total Reserved:', totalReserved.toFixed(2), 'XRP');
    console.log('✅ [XRP BALANCE] AVAILABLE balance:', availableBalance.toFixed(6), 'XRP');
    
    // Get XRP price for USD value calculation
    let usdValue = 0;
    let totalUsdValue = 0;
    try {
      // Import the price service for authentic pricing
      const { getTokenPrice } = await import('../price-service.js');
      const xrpTokenPrice = await getTokenPrice('XRP');
      
      if (xrpTokenPrice && xrpTokenPrice.price_usd > 0) {
        const xrpPrice = xrpTokenPrice.price_usd;
        console.log(`💲 [XRP] Using live price: $${xrpPrice} per XRP`);
        usdValue = parseFloat((availableBalance * xrpPrice).toFixed(2));
        totalUsdValue = parseFloat((totalBalance * xrpPrice).toFixed(2));
      } else {
        console.log('⚠️ [XRP] Live price unavailable, USD values set to 0');
      }
    } catch (priceError) {
      console.log('⚠️ [XRP] Price service failed, USD values set to 0:', priceError);
    }
    
    res.json({
      success: true,
      balance: availableBalance.toFixed(6), // Return AVAILABLE balance
      totalBalance: totalBalance.toFixed(6),
      reservedBalance: totalReserved.toFixed(6),
      ownerCount: ownerCount,
      address: address,
      usdValue: usdValue,
      totalUsdValue: totalUsdValue
    });
    
  } catch (error) {
    console.error('❌ [XRP BALANCE] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Balance fetch failed'
    });
  }
});

// Get live XRPL token balance endpoint - PUBLIC for swap interface
router.get('/token-balance/:address/:currency/:issuer', async (req: Request, res: Response) => {
  try {
    const { address, currency, issuer } = req.params;
    console.log('🪙 [TOKEN BALANCE] Fetching balance for:', { address, currency, issuer });
    
    const client = new XRPLClient('wss://s1.ripple.com');
    await client.connect();
    
    // Get account lines (trustlines) to find token balance
    const accountLines = await client.request({
      command: 'account_lines',
      account: address
    });
    
    await client.disconnect();
    
    // Convert currency symbol to hex for comparison if needed
    let currencyToMatch = currency;
    if (currency.length <= 3) {
      // Standard currency code (3 chars or less) - pad and convert to hex
      currencyToMatch = Buffer.from(currency.padEnd(3).toUpperCase()).toString('hex').toUpperCase();
    } else if (currency.length > 20) {
      // Already in hex format
      currencyToMatch = currency.toUpperCase();
    } else {
      // Long currency name - pad to 20 chars and convert to hex
      currencyToMatch = Buffer.from(currency.padEnd(20, '\0')).toString('hex').toUpperCase();
    }
    
    console.log('🔍 [TOKEN BALANCE] Currency match:', { original: currency, hex: currencyToMatch });
    
    // Find the specific token balance - try both original and hex format
    const tokenLine = accountLines.result.lines.find((line: any) => {
      const lineIssuer = line.account === issuer;
      const lineCurrency = line.currency === currency || line.currency === currencyToMatch;
      return lineCurrency && lineIssuer;
    });
    
    const tokenBalance = tokenLine ? parseFloat(tokenLine.balance) : 0;
    
    console.log('✅ [TOKEN BALANCE] Live balance:', tokenBalance.toFixed(6), currency);
    
    res.json({
      success: true,
      balance: tokenBalance.toFixed(6),
      currency: currency,
      issuer: issuer,
      address: address
    });
    
  } catch (error) {
    console.error('❌ [TOKEN BALANCE] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Token balance fetch failed'
    });
  }
});

// Swap quote endpoint - get exchange rates and fees - PUBLIC
router.post('/swap/quote', async (req: Request, res: Response) => {
  try {
    const { fromToken, toToken, amount, fromIssuer, toIssuer, fromPrice, toPrice, slippage = 5, userAddress } = req.body;
    
    console.log('💱 [SWAP QUOTE] Quote request:', { fromToken, toToken, amount, fromPrice, toPrice, slippage, userAddress });
    
    if (!fromToken || !toToken || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: fromToken, toToken, amount'
      });
    }

    // Check available balance for XRP swaps
    if (fromToken === 'XRP' && userAddress) {
      console.log('💰 [BALANCE CHECK] Checking available XRP balance for swap...');
      
      try {
        const client = new XRPLClient('wss://s1.ripple.com');
        await client.connect();
        
        // Get account info and server info for reserve calculation
        const [accountInfo, serverInfo] = await Promise.all([
          client.request({ command: 'account_info', account: userAddress }),
          client.request({ command: 'server_info' })
        ]);
        
        await client.disconnect();
        
        // Calculate available balance
        const accountData = accountInfo.result.account_data;
        const totalBalance = parseFloat(accountData.Balance) / 1000000;
        const ownerCount = accountData.OwnerCount || 0;
        
        const validatedLedger = serverInfo.result?.info?.validated_ledger;
        const baseReserve = parseFloat(String(validatedLedger?.reserve_base_xrp || '10'));
        const ownerReserve = parseFloat(String(validatedLedger?.reserve_inc_xrp || '2'));
        
        const totalReserved = baseReserve + (ownerReserve * ownerCount);
        const availableBalance = Math.max(0, totalBalance - totalReserved);
        
        console.log('💰 [BALANCE CHECK] Available:', availableBalance.toFixed(6), 'XRP, Requested:', amount, 'XRP');
        
        // FEE BLOCKER REMOVED - Only warn about insufficient balance, don't block the quote
        // Let XRPL itself reject the transaction if truly insufficient
        if (parseFloat(amount) > availableBalance) {
          console.warn('⚠️ [BALANCE WARNING] Requested amount may exceed available balance');
          console.warn(`💡 [BALANCE INFO] Available: ${availableBalance.toFixed(6)} XRP, Requested: ${amount} XRP`);
          console.warn('💡 [BALANCE INFO] Quote will proceed - XRPL will validate during swap execution');
          // Continue with quote instead of blocking
        } else {
          console.log('✅ [BALANCE CHECK] Sufficient balance confirmed');
        }
        
      } catch (balanceError) {
        console.log('⚠️ [BALANCE CHECK] Could not verify balance, proceeding with quote:', balanceError);
        // Continue with quote even if balance check fails
      }
    }

    // Get quote from backend (single source of truth for prices)
    const quote = await getSwapQuote(
      fromToken, 
      toToken, 
      parseFloat(amount), 
      fromIssuer, 
      toIssuer
    );
    
    // Apply client's slippage to get minimum received
    if (quote.success) {
      const slippageMultiplier = (100 - slippage) / 100;
      quote.minimumReceived = quote.estimatedOutput * slippageMultiplier;
      console.log(`✅ [SWAP QUOTE] Backend price verified. Client slippage ${slippage}% applied: ${quote.minimumReceived.toFixed(6)} min (from ${quote.estimatedOutput.toFixed(6)} expected)`);
    }
    
    res.json(quote);
    
  } catch (error) {
    console.error('❌ [SWAP QUOTE] Quote error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Quote failed'
    });
  }
});

// Exchange rate endpoint for backward compatibility - PUBLIC
router.post('/exchange-rate', async (req: Request, res: Response) => {
  try {
    const { fromCurrency, toCurrency, amount, fromIssuer, toIssuer } = req.body;
    
    console.log('💱 [EXCHANGE RATE] Rate request:', { fromCurrency, toCurrency, amount });
    
    if (!fromCurrency || !toCurrency || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: fromCurrency, toCurrency, amount'
      });
    }

    // Use the same getSwapQuote function for consistency
    const quote = await getSwapQuote(
      fromCurrency, 
      toCurrency, 
      parseFloat(amount), 
      fromIssuer, 
      toIssuer
    );
    
    if (!quote.success) {
      return res.status(400).json({
        success: false,
        error: quote.error
      });
    }
    
    // Return the output amount and rate for display
    console.log('✅ [EXCHANGE RATE] Rate calculated:', quote.estimatedOutput.toFixed(6));
    res.json({
      success: true,
      outputAmount: quote.estimatedOutput.toFixed(6),
      rate: quote.rate,
      minimumReceived: quote.minimumReceived,
      feeAmount: quote.feeAmount,
      priceImpact: quote.priceImpact
    });
    
  } catch (error) {
    console.error('❌ [EXCHANGE RATE] Rate error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Exchange rate calculation failed'
    });
  }
});

// Swap fee endpoint - calculate USD fee in XRP (1% of USD value) - PUBLIC
router.post('/swap/fee', async (req: Request, res: Response) => {
  try {
    const { amount, fromToken, fromIssuer } = req.body;
    
    if (!amount || !fromToken) {
      return res.status(400).json({
        success: false,
        error: 'Amount and fromToken required'
      });
    }

    console.log('💰 [SWAP FEE] Calculating fee for:', { amount, fromToken, fromIssuer });

    // Get live XRP price for final conversion
    const xrpPrice = await getLiveXRPPrice();
    console.log('💰 [SWAP FEE] Current XRP price: $', xrpPrice);
    
    let tokenUSDPrice: number;
    
    // Get USD price of the source token
    if (fromToken === 'XRP' || fromToken.toUpperCase() === 'XRP') {
      tokenUSDPrice = xrpPrice;
    } else {
      // Get token price from exchange rate service
      const exchangeRate = await getSwapExchangeRate(fromToken, 'USD', fromIssuer, undefined);
      if (!exchangeRate.success) {
        return res.status(400).json({
          success: false,
          error: `Unable to get price for ${fromToken}`
        });
      }
      tokenUSDPrice = exchangeRate.fromPrice;
    }
    
    console.log('💰 [SWAP FEE] Token USD price:', tokenUSDPrice);
    
    // Calculate 1% fee: amount × token_price × 1% = fee_in_USD
    const amountFloat = parseFloat(amount);
    const totalUSDValue = amountFloat * tokenUSDPrice;
    const feeUSD = totalUSDValue * 0.01; // 1% of USD value
    const feeXRP = feeUSD / xrpPrice; // Convert fee to XRP
    
    console.log('💰 [SWAP FEE] Calculations:', {
      amountFloat,
      totalUSDValue,
      feeUSD,
      feeXRP
    });
    
    res.json({
      success: true,
      feeAmount: feeXRP,
      feeToken: 'XRP',
      feeUSD: feeUSD,
      feePercentage: 1,
      tokenPrice: tokenUSDPrice,
      xrpPrice: xrpPrice
    });
    
  } catch (error) {
    console.error('❌ [SWAP FEE] Fee calculation error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Fee calculation failed'
    });
  }
});

// Trustline check endpoint - Authenticated
router.post('/trustline/check', sessionAuth, async (req: Request, res: Response) => {
  try {
    const { address, currency, issuer } = req.body;
    
    if (!address || !currency || !issuer) {
      return res.status(400).json({
        success: false,
        error: 'Address, currency, and issuer required'
      });
    }

    console.log('🔗 [TRUSTLINE CHECK] Checking trustline:', { address, currency, issuer });

    const client = new XRPLClient('wss://s1.ripple.com');
    await client.connect();

    try {
      const accountLines = await client.request({
        command: 'account_lines',
        account: address
      });

      const trustlineExists = accountLines.result.lines.some((line: any) => 
        line.currency === currency && line.account === issuer
      );

      console.log('✅ [TRUSTLINE CHECK] Trustline exists:', trustlineExists);

      res.json({
        success: true,
        hasTrustline: trustlineExists,
        currency,
        issuer
      });

    } finally {
      await client.disconnect();
    }
    
  } catch (error) {
    console.error('❌ [TRUSTLINE CHECK] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Trustline check failed'
    });
  }
});

// Swap execution endpoint - RIDDLE WALLET ONLY
router.post('/swap/execute', sessionAuth, async (req: Request, res: Response) => {
  try {
    const { fromToken, toToken, amount, fromIssuer, toIssuer, slippage } = req.body;
    
    console.log('🔄 [RIDDLE SWAP EXECUTE] Riddle wallet swap request:', { fromToken, toToken, amount });
    
    if (!fromToken || !toToken || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: fromToken, toToken, amount'
      });
    }

    // Get cached private keys from authenticated Riddle wallet session
    const authHeader = req.headers.authorization;
    const sessionToken = authHeader?.replace('Bearer ', '');
    
    if (!sessionToken) {
      return res.status(401).json({
        success: false,
        error: 'Riddle wallet authentication required'
      });
    }

    // Get session with cached private keys
    const authModule = await import('../riddle-wallet-auth');
    const session = authModule.getActiveSession(sessionToken);
    
    if (!session || !session.cachedKeys) {
      return res.status(401).json({
        success: false,
        error: 'Invalid Riddle wallet session or no cached keys available'
      });
    }

    if (Date.now() > session.expiresAt) {
      return res.status(401).json({
        success: false,
        error: 'Riddle wallet session expired'
      });
    }

    const { handle, cachedKeys } = session;
    console.log('🔑 [RIDDLE SWAP] Using authenticated Riddle wallet for handle:', handle);

    // Execute swap directly using Riddle wallet cached private keys
    try {
      // Get wallet address from cached keys
      const { Wallet } = await import('xrpl');
      const wallet = Wallet.fromSeed(cachedKeys.xrpPrivateKey);
      const walletAddress = wallet.address;
      
      // Use user's exact slippage preference instead of adaptive override
      const userSlippage = slippage || 5;
      
      console.log(`🔧 [RIDDLE SWAP] Using user's exact slippage: ${userSlippage}% (no adaptive override)`);
      
      // Use the cached swap execution function for Riddle wallets with fee tracking
      const result = await executeXrplSwapWithCachedKeys(
        cachedKeys, 
        fromToken, 
        toToken, 
        amount, 
        fromIssuer, 
        toIssuer, 
        handle, 
        walletAddress,
        userSlippage
      );
      
      console.log('✅ [RIDDLE SWAP] Swap executed with cached keys:', result?.success ? 'SUCCESS' : 'FAILED');
      
      return res.json(result || { success: false, error: 'No result returned' });
      
    } catch (error) {
      console.error('❌ [RIDDLE SWAP] Error executing swap:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Riddle wallet swap failed'
      });
    }
    
  } catch (error) {
    console.error('❌ [XRPL SWAP EXECUTE] Real swap error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Real swap failed'
    });
  }
});

// Legacy swap endpoint for backward compatibility
router.post('/swap', sessionAuth, async (req: Request, res: Response) => {
  try {
    const { fromToken, toToken, amount } = req.body;
    
    console.log('🔄 [XRPL SWAP LEGACY] Swap request:', { fromToken, toToken, amount });
    
    if (!fromToken || !toToken || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: fromToken, toToken, amount'
      });
    }

    // Get cached private keys from session - NO PASSWORD REQUIRED
    const authHeader = req.headers.authorization;
    const sessionToken = authHeader?.replace('Bearer ', '');
    
    if (!sessionToken) {
      return res.status(401).json({
        success: false,
        error: 'No session token provided'
      });
    }

    // Get session with cached private keys
    const authModule = await import('../riddle-wallet-auth');
    const session = authModule.getActiveSession(sessionToken);
    
    if (!session || !session.cachedKeys) {
      return res.status(401).json({
        success: false,
        error: 'Invalid session or no cached keys available'
      });
    }

    if (Date.now() > session.expiresAt) {
      return res.status(401).json({
        success: false,
        error: 'Session expired'
      });
    }

    const { handle, cachedKeys } = session;
    console.log('🔄 [XRPL SWAP LEGACY] Using cached keys for handle:', handle);
    
    // Execute swap with cached private key instead of password
    try {
      // Get wallet address from cached keys  
      const { Wallet } = await import('xrpl');
      const wallet = Wallet.fromSeed(cachedKeys.xrpPrivateKey);
      const walletAddress = wallet.address;
      
      // Execute with fee tracking
      const result = await executeXrplSwapWithCachedKeys(
        cachedKeys, 
        fromToken, 
        toToken, 
        amount, 
        undefined, 
        undefined, 
        handle, 
        walletAddress
      );
      
      console.log('✅ [XRPL SWAP LEGACY] Swap result:', result?.success ? 'SUCCESS' : 'FAILED');
      res.json(result || { success: false, error: 'No result returned' });
    } catch (error) {
      console.error('❌ [XRPL SWAP LEGACY] Error executing swap:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Swap execution failed'
      });
    }
    
  } catch (error) {
    console.error('❌ [XRPL SWAP LEGACY] Swap error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Swap failed'
    });
  }
});

// Payment endpoint with partial payment support
router.post('/payment', sessionAuth, async (req: Request, res: Response) => {
  try {
    const { 
      handle, 
      password, 
      destination, 
      amount, 
      currency, 
      issuer, 
      destinationTag,
      usePartialPayment,
      slippagePercent
    } = req.body;
    
    if (!handle || !password || !destination || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }
    
    const result = await sendXrplPayment(
      handle, 
      password, 
      destination, 
      amount, 
      currency, 
      issuer, 
      destinationTag,
      usePartialPayment,
      slippagePercent
    );
    
    res.json(result);
    
  } catch (error) {
    console.error('Payment error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Payment failed'
    });
  }
});

// Buy offer endpoint
router.post('/offer/buy', sessionAuth, async (req: Request, res: Response) => {
  try {
    const { 
      handle, 
      password,
      payAmount,
      payCurrency,
      payIssuer,
      getAmount,
      getCurrency,
      getIssuer
    } = req.body;
    
    if (!handle || !password || !payAmount || !payCurrency || !getAmount || !getCurrency) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }
    
    const result = await createBuyOffer(
      handle,
      password,
      payAmount,
      payCurrency,
      payIssuer,
      getAmount,
      getCurrency,
      getIssuer
    );
    
    res.json(result);
    
  } catch (error) {
    console.error('Buy offer error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Buy offer failed'
    });
  }
});

// Sell offer endpoint
router.post('/offer/sell', sessionAuth, async (req: Request, res: Response) => {
  try {
    const { 
      handle, 
      password,
      sellAmount,
      sellCurrency,
      sellIssuer,
      forAmount,
      forCurrency,
      forIssuer
    } = req.body;
    
    if (!handle || !password || !sellAmount || !sellCurrency || !forAmount || !forCurrency) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }
    
    const result = await createSellOffer(
      handle,
      password,
      sellAmount,
      sellCurrency,
      sellIssuer,
      forAmount,
      forCurrency,
      forIssuer
    );
    
    res.json(result);
    
  } catch (error) {
    console.error('Sell offer error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Sell offer failed'
    });
  }
});

// Accept offer endpoint
router.post('/offer/accept', sessionAuth, async (req: Request, res: Response) => {
  try {
    const { handle, password, offerSequence, offerOwner } = req.body;
    
    if (!handle || !password || !offerSequence || !offerOwner) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }
    
    const result = await acceptOffer(handle, password, offerSequence, offerOwner);
    res.json(result);
    
  } catch (error) {
    console.error('Accept offer error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Accept offer failed'
    });
  }
});

// Cancel offer endpoint
router.post('/offer/cancel', sessionAuth, async (req: Request, res: Response) => {
  try {
    const { handle, password, offerSequence } = req.body;
    
    if (!handle || !password || !offerSequence) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }
    
    const result = await cancelOffer(handle, password, offerSequence);
    res.json(result);
    
  } catch (error) {
    console.error('Cancel offer error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Cancel offer failed'
    });
  }
});

// Set trustline endpoint
router.post('/trustline/set', sessionAuth, async (req: Request, res: Response) => {
  try {
    const { handle, password, currency, issuer, limit } = req.body;
    
    if (!handle || !password || !currency || !issuer) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }
    
    const result = await setTrustline(handle, password, currency, issuer, limit);
    res.json(result);
    
  } catch (error) {
    console.error('Set trustline error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Set trustline failed'
    });
  }
});

// Remove trustline endpoint - Updated to match frontend contract and use session authentication
router.post('/trustline/remove', sessionAuth, async (req: Request, res: Response) => {
  try {
    const { currency, issuer, sellAll } = req.body;
    
    if (!currency || !issuer) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: currency and issuer'
      });
    }

    console.log('🗑️ [XRPL TRUSTLINE REMOVAL] Request received for session-based removal');
    
    // Get session from authorization header
    const authHeader = req.headers.authorization;
    const sessionToken = authHeader?.replace('Bearer ', '');
    
    if (!sessionToken) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Get session with cached private keys from riddle wallet auth
    const authModule = await import('../riddle-wallet-auth');
    const session = authModule.getActiveSession(sessionToken);
    
    if (!session || !session.cachedKeys) {
      return res.status(401).json({
        success: false,
        error: 'Invalid session or no cached keys available'
      });
    }

    if (Date.now() > session.expiresAt) {
      return res.status(401).json({
        success: false,
        error: 'Session expired'
      });
    }

    // Forward to the new wallet endpoint that handles session-based removal
    try {
      const walletEndpointUrl = `http://localhost:5000/api/wallets/xrp/trustlines/remove`;
      const walletResponse = await fetch(walletEndpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({ currency, issuer, sellAll })
      });

      const result = await walletResponse.json();
      res.status(walletResponse.status).json(result);
      
    } catch (forwardError) {
      console.error('❌ [XRPL TRUSTLINE REMOVAL] Failed to forward to wallet endpoint:', forwardError);
      res.status(500).json({
        success: false,
        error: 'Internal server error while processing trustline removal'
      });
    }
    
  } catch (error) {
    console.error('❌ [XRPL TRUSTLINE REMOVAL] Unexpected error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Remove trustline failed'
    });
  }
});

// Get trustlines endpoint
router.post('/trustline/list', sessionAuth, async (req: Request, res: Response) => {
  try {
    const { handle, password } = req.body;
    
    if (!handle || !password) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }
    
    const result = await getTrustlines(handle, password);
    res.json(result);
    
  } catch (error) {
    console.error('Get trustlines error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Get trustlines failed'
    });
  }
});

// Riddle trustline endpoint - uses cached keys from authenticated session
router.post('/riddle-trustline', sessionAuth, async (req: Request, res: Response) => {
  try {
    const { currency, issuer, limit = '1000000', walletAddress, password } = req.body;
    
    console.log('🔐 [RIDDLE TRUSTLINE] Request for trustline:', { currency, issuer, limit, walletAddress });
    
    if (!currency || !issuer) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: currency and issuer'
      });
    }
    
    // Get session from authorization header
    const authHeader = req.headers.authorization;
    const sessionToken = authHeader?.replace('Bearer ', '');
    
    if (!sessionToken) {
      return res.status(401).json({
        success: false,
        error: 'No session token provided'
      });
    }
    
    // Get session with cached private keys
    const authModule = await import('../riddle-wallet-auth');
    const session = authModule.getActiveSession(sessionToken);
    
    if (!session) {
      // If no session with cached keys, require password
      if (!password) {
        return res.status(401).json({
          success: false,
          requiresPassword: true,
          message: 'Password required for trustline creation'
        });
      }
      
      // Use password-based trustline creation
      const walletResult = await db.select().from(riddleWallets).where(eq(riddleWallets.xrpAddress, walletAddress)).limit(1);
      
      if (walletResult.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Wallet not found'
        });
      }
      
      const wallet = walletResult[0];
      const result = await setTrustline(wallet.handle, password, currency, issuer, limit);
      return res.json(result);
    }
    
    // Check if session has cached keys
    if (!session.cachedKeys) {
      // Session exists but no cached keys, require password
      if (!password) {
        return res.status(401).json({
          success: false,
          requiresPassword: true,
          message: 'Password required for trustline creation'
        });
      }
      
      const result = await setTrustline(session.handle, password, currency, issuer, limit);
      return res.json(result);
    }
    
    // Check if session is expired
    if (Date.now() > session.expiresAt) {
      return res.status(401).json({
        success: false,
        error: 'Session expired'
      });
    }
    
    const { handle, cachedKeys } = session;
    console.log('✅ [RIDDLE TRUSTLINE] Using cached keys for handle:', handle);
    
    // Create trustline using cached private key
    let client: XRPLClient | null = null;
    
    try {
      const { Wallet, TrustSetFlags } = await import('xrpl');
      
      // Connect to XRPL
      client = new XRPLClient('wss://s1.ripple.com');
      await client.connect();
      
      // Get the XRP private key from cached keys
      const xrpKey = cachedKeys.find((k: any) => k.blockchain === 'XRP');
      if (!xrpKey) {
        throw new Error('XRP private key not found in cached keys');
      }
      
      // Create wallet from cached private key
      const wallet = Wallet.fromSeed(xrpKey.privateKey);
      
      // Create trustline transaction with NoRipple flag
      const trustSet = {
        TransactionType: 'TrustSet' as const,
        Account: wallet.address,
        LimitAmount: {
          currency: currency,
          issuer: issuer,
          value: limit
        },
        Flags: TrustSetFlags.tfSetNoRipple
      };
      
      const prepared = await client.autofill(trustSet);
      const signed = wallet.sign(prepared);
      const result = await client.submitAndWait(signed.tx_blob);
      
      const success = (result.result.meta as any)?.TransactionResult === 'tesSUCCESS';
      
      console.log(`✅ [RIDDLE TRUSTLINE] Trustline ${success ? 'created' : 'failed'} for ${currency}`);
      
      res.json({
        success,
        txHash: result.result.hash,
        error: success ? undefined : (result.result.meta as any)?.TransactionResult
      });
      
    } finally {
      if (client) {
        await client.disconnect();
      }
    }
    
  } catch (error) {
    console.error('❌ [RIDDLE TRUSTLINE] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Trustline creation failed'
    });
  }
});

// Get sellable tokens (tokens with balance > 0) - Used by trustline removal modal
router.get('/wallet/tokens/sellable', sessionAuth, async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const sessionToken = authHeader?.replace('Bearer ', '');
    
    if (!sessionToken) {
      return res.status(401).json({
        success: false,
        error: 'No session token provided'
      });
    }
    
    // Get session  
    const authModule = await import('../riddle-wallet-auth');
    const session = authModule.getActiveSession(sessionToken);
    
    if (!session?.walletData?.xrpAddress) {
      return res.status(401).json({
        success: false,
        error: 'No XRP address in session'
      });
    }
    
    const xrpAddress = session.walletData.xrpAddress;
    
    // Get trustlines from XRPL
    const client = new XRPLClient('wss://s1.ripple.com');
    await client.connect();
    
    try {
      const accountLines = await client.request({
        command: 'account_lines',
        account: xrpAddress,
        ledger_index: 'validated'
      });
      
      // Helper to convert hex currency codes to readable strings
      const currencyHexToString = (currency: string): string => {
        if (!currency) return '';
        // Standard 3-character codes (XRP, USD, etc.)
        if (currency.length <= 3) return currency;
        // Hex-encoded currency codes (40 characters)
        if (currency.length === 40) {
          try {
            const decoded = Buffer.from(currency, 'hex').toString('utf8').replace(/\0/g, '').trim();
            return decoded || currency;
          } catch {
            return currency;
          }
        }
        return currency;
      };

      // Filter tokens with balance > 0
      const sellableTokens = accountLines.result.lines
        .filter((line: any) => parseFloat(line.balance) > 0)
        .map((line: any) => {
          const readableName = currencyHexToString(line.currency);
          return {
            currency: line.currency,
            issuer: line.account,
            balance: line.balance,
            limit: line.limit,
            name: readableName,
            symbol: readableName, // Add symbol field for consistency
            no_ripple: line.no_ripple,
            frozen: line.freeze || false
          };
        });
      
      console.log(`✅ [SELLABLE TOKENS] Found ${sellableTokens.length} tokens with balance for ${xrpAddress}`);
      
      res.json({
        success: true,
        sellableTokens
      });
      
    } finally {
      await client.disconnect();
    }
    
  } catch (error) {
    console.error('❌ [SELLABLE TOKENS] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get sellable tokens'
    });
  }
});

// Get removable trustlines (trustlines with balance = 0) - Used by trustline removal modal
router.get('/wallet/trustlines/removable', sessionAuth, async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const sessionToken = authHeader?.replace('Bearer ', '');
    
    if (!sessionToken) {
      return res.status(401).json({
        success: false,
        error: 'No session token provided'
      });
    }
    
    // Get session  
    const authModule = await import('../riddle-wallet-auth');
    const session = authModule.getActiveSession(sessionToken);
    
    if (!session?.walletData?.xrpAddress) {
      return res.status(401).json({
        success: false,
        error: 'No XRP address in session'
      });
    }
    
    const xrpAddress = session.walletData.xrpAddress;
    
    // Get trustlines from XRPL
    const client = new XRPLClient('wss://s1.ripple.com');
    await client.connect();
    
    try {
      const accountLines = await client.request({
        command: 'account_lines',
        account: xrpAddress,
        ledger_index: 'validated'
      });
      
      // Filter tokens with balance = 0
      const removableTrustlines = accountLines.result.lines
        .filter((line: any) => parseFloat(line.balance) === 0)
        .map((line: any) => ({
          currency: line.currency,
          issuer: line.account,
          balance: line.balance,
          limit: line.limit,
          name: line.currency.length === 3 ? line.currency : Buffer.from(line.currency, 'hex').toString('utf8').replace(/\0/g, ''),
          no_ripple: line.no_ripple,
          frozen: line.freeze || false
        }));
      
      console.log(`✅ [REMOVABLE TRUSTLINES] Found ${removableTrustlines.length} zero-balance trustlines for ${xrpAddress}`);
      
      res.json({
        success: true,
        removableTrustlines
      });
      
    } finally {
      await client.disconnect();
    }
    
  } catch (error) {
    console.error('❌ [REMOVABLE TRUSTLINES] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get removable trustlines'
    });
  }
});

// PUBLIC: Get sellable tokens by address (for external wallets - no auth required)
router.get('/public/tokens/sellable/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    
    if (!address) {
      return res.status(400).json({
        success: false,
        error: 'XRP address required'
      });
    }
    
    console.log(`🔓 [PUBLIC SELLABLE TOKENS] Fetching for address: ${address}`);
    
    // Get trustlines from XRPL
    const client = new XRPLClient('wss://s1.ripple.com');
    await client.connect();
    
    try {
      const accountLines = await client.request({
        command: 'account_lines',
        account: address,
        ledger_index: 'validated'
      });
      
      // Filter tokens with balance > 0 and enrich with DexScreener data
      const rawTokens = accountLines.result.lines
        .filter((line: any) => parseFloat(line.balance) > 0);
      
      // Enrich tokens with DexScreener metadata (logos, real names)
      const sellableTokens = await Promise.all(
        rawTokens.map(async (line: any) => {
          const decodedName = line.currency.length === 3 
            ? line.currency 
            : Buffer.from(line.currency, 'hex').toString('utf8').replace(/\0/g, '');
          
          // Try to fetch DexScreener data for logo and real name
          let logo = null;
          let realName = decodedName;
          
          try {
            const dexResponse = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${line.currency}`);
            if (dexResponse.ok) {
              const dexData = await dexResponse.json() as any;
              const xrplPair = dexData.pairs?.find((p: any) => 
                p.chainId === 'xrpl' && 
                p.baseToken?.address?.toLowerCase() === line.account.toLowerCase()
              );
              
              if (xrplPair) {
                logo = xrplPair.info?.imageUrl || xrplPair.baseToken?.logo;
                realName = xrplPair.baseToken?.name || decodedName;
              }
            }
          } catch (e) {
            console.log(`⚠️ Could not fetch DexScreener data for ${line.currency}`);
          }
          
          return {
            currency: line.currency,
            issuer: line.account,
            balance: line.balance,
            limit: line.limit,
            name: realName,
            logo: logo,
            no_ripple: line.no_ripple,
            frozen: line.freeze || false
          };
        })
      );
      
      console.log(`✅ [PUBLIC SELLABLE TOKENS] Found ${sellableTokens.length} tokens with balance for ${address}`);
      
      res.json({
        success: true,
        sellableTokens
      });
      
    } finally {
      await client.disconnect();
    }
    
  } catch (error) {
    console.error('❌ [PUBLIC SELLABLE TOKENS] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get sellable tokens'
    });
  }
});

// PUBLIC: Get removable trustlines by address (for external wallets - no auth required)
router.get('/public/trustlines/removable/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    
    if (!address) {
      return res.status(400).json({
        success: false,
        error: 'XRP address required'
      });
    }
    
    console.log(`🔓 [PUBLIC REMOVABLE TRUSTLINES] Fetching for address: ${address}`);
    
    // Get trustlines from XRPL
    const client = new XRPLClient('wss://s1.ripple.com');
    await client.connect();
    
    try {
      const accountLines = await client.request({
        command: 'account_lines',
        account: address,
        ledger_index: 'validated'
      });
      
      // Filter tokens with balance = 0 and enrich with DexScreener data
      const rawTrustlines = accountLines.result.lines
        .filter((line: any) => parseFloat(line.balance) === 0);
      
      // Enrich trustlines with DexScreener metadata (logos, real names)
      const removableTrustlines = await Promise.all(
        rawTrustlines.map(async (line: any) => {
          const decodedName = line.currency.length === 3 
            ? line.currency 
            : Buffer.from(line.currency, 'hex').toString('utf8').replace(/\0/g, '');
          
          // Try to fetch DexScreener data for logo and real name
          let logo = null;
          let realName = decodedName;
          
          try {
            const dexResponse = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${line.currency}`);
            if (dexResponse.ok) {
              const dexData = await dexResponse.json() as any;
              const xrplPair = dexData.pairs?.find((p: any) => 
                p.chainId === 'xrpl' && 
                p.baseToken?.address?.toLowerCase() === line.account.toLowerCase()
              );
              
              if (xrplPair) {
                logo = xrplPair.info?.imageUrl || xrplPair.baseToken?.logo;
                realName = xrplPair.baseToken?.name || decodedName;
              }
            }
          } catch (e) {
            console.log(`⚠️ Could not fetch DexScreener data for ${line.currency}`);
          }
          
          return {
            currency: line.currency,
            issuer: line.account,
            balance: line.balance,
            limit: line.limit,
            name: realName,
            logo: logo,
            no_ripple: line.no_ripple,
            frozen: line.freeze || false
          };
        })
      );
      
      console.log(`✅ [PUBLIC REMOVABLE TRUSTLINES] Found ${removableTrustlines.length} zero-balance trustlines for ${address}`);
      
      res.json({
        success: true,
        removableTrustlines
      });
      
    } finally {
      await client.disconnect();
    }
    
  } catch (error) {
    console.error('❌ [PUBLIC REMOVABLE TRUSTLINES] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get removable trustlines'
    });
  }
});

export default router;