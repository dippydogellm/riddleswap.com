import { Router } from "express";
import { z } from "zod";
import { storage } from "./storage";
import { 
  insertDevtoolsProjectSchema,
  insertProjectWalletSchema,
  insertProjectServiceSchema,
  insertTokenConfigurationSchema,
  insertNftConfigurationSchema
} from "@shared/schema";
import { nanoid } from "nanoid";
import { getBithompCollection } from "./bithomp-api-v2";
import { initializeProjectServices, initializeProjectConfigurations } from "./project-service-initializer";
import { getBithompCollectionWithFallbacks, RateLimitProtection } from "./bithomp-error-handler";
import { assetIngestionService } from "./asset-ingestion-service";

const router = Router();

// Validation schemas
const createProjectSchema = insertDevtoolsProjectSchema.extend({
  vanitySlug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, "Vanity slug must contain only lowercase letters, numbers, and hyphens").optional(),
  projectManagers: z.array(z.string()).optional()
});

const updateProjectSchema = createProjectSchema.partial();

const claimProjectSchema = z.object({
  issuerWallet: z.string().min(1, "Issuer wallet is required"),
  chain: z.string().min(1, "Chain is required"),
  nftTokenTaxon: z.number().optional(),
  claimantWallet: z.string().min(1, "Claimant wallet is required"),
  claimantChain: z.string().min(1, "Claimant chain is required"),
  ownershipProofType: z.enum(["signature", "transaction", "control_verification"]),
  ownershipProofData: z.record(z.any()),
  verificationTransactionHash: z.string().optional(),
  projectDescription: z.string().optional(),
  projectWebsite: z.string().url().optional(),
  projectSocialLinks: z.record(z.string()).optional(),
  projectLogoUrl: z.string().url().optional(),
  vanitySlugRequested: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, "Vanity slug must contain only lowercase letters, numbers, and hyphens")
});

/**
 * GET /api/projects
 * Get all projects with optional filtering
 */
router.get("/", async (req, res) => {
  try {
    const { 
      ownerWallet, 
      issuerWallet, 
      chain, 
      claimStatus, 
      limit = "50", 
      offset = "0" 
    } = req.query;
    
    let projects = [];
    
    if (ownerWallet && typeof ownerWallet === "string") {
      projects = await storage.getDevtoolsProjectsByOwner(ownerWallet);
    } else if (issuerWallet && typeof issuerWallet === "string") {
      projects = await storage.getProjectsByIssuerWallet(issuerWallet);
    } else if (claimStatus && typeof claimStatus === "string") {
      if (claimStatus === "unclaimed") {
        projects = await storage.getUnclaimedProjects(parseInt(limit as string));
      } else {
        projects = await storage.getDevtoolsProjects();
        projects = projects.filter(p => p.claim_status === claimStatus);
      }
    } else {
      projects = await storage.getDevtoolsProjects();
    }
    
    // Apply pagination
    const limitNum = Math.min(parseInt(limit as string), 100);
    const offsetNum = parseInt(offset as string);
    const paginatedProjects = projects.slice(offsetNum, offsetNum + limitNum);
    
    res.json({
      success: true,
      projects: paginatedProjects,
      total: projects.length,
      limit: limitNum,
      offset: offsetNum
    });
    
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).json({
      error: "Failed to fetch projects"
    });
  }
});

/**
 * GET /api/projects/:id
 * Get a specific project by ID
 */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const project = await storage.getDevtoolsProject(id);
    
    if (!project) {
      return res.status(404).json({
        error: "Project not found"
      });
    }
    
    // Get wallet links for this project
    const walletLinks = await storage.getWalletProjectLinksByProject(id);
    
    res.json({
      success: true,
      project: {
        ...project,
        walletLinks
      }
    });
    
  } catch (error) {
    console.error("Error fetching project:", error);
    res.status(500).json({
      error: "Failed to fetch project"
    });
  }
});

/**
 * GET /api/projects/vanity/:slug
 * Get a project by vanity slug
 */
router.get("/vanity/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    
    const project = await storage.getProjectByVanitySlug(slug);
    
    if (!project) {
      return res.status(404).json({
        error: "Project not found"
      });
    }
    
    // Get wallet links for this project
    const walletLinks = await storage.getWalletProjectLinksByProject(project.id);
    
    res.json({
      success: true,
      project: {
        ...project,
        walletLinks
      }
    });
    
  } catch (error) {
    console.error("Error fetching project by vanity slug:", error);
    res.status(500).json({
      error: "Failed to fetch project"
    });
  }
});

/**
 * POST /api/projects
 * Create a new project
 */
