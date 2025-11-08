// NFT Fee Calculator - Comprehensive fee and royalty calculation for all NFT transactions
import { Client as XRPLClient } from 'xrpl';
import { RIDDLE_BROKER_CONFIG } from '../payment-payloads';

export interface NFTFeeBreakdown {
  // Base transaction details
  transactionType: 'buy_offer' | 'sell_offer' | 'accept_offer' | 'transfer';
  nftokenID: string;
  baseAmount: string; // In drops
  
  // Fee breakdown
  networkFee: string; // XRPL network fee (drops)
  brokerFee: string; // Marketplace broker fee (drops)
  royaltyFee: string; // Creator royalty fee (drops)
  totalFees: string; // Sum of all fees (drops)
  
  // Final amounts
  grossAmount: string; // Total amount including all fees (drops)
  netAmount: string; // Amount after deducting fees (drops)
  
  // Detailed fee information
  brokerFeePercentage: number; // 1% = 0.01
  royaltyPercentage: number; // Creator royalty %
  
  // Conversion helpers
  amountXRP: string; // Base amount in XRP
  feesXRP: string; // Total fees in XRP
  grossAmountXRP: string; // Total in XRP
  netAmountXRP: string; // Net in XRP
  
  // Validation
  isBrokered: boolean;
  hasRoyalties: boolean;
  
  // Additional info
  brokerAddress?: string;
  royaltyRecipient?: string;
  estimatedConfirmationTime: string;
}

export interface NFTRoyaltyInfo {
  hasRoyalties: boolean;
  transferFeePermille: number; // Transfer fee in thousandths of a percent (0-50000)
  royaltyRate: number; // Display percentage (0-50)
  royaltyRecipient?: string;
  royaltyAmount: string; // In drops
}

export class NFTFeeCalculator {
  private client: XRPLClient;

