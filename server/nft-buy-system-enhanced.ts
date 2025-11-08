// Enhanced NFT Buy System with Fee Injection
// Based on the detailed guide for setting up payment system to sell NFTs directly
// Supports both direct sales (no fee) and brokered sales (custom fee)

import { Client, Wallet, xrpToDrops, dropsToXrp } from 'xrpl';

export interface BuyTransactionConfig {
  nftokenID: string;
  buyerWallet: string;
  sellerWallet: string;
  sellPrice: number; // Base selling price in XRP
  transactionType: 'direct' | 'brokered';
  customFee?: number; // Custom fee in XRP (only for brokered)
  brokerWallet?: string; // Broker wallet address (only for brokered)
  expiration?: number; // Unix timestamp
}

export interface BuyTransactionResult {
  success: boolean;
  transactionHash?: string;
  offerID?: string;
  totalCost: number;
  breakdown: {
    basePrice: number;
    brokerFee: number;
    networkFee: number;
  };
  message: string;
  error?: string;
}

export class EnhancedNFTBuySystem {
  private client: Client;
  private networkFee = 0.000012; // Standard XRPL network fee

  constructor(xrplNode: string = 'wss://xrplcluster.com') {
    this.client = new Client(xrplNode);
  }

  async connect(): Promise<void> {
    if (!this.client.isConnected()) {
      await this.client.connect();
    }
  }

  async disconnect(): Promise<void> {
    if (this.client.isConnected()) {
      await this.client.disconnect();
    }
  }