router.post("/", async (req, res) => {
  try {
    const body = createProjectSchema.parse(req.body);
    
    // Check if vanity slug is already taken
    if (body.vanitySlug) {
      const existingProject = await storage.getProjectByVanitySlug(body.vanitySlug);
      if (existingProject) {
        return res.status(400).json({
          error: "Vanity slug is already taken"
        });
      }
    }
    
    // Check if project with same issuer and taxon already exists
    if (body.issuer_wallet && body.discovered_from_chain) {
      const existingProject = await storage.checkProjectExists(
        body.discovered_from_chain,
        body.issuer_wallet,
        body.nft_token_taxon !== null && body.nft_token_taxon !== undefined ? body.nft_token_taxon : undefined
      );
      
      if (existingProject) {
        return res.status(400).json({
          error: "Project with this issuer and taxon already exists",
          existingProject: existingProject
        });
      }
    }
    
    const project = await storage.createDevtoolsProject(body);
    
    // Add project managers if specified
    if (body.projectManagers && body.projectManagers.length > 0) {
      for (const managerWallet of body.projectManagers) {
        await storage.addProjectManager(project.id, managerWallet);
      }
    }
    
    res.status(201).json({
      success: true,
      message: "Project created successfully",
      project
    });
    
  } catch (error) {
    console.error("Error creating project:", error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid request data",
        details: error.errors
      });
    }
    
    res.status(500).json({
      error: "Failed to create project"
    });
  }
});

/**
 * PUT /api/projects/:id
 * Update a project (requires ownership verification)
 */
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const body = updateProjectSchema.parse(req.body);
    const { requestingWallet } = req.query;
    
    if (!requestingWallet || typeof requestingWallet !== "string") {
      return res.status(400).json({
        error: "Requesting wallet address is required"
      });
    }
    
    // Get project
    const project = await storage.getDevtoolsProject(id);
    if (!project) {
      return res.status(404).json({
        error: "Project not found"
      });
    }
    
    // Verify authorization - only owner, issuer, or project managers can edit
    const isOwner = project.ownerWalletAddress === requestingWallet;
    const isIssuer = project.issuer_wallet === requestingWallet;
    const isManager = project.project_managers?.includes(requestingWallet);
    
    if (!isOwner && !isIssuer && !isManager) {
      return res.status(403).json({
        error: "Unauthorized - only project owner, issuer, or managers can edit this project"
      });
    }
    
    // Check if vanity slug is already taken (if changing)
    if (body.vanitySlug && body.vanitySlug !== project.vanity_slug) {
      const existingProject = await storage.getProjectByVanitySlug(body.vanitySlug);
      if (existingProject) {
        return res.status(400).json({
          error: "Vanity slug is already taken"
        });
      }
    }
    
    const updatedProject = await storage.updateDevtoolsProject(id, body);
    
    res.json({
      success: true,
      message: "Project updated successfully",
      project: updatedProject
    });
    
  } catch (error) {
    console.error("Error updating project:", error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid request data",
        details: error.errors
      });
    }
    
    res.status(500).json({
      error: "Failed to update project"
    });
  }
});

/**
 * POST /api/projects/:id/claim
 * Claim ownership of a project
 */
router.post("/:id/claim", async (req, res) => {
  try {
    const { id } = req.params;
    const { claimantWallet } = req.body;
    
    if (!claimantWallet || typeof claimantWallet !== "string") {
      return res.status(400).json({
        error: "Claimant wallet address is required"
      });
    }
    
    // Get project
    const project = await storage.getDevtoolsProject(id);
    if (!project) {
      return res.status(404).json({
        error: "Project not found"
      });
    }
    
    // Check if project is claimable
    if (project.claim_status !== "unclaimed") {
      return res.status(400).json({
        error: "Project is not available for claiming"
      });
    }
    
    // Claim project
    const claimedProject = await storage.claimProject(id, claimantWallet);
    
    res.json({
      success: true,
      message: "Project claimed successfully",
      project: claimedProject
    });
    
  } catch (error) {
    console.error("Error claiming project:", error);
    res.status(500).json({
      error: "Failed to claim project"
    });
  }
});

/**
 * POST /api/projects/claims
 * Submit a project claim request
 */
router.post("/claims", async (req, res) => {
  try {
    const body = claimProjectSchema.parse(req.body);
    
    // Check if claim already exists for this issuer + taxon
    const existingClaims = await storage.getProjectClaimsByIssuer(body.issuerWallet);
    const duplicateClaim = existingClaims.find(claim => 
      claim.nft_token_taxon === body.nftTokenTaxon && 
      claim.chain === body.chain &&
      claim.status === "pending"
    );
    
    if (duplicateClaim) {
      return res.status(400).json({
        error: "A pending claim already exists for this project"
      });
    }
    
    // Check if vanity slug is available
    const existingProject = await storage.getProjectByVanitySlug(body.vanitySlugRequested);
    if (existingProject) {
      return res.status(400).json({
        error: "Requested vanity slug is already taken"
      });
    }
    
    // Create claim
    const claim = await storage.createProjectClaim({
      claimed_project_name: `Project ${body.issuerWallet}${body.nftTokenTaxon ? ` (Taxon ${body.nftTokenTaxon})` : ''}`,
      vanity_slug_requested: body.vanitySlugRequested,
      chain: body.chain,
      issuer_wallet: body.issuerWallet,
      nft_token_taxon: body.nftTokenTaxon,
      claimant_wallet: body.claimantWallet,
      claimant_chain: body.claimantChain,
      ownership_proof_type: body.ownershipProofType,
      ownership_proof_data: body.ownershipProofData,
      verification_transaction_hash: body.verificationTransactionHash,
      project_description: body.projectDescription,
      project_website: body.projectWebsite,
      project_social_links: body.projectSocialLinks || {},
      project_logo_url: body.projectLogoUrl
    });
    
    res.status(201).json({
      success: true,
      message: "Project claim submitted successfully",
      claim
    });
    
  } catch (error) {
    console.error("Error creating project claim:", error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid request data",
        details: error.errors
      });
    }
    
    res.status(500).json({
      error: "Failed to submit project claim"
    });
  }
});

