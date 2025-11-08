import { Client, Wallet, xrpToDrops, dropsToXrp } from 'xrpl';

interface BrokerConfig {
  seed: string;
  rpcUrl?: string;
}

interface NFTSellOffer {
  nftId: string;
  offerId: string;
  price: string;
  destination?: string;
}

export const BROKER_FEE_CONFIG = {
  feePercentage: 1.589,
  minimumFeeXrp: 0.1,
  
  calculateBrokerFee(buyOfferXrp: number, sellOfferXrp: number): number {
    const difference = buyOfferXrp - sellOfferXrp;
    
    if (difference < 0) {
      throw new Error('Buy offer cannot be less than sell offer');
    }
    
    if (difference === 0) {
      const feeFromBuyPrice = buyOfferXrp * (this.feePercentage / 100);
      return Math.max(feeFromBuyPrice, this.minimumFeeXrp);
    }
    
    const feeFromPercentage = sellOfferXrp * (this.feePercentage / 100);
    const actualFee = Math.max(feeFromPercentage, this.minimumFeeXrp);
    const maxAllowedFee = difference;
    
    return Math.min(actualFee, maxAllowedFee);
  },
  
  getFeeBreakdown(buyOfferXrp: number, sellOfferXrp: number): {
    buyOffer: number;
    sellOffer: number;
    brokerFee: number;
    royaltyEstimate: string;
    sellerReceives: string;
  } {
    const brokerFee = this.calculateBrokerFee(buyOfferXrp, sellOfferXrp);
    
    return {
      buyOffer: buyOfferXrp,
      sellOffer: sellOfferXrp,
      brokerFee,
      royaltyEstimate: '0-50% of sell price (set at NFT mint)',
      sellerReceives: 'sell price - royalty fee'
    };
  }
};

export class NFTBrokerService {
  private wallet: Wallet;
  private client: Client;
  private isConnected: boolean = false;

  constructor(config: BrokerConfig) {
    if (!config.seed) {
      throw new Error('Broker wallet seed is required');
    }

    this.wallet = Wallet.fromSeed(config.seed);
    this.client = new Client(config.rpcUrl || 'wss://xrplcluster.com');
    
    console.log('🏦 NFT Broker Service initialized');
    console.log(`📍 Broker Address: ${this.wallet.address}`);
  }

  async connect(): Promise<void> {
    if (!this.isConnected) {
      await this.client.connect();
      this.isConnected = true;
      console.log('✅ Broker connected to XRPL');
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.disconnect();
      this.isConnected = false;
      console.log('🔌 Broker disconnected from XRPL');
    }
  }

  getAddress(): string {
    return this.wallet.address;
  }

  async getBrokerNFTs(): Promise<any[]> {
    await this.connect();
    
    try {
      const response = await this.client.request({
        command: 'account_nfts',
        account: this.wallet.address,
        ledger_index: 'validated'
      });

      console.log(`📦 Broker holds ${response.result.account_nfts?.length || 0} NFTs`);
      return response.result.account_nfts || [];
    } catch (error) {
      console.error('❌ Failed to fetch broker NFTs:', error);
      throw error;
    }
  }

  async createSellOffer(nftId: string, priceXrp: string, destination?: string): Promise<NFTSellOffer> {
    await this.connect();

    try {
      const amountInDrops = xrpToDrops(priceXrp);
      
      const tx: any = {
        TransactionType: 'NFTokenCreateOffer',
        Account: this.wallet.address,
        NFTokenID: nftId,
        Amount: amountInDrops,
        Flags: 1
      };

      if (destination) {
        tx.Destination = destination;
      }

      const prepared = await this.client.autofill(tx);
      const signed = this.wallet.sign(prepared);
      const result = await this.client.submitAndWait(signed.tx_blob);

      const meta = result.result.meta as any;
      const offerNode = meta?.AffectedNodes?.find((node: any) => 
        node.CreatedNode?.LedgerEntryType === 'NFTokenOffer'
      );

      const offerId = offerNode?.CreatedNode?.LedgerIndex;

      if (!offerId) {
        throw new Error('Failed to extract offer ID from transaction result');
      }

      console.log(`✅ Sell offer created: ${offerId} for ${priceXrp} XRP`);

      return {
        nftId,
        offerId,
        price: priceXrp,
        destination
      };
    } catch (error) {
      console.error('❌ Failed to create sell offer:', error);
      throw error;
    }
  }

