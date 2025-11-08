/**
 * SIMPLE XRPL SWAP ROUTES
 * All swap logic handled server-side
 */

import { Router } from 'express';
import { executeSimpleSwap, getSwapQuote, checkLiquidity } from './xrpl-swap-simple';
import { sessionAuth } from '../middleware/session-auth';
import { bithompAPI } from '../bithomp-api-v2';

// Import fee collection function for swap fees
async function collectSwapFee({
  swapAmount,
  swapToken = 'XRP',
  sourceTransactionHash,
  sourceWallet,
  swapUsdValue
}: {
  swapAmount: string;
  swapToken?: string;
  sourceTransactionHash: string;
  sourceWallet: string;
  swapUsdValue?: string;
}) {
  try {
    // Call the swap fee collection endpoint
    const response = await fetch('http://localhost:5000/api/launchpad/collect-swap-fee', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        launchId: 1, // Default launch ID for general swap fees
        swapAmount,
        swapToken,
        sourceTransactionHash,
        sourceWallet,
        swapUsdValue
      })
    });
    
    if (response.ok) {
      const result = await response.json() as any;
      console.log(`💰 [SWAP FEE] Collected ${result.swapFeeAmount} ${swapToken} (${result.swapFeeUsd} USD)`);
      return result;
    } else {
      console.error('Failed to collect swap fee:', await response.text());
    }
  } catch (error) {
    console.error('Error collecting swap fee:', error);
  }
  return null;
}

const router = Router();