/**
 * POST /api/projects/claims/batch
 * Submit multiple project claim requests at once
 */
router.post("/claims/batch", async (req, res) => {
  try {
    const { claims } = req.body;
    
    if (!claims || !Array.isArray(claims) || claims.length === 0) {
      return res.status(400).json({
        error: "Claims array is required and must not be empty"
      });
    }
    
    if (claims.length > 50) {
      return res.status(400).json({
        error: "Cannot submit more than 50 claims at once"
      });
    }
    
    console.log(`📦 [BATCH-CLAIM] Processing ${claims.length} project claims...`);
    
    const results: any[] = [];
    const errors: any[] = [];
    
    for (let i = 0; i < claims.length; i++) {
      try {
        const body = claimProjectSchema.parse(claims[i]);
        
        // Check if claim already exists for this issuer + taxon
        const existingClaims = await storage.getProjectClaimsByIssuer(body.issuerWallet);
        const duplicateClaim = existingClaims.find(claim => 
          claim.nft_token_taxon === body.nftTokenTaxon && 
          claim.chain === body.chain &&
          claim.status === "pending"
        );
        
        if (duplicateClaim) {
          errors.push({
            index: i,
            issuerWallet: body.issuerWallet,
            taxon: body.nftTokenTaxon,
            error: "A pending claim already exists for this project"
          });
          continue;
        }
        
        // Check if vanity slug is available
        const existingProject = await storage.getProjectByVanitySlug(body.vanitySlugRequested);
        if (existingProject) {
          // Auto-generate unique slug by appending number
          const baseSlug = body.vanitySlugRequested;
          let attempt = 1;
          let uniqueSlug = `${baseSlug}-${attempt}`;
          
          while (await storage.getProjectByVanitySlug(uniqueSlug)) {
            attempt++;
            uniqueSlug = `${baseSlug}-${attempt}`;
            if (attempt > 100) break; // Safety limit
          }
          
          body.vanitySlugRequested = uniqueSlug;
          console.log(`⚠️ [BATCH-CLAIM] Slug taken, using: ${uniqueSlug}`);
        }
        
        // Create claim
        const claim = await storage.createProjectClaim({
          claimed_project_name: `Project ${body.issuerWallet}${body.nftTokenTaxon ? ` (Taxon ${body.nftTokenTaxon})` : ''}`,
          vanity_slug_requested: body.vanitySlugRequested,
          chain: body.chain,
          issuer_wallet: body.issuerWallet,
          nft_token_taxon: body.nftTokenTaxon,
          claimant_wallet: body.claimantWallet,
          claimant_chain: body.claimantChain,
          ownership_proof_type: body.ownershipProofType,
          ownership_proof_data: body.ownershipProofData,
          verification_transaction_hash: body.verificationTransactionHash,
          project_description: body.projectDescription,
          project_website: body.projectWebsite,
          project_social_links: body.projectSocialLinks || {},
          project_logo_url: body.projectLogoUrl
        });
        
        results.push(claim);
        console.log(`✅ [BATCH-CLAIM] ${i + 1}/${claims.length}: Created claim for ${body.issuerWallet} (Taxon ${body.nftTokenTaxon})`);
        
      } catch (error) {
        console.error(`❌ [BATCH-CLAIM] Error processing claim ${i}:`, error);
        errors.push({
          index: i,
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
    
    console.log(`🎉 [BATCH-CLAIM] Complete! Successful: ${results.length}, Failed: ${errors.length}`);
    
    res.status(201).json({
      success: true,
      message: `Batch claim submitted: ${results.length} successful, ${errors.length} failed`,
      claims: results,
      errors: errors.length > 0 ? errors : undefined,
      stats: {
        total: claims.length,
        successful: results.length,
        failed: errors.length
      }
    });
    
  } catch (error) {
    console.error("Error processing batch claim:", error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid request data",
        details: error.errors
      });
    }
    
    res.status(500).json({
      error: "Failed to process batch claim"
    });
  }
});

/**
 * GET /api/projects/claims
 * Get project claims with optional filtering
 */
router.get("/claims", async (req, res) => {
  try {
    const { status, claimantWallet, issuerWallet } = req.query;
    
    let claims = [];
    
    if (status && typeof status === "string") {
      claims = await storage.getProjectClaimsByStatus(status);
    } else if (claimantWallet && typeof claimantWallet === "string") {
      claims = await storage.getProjectClaimsByClaimant(claimantWallet);
    } else if (issuerWallet && typeof issuerWallet === "string") {
      claims = await storage.getProjectClaimsByIssuer(issuerWallet);
    } else {
      // This would need to be implemented in storage if needed
      claims = await storage.getProjectClaimsByStatus("pending");
    }
    
    res.json({
      success: true,
      claims
    });
    
  } catch (error) {
    console.error("Error fetching project claims:", error);
    res.status(500).json({
      error: "Failed to fetch project claims"
    });
  }
});

/**
 * POST /api/projects/claims/:id/approve
 * Approve a project claim (admin only) with automatic Bithomp data enrichment and service initialization
 */
router.post("/claims/:id/approve", async (req, res) => {
  try {
    const { id } = req.params;
    const { reviewedBy, approvalNotes } = req.body;
    
    if (!reviewedBy || typeof reviewedBy !== "string") {
      return res.status(400).json({
        error: "Reviewer ID is required"
      });
    }
    
    console.log(`🚀 Starting enhanced project claim approval for claim ${id}...`);
    
    const approvedClaim = await storage.approveProjectClaim(id, reviewedBy, approvalNotes);
    
    if (!approvedClaim) {
      return res.status(404).json({
        error: "Claim not found"
      });
    }
    
    // 🔒 Idempotency check: Check if project already exists for this claim
    let newProject = approvedClaim.project_id 
      ? await storage.getDevtoolsProject(approvedClaim.project_id)
      : null;
    
    if (newProject) {
      console.log(`✅ Project already exists from previous approval: ${newProject.id}`);
      
      // Skip to enhancement steps with existing project
    } else {
      // Create the basic project from the approved claim
      const projectData = {
        name: approvedClaim.claimed_project_name,
        description: approvedClaim.project_description || "",
        ownerWalletAddress: approvedClaim.claimant_wallet,
        projectType: "imported" as const,
        asset_type: "nft" as const, // Most claimed projects are NFT collections
        issuer_wallet: approvedClaim.issuer_wallet,
        vanity_slug: approvedClaim.vanity_slug_requested,
        nft_token_taxon: approvedClaim.nft_token_taxon,
        discovered_from_chain: approvedClaim.chain,
        discovered_from_issuer: approvedClaim.issuer_wallet,
        claim_status: "claimed" as const,
        website_url: approvedClaim.project_website,
        social_links: approvedClaim.project_social_links || {},
        logo_url: approvedClaim.project_logo_url
      };
      
      newProject = await storage.createDevtoolsProject(projectData);
      console.log(`✅ Basic project created: ${newProject.id}`);
      
      // Update the claim with the project ID for future idempotency
      await storage.updateProjectClaim(approvedClaim.id, { project_id: newProject.id });
    }
    
    // Initialize enhancement tracking (shared for both new and existing projects)
    const enhancementResults = newProject && newProject.id ? {
      bithompDataFetched: !!newProject.bithomp_data_fetched_at,
      bithompDataStored: !!newProject.bithomp_collection_name,
      servicesInitialized: false, // We'll check and try to initialize
      configurationsInitialized: false,
      errors: [] as string[],
      warnings: newProject.bithomp_data_fetched_at ? ["Project already exists - checking enhancements"] : []
    } : {
      bithompDataFetched: false,
      bithompDataStored: false,
      servicesInitialized: false,
      configurationsInitialized: false,
      errors: [] as string[],
      warnings: [] as string[]
    };
    
    // Step 1: Fetch and store Bithomp collection data with comprehensive error handling
    if (approvedClaim.nft_token_taxon !== null && approvedClaim.nft_token_taxon !== undefined && approvedClaim.issuer_wallet) {
      try {
        // Check rate limiting first
        const rateLimitKey = `project_claim:${approvedClaim.issuer_wallet}:${approvedClaim.nft_token_taxon}`;
        const rateLimitOk = await RateLimitProtection.checkRateLimit(rateLimitKey);
        
        if (!rateLimitOk) {
          enhancementResults.warnings.push("Rate limit exceeded - using cached or basic data");
        }
        
        console.log(`📊 Fetching Bithomp data with enhanced error handling for ${approvedClaim.issuer_wallet}:${approvedClaim.nft_token_taxon}...`);
        
        const bithompResult = await getBithompCollectionWithFallbacks(approvedClaim.issuer_wallet, approvedClaim.nft_token_taxon);
        
        if (bithompResult.success && bithompResult.data?.collection) {
          const collection = bithompResult.data.collection;
          const dataSource = bithompResult.source;
          
          console.log(`✅ Bithomp data retrieved from ${dataSource} for collection: ${collection.name || 'Unnamed'}`);
          enhancementResults.bithompDataFetched = true;
          
          // Prepare enhanced project data with Bithomp information
          const bithompEnhancedData = {
            // Update basic info with Bithomp data if better and not from fallback
            name: (collection.name && dataSource !== 'fallback_basic') ? collection.name : projectData.name,
            description: (collection.description && dataSource !== 'fallback_basic') ? collection.description : projectData.description,
            logo_url: (collection.image && dataSource !== 'fallback_basic') ? collection.image : projectData.logo_url,
            
            // Store Bithomp-specific fields
            bithomp_collection_name: collection.name,
            bithomp_collection_description: collection.description,
            bithomp_verified: collection.verified || false,
            bithomp_floor_price: collection.floorPrice?.toString(),
            bithomp_floor_price_usd: collection.floorPriceUsd?.toString(),
            bithomp_total_nfts: collection.totalNFTs,
            bithomp_owners_count: collection.owners,
            bithomp_volume_24h: collection.volume24h?.toString(),
            bithomp_volume_24h_usd: collection.volume24hUsd?.toString(),
            bithomp_collection_image: collection.image,
            bithomp_metadata: collection, // Store the entire Bithomp collection object
            
            // Enhanced data source tracking
            bithomp_data_fetched_at: new Date(),
            bithomp_data_source: dataSource,
            auto_bithomp_enriched: true,
            
            // Store full collection metadata with source information
            custom_collection_metadata: {
              bithomp: collection,
              enrichedAt: new Date().toISOString(),
              enrichmentSource: "claim_approval_auto_enhanced",
              dataSource: dataSource,
              reliability: dataSource === 'bithomp_api' ? 'high' : 
                          dataSource === 'cache' ? 'high' :
                          dataSource.startsWith('fallback') ? 'medium' : 'low'
            }
          };
          
          // Update project with Bithomp data
          await storage.updateDevtoolsProject(newProject.id, bithompEnhancedData);
          console.log(`✅ Project enriched with ${dataSource} data`);
          enhancementResults.bithompDataStored = true;
          
          // Add source information to enhancement results
          enhancementResults.warnings.push(`Data fetched from: ${dataSource}`);
          
        } else {
          const errorMsg = `Enhanced Bithomp fetch failed: ${bithompResult.error || 'All methods failed'}`;
          console.log(`⚠️ ${errorMsg}`);
          enhancementResults.errors.push(errorMsg);
          
          // Store comprehensive error information
          await storage.updateDevtoolsProject(newProject.id, {
            bithomp_fetch_error: `Enhanced fetch failed: ${bithompResult.error || 'All fallback methods exhausted'}`,
            bithomp_data_fetched_at: new Date(),
            bithomp_data_source: bithompResult.source,
            auto_bithomp_enriched: false,
            custom_collection_metadata: {
              error: bithompResult.error,
              attemptedAt: new Date().toISOString(),
              fallbacksUsed: true,
              source: bithompResult.source
            }
          });
        }
        
      } catch (bithompError) {
        const errorMsg = `Enhanced Bithomp integration error: ${bithompError instanceof Error ? bithompError.message : 'Unknown error'}`;
        console.error(`❌ ${errorMsg}`);
        enhancementResults.errors.push(errorMsg);
        
        // Store comprehensive error information
        await storage.updateDevtoolsProject(newProject.id, {
          bithomp_fetch_error: errorMsg,
          bithomp_data_fetched_at: new Date(),
          bithomp_data_source: "error",
          auto_bithomp_enriched: false,
          custom_collection_metadata: {
            error: errorMsg,
            errorAt: new Date().toISOString(),
            enhancedHandlerUsed: true
          }
        });
      }
    } else {
      enhancementResults.warnings.push("No NFT taxon provided - skipping Bithomp data fetch");
    }
    
    // Step 2: Initialize project services
    try {
      console.log(`🔧 Initializing services for project ${newProject.id}...`);
      
      const serviceConfig = {
        projectId: newProject.id,
        issuerWallet: approvedClaim.issuer_wallet,
        taxon: approvedClaim.nft_token_taxon || undefined,
        chain: approvedClaim.chain,
        projectType: 'nft' as const // Most claimed projects are NFT collections
      };
      
      const serviceResult = await initializeProjectServices(serviceConfig);
      
      if (serviceResult.success) {
        console.log(`✅ Services initialized: ${serviceResult.initializedServices.join(', ')}`);
        enhancementResults.servicesInitialized = true;
      } else {
        console.log(`⚠️ Service initialization had errors: ${serviceResult.errors.join(', ')}`);
        enhancementResults.errors.push(...serviceResult.errors);
      }
      
      if (serviceResult.warnings.length > 0) {
        enhancementResults.warnings.push(...serviceResult.warnings);
      }
      
    } catch (serviceError) {
      const errorMsg = `Service initialization error: ${serviceError instanceof Error ? serviceError.message : 'Unknown error'}`;
      console.error(`❌ ${errorMsg}`);
      enhancementResults.errors.push(errorMsg);
    }
    
    // Step 3: Initialize project configurations
    try {
      console.log(`⚙️ Initializing configurations for project ${newProject.id}...`);
      
      const configResult = await initializeProjectConfigurations({
        projectId: newProject.id,
        issuerWallet: approvedClaim.issuer_wallet,
        taxon: approvedClaim.nft_token_taxon || undefined,
        chain: approvedClaim.chain,
        projectType: 'nft' as const
      });
      
      if (configResult.success) {
        console.log(`✅ Configurations initialized: ${configResult.initializedServices.join(', ')}`);
        enhancementResults.configurationsInitialized = true;
      } else {
        console.log(`⚠️ Configuration initialization had errors: ${configResult.errors.join(', ')}`);
        enhancementResults.errors.push(...configResult.errors);
      }
      
      if (configResult.warnings.length > 0) {
        enhancementResults.warnings.push(...configResult.warnings);
      }
      
    } catch (configError) {
      const errorMsg = `Configuration initialization error: ${configError instanceof Error ? configError.message : 'Unknown error'}`;
      console.error(`❌ ${errorMsg}`);
      enhancementResults.errors.push(errorMsg);
    }
    
    // Get the final enhanced project
    const enhancedProject = await storage.getDevtoolsProject(newProject.id);
    
    // Determine overall success
    const overallSuccess = enhancementResults.errors.length === 0;
    const partialSuccess = enhancementResults.bithompDataStored || enhancementResults.servicesInitialized;
    
    // Step 4: Trigger asset ingestion for the approved project
    let ingestionJobIds: string[] = [];
    try {
      console.log(`🔽 Triggering asset ingestion for approved project: ${enhancedProject.id}`);
      
      ingestionJobIds = await assetIngestionService.triggerProjectIngestion(
        enhancedProject, 
        reviewedBy
      );
      
      if (ingestionJobIds.length > 0) {
        console.log(`✅ Asset ingestion triggered: ${ingestionJobIds.length} jobs created`);
        enhancementResults.warnings.push(`Asset ingestion triggered: ${ingestionJobIds.join(', ')}`);
      } else {
        console.log(`⚠️ No asset ingestion jobs created (project may not require asset downloads)`);
      }
      
    } catch (ingestionError) {
      const errorMsg = `Asset ingestion trigger failed: ${ingestionError instanceof Error ? ingestionError.message : 'Unknown error'}`;
      console.error(`❌ ${errorMsg}`);
      enhancementResults.warnings.push(errorMsg);
      // Don't fail the entire approval process if asset ingestion fails
    }
    
    console.log(`🎉 Project claim approval completed with ${overallSuccess ? 'full' : partialSuccess ? 'partial' : 'basic'} success`);
    
    res.json({
      success: true,
      message: overallSuccess 
        ? "Project claim approved with full enhancement" 
        : partialSuccess 
          ? "Project claim approved with partial enhancement"
          : "Project claim approved (basic setup only)",
      claim: approvedClaim,
      project: enhancedProject,
      enhancement: {
        ...enhancementResults,
        overallSuccess,
        partialSuccess,
        enhancementLevel: overallSuccess ? 'full' : partialSuccess ? 'partial' : 'basic'
      },
      ingestion: {
        triggered: ingestionJobIds.length > 0,
        jobIds: ingestionJobIds,
        jobCount: ingestionJobIds.length
      }
    });
    
  } catch (error) {
    console.error("Error in enhanced project claim approval:", error);
    res.status(500).json({
      error: "Failed to approve project claim",
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/projects/claims/:id/reject
 * Reject a project claim (admin only)
 */
router.post("/claims/:id/reject", async (req, res) => {
  try {
    const { id } = req.params;
    const { reviewedBy, rejectionReason } = req.body;
    
    if (!reviewedBy || typeof reviewedBy !== "string") {
      return res.status(400).json({
        error: "Reviewer ID is required"
      });
    }
    
    if (!rejectionReason || typeof rejectionReason !== "string") {
      return res.status(400).json({
        error: "Rejection reason is required"
      });
    }
    
    const rejectedClaim = await storage.rejectProjectClaim(id, reviewedBy, rejectionReason);
    
    if (!rejectedClaim) {
      return res.status(404).json({
        error: "Claim not found"
      });
    }
    
    res.json({
      success: true,
      message: "Project claim rejected",
      claim: rejectedClaim
    });
    
  } catch (error) {
    console.error("Error rejecting project claim:", error);
    res.status(500).json({
      error: "Failed to reject project claim"
    });
  }
});

/**
 * DELETE /api/projects/:id
 * Delete a project (requires ownership verification)
 */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { requestingWallet } = req.query;
    
    if (!requestingWallet || typeof requestingWallet !== "string") {
      return res.status(400).json({
        error: "Requesting wallet address is required"
      });
    }
    
    // Get project
    const project = await storage.getDevtoolsProject(id);
    if (!project) {
      return res.status(404).json({
        error: "Project not found"
      });
    }
    
    // Only owner can delete
    if (project.ownerWalletAddress !== requestingWallet) {
      return res.status(403).json({
        error: "Unauthorized - only project owner can delete this project"
      });
    }
    
    await storage.deleteDevtoolsProject(id);
    
    res.json({
      success: true,
      message: "Project deleted successfully"
    });
    
  } catch (error) {
    console.error("Error deleting project:", error);
    res.status(500).json({
      error: "Failed to delete project"
    });
  }
});

// ============== PROJECT WALLETS ==============

/**
 * GET /api/projects/:projectId/wallets
 * Get all wallets for a project
 */
router.get("/:projectId/wallets", async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const wallets = await storage.getProjectWallets(projectId);
    return res.json({
      success: true,
      wallets
    });
  } catch (error) {
    console.error("Error fetching project wallets:", error);
    return res.status(500).json({ error: "Failed to fetch project wallets" });
  }
});

/**
 * POST /api/projects/:projectId/wallets
 * Add a wallet to a project
 */
router.post("/:projectId/wallets", async (req, res) => {
  try {
    const { projectId } = req.params;
    const { requestingWallet } = req.query;
    
    // Verify project ownership
    const project = await storage.getDevtoolsProject(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    
    if (requestingWallet && project.ownerWalletAddress !== requestingWallet) {
      const isManager = project.project_managers?.includes(requestingWallet as string);
      if (!isManager) {
        return res.status(403).json({ error: "Access denied" });
      }
    }
    
    // Validate request body
    const parsed = insertProjectWalletSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid wallet data", details: parsed.error.issues });
    }
    
    // Check if wallet already exists for this project
    const existing = await storage.getProjectWalletByAddress(projectId, parsed.data.address, parsed.data.chain);
    if (existing) {
      return res.status(409).json({ error: "Wallet already exists for this project" });
    }
    
    const walletData: any = {
      ...parsed.data,
      projectId
    };
    const wallet = await storage.createProjectWallet(walletData);
    
    return res.status(201).json({
      success: true,
      wallet
    });
  } catch (error) {
    console.error("Error adding project wallet:", error);
    return res.status(500).json({ error: "Failed to add project wallet" });
  }
});

/**
 * DELETE /api/projects/:projectId/wallets/:walletId
 * Delete a project wallet
 */
router.delete("/:projectId/wallets/:walletId", async (req, res) => {
  try {
    const { projectId, walletId } = req.params;
    const { requestingWallet } = req.query;
    
    // Verify project ownership
    const project = await storage.getDevtoolsProject(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    
    if (requestingWallet && project.ownerWalletAddress !== requestingWallet) {
      const isManager = project.project_managers?.includes(requestingWallet as string);
      if (!isManager) {
        return res.status(403).json({ error: "Access denied" });
      }
    }
    
    await storage.deleteProjectWallet(walletId);
    return res.json({ success: true });
  } catch (error) {
    console.error("Error deleting project wallet:", error);
    return res.status(500).json({ error: "Failed to delete project wallet" });
  }
});

// ============== PROJECT SERVICES ==============

/**
 * GET /api/projects/:projectId/services
 * Get all services for a project
 */
router.get("/:projectId/services", async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const services = await storage.getProjectServices(projectId);
    return res.json({
      success: true,
      services
    });
  } catch (error) {
    console.error("Error fetching project services:", error);
    return res.status(500).json({ error: "Failed to fetch project services" });
  }
});

/**
 * POST /api/projects/:projectId/services/:service/toggle
 * Toggle a service for a project
 */
router.post("/:projectId/services/:service/toggle", async (req, res) => {
  try {
    const { projectId, service } = req.params;
    const { enabled } = req.body;
    const { requestingWallet } = req.query;
    
    // Verify project ownership
    const project = await storage.getDevtoolsProject(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    
    if (requestingWallet && project.ownerWalletAddress !== requestingWallet) {
      const isManager = project.project_managers?.includes(requestingWallet as string);
      if (!isManager) {
        return res.status(403).json({ error: "Access denied" });
      }
    }
    
    const result = await storage.toggleProjectService(projectId, service, enabled);
    return res.json({
      success: true,
      service: result
    });
  } catch (error) {
    console.error("Error toggling project service:", error);
    return res.status(500).json({ error: "Failed to toggle project service" });
  }
});

// ============== TOKEN CONFIGURATION ==============

/**
 * GET /api/projects/:projectId/token-configs
 * Get token configurations for a project
 */
router.get("/:projectId/token-configs", async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const configs = await storage.getTokenConfigurations(projectId);
    return res.json({
      success: true,
      configs
    });
  } catch (error) {
    console.error("Error fetching token configurations:", error);
    return res.status(500).json({ error: "Failed to fetch token configurations" });
  }
});

