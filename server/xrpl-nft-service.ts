import { Client, Wallet, xrpToDrops } from 'xrpl';
import { nanoid } from 'nanoid';
import fs from 'fs';
import path from 'path';

// Bithomp API configuration
const BITHOMP_API_KEY = process.env.BITHOMP_API_KEY;
const BITHOMP_BASE_URL = 'https://bithomp.com/api/v2';

// XRPL NFT Service for fetching real NFT data
export class XRPLNFTService {
  private client: Client;
  private connected: boolean = false;

  constructor() {
    this.client = new Client('wss://xrplcluster.com');
  }

  async connect() {
    if (!this.connected) {
      await this.client.connect();
      this.connected = true;
    }
  }

  async disconnect() {
    if (this.connected) {
      await this.client.disconnect();
      this.connected = false;
    }
  }

  // Fetch all NFTs owned by an address
  async getNFTsByOwner(address: string) {
    try {
      await this.connect();
      
      const response = await this.client.request({
        command: 'account_nfts',
        account: address,
        limit: 400
      });

      return response.result.account_nfts || [];
    } catch (error) {

      return [];
    }
  }

  // Fetch NFT sell offers
  async getNFTSellOffers(nftokenId: string) {
    try {
      await this.connect();
      
      const response = await this.client.request({
        command: 'nft_sell_offers',
        nft_id: nftokenId,
        limit: 200
      });

      return response.result.offers || [];
    } catch (error) {

      return [];
    }
  }

  // Fetch NFT buy offers
  async getNFTBuyOffers(nftokenId: string) {
    try {
      await this.connect();
      
      const response = await this.client.request({
        command: 'nft_buy_offers',
        nft_id: nftokenId,
        limit: 200
      });

      return response.result.offers || [];
    } catch (error) {

      return [];
    }
  }

  // Get NFT collections (by issuer)
  async getNFTCollections() {
    try {
      await this.connect();
      
      // Get known NFT issuers from XRPL
      const knownIssuers = [
        'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH', // Xpunks
        'rKLpTyWxmEKG4pMg9NyvFZsWQmED3ePMxu', // xSPECTAR
        'rJcEbVWJ7xFjL8J9LsbxBMVSRY2C7DU7rz', // XRP Cafe
        'rU6K7V3Po4snVhBBaU29sesqs2qTQJWDw1', // Bored Apes XRP
        'r3D4Ur5JNGXwF71NndZqsu4Cg5SPXECx6o', // Zerpmon
        'rfx3YBWcfdnNcJStVg8W3yzBpDUGkcvtNV', // XPelago
        'rGjLQjWZ1vRPzdqPXQM4jksdKQE8oRNd8T', // XRPL Punks
        'rDN4Ux1WFJJsPCdqdfZgrDZ2MxrweXAft5'  // XRP Kongz
      ];

      const collections = [];
      
      for (const issuer of knownIssuers) {
        try {
          const nfts = await this.client.request({
            command: 'account_nfts',
            account: issuer,
            limit: 10
          });

          if (nfts.result.account_nfts && nfts.result.account_nfts.length > 0) {
            // Get collection metadata from the first NFT
            const firstNFT = nfts.result.account_nfts[0];
            const uri = firstNFT.URI ? Buffer.from(firstNFT.URI as string, 'hex').toString('utf8') : '';
            
            collections.push({
              id: nanoid(),
              issuer,
              name: this.getIssuerName(issuer),
              description: `NFT collection from ${this.getIssuerName(issuer)}`,
              floorPrice: await this.getCollectionFloorPrice(issuer),
              totalNFTs: nfts.result.account_nfts.length,
              imageUrl: this.extractImageUrl(uri),
              verified: true
            });
          }
        } catch (error) {

        }
      }

      return collections;
    } catch (error) {

      return [];
    }
  }