  async acceptBuyOffer(buyOfferId: string, nftId: string): Promise<string> {
    await this.connect();

    try {
      const tx: any = {
        TransactionType: 'NFTokenAcceptOffer',
        Account: this.wallet.address,
        NFTokenBuyOffer: buyOfferId
      };

      const prepared = await this.client.autofill(tx);
      const signed = this.wallet.sign(prepared);
      const result = await this.client.submitAndWait(signed.tx_blob);

      const txResult = (result.result.meta as any)?.TransactionResult;
      
      if (txResult === 'tesSUCCESS') {
        console.log(`✅ Buy offer accepted: ${result.result.hash}`);
        return result.result.hash;
      } else {
        throw new Error(`Transaction failed: ${txResult}`);
      }
    } catch (error) {
      console.error('❌ Failed to accept buy offer:', error);
      throw error;
    }
  }

  async getBrokerBalance(): Promise<{ xrp: string, dropsRaw: string }> {
    await this.connect();

    try {
      const response = await this.client.request({
        command: 'account_info',
        account: this.wallet.address,
        ledger_index: 'validated'
      });

      const balanceData = response.result.account_data.Balance as string | number;
      const balanceDrops = String(balanceData);
      const xrpAmount = dropsToXrp(balanceData);
      return {
        xrp: String(xrpAmount),
        dropsRaw: balanceDrops
      };
    } catch (error) {
      console.error('❌ Failed to fetch broker balance:', error);
      throw error;
    }
  }

  async getSellOffersForNFT(nftId: string): Promise<any[]> {
    await this.connect();

    try {
      const response = await this.client.request({
        command: 'nft_sell_offers',
        nft_id: nftId,
        ledger_index: 'validated'
      });

      return response.result.offers || [];
    } catch (error) {
      if ((error as any)?.data?.error === 'objectNotFound') {
        return [];
      }
      console.error('❌ Failed to fetch sell offers:', error);
      throw error;
    }
  }

  async getBuyOffersForNFT(nftId: string): Promise<any[]> {
    await this.connect();

    try {
      const response = await this.client.request({
        command: 'nft_buy_offers',
        nft_id: nftId,
        ledger_index: 'validated'
      });

      return response.result.offers || [];
    } catch (error) {
      if ((error as any)?.data?.error === 'objectNotFound') {
        return [];
      }
      console.error('❌ Failed to fetch buy offers:', error);
      throw error;
    }
  }

