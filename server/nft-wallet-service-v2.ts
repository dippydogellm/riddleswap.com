import { Client, NFTBuyOffersRequest, NFTSellOffersRequest } from 'xrpl';
import fetch from 'node-fetch';

// Environment variables for API keys
const BITHOMP_API_KEY = process.env.BITHOMP_API_KEY || '';
const BITHOMP_BASE_URL = 'https://bithomp.com/api/v2';
const BITHOMP_CDN_URL = 'https://cdn.bithomp.com/image';
const XRPL_WS_URL = process.env.XRPL_WS_URL || 'wss://xrplcluster.com';

// NFT Bank wallet placeholders
const NFT_BANK_WALLET = process.env.NFT_BANK_WALLET || 'rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
const NFT_BANK_SECRET = process.env.NFT_BANK_SECRET || 'sXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

export class NFTWalletService {
  private client: Client;

  constructor() {
    this.client = new Client(XRPL_WS_URL);
  }

  // Connect to XRPL
  async connect() {
    if (!this.client.isConnected()) {
      await this.client.connect();
    }
  }

  // Parse NFT metadata and get Bithomp CDN image
  private async parseNFTMetadata(nft: any) {
    let name = `NFT #${nft.NFTokenID.slice(-6)}`;
    let imageUrl = null;
    let traits: any[] = [];
    let metadata: any = null;

    // Use Bithomp API with assets=true for comprehensive data
    if (BITHOMP_API_KEY) {
      try {
        const bithompResponse = await fetch(`https://bithomp.com/api/v2/nft/${nft.NFTokenID}?assets=true`, {
          headers: {
            'x-bithomp-token': BITHOMP_API_KEY,
            'Content-Type': 'application/json'
          }
        });

        if (bithompResponse.ok) {
          const bithompData = await bithompResponse.json() as any;
          
          // Extract comprehensive data from Bithomp response
          name = bithompData.name || bithompData.metadata?.name || name;
          metadata = bithompData.metadata || null;
          traits = bithompData.attributes || bithompData.metadata?.attributes || [];
          
          // Use Bithomp image assets
          imageUrl = bithompData.assets?.image || 
                     bithompData.assets?.preview || 
                     bithompData.metadata?.image;
          
          console.log(`✅ Using Bithomp API data for ${nft.NFTokenID}: ${name}`);
          
          return {
            ...nft,
            name,
            description: bithompData.description || bithompData.metadata?.description || null,
            imageUrl,
            metadata,
            traits,
            collection: bithompData.collection || null,
            rarity: bithompData.rarity || null,
            floor_price: bithompData.floor_price || null,
            last_sale_price: bithompData.last_sale_price || null
          }
        }
      } catch (error) {
        console.error(`Bithomp API error for ${nft.NFTokenID}:`, error);
      }
    }

    // If no image from Bithomp, try to construct CDN URL from URI
    if (!imageUrl && nft.URI) {
      try {
        const uriString = Buffer.from(nft.URI, 'hex').toString('utf8');
        
        // Extract IPFS hash and use Bithomp CDN
        if (uriString.includes('ipfs://')) {
          const ipfsPath = uriString.replace('ipfs://', '').replace('.json', '');
          const baseHash = ipfsPath.split('/')[0];
          
          // Try to get image name from metadata
          let imageName = 'image.png';
          if (uriString.includes('/')) {
            const parts = uriString.split('/');
            const filename = parts[parts.length - 1].replace('.json', '');
            imageName = `${filename}.png`;
          }
          
          // Use Bithomp CDN with proper format
          imageUrl = `${BITHOMP_CDN_URL}/${baseHash}/${imageName}`;
          console.log(`📷 Constructed Bithomp CDN URL: ${imageUrl}`);
        }
      } catch (error) {
        console.error(`URI parsing error for ${nft.NFTokenID}:`, error);
      }
    }

    // Fallback return if Bithomp API fails
    return {
      ...nft,
      name,
      description: null,
      imageUrl,
      metadata,
      traits,
      collection: null,
      rarity: null,
      floor_price: null,
      last_sale_price: null
    };
  }

