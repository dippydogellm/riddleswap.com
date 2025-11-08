import { ethers } from 'ethers';
import { CHAIN_CONFIGS, type ChainKey } from '../bridge/multi-chain-bridge-routes';

/**
 * EVM NFT Marketplace Broker Service
 * 
 * This service acts as an intermediary for NFT trades on EVM chains,
 * similar to the XRPL broker system but adapted for EVM marketplace contracts.
 * 
 * It supports:
 * - Creating buy/sell listings
 * - Matching offers with broker fee
 * - Escrow functionality
 * - Multi-chain support (Ethereum, BSC, Polygon, Arbitrum, etc.)
 */

// Simple marketplace contract ABI for broker operations
const MARKETPLACE_ABI = [
  'function createListing(address nftContract, uint256 tokenId, uint256 price) external',
  'function buyNFT(address nftContract, uint256 tokenId) external payable',
  'function cancelListing(address nftContract, uint256 tokenId) external',
  'function getListingPrice(address nftContract, uint256 tokenId) view returns (uint256)',
  'event ListingCreated(address indexed seller, address indexed nftContract, uint256 indexed tokenId, uint256 price)',
  'event NFTSold(address indexed buyer, address indexed seller, address indexed nftContract, uint256 tokenId, uint256 price)'
];

const ERC721_ABI = [
  'function approve(address to, uint256 tokenId) external',
  'function setApprovalForAll(address operator, bool approved) external',
  'function getApproved(uint256 tokenId) view returns (address)',
  'function isApprovedForAll(address owner, address operator) view returns (bool)'
];

export interface EVMBrokerConfig {
  privateKey: string;
  chainKey: ChainKey;
  marketplaceAddress?: string; // Optional custom marketplace contract
}

export interface NFTListing {
  seller: string;
  nftContract: string;
  tokenId: string;
  price: string; // in native currency (ETH, BNB, MATIC, etc.)
  timestamp: number;
}

export const EVM_BROKER_FEE_CONFIG = {
  feePercentage: 1.589, // Same as XRPL broker
  minimumFeeETH: 0.001, // Minimum fee in native currency
  
  calculateBrokerFee(salePrice: number): number {
    const feeFromPercentage = salePrice * (this.feePercentage / 100);
    return Math.max(feeFromPercentage, this.minimumFeeETH);
  },
  
  getFeeBreakdown(salePrice: number): {
    salePrice: number;
    brokerFee: number;
    royaltyEstimate: string;
    sellerReceives: string;
  } {
    const brokerFee = this.calculateBrokerFee(salePrice);
    
    return {
      salePrice,
      brokerFee,
      royaltyEstimate: '0-10% of sale price (EIP-2981)',
      sellerReceives: `${(salePrice - brokerFee).toFixed(6)} (minus royalty)`
    };
  }
};

export class EVMBrokerService {
  private wallet: ethers.Wallet;
  private provider: ethers.JsonRpcProvider;
  private chainKey: ChainKey;
  private chainConfig: any;
  private marketplaceAddress: string | null = null;

  constructor(config: EVMBrokerConfig) {
    this.chainKey = config.chainKey;
    this.chainConfig = CHAIN_CONFIGS[this.chainKey];
    
    if (!('chainId' in this.chainConfig)) {
      throw new Error(`${this.chainKey} is not an EVM chain`);
    }

    this.provider = new ethers.JsonRpcProvider(this.chainConfig.rpcUrl);
    this.wallet = new ethers.Wallet(config.privateKey, this.provider);
    this.marketplaceAddress = config.marketplaceAddress || null;
    
    console.log(`🏦 EVM Broker Service initialized for ${this.chainConfig.name}`);
    console.log(`📍 Broker Address: ${this.wallet.address}`);
  }

  getAddress(): string {
    return this.wallet.address;
  }

  getChain(): string {
    return this.chainConfig.name;
  }

  async getBalance(): Promise<{ native: string; formatted: string }> {
    try {
      const balance = await this.provider.getBalance(this.wallet.address);
      return {
        native: balance.toString(),
        formatted: ethers.formatEther(balance)
      };
    } catch (error) {
      console.error(`❌ Failed to fetch broker balance on ${this.chainKey}:`, error);
      throw error;
    }
  }

