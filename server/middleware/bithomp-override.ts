import { Request, Response, NextFunction } from "express";
import { storage } from "../storage";

/**
 * Bithomp Override Middleware
 * Checks if we have internal project data before falling back to Bithomp API
 */

interface EnhancedProjectData {
  id: string;
  name: string;
  description: string;
  issuer: string;
  taxon: number;
  vanitySlug?: string;
  logoUrl?: string;
  bannerUrl?: string;
  websiteUrl?: string;
  socialLinks?: Record<string, string>;
  ownerWallet?: string;
  projectManagers?: string[];
  floorPrice?: number;
  totalNFTs?: number;
  verified: boolean;
  customMetadata?: Record<string, any>;
  overrideActive: boolean;
}

/**
 * Check if we have internal project data for a given issuer and taxon
 * Returns project ONLY if:
 * 1. Exact taxon match with override enabled OR claimed status
 * 2. No taxon specified - returns first claimed/override project
 * 
 * IMPORTANT: If taxon IS specified but no override exists, returns NULL
 * to allow Bithomp fallback (prevents wrong taxon data)
 */
export async function checkForInternalProject(
  issuer: string, 
  taxon?: number
): Promise<EnhancedProjectData | null> {
  try {
    // Look for projects by issuer wallet
    const projects = await storage.getProjectsByIssuerWallet(issuer);
    
    if (projects.length === 0) {
      return null;
    }
    
    // If taxon is specified, ONLY return exact match (or null for Bithomp fallback)
    if (taxon !== undefined) {
      const exactMatch = projects.find(p => p.nft_token_taxon === taxon);
      if (exactMatch) {
        // Override if explicitly enabled OR if project is claimed (verified)
        if (exactMatch.override_bithomp_responses || exactMatch.claim_status === 'claimed') {
          console.log(`✅ [OVERRIDE] Exact taxon match found: ${issuer}:${taxon}, verified=${exactMatch.claim_status === 'claimed'}`);
          return formatProjectForOverride(exactMatch);
        }
      }
      // No exact match with override/claim - return null for Bithomp fallback
      console.log(`⚠️ [OVERRIDE] No override for ${issuer}:${taxon}, falling back to Bithomp`);
      return null;
    }
    
    // No taxon specified - prioritize claimed projects
    const claimedProject = projects.find(p => p.claim_status === 'claimed');
    if (claimedProject) {
      console.log(`✅ [OVERRIDE] Using claimed project: ${issuer}:${claimedProject.nft_token_taxon}`);
      return formatProjectForOverride(claimedProject);
    }
    
    // Fall back to first project with override enabled
    const overrideProject = projects.find(p => p.override_bithomp_responses);
    if (overrideProject) {
      console.log(`✅ [OVERRIDE] Using override project: ${issuer}:${overrideProject.nft_token_taxon}`);
      return formatProjectForOverride(overrideProject);
    }
    
    return null;
  } catch (error) {
    console.error("Error checking for internal project:", error);
    return null;
  }
}

/**
 * Format internal project data for Bithomp API response override
 */
function formatProjectForOverride(project: any): EnhancedProjectData {
  return {
    id: project.id,
    name: project.name || `Collection ${project.nft_token_taxon}`,
    description: project.description || "",
    issuer: project.issuer_wallet,
    taxon: project.nft_token_taxon || 0,
    vanitySlug: project.vanity_slug,
    logoUrl: project.logo_url,
    bannerUrl: project.banner_url,
    websiteUrl: project.website_url,
    socialLinks: project.social_links || {},
    ownerWallet: project.ownerWalletAddress,
    projectManagers: project.project_managers || [],
    floorPrice: project.custom_collection_metadata?.floorPrice || 0,
    totalNFTs: project.custom_collection_metadata?.totalNFTs || 0,
    verified: project.claim_status === "claimed" || project.ownerWalletAddress !== null,
    customMetadata: project.custom_collection_metadata || {},
    overrideActive: project.override_bithomp_responses || false
  };
}

/**
 * Middleware to override NFT collection data with internal project data
 */
export function bithompCollectionOverride() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { issuer, taxon } = req.params;
      
      if (!issuer) {
        return next();
      }
      
      const parsedTaxon = taxon ? parseInt(taxon) : undefined;
      const internalProject = await checkForInternalProject(issuer, parsedTaxon);
      
      if (!internalProject) {
        return next(); // No internal data, proceed to Bithomp API
      }
      
      console.log(`🎯 [OVERRIDE] Using internal project data for ${issuer}:${taxon || 'any'}`);
      
      // Return enhanced project data instead of calling Bithomp
      const overrideResponse = {
        collection: {
          issuer: internalProject.issuer,
          taxon: internalProject.taxon,
          name: internalProject.name,
          description: internalProject.description,
          image: internalProject.logoUrl || `https://bithomp.com/api/v2/nft/${issuer}:${internalProject.taxon}/image`,
          verified: internalProject.verified,
          floorPrice: internalProject.floorPrice?.toString() || "0",
          totalNFTs: internalProject.totalNFTs?.toString() || "0",
          // Enhanced fields from internal data
          vanitySlug: internalProject.vanitySlug,
          website: internalProject.websiteUrl,
          socialLinks: internalProject.socialLinks,
          ownerWallet: internalProject.ownerWallet,
          projectManagers: internalProject.projectManagers,
          customData: internalProject.customMetadata,
          dataSource: "riddle_internal",
          overrideActive: true
        },
        // Add metadata about the override
        meta: {
          dataSource: "riddle_override",
          projectId: internalProject.id,
          hasVanitySlug: !!internalProject.vanitySlug,
          overrideTimestamp: new Date().toISOString()
        }
      };
      
      return res.json(overrideResponse);
      
    } catch (error) {
      console.error("Error in Bithomp collection override:", error);
      return next(); // Fall back to normal Bithomp API
    }
  };
}

