import { Router } from "express";
import { bithompCollectionOverride, bithompSearchOverride } from "./middleware/bithomp-override";

const router = Router();

/**
 * Override routes for Bithomp API responses
 * These routes check for internal project data first before calling Bithomp
 */

/**
 * GET /api/nft/collection/:issuer/:taxon
 * Override Bithomp collection endpoint with internal project data
 */
router.get("/api/nft/collection/:issuer/:taxon", 
  bithompCollectionOverride(),
  async (req, res) => {
    // If we reach here, no internal override was found
    // Fall back to the original Bithomp API logic
    const { issuer, taxon } = req.params;
    
    try {
      console.log(`🌐 [FALLBACK] Fetching from Bithomp API for ${issuer}:${taxon}`);
      
      // Try the collection endpoint first
      const collectionUrl = `https://bithomp.com/api/v2/nft-collection/${issuer}/${taxon}`;
      console.log(`📍 [BITHOMP] Trying collection URL: ${collectionUrl}`);
      
      const bithompResponse = await fetch(collectionUrl, {
        headers: {
          'x-bithomp-token': process.env.BITHOMP_API_KEY || '',
          'Accept': 'application/json'
        }
      });
      
      if (bithompResponse.ok) {
        const data = await bithompResponse.json();
        console.log(`✅ [BITHOMP] Collection data received for ${issuer}:${taxon}`);
        
        // Fetch NFTs separately for this collection
        const nftsUrl = `https://bithomp.com/api/v2/nfts?issuer=${issuer}&taxon=${taxon}&limit=500&assets=true`;
        const nftsResponse = await fetch(nftsUrl, {
          headers: {
            'x-bithomp-token': process.env.BITHOMP_API_KEY || ''
          }
        });
        
        let nfts = [];
        if (nftsResponse.ok) {
          const nftsData = await nftsResponse.json();
          nfts = nftsData.nfts || [];
          console.log(`✅ [BITHOMP] Fetched ${nfts.length} NFTs for collection`);
        }
        
        // Combine collection info with NFTs
        const enhancedData = {
          collection: {
            ...data,
            nfts: nfts,
            issuer: issuer,
            taxon: parseInt(taxon),
            // Ensure image URL is correct for this specific taxon
            image: data.image || `https://cdn.bithomp.com/nft/${issuer}:${taxon}/image`,
            verified: data.verified || false
          },
          meta: {
            dataSource: "bithomp_api",
            overrideChecked: true,
            overrideFound: false,
            timestamp: new Date().toISOString()
          }
        };
        
        return res.json(enhancedData);
      } else {
        console.log(`❌ [BITHOMP] Collection not found: ${bithompResponse.status}`);
        return res.status(404).json({
          error: "No collection information is found",
          meta: {
            dataSource: "bithomp_api",
            overrideChecked: true,
            overrideFound: false,
            timestamp: new Date().toISOString()
          }
        });
      }
    } catch (error) {
      console.error("Error fetching from Bithomp API:", error);
      return res.status(500).json({
        error: "Failed to fetch collection data",
        source: "bithomp_api"
      });
    }
  }
);

/**
 * GET /api/nft/collections/search
 * Override Bithomp search endpoint with internal project data
 */
router.get("/api/nft/collections/search", 
  bithompSearchOverride(),
  async (req, res) => {
    // If we reach here, fall back to original search logic
    const { q: query, limit = 10 } = req.query;
    
    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    try {
      console.log(`🔍 [FALLBACK] Searching Bithomp API for: "${query}"`);
      
      const searchResponse = await fetch(`https://bithomp.com/api/v2/nft-collections?search=${encodeURIComponent(query)}&limit=${limit}`, {
        headers: {
          'x-bithomp-token': process.env.BITHOMP_API_KEY || '',
          'Accept': 'application/json',
          'User-Agent': 'RiddleSwap/1.0'
        }
      });
      
      if (searchResponse.ok) {
        const data = await searchResponse.json();
        const collections = Array.isArray(data) ? data : (data.collections || []);
        
        const transformedCollections = collections.map((col: any) => ({
          issuer: col.issuer,
          taxon: col.taxon,
          name: col.name || col.family || col.title || `Collection #${col.taxon}`,
          image: col.image || col.assets?.image || col.assets?.preview,
          floorPrice: parseFloat(col.floorPrice || '0'),
          volume24h: parseFloat(col.volume24h || '0'),
          totalNFTs: parseInt(col.totalNFTs || col.total || '0'),
          owners: parseInt(col.owners || '0'),
          sales24h: parseInt(col.sales24h || '0'),
          verified: col.verified || false,
          description: col.description || '',
          dataSource: "bithomp_api"
        }));
        
        return res.json({ 
          collections: transformedCollections,
          meta: {
            internalCount: 0,
            bithompCount: transformedCollections.length,
            totalCount: transformedCollections.length,
            hasOverrides: false,
            dataSource: "bithomp_api_only"
          }
        });
      } else {
        return res.status(searchResponse.status).json({
          error: "Search failed",
          source: "bithomp_api"
        });
      }
    } catch (error) {
      console.error('Bithomp collection search failed:', error);
      return res.status(500).json({ 
        error: 'Search failed',
        source: "bithomp_api"
      });
    }
  }
);

