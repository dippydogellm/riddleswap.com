import { Router } from "express";
import { z } from "zod";
import { storage } from "./storage";
import { insertExternalWalletSchema, insertWalletProjectLinkSchema } from "@shared/schema";

const router = Router();

// Validation schemas
const linkWalletSchema = z.object({
  walletAddress: z.string().min(1, "Wallet address is required"),
  chain: z.enum(["ethereum", "eth", "xrpl", "xrp", "solana", "sol", "polygon", "matic", "bsc", "arbitrum", "optimism"]),
  walletType: z.enum(["metamask", "phantom", "xaman", "joey", "walletconnect", "coinbase", "other"]),
  userId: z.string().min(1, "User ID is required"),
  signature: z.string().min(1, "Signature is required"),
  message: z.string().min(1, "Verification message is required")
});

const linkProjectSchema = z.object({
  walletAddress: z.string().min(1, "Wallet address is required"),
  chain: z.string().min(1, "Chain is required"),
  projectId: z.string().min(1, "Project ID is required"),
  linkType: z.enum(["issuer", "owner", "contributor", "developer", "manager"])
});

/**
 * POST /api/devtools/wallets/link
 * DEPRECATED: This endpoint is deprecated for security reasons
 * Use the secure challenge/verify flow instead
 */
router.post("/link", async (req, res) => {
  try {
    // SECURITY: This endpoint should NOT be used for direct wallet linking
    // Redirect to secure verification flow instead
    console.error('🚨 [SECURITY] Attempt to use deprecated direct linking endpoint');
    return res.status(400).json({
      error: 'Direct wallet linking is deprecated for security reasons. Use the secure challenge/verify flow.',
      redirectTo: '/api/external-wallets/challenge',
      requiredFlow: {
        step1: 'POST /api/external-wallets/challenge - Request nonce',
        step2: 'Sign message with wallet containing the nonce',
        step3: 'POST /api/external-wallets/verify - Submit signature for verification'
      }
    });
    
  } catch (error) {
    console.error("Error in deprecated wallet linking endpoint:", error);
    
    res.status(500).json({
      error: "Endpoint deprecated for security reasons"
    });
  }
});

/**
 * GET /api/external-wallet
 * Get all linked wallets for the authenticated user
 */
router.get("/", async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId || typeof userId !== "string") {
      return res.status(400).json({
        error: "User ID is required"
      });
    }
    
    const wallets = await storage.getExternalWalletsByUserId(userId);
    
    const formattedWallets = wallets.map(wallet => ({
      id: wallet.id,
      address: wallet.address,
      chain: wallet.chain,
      walletType: wallet.wallet_type,
      verified: wallet.verified,
      connectedAt: wallet.connected_at,
      lastUsed: wallet.last_used,
      linkedProjectCount: wallet.linked_project_count,
      isProjectOwner: wallet.is_project_owner
    }));
    
    res.json({
      success: true,
      wallets: formattedWallets
    });
    
  } catch (error) {
    console.error("Error fetching wallets:", error);
    res.status(500).json({
      error: "Failed to fetch linked wallets"
    });
  }
});

/**
 * GET /api/external-wallet/:address/:chain
 * Get specific wallet details
 */
router.get("/:address/:chain", async (req, res) => {
  try {
    const { address, chain } = req.params;
    
    const wallet = await storage.getExternalWalletByAddress(address, chain);
    
    if (!wallet) {
      return res.status(404).json({
        error: "Wallet not found"
      });
    }
    
    // Get projects linked to this wallet
    const projectLinks = await storage.getWalletProjectLinks(wallet.address);
    
    res.json({
      success: true,
      wallet: {
        id: wallet.id,
        address: wallet.address,
        chain: wallet.chain,
        walletType: wallet.wallet_type,
        verified: wallet.verified,
        connectedAt: wallet.connected_at,
        lastUsed: wallet.last_used,
        linkedProjectCount: wallet.linked_project_count,
        isProjectOwner: wallet.is_project_owner,
        projectLinks: projectLinks
      }
    });
    
  } catch (error) {
    console.error("Error fetching wallet:", error);
    res.status(500).json({
      error: "Failed to fetch wallet details"
    });
  }
});

/**
 * POST /api/external-wallet/link-project
 * Link a wallet to a project
 */
router.post("/link-project", async (req, res) => {
  try {
    const body = linkProjectSchema.parse(req.body);
    const { walletAddress, chain, projectId, linkType } = body;
    
    // Verify wallet exists and is verified
    const wallet = await storage.getExternalWalletByAddress(walletAddress, chain);
    if (!wallet || !wallet.verified) {
      return res.status(400).json({
        error: "Wallet not found or not verified"
      });
    }
    
    // Verify project exists
    const project = await storage.getDevtoolsProject(projectId);
    if (!project) {
      return res.status(404).json({
        error: "Project not found"
      });
    }
    
    // Check if link already exists
    const existingLinks = await storage.getWalletProjectLinks(wallet.address);
    const existingLink = existingLinks.find(link => link.projectId === projectId);
    
    if (existingLink) {
      return res.status(400).json({
        error: "Wallet is already linked to this project"
      });
    }
    
    // Create project link
    const linkData = insertWalletProjectLinkSchema.parse({
      walletAddress: walletAddress,
      projectId: projectId,
      chain: chain,
      linkType: linkType
    });
    
    const newLink = await storage.createWalletProjectLink(linkData);
    
    // Update wallet project ownership status
    await storage.updateExternalWallet(wallet.id, {
      is_project_owner: linkType === "owner" || linkType === "issuer" || wallet.is_project_owner
    });
    
    res.json({
      success: true,
      message: "Wallet linked to project successfully",
      link: newLink
    });
    
  } catch (error) {
    console.error("Error linking wallet to project:", error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid request data",
        details: error.errors
      });
    }
    
    res.status(500).json({
      error: "Failed to link wallet to project"
    });
  }
});

/**
 * DELETE /api/external-wallet/unlink/:id
 * Unlink (delete) a wallet
 */
router.delete("/unlink/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const walletId = parseInt(id);
    
    if (isNaN(walletId)) {
      return res.status(400).json({
        error: "Invalid wallet ID"
      });
    }
    
    // Check if wallet exists
    const wallet = await storage.getExternalWallet(walletId);
    if (!wallet) {
      return res.status(404).json({
        error: "Wallet not found"
      });
    }
    
    // Delete wallet (this will cascade delete project links if configured)
    await storage.deleteExternalWallet(walletId);
    
    res.json({
      success: true,
      message: "Wallet unlinked successfully"
    });
    
  } catch (error) {
    console.error("Error unlinking wallet:", error);
    res.status(500).json({
      error: "Failed to unlink wallet"
    });
  }
});

export default router;