  constructor(xrplServerUrl: string = 'wss://s1.ripple.com') {
    this.client = new XRPLClient(xrplServerUrl);
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

  // Convert drops to XRP for display
  private dropsToXRP(drops: string): string {
    const wholePart = (BigInt(drops) / BigInt(1000000)).toString();
    const fractionalPart = (BigInt(drops) % BigInt(1000000)).toString().padStart(6, '0').replace(/0+$/, '');
    return fractionalPart ? `${wholePart}.${fractionalPart}` : wholePart;
  }

  // Get NFT royalty information from the token itself by finding current owner
  async getNFTRoyalties(nftokenID: string): Promise<NFTRoyaltyInfo> {
    try {
      await this.connect();
      
      // Try to find current owner by checking sell offers first
      try {
        const sellOffersRequest = await this.client.request({
          command: 'nft_sell_offers',
          nft_id: nftokenID
        });

        // If we have sell offers, the owner is in the offers
        if (sellOffersRequest.result?.offers && sellOffersRequest.result.offers.length > 0) {
          const owner = sellOffersRequest.result.offers[0].owner;
          return await this.getRoyaltiesFromOwner(nftokenID, owner);
        }
      } catch (error) {
        console.warn('Could not fetch sell offers for NFT:', error);
      }

      // Try buy offers as fallback
      try {
        const buyOffersRequest = await this.client.request({
          command: 'nft_buy_offers',
          nft_id: nftokenID
        });

        // If we have buy offers, check each for the owner
        if (buyOffersRequest.result?.offers && buyOffersRequest.result.offers.length > 0) {
          const owner = buyOffersRequest.result.offers[0].owner;
          return await this.getRoyaltiesFromOwner(nftokenID, owner);
        }
      } catch (error) {
        console.warn('Could not fetch buy offers for NFT:', error);
      }

      return {
        hasRoyalties: false,
        transferFeePermille: 0,
        royaltyRate: 0,
        royaltyAmount: '0'
      };
    } catch (error) {
      console.warn('Could not fetch NFT royalty info:', error);
      return {
        hasRoyalties: false,
        transferFeePermille: 0,
        royaltyRate: 0,
        royaltyAmount: '0'
      };
    }
  }

  // Helper method to get royalties from a specific owner's account
  private async getRoyaltiesFromOwner(nftokenID: string, ownerAddress: string): Promise<NFTRoyaltyInfo> {
    try {
      const accountNFTsRequest = await this.client.request({
        command: 'account_nfts',
        account: ownerAddress
      });

      if (accountNFTsRequest.result?.account_nfts) {
        const nft = accountNFTsRequest.result.account_nfts.find(
          (nft: any) => nft.NFTokenID === nftokenID
        );

        if (nft && nft.TransferFee !== undefined) {
          const transferFeePermille = nft.TransferFee; // Already in thousandths of a percent
          const royaltyRate = transferFeePermille / 1000; // Convert to percentage for display
          
          return {
            hasRoyalties: transferFeePermille > 0,
            transferFeePermille: transferFeePermille,
            royaltyRate: royaltyRate,
            royaltyRecipient: nft.Issuer || ownerAddress,
            royaltyAmount: '0' // Will be calculated based on transaction amount
          };
        }
      }

      return {
        hasRoyalties: false,
        transferFeePermille: 0,
        royaltyRate: 0,
        royaltyAmount: '0'
      };
    } catch (error) {
      console.warn('Could not fetch NFT from owner account:', error);
      return {
        hasRoyalties: false,
        transferFeePermille: 0,
        royaltyRate: 0,
        royaltyAmount: '0'
      };
    }
  }

  // Calculate comprehensive fee breakdown for buy offers
  async calculateBuyOfferFees(
    nftokenID: string, 
    offerAmountDrops: string,
    isBrokered: boolean = true
  ): Promise<NFTFeeBreakdown> {
    await this.connect();

    const baseAmount = BigInt(offerAmountDrops);
    const networkFeeDrops = BigInt(12); // Standard XRPL network fee
    
    // Get royalty information
    const royaltyInfo = await this.getNFTRoyalties(nftokenID);
    const royaltyFeeDrops = royaltyInfo.hasRoyalties 
      ? (baseAmount * BigInt(royaltyInfo.transferFeePermille)) / BigInt(100000)  // Pure integer calculation
      : BigInt(0);

    // Calculate broker fee (1% for brokered transactions)
    const brokerFeeDrops = isBrokered 
      ? (baseAmount * BigInt(Math.round(RIDDLE_BROKER_CONFIG.feePercentage * 10000))) / BigInt(10000)
      : BigInt(0);

    const totalFeesDrops = networkFeeDrops + brokerFeeDrops + royaltyFeeDrops;
    const grossAmountDrops = baseAmount + totalFeesDrops;

    return {
      transactionType: 'buy_offer',
      nftokenID,
      baseAmount: baseAmount.toString(),
      
      networkFee: networkFeeDrops.toString(),
      brokerFee: brokerFeeDrops.toString(),
      royaltyFee: royaltyFeeDrops.toString(),
      totalFees: totalFeesDrops.toString(),
      
      grossAmount: grossAmountDrops.toString(),
      netAmount: baseAmount.toString(), // For buy offers, net = base (what seller receives)
      
      brokerFeePercentage: RIDDLE_BROKER_CONFIG.feePercentage,
      royaltyPercentage: royaltyInfo.royaltyRate,
      
      amountXRP: this.dropsToXRP(baseAmount.toString()),
      feesXRP: this.dropsToXRP(totalFeesDrops.toString()),
      grossAmountXRP: this.dropsToXRP(grossAmountDrops.toString()),
      netAmountXRP: this.dropsToXRP(baseAmount.toString()),
      
      isBrokered,
      hasRoyalties: royaltyInfo.hasRoyalties,
      
      brokerAddress: isBrokered ? RIDDLE_BROKER_CONFIG.brokerWallet : undefined,
      royaltyRecipient: royaltyInfo.royaltyRecipient,
      estimatedConfirmationTime: '3-5 seconds'
    };
  }

  // Calculate fees for accepting an offer
  async calculateAcceptOfferFees(
    nftokenID: string,
    offerAmountDrops: string,
    isBrokered: boolean = false,
    isSellerAccepting: boolean = true
  ): Promise<NFTFeeBreakdown> {
    await this.connect();

    const baseAmount = BigInt(offerAmountDrops);
    const networkFeeDrops = BigInt(12); // Standard XRPL network fee
    
    // Get royalty information
    const royaltyInfo = await this.getNFTRoyalties(nftokenID);
    const royaltyFeeDrops = royaltyInfo.hasRoyalties 
      ? (baseAmount * BigInt(royaltyInfo.transferFeePermille)) / BigInt(100000)  // Pure integer calculation
      : BigInt(0);

    // For acceptance, broker fee is already included in the offer amount
    const brokerFeeDrops = BigInt(0); // Not charged separately on acceptance
    
    const totalFeesDrops = networkFeeDrops + royaltyFeeDrops;
    
    // For sellers accepting buy offers, they receive: amount - royalties - network fee
    // For buyers accepting sell offers, they pay: amount + network fee (royalties auto-deducted)
    const netAmountDrops = isSellerAccepting 
      ? baseAmount - royaltyFeeDrops - networkFeeDrops
      : baseAmount + networkFeeDrops;

    return {
      transactionType: 'accept_offer',
      nftokenID,
      baseAmount: baseAmount.toString(),
      
      networkFee: networkFeeDrops.toString(),
      brokerFee: brokerFeeDrops.toString(),
      royaltyFee: royaltyFeeDrops.toString(),
      totalFees: totalFeesDrops.toString(),
      
      grossAmount: baseAmount.toString(),
      netAmount: netAmountDrops.toString(),
      
      brokerFeePercentage: 0, // Already included in offer
      royaltyPercentage: royaltyInfo.royaltyRate,
      
      amountXRP: this.dropsToXRP(baseAmount.toString()),
      feesXRP: this.dropsToXRP(totalFeesDrops.toString()),
      grossAmountXRP: this.dropsToXRP(baseAmount.toString()),
      netAmountXRP: this.dropsToXRP(netAmountDrops.toString()),
      
      isBrokered,
      hasRoyalties: royaltyInfo.hasRoyalties,
      
      brokerAddress: isBrokered ? RIDDLE_BROKER_CONFIG.brokerWallet : undefined,
      royaltyRecipient: royaltyInfo.royaltyRecipient,
      estimatedConfirmationTime: '3-5 seconds'
    };
  }

  // Calculate fees for NFT transfers
  async calculateTransferFees(nftokenID: string): Promise<NFTFeeBreakdown> {
    await this.connect();

    const networkFeeDrops = BigInt(12); // Standard XRPL network fee
    const baseAmount = BigInt(0); // Transfers are typically 0 amount
    
    // Get royalty information (transfers may trigger royalties depending on implementation)
    const royaltyInfo = await this.getNFTRoyalties(nftokenID);
    
    return {
      transactionType: 'transfer',
      nftokenID,
      baseAmount: '0',
      
      networkFee: networkFeeDrops.toString(),
      brokerFee: '0',
      royaltyFee: '0', // Transfers typically don't trigger royalties
      totalFees: networkFeeDrops.toString(),
      
      grossAmount: networkFeeDrops.toString(),
      netAmount: '0',
      
      brokerFeePercentage: 0,
      royaltyPercentage: 0,
      
      amountXRP: '0',
      feesXRP: this.dropsToXRP(networkFeeDrops.toString()),
      grossAmountXRP: this.dropsToXRP(networkFeeDrops.toString()),
      netAmountXRP: '0',
      
      isBrokered: false,
      hasRoyalties: false,
      
      estimatedConfirmationTime: '3-5 seconds'
    };
  }

  // Get current network reserve requirements
  async getNetworkReserves(): Promise<{ baseReserve: string; ownerReserve: string }> {
    try {
      await this.connect();
      
      const serverInfo = await this.client.request({ command: 'server_info' });
      const info = serverInfo.result?.info;
      
      if (info?.validated_ledger) {
        const baseReserve = info.validated_ledger.reserve_base_xrp || '10';
        const ownerReserve = info.validated_ledger.reserve_inc_xrp || '2';
        
        return {
          baseReserve: (parseFloat(String(baseReserve)) * 1000000).toString(), // Convert to drops
          ownerReserve: (parseFloat(String(ownerReserve)) * 1000000).toString()
        };
      }
    } catch (error) {
      console.warn('Could not fetch network reserves:', error);
    }
    
    // Default reserves
    return {
      baseReserve: '10000000', // 10 XRP in drops
      ownerReserve: '2000000'   // 2 XRP in drops
    };
  }
}

export default NFTFeeCalculator;