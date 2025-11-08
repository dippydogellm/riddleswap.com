// XRPL Payment for External Wallets (Xaman/Joey/MetaMask/Phantom) - Signing-based flow
// Prepares payment transactions for user signing, no private keys required

import { Client as XRPLClient, Payment, convertStringToHex, xrpToDrops } from 'xrpl';

/**
 * Prepare a payment transaction for external wallet signing
 * Returns transaction JSON that user will sign with their wallet
 */
export async function prepareExternalWalletPayment(
  userAddress: string,
  toAddress: string,
  amount: string,
  currency?: string,
  issuer?: string,
  destinationTag?: number,
  memo?: string
): Promise<any> {
  let client: XRPLClient | null = null;
  
  try {
    console.log('💸 [EXTERNAL PAYMENT PREP] Preparing payment transaction for external wallet');
    console.log('📊 [EXTERNAL PAYMENT PREP] Params:', { 
      userAddress, 
      toAddress, 
      amount, 
      currency: currency || 'XRP',
      issuer,
      destinationTag,
      hasMemo: !!memo
    });
    
    // Validate addresses (support both classic r-addresses and X-addresses)
    if (!userAddress || (!userAddress.startsWith('r') && !userAddress.startsWith('X'))) {
      throw new Error('Invalid sender XRPL address');
    }
    if (!toAddress || (!toAddress.startsWith('r') && !toAddress.startsWith('X'))) {
      throw new Error('Invalid recipient XRPL address');
    }

    // Connect to XRPL
    client = new XRPLClient('wss://s1.ripple.com');
    await client.connect();
    console.log('✅ [EXTERNAL PAYMENT PREP] Connected to XRPL');

    // Prepare the payment transaction
    let txJson: any = {
      TransactionType: 'Payment',
      Account: userAddress,
      Destination: toAddress
    };

    // Set amount based on currency type
    if (!currency || currency === 'XRP') {
      // Native XRP payment
      txJson.Amount = xrpToDrops(amount);
    } else {
      // Token payment
      if (!issuer) {
        throw new Error('Issuer is required for token payments');
      }
      txJson.Amount = {
        currency: currency,
        value: amount,
        issuer: issuer
      };
    }

    // Add destination tag if provided
    if (destinationTag !== undefined && destinationTag !== null) {
      txJson.DestinationTag = destinationTag;
    }

    // Add memo if provided
    if (memo && memo.trim()) {
      txJson.Memos = [{
        Memo: {
          MemoType: convertStringToHex('text'),
          MemoData: convertStringToHex(memo)
        }
      }];
    }

    // Autofill transaction with Fee, Sequence, LastLedgerSequence
    const preparedTx = await client.autofill(txJson);
    console.log('✅ [EXTERNAL PAYMENT PREP] Transaction autofilled with:', {
      Fee: preparedTx.Fee,
      Sequence: preparedTx.Sequence,
      LastLedgerSequence: preparedTx.LastLedgerSequence
    });

    await client.disconnect();

    return {
      success: true,
      transaction: preparedTx,
      amount: amount,
      currency: currency || 'XRP',
      recipient: toAddress
    };

  } catch (error) {
    console.error('❌ [EXTERNAL PAYMENT PREP] Error:', error);
    if (client) await client.disconnect();
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to prepare payment transaction'
    };
  }
}
