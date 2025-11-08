import { Router } from "express";
import { z } from "zod";
import { storage } from "./storage";

const router = Router();

// Validation schemas
const discoverProjectSchema = z.object({
  issuerWallet: z.string().min(1, "Issuer wallet is required"),
  chain: z.enum(["xrpl", "xrp", "ethereum", "eth", "solana", "sol", "polygon", "matic", "bsc", "arbitrum", "optimism"]),
  nftTokenTaxon: z.number().min(0).optional(),
  transactionHash: z.string().optional(),
  projectName: z.string().optional(),
  projectDescription: z.string().optional()
});

/**
 * GET /api/discovery
 * Search for discoverable projects on various chains
 */
router.get("/", async (req, res) => {
  try {
    const { 
      chain, 
      issuer, 
      limit = "20",
      includeUnclaimed = "true"
    } = req.query;
    
    let discoverableProjects = [];
    
    if (chain && issuer) {
      // Search for specific issuer on specific chain
      const projects = await storage.getProjectsByIssuerWallet(issuer as string);
      discoverableProjects = projects.filter(p => 
        p.discovered_from_chain === chain ||
        p.selectedChains?.includes(chain as string)
      );
    } else if (includeUnclaimed === "true") {
      // Get unclaimed projects for discovery
      discoverableProjects = await storage.getUnclaimedProjects(parseInt(limit as string));
    } else {
      // Get all auto-discovered projects
      const allProjects = await storage.getDevtoolsProjects();
      discoverableProjects = allProjects.filter(p => p.auto_discovered);
    }
    
    // Format projects for discovery interface
    const formattedProjects = discoverableProjects.map(project => ({
      id: project.id,
      name: project.name,
      description: project.description,
      issuerWallet: project.issuer_wallet,
      chain: project.discovered_from_chain,
      nftTokenTaxon: project.nft_token_taxon,
      vanitySlug: project.vanity_slug,
      claimStatus: project.claim_status,
      autoDiscovered: project.auto_discovered,
      ownerWallet: project.ownerWalletAddress,
      logoUrl: project.logo_url,
      websiteUrl: project.website_url,
      socialLinks: project.social_links,
      createdAt: project.createdAt,
      projectManagers: project.project_managers,
      // Computed fields for discovery UI
      isClaimable: project.claim_status === "unclaimed",
      discoverySource: project.discovery_transaction_hash ? "transaction" : "issuer_scan"
    }));
    
    res.json({
      success: true,
      projects: formattedProjects,
      total: formattedProjects.length,
      filters: {
        chain: chain || "all",
        issuer: issuer || "all",
        includeUnclaimed: includeUnclaimed === "true"
      }
    });
    
  } catch (error) {
    console.error("Error in discovery endpoint:", error);
    res.status(500).json({
      error: "Failed to fetch discoverable projects"
    });
  }
});

/**
 * POST /api/discovery/discover
 * Manually discover a project from chain data
 */
router.post("/discover", async (req, res) => {
  try {
    const body = discoverProjectSchema.parse(req.body);
    const { 
      issuerWallet, 
      chain, 
      nftTokenTaxon, 
      transactionHash,
      projectName,
      projectDescription 
    } = body;
    
    // Check if project already exists
    const existingProject = await storage.checkProjectExists(
      chain,
      issuerWallet,
      nftTokenTaxon
    );
    
    if (existingProject) {
      return res.status(400).json({
        error: "Project already exists",
        existingProject: {
          id: existingProject.id,
          name: existingProject.name,
          vanitySlug: existingProject.vanity_slug,
          claimStatus: existingProject.claim_status
        }
      });
    }
    
    // Discover/create the project
    const discoveredProject = await storage.discoverProjectFromIssuer(
      chain,
      issuerWallet,
      nftTokenTaxon,
      transactionHash
    );
    
    if (!discoveredProject) {
      return res.status(500).json({
        error: "Failed to discover project"
      });
    }
    
    // Update with additional metadata if provided
    if (projectName || projectDescription) {
      const updatedProject = await storage.updateDevtoolsProject(discoveredProject.id, {
        name: projectName || discoveredProject.name,
        description: projectDescription || discoveredProject.description
      });
      
      res.status(201).json({
        success: true,
        message: "Project discovered successfully",
        project: updatedProject
      });
    } else {
      res.status(201).json({
        success: true,
        message: "Project discovered successfully",
        project: discoveredProject
      });
    }
    
  } catch (error) {
    console.error("Error discovering project:", error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid request data",
        details: error.errors
      });
    }
    
    res.status(500).json({
      error: "Failed to discover project"
    });
  }
});

/**
 * GET /api/discovery/parse-issuer
 * Parse an issuer address to extract potential project information
 */
router.get("/parse-issuer", async (req, res) => {
  try {
    const { issuer, chain } = req.query;
    
    if (!issuer || !chain) {
      return res.status(400).json({
        error: "Issuer and chain are required"
      });
    }
    
    let parsedData: any = {
      issuer: issuer,
      chain: chain,
      isValid: false,
      potentialProjects: []
    };
    
    // Basic validation based on chain
    switch (chain) {
      case "xrpl":
      case "xrp":
        parsedData.isValid = /^r[a-zA-Z0-9]{24,34}$/.test(issuer as string);
        break;
        
      case "ethereum":
      case "eth":
      case "polygon":
      case "bsc":
      case "arbitrum":
      case "optimism":
        parsedData.isValid = /^0x[a-fA-F0-9]{40}$/.test(issuer as string);
        break;
        
      case "solana":
      case "sol":
        parsedData.isValid = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(issuer as string);
        break;
        
      default:
        parsedData.isValid = false;
    }
    
    if (parsedData.isValid) {
      // Check for existing projects from this issuer
      const existingProjects = await storage.getProjectsByIssuerWallet(issuer as string);
      parsedData.potentialProjects = existingProjects.map(p => ({
        id: p.id,
        name: p.name,
        taxon: p.nft_token_taxon,
        vanitySlug: p.vanity_slug,
        claimStatus: p.claim_status
      }));
      
      // For XRPL, suggest potential taxon values (0, 1, 2, etc.)
      if ((chain === "xrpl" || chain === "xrp") && existingProjects.length === 0) {
        parsedData.suggestedTaxons = [0, 1, 2, 3, 4];
      }
    }
    
    res.json({
      success: true,
      parsedData
    });
    
  } catch (error) {
    console.error("Error parsing issuer:", error);
    res.status(500).json({
      error: "Failed to parse issuer address"
    });
  }
});

export default router;