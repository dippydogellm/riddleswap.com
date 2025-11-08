import { Router } from 'express';
import { z } from 'zod';
import { storage } from './storage';
import type { UnifiedSearchResult } from '../shared/schema';

// Import direct search functions to avoid circular dependencies
import { searchDexScreener } from './xrpl-token-search-v2.js';

const router = Router();

// Multi-chain token search endpoint
router.get('/tokens', async (req, res) => {
  try {
    const { q: query, limit = 20, chain } = req.query;
    
    if (!query) {
      return res.status(400).json({ 
        error: 'Query parameter q is required'
      });
    }

    console.log(`🔍 [MULTI-CHAIN SEARCH] Token search for: "${query}" (chain: ${chain || 'all'})`);
    
    const searchLimit = Math.max(Number(limit), 100); // High limit for infinite scroll
    let allTokens: any[] = [];
    let searchPromises: Promise<any>[] = [];

    // Helper function to safely fetch from API
    const fetchTokens = async (url: string, chainName: string) => {
      try {
        console.log(`🔗 [${chainName}] Searching: ${url}`);
        const response = await fetch(url);
        if (!response.ok) {
          console.warn(`⚠️ [${chainName}] API error: ${response.status}`);
          return [];
        }
        const data = await response.json() as any;
        
        // Extract tokens from different API response formats
        let tokens = [];
        if (data.tokens) {
          tokens = data.tokens;
        } else if (Array.isArray(data)) {
          tokens = data;
        } else if (data.success && data.tokens) {
          tokens = data.tokens;
        } else {
          tokens = [];
        }
        
        // Add chain information and enhance token data
        return tokens.map((token: any) => ({
          ...token,
          chain: chainName.toLowerCase(),
          search_source: chainName,
          // Ensure we have a proper logo URL with fallback chain icons
          logo: token.logo || token.image || token.logoURI || `/images/chains/${chainName.toLowerCase()}.png`,
          // Standardize price information
          price_usd: token.price_usd || token.priceUsd || token.price || 0,
          // Add market cap if available
          market_cap: token.market_cap || token.fdv || token.marketCap,
          // Add volume information
          volume_24h: token.volume_24h || token.volume || 0
        }));
        
      } catch (error) {
        console.error(`❌ [${chainName}] Token search error:`, error);
        return [];
      }
    };

    // Normalize chain aliases to canonical names for DexScreener
    const chainAliasMap: Record<string, string> = {
      'eth': 'ethereum',
      'bnb': 'bsc',
      'avax': 'avalanche',
      'ftm': 'fantom',
      'matic': 'polygon',
      'arb': 'arbitrum',
      'op': 'optimism',
      'btc': 'bitcoin'
    };

    // Search specific chain if requested
    if (chain && typeof chain === 'string') {
      const chainLower = chain.toLowerCase();
      const normalizedChain = chainAliasMap[chainLower] || chainLower;
      
      if (normalizedChain === 'xrpl') {
        // Direct XRPL token search - no localhost HTTP calls
        try {
          console.log(`🔗 [XRPL] Direct search: ${query}`);
          const xrplResults = await searchDexScreener(query as string);
          allTokens = xrplResults.slice(0, Number(limit)).map((token: any) => ({
            ...token,
            chain: 'xrpl',
            search_source: 'XRPL',
            logo: token.icon_url
          }));
          console.log(`✅ [XRPL] Direct search found ${allTokens.length} tokens`);
        } catch (error) {
          console.error('❌ [XRPL] Direct search failed:', error);
          allTokens = [];
        }
      } else if (normalizedChain === 'solana') {
        // Solana search - use external API directly  
        try {
          console.log(`🔗 [Solana] Jupiter API search: ${query}`);
          const response = await fetch(`https://api.jup.ag/search?query=${encodeURIComponent(query as string)}`);
          if (response.ok) {
            const data = await response.json() as any;
            allTokens = (data.tokens || []).slice(0, Number(limit)).map((token: any) => ({
              ...token,
              chain: 'solana',
              search_source: 'Jupiter',
              logo: token.logoURI || token.logo || token.image || `/images/chains/solana.png`
            }));
            console.log(`✅ [Solana] Jupiter search found ${allTokens.length} tokens`);
          } else {
            allTokens = [];
          }
        } catch (error) {
          console.error('❌ [Solana] Jupiter search failed:', error);
          allTokens = [];
        }
      } else {
        // For all other chains (EVM and non-EVM), use DexScreener comprehensive search
        try {
          const response = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query as string)}`);
          if (response.ok) {
            const data = await response.json() as any;
            if (data.pairs && Array.isArray(data.pairs)) {
              // Filter pairs by requested chain (use normalized chain name)
              const chainPairs = data.pairs.filter((pair: any) => 
                pair.chainId?.toLowerCase() === normalizedChain || 
                pair.chainId?.toLowerCase() === normalizedChain.replace('-', '')
              );
              
              allTokens = chainPairs.slice(0, Number(limit)).map((pair: any) => ({
                symbol: pair.baseToken?.symbol || '',
                name: pair.baseToken?.name || '',
                address: pair.baseToken?.address || '',
                chain: normalizedChain,
                logo: pair?.info?.imageUrl || `/images/chains/${normalizedChain}.png`,
                price_usd: parseFloat(pair.priceUsd || '0'),
                volume_24h: parseFloat(pair.volume?.h24 || '0'),
                search_source: 'DexScreener'
              }));
            }
          }
        } catch (error) {
          console.error(`❌ [${normalizedChain.toUpperCase()}] DexScreener search failed:`, error);
          allTokens = [];
        }
      }
    } else {
      // Search all chains simultaneously - DexScreener for most chains + XRPL separately
      searchPromises = [
        // XRPL tokens - direct search (DexScreener doesn't index XRPL)
        (async () => {
          try {
            console.log(`🔗 [XRPL] All-chains search: ${query}`);
            const xrplResults = await searchDexScreener(query as string);
            return xrplResults.map((token: any) => ({
              symbol: token.currency || '',
              name: token.currency || '',
              address: token.issuer || '',
              chain: 'xrpl',
              logo: token.icon_url || '/images/chains/xrpl.png',
              price_usd: 0,
              volume_24h: 0,
              search_source: 'XRPL'
            }));
          } catch (error) {
            console.error('❌ [XRPL] All-chains search failed:', error);
            return [];
          }
        })(),
        // All DexScreener-supported chains (EVM, Solana, etc.)
        (async () => {
          try {
            console.log(`🔗 [DexScreener] All-chains comprehensive search: ${query}`);
            const response = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query as string)}`);
            if (response.ok) {
              const data = await response.json() as any;
              if (data.pairs && Array.isArray(data.pairs)) {
                const tokenMap = new Map();
                data.pairs.forEach((pair: any) => {
                  if (!pair.baseToken?.symbol) return;
                  const key = `${pair.baseToken.symbol}-${pair.chainId}`;
                  if (!tokenMap.has(key)) {
                    tokenMap.set(key, {
                      symbol: pair.baseToken.symbol,
                      name: pair.baseToken.name || pair.baseToken.symbol,
                      address: pair.baseToken.address || '',
                      chain: pair.chainId,
                      logo: pair?.info?.imageUrl || `/images/chains/${pair.chainId}.png`,
                      price_usd: parseFloat(pair.priceUsd || '0'),
                      volume_24h: parseFloat(pair.volume?.h24 || '0'),
                      search_source: 'DexScreener'
                    });
                  }
                });
                return Array.from(tokenMap.values());
              }
            }
            return [];
          } catch (error) {
            console.error('❌ [DexScreener] All-chains search failed:', error);
            return [];
          }
        })()
      ];

      try {
        const results = await Promise.allSettled(searchPromises);
        results.forEach((result) => {
          if (result.status === 'fulfilled' && Array.isArray(result.value)) {
            allTokens.push(...result.value);
          }
        });
        allTokens = allTokens.slice(0, searchLimit);
        console.log(`✅ [ALL CHAINS] Found ${allTokens.length} tokens across all 17 chains`);
      } catch (error) {
        console.error('❌ [ALL CHAINS] Search error:', error);
      }
    }

    // Remove duplicates and sort by relevance
    const uniqueTokens = allTokens.reduce((acc: any[], token: any) => {
      const key = `${token.symbol}-${token.issuer || token.address || token.mint}`;
      if (!acc.find(t => `${t.symbol}-${t.issuer || t.address || t.mint}` === key)) {
        acc.push(token);
      }
      return acc;
    }, []);

    // Sort by relevance (exact matches first, then partial matches)
    const queryLower = (query as string).toLowerCase();
    uniqueTokens.sort((a, b) => {
      const aSymbolExact = a.symbol?.toLowerCase() === queryLower ? 1 : 0;
      const bSymbolExact = b.symbol?.toLowerCase() === queryLower ? 1 : 0;
      if (aSymbolExact !== bSymbolExact) return bSymbolExact - aSymbolExact;
      
      const aNameExact = a.name?.toLowerCase().includes(queryLower) ? 1 : 0;
      const bNameExact = b.name?.toLowerCase().includes(queryLower) ? 1 : 0;
      if (aNameExact !== bNameExact) return bNameExact - aNameExact;
      
      // Prefer native tokens
      const aIsNative = !a.issuer && !a.address && !a.mint ? 1 : 0;
      const bIsNative = !b.issuer && !b.address && !b.mint ? 1 : 0;
      return bIsNative - aIsNative;
    });

    // Limit final results
    const finalTokens = uniqueTokens.slice(0, Number(limit));
    
    console.log(`✅ [MULTI-CHAIN SEARCH] Found ${finalTokens.length} total tokens across all chains for "${query}"`);

    // Return in the format the frontend expects
    res.json({
      success: true,
      query,
      tokens: finalTokens,
      count: finalTokens.length,
      chains_searched: chain ? [chain] : ['XRPL', 'Solana', 'Ethereum'],
      took: Date.now() - Date.now() // Placeholder timing
    });
    
  } catch (error) {
    console.error('❌ [MULTI-CHAIN SEARCH] Token search error:', error);
    res.status(500).json({
      error: 'Multi-chain token search failed',
      tokens: [],
      success: false
    });
  }
});

