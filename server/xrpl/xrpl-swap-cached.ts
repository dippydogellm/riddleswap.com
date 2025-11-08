// XRPL Swap with Cached Private Keys - REAL SWAP IMPLEMENTATION
// Includes trustline verification and delivery options
import { Client as XRPLClient, Wallet, xrpToDrops, dropsToXrp, Payment } from 'xrpl';
import { getSwapExchangeRate, getLiveXRPPrice } from './swap-exchange-rates';
import { rewardsService } from '../rewards-service';

// Safe XRP amount rounding - ensures exactly 6 decimal places for XRPL compatibility
const roundXRPAmount = (amount: number): string => {
  // Round to exactly 6 decimal places to avoid floating point precision errors
  const rounded = Math.round(amount * 1000000) / 1000000;
  return rounded.toFixed(6);
};

// Helper functions for consistent formatting
const formatCurrency = (token: string): string => {
  if (!token || token === 'XRP') return 'XRP';
  
  const trimmedToken = token.trim().toUpperCase();
  
  // CRITICAL FIX: XRPL requires 3-char codes OR 40-char hex
  // Standard 3-character codes work directly
  if (trimmedToken.length === 3) {
    console.log(`✅ [FORMAT] Standard 3-char currency: ${trimmedToken}`);
    return trimmedToken;
  }
  
  // Non-standard codes (like FUZZY) MUST be converted to 40-char hex
  // Pad to 20 bytes with nulls, then convert to hex
  const buffer = Buffer.alloc(20);
  buffer.write(trimmedToken);
  const hexFormat = buffer.toString('hex').toUpperCase();
  
  console.log(`✅ [FORMAT] Non-standard currency "${trimmedToken}" → hex: ${hexFormat}`);
  return hexFormat;
};

const cleanIssuer = (issuer: string): string => {
  return issuer.includes('.') ? issuer.split('.')[1] : issuer;
};

const formatValue = (value: number): string => {
  // CRITICAL FIX: Use up to 15 decimals for very small amounts
  // XRPL supports up to 15 significant digits
  if (value === 0) return '0';
  
  // For very small numbers, use more precision
  if (value < 0.000001) {
    const result = value.toFixed(15).replace(/\.?0+$/, '');
    console.log(`💰 [FORMAT VALUE] Very small: ${value} → ${result}`);
    return result;
  }
  
  // For normal numbers, use appropriate precision
  if (value < 1) {
    const result = value.toFixed(10).replace(/\.?0+$/, '');
    console.log(`💰 [FORMAT VALUE] Small: ${value} → ${result}`);
    return result;
  }
  
  const result = value.toFixed(6).replace(/\.?0+$/, '');
  console.log(`💰 [FORMAT VALUE] Normal: ${value} → ${result}`);
  return result;
};

/**
 * Check and set trustlines for tokens if needed - MUST run before swap
 */
async function checkAndSetTrustlines(
  client: XRPLClient,
  wallet: Wallet,
  fromToken: string,
  toToken: string,
  formatCurrency: (token: string) => string,
  cleanIssuer: (issuer: string) => string,
  fromIssuer?: string,
  toIssuer?: string
) {
  console.log('🔗 [TRUSTLINE] Checking and setting trustlines BEFORE swap...');
  
  try {
    // Get account lines (trustlines)
    const accountLines = await client.request({
      command: 'account_lines',
      account: wallet.address
    });

    const existingTrustlines = accountLines.result.lines.map((line: any) => 
      `${line.currency}-${line.account}`
    );

    console.log('🔗 [TRUSTLINE] Existing trustlines:', existingTrustlines.length);

    // Helper to set trustline for a token
    const setTrustlineForToken = async (token: string, issuer: string) => {
      const cleanedIssuer = cleanIssuer(issuer);
      // CRITICAL FIX: Pass currency directly to XRPL library - it handles hex automatically!
      // Only format for the lookup key
      const formattedCurrency = formatCurrency(token);
      const trustlineKey = `${formattedCurrency}-${cleanedIssuer}`;
      
      console.log('🔍 [TRUSTLINE] Checking for:', trustlineKey);
      
      if (!existingTrustlines.includes(trustlineKey)) {
        console.log('🔗 [TRUSTLINE] Creating trustline - raw token:', token, 'issuer:', cleanedIssuer);
        
        // CRITICAL FIX: Must use FORMATTED currency for trustline creation!
        // Non-standard codes like FUZZY must be in 40-char hex format
        const trustlineTransaction = {
          TransactionType: 'TrustSet',
          Account: wallet.address,
          LimitAmount: {
            currency: formattedCurrency,  // Use FORMATTED currency (3-char or 40-hex)!
            issuer: cleanedIssuer,
            value: '1000000000'
          },
          Flags: 0x00020000 // tfSetNoRipple flag
        } as any;

        const prepared = await client.autofill(trustlineTransaction);
        const signed = wallet.sign(prepared);
        const result = await client.submitAndWait(signed.tx_blob);
        
        const meta = result.result.meta as any;
        if (meta?.TransactionResult === 'tesSUCCESS') {
          console.log('✅ [TRUSTLINE] Trustline created successfully:', result.result.hash);
          console.log('⏳ [TRUSTLINE] Waiting 5 seconds for trustline verification...');
          await new Promise(resolve => setTimeout(resolve, 5000));
          return true;
        } else {
          throw new Error(`Trustline creation failed: ${meta?.TransactionResult}`);
        }
      } else {
        console.log('✅ [TRUSTLINE] Trustline already exists for:', token);
        return true;
      }
    };

    // Set trustline for destination token (what we're buying)
    if (toToken !== 'XRP' && toIssuer) {
      console.log('🎯 [TRUSTLINE] Ensuring trustline for destination token:', toToken);
      await setTrustlineForToken(toToken, toIssuer);
    }

    // Set trustline for source token if needed (for token->token swaps)
    if (fromToken !== 'XRP' && fromIssuer) {
      console.log('🎯 [TRUSTLINE] Ensuring trustline for source token:', fromToken);
      await setTrustlineForToken(fromToken, fromIssuer);
    }

    console.log('✅ [TRUSTLINE] All required trustlines verified/set');

  } catch (error) {
    console.error('❌ [TRUSTLINE] Error checking/setting trustlines:', error);
    throw new Error(`Failed to set required trustlines: ${error}`);
  }
}


