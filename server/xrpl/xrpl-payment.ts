import * as xrpl from 'xrpl';
import { decryptXrplWallet, getXrplClient, disconnectClient } from './xrpl-wallet';

export async function sendXrplPayment(
  handle: string,
  password: string,
  destination: string,
  amount: string,
  currency?: string,
  issuer?: string,
  destinationTag?: number,
  usePartialPayment?: boolean,
  slippagePercent: number = 0.05
): Promise<{
  success: boolean;
  txHash?: string;
  error?: string;
  delivered?: string;
}> {
  let client: xrpl.Client | null = null;
  
  try {
    const { wallet } = await decryptXrplWallet(handle, password);
    client = await getXrplClient();
    
    let paymentAmount: xrpl.Amount;
    let sendMax: xrpl.Amount | undefined;
    let deliverMin: xrpl.Amount | undefined;
    
    if (!currency || currency === 'XRP') {
      // XRP payment
      paymentAmount = xrpl.xrpToDrops(amount);
      
      if (usePartialPayment) {
        // For partial payments, set DeliverMin with slippage
        const minAmount = parseFloat(amount) * (1 - slippagePercent);
        deliverMin = xrpl.xrpToDrops(minAmount.toString());
        sendMax = xrpl.xrpToDrops(amount);
      }
    } else {
      // Token payment
      paymentAmount = {
        currency: currency,
        issuer: issuer!,
        value: amount
      };
      
      if (usePartialPayment) {
        // For partial payments, set DeliverMin with slippage
        const minAmount = parseFloat(amount) * (1 - slippagePercent);
        deliverMin = {
          currency: currency,
          issuer: issuer!,
          value: minAmount.toFixed(5)
        };
        sendMax = {
          currency: currency,
          issuer: issuer!,
          value: amount
        };
      }
    }
    
    // Build payment object with partial payment support
    const payment: xrpl.Payment = {
      TransactionType: 'Payment',
      Account: wallet.address,
      Destination: destination,
      Amount: paymentAmount,
      ...(destinationTag && { DestinationTag: destinationTag }),
      ...(usePartialPayment && {
        Flags: xrpl.PaymentFlags.tfPartialPayment,
        DeliverMin: deliverMin,
        SendMax: sendMax || paymentAmount
      })
    };
    
    console.log('💸 [PAYMENT] Sending payment:', {
      from: wallet.address,
      to: destination,
      amount: amount,
      currency: currency || 'XRP',
      partialPayment: usePartialPayment,
      ...(usePartialPayment && {
        deliverMin: deliverMin,
        sendMax: sendMax,
        slippage: `${slippagePercent * 100}%`
      })
    });
    
    const prepared = await client.autofill(payment);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);
    
    const meta = result.result.meta as any;
    const success = meta?.TransactionResult === 'tesSUCCESS';
    
    // Extract delivered amount from metadata for partial payments
    let delivered: string | undefined;
    if (success && usePartialPayment && meta && typeof meta === 'object') {
      const deliveredCandidate: any = (meta as any).delivered_amount || (meta as any).DeliveredAmount;
      if (deliveredCandidate) {
        if (typeof deliveredCandidate === 'string') {
          delivered = String(xrpl.dropsToXrp(String(deliveredCandidate)));
        } else if (typeof deliveredCandidate === 'object' && 'value' in deliveredCandidate && deliveredCandidate.value != null) {
          delivered = String(deliveredCandidate.value);
        }
      }
      console.log('✅ [PAYMENT] Delivered amount:', delivered);
    }
    
    return {
      success,
      txHash: result.result.hash,
      ...(delivered && { delivered }),
      ...(success ? {} : { error: meta?.TransactionResult || 'Payment failed' })
    };
    
  } catch (error) {
    console.error('❌ [PAYMENT] Payment failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Payment failed'
    };
  } finally {
    if (client) {
      await disconnectClient(client);
    }
  }
}