// Search query validation schema
const searchQuerySchema = z.object({
  q: z.string().min(1).max(100),
  type: z.enum(['all', 'profile', 'project', 'page', 'token', 'nft']).optional().default('all'),
  limit: z.coerce.number().min(1).max(1000).optional().default(100),
  offset: z.coerce.number().min(0).optional().default(0),
  chain: z.string().optional()
});

// Unified search endpoint
router.get('/unified', async (req, res) => {
  try {
    const validation = searchQuerySchema.safeParse(req.query);
    
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid search parameters',
        details: validation.error.errors 
      });
    }

    const { q: query, type, limit, offset, chain } = validation.data;
    
    console.log(`🔍 [SEARCH] Unified search: "${query}" (type: ${type}, limit: ${limit})`);

    let results: UnifiedSearchResult[] = [];

    // Helper function to search tokens across ALL chains via comprehensive DexScreener API
    const searchTokensAcrossChains = async (searchQuery: string, searchLimit: number): Promise<UnifiedSearchResult[]> => {
      try {
        console.log(`🔍 [COMPREHENSIVE] DexScreener search across all chains: ${searchQuery}`);
        const tokens: any[] = [];
        
        // Search ALL chains via DexScreener API
        try {
          const response = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(searchQuery)}`);
          if (response.ok) {
            const data = await response.json() as any;
            if (data.pairs && Array.isArray(data.pairs)) {
              console.log(`📊 [DEXSCREENER] Found ${data.pairs.length} pairs across all chains`);
              
              // Process unique tokens from pairs (focus on tokens, not pairs)
              const processedTokens = new Map(); // Prevent token duplicates
              
              for (const pair of data.pairs) {
                if (!pair.baseToken?.symbol) continue;
                
                const chainMap: Record<string, string> = {
                  'ethereum': 'ethereum',
                  'bsc': 'binance-smart-chain', 
                  'polygon': 'polygon',
                  'arbitrum': 'arbitrum',
                  'optimism': 'optimism',
                  'base': 'base',
                  'avalanche': 'avalanche',
                  'fantom': 'fantom',
                  'cronos': 'cronos',
                  'gnosis': 'gnosis',
                  'celo': 'celo',
                  'moonbeam': 'moonbeam',
                  'zksync': 'zksync',
                  'linea': 'linea',
                  'xrpl': 'xrpl',
                  'solana': 'solana',
                  'bitcoin': 'bitcoin'
                };
                
                const chainName = chainMap[pair.chainId] || pair.chainId;
                
                // Focus on unique tokens across chains
                const baseToken = pair.baseToken;
                const tokenSymbol = baseToken.symbol.toUpperCase();
                
                // For broad queries (empty or very short), include all popular tokens with volume data
                // For specific queries, filter by symbol match
                const isExactSearch = searchQuery.length >= 3; // Only filter on queries 3+ chars
                if (isExactSearch && !tokenSymbol.includes(searchQuery.toUpperCase())) continue;
                
                // Create unique token key (symbol + chain for uniqueness)
                const tokenKey = `${tokenSymbol}-${chainName}`;
                
                // Only add if we haven't seen this token on this chain before
                if (!processedTokens.has(tokenKey)) {
                  // Get the best price data available
                  const currentPrice = parseFloat(pair.priceUsd || '0');
                  const existing = processedTokens.get(tokenKey);
                  
                  // Use token with better price data if multiple pairs exist
                  if (!existing || currentPrice > existing.price_usd) {
                    processedTokens.set(tokenKey, {
                      symbol: tokenSymbol,
                      name: baseToken.name || tokenSymbol,
                      address: baseToken.address || '',
                      chain: chainName,
                      chainId: pair.chainId,
                      logo: pair?.info?.imageUrl || `/images/chains/${pair.chainId}.png`,
                      price_usd: currentPrice,
                      volume_24h: parseFloat(pair.volume?.h24 || '0'),
                      price_change_24h: parseFloat(pair.priceChange?.h24 || '0'),
                      liquidity_usd: parseFloat(pair.liquidity?.usd || '0'),
                      fdv: parseFloat(pair.fdv || '0'),
                      search_source: 'DexScreener-Token',
                      marketCap: parseFloat(pair.marketCap || '0')
                    });
                  }
                }
              }
              
              // Sort tokens by volume (highest first) and then slice
              const sortedTokens = Array.from(processedTokens.values())
                .filter(token => token.volume_24h > 0) // Only include tokens with volume data
                .sort((a, b) => b.volume_24h - a.volume_24h); // Sort by volume descending
              
              tokens.push(...sortedTokens);
              console.log(`✅ [COMPREHENSIVE] Processed ${tokens.length} unique tokens across all chains`);
            }
          }
        } catch (error) {
          console.warn('⚠️ [COMPREHENSIVE] DexScreener search failed:', error);
        }
        
        // Convert tokens to UnifiedSearchResult format
        return tokens.map((token: any) => ({
          id: token.address || `${token.symbol}-${token.chainId}` || Math.random().toString(),
          type: 'token' as const,
          title: `${token.symbol} ${token.name ? `(${token.name})` : ''}`,
          description: `${token.chain?.replace('-', ' ')?.toUpperCase() || token.chainId?.toUpperCase()} • ${token.price_usd > 0 ? `$${token.price_usd < 0.01 ? token.price_usd.toExponential(2) : token.price_usd.toFixed(4)}` : 'Price N/A'}${token.volume_24h > 0 ? ` • Vol: $${token.volume_24h >= 1000000 ? (token.volume_24h / 1000000).toFixed(1) + 'M' : token.volume_24h >= 1000 ? (token.volume_24h / 1000).toFixed(1) + 'K' : token.volume_24h.toFixed(0)}` : ''}`,
          url: token.chainId === 'xrpl' && token.address && token.address.includes('.') 
            ? `/token/${token.symbol}/${token.address.split('.')[1]}`
            : token.chainId === 'xrpl' && token.issuer
            ? `/token/${token.symbol}/${token.issuer}`
            : `/token/${token.chainId}/${token.address || token.symbol}`,
          image: token.logo,
          metadata: {
            chain: token.chain,
            chainId: token.chainId,
            symbol: token.symbol,
            name: token.name,
            address: token.address,
            price_usd: token.price_usd,
            volume_24h: token.volume_24h,
            price_change_24h: token.price_change_24h,
            liquidity_usd: token.liquidity_usd,
            fdv: token.fdv,
            logo: token.logo,
            search_source: token.search_source,
            dexId: token.dexId,
            pairAddress: token.pairAddress
          }
        }));
      } catch (error) {
        console.error('❌ [COMPREHENSIVE SEARCH] Token search failed:', error);
        return [];
      }
    };

    // Helper function to get real NFT collection images from Bithomp API
    const getNFTCollectionImage = async (issuer: string, taxon: number | string): Promise<string> => {
      try {
        const collectionId = `${issuer}:${taxon}`;
        const response = await fetch(`https://bithomp.com/api/v2/nft-collection/${collectionId}?assets=true`, {
          headers: {
            'Content-Type': 'application/json',
            'x-bithomp-token': process.env.BITHOMP_API_KEY || ''
          }
        });
        
        if (response.ok) {
          const data = await response.json() as any;
          // Use the actual image URL from assets field
          return data.collection?.assets?.image || data.collection?.assets?.thumbnail || '/images/nft-placeholder.svg';
        }
      } catch (error) {
        console.warn('⚠️ [NFT-IMAGE] Failed to fetch collection image:', error);
      }
      
      // Fallback to SVG placeholder
      return '/images/nft-placeholder.svg';
    };

    const getBithompNftPreview = (nftokenID: string): string => {
      return `https://cdn.bithomp.com/preview/${nftokenID}`;
    };

    // Helper function to search NFTs using Bithomp Collections API
    const searchNFTsAcrossChains = async (searchQuery: string, searchLimit: number): Promise<UnifiedSearchResult[]> => {
      try {
        console.log(`🎨 [NFT SEARCH] Searching NFT collections via Bithomp API: ${searchQuery}`);
        
        const searchLower = searchQuery.toLowerCase();
        let allResults: UnifiedSearchResult[] = [];

        // Search NFT Collections using Bithomp API
        try {
          const collectionsResponse = await fetch(`https://bithomp.com/api/v2/nft-collections?search=${encodeURIComponent(searchQuery)}&statistics=week&assets=all&floorPrice=true&limit=${Math.max(searchLimit, 200)}`, {
            headers: {
              'Content-Type': 'application/json',
              'x-bithomp-token': process.env.BITHOMP_API_KEY || process.env.BITHOMP_TOKEN || ''
            }
          });

          if (collectionsResponse.ok) {
            const collectionsData = await collectionsResponse.json();
            const collections = collectionsData.collections || collectionsData.data || [];
            
            console.log(`📋 [NFT SEARCH] Found ${collections.length} total collections from Bithomp`);

            // Filter collections based on search query - check all possible name fields
            const matchingCollections = collections.filter((collection: any) => {
              const searchTerm = searchLower;
              return (
                (typeof collection.name === 'string' && collection.name.toLowerCase().includes(searchTerm)) ||
                (typeof collection.description === 'string' && collection.description.toLowerCase().includes(searchTerm)) ||
                (typeof collection.family === 'string' && collection.family.toLowerCase().includes(searchTerm)) ||
                (typeof collection.issuer === 'string' && collection.issuer.toLowerCase().includes(searchTerm)) ||
                (typeof collection.collection === 'string' && collection.collection.toLowerCase().includes(searchTerm)) ||
                (typeof collection.issuerDetails?.username === 'string' && collection.issuerDetails.username.toLowerCase().includes(searchTerm)) ||
                (typeof collection.issuerDetails?.service === 'string' && collection.issuerDetails.service.toLowerCase().includes(searchTerm)) ||
                // Also search by taxon number
                (collection.taxon && collection.taxon.toString().includes(searchTerm))
              );
            });

            // Convert collection results to search format with real images  
            for (const collection of matchingCollections) {
              // Get the real image URL from Bithomp API
              const imageUrl = await getNFTCollectionImage(collection.issuer, collection.taxon);
              
              allResults.push({
                id: `${collection.issuer}:${collection.taxon}` || Math.random().toString(),
                type: 'nft' as const,
                title: collection.name || `Collection ${collection.taxon || 'Unknown'}`,
                description: `${collection.description || 'XRPL NFT Collection'} • Floor: ${collection.floorPrice || 'N/A'} • Items: ${collection.count || 'Unknown'}`,
                url: `/nft-collection/${collection.issuer}/${collection.taxon}`,
                image: imageUrl,
                metadata: {
                  chain: 'xrpl',
                  collection: collection.name,
                  issuer: collection.issuer,
                  taxon: collection.taxon,
                  floor_price: collection.floorPrice,
                  total_items: collection.count,
                  search_source: 'Bithomp-Collections',
                  volume_24h: collection.volume24h,
                  owners: collection.owners
                }
              });
            }

            console.log(`✅ [NFT SEARCH] Found ${matchingCollections.length} matching collections`);
          }
        } catch (error) {
          console.warn('⚠️ [NFT SEARCH] Bithomp collections search failed:', error);
        }

        // Also search individual NFTs if we need more results
        if (allResults.length < searchLimit) {
          try {
            const nftsResponse = await fetch(`https://bithomp.com/api/v2/nfts?search=${encodeURIComponent(searchQuery)}&limit=${searchLimit * 2}&assets=all`, {
              headers: {
                'Content-Type': 'application/json',
                'x-bithomp-token': process.env.BITHOMP_API_KEY || process.env.BITHOMP_TOKEN || ''
              }
            });

            if (nftsResponse.ok) {
              const nftsData = await nftsResponse.json();
              const nfts = nftsData.nfts || nftsData.data || [];
              
              // Filter NFTs based on search query - check all possible fields
              const matchingNfts = nfts.filter((nft: any) => {
                const searchTerm = searchLower;
                return (
                  (typeof nft.metadata?.name === 'string' && nft.metadata.name.toLowerCase().includes(searchTerm)) ||
                  (typeof nft.metadata?.description === 'string' && nft.metadata.description.toLowerCase().includes(searchTerm)) ||
                  (typeof nft.metadata?.collection === 'string' && nft.metadata.collection.toLowerCase().includes(searchTerm)) ||
                  (typeof nft.nftokenID === 'string' && nft.nftokenID.toLowerCase().includes(searchTerm)) ||
                  (typeof nft.issuer === 'string' && nft.issuer.toLowerCase().includes(searchTerm)) ||
                  (typeof nft.name === 'string' && nft.name.toLowerCase().includes(searchTerm)) ||
                  (typeof nft.description === 'string' && nft.description.toLowerCase().includes(searchTerm)) ||
                  (typeof nft.collection === 'string' && nft.collection.toLowerCase().includes(searchTerm)) ||
                  (typeof nft.collection_name === 'string' && nft.collection_name.toLowerCase().includes(searchTerm)) ||
                  // Search by token ID patterns
                  (typeof nft.nftokenID === 'string' && nft.nftokenID.slice(-8).toLowerCase().includes(searchTerm))
                );
              });

              // Add NFT results
              for (const nft of matchingNfts.slice(0, searchLimit - allResults.length)) {
                allResults.push({
                  id: nft.nftokenID || Math.random().toString(),
                  type: 'nft' as const,
                  title: nft.metadata?.name || `NFT #${nft.nftokenID?.slice(-8) || 'Unknown'}`,
                  description: `${nft.metadata?.description || 'XRPL NFT'} • Collection: ${nft.metadata?.collection || 'Unknown'}`,
                  url: `/nft/${nft.nftokenID}`,
                  image: getBithompNftPreview(nft.nftokenID),
                  metadata: {
                    chain: 'xrpl',
                    collection: nft.metadata?.collection,
                    issuer: nft.issuer,
                    taxon: nft.nft_taxon,
                    nft_id: nft.nftokenID,
                    search_source: 'Bithomp-NFTs'
                  }
                });
              }

              console.log(`✅ [NFT SEARCH] Found ${matchingNfts.length} matching individual NFTs`);
            }
          } catch (error) {
            console.warn('⚠️ [NFT SEARCH] Bithomp NFTs search failed:', error);
          }
        }

        // Fallback: If we found few results, check known Riddle collections manually
        if (allResults.length < searchLimit && (
          searchLower.includes('inquiry') || 
          searchLower.includes('riddle') || 
          searchLower.includes('bridge') || 
          searchLower.includes('emporium') || 
          searchLower.includes('dante') ||
          searchLower.includes('inquisition')
        )) {
          console.log(`🔍 [NFT SEARCH] Checking known Riddle collections manually...`);
          
          // Known Riddle collections with their metadata
          const knownCollections = [
            {
              issuer: 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH',
              taxon: 0,
              name: 'The Inquiry',
              description: 'What makes a riddle? What makes us ask? Explore the mystery together as we journey through a vibrantly abstract and absurdist tale of the riddle and the blockchain. 123 unique AI rendered NFTs.',
              keywords: ['inquiry', 'riddle', 'ai', 'abstract']
            },
            {
              issuer: 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH',
              taxon: 2,
              name: 'The Inquisition',
              description: 'Find peace in having nothing. Find strength in having something. Find drive in wanting it all. Welcome, to the Inquisition. Abstract, and from the World of RDL explore conflict excitement and enchantment as a community. Be a collector. Be riddle. Build your Sanctum.',
              keywords: ['inquisition', 'riddle', 'abstract', 'sanctum', 'collector']
            },
            {
              issuer: 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH',
              taxon: 4,
              name: 'Dantes Aurum',
              description: 'Things set in stone are often the things that require examination. Enter a realm of rediscovery and abstract idealism. 42. What does it mean? As above, so below. By AI Artist Janus Grey.',
              keywords: ['dante', 'aurum', 'riddle', 'stone', 'examination', 'abstract']
            },
            {
              issuer: 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH',
              taxon: 9,
              name: 'Under the Bridge',
              description: 'Dive into the shadowy world of Under the Bridge, a limited-edition PFP NFT collection of 1,230 mischievous Trolls celebrating the launch of Riddles revolutionary cross-chain bridge and secure wallet! Drawing from timeless folklore, these Trolls lurk beneath the digital bridges of blockchain, ready to usher assets from Ethereum, Solana, and beyond seamlessly onto the XRPL.',
              keywords: ['bridge', 'under', 'riddle', 'troll', 'cross-chain', 'pf p']
            },
            {
              issuer: 'rBeistBLWtUskF2YzzSwMSM2tgsK7ZD7ME',
              taxon: 0,
              name: 'Lost Emporium',
              description: 'Lost Emporium NFT Collection',
              keywords: ['emporium', 'lost', 'riddle']
            },
            {
              issuer: 'rEVrTKUKSLx5nxdfV8SAFTxS9FGFrfHRLo',
              taxon: 0,
              name: 'Inquisition & Riddle Drop',
              description: 'Inquisition & Riddle Drop NFT Collection',
              keywords: ['inquisition', 'riddle', 'drop']
            }
          ];
          
          // Check each collection for matches
          for (const collection of knownCollections) {
            const matches = collection.keywords.some(keyword => 
              keyword.toLowerCase().includes(searchLower) || 
              searchLower.includes(keyword.toLowerCase())
            ) || collection.name.toLowerCase().includes(searchLower);
            
            if (matches) {
              try {
                // Fetch collection data from Bithomp
                const collectionResponse = await fetch(`https://bithomp.com/api/v2/nft-collection/${collection.issuer}:${collection.taxon}?assets=all`, {
                  headers: {
                    'Content-Type': 'application/json',
                    'x-bithomp-token': process.env.BITHOMP_API_KEY || process.env.BITHOMP_TOKEN || ''
                  }
                });
                
                if (collectionResponse.ok) {
                  const collectionData = await collectionResponse.json();
                  const imageUrl = await getNFTCollectionImage(collection.issuer, collection.taxon);
                  
                  // Check if we already have this collection in results
                  const existingResult = allResults.find(r => r.id === `${collection.issuer}:${collection.taxon}`);
                  if (!existingResult) {
                    allResults.push({
                      id: `${collection.issuer}:${collection.taxon}`,
                      type: 'nft' as const,
                      title: collection.name,
                      description: `${collection.description} • Riddle Gaming Collection`,
                      url: `/nft-collection/${collection.issuer}/${collection.taxon}`,
                      image: imageUrl,
                      metadata: {
                        chain: 'xrpl',
                        collection: collection.name,
                        issuer: collection.issuer,
                        taxon: collection.taxon,
                        search_source: 'Known-Riddle-Collections'
                      }
                    });
                    
                    console.log(`✅ [NFT SEARCH] Added known collection: ${collection.name}`);
                  }
                }
              } catch (error) {
                console.warn(`⚠️ [NFT SEARCH] Failed to fetch known collection ${collection.name}:`, error);
              }
            }
          }
        }

        console.log(`🎯 [NFT SEARCH] Total NFT results: ${allResults.length}`);
        return allResults;

      } catch (error) {
        console.error('❌ [NFT SEARCH] Bithomp search failed:', error);
        return [];
      }
    };

    // Perform search based on type
    if (type === 'all') {
      // Search all types with high limits for infinite scroll
      const searchPromises = [
        storage.searchProfiles(query, Math.min(limit, 200)), // High limit for profiles
        storage.searchProjects(query, Math.min(limit, 200)), // High limit for projects  
        storage.searchPages(query, Math.min(limit, 200)), // High limit for pages
        searchTokensAcrossChains(query, Math.min(limit, 500)), // High limit for tokens
        searchNFTsAcrossChains(query, Math.min(limit, 300)) // High limit for NFTs
      ];
      
      const [profiles, projects, pages, tokens, nfts] = await Promise.all(searchPromises);
      
      results = [...profiles, ...projects, ...pages, ...tokens, ...nfts];
      
      // Sort by relevance and limit
      results = results
        .sort((a, b) => {
          // Prioritize exact matches in title
          const aExact = a.title.toLowerCase().includes(query.toLowerCase()) ? 1 : 0;
          const bExact = b.title.toLowerCase().includes(query.toLowerCase()) ? 1 : 0;
          if (aExact !== bExact) return bExact - aExact;
          
          // Then sort by type preference (tokens > profiles > projects > pages)
          const typeOrder = { token: 4, profile: 3, project: 2, page: 1, nft: 2 };
          return (typeOrder[b.type] || 0) - (typeOrder[a.type] || 0);
        })
        .slice(offset, offset + limit);
        
    } else {
      // Search specific type
      switch (type) {
        case 'profile':
          results = await storage.searchProfiles(query, limit);
          break;
        case 'project':
          results = await storage.searchProjects(query, limit);
          break;
        case 'page':
          results = await storage.searchPages(query, limit);
          break;
        case 'token':
          results = await searchTokensAcrossChains(query, limit);
          break;
        case 'nft':
          // Use dedicated NFT search functionality
          results = await searchNFTsAcrossChains(query, limit);
          break;
      }
    }

    // Record search analytics
    try {
      await storage.recordSearchAnalytics({
        query,
        search_type: type,
        results_count: results.length,
        user_handle: req.body?.userHandle || null,
        ip_address: req.ip || null,
        user_agent: req.get('User-Agent') || null,
        search_session_id: req.get('X-Search-Session-ID') || null
      });
    } catch (analyticsError) {
      console.warn('⚠️ [SEARCH] Failed to record analytics:', analyticsError);
    }

    // Calculate total results before pagination for 'all' type
    let totalResults = results.length;
    
    // For individual types, we need to fetch more to determine if there are more results
    if (type !== 'all') {
      // For specific types, apply pagination
      const allTypeResults = results;
      results = results.slice(offset, offset + limit);
      totalResults = allTypeResults.length;
    }
    
    // Determine if there are more results
    const hasMore = type === 'all' ? 
      (results.length === limit) : // For 'all', assume more if we got exactly the limit
      (offset + limit < totalResults); // For specific types, check against total

    console.log(`✅ [SEARCH] Found ${results.length} results for "${query}" (offset: ${offset}, hasMore: ${hasMore})`);

    res.json({
      query,
      type,
      results,
      total: totalResults,
      page: Math.floor(offset / limit),
      hasMore,
      took: 0 // Remove timing calculation to fix TypeScript error
    });

  } catch (error) {
    console.error('❌ [SEARCH] Unified search error:', error);
    res.status(500).json({ 
      error: 'Search service unavailable',
      message: 'Please try again later'
    });
  }
});