  /**
   * Create a buy offer based on transaction type (direct or brokered)
   * Direct: Buyer pays exact sell price, no broker fee
   * Brokered: Buyer pays sell price + custom fee, broker collects fee
   */
  async createBuyOffer(config: BuyTransactionConfig, buyerSeed: string): Promise<BuyTransactionResult> {
    try {
      await this.connect();
      
      const buyerWallet = Wallet.fromSeed(buyerSeed);
      
      // Validate buyer wallet address matches
      if (buyerWallet.classicAddress !== config.buyerWallet) {
        throw new Error('Buyer wallet seed does not match provided address');
      }

      // Calculate total price based on transaction type
      let totalPrice: number;
      let brokerFee: number = 0;
      
      if (config.transactionType === 'direct') {
        // Direct sale: Buyer pays exact sell price, no broker fee
        totalPrice = config.sellPrice;
        brokerFee = 0;
        console.log(`🔄 [DIRECT BUY] Creating direct buy offer for ${config.sellPrice} XRP`);
      } else {
        // Brokered sale: Buyer pays sell price + custom fee
        if (!config.customFee || !config.brokerWallet) {
          throw new Error('Custom fee and broker wallet required for brokered transactions');
        }
        totalPrice = config.sellPrice + config.customFee;
        brokerFee = config.customFee;
        console.log(`🔄 [BROKERED BUY] Creating brokered buy offer for ${totalPrice} XRP (${config.sellPrice} + ${config.customFee} fee)`);
      }

      // Get buyer account sequence
      const accountInfo = await this.client.request({
        command: "account_info",
        account: config.buyerWallet
      });
      const sequence = accountInfo.result.account_data.Sequence;

      // Create buy offer transaction
      const buyOfferTx: any = {
        TransactionType: "NFTokenCreateOffer",
        Account: config.buyerWallet,
        NFTokenID: config.nftokenID,
        Amount: xrpToDrops(totalPrice.toString()),
        Flags: 0, // Buy offer flag
        Fee: xrpToDrops(this.networkFee.toString()),
        Sequence: sequence
      };

      // Add destination for brokered transactions
      if (config.transactionType === 'brokered' && config.brokerWallet) {
        buyOfferTx.Destination = config.brokerWallet;
      }

      // Add expiration if specified
      if (config.expiration) {
        buyOfferTx.Expiration = config.expiration;
      }

      // Prepare and sign transaction
      const prepared = await this.client.autofill(buyOfferTx);
      const signed = buyerWallet.sign(prepared);
      
      // Submit transaction
      const result = await this.client.submitAndWait(signed.tx_blob);
      
      if ((result.result.meta as any)?.TransactionResult !== 'tesSUCCESS') {
        throw new Error(`Transaction failed: ${(result.result.meta as any)?.TransactionResult}`);
      }

      // Extract offer ID from transaction metadata
      const offerID = this.extractOfferID(result.result.meta);
      
      const breakdown = {
        basePrice: config.sellPrice,
        brokerFee: brokerFee,
        networkFee: this.networkFee
      };

      console.log(`✅ [BUY OFFER] Successfully created offer ${offerID}`);
      console.log(`✅ [BUY OFFER] Total cost: ${totalPrice} XRP (${config.sellPrice} + ${brokerFee} fee + ${this.networkFee} network)`);

      return {
        success: true,
        transactionHash: result.result.hash,
        offerID: offerID,
        totalCost: totalPrice + this.networkFee,
        breakdown,
        message: `Buy offer created successfully. Offer ID: ${offerID}`
      };

    } catch (error) {
      console.error('❌ [BUY OFFER] Failed:', error);
      return {
        success: false,
        totalCost: 0,
        breakdown: { basePrice: 0, brokerFee: 0, networkFee: 0 },
        message: 'Failed to create buy offer',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Accept a buy offer (for sellers)
   * Direct: Seller accepts direct buy offer, receives full sell price
   * Brokered: Broker accepts both buy and sell offers, distributes payment
   */
  async acceptBuyOffer(
    buyOfferID: string,
    sellOfferID: string | null,
    acceptorSeed: string,
    acceptorAddress: string,
    config: BuyTransactionConfig
  ): Promise<BuyTransactionResult> {
    try {
      await this.connect();
      
      const acceptorWallet = Wallet.fromSeed(acceptorSeed);
      
      // Validate acceptor wallet address
      if (acceptorWallet.classicAddress !== acceptorAddress) {
        throw new Error('Acceptor wallet seed does not match provided address');
      }

      // Get acceptor account sequence
      const accountInfo = await this.client.request({
        command: "account_info",
        account: acceptorAddress
      });
      const sequence = accountInfo.result.account_data.Sequence;

      let acceptOfferTx: any;

      if (config.transactionType === 'direct') {
        // Direct sale: Seller accepts buy offer directly
        acceptOfferTx = {
          TransactionType: "NFTokenAcceptOffer",
          Account: acceptorAddress, // Seller wallet
          NFTokenBuyOffer: buyOfferID,
          Fee: xrpToDrops(this.networkFee.toString()),
          Sequence: sequence
        };
        
        console.log(`🔄 [DIRECT ACCEPT] Seller accepting direct buy offer ${buyOfferID}`);
      } else {
        // Brokered sale: Broker accepts both buy and sell offers
        if (!sellOfferID || !config.customFee) {
          throw new Error('Sell offer ID and custom fee required for brokered acceptance');
        }
        
        acceptOfferTx = {
          TransactionType: "NFTokenAcceptOffer",
          Account: acceptorAddress, // Broker wallet
          NFTokenBuyOffer: buyOfferID,
          NFTokenSellOffer: sellOfferID,
          BrokerFee: xrpToDrops(config.customFee.toString()),
          Fee: xrpToDrops(this.networkFee.toString()),
          Sequence: sequence
        };
        
        console.log(`🔄 [BROKERED ACCEPT] Broker accepting offers with ${config.customFee} XRP fee`);
      }

      // Prepare and sign transaction
      const prepared = await this.client.autofill(acceptOfferTx);
      const signed = acceptorWallet.sign(prepared);
      
      // Submit transaction
      const result = await this.client.submitAndWait(signed.tx_blob);
      
      if ((result.result.meta as any)?.TransactionResult !== 'tesSUCCESS') {
        throw new Error(`Transaction failed: ${(result.result.meta as any)?.TransactionResult}`);
      }

      const breakdown = {
        basePrice: config.sellPrice,
        brokerFee: config.customFee || 0,
        networkFee: this.networkFee
      };

      console.log(`✅ [ACCEPT OFFER] Successfully accepted offer`);
      console.log(`✅ [ACCEPT OFFER] Transaction hash: ${result.result.hash}`);

      return {
        success: true,
        transactionHash: result.result.hash,
        totalCost: config.sellPrice + (config.customFee || 0),
        breakdown,
        message: `Offer accepted successfully. NFT transferred.`
      };

    } catch (error) {
      console.error('❌ [ACCEPT OFFER] Failed:', error);
      return {
        success: false,
        totalCost: 0,
        breakdown: { basePrice: 0, brokerFee: 0, networkFee: 0 },
        message: 'Failed to accept offer',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Calculate total cost for a purchase
   */
  calculatePurchaseCost(
    sellPrice: number,
    transactionType: 'direct' | 'brokered',
    customFee: number = 0
  ): {
    basePrice: number;
    brokerFee: number;
    networkFee: number;
    totalCost: number;
  } {
    const brokerFee = transactionType === 'brokered' ? customFee : 0;
    const networkFee = this.networkFee;
    const totalCost = sellPrice + brokerFee + networkFee;

    return {
      basePrice: sellPrice,
      brokerFee,
      networkFee,
      totalCost
    };
  }

  /**
   * Check if an NFT has existing buy offers
   */
  async checkExistingBuyOffers(nftokenID: string): Promise<any[]> {
    try {
      await this.connect();
      
      const response = await this.client.request({
        command: "nft_buy_offers",
        nft_id: nftokenID
      } as any);
      
      return response.result.offers || [];
    } catch (error) {
      console.error('Error checking existing buy offers:', error);
      return [];
    }
  }

  /**
   * Check if an NFT has existing sell offers
   */
  async checkExistingSellOffers(nftokenID: string): Promise<any[]> {
    try {
      await this.connect();
      
      const response = await this.client.request({
        command: "nft_sell_offers",
        nft_id: nftokenID
      } as any);
      
      return response.result.offers || [];
    } catch (error) {
      console.error('Error checking existing sell offers:', error);
      return [];
    }
  }

  /**
   * Extract offer ID from transaction metadata
   */
  private extractOfferID(meta: any): string | undefined {
    try {
      const createdNode = meta.AffectedNodes?.find(
        (node: any) => node.CreatedNode && node.CreatedNode.LedgerEntryType === "NFTokenOffer"
      );
      return createdNode?.CreatedNode?.LedgerIndex;
    } catch (error) {
      console.error('Error extracting offer ID:', error);
      return undefined;
    }
  }
}

// Export utility functions for easy access
export function createDirectBuyConfig(
  nftokenID: string,
  buyerWallet: string,
  sellerWallet: string,
  sellPrice: number
): BuyTransactionConfig {
  return {
    nftokenID,
    buyerWallet,
    sellerWallet,
    sellPrice,
    transactionType: 'direct'
  };
}

export function createBrokeredBuyConfig(
  nftokenID: string,
  buyerWallet: string,
  sellerWallet: string,
  sellPrice: number,
  customFee: number,
  brokerWallet: string
): BuyTransactionConfig {
  return {
    nftokenID,
    buyerWallet,
    sellerWallet,
    sellPrice,
    transactionType: 'brokered',
    customFee,
    brokerWallet
  };
}