  /**
   * P2P NFT Transfer with Broker Fee (No marketplace contract needed)
   * This implements a simple broker-facilitated transfer
   */
  async facilitateP2PTransfer(
    sellerWallet: ethers.Wallet,
    buyerAddress: string,
    nftContract: string,
    tokenId: string,
    priceETH: string
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      const priceWei = ethers.parseEther(priceETH);
      const brokerFee = EVM_BROKER_FEE_CONFIG.calculateBrokerFee(parseFloat(priceETH));
      const brokerFeeWei = ethers.parseEther(brokerFee.toString());

      console.log(`🤝 [EVM P2P] Facilitating NFT transfer on ${this.chainKey}:`);
      console.log(`   Seller: ${sellerWallet.address}`);
      console.log(`   Buyer: ${buyerAddress}`);
      console.log(`   NFT: ${nftContract} #${tokenId}`);
      console.log(`   Price: ${priceETH} ${this.chainConfig.symbol}`);
      console.log(`   Broker Fee: ${brokerFee} ${this.chainConfig.symbol}`);

      // Step 1: Verify buyer has sent payment to broker
      const brokerBalance = await this.provider.getBalance(this.wallet.address);
      if (brokerBalance < priceWei) {
        return {
          success: false,
          error: `Insufficient payment. Buyer must send ${priceETH} ${this.chainConfig.symbol} to broker first`
        };
      }

      // Step 2: NFT contract instance
      const nft = new ethers.Contract(nftContract, ERC721_ABI, sellerWallet);

      // Step 3: Check approval
      const approved = await nft.getApproved(tokenId);
      if (approved.toLowerCase() !== this.wallet.address.toLowerCase()) {
        // Seller needs to approve broker first
        const approveTx = await nft.approve(this.wallet.address, tokenId);
        await approveTx.wait();
        console.log(`✅ NFT approved for broker: ${approveTx.hash}`);
      }

      // Step 4: Transfer NFT from seller to buyer (broker facilitates)
      const nftAsBroker = new ethers.Contract(nftContract, ERC721_ABI, this.wallet);
      const transferTx = await nftAsBroker['safeTransferFrom(address,address,uint256)'](
        sellerWallet.address,
        buyerAddress,
        tokenId
      );
      const transferReceipt = await transferTx.wait();
      console.log(`✅ NFT transferred: ${transferReceipt.hash}`);

      // Step 5: Send payment to seller (minus broker fee)
      const sellerPayment = priceWei - brokerFeeWei;
      const paymentTx = await this.wallet.sendTransaction({
        to: sellerWallet.address,
        value: sellerPayment
      });
      const paymentReceipt = await paymentTx.wait();
      
      if (!paymentReceipt) {
        throw new Error('Payment transaction failed');
      }
      
      console.log(`💰 Payment sent to seller: ${paymentReceipt.hash}`);
      console.log(`💰 Broker fee collected: ${brokerFee} ${this.chainConfig.symbol}`);

      return {
        success: true,
        txHash: transferReceipt.hash
      };
    } catch (error) {
      console.error(`❌ [EVM P2P] Transfer failed on ${this.chainKey}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Create a listing (if marketplace contract is deployed)
   */
  async createListing(
    sellerWallet: ethers.Wallet,
    nftContract: string,
    tokenId: string,
    priceETH: string
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    if (!this.marketplaceAddress) {
      return {
        success: false,
        error: 'No marketplace contract deployed. Use P2P transfer instead.'
      };
    }

    try {
      const priceWei = ethers.parseEther(priceETH);
      
      // Approve marketplace contract
      const nft = new ethers.Contract(nftContract, ERC721_ABI, sellerWallet);
      const approveTx = await nft.setApprovalForAll(this.marketplaceAddress, true);
      await approveTx.wait();

      // Create listing
      const marketplace = new ethers.Contract(
        this.marketplaceAddress,
        MARKETPLACE_ABI,
        sellerWallet
      );
      
      const listingTx = await marketplace.createListing(nftContract, tokenId, priceWei);
      const receipt = await listingTx.wait();

      console.log(`✅ Listing created on ${this.chainKey}: ${receipt.hash}`);
      
      return {
        success: true,
        txHash: receipt.hash
      };
    } catch (error) {
      console.error(`❌ Failed to create listing on ${this.chainKey}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Buy NFT from marketplace (if marketplace contract is deployed)
   */
  async buyFromMarketplace(
    buyerWallet: ethers.Wallet,
    nftContract: string,
    tokenId: string
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    if (!this.marketplaceAddress) {
      return {
        success: false,
        error: 'No marketplace contract deployed. Use P2P transfer instead.'
      };
    }

    try {
      const marketplace = new ethers.Contract(
        this.marketplaceAddress,
        MARKETPLACE_ABI,
        buyerWallet
      );

      const price = await marketplace.getListingPrice(nftContract, tokenId);
      const brokerFee = EVM_BROKER_FEE_CONFIG.calculateBrokerFee(
        parseFloat(ethers.formatEther(price))
      );
      const total = price + ethers.parseEther(brokerFee.toString());

      const buyTx = await marketplace.buyNFT(nftContract, tokenId, { value: total });
      const receipt = await buyTx.wait();

      console.log(`✅ NFT purchased on ${this.chainKey}: ${receipt.hash}`);
      console.log(`💰 Broker fee collected: ${brokerFee} ${this.chainConfig.symbol}`);

      return {
        success: true,
        txHash: receipt.hash
      };
    } catch (error) {
      console.error(`❌ Failed to buy NFT on ${this.chainKey}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Broker instances for each EVM chain
const brokerInstances = new Map<ChainKey, EVMBrokerService>();

export function initializeEVMBrokerService(chainKey: ChainKey): EVMBrokerService {
  const brokerKey = process.env[`${chainKey.toUpperCase()}_BROKER_PRIVATE_KEY`] || 
                     process.env.EVM_BROKER_PRIVATE_KEY;

  if (!brokerKey) {
    throw new Error(`No broker private key found for ${chainKey}. Set ${chainKey.toUpperCase()}_BROKER_PRIVATE_KEY or EVM_BROKER_PRIVATE_KEY`);
  }

  if (!brokerInstances.has(chainKey)) {
    brokerInstances.set(chainKey, new EVMBrokerService({
      privateKey: brokerKey,
      chainKey
    }));
  }

  return brokerInstances.get(chainKey)!;
}

export function getEVMBrokerService(chainKey: ChainKey): EVMBrokerService {
  if (!brokerInstances.has(chainKey)) {
    return initializeEVMBrokerService(chainKey);
  }
  return brokerInstances.get(chainKey)!;
}