/**
 * POST /api/projects/:projectId/token-configs
 * Create or update token configuration
 */
router.post("/:projectId/token-configs", async (req, res) => {
  try {
    const { projectId } = req.params;
    const { requestingWallet } = req.query;
    
    // Verify project ownership
    const project = await storage.getDevtoolsProject(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    
    if (requestingWallet && project.ownerWalletAddress !== requestingWallet) {
      const isManager = project.project_managers?.includes(requestingWallet as string);
      if (!isManager) {
        return res.status(403).json({ error: "Access denied" });
      }
    }
    
    // Validate request body
    const parsed = insertTokenConfigurationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid token configuration", details: parsed.error.issues });
    }
    
    // Check if config already exists for this chain
    const existing = await storage.getTokenConfiguration(projectId, parsed.data.chain);
    
    if (existing) {
      // Update existing
      const updated = await storage.updateTokenConfiguration(existing.id, parsed.data);
      return res.json({
        success: true,
        config: updated
      });
    } else {
      // Create new
      const configData: any = {
        ...parsed.data,
        projectId
      };
      const config = await storage.createTokenConfiguration(configData);
      return res.status(201).json({
        success: true,
        config
      });
    }
  } catch (error) {
    console.error("Error saving token configuration:", error);
    return res.status(500).json({ error: "Failed to save token configuration" });
  }
});

