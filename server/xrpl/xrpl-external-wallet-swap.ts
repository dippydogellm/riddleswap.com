// XRPL Swap for External Wallets (Xaman/Joey) - Signing-based flow
// Prepares transactions for user signing, no private keys required

import { Client as XRPLClient, Payment, convertStringToHex } from 'xrpl';
import { getSwapExchangeRate, getLiveXRPPrice } from './swap-exchange-rates';

// Helper functions for consistent formatting
const formatCurrency = (token: string): string => {
  if (token === 'XRP') return 'XRP';
  
  // Check if already a 40-character hex string (standard XRPL currency format)
  if (token.length === 40 && /^[0-9A-F]+$/i.test(token)) {
    console.log(`🔤 [FORMAT] Currency already in hex format: ${token}`);
    return token.toUpperCase();
  }
  
  if (token.length <= 3) {
    return token.padEnd(3).toUpperCase();
  } else {
    return Buffer.from(token.padEnd(20, '\0')).toString('hex').toUpperCase();
  }
};

const cleanIssuer = (issuer: string): string => {
  return issuer.includes('.') ? issuer.split('.')[1] : issuer;
};

// Helper to get token issuer address
function getTokenIssuer(token: string): string | undefined {
  const issuers: Record<string, string> = {
    'USD': 'rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B',
    'EUR': 'rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq',
    'RDL': 'r9xvnzUWZJpDu3NA6MKHmKhKJQTRqCRgu9',
    'SOLO': 'rsoLo2S1kiGeCcn6hCUXVrCpGMWLrRrLZz',
    'COREUM': 'rcoreNywaoz2ZCQ8Lg2EbSLnGuRBmun6D'
  };
  return issuers[token.toUpperCase()];
}

/**
 * Prepare a swap transaction for external wallet signing
 * Returns transaction JSON that user will sign with their wallet
 */
