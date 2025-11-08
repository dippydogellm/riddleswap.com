// XRPL Transaction Service for Payment and OfferCreate transactions
import { Client, Wallet, xrpToDrops, dropsToXrp, Payment, OfferCreate } from 'xrpl';

interface PaymentTransactionData {
  transactionType: 'Payment';
  account: string;
  amount: any; // IOU object or drops string
  sendMax: any; // IOU object or drops string  
  destination: string;
  flags: number; // 0x00020000 for tfPartialPayment
  paths?: any[];
}

interface OfferCreateTransactionData {
  transactionType: 'OfferCreate';
  account: string;
  takerPays: any; // IOU object or drops string
  takerGets: any; // IOU object or drops string
  flags: number; // 0x00020000 for tfPartialPayment
  expiration?: number; // Unix timestamp
}

export class XRPLTransactionService {
  private static client: Client | null = null;

  private static async getClient(): Promise<Client> {
    if (!this.client) {
      this.client = new Client('wss://s1.ripple.com');
      await this.client.connect();
    }
    return this.client;
  }

  // Execute Payment transaction (immediate swap)
  static async executePayment(
    transactionData: PaymentTransactionData,
    privateKey: string
  ): Promise<{ success: boolean; txHash?: string; error?: string; deliveredAmount?: string }> {
    try {
      const client = await this.getClient();
      const wallet = Wallet.fromSeed(privateKey);

      console.log('🔄 Preparing Payment transaction for immediate swap...');

      // Construct Payment transaction following attached documentation
      const payment: Payment = {
        TransactionType: 'Payment',
        Account: transactionData.account,
        Amount: transactionData.amount,
        SendMax: transactionData.sendMax,
        Destination: transactionData.destination,
        Flags: transactionData.flags, // tfPartialPayment
        Fee: '12' // Network fee
      };

      // Only add Paths if they exist and are not empty (for auto-pathfinding)
      if (transactionData.paths && Array.isArray(transactionData.paths) && transactionData.paths.length > 0) {
        payment.Paths = transactionData.paths;
      }
      // For cross-currency payments without paths, XRPL will auto-pathfind

      console.log('💎 Payment transaction prepared:', JSON.stringify(payment, null, 2));

      // Submit and wait for validation
      const response = await client.submitAndWait(payment, { wallet });
      
      if (response.result.meta && typeof response.result.meta === 'object' && 
          'TransactionResult' in response.result.meta && response.result.meta.TransactionResult === 'tesSUCCESS') {
        // Extract delivered amount from transaction metadata
        let deliveredAmount = '';
        if ('DeliveredAmount' in response.result.meta && response.result.meta.DeliveredAmount) {
          const delivered = response.result.meta.DeliveredAmount;
          deliveredAmount = typeof delivered === 'string' 
            ? dropsToXrp(delivered) 
            : (delivered as any).value || '0';
        }

        console.log('✅ Payment transaction successful:', response.result.hash);
        
        return {
          success: true,
          txHash: response.result.hash,
          deliveredAmount
        };
      } else {
        const errorMsg = response.result.meta && typeof response.result.meta === 'object' && 'TransactionResult' in response.result.meta 
          ? response.result.meta.TransactionResult 
          : 'Unknown error';
        throw new Error(`Transaction failed: ${errorMsg}`);
      }

    } catch (error) {
      console.error('❌ Payment transaction failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payment transaction failed'
      };
    }
  }