  // Get marketplace NFTs (all NFTs with active sell offers)
  async getMarketplaceNFTs() {
    try {
      // Use Bithomp API for real marketplace data if API key is available
      if (BITHOMP_API_KEY) {
        const response = await fetch(`${BITHOMP_BASE_URL}/nft-offers?type=sell&limit=50`, {
          headers: {
            'x-bithomp-token': BITHOMP_API_KEY,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json() as any;
          
          // Transform Bithomp data to our marketplace format
          const listings = (data.offers || []).map((offer: any) => ({
            id: offer.offerId || offer.nftokenID,
            name: offer.name || `NFT #${(offer.nftokenID || '').slice(-6)}`,
            price: parseFloat(offer.amount || '0') / 1000000, // Convert drops to XRP
            seller: offer.owner || offer.seller,
            imageUrl: offer.uri || offer.image || this.generateNFTImage(offer.nftokenID || ''),
            offerId: offer.offerId
          }));

          return listings;
        }
      }

      // Fallback to XRPL direct queries if no Bithomp API
      await this.connect();
      
      // Get recent NFT transactions
      const response = await this.client.request({
        command: 'ledger',
        ledger_index: 'validated',
        transactions: true,
        expand: true
      });

      const nftTransactions = response.result.ledger.transactions
        ?.filter((tx: any) => 
          tx.TransactionType === 'NFTokenCreateOffer' || 
          tx.TransactionType === 'NFTokenAcceptOffer'
        ) || [];

      const marketplaceNFTs = [];
      
      // Process recent NFT offers
      for (const tx of nftTransactions.slice(0, 20)) {
        if (tx.TransactionType === 'NFTokenCreateOffer' && tx.Flags === 1) {
          // This is a sell offer
          const nftokenId = tx.NFTokenID;
          const uri = tx.URI ? Buffer.from(tx.URI as string, 'hex').toString('utf8') : '';
          
          marketplaceNFTs.push({
            id: nftokenId,
            name: `NFT #${nftokenId.slice(-6)}`,
            price: tx.Amount ? (parseInt(typeof tx.Amount === 'string' ? tx.Amount : '0') / 1000000).toString() : '0',
            seller: tx.Account,
            imageUrl: this.extractImageUrl(uri),
            offerId: tx.hash
          });
        }
      }

      return marketplaceNFTs;
    } catch (error) {

      return [];
    }
  }

  // Get collection floor price
  private async getCollectionFloorPrice(issuer: string): Promise<string> {
    try {
      const nfts = await this.client.request({
        command: 'account_nfts',
        account: issuer,
        limit: 50
      });

      let lowestPrice = Infinity;
      
      for (const nft of nfts.result.account_nfts || []) {
        const offers = await this.getNFTSellOffers(nft.NFTokenID);
        for (const offer of offers) {
          const price = parseInt(typeof offer.amount === 'string' ? offer.amount : '0') / 1000000;
          if (price < lowestPrice) {
            lowestPrice = price;
          }
        }
      }

      return lowestPrice === Infinity ? '0' : lowestPrice.toString();
    } catch (error) {
      return '0';
    }
  }

  // Extract image URL from NFT URI
  private extractImageUrl(uri: string): string {
    try {
      if (uri.startsWith('ipfs://')) {
        // NO IPFS - use proxy instead
        return `/api/nft/image/proxy`;
      } else if (uri.startsWith('http')) {
        return uri;
      } else if (uri) {
        // Try to parse as JSON
        const data = JSON.parse(uri);
        if (data.image) {
          // Use ONLY Bithomp API for images - NO IPFS parsing
          return `https://bithomp.com/api/v2/nft/image`;
        }
      }
    } catch (error) {
      // Fallback to placeholder
    }
    return '/api/placeholder/400/400';
  }



  // Get trending NFT collections (last 24h) - Use Bithomp API if available
  async getTrendingCollections() {
    try {
      // Use Bithomp API for real NFT volume data if API key is available
      if (BITHOMP_API_KEY) {
        const response = await fetch(`${BITHOMP_BASE_URL}/nft-volumes?period=day&list=collections&limit=20`, {
          headers: {
            'x-bithomp-token': BITHOMP_API_KEY,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json() as any;
          
          // Transform Bithomp data to our format
          const collections = (data.volumes || []).map((vol: any) => ({
            issuer: vol.issuer,
            name: vol.name || this.getIssuerName(vol.issuer),
            volume24h: parseFloat(vol.volume || '0'),
            sales24h: parseInt(vol.sales || '0'),
            floorPrice: parseFloat(vol.floorPrice || '0'),
            uniqueBuyers: parseInt(vol.buyers || '0'),
            image: vol.image || this.generateCollectionImage(vol.issuer),
            changePercent: parseFloat(vol.change || '0')
          }));

          return { collections };
        }
      }

      // Fallback to XRPL direct queries if no Bithomp API
      await this.connect();
      
      // Get recent NFT transactions from the last 24 hours
      const response = await this.client.request({
        command: 'account_tx',
        account: 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH', // Using a known issuer
        ledger_index_min: -1,
        ledger_index_max: -1,
        limit: 200
      });

      // Process and aggregate by collection
      const collectionStats = new Map();
      
      const transactions = response.result.transactions || [];
      
      for (const tx of transactions) {
        const transaction = tx.tx as any;
        if (transaction && transaction.TransactionType === 'NFTokenAcceptOffer') {
          const issuer = transaction.Account;
          const amount = transaction.Amount ? parseInt(typeof transaction.Amount === 'string' ? transaction.Amount : '0') / 1000000 : 0;
          
          if (!collectionStats.has(issuer)) {
            collectionStats.set(issuer, {
              volume: 0,
              sales: 0,
              name: this.getIssuerName(issuer)
            });
          }
          
          const stats = collectionStats.get(issuer);
          stats.volume += amount;
          stats.sales += 1;
        }
      }

      // Convert to array and sort by volume
      const trending = Array.from(collectionStats.entries())
        .map(([issuer, stats]) => ({
          id: nanoid(),
          issuer,
          name: stats.name,
          volume24h: stats.volume.toFixed(2),
          sales24h: stats.sales,
          change24h: 0 // No fake data - would need real historical data
        }))
        .sort((a, b) => parseFloat(b.volume24h) - parseFloat(a.volume24h))
        .slice(0, 10);

      return trending;
    } catch (error) {

      return [];
    }
  }

  // Get issuer name from mapping
  private getIssuerName(issuer: string | undefined): string {
    if (!issuer || typeof issuer !== 'string') return 'Unknown Collection';
    
    const issuerNames: Record<string, string> = {
      'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH': 'Xpunks',
      'rKLpTyWxmEKG4pMg9NyvFZsWQmED3ePMxu': 'xSPECTAR',
      'rJcEbVWJ7xFjL8J9LsbxBMVSRY2C7DU7rz': 'XRP Cafe',
      'rU6K7V3Po4snVhBBaU29sesqs2qTQJWDw1': 'Bored Apes XRP',
      'r3D4Ur5JNGXwF71NndZqsu4Cg5SPXECx6o': 'Zerpmon',
      'rfx3YBWcfdnNcJStVg8W3yzBpDUGkcvtNV': 'XPelago',
      'rGjLQjWZ1vRPzdqPXQM4jksdKQE8oRNd8T': 'XRPL Punks',
      'rDN4Ux1WFJJsPCdqdfZgrDZ2MxrweXAft5': 'XRP Kongz'
    };
    return issuerNames[issuer] || `Collection ${issuer.substring(0, 8)}`;
  }

  // Generate collection image placeholder
  private generateCollectionImage(issuer: string | undefined): string {
    if (!issuer || typeof issuer !== 'string') {
      return '/api/placeholder/400/400?text=Collection&bg=A8E6CF';
    }
    const colors = ['FF6B6B', '4ECDC4', 'FFE66D', 'A8E6CF', 'FF8B94'];
    const color = colors[parseInt(issuer.substring(0, 2), 16) % colors.length];
    return `/api/placeholder/400/400?text=Collection&bg=${color}`;
  }

  // Generate NFT image placeholder
  private generateNFTImage(nftId: string): string {
    const colors = ['FF6B6B', '4ECDC4', 'FFE66D', 'A8E6CF', 'FF8B94'];
    const color = colors[parseInt(nftId.substring(0, 2), 16) % colors.length];
    return `/api/placeholder/400/400?text=NFT&bg=${color}`;
  }

  // ====== NEW MINTING FUNCTIONALITY ======

  // Helper function to create compact, valid XRPL URIs
  private createCompactURI(collection: string, tokenId: string): string {
    // Use shorter domain and path for XRPL compatibility
    return `https://rdl.app/nft/${collection}/${tokenId}`;
  }

  // Helper function to validate and encode URI for XRPL
  private encodeXRPLURI(uri: string): { encodedURI: string; isValid: boolean; length: number } {
    // Convert URI to hex
    const uriHex = Buffer.from(uri, 'utf8').toString('hex').toUpperCase();
    const hexLength = uriHex.length;
    
    // XRPL NFTokenMint URI field has a maximum of 256 bytes (512 hex characters)
    const isValid = hexLength <= 512;
    
    console.log(`🔍 [URI-VALIDATION] Original: "${uri}" (${uri.length} chars)`);
    console.log(`🔍 [URI-VALIDATION] Hex encoded: ${hexLength} bytes (limit: 512 hex chars)`);
    console.log(`🔍 [URI-VALIDATION] Valid: ${isValid}`);
    
    return {
      encodedURI: uriHex,
      isValid,
      length: hexLength
    };
  }

  // Mint NFToken on XRPL
  async mintNFToken(options: {
    minterWallet: Wallet;
    uri: string; // Metadata URI
    transferFee?: number; // Transfer fee in basis points (0-50000, meaning 0-50%)
    taxon?: number; // Collection taxon
    flags?: number; // NFToken flags
  }): Promise<{ success: boolean; tokenId?: string; hash?: string; error?: string }> {
    try {
      await this.connect();

      const { minterWallet, uri, transferFee = 0, taxon = 0, flags = 8 } = options; // Flag 8 = Transferable
      
      console.log(`🪙 Minting NFToken with URI: ${uri}`);

      // Validate and encode URI
      const uriValidation = this.encodeXRPLURI(uri);
      
      if (!uriValidation.isValid) {
        throw new Error(`URI too long for XRPL: ${uriValidation.length} bytes (max: 512 hex chars). Consider using a shorter domain or path.`);
      }

      const uriHex = uriValidation.encodedURI;
      
      // Prepare NFTokenMint transaction
      const mintTx = {
        TransactionType: 'NFTokenMint',
        Account: minterWallet.address,
        URI: uriHex,
        Flags: flags,
        TransferFee: transferFee,
        NFTokenTaxon: taxon
      };

      // Submit and wait for validation
      const response = await this.client.submitAndWait(mintTx as any, { wallet: minterWallet });
      
      if (response.result.meta && typeof response.result.meta === 'object' && 'AffectedNodes' in response.result.meta) {
        // Extract NFTokenID from transaction metadata
        const affectedNodes = response.result.meta.AffectedNodes as any[];
        const createdNode = affectedNodes.find(node => node.CreatedNode?.LedgerEntryType === 'NFToken');
        
        if (createdNode) {
          const tokenId = createdNode.CreatedNode.NewFields?.NFTokenID;
          
          console.log(`✅ NFToken minted successfully: ${tokenId}`);
          return {
            success: true,
            tokenId,
            hash: response.result.hash
          };
        }
      }

      throw new Error('Failed to extract NFTokenID from transaction result');

    } catch (error) {
      console.error('❌ NFT minting failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown minting error'
      };
    }
  }

  // Create NFT offer for sale
  async createSellOffer(options: {
    sellerWallet: Wallet;
    tokenId: string;
    amount: string; // In XRP drops
    destination?: string; // Optional buyer address
  }): Promise<{ success: boolean; offerId?: string; hash?: string; error?: string }> {
    try {
      await this.connect();

      const { sellerWallet, tokenId, amount, destination } = options;

      console.log(`💰 Creating sell offer for token ${tokenId} at ${amount} drops`);

      const sellOfferTx: any = {
        TransactionType: 'NFTokenCreateOffer',
        Account: sellerWallet.address,
        NFTokenID: tokenId,
        Amount: amount,
        Flags: 1 // Sell offer flag
      };

      if (destination) {
        sellOfferTx.Destination = destination;
      }

      const response = await this.client.submitAndWait(sellOfferTx, { wallet: sellerWallet });

      if (response.result.meta && typeof response.result.meta === 'object' && 'AffectedNodes' in response.result.meta) {
        const affectedNodes = response.result.meta.AffectedNodes as any[];
        const createdNode = affectedNodes.find(node => node.CreatedNode?.LedgerEntryType === 'NFTokenOffer');
        
        if (createdNode) {
          const offerId = createdNode.CreatedNode.LedgerIndex;
          
          console.log(`✅ Sell offer created: ${offerId}`);
          return {
            success: true,
            offerId,
            hash: response.result.hash
          };
        }
      }

      throw new Error('Failed to extract offer ID from transaction result');

    } catch (error) {
      console.error('❌ Sell offer creation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown offer creation error'
      };
    }
  }

  // Get wallet from seed (for server-side minting)
  getWalletFromSeed(seed: string): Wallet {
    return Wallet.fromSeed(seed);
  }

  // Create minter wallet for land plots (should be securely stored)
  createMinterWallet(): { wallet: Wallet; seed: string; address: string } {
    const wallet = Wallet.generate();
    return {
      wallet,
      seed: wallet.seed!,
      address: wallet.address
    };
  }
}

// Export singleton instance
export const xrplNFTService = new XRPLNFTService();

// Helper functions for land plot NFT minting
export interface LandPlotMintRequest {
  plotId: number;
  buyerAddress: string;
  paymentAmount: string; // In XRP drops
  imageGenerated: boolean;
}

// Mint land plot NFT after purchase
export async function mintLandPlotNFT(request: LandPlotMintRequest): Promise<{ success: boolean; tokenId?: string; offerId?: string; error?: string }> {
  const nftService = new XRPLNFTService();
  
  try {
    // Load minter wallet (should be stored securely in production)
    const minterSeed = process.env.XRPL_MINTER_SEED || '';
    if (!minterSeed) {
      throw new Error('XRPL minter seed not configured');
    }
    
    const minterWallet = nftService.getWalletFromSeed(minterSeed);
    
    // Metadata URI pointing to the generated JSON
    const metadataUri = `https://riddleswap.replit.app/nft-metadata/land-plots/${request.plotId}.json`;
    
    // Mint the NFT
    const mintResult = await nftService.mintNFToken({
      minterWallet,
      uri: metadataUri,
      transferFee: 500, // 5% transfer fee for royalties
      taxon: 1 // Land plots collection taxon
    });

    if (!mintResult.success || !mintResult.tokenId) {
      throw new Error(mintResult.error || 'Failed to mint NFT');
    }

    // Create sell offer immediately for the buyer
    const offerResult = await nftService.createSellOffer({
      sellerWallet: minterWallet,
      tokenId: mintResult.tokenId,
      amount: request.paymentAmount,
      destination: request.buyerAddress
    });

    await nftService.disconnect();

    if (!offerResult.success) {
      console.warn(`⚠️ NFT minted but sell offer failed: ${offerResult.error}`);
    }

    return {
      success: true,
      tokenId: mintResult.tokenId,
      offerId: offerResult.offerId
    };

  } catch (error) {
    await nftService.disconnect();
    console.error('❌ Land plot NFT minting failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown minting error'
    };
  }
}

// Generic NFT minting for other projects (1 XRP fee)
export async function mintGenericNFT(options: {
  projectName: string;
  metadata: any;
  imageUrl?: string;
  buyerAddress: string;
}): Promise<{ success: boolean; tokenId?: string; cost: number; error?: string }> {
  const nftService = new XRPLNFTService();
  const costInXRP = 1; // 1 XRP fee for generic NFT generation
  
  try {
    const minterSeed = process.env.XRPL_MINTER_SEED || '';
    if (!minterSeed) {
      throw new Error('XRPL minter seed not configured');
    }
    
    const minterWallet = nftService.getWalletFromSeed(minterSeed);
    
    // Create metadata file for generic project
    const metadataFileName = `${options.projectName}_${Date.now()}.json`;
    const metadataDir = path.join(process.cwd(), 'public', 'nft-metadata', 'generic');
    
    if (!fs.existsSync(metadataDir)) {
      fs.mkdirSync(metadataDir, { recursive: true });
    }
    
    const metadataPath = path.join(metadataDir, metadataFileName);
    fs.writeFileSync(metadataPath, JSON.stringify(options.metadata, null, 2));
    
    const metadataUri = `https://riddleswap.replit.app/nft-metadata/generic/${metadataFileName}`;
    
    // Mint the NFT
    const mintResult = await nftService.mintNFToken({
      minterWallet,
      uri: metadataUri,
      transferFee: 1000, // 10% transfer fee for generic projects
      taxon: 2 // Generic projects taxon
    });

    await nftService.disconnect();

    return {
      success: mintResult.success,
      tokenId: mintResult.tokenId,
      cost: costInXRP,
      error: mintResult.error
    };

  } catch (error) {
    await nftService.disconnect();
    return {
      success: false,
      cost: costInXRP,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Export helper functions for route handlers
export async function fetchLiveNFTs(address: string) {
  try {
    const service = new XRPLNFTService();
    const nfts = await service.getNFTsByOwner(address);
    return nfts || [];
  } catch (error) {
    console.error('Error fetching live NFTs:', error);
    return [];
  }
}