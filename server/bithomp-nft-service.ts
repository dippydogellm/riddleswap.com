// Bithomp NFT Service - Live NFT data from Bithomp API
import { Router } from 'express';
import NFTCachingService from './nft-caching-service';

const router = Router();

const BITHOMP_API_BASE = 'https://bithomp.com/api/v2';

interface BithompNFT {
  nftoken_id: string;
  ledger: number;
  date: number;
  owner: string;
  uri?: string;
  minter?: string;
  taxon?: number;
  sequence?: number;
  metadata?: {
    name?: string;
    description?: string;
    image?: string;
    attributes?: any[];
  };
  issuer?: string;
  flags?: number;
  transfer_fee?: number;
}

interface BithompNFTOffer {
  index: string;
  owner: string;
  nftoken_id: string;
  amount?: string;
  destination?: string;
  expiration?: number;
  flags?: number;
  ledger: number;
  date: number;
}

// Get NFTs owned by wallet address
router.get('/wallet/:address/nfts', async (req, res) => {
  try {
    const { address } = req.params;
    const { limit = 50, marker } = req.query;
    
    if (!address || !address.startsWith('r')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid XRPL address'
      });
    }

    // Use caching service for NFT data
    const walletCacheKey = `wallet_nfts_${address}_${limit}_${marker || 'no_marker'}`;
    
    const cachedNFTs = await NFTCachingService.getCachedOrFetchNFTMetadata(walletCacheKey, async () => {
      // Try Bithomp API first, fallback to XRPL node
      let nfts: any[] = [];
      let apiSource = 'fallback';

      try {
        const url = `${BITHOMP_API_BASE}/nfts/${address}?limit=${limit}${marker ? `&marker=${marker}` : ''}`;
        
        const response = await fetch(url, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'RiddleSwap/1.0'
          }
        });

        if (response.ok) {
          const data = await response.json() as any;
          
          // Transform Bithomp NFT data to our format
          nfts = (data.nfts || []).map((nft: BithompNFT) => ({
            nft_id: nft.nftoken_id,
            owner: nft.owner,
            minter: nft.minter,
            uri: nft.uri,
            taxon: nft.taxon,
            sequence: nft.sequence,
            flags: nft.flags,
            transfer_fee: nft.transfer_fee,
            metadata: nft.metadata || {},
            ledger: nft.ledger,
            date: nft.date,
            // Derive collection info if available
            collection: nft.issuer ? {
              issuer: nft.issuer,
              taxon: nft.taxon
            } : null
          }));
          apiSource = 'bithomp';
          
          // Also cache individual NFT metadata
          for (const nft of nfts) {
            if (nft.nft_id && nft.metadata) {
              await NFTCachingService.getCachedOrFetchNFTMetadata(nft.nft_id, async () => nft.metadata);
            }
          }
          
          return { nfts, apiSource, cached: false };
        } else {
          console.log(`Bithomp API returned ${response.status}, using XRPL fallback`);
        }
      } catch (bithompError: any) {
        console.log('Bithomp API unavailable, using XRPL fallback:', bithompError?.message);
      }

      // Fallback to XRPL direct API if Bithomp failed
      if (nfts.length === 0) {
      try {
        const { Client } = await import('xrpl');
        const client = new Client('wss://s1.ripple.com');
        await client.connect();

        try {
          const nftResponse = await client.request({
            command: 'account_nfts',
            account: address,
            limit: Math.min(parseInt(limit as string) || 50, 50)
          });

          // Process NFTs with CDN metadata only - NO IPFS
          const nftPromises = (nftResponse.result.account_nfts || []).map(async (nft: any) => {
            let metadata = {};
            let name = `NFT #${nft.Sequence || 'Unknown'}`;
            let image = null;
            let description = null;

            // Try to parse URI metadata if available - CDN ONLY
            if (nft.URI) {
              try {
                const uriData = Buffer.from(nft.URI, 'hex').toString('utf8');
                console.log(`NFT ${nft.NFTokenID} URI: ${uriData}`);
                
                // Skip IPFS URLs completely - only use CDN sources
                if (uriData.startsWith('ipfs://')) {
                  console.log(`⚠️ Skipping IPFS URL for ${nft.NFTokenID} - CDN only policy`);
                  // Use proxy image service instead
                  image = `/api/nft/image/${nft.NFTokenID}`;
                } else {
                  // Try parsing as JSON for non-IPFS URIs
                  try {
                    const parsedUri = JSON.parse(uriData);
                    metadata = parsedUri;
                    name = parsedUri.name || name;
                    description = parsedUri.description || null;
                    // Only use direct CDN URLs, no IPFS conversion
                    if (parsedUri.image && !parsedUri.image.startsWith('ipfs://')) {
                      image = parsedUri.image;
                    } else {
                      image = `/api/nft/image/${nft.NFTokenID}`;
                    }
                  } catch (e) {
                    // URI is not JSON, treat as string (CDN URLs only)
                    if (uriData.includes('cdn.bithomp.com')) {
                      image = uriData;
                    } else {
                      image = `/api/nft/image/${nft.NFTokenID}`;
                    }
                  }
                }
              } catch (e: any) {
                console.log(`Failed to process URI for ${nft.NFTokenID}:`, e?.message);
              }
            }

            return {
              nft_id: nft.NFTokenID,
              owner: address,
              minter: nft.Minter || null,
              uri: nft.URI ? Buffer.from(nft.URI, 'hex').toString('utf8') : null,
              taxon: nft.Taxon || null,
              sequence: nft.Sequence || null,
              flags: nft.Flags || 0,
              transfer_fee: nft.TransferFee || 0,
              metadata: {
                name,
                description,
                image,
                ...metadata
              },
              ledger: null,
              date: null,
              collection: null
            };
          });
          
          // Wait for all CDN metadata to be processed
          nfts = await Promise.all(nftPromises);
          apiSource = 'xrpl-direct';
        } finally {
          await client.disconnect();
        }
      } catch (xrplError) {
        console.error('XRPL fallback also failed:', xrplError);
      }
      }

      return { nfts, apiSource, cached: false };
    });

    // Extract NFTs from cached or fresh data
    const nfts = cachedNFTs?.nfts || [];
    const apiSource = cachedNFTs?.apiSource || 'cache';

    res.json({
      success: true,
      data: {
        nfts: nfts,
        count: nfts.length,
        marker: null, // XRPL direct doesn't use markers
        hasMore: false,
        source: cachedNFTs?.cached ? 'cache' : apiSource,
        cached: cachedNFTs?.cached || false,
        cachedAt: cachedNFTs?.cachedAt || null
      }
    });

  } catch (error) {
    console.error('Error fetching NFTs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch NFTs'
    });
  }
});

