import { Router } from "express";
import { storage } from "./storage";

const router = Router();

/**
 * GET /:vanitySlug
 * Handle vanity URL routing for projects
 * This should be registered as a catch-all route after all API routes
 */
router.get("/:vanitySlug", async (req, res) => {
  try {
    const { vanitySlug } = req.params;
    
    // Validate vanity slug format
    if (!/^[a-z0-9-]+$/.test(vanitySlug)) {
      return res.status(404).json({
        error: "Invalid vanity slug format"
      });
    }
    
    // Temporarily return 404 for all vanity URLs until database is fixed
    return res.status(404).json({
      error: "Vanity URLs temporarily disabled"
    });
    
  } catch (error) {
    console.error('Error handling vanity URL:', error);
    return res.status(404).json({
      error: "Vanity URLs temporarily disabled"
    });
  }
});

/**
 * GET /api/vanity/check/:slug
 * Check if a vanity slug is available
 */
router.get("/api/vanity/check/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    
    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return res.status(400).json({
        error: "Invalid slug format. Use only lowercase letters, numbers, and hyphens."
      });
    }
    
    // Check length constraints
    if (slug.length < 3 || slug.length > 50) {
      return res.status(400).json({
        error: "Slug must be between 3 and 50 characters"
      });
    }
    
    // Check if slug is reserved
    const reservedSlugs = [
      "api", "app", "www", "admin", "dashboard", "devtools", "auth", "login", "signup",
      "about", "contact", "help", "support", "terms", "privacy", "blog", "news",
      "explore", "discover", "search", "trending", "popular", "featured", "tools",
      "nft", "wallet", "swap", "trade", "portfolio", "settings", "profile"
    ];
    
    if (reservedSlugs.includes(slug)) {
      return res.json({
        available: false,
        reason: "Reserved slug"
      });
    }
    
    // Temporarily assume all slugs are available until database is fixed
    // const existingProject = await storage.getProjectByVanitySlug(slug);
    
    res.json({
      available: true,
      reason: null,
      suggestions: null
    });
    
  } catch (error) {
    console.error("Error checking vanity slug:", error);
    res.status(500).json({
      error: "Failed to check slug availability"
    });
  }
});

export default router;