  // Execute OfferCreate transaction (limit order)
  static async executeOfferCreate(
    transactionData: OfferCreateTransactionData,
    privateKey: string
  ): Promise<{ success: boolean; txHash?: string; error?: string; offerId?: string }> {
    try {
      const client = await this.getClient();
      const wallet = Wallet.fromSeed(privateKey);

      console.log('🔄 Preparing OfferCreate transaction for limit order...');

      // Construct OfferCreate transaction following attached documentation
      const offer: OfferCreate = {
        TransactionType: 'OfferCreate',
        Account: transactionData.account,
        TakerPays: transactionData.takerPays,
        TakerGets: transactionData.takerGets,
        Flags: transactionData.flags, // tfPartialPayment
        Fee: '12' // Network fee
      };

      // Add expiration if specified
      if (transactionData.expiration) {
        offer.Expiration = transactionData.expiration;
      }

      console.log('💎 OfferCreate transaction prepared:', JSON.stringify(offer, null, 2));

      // Submit and wait for validation
      const response = await client.submitAndWait(offer, { wallet });
      
      if (response.result.meta && typeof response.result.meta === 'object' && 
          'TransactionResult' in response.result.meta && response.result.meta.TransactionResult === 'tesSUCCESS') {
        // Extract offer ID from transaction metadata
        let offerId = '';
        if ('CreatedNode' in response.result.meta && response.result.meta.CreatedNode) {
          const createdNode = response.result.meta.CreatedNode as any;
          const createdNodes = Array.isArray(createdNode) 
            ? createdNode 
            : [createdNode];
          
          for (const node of createdNodes) {
            if (node.CreatedNode?.LedgerEntryType === 'Offer') {
              offerId = node.CreatedNode.LedgerIndex;
              break;
            }
          }
        }

        console.log('✅ OfferCreate transaction successful:', response.result.hash);
        
        return {
          success: true,
          txHash: response.result.hash,
          offerId
        };
      } else {
        const errorMsg = response.result.meta && typeof response.result.meta === 'object' && 'TransactionResult' in response.result.meta 
          ? response.result.meta.TransactionResult 
          : 'Unknown error';
        throw new Error(`Transaction failed: ${errorMsg}`);
      }

    } catch (error) {
      console.error('❌ OfferCreate transaction failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'OfferCreate transaction failed'
      };
    }
  }

  // Get account offers (active limit orders)
  static async getAccountOffers(accountAddress: string): Promise<{ success: boolean; offers?: any[]; error?: string }> {
    try {
      const client = await this.getClient();
      
      const response = await client.request({
        command: 'account_offers',
        account: accountAddress,
        ledger_index: 'validated'
      });

      if (response.result.offers) {
        console.log(`✅ Found ${response.result.offers.length} active offers for ${accountAddress}`);
        
        return {
          success: true,
          offers: response.result.offers
        };
      } else {
        return {
          success: true,
          offers: []
        };
      }

    } catch (error) {
      console.error('❌ Failed to get account offers:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get offers'
      };
    }
  }

  // Cancel offer (limit order)
  static async cancelOffer(
    accountAddress: string,
    offerSequence: number,
    privateKey: string
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      const client = await this.getClient();
      const wallet = Wallet.fromSeed(privateKey);

      // Cancel offer by creating OfferCreate with TakerPays: 0
      const cancelOffer: OfferCreate = {
        TransactionType: 'OfferCreate',
        Account: accountAddress,
        TakerPays: '0',
        TakerGets: '0',
        OfferSequence: offerSequence,
        Fee: '12'
      };

      console.log('🔄 Cancelling offer with sequence:', offerSequence);

      const response = await client.submitAndWait(cancelOffer, { wallet });
      
      if (response.result.meta && typeof response.result.meta === 'object' && 
          'TransactionResult' in response.result.meta && response.result.meta.TransactionResult === 'tesSUCCESS') {
        console.log('✅ Offer cancelled successfully:', response.result.hash);
        
        return {
          success: true,
          txHash: response.result.hash
        };
      } else {
        const errorMsg = response.result.meta && typeof response.result.meta === 'object' && 'TransactionResult' in response.result.meta 
          ? response.result.meta.TransactionResult 
          : 'Unknown error';
        throw new Error(`Cancellation failed: ${errorMsg}`);
      }

    } catch (error) {
      console.error('❌ Offer cancellation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Offer cancellation failed'
      };
    }
  }

  static async disconnect() {
    if (this.client) {
      await this.client.disconnect();
      this.client = null;
    }
  }
}