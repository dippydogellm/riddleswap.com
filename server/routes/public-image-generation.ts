/**
 * Public Image Generation API
 * No authentication required - anyone can generate and save images
 * Images are saved to Replit Object Storage for persistence
 */

import { Router } from "express";
import OpenAI from "openai";
import { nanoid } from "nanoid";
import { unifiedStorage } from "../unified-storage";

const router = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * POST /api/public/generate-image
 * Generate an image using DALL-E and save it to persistent storage
 * NO AUTHENTICATION REQUIRED
 */
router.post("/generate-image", async (req, res) => {
  try {
    const { prompt, size = "1024x1024", quality = "standard" } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: "Prompt is required",
      });
    }

    console.log(`🎨 [PUBLIC IMAGE] Generating image: "${prompt}"`);

    // Generate image with DALL-E 3
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: size as "1024x1024" | "1792x1024" | "1024x1792",
      quality: quality as "standard" | "hd",
    });

    const imageUrl = response.data?.[0]?.url;

    if (!imageUrl) {
      throw new Error("No image URL returned from OpenAI");
    }

    // Download the image
    console.log(`💾 [PUBLIC IMAGE] Downloading image from OpenAI...`);
    const imageResponse = await fetch(imageUrl);
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

    // Upload to storage backend (persistent)
    console.log(`☁️ [PUBLIC IMAGE] Uploading to storage backend...`);
    const publicUrl = await unifiedStorage.uploadFile(
      imageBuffer,
      'generated',
      'image/png'
    );

    console.log(`✅ [PUBLIC IMAGE] Saved to persistent storage: ${publicUrl}`);

    // Extract ID from URL for response
    const imageId = publicUrl.split('/').pop()?.replace('.png', '') || nanoid(10);

    res.json({
      success: true,
      data: {
        id: imageId,
        prompt: prompt,
        url: publicUrl,
        fullUrl: imageUrl,
        filename: publicUrl.split('/').pop() || `${imageId}.png`,
        size: size,
        quality: quality,
        revisedPrompt: response.data?.[0]?.revised_prompt,
      },
    });
  } catch (error: any) {
    console.error("❌ [PUBLIC IMAGE] Error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to generate image",
    });
  }
});

/**
 * GET /api/public/images
 * List all generated images from Object Storage
 * NO AUTHENTICATION REQUIRED
 * 
 * Note: This endpoint is currently not supported with Replit Object Storage
 * as it doesn't provide a list operation. Generated images are accessed directly
 * via their URLs returned from the generation endpoint.
 */
router.get("/images", async (req, res) => {
  try {
    res.json({
      success: true,
      message: "Image listing not available with Object Storage. Images are accessed via URLs returned from generation.",
      data: [],
    });
  } catch (error: any) {
    console.error("❌ [PUBLIC IMAGE] Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to list images",
    });
  }
});

/**
 * DELETE /api/public/images/:storageUrl
 * Delete a generated image from Object Storage
 * NO AUTHENTICATION REQUIRED
 */
router.delete("/images/:storageUrl(*)", async (req, res) => {
  try {
    const storageUrl = req.params.storageUrl;
    
    if (!storageUrl) {
      return res.status(400).json({
        success: false,
        error: "Storage URL is required"
      });
    }

  // Delete from storage backend
  await unifiedStorage.deleteFile(storageUrl);
    console.log(`🗑️ [PUBLIC IMAGE] Deleted image: ${storageUrl}`);

    res.json({
      success: true,
      message: "Image deleted successfully",
    });
  } catch (error: any) {
    console.error("❌ [PUBLIC IMAGE] Error deleting image:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete image",
    });
  }
});

console.log("🎨 Public Image Generation routes registered (NO AUTH REQUIRED)");

export default router;
