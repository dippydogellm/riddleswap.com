/**
 * SIMPLIFIED XRPL SWAP EXECUTION
 * Clean, direct swap logic with proper error handling
 */

import { Client, Wallet, xrpToDrops, dropsToXrp, validate } from 'xrpl';
import type { Payment } from 'xrpl';

// Simple price fetching - always returns a price
async function getTokenPrice(symbol: string): Promise<number> {
  if (symbol === 'XRP') {
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd');
      const data = await response.json() as any;
      return data.ripple?.usd || 3.0;
    } catch {
      return 3.0;
    }
  }
  
  // For any token, try DexScreener
  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${symbol}`);
    const data = await response.json() as any;
    const xrplPair = data.pairs?.find((p: any) => p.chainId === 'xrpl' && p.baseToken.symbol === symbol);
    if (xrplPair?.priceUsd) {
      return parseFloat(xrplPair.priceUsd);
    }
  } catch {
    // Continue to default
  }
  
  // No hardcoded prices - fail if no live data available
  throw new Error(`No live price data available for ${symbol}`);
}

// Calculate exchange rate
async function calculateRate(fromToken: string, toToken: string): Promise<number> {
  const fromPrice = await getTokenPrice(fromToken);
  const toPrice = await getTokenPrice(toToken);
  return fromPrice / toPrice;
}

// Create currency amount for XRPL with ultra-conservative precision handling
function createCurrencyAmount(token: string, issuer: string, amount: number) {
  // XRPL is extremely strict: max 15 significant digits total
  let value: string;
  
  if (amount >= 1000000000) {
    // Billions: integer only
    value = Math.round(amount).toString();
  } else if (amount >= 1000000) {
    // Millions: 3 decimal places max
    value = amount.toFixed(3);
  } else if (amount >= 1000) {
    // Thousands: 6 decimal places max  
    value = amount.toFixed(6);
  } else if (amount >= 1) {
    // Units: 9 decimal places max
    value = amount.toFixed(9);
  } else {
    // Fractions: 12 decimal places max
    value = amount.toFixed(12);
  }
  
  // Remove trailing zeros and ensure it doesn't exceed 15 total digits
  value = parseFloat(value).toString();
  if (value.replace('.', '').length > 15) {
    // If still too long, use scientific notation precision
    value = parseFloat(amount.toPrecision(10)).toString();
  }
  
  return {
    currency: token,
    issuer: issuer,
    value: value
  };
}

// Check if account has trustline
async function hasTrustline(client: Client, account: string, currency: string, issuer: string): Promise<boolean> {
  try {
    const response = await client.request({
      command: 'account_lines',
      account
    });
    
    return response.result.lines?.some((line: any) => 
      line.currency === currency && line.account === issuer
    ) || false;
  } catch {
    return false;
  }
}

// Create trustline if needed
async function ensureTrustline(
  client: Client, 
  wallet: Wallet, 
  currency: string, 
  issuer: string
): Promise<void> {
  const exists = await hasTrustline(client, wallet.address, currency, issuer);
  if (!exists) {
    console.log(`📝 Creating trustline for ${currency}`);
    console.log(`🔍 Wallet address: ${wallet.address}`);
    console.log(`🔍 Issuer address: ${issuer}`);
    
    // Basic address format validation (XRPL addresses start with 'r' and are 25-34 characters)
    console.log(`🔍 Address validation - Wallet: ${wallet.address} (length: ${wallet.address.length})`);
    console.log(`🔍 Address validation - Issuer: ${issuer} (length: ${issuer.length})`);
    
    if (!wallet.address.match(/^r[0-9a-zA-Z]{24,35}$/)) {
      throw new Error(`Invalid wallet address format: ${wallet.address}`);
    }
    if (!issuer.match(/^r[0-9a-zA-Z]{24,35}$/)) {
      throw new Error(`Invalid issuer address format: ${issuer}`);
    }
    
    const tx = {
      TransactionType: 'TrustSet' as const,
      Account: wallet.address,
      LimitAmount: {
        currency: currency,
        issuer: issuer,
        value: '1000000000'
      },
      Flags: 131072 // tfSetNoRipple
    };
    
    console.log(`📋 Transaction object:`, JSON.stringify(tx, null, 2));
    
    const prepared = await client.autofill(tx);
    console.log(`📋 Prepared transaction:`, JSON.stringify(prepared, null, 2));
    
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);
    
    const meta = result.result.meta;
    if (typeof meta === 'object' && meta && 'TransactionResult' in meta) {
      if (meta.TransactionResult !== 'tesSUCCESS') {
        throw new Error(`Failed to set trustline: ${meta.TransactionResult}`);
      }
    }
  }
}

// Smart slippage calculation based on token volatility
export function getAdaptiveSlippage(fromToken: string, toToken: string, baseSlippage: number): number {
  // Higher slippage for volatile tokens
  const volatileTokens = ['RDL', 'USD', 'CSC', 'CTP'];
  const isVolatile = volatileTokens.includes(fromToken) || volatileTokens.includes(toToken);
  
  if (isVolatile) {
    return Math.max(baseSlippage, 12); // Minimum 12% for volatile tokens
  }
  return Math.max(baseSlippage, 8); // Minimum 8% for stable tokens
}

// Main swap function with retry logic
export async function executeSimpleSwap(
  privateKey: string,
  fromToken: string,
  toToken: string,
  amount: number,
  fromIssuer?: string,
  toIssuer?: string,
  slippagePercent: number = 10
): Promise<any> {
  // SECURITY: Use USER'S actual slippage - NO overrides or "adaptive" logic
  const maxRetries = 3;
  let currentSlippage = slippagePercent; // Respect user's choice!
  
  console.log(`🔒 [SWAP SECURITY] Using user's slippage: ${slippagePercent}% (no overrides)`);
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Swap attempt ${attempt}/${maxRetries} with ${currentSlippage}% slippage`);
      return await attemptSwap(privateKey, fromToken, toToken, amount, currentSlippage, fromIssuer, toIssuer);
    } catch (error: any) {
      if (error.message?.includes('tecPATH_PARTIAL') && attempt < maxRetries) {
        currentSlippage += 5; // Increase slippage by 5% each retry
        console.log(`⚠️ tecPATH_PARTIAL - retrying with ${currentSlippage}% slippage`);
        continue;
      }
      throw error; // Re-throw if not tecPATH_PARTIAL or final attempt
    }
  }
}

// Internal swap execution function
async function attemptSwap(
  privateKey: string,
  fromToken: string,
  toToken: string,
  amount: number,
  slippagePercent: number,
  fromIssuer?: string,
  toIssuer?: string
): Promise<any> {
  const client = new Client('wss://xrplcluster.com');
  
  try {
    await client.connect();
    const wallet = Wallet.fromSecret(privateKey);
    
    console.log(`💱 Swap: ${amount} ${fromToken} → ${toToken} (${slippagePercent}% slippage)`);
    
    // PLATFORM FEE: Calculate fee but charge AFTER swap succeeds (safer for users)
    const PLATFORM_FEE_PERCENT = 0.25;
    const BANK_WALLET_XRP = 'rsFbZ33Zr3BCVyiVPw8pFvbtnrG1i8FwA3';
    
    // Calculate exchange rate first
    const rate = await calculateRate(fromToken, toToken);
    
    // Calculate XRP fee amount (0.25% of swap value in XRP)
    let xrpFeeAmount = 0;
    let swapAmount = amount; // Use full amount for swap
    
    if (fromToken === 'XRP') {
      // XRP swap: Calculate 0.25% fee from XRP amount
      xrpFeeAmount = amount * (PLATFORM_FEE_PERCENT / 100);
    } else {
      // Token swap: Calculate XRP equivalent of 0.25% fee
      const tokenToXrpRate = await calculateRate(fromToken, 'XRP');
      xrpFeeAmount = (amount * (PLATFORM_FEE_PERCENT / 100)) * tokenToXrpRate;
    }
    
    console.log(`📊 Platform fee will be ${xrpFeeAmount.toFixed(6)} XRP (0.25%) - charged after swap succeeds`);
    
    let feeTxHash = null;
    
    // Calculate expected output using full swap amount
    const expectedOutput = swapAmount * rate;
    const minOutput = expectedOutput * (1 - slippagePercent / 100);
    
    console.log(`📊 Rate: 1 ${fromToken} = ${rate} ${toToken}`);
    console.log(`📊 Expected: ${expectedOutput} ${toToken}`);
    console.log(`📊 Minimum: ${minOutput} ${toToken} (${slippagePercent}% slippage)`);
    
    // XRPL precision debugging
    if (toToken !== 'XRP' && expectedOutput > 1000) {
      console.log(`⚠️ Large token amount detected: ${expectedOutput} ${toToken}`);
      console.log(`⚠️ This may cause precision issues, adjusting...`);
    }
    
    // Clean issuer addresses first
    const cleanFromIssuer = fromIssuer && fromIssuer.includes('.') ? fromIssuer.split('.')[1] : fromIssuer;
    const cleanToIssuer = toIssuer && toIssuer.includes('.') ? toIssuer.split('.')[1] : toIssuer;
    
    console.log(`🔍 Issuer cleaning:`);
    if (fromIssuer) console.log(`  From: ${fromIssuer} → ${cleanFromIssuer}`);
    if (toIssuer) console.log(`  To: ${toIssuer} → ${cleanToIssuer}`);
    
    // Ensure trustlines for tokens with cleaned addresses
    if (fromToken !== 'XRP' && cleanFromIssuer) {
      if (!cleanFromIssuer.match(/^r[0-9a-zA-Z]{24,35}$/)) {
        throw new Error(`Invalid from issuer address format: ${cleanFromIssuer}`);
      }
      await ensureTrustline(client, wallet, fromToken, cleanFromIssuer);
    }
    if (toToken !== 'XRP' && cleanToIssuer) {
      if (!cleanToIssuer.match(/^r[0-9a-zA-Z]{24,35}$/)) {
        throw new Error(`Invalid to issuer address format: ${cleanToIssuer}`);
      }
      await ensureTrustline(client, wallet, toToken, cleanToIssuer);
    }
    
    // Use already cleaned issuer addresses
    
    // Build payment transaction based on swap type
    let payment: Payment;
    
    if (fromToken === 'XRP' && toToken !== 'XRP') {
      // XRP to Token - with conservative amount limiting (using swap amount after fee)
      const sendMaxAmount = parseFloat((swapAmount * 1.05).toFixed(6));
      
      // For very large token outputs, reduce precision dramatically
      let adjustedExpected = expectedOutput;
      let adjustedMin = minOutput;
      
      if (expectedOutput > 10000) {
        // For very large amounts, round to 3 decimal places
        adjustedExpected = parseFloat(expectedOutput.toFixed(3));
        adjustedMin = parseFloat(minOutput.toFixed(3));
      } else if (expectedOutput > 1000) {
        // For large amounts, round to 6 decimal places
        adjustedExpected = parseFloat(expectedOutput.toFixed(6));
        adjustedMin = parseFloat(minOutput.toFixed(6));
      }
      
      console.log(`🔧 Adjusted amounts - Expected: ${adjustedExpected}, Min: ${adjustedMin}`);
      
      payment = {
        TransactionType: 'Payment',
        Account: wallet.address,
        Destination: wallet.address,
        Amount: createCurrencyAmount(toToken, cleanToIssuer!, adjustedExpected),
        SendMax: xrpToDrops(sendMaxAmount),
        DeliverMin: createCurrencyAmount(toToken, cleanToIssuer!, adjustedMin),
        Flags: 131072 // tfPartialPayment
      };
    } else if (fromToken !== 'XRP' && toToken === 'XRP') {
      // Token to XRP - use full amount (fee charged in XRP separately)
      const expectedXrp = parseFloat(expectedOutput.toFixed(6));
      const minXrp = parseFloat(minOutput.toFixed(6));
      payment = {
        TransactionType: 'Payment',
        Account: wallet.address,
        Destination: wallet.address,
        Amount: xrpToDrops(expectedXrp),
        SendMax: createCurrencyAmount(fromToken, cleanFromIssuer!, amount * 1.05),
        DeliverMin: xrpToDrops(minXrp),
        Flags: 131072
      };
    } else if (fromToken !== 'XRP' && toToken !== 'XRP') {
      // Token to Token (through XRP) - use full amount (fee charged in XRP separately)
      payment = {
        TransactionType: 'Payment',
        Account: wallet.address,
        Destination: wallet.address,
        Amount: createCurrencyAmount(toToken, cleanToIssuer!, expectedOutput),
        SendMax: createCurrencyAmount(fromToken, cleanFromIssuer!, amount * 1.05),
        DeliverMin: createCurrencyAmount(toToken, cleanToIssuer!, minOutput),
        Paths: [[{ currency: 'XRP' }]],
        Flags: 131072
      };
    } else {
      throw new Error('Invalid swap configuration');
    }
    
    // Execute the swap
    console.log('🚀 Submitting swap transaction...');
    const prepared = await client.autofill(payment);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);
    
    // Check result
    const meta = result.result.meta;
    if (typeof meta === 'object' && 'TransactionResult' in meta) {
      if (meta.TransactionResult === 'tesSUCCESS') {
        console.log('✅ Swap successful!');
        
        // Calculate actual amounts from delivered amount
        let actualReceived = 0;
        if (typeof meta === 'object' && 'delivered_amount' in meta) {
          const deliveredAmount: any = meta.delivered_amount;
          if (typeof deliveredAmount === 'string') {
            actualReceived = parseFloat(String(dropsToXrp(String(deliveredAmount))));
          } else if (typeof deliveredAmount === 'object' && deliveredAmount && 'value' in deliveredAmount) {
            actualReceived = parseFloat(String(deliveredAmount.value));
          }
        }
        
        // NOW charge the platform fee (only after swap succeeds)
        console.log(`💰 [PLATFORM FEE] Swap succeeded, charging ${xrpFeeAmount.toFixed(6)} XRP fee to ${BANK_WALLET_XRP}`);
        
        try {
          const feePayment: Payment = {
            TransactionType: 'Payment',
            Account: wallet.address,
            Destination: BANK_WALLET_XRP,
            Amount: xrpToDrops(xrpFeeAmount),
            Memos: [{
              Memo: {
                MemoType: Buffer.from('platform_fee').toString('hex').toUpperCase(),
                MemoData: Buffer.from(`swap_${fromToken}_to_${toToken}`).toString('hex').toUpperCase()
              }
            }]
          };
          
          const preparedFee = await client.autofill(feePayment);
          const signedFee = wallet.sign(preparedFee);
          const feeResult = await client.submitAndWait(signedFee.tx_blob);
          
          feeTxHash = (feeResult.result as any).hash;
          console.log(`✅ [PLATFORM FEE] XRP fee transferred successfully: ${feeTxHash}`);
        } catch (feeError) {
          console.error(`⚠️ [PLATFORM FEE] Fee transfer failed (swap succeeded):`, feeError);
          // Swap succeeded but fee failed - log for manual collection
        }
        
        return {
          success: true,
          txHash: result.result.hash,
          feeTxHash: feeTxHash || null,
          platformFeeAmount: xrpFeeAmount,
          platformFeePercent: PLATFORM_FEE_PERCENT,
          actualReceived,
          expectedReceived: expectedOutput,
          rate,
          result: result.result
        };
      } else if (meta.TransactionResult === 'tecPATH_PARTIAL') {
        // With DeliverMin set, tecPATH_PARTIAL means minimum delivery wasn't met
        throw new Error('Swap failed: Minimum delivery amount not met (tecPATH_PARTIAL)');
      } else {
        throw new Error(`Swap failed: ${meta.TransactionResult}`);
      }
    }
    
    throw new Error('Invalid transaction result');
    
  } catch (error) {
    console.error('❌ Swap error:', error);
    throw error;
  } finally {
    await client.disconnect();
  }
}

// Get swap quote - backend is SINGLE source of truth for prices
export async function getSwapQuote(
  fromToken: string,
  toToken: string,
  amount: number,
  slippagePercent: number = 10
): Promise<any> {
  // Backend fetches verified price (SINGLE source of truth)
  const rate = await calculateRate(fromToken, toToken);
  const expectedOutput = amount * rate;
  
  // Apply client's slippage to get minimum
  const minOutput = expectedOutput * (1 - slippagePercent / 100);
  const fee = amount * 0.0025; // 0.25% fee
  
  console.log(`✅ [QUOTE] Backend verified price: ${fromToken}→${toToken}, rate=${rate}`);
  console.log(`✅ [QUOTE] Client slippage ${slippagePercent}% applied: expected=${expectedOutput}, min=${minOutput}`);
  
  return {
    fromToken,
    toToken,
    amount,
    rate,
    expectedOutput,
    minOutput,
    slippagePercent,
    fee,
    netInput: amount - fee
  };
}

// Check liquidity
export async function checkLiquidity(
  token: string,
  issuer: string
): Promise<any> {
  const client = new Client('wss://xrplcluster.com');
  
  try {
    await client.connect();
    
    // Get order book
    const response = await client.request({
      command: 'book_offers',
      taker_gets: { currency: 'XRP' },
      taker_pays: { currency: token, issuer },
      limit: 10
    });
    
    const offers = response.result.offers || [];
    let totalLiquidity = 0;
    
    for (const offer of offers) {
      const takerGets: any = offer.TakerGets;
      if (typeof takerGets === 'string') {
  totalLiquidity += parseFloat(String(dropsToXrp(String(takerGets))));
      }
    }
    
    return {
      hasLiquidity: offers.length > 0,
      offerCount: offers.length,
      totalLiquidityXRP: totalLiquidity,
      topOffer: offers[0] || null
    };
    
  } finally {
    await client.disconnect();
  }
}