  async matchBrokerOffers(
    buyOfferId: string, 
    sellOfferId: string, 
    brokerFeeXrp: string
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    await this.connect();

    try {
      const brokerFeeDrops = xrpToDrops(brokerFeeXrp);
      
      const tx: any = {
        TransactionType: 'NFTokenAcceptOffer',
        Account: this.wallet.address,
        NFTokenBuyOffer: buyOfferId,
        NFTokenSellOffer: sellOfferId,
        NFTokenBrokerFee: brokerFeeDrops
      };

      console.log(`🤝 [BROKER MATCH] Matching offers:`, {
        buyOffer: buyOfferId,
        sellOffer: sellOfferId,
        brokerFee: `${brokerFeeXrp} XRP (${brokerFeeDrops} drops)`,
        broker: this.wallet.address
      });

      const prepared = await this.client.autofill(tx);
      const signed = this.wallet.sign(prepared);
      const result = await this.client.submitAndWait(signed.tx_blob);

      const meta = result.result.meta as any;
      const txResult = meta?.TransactionResult;
      
      if (txResult === 'tesSUCCESS') {
        console.log(`✅ [BROKER MATCH] Offers matched successfully: ${result.result.hash}`);
        console.log(`💰 [BROKER FEE] Collected ${brokerFeeXrp} XRP`);
        
        return {
          success: true,
          txHash: result.result.hash
        };
      } else {
        throw new Error(`Broker match failed: ${txResult}`);
      }
    } catch (error) {
      console.error('❌ [BROKER MATCH] Failed to match offers:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async createBrokerDirectedBuyOffer(
    buyerWallet: any,
    nftId: string,
    offerAmountXrp: string,
    nftOwner: string
  ): Promise<{ success: boolean; offerId?: string; txHash?: string; error?: string }> {
    await this.connect();

    try {
      const offerAmountDrops = xrpToDrops(offerAmountXrp);
      
      const tx: any = {
        TransactionType: 'NFTokenCreateOffer',
        Account: buyerWallet.address,
        Owner: nftOwner,
        NFTokenID: nftId,
        Amount: offerAmountDrops,
        Destination: this.wallet.address
      };

      console.log(`🎁 [BROKER BUY OFFER] Creating broker-directed buy offer:`, {
        buyer: buyerWallet.address,
        nftId,
        amount: `${offerAmountXrp} XRP`,
        broker: this.wallet.address,
        owner: nftOwner
      });

      const prepared = await this.client.autofill(tx);
      const signed = buyerWallet.sign(prepared);
      const result = await this.client.submitAndWait(signed.tx_blob);

      const meta = result.result.meta as any;
      const txResult = meta?.TransactionResult;
      
      if (txResult === 'tesSUCCESS') {
        const createdOffers = meta?.CreatedNode || meta?.AffectedNodes?.filter((n: any) => n.CreatedNode?.LedgerEntryType === 'NFTokenOffer');
        const offerNode = createdOffers?.[0]?.CreatedNode || createdOffers?.[0];
        const offerId = offerNode?.LedgerIndex || 'UNKNOWN';

        console.log(`✅ [BROKER BUY OFFER] Created successfully: ${result.result.hash}`);
        console.log(`📋 [BROKER BUY OFFER] Offer ID: ${offerId}`);
        
        return {
          success: true,
          offerId,
          txHash: result.result.hash
        };
      } else {
        throw new Error(`Buy offer failed: ${txResult}`);
      }
    } catch (error) {
      console.error('❌ [BROKER BUY OFFER] Failed to create buy offer:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async createBrokerDirectedSellOffer(
    sellerWallet: any,
    nftId: string,
    askPriceXrp: string
  ): Promise<{ success: boolean; offerId?: string; txHash?: string; error?: string }> {
    await this.connect();

    try {
      const askPriceDrops = xrpToDrops(askPriceXrp);
      
      const tx: any = {
        TransactionType: 'NFTokenCreateOffer',
        Account: sellerWallet.address,
        NFTokenID: nftId,
        Amount: askPriceDrops,
        Destination: this.wallet.address,
        Flags: 1
      };

      console.log(`🏷️ [BROKER SELL OFFER] Creating broker-directed sell offer:`, {
        seller: sellerWallet.address,
        nftId,
        askPrice: `${askPriceXrp} XRP`,
        broker: this.wallet.address
      });

      const prepared = await this.client.autofill(tx);
      const signed = sellerWallet.sign(prepared);
      const result = await this.client.submitAndWait(signed.tx_blob);

      const meta = result.result.meta as any;
      const txResult = meta?.TransactionResult;
      
      if (txResult === 'tesSUCCESS') {
        const createdOffers = meta?.CreatedNode || meta?.AffectedNodes?.filter((n: any) => n.CreatedNode?.LedgerEntryType === 'NFTokenOffer');
        const offerNode = createdOffers?.[0]?.CreatedNode || createdOffers?.[0];
        const offerId = offerNode?.LedgerIndex || 'UNKNOWN';

        console.log(`✅ [BROKER SELL OFFER] Created successfully: ${result.result.hash}`);
        console.log(`📋 [BROKER SELL OFFER] Offer ID: ${offerId}`);
        
        return {
          success: true,
          offerId,
          txHash: result.result.hash
        };
      } else {
        throw new Error(`Sell offer failed: ${txResult}`);
      }
    } catch (error) {
      console.error('❌ [BROKER SELL OFFER] Failed to create sell offer:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async cancelSellOffer(offerId: string): Promise<string> {
    await this.connect();

    try {
      const tx: any = {
        TransactionType: 'NFTokenCancelOffer',
        Account: this.wallet.address,
        NFTokenOffers: [offerId]
      };

      const prepared = await this.client.autofill(tx);
      const signed = this.wallet.sign(prepared);
      const result = await this.client.submitAndWait(signed.tx_blob);

      const txResult = (result.result.meta as any)?.TransactionResult;
      
      if (txResult === 'tesSUCCESS') {
        console.log(`✅ Sell offer cancelled: ${result.result.hash}`);
        return result.result.hash;
      } else {
        throw new Error(`Transaction failed: ${txResult}`);
      }
    } catch (error) {
      console.error('❌ Failed to cancel sell offer:', error);
      throw error;
    }
  }

  // Creates buy offer from broker wallet to NFT owner (for escrow system)
  async createBuyOfferToOwner(nftTokenId: string, amountXrp: string, owner: string): Promise<{ success: boolean, offerId?: string, txHash?: string, error?: string }> {
    await this.connect();

    try {
      const { xrpToDrops } = await import('xrpl');
      const amountDrops = xrpToDrops(amountXrp);

      const tx: any = {
        TransactionType: 'NFTokenCreateOffer',
        Account: this.wallet.address,
        NFTokenID: nftTokenId,
        Amount: amountDrops,
        Owner: owner, // NFT owner address
        Flags: 0 // Buy offer
      };

      const prepared = await this.client.autofill(tx);
      const signed = this.wallet.sign(prepared);
      const result = await this.client.submitAndWait(signed.tx_blob);

      const meta = result.result.meta as any;
      const txResult = meta?.TransactionResult;

      if (txResult === 'tesSUCCESS') {
        const createdOffers = meta?.CreatedNode || meta?.AffectedNodes?.filter((n: any) => n.CreatedNode?.LedgerEntryType === 'NFTokenOffer');
        const offerNode = createdOffers?.[0]?.CreatedNode || createdOffers?.[0];
        const offerId = offerNode?.LedgerIndex || 'UNKNOWN';

        console.log(`✅ [BROKER BUY OFFER] Created to owner successfully: ${result.result.hash}`);
        console.log(`📋 [BROKER BUY OFFER] Offer ID: ${offerId}`);
        
        return {
          success: true,
          offerId,
          txHash: result.result.hash
        };
      } else {
        throw new Error(`Buy offer failed: ${txResult}`);
      }
    } catch (error) {
      console.error('❌ [BROKER BUY OFFER] Failed to create buy offer:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Cancels buy offer (for escrow refund)
  async cancelBuyOffer(offerId: string): Promise<string> {
    await this.connect();

    try {
      const tx: any = {
        TransactionType: 'NFTokenCancelOffer',
        Account: this.wallet.address,
        NFTokenOffers: [offerId]
      };

      const prepared = await this.client.autofill(tx);
      const signed = this.wallet.sign(prepared);
      const result = await this.client.submitAndWait(signed.tx_blob);

      const txResult = (result.result.meta as any)?.TransactionResult;
      
      if (txResult === 'tesSUCCESS') {
        console.log(`✅ Buy offer cancelled: ${result.result.hash}`);
        return result.result.hash;
      } else {
        throw new Error(`Transaction failed: ${txResult}`);
      }
    } catch (error) {
      console.error('❌ Failed to cancel buy offer:', error);
      throw error;
    }
  }

  // Refunds escrowed XRP to user
  async refundEscrow(userAddress: string, amountDrops: string): Promise<{ success: boolean, txHash?: string, error?: string }> {
    await this.connect();

    try {
      const tx: any = {
        TransactionType: 'Payment',
        Account: this.wallet.address,
        Destination: userAddress,
        Amount: amountDrops
      };

      const prepared = await this.client.autofill(tx);
      const signed = this.wallet.sign(prepared);
      const result = await this.client.submitAndWait(signed.tx_blob);

      const txResult = (result.result.meta as any)?.TransactionResult;
      
      if (txResult === 'tesSUCCESS') {
        console.log(`✅ [ESCROW REFUND] Refunded ${amountDrops} drops to ${userAddress}: ${result.result.hash}`);
        return {
          success: true,
          txHash: result.result.hash
        };
      } else {
        throw new Error(`Refund failed: ${txResult}`);
      }
    } catch (error) {
      console.error('❌ [ESCROW REFUND] Failed to refund:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Transfers NFT from broker to user (completes escrow)
  async transferNFTToUser(nftTokenId: string, userAddress: string): Promise<{ success: boolean, txHash?: string, error?: string }> {
    await this.connect();

    try {
      // Create a sell offer for 0 XRP to the user (free transfer)
      const tx: any = {
        TransactionType: 'NFTokenCreateOffer',
        Account: this.wallet.address,
        NFTokenID: nftTokenId,
        Amount: '0', // Free transfer
        Destination: userAddress, // Only this user can accept
        Flags: 1 // Sell offer
      };

      const prepared = await this.client.autofill(tx);
      const signed = this.wallet.sign(prepared);
      const result = await this.client.submitAndWait(signed.tx_blob);

      const meta = result.result.meta as any;
      const txResult = meta?.TransactionResult;

      if (txResult === 'tesSUCCESS') {
        const createdOffers = meta?.CreatedNode || meta?.AffectedNodes?.filter((n: any) => n.CreatedNode?.LedgerEntryType === 'NFTokenOffer');
        const offerNode = createdOffers?.[0]?.CreatedNode || createdOffers?.[0];
        const offerId = offerNode?.LedgerIndex || 'UNKNOWN';

        console.log(`✅ [NFT TRANSFER] Created transfer offer to ${userAddress}: ${result.result.hash}`);
        console.log(`📋 [NFT TRANSFER] Offer ID: ${offerId}`);
        
        // Auto-accept the offer from broker side (0 XRP so user gets it free)
        // NOTE: User still needs to accept this 0 XRP offer to receive the NFT
        // This is a limitation of XRPL - we can't force-send NFTs
        
        return {
          success: true,
          txHash: result.result.hash
        };
      } else {
        throw new Error(`NFT transfer failed: ${txResult}`);
      }
    } catch (error) {
      console.error('❌ [NFT TRANSFER] Failed to transfer NFT:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

let brokerInstance: NFTBrokerService | null = null;

export function initializeBrokerService(): NFTBrokerService {
  const brokerSeed = process.env.BROKER_WALLET_SEED;

  if (!brokerSeed) {
    throw new Error('BROKER_WALLET_SEED environment variable is not set');
  }

  if (!brokerInstance) {
    brokerInstance = new NFTBrokerService({ 
      seed: brokerSeed,
      rpcUrl: 'wss://xrplcluster.com'
    });
  }

  return brokerInstance;
}

export function getBrokerService(): NFTBrokerService {
  if (!brokerInstance) {
    return initializeBrokerService();
  }
  return brokerInstance;
}