  // Search wallet NFTs using Bithomp API and XRPL
  async searchWalletNFTs(walletAddress: string) {
    try {
      await this.connect();
      
      // Get account NFTs from XRPL
      const accountNFTs = await this.client.request({
        command: 'account_nfts',
        account: walletAddress,
        ledger_index: 'validated'
      });

      // Process each NFT to get metadata and Bithomp CDN images
      const nftsWithMetadata = await Promise.all(
        (accountNFTs.result.account_nfts || []).map(async (nft: any) => {
          const { name, imageUrl, traits, metadata } = await this.parseNFTMetadata(nft);
          
          // Enhanced image URL with Bithomp CDN integration
          const enhancedImageUrl = imageUrl || `https://cdn.bithomp.com/nft/${nft.NFTokenID}.webp`;
          
          // Parse collection name from known issuers
          const collectionNames: Record<string, string> = {
            'raitaXppXqftnQt8Jd2dp6uxh6dKDENDpg': 'Riddle Raffle',
            'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH': 'XRPL Collection',
            'r4cQKkQ3bGLVoNSPicZ6mZFNJx4MybNKLQ': 'Bricky Collection'
          };
          
          // Parse clean NFT name from IPFS URI
          let parsedName = name;
          if (name && name.includes('ipfs://') && name.includes('.json')) {
            try {
              const uriParts = name.split('/');
              const jsonName = uriParts[uriParts.length - 1];
              parsedName = jsonName.replace('.json', '');
            } catch (e) {
              parsedName = name.slice(0, 30) + '...';
            }
          }
          
          return {
            token_id: nft.NFTokenID,
            nft_id: nft.NFTokenID,
            NFTokenID: nft.NFTokenID,
            issuer: nft.Issuer,
            Issuer: nft.Issuer,
            taxon: nft.NFTokenTaxon,
            NFTokenTaxon: nft.NFTokenTaxon,
            uri: nft.URI,
            URI: nft.URI,
            flags: nft.Flags,
            Flags: nft.Flags,
            transferFee: nft.TransferFee,
            TransferFee: nft.TransferFee,
            serial: nft.nft_serial,
            nft_serial: nft.nft_serial,
            metadata,
            name: parsedName || `NFT #${nft.nft_serial || 'Unknown'}`,
            description: metadata?.description || '',
            image: enhancedImageUrl,
            traits,
            collection: nft.Issuer,
            collectionName: collectionNames[nft.Issuer] || `Collection ${nft.Issuer.slice(0, 8)}...`
          };
        })
      );

      return {
        success: true,
        nfts: nftsWithMetadata,
        count: nftsWithMetadata.length,
        wallet: walletAddress
      };
    } catch (error: any) {
      console.error('Error fetching NFTs:', error);
      return {
        success: false,
        error: error.message,
        nfts: []
      };
    }
  }

  // Get NFT offers
  async getNFTOffers(nftId: string) {
    try {
      await this.connect();

      // Get buy offers
      const buyOffersRequest: NFTBuyOffersRequest = {
        command: 'nft_buy_offers',
        nft_id: nftId,
        ledger_index: 'validated'
      };
      
      const buyOffers = await this.client.request(buyOffersRequest);

      // Get sell offers
      const sellOffersRequest: NFTSellOffersRequest = {
        command: 'nft_sell_offers',
        nft_id: nftId,
        ledger_index: 'validated'
      };
      
      const sellOffers = await this.client.request(sellOffersRequest);

      return {
        nftId,
        buyOffers: buyOffers.result.offers || [],
        sellOffers: sellOffers.result.offers || []
      };
    } catch (error) {
      throw error;
    }
  }

  // Get recent NFT transactions for a wallet
  async getWalletNFTTransactions(walletAddress: string) {
    try {
      await this.connect();

      const transactions = await this.client.request({
        command: 'account_tx',
        account: walletAddress,
        ledger_index_min: -1,
        ledger_index_max: -1,
        limit: 50
      });

      // Filter for NFT-related transactions
      const nftTransactions = (transactions.result.transactions || [])
        .filter((tx: any) => {
          const txType = tx.tx?.TransactionType;
          return txType === 'NFTokenMint' || 
                 txType === 'NFTokenBurn' || 
                 txType === 'NFTokenCreateOffer' ||
                 txType === 'NFTokenCancelOffer' ||
                 txType === 'NFTokenAcceptOffer';
        })
        .map((tx: any) => ({
          type: tx.tx.TransactionType,
          hash: tx.tx.hash,
          account: tx.tx.Account,
          nftId: tx.tx.NFTokenID,
          amount: tx.tx.Amount,
          fee: tx.tx.Fee,
          date: tx.tx.date,
          result: tx.meta?.TransactionResult
        }));

      return {
        wallet: walletAddress,
        transactions: nftTransactions
      };
    } catch (error) {
      throw error;
    }
  }

  // Disconnect from XRPL
  async disconnect() {
    if (this.client.isConnected()) {
      await this.client.disconnect();
    }
  }
}

// Export singleton instance
export const nftWalletService = new NFTWalletService();

// Export helper function for route handlers
export async function fetchUserNFTs(address: string) {
  try {
    const service = new NFTWalletService();
    const result = await service.searchWalletNFTs(address);
    await service.disconnect();
    return result;
  } catch (error: any) {
    console.error('Error fetching user NFTs:', error);
    return {
      success: false,
      error: error.message,
      nfts: []
    };
  }
}