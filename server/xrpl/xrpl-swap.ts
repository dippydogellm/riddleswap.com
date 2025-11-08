import * as xrpl from 'xrpl';
import { decryptXrplWallet, getXrplClient, disconnectClient } from './xrpl-wallet';

export async function executeXrplSwap(
  handle: string,
  password: string,
  fromToken: string,
  toToken: string,
  amount: string,
  fromIssuer?: string,
  toIssuer?: string,
  slippagePercent: number = 5
): Promise<{
  success: boolean;
  txHash?: string;
  error?: string;
  actualReceived?: number;
}> {
  let client: xrpl.Client | null = null;
  
  try {
    const { wallet } = await decryptXrplWallet(handle, password);
    client = await getXrplClient();
    
    console.log(`💱 [SWAP] Starting swap: ${amount} ${fromToken} → ${toToken} (${slippagePercent}% slippage)`);
    
    // Calculate expected output (simplified rate calculation)
    const rate = 1.0; // TODO: Get real exchange rate
    const expectedOutput = parseFloat(amount) * rate;
    const minOutput = expectedOutput * (1 - slippagePercent / 100);
    
    // Create currency amount helper with proper number handling
    const createAmount = (token: string, issuer: string | undefined, value: number) => {
      if (token === 'XRP') {
        // Ensure value is valid number and convert to drops string
        const numValue = isNaN(value) ? 0 : value;
        return xrpl.xrpToDrops(numValue.toFixed(6));
      } else {
        if (!issuer) throw new Error(`No issuer provided for token ${token}`);
        const numValue = isNaN(value) ? 0 : value;
        return {
          currency: token.length <= 3 ? token.padEnd(3) : token,
          issuer: issuer,
          value: numValue.toFixed(6)
        };
      }
    };
    
    // Create Payment transaction with DeliverMin (CRITICAL FIX)
    let payment: xrpl.Payment;
    
    if (fromToken === 'XRP' && toToken !== 'XRP') {
      // XRP to Token swap
      payment = {
        TransactionType: 'Payment',
        Account: wallet.address,
        Destination: wallet.address,
        Amount: createAmount(toToken, toIssuer, expectedOutput),
        SendMax: xrpl.xrpToDrops(parseFloat(amount).toString()),
        DeliverMin: createAmount(toToken, toIssuer, minOutput), // CRITICAL: Minimum delivery protection
        Flags: xrpl.PaymentFlags.tfPartialPayment
      };
    } else if (fromToken !== 'XRP' && toToken === 'XRP') {
      // Token to XRP swap
      payment = {
        TransactionType: 'Payment',
        Account: wallet.address,
        Destination: wallet.address,
        Amount: xrpl.xrpToDrops(expectedOutput.toFixed(6)),
        SendMax: createAmount(fromToken, fromIssuer, parseFloat(amount)),
        DeliverMin: xrpl.xrpToDrops(minOutput.toFixed(6)), // CRITICAL: Minimum delivery protection
        Flags: xrpl.PaymentFlags.tfPartialPayment
      };
    } else if (fromToken !== 'XRP' && toToken !== 'XRP') {
      // Token to Token swap
      payment = {
        TransactionType: 'Payment',
        Account: wallet.address,
        Destination: wallet.address,
        Amount: createAmount(toToken, toIssuer, expectedOutput),
        SendMax: createAmount(fromToken, fromIssuer, parseFloat(amount)),
        DeliverMin: createAmount(toToken, toIssuer, minOutput), // CRITICAL: Minimum delivery protection
        Paths: [[{ currency: 'XRP' }]], // Route through XRP
        Flags: xrpl.PaymentFlags.tfPartialPayment
      };
    } else {
      throw new Error('Invalid swap pair: cannot swap XRP to XRP');
    }
    
    console.log('📝 [SWAP] Payment transaction:', JSON.stringify(payment, null, 2));
    
    // Execute the swap
    const prepared = await client.autofill(payment);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);
    
    const meta = result.result.meta as any;
    const success = meta?.TransactionResult === 'tesSUCCESS';
    
    if (success) {
      console.log('✅ [SWAP] Transaction successful:', result.result.hash);
      
      // Extract actual received amount
      let actualReceived = 0;
      if (meta?.delivered_amount) {
        try {
          if (typeof meta.delivered_amount === 'object' && meta.delivered_amount.value) {
            // Handle token amount (object with value property)
            actualReceived = parseFloat(meta.delivered_amount.value);
          } else {
            // Handle XRP amount in drops (explicit string conversion and typing)
            const dropsValue: string = String(meta.delivered_amount);
            // @ts-ignore - Explicit string conversion should satisfy type requirements
            actualReceived = parseFloat(xrpl.dropsToXrp(dropsValue));
          }
        } catch (e) {
          console.warn('Failed to parse delivered_amount:', e);
        }
      }
      
      return {
        success: true,
        txHash: result.result.hash,
        actualReceived
      };
    } else {
      throw new Error(`Swap failed: ${meta?.TransactionResult}`);
    }
    
  } catch (error) {
    console.error('❌ [SWAP] Execution failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Swap failed'
    };
  } finally {
    if (client) {
      await disconnectClient(client);
    }
  }
}

// All swap functionality now uses Payment transactions with DeliverMin for security
// Old OfferCreate-based functions have been removed and replaced with secure Payment transactions