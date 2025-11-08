// RiddleNFTBroker - Neverknow1
// Handles brokered NFT transactions with fee separation on XRPL

import { Client, Wallet, xrpToDrops, dropsToXrp } from 'xrpl';
import { RIDDLE_BROKER_CONFIG, NFTPaymentPayload } from './payment-payloads';

export interface BrokerWalletConfig {
  address: string;
  secret: string;
  nickname: string;
}

export class RiddleNFTBroker {
  private client: Client;
  private brokerWallet: Wallet | null = null;
  private isConnected: boolean = false;

  constructor(
    private brokerConfig: BrokerWalletConfig,
    private xrplServer: string = 'wss://xrplcluster.com'
  ) {
    this.client = new Client(this.xrplServer);
    
    // Only initialize wallet if valid credentials are provided
    if (this.isValidBrokerConfig(this.brokerConfig)) {
      this.brokerWallet = Wallet.fromSeed(this.brokerConfig.secret);
      console.log(`🏦 RiddleNFTBroker initialized: ${this.brokerConfig.nickname}`);
      console.log(`📍 Broker Address: ${this.brokerWallet.classicAddress}`);
    } else {
      console.log(`⏳ RiddleNFTBroker waiting for valid credentials from user...`);
    }
  }

  // Check if broker has valid wallet credentials and is ready
  hasValidWallet(): boolean {
    return this.brokerWallet !== null && this.isValidBrokerConfig(this.brokerConfig);
  }

  // Get broker readiness status
  getBrokerStatus(): { ready: boolean; connected: boolean; address?: string; error?: string } {
    if (!this.hasValidWallet()) {
      return {
        ready: false,
        connected: false,
        error: 'Broker credentials are missing or invalid (placeholders detected)'
      };
    }
    
    return {
      ready: true,
      connected: this.isConnected,
      address: this.brokerWallet!.classicAddress
    };
  }

  private isValidBrokerConfig(config: BrokerWalletConfig): boolean {
    return !!(config.secret && 
           config.secret.length > 10 && 
           config.secret.startsWith('s') &&
           !config.secret.includes('Neverknow1') &&
           !config.secret.includes('Secret'));
  }

  async connect(): Promise<void> {
    if (!this.brokerWallet) {
      console.log('⏳ Cannot connect broker - waiting for valid wallet credentials');
      return;
    }

    try {
      await this.client.connect();
      this.isConnected = true;
      console.log('✅ RiddleNFTBroker connected to XRPL');
      
      // Check broker wallet balance
      const balance = await this.getBrokerBalance();
      console.log(`💰 Broker wallet balance: ${balance} XRP`);
    } catch (error) {
      console.error('❌ Failed to connect RiddleNFTBroker:', error);
      throw error;
    }
  }