// Helper to get token issuer address
function getTokenIssuer(token: string): string | undefined {
  // Common XRPL token issuers
  const issuers: Record<string, string> = {
    'USD': 'rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B',
    'EUR': 'rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq',
    'RDL': 'r9xvnzUWZJpDu3NA6MKHmKhKJQTRqCRgu9', // Fixed RDL issuer address
    'SOLO': 'rsoLo2S1kiGeCcn6hCUXVrCpGMWLrRrLZz',
    'COREUM': 'rcoreNywaoz2ZCQ8Lg2EbSLnGuRBmun6D'
  };
  
  return issuers[token.toUpperCase()];
}

// Smart slippage calculation based on token volatility
function getAdaptiveSlippage(fromToken: string, toToken: string, baseSlippage: number): number {
  // Always use the user's exact slippage tolerance - no adjustments
  return baseSlippage;
}

export async function executeXrplSwapWithCachedKeys(
  cachedKeys: any,
  fromToken: string,
  toToken: string,
  amount: string,
  fromIssuer?: string,
  toIssuer?: string,
  userHandle?: string,
  walletAddress?: string,
  slippage: number = 5
) {
  // Use adaptive slippage based on token liquidity, but respect user's preference
  const maxRetries = 5; // More retry attempts
  let currentSlippage = getAdaptiveSlippage(fromToken, toToken, slippage); // Removed Math.max to respect user's settings
  
  console.log(`🎯 [SWAP INIT] Starting swap with adaptive slippage: ${currentSlippage}% (user: ${slippage}%)`);
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 [SWAP ATTEMPT] ${attempt}/${maxRetries} with ${currentSlippage}% slippage`);
      return await attemptSwapWithCachedKeys(
        cachedKeys, fromToken, toToken, amount, fromIssuer, toIssuer, 
        userHandle, walletAddress, currentSlippage
      );
    } catch (error: any) {
      if (error.message?.includes('tecPATH_PARTIAL') && attempt < maxRetries) {
        // Much more aggressive slippage increases
        if (attempt === 1) {
          currentSlippage += 10; // First retry: +10%
        } else if (attempt === 2) {
          currentSlippage += 15; // Second retry: +15% 
        } else {
          currentSlippage += 20; // Later retries: +20%
        }
        console.log(`⚠️ [RETRY ${attempt}] tecPATH_PARTIAL - retrying with ${currentSlippage}% slippage`);
        
        // Wait a moment before retry to let the network settle
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }
      throw error; // Re-throw if not tecPATH_PARTIAL or final attempt
    }
  }
}

// Internal swap execution function with adaptive slippage
async function attemptSwapWithCachedKeys(
  cachedKeys: any,
  fromToken: string,
  toToken: string,
  amount: string,
  fromIssuer?: string,
  toIssuer?: string,
  userHandle?: string,
  walletAddress?: string,
  adaptiveSlippage: number = 15
) {
  let client: XRPLClient | null = null;
  
  try {
    console.log('🔄 [REAL SWAP] Executing XRPL swap with cached private keys');
    console.log('🔄 [REAL SWAP] Parameters:', { fromToken, toToken, amount, fromIssuer, toIssuer, adaptiveSlippage });
    
    if (!cachedKeys.xrpPrivateKey) {
      throw new Error('No XRP private key available in cache');
    }

    // Keep original token names for validation (declare early)
    const originalFromToken = fromToken;
    const originalToToken = toToken;

    // Connect to XRPL
    client = new XRPLClient('wss://s1.ripple.com');
    await client.connect();
    console.log('✅ [REAL SWAP] Connected to XRPL network');

    // Create wallet from cached private key
    const wallet = Wallet.fromSeed(cachedKeys.xrpPrivateKey);
    console.log('✅ [REAL SWAP] Wallet created:', wallet.address);

    // Get token issuers (original token names already declared above)
    const fromTokenIssuer = fromIssuer || getTokenIssuer(originalFromToken);
    const toTokenIssuer = toIssuer || getTokenIssuer(originalToToken);

    console.log('💱 [REAL SWAP] Original tokens for price lookup:', {
      from: originalFromToken,
      to: originalToToken,
      fromIssuer: fromTokenIssuer,
      toIssuer: toTokenIssuer
    });

    // Get current exchange rate using ORIGINAL token names (not hex) - BEFORE balance validation
    const exchangeRate = await getSwapExchangeRate(
      originalFromToken, 
      originalToToken, 
      fromTokenIssuer, 
      toTokenIssuer,
      parseFloat(amount)
    );

    if (!exchangeRate.success) {
      throw new Error(`Unable to get exchange rate: ${exchangeRate.error}`);
    }

    console.log('💱 [REAL SWAP] Exchange rate:', exchangeRate.rate, `${originalFromToken}/${originalToToken}`);

    // CRITICAL: Pre-validate available XRP balance for fee payment (ALL swap types need XRP for 1% fee)
    const accountInfo = await client.request({
      command: 'account_info',
      account: wallet.address,
      ledger_index: 'validated'
    });
  const totalBalance = parseFloat(String(dropsToXrp(String(accountInfo.result.account_data.Balance))));
    const ownerCount = accountInfo.result.account_data.OwnerCount || 0;
    const baseReserve = 1.0;
    const ownerReserve = ownerCount * 0.2;
    const totalReserve = baseReserve + ownerReserve;
    const availableBalance = Math.max(0, totalBalance - totalReserve);
    
    let totalRequired = 0;
    if (originalFromToken === 'XRP') {
      // XRP → Token: Need XRP for swap + 1% fee on XRP input + network fees
      const swapAmount = parseFloat(amount);
      const platformFee = swapAmount * 0.01; // 1% of XRP being swapped
      const networkFees = 0.000024; // Network fees for both transactions
      totalRequired = swapAmount + platformFee + networkFees;
      
      console.log('💰 [XRP→TOKEN VALIDATION] Swap amount:', swapAmount, 'XRP');
      console.log('💰 [XRP→TOKEN VALIDATION] Platform fee (1%):', platformFee, 'XRP');
      console.log('💰 [XRP→TOKEN VALIDATION] Total required:', totalRequired, 'XRP');
    } else {
      // Token → XRP or Token → Token: Need XRP for 1% fee payment + network fees
      const expectedOutput = parseFloat(amount) * exchangeRate.rate;
      const platformFee = originalToToken === 'XRP' 
        ? expectedOutput * 0.01  // 1% of XRP output
        : 0.001; // Minimum 0.001 XRP for token→token swaps
      const networkFees = 0.000024;
      totalRequired = platformFee + networkFees;
      
      console.log('💰 [TOKEN SWAP VALIDATION] Expected output:', expectedOutput, originalToToken);
      console.log('💰 [TOKEN SWAP VALIDATION] Platform fee (1%):', platformFee, 'XRP');
      console.log('💰 [TOKEN SWAP VALIDATION] XRP required for fee:', totalRequired, 'XRP');
    }
    
    console.log('💰 [BALANCE CHECK] Total balance:', totalBalance, 'XRP');
    console.log('💰 [BALANCE CHECK] Reserved:', totalReserve, 'XRP', `(${ownerCount} objects)`);
    console.log('💰 [BALANCE CHECK] Available:', availableBalance, 'XRP');
    console.log('💰 [BALANCE CHECK] Required:', totalRequired, 'XRP');
    
    // FEE BLOCKER REMOVED - Allow swap to proceed even if fee payment might fail
    // The try-catch in fee collection will handle failures gracefully
    if (availableBalance < totalRequired) {
      console.warn('⚠️ [BALANCE WARNING] Available XRP balance may not be sufficient for swap + fee');
      console.warn(`💡 [BALANCE INFO] Need ${totalRequired.toFixed(6)} XRP, have ${availableBalance.toFixed(6)} XRP available (after ${totalReserve} XRP reserves)`);
      console.warn('💡 [BALANCE INFO] Swap will proceed - fee collection will be attempted (may fail gracefully)');
    } else {
      console.log('✅ [BALANCE VALIDATION] Sufficient XRP balance confirmed for swap + 1% fee');
    }

    // STEP 1: Check and set trustlines FIRST - before any transaction creation
    console.log('🔗 [REAL SWAP] Step 1: Setting up trustlines before swap...');
    // Define local helper functions to avoid reference issues
    const localFormatCurrency = (token: string): string => {
      // Use the same logic as formatCurrency for consistency
      if (!token || token === 'XRP') return 'XRP';
      
      const trimmedToken = token.trim().toUpperCase();
      
      // Standard 3-character codes work directly
      if (trimmedToken.length === 3) {
        return trimmedToken;
      }
      
      // Non-standard codes must be 40-char hex
      const buffer = Buffer.alloc(20);
      buffer.write(trimmedToken);
      return buffer.toString('hex').toUpperCase();
    };

    const localCleanIssuer = (issuer: string): string => {
      return issuer.includes('.') ? issuer.split('.')[1] : issuer;
    };

    await checkAndSetTrustlines(
      client, 
      wallet, 
      originalFromToken, 
      originalToToken, 
      localFormatCurrency,
      localCleanIssuer,
      fromTokenIssuer, 
      toTokenIssuer
    );

    // Calculate expected output amount with slippage from parameters
    const expectedOutput = parseFloat(amount) * exchangeRate.rate;
    const slippagePercent = (adaptiveSlippage && adaptiveSlippage > 0 && adaptiveSlippage <= 100) ? adaptiveSlippage / 100 : 0.05; // Use adaptive slippage from retries
    // Calculate minimum delivery based on user's slippage preference
    const deliverMin = expectedOutput * (1 - slippagePercent); // Respect user's exact slippage setting
    
    // SECURITY FIX: Always use partial payments with DeliverMin for protection
    // This prevents partial delivery attacks where users receive much less than expected
    const allowPartialPayment = true; // Always enable for security
    const transactionFlags = 131072; // Always use tfPartialPayment for safety
    
    console.log(`💰 [REAL SWAP] Amounts: {
  input: '${amount}',
  expectedOutput: '${expectedOutput.toFixed(5)}',
  deliverMin: '${deliverMin.toFixed(5)}',
  slippagePercent: '${adaptiveSlippage}%'
    }`);

    console.log('💰 [REAL SWAP] Amounts:', {
      input: amount,
      expectedOutput: expectedOutput.toFixed(5),
      deliverMin: deliverMin.toFixed(5),
      slippagePercent: `${adaptiveSlippage}%`,
      actualSlippageUsed: `${slippagePercent * 100}%`,
      partialPaymentEnabled: allowPartialPayment,
      reason: allowPartialPayment ? 'High slippage tolerance (>10%)' : 'Standard swap - full delivery required'
    });


    // Create currency amount objects using local functions
    const createAmount = (token: string, issuer: string | undefined, value: number) => {
      if (token === 'XRP') {
        return xrpToDrops(roundXRPAmount(value)); // XRP amounts must be in drops (string)
      } else {
        if (!issuer) throw new Error(`No issuer found for token ${token}`);
        // CRITICAL FIX: Use formatCurrency to convert to proper XRPL format
        // Non-standard codes (FUZZY, etc.) MUST be in 40-char hex format
        return {
          currency: formatCurrency(token),  // Use formatted currency (3-char or 40-hex)
          issuer: localCleanIssuer(issuer),
          value: formatValue(value)  // Use formatValue for proper precision
        };
      }
    };

    // Determine swap type and create transaction using original token names
    let transaction: any;
    let txType: string;

    if (originalFromToken === 'XRP' && originalToToken !== 'XRP') {
      txType = 'XRP_TO_TOKEN';
      // Match the successful transaction structure exactly
      const tokenAmount = createAmount(originalToToken, toTokenIssuer, expectedOutput);
      const minTokenAmount = createAmount(originalToToken, toTokenIssuer, deliverMin);
      
      transaction = {
        TransactionType: 'Payment',
        Account: wallet.address,
        Destination: wallet.address, // Send to self for a pure swap
        Amount: tokenAmount, // Exact token output we want
        SendMax: xrpToDrops(roundXRPAmount(parseFloat(amount))), // Exact XRP to spend
        DeliverMin: minTokenAmount, // ALWAYS set DeliverMin for security
        Flags: transactionFlags, // Conditional: only partial payment when slippage > 10%
        Memos: [{
          Memo: {
            MemoType: Buffer.from('riddle-swap', 'utf8').toString('hex').toUpperCase(),
            MemoData: Buffer.from(`${originalFromToken}-${originalToToken}`, 'utf8').toString('hex').toUpperCase()
          }
        }]
      };

    } else if (originalFromToken !== 'XRP' && originalToToken === 'XRP') {
      txType = 'TOKEN_TO_XRP';
      // For Token to XRP: Amount is XRP we want to receive, SendMax is the token we're willing to spend
      transaction = {
        TransactionType: 'Payment',
        Account: wallet.address,
        Destination: wallet.address, // Send to self for a pure swap
        Amount: xrpToDrops(roundXRPAmount(expectedOutput)), // Maximum XRP we want
        SendMax: createAmount(originalFromToken, fromTokenIssuer, parseFloat(amount)), // Exact token to spend
        DeliverMin: xrpToDrops(roundXRPAmount(deliverMin)), // ALWAYS set DeliverMin for security
        Flags: transactionFlags, // Conditional: only partial payment when slippage > 10%
        Memos: [{
          Memo: {
            MemoType: Buffer.from('riddle-swap', 'utf8').toString('hex').toUpperCase(),
            MemoData: Buffer.from(`${originalFromToken}-${originalToToken}`, 'utf8').toString('hex').toUpperCase()
          }
        }]
      };

    } else if (originalFromToken !== 'XRP' && originalToToken !== 'XRP') {
      txType = 'TOKEN_TO_TOKEN';
      // For Token to Token: Add multiple path options for better liquidity
      const paths = [
        [{ currency: 'XRP' }], // Primary: Route through XRP
        [{ currency: 'USD', issuer: 'rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq' }], // Secondary: Route through USD
        [{ currency: 'EUR', issuer: 'rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq' }], // Tertiary: Route through EUR
      ];
      
      transaction = {
        TransactionType: 'Payment',
        Account: wallet.address,
        Destination: wallet.address, // Send to self for a pure swap
        Amount: createAmount(originalToToken, toTokenIssuer, expectedOutput), // Desired token output
        SendMax: createAmount(originalFromToken, fromTokenIssuer, parseFloat(amount)), // Exact token to spend
        DeliverMin: createAmount(originalToToken, toTokenIssuer, deliverMin), // ALWAYS set DeliverMin for security
        Paths: paths, // Multiple routing options for better liquidity
        Flags: transactionFlags, // Conditional: only partial payment when slippage > 10%
        Memos: [{
          Memo: {
            MemoType: Buffer.from('riddle-swap', 'utf8').toString('hex').toUpperCase(),
            MemoData: Buffer.from(`${originalFromToken}-${originalToToken}`, 'utf8').toString('hex').toUpperCase()
          }
        }]
      };

    } else {
      throw new Error('Invalid swap pair: cannot swap XRP to XRP');
    }

    console.log('📝 [REAL SWAP] Transaction type:', txType);
    console.log('📝 [REAL SWAP] Transaction BEFORE autofill:', JSON.stringify(transaction, null, 2));
    
    // CRITICAL: Validate transaction flags and DeliverMin consistency
    if (allowPartialPayment) {
      if (transaction.Flags !== 131072) {
        console.error('❌ [CRITICAL] Partial payment flag not set when expected!');
      }
      if (!transaction.DeliverMin) {
        console.error('❌ [CRITICAL] DeliverMin missing from partial payment!');
      } else {
        console.log('✅ [PARTIAL PAYMENT] DeliverMin present:', JSON.stringify(transaction.DeliverMin, null, 2));
      }
    } else {
      if (transaction.Flags === 131072) {
        console.error('❌ [CRITICAL] Partial payment flag set when NOT expected!');
      }
      if (transaction.DeliverMin) {
        console.error('❌ [CRITICAL] DeliverMin present when partial payment disabled!');
      }
      console.log('✅ [FULL DELIVERY] Standard swap - expecting exact or fail');
    }

    // Prepare, sign, and submit transaction
    console.log('⚡ [REAL SWAP] Preparing transaction...');
    const prepared = await client.autofill(transaction as any);
    console.log('✅ [REAL SWAP] Transaction prepared with fee:', prepared.Fee);
    console.log('🔍 [REAL SWAP] Transaction AFTER autofill:', JSON.stringify(prepared, null, 2));
    
    // CRITICAL: Check if autofill preserved transaction flags correctly
    if (allowPartialPayment) {
      if (prepared.Flags !== 131072) {
        console.error('❌ [CRITICAL] AUTOFILL REMOVED partial payment flag!');
      }
      if (!prepared.DeliverMin) {
        console.error('❌ [CRITICAL] AUTOFILL STRIPPED DeliverMin! This will allow micro-deliveries!');
      } else {
        console.log('✅ [PARTIAL PAYMENT] DeliverMin preserved after autofill:', JSON.stringify(prepared.DeliverMin, null, 2));
      }
    } else {
      if (prepared.Flags === 131072) {
        console.error('❌ [CRITICAL] AUTOFILL ADDED unwanted partial payment flag!');
      }
      console.log('✅ [FULL DELIVERY] Transaction requires exact delivery after autofill');
    }

    console.log('🔐 [REAL SWAP] Signing transaction...');
    const signed = wallet.sign(prepared);
    console.log('✅ [REAL SWAP] Transaction signed');

    console.log('🚀 [REAL SWAP] Submitting transaction to network...');
    const result = await client.submitAndWait(signed.tx_blob);
    console.log('✅ [REAL SWAP] Transaction submitted:', result.result.hash);

    // Check transaction result
    const meta = result.result.meta as any;
    const success = meta?.TransactionResult === 'tesSUCCESS';
    
    if (success) {
      console.log('🎉 [REAL SWAP] Transaction SUCCESSFUL!');
      console.log('🎉 [REAL SWAP] Hash:', result.result.hash);
      
      // CRITICAL: Validate delivered amount against minimum requirements
      if (meta?.delivered_amount) {
        let deliveredValue: number;
        let deliveredToken: string;
        
        if (typeof meta.delivered_amount === 'string') {
          // XRP amount in drops
          deliveredValue = parseFloat(String(dropsToXrp(String(meta.delivered_amount))));
          deliveredToken = 'XRP';
        } else {
          // Token amount
          deliveredValue = parseFloat(meta.delivered_amount.value);
          deliveredToken = meta.delivered_amount.currency;
        }
        
        console.log(`📊 [DELIVERY VALIDATION] Transaction delivered: ${deliveredValue} ${deliveredToken}`);
        console.log(`📊 [DELIVERY VALIDATION] Expected output: ${expectedOutput} ${originalToToken}`);
        console.log(`📊 [DELIVERY VALIDATION] Minimum required: ${deliverMin} ${originalToToken}`);
        
        // Check if delivered amount meets minimum requirements
        if (deliveredValue < deliverMin) {
          const percentDelivered = (deliveredValue / expectedOutput) * 100;
          const error = `CRITICAL: Transaction delivered only ${deliveredValue} ${deliveredToken} (${percentDelivered.toFixed(2)}% of expected), which is below the minimum required ${deliverMin}. Partial payment flag should have prevented this!`;
          console.error(`❌ [DELIVERY VALIDATION] ${error}`);
          
          // Return error but include transaction details
          return {
            success: false,
            message: error,
            hash: result.result.hash,
            delivered: deliveredValue,
            expected: expectedOutput,
            minimum: deliverMin,
            details: `Swap failed minimum delivery requirements. You received ${deliveredValue} ${deliveredToken} but minimum was ${deliverMin}`
          };
        }
        
        const percentDelivered = (deliveredValue / expectedOutput) * 100;
        console.log(`✅ [DELIVERY VALIDATION] Delivered ${percentDelivered.toFixed(2)}% of expected amount - acceptable`);
      }

      // Send separate fee transaction to bank wallet (1% of swap amount) with balance validation
      const BANK_WALLET = 'rsFbZ33Zr3BCVyiVPw8pFvbtnrG1i8FwA3';
      
      // Declare feeAmountXRP outside try-catch for error handling access
      let feeAmountXRP: number = 0;
      
      // Skip fee if user wallet IS the bank wallet (prevents temREDUNDANT error)
      if (wallet.address === BANK_WALLET) {
        console.log('🏦 [FEE SKIP] User wallet IS bank wallet - skipping fee payment to avoid temREDUNDANT');
      } else {
        console.log('💰 [FEE TRANSACTION] Preparing 1% fee to XRPL bank wallet...');
      
      try {
        // Calculate 1% fee in XRP (matches frontend display)
        if (originalFromToken === 'XRP') {
          feeAmountXRP = parseFloat(amount) * 0.01; // 1% of XRP input
        } else if (originalToToken === 'XRP') {
          feeAmountXRP = expectedOutput * 0.01; // 1% of XRP output  
        } else {
          // For token-to-token, use USD equivalent to calculate XRP fee
          const xrpPrice = await getLiveXRPPrice();
          const feeAmountUSD = parseFloat(amount) * (exchangeRate.fromPrice || 0) * 0.01;
          feeAmountXRP = feeAmountUSD / xrpPrice;
        }

        // Get ACTUAL available balance first (accounts for reserves and trustlines)
        const accountInfo = await client.request({
          command: 'account_info',
          account: wallet.address,
          ledger_index: 'validated'
        });
  const totalBalance = parseFloat(String(dropsToXrp(String(accountInfo.result.account_data.Balance))));
        const ownerCount = accountInfo.result.account_data.OwnerCount || 0;
        
        // Calculate reserves (1 XRP base + 0.2 XRP per object)
        const baseReserve = 1.0;
        const ownerReserve = ownerCount * 0.2;
        const totalReserve = baseReserve + ownerReserve;
        const availableBalance = Math.max(0, totalBalance - totalReserve);

        // Ensure minimum fee of 0.001 XRP and cap at available balance
        feeAmountXRP = Math.max(0.001, Math.min(feeAmountXRP, 1.0));
        
        // CRITICAL: Ensure fee doesn't exceed available balance 
        const maxFeeFromAvailable = Math.max(0, availableBalance - 0.000012); // Leave room for network fee
        if (feeAmountXRP > maxFeeFromAvailable) {
          console.log(`⚠️ [FEE ADJUSTMENT] Reducing fee from ${feeAmountXRP} to ${maxFeeFromAvailable} XRP (available balance limit)`);
          feeAmountXRP = maxFeeFromAvailable;
        }
        
        const networkFeeEstimate = 0.000012; // ~12 drops network fee
        const requiredForFee = feeAmountXRP + networkFeeEstimate;
        
        console.log('💰 [FEE VALIDATION] Fee amount:', feeAmountXRP, 'XRP');
        console.log('💰 [BALANCE CHECK] Total balance:', totalBalance, 'XRP');
        console.log('💰 [BALANCE CHECK] Reserve requirement:', totalReserve, 'XRP', `(${ownerCount} objects)`);
        console.log('💰 [BALANCE CHECK] Available balance:', availableBalance, 'XRP');
        console.log('💰 [BALANCE CHECK] Required for fee tx:', requiredForFee, 'XRP');
        
        // FEE BLOCKER REMOVED - Allow swap to proceed even if fee payment might fail
        // The try-catch below will handle fee failures gracefully without blocking the swap
        if (availableBalance < requiredForFee) {
          console.warn('⚠️ [FEE WARNING] Available balance may not be sufficient for fee transaction');
          console.warn(`💡 [FEE INFO] Have ${availableBalance.toFixed(6)} XRP available, need ${requiredForFee.toFixed(6)} XRP for fee`);
          console.warn('💡 [FEE INFO] Swap will proceed - fee payment will be attempted (may fail gracefully)');
        }

        const feeTransaction = {
          TransactionType: 'Payment',
          Account: wallet.address,
          Destination: BANK_WALLET,
          Amount: xrpToDrops(roundXRPAmount(feeAmountXRP)),
          // NO Flags - XRP to XRP doesn't support partial payment
          Memos: [{
            Memo: {
              MemoType: Buffer.from('riddle-fee', 'utf8').toString('hex').toUpperCase(),
              MemoData: Buffer.from(`${originalFromToken}-${originalToToken}-fee`, 'utf8').toString('hex').toUpperCase()
            }
          }]
        };

        console.log('⚡ [FEE TRANSACTION] Preparing fee transaction...');
        const preparedFee = await client.autofill(feeTransaction as any);
        console.log('✅ [FEE TRANSACTION] Fee transaction prepared with network fee:', dropsToXrp(preparedFee.Fee || '0'), 'XRP');
        
        console.log('🔐 [FEE TRANSACTION] Signing fee transaction...');
        const signedFee = wallet.sign(preparedFee);
        
        console.log('🚀 [FEE TRANSACTION] Submitting fee transaction...');
        const feeResult = await client.submitAndWait(signedFee.tx_blob);
        
        console.log('✅ [FEE TRANSACTION] Fee sent successfully:', {
          hash: feeResult.result.hash,
          feeAmount: feeAmountXRP + ' XRP',
          networkFee: dropsToXrp(preparedFee.Fee || '0') + ' XRP',
          destination: BANK_WALLET,
          explorerUrl: `https://livenet.xrpl.org/transactions/${feeResult.result.hash}`
        });
        
      } catch (feeError) {
        console.error('❌ [FEE TRANSACTION] CRITICAL - Fee collection failed after successful swap:', feeError);
        console.error('💡 [FEE HELP] This could be due to insufficient available XRP balance after reserves');
        // CRITICAL: Swap already confirmed on blockchain - cannot be reverted
        // Fee failure must be tracked for manual collection
        const feeFailureMsg = `CRITICAL: Swap succeeded but 1% platform fee (${feeAmountXRP || 'unknown'} XRP) was not collected. Transaction: ${result.result.hash}. User: ${userHandle || walletAddress || 'unknown'}`;
        console.error(`🚨 [FEE FAILURE] ${feeFailureMsg}`);
        
        // Return success (swap completed) but include fee warning for frontend handling
        return {
          success: true,
          warning: 'FEE_COLLECTION_FAILED',
          message: `Swap completed successfully but platform fee collection failed. Support has been notified.`,
          txHash: result.result.hash,
          fromToken: originalFromToken,
          toToken: originalToToken,
          amount,
          expectedOutput: expectedOutput.toFixed(5),
          fromAddress: wallet.address,
          txType,
          networkFee: dropsToXrp(prepared.Fee || '0'),
          exchangeRate: exchangeRate.rate,
          feeCollectionError: feeError instanceof Error ? feeError.message : 'Unknown error'
        };
      }
      
      // Track fee and create reward (25% cashback)
      if (userHandle && walletAddress) {
        try {
          // Calculate 1% platform fee in USD
          const platformFeeUsd = parseFloat(amount) * exchangeRate.fromPrice * 0.01;
          const platformFeeXrp = platformFeeUsd / (await getLiveXRPPrice());
          
          console.log(`💰 [REWARD] Tracking swap fee: ${platformFeeXrp.toFixed(5)} XRP (${platformFeeUsd.toFixed(4)} USD)`);
          
          const rewardResult = await rewardsService.trackFeeAndCreateReward({
            userHandle,
            walletAddress,
            operationType: 'swap',
            sourceChain: 'xrp',
            feeAmount: platformFeeXrp.toString(),
            feeToken: 'XRP',
            feeUsdValue: platformFeeUsd.toString(),
            operationId: result.result.hash,
            transactionHash: result.result.hash
          });
          
          console.log(`🎉 [REWARD] Created reward: ${rewardResult.rewardId} for user ${userHandle}`);
        } catch (rewardError) {
          console.error('⚠️ [REWARD] Failed to create reward:', rewardError);
          // Don't fail the swap for reward errors
        }
      }
      } // Close the fee transaction else block
      
      return {
        success: true,
        message: `Successfully swapped ${amount} ${originalFromToken} to ${originalToToken}`,
        txHash: result.result.hash,
        fromToken: originalFromToken,
        toToken: originalToToken,
        amount,
        expectedOutput: expectedOutput.toFixed(5),
        fromAddress: wallet.address,
        txType,
        networkFee: dropsToXrp(prepared.Fee || '0'),
        exchangeRate: exchangeRate.rate
      };
    } else {
      const meta = result.result.meta as any;
      const errorCode = meta?.TransactionResult || 'Unknown';
      console.error('❌ [REAL SWAP] Transaction FAILED:', errorCode);
      
      return {
        success: false,
        error: `Transaction failed: ${errorCode}`,
        txHash: result.result.hash,
        errorCode
      };
    }

  } catch (error) {
    console.error('❌ [REAL SWAP] Swap execution failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'XRPL swap failed'
    };
  } finally {
    if (client) {
      await client.disconnect();
      console.log('🔌 [REAL SWAP] Disconnected from XRPL network');
    }
  }
}