// Get NFT offers for wallet address
router.get('/wallet/:address/offers', async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!address || !address.startsWith('r')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid XRPL address'
      });
    }

    // Get sell offers (offers to buy NFTs owned by this wallet)
    const sellOffersUrl = `${BITHOMP_API_BASE}/nft-sell-offers/${address}`;
    const sellOffersResponse = await fetch(sellOffersUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'RiddleSwap/1.0'
      }
    });

    // Get buy offers (offers made by this wallet to buy NFTs)
    const buyOffersUrl = `${BITHOMP_API_BASE}/nft-buy-offers/${address}`;
    const buyOffersResponse = await fetch(buyOffersUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'RiddleSwap/1.0'
      }
    });

    const sellOffers = sellOffersResponse.ok ? await sellOffersResponse.json() : { offers: [] };
    const buyOffers = buyOffersResponse.ok ? await buyOffersResponse.json() : { offers: [] };

    // Transform offers data
    const incomingOffers = (sellOffers.offers || []).map((offer: BithompNFTOffer) => ({
      id: offer.index,
      nft_id: offer.nftoken_id,
      offer_type: 'sell_offer',
      amount: offer.amount || '0',
      currency: 'XRP',
      from_address: offer.owner,
      offer_index: offer.index,
      destination: offer.destination,
      expiration: offer.expiration ? new Date(offer.expiration * 1000) : null,
      ledger: offer.ledger,
      date: offer.date
    }));

    const outgoingOffers = (buyOffers.offers || []).map((offer: BithompNFTOffer) => ({
      id: offer.index,
      nft_id: offer.nftoken_id,
      offer_type: 'buy_offer',
      amount: offer.amount || '0',
      currency: 'XRP',
      from_address: offer.owner,
      offer_index: offer.index,
      destination: offer.destination,
      expiration: offer.expiration ? new Date(offer.expiration * 1000) : null,
      ledger: offer.ledger,
      date: offer.date
    }));

    res.json({
      success: true,
      data: {
        incomingOffers, // Others want to buy our NFTs
        outgoingOffers, // We want to buy others' NFTs
        totalOffers: incomingOffers.length + outgoingOffers.length
      }
    });

  } catch (error) {
    console.error('Error fetching NFT offers from Bithomp:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch NFT offers'
    });
  }
});

// Get detailed NFT information
router.get('/nft/:nftId', async (req, res) => {
  try {
    const { nftId } = req.params;
    
    if (!nftId) {
      return res.status(400).json({
        success: false,
        error: 'NFT ID is required'
      });
    }

    const url = `${BITHOMP_API_BASE}/nft/${nftId}`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'RiddleSwap/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`Bithomp API error: ${response.status}`);
    }

    const nft = await response.json() as any;
    
    res.json({
      success: true,
      data: {
        nft_id: nft.nftoken_id,
        owner: nft.owner,
        minter: nft.minter,
        uri: nft.uri,
        metadata: nft.metadata || {},
        taxon: nft.taxon,
        sequence: nft.sequence,
        flags: nft.flags,
        transfer_fee: nft.transfer_fee,
        ledger: nft.ledger,
        date: nft.date,
        history: nft.history || []
      }
    });

  } catch (error) {
    console.error('Error fetching NFT details from Bithomp:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch NFT details'
    });
  }
});

// Get NFT collection information
router.get('/collection/:issuer/:taxon?', async (req, res) => {
  try {
    const { issuer, taxon } = req.params;
    const { limit = 50, marker } = req.query;
    
    if (!issuer || !issuer.startsWith('r')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid issuer address'
      });
    }

    const url = `${BITHOMP_API_BASE}/nfts/issuer/${issuer}${taxon ? `/${taxon}` : ''}?limit=${limit}${marker ? `&marker=${marker}` : ''}`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'RiddleSwap/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`Bithomp API error: ${response.status}`);
    }

    const data = await response.json() as any;
    
    res.json({
      success: true,
      data: {
        issuer,
        taxon: taxon ? parseInt(taxon) : null,
        nfts: data.nfts || [],
        count: (data.nfts || []).length,
        marker: data.marker,
        hasMore: !!data.marker
      }
    });

  } catch (error) {
    console.error('Error fetching collection from Bithomp:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch collection'
    });
  }
});

export default router;