// Search profiles endpoint
router.get('/profiles', async (req, res) => {
  try {
    const validation = z.object({
      q: z.string().min(1).max(100),
      limit: z.coerce.number().min(1).max(50).optional().default(10)
    }).safeParse(req.query);

    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }

    const { q: query, limit } = validation.data;
    const results = await storage.searchProfiles(query, limit);

    res.json({ query, results, total: results.length });
  } catch (error) {
    console.error('❌ [SEARCH] Profile search error:', error);
    res.status(500).json({ error: 'Search service unavailable' });
  }
});

// Search projects endpoint
router.get('/projects', async (req, res) => {
  try {
    const validation = z.object({
      q: z.string().min(1).max(100),
      limit: z.coerce.number().min(1).max(50).optional().default(10)
    }).safeParse(req.query);

    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }

    const { q: query, limit } = validation.data;
    const results = await storage.searchProjects(query, limit);

    res.json({ query, results, total: results.length });
  } catch (error) {
    console.error('❌ [SEARCH] Project search error:', error);
    res.status(500).json({ error: 'Search service unavailable' });
  }
});

// Search pages endpoint
router.get('/pages', async (req, res) => {
  try {
    const validation = z.object({
      q: z.string().min(1).max(100),
      limit: z.coerce.number().min(1).max(50).optional().default(10)
    }).safeParse(req.query);

    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }

    const { q: query, limit } = validation.data;
    const results = await storage.searchPages(query, limit);

    res.json({ query, results, total: results.length });
  } catch (error) {
    console.error('❌ [SEARCH] Page search error:', error);
    res.status(500).json({ error: 'Search service unavailable' });
  }
});

// Popular searches endpoint
router.get('/popular', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 20);
    const popular = await storage.getPopularSearches(limit);
    res.json({ popular });
  } catch (error) {
    console.error('❌ [SEARCH] Popular searches error:', error);
    res.status(500).json({ error: 'Service unavailable' });
  }
});

// Search analytics endpoint for tracking clicks
router.post('/analytics/click', async (req, res) => {
  try {
    const validation = z.object({
      query: z.string().min(1),
      result_id: z.string().min(1),
      result_type: z.enum(['profile', 'project', 'page']),
      search_session_id: z.string().optional()
    }).safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }

    const { query, result_id, result_type, search_session_id } = validation.data;

    await storage.recordSearchAnalytics({
      query,
      search_type: result_type,
      results_count: 1,
      clicked_result_id: result_id,
      clicked_result_type: result_type,
      search_session_id: search_session_id || null,
      user_handle: req.body?.userHandle || null,
      ip_address: req.ip || null,
      user_agent: req.get('User-Agent') || null
    });

    res.json({ success: true });
  } catch (error) {
    console.error('❌ [SEARCH] Click analytics error:', error);
    res.status(500).json({ error: 'Service unavailable' });
  }
});

export default router;