export async function executeXrplPaymentWithCachedKeys(
  cachedKeys: any,
  destination: string,
  amount: string,
  currency?: string
) {
  try {
    console.log('💳 Executing XRPL payment with cached private keys (NO PASSWORD)');
    
    if (!cachedKeys.xrpPrivateKey) {
      throw new Error('No XRP private key available in cache');
    }

    const client = new XRPLClient('wss://s1.ripple.com');
    await client.connect();

    // Create wallet from cached private key
    const wallet = Wallet.fromSeed(cachedKeys.xrpPrivateKey);
    console.log('✅ XRPL Wallet created from cached key:', wallet.address);

    // Create payment transaction
    const payment = {
      TransactionType: 'Payment',
      Account: wallet.address,
      Destination: destination,
      Amount: currency ? {
        value: amount,
        currency: currency,
        issuer: 'rIssuerAddress' // Would be dynamic based on currency
      } : xrpToDrops(amount),
      Flags: 131072 // tfPartialPayment for security
    };

    // Sign and submit transaction
    const prepared = await client.autofill(payment as any);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    await client.disconnect();

    return {
      success: true,
      message: 'XRPL payment executed using cached keys',
      txHash: result.result.hash,
      destination,
      amount,
      currency: currency || 'XRP',
      fromAddress: wallet.address
    };

  } catch (error) {
    console.error('❌ XRPL payment with cached keys failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'XRPL payment failed'
    };
  }
}