// ============== NFT CONFIGURATION ==============

/**
 * GET /api/projects/:projectId/nft-configs
 * Get NFT configurations for a project
 */
router.get("/:projectId/nft-configs", async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const configs = await storage.getNftConfigurations(projectId);
    return res.json({
      success: true,
      configs
    });
  } catch (error) {
    console.error("Error fetching NFT configurations:", error);
    return res.status(500).json({ error: "Failed to fetch NFT configurations" });
  }
});

/**
 * POST /api/projects/:projectId/nft-configs
 * Create or update NFT configuration
 */
router.post("/:projectId/nft-configs", async (req, res) => {
  try {
    const { projectId } = req.params;
    const { requestingWallet } = req.query;
    
    // Verify project ownership
    const project = await storage.getDevtoolsProject(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    
    if (requestingWallet && project.ownerWalletAddress !== requestingWallet) {
      const isManager = project.project_managers?.includes(requestingWallet as string);
      if (!isManager) {
        return res.status(403).json({ error: "Access denied" });
      }
    }
    
    // Validate request body
    const parsed = insertNftConfigurationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid NFT configuration", details: parsed.error.issues });
    }
    
    // Check if config already exists for this chain
    const existing = await storage.getNftConfiguration(projectId, parsed.data.chain);
    
    if (existing) {
      // Update existing
      const updated = await storage.updateNftConfiguration(existing.id, parsed.data);
      return res.json({
        success: true,
        config: updated
      });
    } else {
      // Create new
      const configData: any = {
        ...parsed.data,
        projectId
      };
      const config = await storage.createNftConfiguration(configData);
      return res.status(201).json({
        success: true,
        config
      });
    }
  } catch (error) {
    console.error("Error saving NFT configuration:", error);
    return res.status(500).json({ error: "Failed to save NFT configuration" });
  }
});