/**
 * GET /api/nft/collection/:issuer
 * Handle collection requests without taxon (find all projects for issuer)
 */
router.get("/api/nft/collection/:issuer", async (req, res) => {
  try {
    const { issuer } = req.params;
    
    console.log(`🔍 [MULTI-PROJECT] Looking for all projects from issuer: ${issuer}`);
    
    // Get all internal projects for this issuer
    const { storage } = await import('./storage');
    const projects = await storage.getProjectsByIssuerWallet(issuer);
    const overrideProjects = projects.filter((p: any) => p.override_bithomp_responses);
    
    if (overrideProjects.length > 0) {
      console.log(`🎯 [MULTI-OVERRIDE] Found ${overrideProjects.length} override projects for ${issuer}`);
      
      const projectCollections = overrideProjects.map((project: any) => ({
        issuer: project.issuer_wallet,
        taxon: project.nft_token_taxon || 0,
        name: project.name || `Collection ${project.nft_token_taxon}`,
        description: project.description || "",
        image: project.logo_url || `https://bithomp.com/api/v2/nft/${issuer}:${project.nft_token_taxon}/image`,
        verified: project.claim_status === "claimed",
        floorPrice: project.custom_collection_metadata?.floorPrice || 0,
        totalNFTs: project.custom_collection_metadata?.totalNFTs || 0,
        vanitySlug: project.vanity_slug,
        website: project.website_url,
        socialLinks: project.social_links,
        projectId: project.id,
        dataSource: "riddle_internal"
      }));
      
      return res.json({
        collections: projectCollections,
        meta: {
          issuer: issuer,
          projectCount: projectCollections.length,
          dataSource: "riddle_multi_project",
          hasMultipleProjects: projectCollections.length > 1
        }
      });
    }
    
    // No internal projects, fall back to Bithomp
    console.log(`🌐 [FALLBACK] No override projects found, checking Bithomp for issuer: ${issuer}`);
    
    // Try to fetch all collections from this issuer via Bithomp
    const bithompResponse = await fetch(`https://bithomp.com/api/v2/nfts?issuer=${issuer}&limit=50&assets=true`, {
      headers: {
        'x-bithomp-token': process.env.BITHOMP_API_KEY || '',
        'Accept': 'application/json',
        'User-Agent': 'RiddleSwap/1.0'
      }
    });
    
    if (bithompResponse.ok) {
      const data = await bithompResponse.json();
      const nfts = data.nfts || [];
      
      // Group by taxon to find collections
      const taxonGroups = nfts.reduce((acc: any, nft: any) => {
        const taxon = nft.taxon || nft.nftokenTaxon || 0;
        if (!acc[taxon]) {
          acc[taxon] = [];
        }
        acc[taxon].push(nft);
        return acc;
      }, {});
      
      const collections = Object.entries(taxonGroups).map(([taxon, nfts]: [string, any]) => ({
        issuer: issuer,
        taxon: parseInt(taxon),
        name: `Collection ${taxon}`,
        totalNFTs: (nfts as any[]).length,
        dataSource: "bithomp_derived"
      }));
      
      return res.json({
        collections: collections,
        meta: {
          issuer: issuer,
          projectCount: collections.length,
          dataSource: "bithomp_derived",
          totalNFTs: nfts.length
        }
      });
    }
    
    return res.status(404).json({
      error: "No collections found for this issuer",
      issuer: issuer
    });
    
  } catch (error) {
    console.error("Error fetching issuer collections:", error);
    return res.status(500).json({
      error: "Failed to fetch issuer collections"
    });
  }
});

export default router;