export async function prepareExternalWalletSwap(
  userAddress: string,
  fromToken: string,
  toToken: string,
  amount: string,
  fromIssuer?: string,
  toIssuer?: string,
  slippage: number = 5
): Promise<any> {
  let client: XRPLClient | null = null;
  
  try {
    console.log('🔄 [EXTERNAL SWAP PREP] Preparing swap transaction for external wallet');
    console.log('📊 [EXTERNAL SWAP PREP] Params:', { userAddress, fromToken, toToken, amount, slippage });
    
    // Validate user address
    if (!userAddress || !userAddress.startsWith('r') || userAddress.length !== 34) {
      throw new Error('Invalid XRPL address');
    }

    // Connect to XRPL
    client = new XRPLClient('wss://s1.ripple.com');
    await client.connect();
    console.log('✅ [EXTERNAL SWAP PREP] Connected to XRPL');

    // Get swap quote
    const { getSwapQuote } = await import('./swap-exchange-rates');
    const quoteResult = await getSwapQuote(
      fromToken,
      toToken,
      parseFloat(amount),
      fromIssuer,
      toIssuer
    );

    if (!quoteResult.success) {
      throw new Error(quoteResult.error || 'Failed to get swap quote');
    }

    const { estimatedOutput, minimumReceived, rate } = quoteResult;
    console.log('💱 [EXTERNAL SWAP PREP] Exchange rate calculated:', estimatedOutput, toToken);

    // Auto-detect issuers if not provided
    if (!fromIssuer && fromToken !== 'XRP') {
      fromIssuer = getTokenIssuer(fromToken);
    }
    if (!toIssuer && toToken !== 'XRP') {
      toIssuer = getTokenIssuer(toToken);
    }

    // Prepare the payment transaction
    let txJson: any;

    if (fromToken === 'XRP') {
      // XRP → Token swap
      const cleanedToIssuer = cleanIssuer(toIssuer!);
      const formattedToCurrency = formatCurrency(toToken);
      
      txJson = {
        TransactionType: 'Payment',
        Account: userAddress,
        Destination: userAddress, // Self-payment for swap
        Amount: {
          currency: formattedToCurrency,
          value: estimatedOutput.toString(), // Maximum willing to receive
          issuer: cleanedToIssuer
        },
        DeliverMin: {
          currency: formattedToCurrency,
          value: minimumReceived.toString(), // Minimum must receive (slippage protection)
          issuer: cleanedToIssuer
        },
        SendMax: (parseFloat(amount) * 1000000).toString(), // XRP in drops
        Flags: 131072 // tfPartialPayment
      };
    } else if (toToken === 'XRP') {
      // Token → XRP swap
      const cleanedFromIssuer = cleanIssuer(fromIssuer!);
      const formattedFromCurrency = formatCurrency(fromToken);
      
      txJson = {
        TransactionType: 'Payment',
        Account: userAddress,
        Destination: userAddress,
        Amount: (estimatedOutput * 1000000).toString(), // XRP in drops (maximum)
        DeliverMin: (minimumReceived * 1000000).toString(), // XRP in drops (minimum with slippage)
        SendMax: {
          currency: formattedFromCurrency,
          value: amount,
          issuer: cleanedFromIssuer
        },
        Flags: 131072
      };
    } else {
      // Token → Token swap
      const cleanedFromIssuer = cleanIssuer(fromIssuer!);
      const cleanedToIssuer = cleanIssuer(toIssuer!);
      const formattedFromCurrency = formatCurrency(fromToken);
      const formattedToCurrency = formatCurrency(toToken);
      
      txJson = {
        TransactionType: 'Payment',
        Account: userAddress,
        Destination: userAddress,
        Amount: {
          currency: formattedToCurrency,
          value: estimatedOutput.toString(), // Maximum willing to receive
          issuer: cleanedToIssuer
        },
        DeliverMin: {
          currency: formattedToCurrency,
          value: minimumReceived.toString(), // Minimum must receive (slippage protection)
          issuer: cleanedToIssuer
        },
        SendMax: {
          currency: formattedFromCurrency,
          value: amount,
          issuer: cleanedFromIssuer
        },
        Flags: 131072
      };
    }

    // Add memo for RiddleSwap platform
    txJson.Memos = [{
      Memo: {
        MemoType: convertStringToHex('RiddleSwap'),
        MemoData: convertStringToHex(`Swap ${amount} ${fromToken} to ${toToken}`)
      }
    }];

    console.log('✅ [EXTERNAL SWAP PREP] Transaction prepared:', JSON.stringify(txJson, null, 2));

    await client.disconnect();

    return {
      success: true,
      transaction: txJson,
      estimatedOutput: estimatedOutput,
      minimumReceived: minimumReceived,
      slippage: slippage,
      exchangeRate: rate
    };

  } catch (error) {
    console.error('❌ [EXTERNAL SWAP PREP] Error:', error);
    if (client) await client.disconnect();
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to prepare swap transaction'
    };
  }
}

/**
 * Check trustline for a token
 */
export async function checkExternalWalletTrustline(
  userAddress: string,
  token: string,
  issuer: string
): Promise<{ hasTrustline: boolean; transaction?: any }> {
  let client: XRPLClient | null = null;
  
  try {
    if (token === 'XRP') {
      return { hasTrustline: true }; // XRP doesn't need trustline
    }

    client = new XRPLClient('wss://s1.ripple.com');
    await client.connect();

    const accountLines = await client.request({
      command: 'account_lines',
      account: userAddress
    });

    const cleanedIssuer = cleanIssuer(issuer);
    const formattedCurrency = formatCurrency(token);
    const trustlineKey = `${formattedCurrency}-${cleanedIssuer}`;

    const existingTrustlines = accountLines.result.lines.map((line: any) => 
      `${line.currency}-${line.account}`
    );

    const hasTrustline = existingTrustlines.includes(trustlineKey);

    await client.disconnect();

    if (hasTrustline) {
      return { hasTrustline: true };
    } else {
      // Prepare trustline transaction for user to sign
      const trustlineTx = {
        TransactionType: 'TrustSet',
        Account: userAddress,
        LimitAmount: {
          currency: formattedCurrency,
          issuer: cleanedIssuer,
          value: '1000000000' // 1 billion max
        }
      };

      return {
        hasTrustline: false,
        transaction: trustlineTx
      };
    }

  } catch (error) {
    console.error('❌ [TRUSTLINE CHECK] Error:', error);
    if (client) await client.disconnect();
    throw error;
  }
}