// ============== XRPL TOKEN CREATION FLOW ==============

/**
 * POST /api/projects/:projectId/xrpl-token/initiate
 * Initiate XRPL token creation process
 */
router.post("/:projectId/xrpl-token/initiate", async (req, res) => {
  try {
    const { projectId } = req.params;
    const { issuerWallet, fundingWallet, tokenCode, tokenName, totalSupply, decimals, requestingWallet } = req.body;
    
    // Verify project ownership
    const project = await storage.getDevtoolsProject(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    
    if (requestingWallet && project.ownerWalletAddress !== requestingWallet) {
      const isManager = project.project_managers?.includes(requestingWallet as string);
      if (!isManager) {
        return res.status(403).json({ error: "Access denied" });
      }
    }
    
    // Create token configuration
    const tokenConfig = await storage.createTokenConfiguration({
      projectId,
      chain: "xrpl",
      standard: "XRPL",
      name: tokenName,
      symbol: tokenCode,
      decimals,
      totalSupply,
      issuerAddress: issuerWallet,
      fundingAddress: fundingWallet,
      status: "initiated"
    });
    
    return res.json({
      success: true,
      configId: tokenConfig.id,
      nextStep: "wallet_preparation",
      instructions: "Fund the issuer wallet with 15 XRP for reserves"
    });
  } catch (error) {
    console.error("Error initiating XRPL token:", error);
    return res.status(500).json({ error: "Failed to initiate XRPL token creation" });
  }
});

/**
 * POST /api/projects/:projectId/xrpl-token/update-step
 * Update XRPL token creation step
 */
router.post("/:projectId/xrpl-token/update-step", async (req, res) => {
  try {
    const { projectId } = req.params;
    const { configId, step, transactionHash, metadata, requestingWallet } = req.body;
    
    // Verify project ownership
    const project = await storage.getDevtoolsProject(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    
    if (requestingWallet && project.ownerWalletAddress !== requestingWallet) {
      const isManager = project.project_managers?.includes(requestingWallet as string);
      if (!isManager) {
        return res.status(403).json({ error: "Access denied" });
      }
    }
    
    // Update token configuration
    const updated = await storage.updateTokenConfiguration(configId, {
      status: step === "completed" ? "deployed" : "in_progress",
      deploymentTxHash: transactionHash
    });
    
    return res.json({
      success: true,
      config: updated,
      nextStep: getNextXRPLStep(step)
    });
  } catch (error) {
    console.error("Error updating XRPL token step:", error);
    return res.status(500).json({ error: "Failed to update XRPL token creation step" });
  }
});

// Helper function to determine next XRPL token creation step
function getNextXRPLStep(currentStep: string): string | null {
  const steps = [
    "wallet_preparation",
    "account_settings",
    "trustline_creation",
    "token_issuance",
    "amm_pool_creation",
    "completed"
  ];
  
  const currentIndex = steps.indexOf(currentStep);
  if (currentIndex === -1 || currentIndex === steps.length - 1) {
    return null;
  }
  
  return steps[currentIndex + 1];
}

export default router;