  // Set broker credentials after user provides them
  setBrokerCredentials(address: string, secret: string): void {
    if (!secret || !secret.startsWith('s') || secret.includes('Neverknow1')) {
      throw new Error('Invalid broker credentials provided');
    }

    try {
      this.brokerWallet = Wallet.fromSeed(secret);
      this.brokerConfig.address = address;
      this.brokerConfig.secret = secret;
      
      console.log(`✅ Broker credentials set successfully: ${this.brokerWallet.classicAddress}`);
    } catch (error) {
      console.error('❌ Failed to set broker credentials:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.disconnect();
      this.isConnected = false;
      console.log('🔌 RiddleNFTBroker disconnected');
    }
  }

  async getBrokerBalance(): Promise<string> {
    if (!this.isConnected || !this.brokerWallet) {
      throw new Error('Broker not connected');
    }

    try {
      const response = await this.client.request({
        command: 'account_info',
        account: this.brokerWallet.classicAddress
      });
      
      const balanceValue = response.result.account_data.Balance as string | number;
      const xrpAmount = dropsToXrp(balanceValue);
      return String(xrpAmount);
    } catch (error) {
      console.error('❌ Failed to get broker balance:', error);
      return '0';
    }
  }

  // CREATE SELL OFFER - Seller creates sell offer directed to broker (from attached guide)
  async createSellOffer(
    sellerWallet: Wallet,
    nftID: string,
    priceDrops: number
  ): Promise<{ success: boolean; sellOfferIndex?: string; error?: string }> {
    if (!this.isConnected || !this.brokerWallet) {
      throw new Error('Broker not connected');
    }

    try {
      const sellOfferTx = {
        TransactionType: 'NFTokenCreateOffer' as const,
        Account: sellerWallet.classicAddress,
        NFTokenID: nftID,
        Amount: priceDrops.toString(),
        Flags: 1, // Sell offer
        Destination: this.brokerWallet.classicAddress // Directed to broker
      };

      console.log(`📤 [SELL OFFER] Creating sell offer directed to broker:`, {
        nftID,
        price: `${priceDrops} drops`,
        seller: sellerWallet.classicAddress,
        broker: this.brokerWallet.classicAddress
      });

      const prepared = await this.client.autofill(sellOfferTx);
      const signed = sellerWallet.sign(prepared);
      const result = await this.client.submitAndWait(signed.tx_blob);
      
      const meta = result.result.meta as any;
      if (meta?.TransactionResult === 'tesSUCCESS') {
        // FIXED: Extract actual offer index from transaction metadata (not tx hash)
        let sellOfferIndex: string | null = null;
        
        if (meta.AffectedNodes) {
          for (const node of meta.AffectedNodes) {
            if (node.CreatedNode && node.CreatedNode.LedgerEntryType === 'NFTokenOffer') {
              sellOfferIndex = node.CreatedNode.LedgerIndex;
              break;
            }
          }
        }
        
        if (!sellOfferIndex) {
          throw new Error('Could not extract offer index from transaction metadata');
        }
        
        console.log(`✅ [SELL OFFER] Sell offer created successfully: ${sellOfferIndex}`);
        return {
          success: true,
          sellOfferIndex: sellOfferIndex
        };
      } else {
        throw new Error(`Sell offer failed: ${meta?.TransactionResult}`);
      }
    } catch (error) {
      console.error('❌ Sell offer creation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // CREATE BUY OFFER - Buyer creates buy offer directed to broker (from attached guide)
  async createBuyOffer(
    buyerWallet: Wallet,
    nftID: string,
    priceDrops: number
  ): Promise<{ success: boolean; buyOfferIndex?: string; error?: string }> {
    if (!this.isConnected || !this.brokerWallet) {
      throw new Error('Broker not connected');
    }

    try {
      const buyOfferTx = {
        TransactionType: 'NFTokenCreateOffer' as const,
        Account: buyerWallet.classicAddress,
        NFTokenID: nftID,
        Amount: priceDrops.toString(),
        Flags: 0, // Buy offer
        Destination: this.brokerWallet.classicAddress // Directed to broker
      };

      console.log(`🛒 [BUY OFFER] Creating buy offer directed to broker:`, {
        nftID,
        price: `${priceDrops} drops`,
        buyer: buyerWallet.classicAddress,
        broker: this.brokerWallet.classicAddress
      });

      const prepared = await this.client.autofill(buyOfferTx);
      const signed = buyerWallet.sign(prepared);
      const result = await this.client.submitAndWait(signed.tx_blob);
      
      const meta = result.result.meta as any;
      if (meta?.TransactionResult === 'tesSUCCESS') {
        // FIXED: Extract actual offer index from transaction metadata (not tx hash)
        let buyOfferIndex: string | null = null;
        
        if (meta.AffectedNodes) {
          for (const node of meta.AffectedNodes) {
            if (node.CreatedNode && node.CreatedNode.LedgerEntryType === 'NFTokenOffer') {
              buyOfferIndex = node.CreatedNode.LedgerIndex;
              break;
            }
          }
        }
        
        if (!buyOfferIndex) {
          throw new Error('Could not extract offer index from transaction metadata');
        }
        
        console.log(`✅ [BUY OFFER] Buy offer created successfully: ${buyOfferIndex}`);
        return {
          success: true,
          buyOfferIndex: buyOfferIndex
        };
      } else {
        throw new Error(`Buy offer failed: ${meta?.TransactionResult}`);
      }
    } catch (error) {
      console.error('❌ Buy offer creation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // VALIDATE OFFERS ON-LEDGER - Prevent fee-griefing attacks
  async validateBrokerOffers(
    sellOfferIndex: string,
    buyOfferIndex: string,
    expectedNFTID: string
  ): Promise<{ 
    valid: boolean; 
    sellAmount?: number; 
    buyAmount?: number; 
    error?: string 
  }> {
    if (!this.isConnected || !this.brokerWallet) {
      throw new Error('Broker not connected');
    }

    try {
      // Fetch both offers from ledger to validate them
      const [sellOfferResponse, buyOfferResponse] = await Promise.all([
        this.client.request({
          command: 'ledger_entry',
          index: sellOfferIndex
        }).catch(() => null),
        this.client.request({
          command: 'ledger_entry', 
          index: buyOfferIndex
        }).catch(() => null)
      ]);

      if (!sellOfferResponse?.result?.node || !buyOfferResponse?.result?.node) {
        return { valid: false, error: 'One or both offers do not exist on ledger' };
      }

      const sellOffer = sellOfferResponse.result.node as any;
      const buyOffer = buyOfferResponse.result.node as any;

      // Validate offer structure and properties
      if (sellOffer.LedgerEntryType !== 'NFTokenOffer' || buyOffer.LedgerEntryType !== 'NFTokenOffer') {
        return { valid: false, error: 'Invalid offer types on ledger' };
      }

      // Validate both offers are for the same NFT
      if (sellOffer.NFTokenID !== expectedNFTID || buyOffer.NFTokenID !== expectedNFTID) {
        return { valid: false, error: 'Offers do not match expected NFT ID' };
      }

      // Validate both offers are directed to broker
      if (sellOffer.Destination !== this.brokerWallet.classicAddress || 
          buyOffer.Destination !== this.brokerWallet.classicAddress) {
        return { valid: false, error: 'Offers are not directed to broker address' };
      }

      // Validate offer flags (sell = 1, buy = 0)
      if ((sellOffer.Flags & 1) !== 1 || (buyOffer.Flags & 1) !== 0) {
        return { valid: false, error: 'Invalid offer flags - sell offer must have flag 1, buy offer flag 0' };
      }

      // Handle Amount as string (XRP drops) or issued currency object
      const sellAmount = typeof sellOffer.Amount === 'string' 
        ? parseInt(sellOffer.Amount) 
        : 0; // Only handle XRP for now
      const buyAmount = typeof buyOffer.Amount === 'string' 
        ? parseInt(buyOffer.Amount) 
        : 0; // Only handle XRP for now

      if (sellAmount === 0 || buyAmount === 0) {
        return { valid: false, error: 'Only XRP offers are supported for broker transactions' };
      }

      // Check if offers are expired (XRPL uses Ripple epoch: seconds since 2000-01-01)
      const rippleEpochStart = 946684800; // Unix timestamp for 2000-01-01 00:00:00 UTC
      const rippleNow = Math.floor(Date.now() / 1000) - rippleEpochStart;
      if ((sellOffer.Expiration && sellOffer.Expiration < rippleNow) ||
          (buyOffer.Expiration && buyOffer.Expiration < rippleNow)) {
        return { valid: false, error: 'One or both offers have expired' };
      }

      // Validate buy amount > sell amount (room for broker fee)
      if (buyAmount <= sellAmount) {
        return { valid: false, error: 'Buy amount must be greater than sell amount for broker fee' };
      }

      console.log(`✅ [VALIDATION] Offers validated successfully:`);
      console.log(`   - Sell Amount: ${sellAmount} drops`);
      console.log(`   - Buy Amount: ${buyAmount} drops`);
      console.log(`   - Available for broker fee: ${buyAmount - sellAmount} drops`);

      return { 
        valid: true, 
        sellAmount, 
        buyAmount 
      };

    } catch (error) {
      console.error('❌ Offer validation failed:', error);
      return { 
        valid: false, 
        error: error instanceof Error ? error.message : 'Validation failed' 
      };
    }
  }

  // BROKER SALE - Match sell and buy offers with 1% fee, royalties auto-paid (from attached guide)
  async brokerSale(
    sellOfferIndex: string,
    buyOfferIndex: string,
    expectedNFTID: string,
    serverComputedFee?: number
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    if (!this.isConnected || !this.brokerWallet) {
      throw new Error('Broker not connected');
    }

    try {
      // CRITICAL: Validate offers on-ledger first to prevent fee-griefing
      console.log(`🔍 [VALIDATION] Validating offers on-ledger...`);
      const validation = await this.validateBrokerOffers(sellOfferIndex, buyOfferIndex, expectedNFTID);
      
      if (!validation.valid) {
        throw new Error(`Offer validation failed: ${validation.error}`);
      }

      // Server computes broker fee from validated amounts (prevent client manipulation)
      const brokerFeeDrops = serverComputedFee || Math.floor((validation.buyAmount! - validation.sellAmount!) * RIDDLE_BROKER_CONFIG.feePercentage);
      
      // Validate computed fee doesn't exceed available amount
      if (brokerFeeDrops > (validation.buyAmount! - validation.sellAmount!)) {
        throw new Error(`Broker fee (${brokerFeeDrops}) exceeds available amount (${validation.buyAmount! - validation.sellAmount!})`);
      }
      const brokerTx = {
        TransactionType: 'NFTokenAcceptOffer' as const,
        Account: this.brokerWallet.classicAddress,
        NFTokenSellOffer: sellOfferIndex,
        NFTokenBuyOffer: buyOfferIndex,
        NFTokenBrokerFee: brokerFeeDrops.toString() // 1% broker fee
      };

      console.log(`🏦 [BROKER SALE] Brokering NFT sale with bank wallet:`, {
        sellOffer: sellOfferIndex,
        buyOffer: buyOfferIndex,
        brokerFee: `${brokerFeeDrops} drops (1%)`,
        broker: this.brokerWallet.classicAddress
      });

      const prepared = await this.client.autofill(brokerTx);
      const signed = this.brokerWallet.sign(prepared); // Signs with BANK private key
      const result = await this.client.submitAndWait(signed.tx_blob);
      
      const meta = result.result.meta as any;
      if (meta?.TransactionResult === 'tesSUCCESS') {
        console.log(`✅ [BROKER SALE] NFT sale brokered successfully!`);
        console.log(`💰 Broker fee (1%) collected: ${brokerFeeDrops.toString()} drops`);
        console.log(`👑 Royalties automatically paid by XRPL`);
        console.log(`🔗 Transaction hash: ${result.result.hash}`);
        
        return {
          success: true,
          txHash: result.result.hash
        };
      } else {
        throw new Error(`Broker transaction failed: ${meta?.TransactionResult}`);
      }
    } catch (error) {
      console.error('❌ Broker sale failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // COMPLETE BROKER FLOW - Execute full broker transaction from sell offer to completion
  async executeCompleteBrokerFlow(
    sellerWallet: Wallet,
    buyerWallet: Wallet,
    nftID: string,
    basePriceXRP: number
  ): Promise<{ success: boolean; txHash?: string; details?: any; error?: string }> {
    if (!this.isConnected || !this.brokerWallet) {
      throw new Error('Broker not connected');
    }

    try {
      console.log(`🚀 [COMPLETE FLOW] Starting complete broker transaction flow...`);
      console.log(`📋 Details: NFT ${nftID}, Price: ${basePriceXRP} XRP`);
      
      // Step 1: Calculate amounts (following attached guide)
      const basePriceDrops = Math.floor(basePriceXRP * 1000000); // Convert XRP to drops
      const brokerFeeDrops = Math.floor(basePriceDrops * 0.01); // 1% broker fee
      const buyerTotalDrops = basePriceDrops + brokerFeeDrops; // Buyer pays extra for broker fee

      console.log(`💰 [AMOUNTS] Base: ${basePriceDrops} drops, Broker Fee: ${brokerFeeDrops} drops, Total: ${buyerTotalDrops} drops`);

      // Step 2: Create sell offer (seller offers NFT for base price)
      console.log(`📤 [STEP 1] Creating sell offer...`);
      const sellResult = await this.createSellOffer(sellerWallet, nftID, basePriceDrops);
      if (!sellResult.success) {
        throw new Error(`Sell offer failed: ${sellResult.error}`);
      }

      // Step 3: Create buy offer (buyer offers base price + broker fee)
      console.log(`🛒 [STEP 2] Creating buy offer...`);
      const buyResult = await this.createBuyOffer(buyerWallet, nftID, buyerTotalDrops);
      if (!buyResult.success) {
        throw new Error(`Buy offer failed: ${buyResult.error}`);
      }

      // Step 4: Broker the sale (match offers, take 1% fee, royalties auto-paid)
      console.log(`🏦 [STEP 3] Brokering the sale...`);
      const brokerResult = await this.brokerSale(
        sellResult.sellOfferIndex!,
        buyResult.buyOfferIndex!,
        nftID,
        brokerFeeDrops
      );

      if (!brokerResult.success) {
        throw new Error(`Broker transaction failed: ${brokerResult.error}`);
      }

      console.log(`🎉 [COMPLETE FLOW] Broker transaction completed successfully!`);
      console.log(`📊 Final breakdown:`);
      console.log(`   - NFT transferred to buyer`);
      console.log(`   - Seller received: ~${basePriceXRP} XRP (minus royalties)`);
      console.log(`   - Broker collected: 1% fee (${dropsToXrp(brokerFeeDrops.toString())} XRP)`);
      console.log(`   - Royalties automatically paid to NFT issuer by XRPL`);

      return {
        success: true,
        txHash: brokerResult.txHash,
        details: {
          basePriceXRP,
          brokerFeeXRP: brokerFeeDrops / 1000000,
          sellOfferIndex: sellResult.sellOfferIndex,
          buyOfferIndex: buyResult.buyOfferIndex,
          finalTxHash: brokerResult.txHash
        }
      };
    } catch (error) {
      console.error('❌ Complete broker flow failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Execute brokered NFT purchase (Buy Now)
  async executeBrokeredPurchase(
    sellOfferIndex: string,
    buyOfferIndex: string,
    expectedAmount: string
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    if (!this.isConnected || !this.brokerWallet) {
      throw new Error('Broker not connected');
    }

    try {
      const brokerFee = Math.floor(parseFloat(expectedAmount) * RIDDLE_BROKER_CONFIG.feePercentage * 1000000);
      
      const acceptOfferTx = {
        TransactionType: 'NFTokenAcceptOffer' as const,
        Account: this.brokerWallet.classicAddress,
        NFTokenSellOffer: sellOfferIndex,
        NFTokenBuyOffer: buyOfferIndex,
        NFTokenBrokerFee: brokerFee.toString()
      };

      console.log('🔄 Executing brokered purchase:', {
        sellOffer: sellOfferIndex,
        buyOffer: buyOfferIndex,
        brokerFee: dropsToXrp(brokerFee.toString()) + ' XRP'
      });

      const prepared = await this.client.autofill(acceptOfferTx);
      const signed = this.brokerWallet.sign(prepared);
      const result = await this.client.submitAndWait(signed.tx_blob);

      const meta = result.result.meta as any;
      if (meta?.TransactionResult === 'tesSUCCESS') {
        console.log('✅ Brokered purchase successful:', result.result.hash);
        return {
          success: true,
          txHash: result.result.hash
        };
      } else {
        throw new Error(`Transaction failed: ${meta?.TransactionResult}`);
      }
    } catch (error) {
      console.error('❌ Brokered purchase failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Execute brokered offer acceptance
  async executeBrokeredOfferAcceptance(
    buyOfferIndex: string,
    sellerAddress: string,
    nftokenID: string,
    offerAmount: string
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    if (!this.isConnected || !this.brokerWallet) {
      throw new Error('Broker not connected');
    }

    try {
      const brokerFee = Math.floor(parseFloat(offerAmount) * RIDDLE_BROKER_CONFIG.feePercentage * 1000000);
      
      // First, create a sell offer from the seller (this would be done separately)
      // Then accept both offers with broker fee
      const acceptOfferTx = {
        TransactionType: 'NFTokenAcceptOffer' as const,
        Account: this.brokerWallet.classicAddress,
        NFTokenBuyOffer: buyOfferIndex,
        NFTokenBrokerFee: brokerFee.toString()
      };

      console.log('🔄 Executing brokered offer acceptance:', {
        buyOffer: buyOfferIndex,
        brokerFee: dropsToXrp(brokerFee.toString()) + ' XRP'
      });

      const prepared = await this.client.autofill(acceptOfferTx);
      const signed = this.brokerWallet.sign(prepared);
      const result = await this.client.submitAndWait(signed.tx_blob);

      const offerMeta = result.result.meta as any;
      if (offerMeta?.TransactionResult === 'tesSUCCESS') {
        console.log('✅ Brokered offer acceptance successful:', result.result.hash);
        return {
          success: true,
          txHash: result.result.hash
        };
      } else {
        throw new Error(`Transaction failed: ${offerMeta?.TransactionResult}`);
      }
    } catch (error) {
      console.error('❌ Brokered offer acceptance failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Get NFT offers for a specific token
  async getNFTOffers(nftokenID: string): Promise<{
    sellOffers: any[];
    buyOffers: any[];
  }> {
    if (!this.isConnected || !this.brokerWallet) {
      throw new Error('Broker not connected');
    }

    try {
      const [sellOffersResponse, buyOffersResponse] = await Promise.all([
        this.client.request({
          command: 'nft_sell_offers',
          nft_id: nftokenID
        }),
        this.client.request({
          command: 'nft_buy_offers',
          nft_id: nftokenID
        })
      ]);

      return {
        sellOffers: sellOffersResponse.result.offers || [],
        buyOffers: buyOffersResponse.result.offers || []
      };
    } catch (error) {
      console.error('❌ Failed to get NFT offers:', error);
      return { sellOffers: [], buyOffers: [] };
    }
  }

  // Validate transaction before execution
  validateTransaction(payload: NFTPaymentPayload): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!payload.nftokenID || payload.nftokenID.length !== 64) {
      errors.push('Invalid NFToken ID');
    }

    if (!payload.account || payload.account.length < 25) {
      errors.push('Invalid account address');
    }

    const amount = parseFloat(payload.amount);
    if (isNaN(amount) || amount <= 0) {
      errors.push('Invalid amount');
    }

    if (payload.expiration && payload.expiration <= Math.floor(Date.now() / 1000)) {
      errors.push('Expiration time is in the past');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Get broker statistics
  async getBrokerStats(): Promise<{
    totalFeesCollected: string;
    transactionsProcessed: number;
    balance: string;
  }> {
    try {
      const balance = await this.getBrokerBalance();
      
      // This would require tracking in database
      return {
        totalFeesCollected: '0', // TODO: Track in database
        transactionsProcessed: 0, // TODO: Track in database
        balance
      };
    } catch (error) {
      console.error('❌ Failed to get broker stats:', error);
      return {
        totalFeesCollected: '0',
        transactionsProcessed: 0,
        balance: '0'
      };
    }
  }
}

// Singleton broker instance
let brokerInstance: RiddleNFTBroker | null = null;

export function createBrokerInstance(config: BrokerWalletConfig): RiddleNFTBroker {
  if (!brokerInstance) {
    brokerInstance = new RiddleNFTBroker(config);
  }
  return brokerInstance;
}

export function getBrokerInstance(): RiddleNFTBroker | null {
  return brokerInstance;
}