// Get swap quote
router.post('/api/xrpl/swap-simple/quote', async (req, res) => {
  try {
    const { fromToken, toToken, amount, slippage = 5 } = req.body;
    
    if (!fromToken || !toToken || !amount) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const quote = await getSwapQuote(fromToken, toToken, parseFloat(amount), slippage);
    res.json(quote);
  } catch (error: any) {
    console.error('Quote error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Execute swap (requires auth)
router.post('/api/xrpl/swap-simple/execute', sessionAuth, async (req: any, res) => {
  try {
    const { fromToken, toToken, amount, fromIssuer, toIssuer, slippage = 5 } = req.body;
    
    if (!fromToken || !toToken || !amount) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    // Get private key from session
    const session = req.session;
    if (!session?.xrpPrivateKey) {
      return res.status(401).json({ error: 'No XRPL wallet in session' });
    }
    
    const result = await executeSimpleSwap(
      session.xrpPrivateKey,
      fromToken,
      toToken,
      parseFloat(amount),
      fromIssuer,
      toIssuer,
      slippage
    );
    
    // Collect 0.25% swap fee if swap was successful
    if (result.success && result.txHash) {
      const userWallet = req.user?.walletAddress || req.session?.walletAddress || 'unknown';
      
      // Calculate USD value for fee calculation
      const estimatedUsdValue = result.actualReceived ? 
        (parseFloat(result.actualReceived) * 3.06).toFixed(4) : // Assume $3.06 XRP price
        (parseFloat(amount) * 3.06).toFixed(4);
      
      // Collect swap fee in background (don't block response)
      setImmediate(async () => {
        await collectSwapFee({
          swapAmount: amount.toString(),
          swapToken: fromToken,
          sourceTransactionHash: result.txHash,
          sourceWallet: userWallet,
          swapUsdValue: estimatedUsdValue
        });
      });
      
      console.log(`✅ [SWAP] Executed ${fromToken} -> ${toToken} for ${userWallet}, collecting 0.25% fee`);
    }
    
    res.json(result);
  } catch (error: any) {
    console.error('Swap execution error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper: Format amount for XRPL (max 15 significant digits)
function formatXRPLAmount(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  
  // XRPL requires max 15 significant digits
  // Use toPrecision(15) to limit significant digits, then clean up
  const formatted = num.toPrecision(15);
  
  // Remove trailing zeros and unnecessary decimal point
  return parseFloat(formatted).toString();
}

// Generate deeplink for Joey Wallet or Xaman (wallets collect fees automatically)
router.post('/api/xrpl/swap/deeplink', async (req, res) => {
  try {
    const { fromToken, toToken, amount, fromIssuer, toIssuer, slippage = 5, walletAddress, walletType, expectedOutput, minOutput } = req.body;
    
    if (!fromToken || !toToken || !amount || !walletAddress || !walletType) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Use the SAME quote values that were already shown to user (no recalculation)
    console.log(`✅ [SWAP DEEPLINK] Using frontend quote values: ${amount} ${fromToken} → ${expectedOutput} ${toToken}`);
    console.log(`✅ [SWAP DEEPLINK] Client slippage ${slippage}% already applied: min ${minOutput}`);
    
    // Build XRPL Payment transaction JSON for swap (using connected wallet address)
    // Amount = what we WANT to receive (expected output from quote)
    // DeliverMin = minimum we'll accept (with client's slippage)
    // SendMax = maximum we'll spend
    // Flags = 131072 (tfPartialPayment) - REQUIRED for partial payments!
    const paymentTx: any = {
      TransactionType: 'Payment',
      Account: walletAddress,
      Destination: walletAddress, // Self-payment triggers path finding for swap
      Amount: toToken === 'XRP' 
        ? Math.floor(parseFloat(expectedOutput) * 1000000).toString()
        : {
            currency: toToken,
            issuer: toIssuer,
            value: formatXRPLAmount(parseFloat(expectedOutput))
          },
      DeliverMin: toToken === 'XRP'
        ? Math.floor(parseFloat(minOutput) * 1000000).toString()
        : {
            currency: toToken,
            issuer: toIssuer,
            value: formatXRPLAmount(parseFloat(minOutput))
          },
      SendMax: fromToken === 'XRP'
        ? (parseFloat(amount) * 1000000).toString()
        : {
            currency: fromToken,
            issuer: fromIssuer,
            value: formatXRPLAmount(amount)
          },
      Flags: 131072 // tfPartialPayment - allows actual delivery between DeliverMin and Amount
    };

    let deeplink = '';
    
    if (walletType === 'xaman') {
      // Create proper Xaman payload via API
      const xamanPayload = {
        txjson: paymentTx,
        options: {
          submit: true,
          return_url: {
            app: `https://${process.env.REPLIT_DEV_DOMAIN || 'localhost'}/xrpl-swap`,
            web: `https://${process.env.REPLIT_DEV_DOMAIN || 'localhost'}/xrpl-swap`
          }
        }
      };

      console.log('🔍 [XAMAN] Creating payload with:', JSON.stringify(xamanPayload, null, 2));
      console.log('🔍 [XAMAN] API Key exists:', !!process.env.XUMM_API_KEY);
      console.log('🔍 [XAMAN] API Secret exists:', !!process.env.XUMM_API_SECRET);

      const xamanResponse = await fetch('https://xumm.app/api/v1/platform/payload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.XUMM_API_KEY || '',
          'X-API-Secret': process.env.XUMM_API_SECRET || ''
        },
        body: JSON.stringify(xamanPayload)
      });

      if (!xamanResponse.ok) {
        const errorText = await xamanResponse.text();
        console.error('❌ Xaman API error status:', xamanResponse.status);
        console.error('❌ Xaman API error response:', errorText);
        try {
          const errorJson = JSON.parse(errorText);
          console.error('❌ Xaman API error details:', JSON.stringify(errorJson, null, 2));
        } catch (e) {
          // Not JSON, already logged as text
        }
        throw new Error(`Xaman API error: ${xamanResponse.status} - ${errorText}`);
      }

      const xamanData = await xamanResponse.json();
      console.log('✅ Created Xaman payload:', xamanData.uuid);
      console.log('🔍 [XAMAN] QR Code URL:', xamanData.refs?.qr_png);
      
      deeplink = xamanData.next.always; // Universal deeplink
      
      // Return Xaman payload with QR code
      res.json({
        success: true,
        walletType,
        deeplink,
        qrCode: xamanData.refs?.qr_png || '', // QR code image URL from Xaman
        uuid: xamanData.uuid,
        transaction: paymentTx,
        note: 'Wallet collects network fees automatically'
      });
      return;
    } else if (walletType === 'joey') {
      // Joey Wallet uses WalletConnect - return transaction for client-side WalletConnect request
      // The frontend will use SignClient.request() to send this to Joey wallet
      res.json({
        success: true,
        walletType: 'joey',
        useWalletConnect: true, // Flag to tell frontend to use WalletConnect instead of deeplink
        transaction: paymentTx,
        note: 'Use WalletConnect to send transaction to Joey wallet'
      });
      return;
    }

    res.json({
      success: true,
      walletType,
      deeplink,
      transaction: paymentTx,
      note: 'Wallet collects network fees automatically'
    });
  } catch (error: any) {
    console.error('Deeplink generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check liquidity for a token
router.post('/api/xrpl/swap-simple/liquidity', async (req, res) => {
  try {
    const { token, issuer } = req.body;
    
    if (!token || !issuer) {
      return res.status(400).json({ error: 'Token and issuer required' });
    }
    
    const liquidity = await checkLiquidity(token, issuer);
    res.json(liquidity);
  } catch (error: any) {
    console.error('Liquidity check error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user's owned XRPL tokens (trustlines)
router.get('/api/xrpl/tokens/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!address) {
      return res.status(400).json({ error: 'Address required' });
    }

    const { Client } = await import('xrpl');
    const client = new Client(process.env.XRPL_RPC_URL || 'wss://s1.ripple.com');
    await client.connect();

    try {
      const accountLines = await client.request({
        command: 'account_lines',
        account: address,
        ledger_index: 'validated'
      });

      // Use DexScreener search to get complete token data (same as search endpoint)
      const tokenPromises = accountLines.result.lines
        .filter((line: any) => parseFloat(line.balance) > 0)
        .map(async (line: any) => {
          const symbol = line.currency.length > 3 ? 
            Buffer.from(line.currency, 'hex').toString('ascii').replace(/\0/g, '') : 
            line.currency;
          
          // Use DexScreener search API - same logic as /tokens/search endpoint
          let tokenData: any = {
            symbol,
            currency: line.currency,
            issuer: line.account,
            balance: line.balance,
            logoURI: '',
            icon_url: '',
            logo_url: '',
            price_usd: 0,
            volume_24h: 0,
            price_change_24h: 0
          };
          
          try {
            // First try searching by symbol + issuer for better accuracy
            const searchUrl = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(symbol + ' xrpl')}`;
            console.log(`🔍 Searching DexScreener for owned token: ${symbol}`);
            const response = await fetch(searchUrl);
            if (response.ok) {
              const data = await response.json() as any;
              if (data.pairs && Array.isArray(data.pairs)) {
                // DexScreener format: baseToken.address is "SYMBOL.issuer" or just issuer
                const xrplPairs = data.pairs.filter((p: any) => p.chainId === 'xrpl');
                
                // Find best match by issuer
                let xrplPair = xrplPairs.find((p: any) => {
                  const baseAddr = p.baseToken?.address || '';
                  const quoteAddr = p.quoteToken?.address || '';
                  
                  // Match by issuer (handle both direct issuer and "SYMBOL.issuer" format)
                  return baseAddr === line.account || 
                         baseAddr.endsWith(`.${line.account}`) ||
                         quoteAddr === line.account ||
                         quoteAddr.endsWith(`.${line.account}`);
                });
                
                // If no exact issuer match, try symbol match
                if (!xrplPair && xrplPairs.length > 0) {
                  xrplPair = xrplPairs.find((p: any) => 
                    p.baseToken?.symbol?.toUpperCase() === symbol.toUpperCase() ||
                    p.quoteToken?.symbol?.toUpperCase() === symbol.toUpperCase()
                  );
                }
                
                // Use first XRPL pair as fallback if available
                if (!xrplPair && xrplPairs.length > 0) {
                  xrplPair = xrplPairs[0];
                  console.log(`⚠️ Using first available XRPL pair for ${symbol}`);
                }
                
                if (xrplPair) {
                  const logoUrl = xrplPair.info?.imageUrl || xrplPair.baseToken?.info?.imageUrl || '';
                  tokenData = {
                    ...tokenData,
                    logoURI: logoUrl,
                    icon_url: logoUrl,
                    logo_url: logoUrl,
                    price_usd: parseFloat(xrplPair.priceUsd) || 0,
                    volume_24h: xrplPair.volume?.h24 || 0,
                    price_change_24h: xrplPair.priceChange?.h24 || 0
                  };
                  console.log(`✅ Found DexScreener data for ${symbol}: $${tokenData.price_usd}`);
                } else {
                  console.log(`⚠️ No matching XRPL pair found for ${symbol} with issuer ${line.account}`);
                }
              }
            }
          } catch (error) {
            console.log(`❌ Error fetching DexScreener data for ${symbol}:`, error);
          }
          
          return tokenData;
        });

      const tokens = await Promise.all(tokenPromises);

      // Add XRP as first token
      const accountInfo = await client.request({
        command: 'account_info',
        account: address,
        ledger_index: 'validated'
      });

      const xrpBalance = (parseInt(accountInfo.result.account_data.Balance) / 1000000).toString();
      
      // Get live XRP price from CoinGecko
      let xrpPrice = 0;
      try {
        const priceResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd');
        const priceData = await priceResponse.json();
        xrpPrice = priceData.ripple?.usd || 0;
        console.log(`💰 Live XRP price: $${xrpPrice}`);
      } catch (error) {
        console.error('Failed to fetch XRP price:', error);
        xrpPrice = 2.5; // Fallback price if API fails
      }
      
      const allTokens = [
        {
          symbol: 'XRP',
          currency: 'XRP',
          issuer: '',
          balance: xrpBalance,
          logoURI: '/images/chains/xrp-logo.png',
          icon_url: '/images/chains/xrp-logo.png',
          logo_url: '/images/chains/xrp-logo.png',
          price_usd: xrpPrice,
          volume_24h: 1000000000, // Default volume for XRP
          price_change_24h: 0
        },
        ...tokens
      ];

      await client.disconnect();
      
      res.json({
        success: true,
        tokens: allTokens
      });
    } catch (error) {
      await client.disconnect();
      throw error;
    }
  } catch (error: any) {
    console.error('Error fetching tokens:', error);
    res.status(500).json({ error: error.message });
  }
});

// External wallet payment preparation - NO AUTH REQUIRED (returns unsigned transaction)
router.post('/api/xrpl/external/prepare-payment', async (req, res) => {
  try {
    const { userAddress, toAddress, amount, currency, issuer, destinationTag, memo } = req.body;
    
    if (!userAddress || !toAddress || !amount) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing required parameters: userAddress, toAddress, amount' 
      });
    }
    
    const { prepareExternalWalletPayment } = await import('./xrpl-external-wallet-payment');
    
    const result = await prepareExternalWalletPayment(
      userAddress,
      toAddress,
      amount,
      currency,
      issuer,
      destinationTag,
      memo
    );
    
    res.json(result);
  } catch (error: any) {
    console.error('External payment preparation error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to prepare payment' 
    });
  }
});

export default router;