/**
 * Middleware to enhance NFT search results with internal project data
 */
export function bithompSearchOverride() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { q: query } = req.query;
      
      if (!query || typeof query !== "string") {
        return next();
      }
      
      // Check if we have any internal projects matching the search
      const allProjects = await storage.getAllDevtoolsProjects();
      const matchingProjects = allProjects.filter((project: any) => 
        project.override_bithomp_responses && (
          project.name?.toLowerCase().includes(query.toLowerCase()) ||
          project.description?.toLowerCase().includes(query.toLowerCase()) ||
          project.vanity_slug?.toLowerCase().includes(query.toLowerCase())
        )
      );
      
      if (matchingProjects.length === 0) {
        return next(); // No internal matches, proceed to Bithomp
      }
      
      console.log(`🔍 [SEARCH OVERRIDE] Found ${matchingProjects.length} internal projects for "${query}"`);
      
      // Format internal projects for search results
      const enhancedCollections = matchingProjects.map((project: any) => ({
        issuer: project.issuer_wallet,
        taxon: project.nft_token_taxon || 0,
        name: project.name || `Collection ${project.nft_token_taxon}`,
        description: project.description || "",
        image: project.logo_url || `https://bithomp.com/api/v2/nft/${project.issuer_wallet}:${project.nft_token_taxon}/image`,
        verified: project.claim_status === "claimed",
        floorPrice: project.custom_collection_metadata?.floorPrice || 0,
        totalNFTs: project.custom_collection_metadata?.totalNFTs || 0,
        volume24h: project.custom_collection_metadata?.volume24h || 0,
        sales24h: project.custom_collection_metadata?.sales24h || 0,
        owners: project.custom_collection_metadata?.owners || 0,
        // Enhanced fields
        vanitySlug: project.vanity_slug,
        website: project.website_url,
        dataSource: "riddle_internal"
      }));
      
      // Still call Bithomp for additional results but merge with internal
      try {
        const bithompResponse = await fetch(`https://bithomp.com/api/v2/nft-collections?search=${encodeURIComponent(query)}&limit=10`, {
          headers: {
            'x-bithomp-token': process.env.BITHOMP_API_KEY || '',
            'Accept': 'application/json',
            'User-Agent': 'RiddleSwap/1.0'
          }
        });
        
        if (bithompResponse.ok) {
          const bithompData = await bithompResponse.json();
          const bithompCollections = Array.isArray(bithompData) ? bithompData : (bithompData.collections || []);
          
          // Merge and deduplicate
          const allCollections = [...enhancedCollections];
          bithompCollections.forEach((bithompCol: any) => {
            const isDuplicate = enhancedCollections.some((internal: any) => 
              internal.issuer === bithompCol.issuer && internal.taxon === bithompCol.taxon
            );
            if (!isDuplicate) {
              allCollections.push({
                ...bithompCol,
                dataSource: "bithomp_api"
              });
            }
          });
          
          return res.json({
            collections: allCollections,
            meta: {
              internalCount: enhancedCollections.length,
              bithompCount: bithompCollections.length,
              totalCount: allCollections.length,
              hasOverrides: true
            }
          });
        }
      } catch (error) {
        console.warn("Failed to fetch from Bithomp, returning internal results only:", error);
      }
      
      // Return internal results only if Bithomp fails
      return res.json({
        collections: enhancedCollections,
        meta: {
          internalCount: enhancedCollections.length,
          bithompCount: 0,
          totalCount: enhancedCollections.length,
          hasOverrides: true,
          bithompFailed: true
        }
      });
      
    } catch (error) {
      console.error("Error in Bithomp search override:", error);
      return next();
    }
  };
}

/**
 * Enhanced middleware that adds internal project data to existing Bithomp responses
 */
export function enhanceBithompResponse() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.json;
    
    res.json = function(data: any) {
      // If this is a Bithomp collection response, enhance it
      if (data && data.collection) {
        enhanceCollectionData(data.collection);
      } else if (data && data.collections && Array.isArray(data.collections)) {
        data.collections.forEach(enhanceCollectionData);
      }
      
      return originalSend.call(this, data);
    };
    
    next();
  };
}

async function enhanceCollectionData(collection: any) {
  try {
    if (!collection.issuer) return;
    
    const internalProject = await checkForInternalProject(collection.issuer, collection.taxon);
    if (internalProject) {
      // Enhance the collection with internal data
      collection.name = internalProject.name || collection.name;
      collection.description = internalProject.description || collection.description;
      collection.verified = internalProject.verified;
      collection.vanitySlug = internalProject.vanitySlug;
      collection.website = internalProject.websiteUrl;
      collection.socialLinks = internalProject.socialLinks;
      collection.hasInternalData = true;
      collection.projectId = internalProject.id;
    }
  } catch (error) {
    console.error("Error enhancing collection data:", error);
  }
}

export { EnhancedProjectData };