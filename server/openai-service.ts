import OpenAI from "openai";
import fetch from 'node-fetch';
import { unifiedStorage } from './unified-storage';

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface LandPlotImageRequest {
  terrain_type: string;
  coordinates: { x: number; y: number };
  resources: string[];
  size_multiplier: number;
  rarity_score: number;
  position_type: string;
  plot_id: number;
}

// Generate AI image for land plot based on metadata
export async function generateLandPlotImage(plotData: LandPlotImageRequest): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
  try {
    console.log(`🎨 Generating AI image for plot #${plotData.plot_id} (${plotData.terrain_type})...`);

    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.log(`⚠️ OpenAI API key not configured - skipping image generation for plot #${plotData.plot_id}`);
      return { 
        success: false, 
        error: 'OpenAI API key not configured'
      };
    }

    // Create detailed prompt based on land plot metadata
    const prompt = createLandPlotPrompt(plotData);
    
    // Generate image with DALL-E 3
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
    });

    const imageUrl = response.data?.[0]?.url;
    if (!imageUrl) {
      throw new Error('No image URL returned from OpenAI');
    }

    // Download and save the image to Object Storage (production-ready)
    const savedImageUrl = await downloadAndSaveImageToStorage(imageUrl, plotData.plot_id);
    
    console.log(`✅ Generated image for plot #${plotData.plot_id}: ${savedImageUrl}`);
    return { 
      success: true, 
      imageUrl: savedImageUrl
    };

  } catch (error: any) {
    // Handle authentication errors gracefully
    if (error?.status === 401 || error?.code === 'invalid_project') {
      console.log(`🔐 OpenAI authentication failed for plot #${plotData.plot_id} - API key invalid or insufficient permissions. Skipping image generation.`);
      return { 
        success: false, 
        error: 'OpenAI authentication failed - API key invalid or insufficient permissions'
      };
    }
    console.error(`❌ Failed to generate image for plot #${plotData.plot_id}:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

// Create detailed prompt for land plot image generation
function createLandPlotPrompt(plotData: LandPlotImageRequest): string {
  const { terrain_type, coordinates, resources, size_multiplier, rarity_score, position_type } = plotData;
  
  // Base terrain descriptions
  const terrainPrompts = {
    forest: "ancient mystical forest with towering oak trees, dappled sunlight filtering through dense canopy, moss-covered stones",
    mountain: "majestic mountain peak with snow-capped summit, rocky outcroppings, crystal-clear streams cascading down cliffsides",
    plains: "vast rolling grasslands with golden wheat fields, gentle hills stretching to the horizon, wildflowers scattered throughout",
    water: "pristine crystal-clear lake with reflective surface, surrounded by cattails and water lilies, gentle ripples catching sunlight",
    village: "charming medieval village with cobblestone paths, thatched-roof cottages, market square with wooden stalls",
    castle: "imposing medieval fortress with stone walls, tall towers with battlements, grand entrance with iron gates"
  };

  // Resource-based enhancements
  const resourceEnhancements = {
    'Timber': 'tall lumber trees ready for harvest',
    'Herbs': 'vibrant medicinal plants and flowers',
    'Game': 'deer and wildlife roaming peacefully',
    'Iron': 'exposed iron ore veins in rock faces',
    'Gold': 'glinting gold deposits in stream beds',
    'Stone': 'quarried stone blocks and marble outcroppings',
    'Grain': 'golden wheat and barley fields swaying in breeze',
    'Horses': 'magnificent horses grazing in pastures',
    'Cattle': 'healthy livestock in green meadows',
    'Fish': 'schools of fish visible in clear waters',
    'Pearls': 'oyster beds with lustrous pearls',
    'Trade Routes': 'well-worn paths and merchant caravans',
    'Crafts': 'artisan workshops with tools and materials',
    'Knowledge': 'ancient libraries and scroll collections',
    'Trade': 'bustling marketplace with merchants',
    'Military': 'training grounds with weapons and armor',
    'Influence': 'royal banners and noble emblems',
    'Tribute': 'treasure chests and valuable goods'
  };

  // Position-based lighting and atmosphere
  const positionEffects = {
    'Corner': 'dramatic lighting from corner perspective, emphasizing strategic importance',
    'Border': 'expansive view showing connection to neighboring lands',
    'Center': 'central focal point with radial composition, highlighting prime location',
    'Inner': 'intimate detailed view with rich textures and depth'
  };

  // Size-based scale adjustments
  const sizeDescriptions = {
    1: 'compact but detailed medieval land parcel',
    2: 'expansive sizeable domain with multiple features',
    3: 'vast sprawling estate with grand scale and majesty'
  };

  // Rarity-based magical elements
  const rarityEffects = rarity_score >= 50 
    ? 'with magical aura, mystical energy emanating from the land, ethereal glow'
    : rarity_score >= 40 
    ? 'with subtle enchantments, faint magical sparkles in the air'
    : 'with natural beauty and authentic medieval atmosphere';

  // Combine all elements into comprehensive prompt
  const baseDescription = terrainPrompts[terrain_type as keyof typeof terrainPrompts] || terrainPrompts.forest;
  const resourceDetails = resources.map(r => resourceEnhancements[r as keyof typeof resourceEnhancements]).filter(Boolean).join(', ');
  const positionLighting = positionEffects[position_type as keyof typeof positionEffects] || positionEffects.Inner;
  const sizeDescription = sizeDescriptions[size_multiplier as keyof typeof sizeDescriptions] || sizeDescriptions[1];
  
  const finalPrompt = `
    Medieval fantasy landscape artwork of ${sizeDescription} featuring ${baseDescription}. 
    The land contains ${resourceDetails}. 
    Rendered with ${positionLighting} ${rarityEffects}.
    Art style: high-quality digital fantasy art, detailed textures, vibrant colors, cinematic lighting.
    Coordinates (${coordinates.x}, ${coordinates.y}) subtly integrated into natural landscape features.
    Medieval gaming aesthetic suitable for NFT collection.
    No text, logos, or UI elements. Pure landscape focus.
  `.trim().replace(/\s+/g, ' ');

  return finalPrompt;
}

// Download image from URL and save to local storage
async function downloadAndSaveImageToStorage(imageUrl: string, plotId: number): Promise<string> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }

  const imageBuffer = await response.buffer();
  
  // Save to unified storage with plot ID in generated-images directory
  const fileName = `land_plot_${plotId}_${Date.now()}.png`;
  const storageUrl = await unifiedStorage.uploadFile(
    Buffer.from(imageBuffer),
    'generated',
    'image/png'
  );

  return storageUrl;
}

// Generate images for multiple plots (batch processing)
export async function generateBatchLandPlotImages(plotDataArray: LandPlotImageRequest[], batchSize: number = 5): Promise<{ success: number; failed: number; results: any[] }> {
  const results: any[] = [];
  let success = 0;
  let failed = 0;

  console.log(`🎨 Starting batch generation of ${plotDataArray.length} land plot images...`);

  // Process in batches to avoid rate limiting
  for (let i = 0; i < plotDataArray.length; i += batchSize) {
    const batch = plotDataArray.slice(i, i + batchSize);
    
    console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(plotDataArray.length / batchSize)} (plots ${i + 1}-${i + batch.length})`);

    // Process batch with concurrent requests
    const batchPromises = batch.map(plotData => generateLandPlotImage(plotData));
    const batchResults = await Promise.all(batchPromises);

    // Collect results
    batchResults.forEach((result, index) => {
      if (result.success) {
        success++;
      } else {
        failed++;
      }
      results.push({
        plotId: batch[index].plot_id,
        ...result
      });
    });

    // Rate limiting delay between batches
    if (i + batchSize < plotDataArray.length) {
      console.log('⏳ Waiting 2 seconds before next batch...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log(`🎉 Batch generation complete: ${success} successful, ${failed} failed`);
  return { success, failed, results };
}

// Generate image for a single plot when purchased
export async function generateImageOnPurchase(plotMetadata: any): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
  const plotImageRequest: LandPlotImageRequest = {
    terrain_type: plotMetadata.properties.terrain_type,
    coordinates: plotMetadata.properties.coordinates,
    resources: plotMetadata.properties.resources,
    size_multiplier: plotMetadata.properties.size_multiplier,
    rarity_score: plotMetadata.properties.rarity_score,
    position_type: plotMetadata.attributes.find((attr: any) => attr.trait_type === 'Position Type')?.value || 'Inner',
    plot_id: plotMetadata.id
  };

  return await generateLandPlotImage(plotImageRequest);
}

// ==================== AI STUDIO SERVICES ====================
// Services for free image generation/editing and Sora video creation

export interface ImageGenerationOptions {
  prompt: string;
  inputImageUrl?: string; // Optional for editing
  model?: string;
  size?: "1024x1024" | "1792x1024" | "1024x1792";
  quality?: "standard" | "hd";
  style?: "vivid" | "natural";
}

export interface VideoGenerationOptions {
  prompt: string;
  images: string[]; // Array of image URLs to include in video
  duration?: number; // Video duration in seconds
  resolution?: "720p" | "1080p" | "4k";
}

/**
 * Generate a new image from a text prompt (FREE for users)
 * Uses DALL-E 3 for best quality
 */
export async function generateAIImage(options: ImageGenerationOptions): Promise<{
  url: string;
  revisedPrompt?: string;
  base64?: string;
}> {
  try {
    const {
      prompt,
      model = "dall-e-3",
      size = "1024x1024",
      quality = "standard",
      style
    } = options;

    console.log(`🎨 [AI Studio] Generating image with model: ${model}`);
    console.log(`📝 [AI Studio] Prompt: ${prompt}`);

    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await openai.images.generate({
      model,
      prompt,
      size,
      quality,
      style,
      n: 1,
      response_format: "b64_json", // Get base64 for storage
    });

    if (!response.data || response.data.length === 0) {
      throw new Error('No image data returned from OpenAI');
    }

    const imageData = response.data[0];
    
    console.log(`✅ [AI Studio] Image generated successfully`);
    return {
      url: imageData.url || "",
      base64: imageData.b64_json,
      revisedPrompt: imageData.revised_prompt,
    };
  } catch (error: any) {
    console.error("❌ [AI Studio] Image generation error:", error);
    throw new Error(`Image generation failed: ${error.message}`);
  }
}

/**
 * Edit/upgrade an existing image with a new prompt (FREE for users)
 * Accepts optional input image + prompt to create upgraded version
 */
export async function editAIImage(options: ImageGenerationOptions): Promise<{
  url: string;
  revisedPrompt?: string;
  base64?: string;
}> {
  try {
    const {
      prompt,
      inputImageUrl,
      model = "dall-e-3",
      size = "1024x1024",
      quality = "standard",
    } = options;

    console.log(`✏️ [AI Studio] Editing image with model: ${model}`);
    console.log(`📝 [AI Studio] Edit prompt: ${prompt}`);
    console.log(`🖼️ [AI Studio] Input image: ${inputImageUrl ? 'provided' : 'none (new generation)'}`);

    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    // If no input image, just generate new image
    if (!inputImageUrl) {
      return await generateAIImage(options);
    }

    // Download the input image
    const imageResponse = await fetch(inputImageUrl);
    const imageBlob = await imageResponse.blob();
    const imageBuffer = Buffer.from(await imageBlob.arrayBuffer());

    // For DALL-E 3, generate new image with combined context
    const response = await openai.images.edit({
      model,
      image: imageBuffer as any,
      prompt,
      size: "1024x1024", // Only use supported size for edit
      n: 1,
      response_format: "b64_json",
    });

    if (!response.data || response.data.length === 0) {
      throw new Error('No image data returned from OpenAI');
    }

    const imageData = response.data[0];
    
    console.log(`✅ [AI Studio] Image edited successfully`);
    return {
      url: imageData.url || "",
      base64: imageData.b64_json,
      revisedPrompt: imageData.revised_prompt,
    };
  } catch (error: any) {
    console.error("❌ [AI Studio] Image editing error:", error);
    throw new Error(`Image editing failed: ${error.message}`);
  }
}

/**
 * Generate video using OpenAI Sora (when API available)
 * NOTE: Sora API is not yet publicly available. This prepares for future integration.
 * Pricing: 10 images = 1 XRP, 100 images = 9 XRP
 */
export async function generateVideoWithSora(options: VideoGenerationOptions): Promise<{
  videoUrl: string;
  duration: number;
  format: string;
}> {
  try {
    const {
      prompt,
      images,
      duration = 10,
      resolution = "1080p"
    } = options;

    console.log(`🎬 [AI Studio] Preparing Sora video generation`);
    console.log(`📝 [AI Studio] Prompt: ${prompt}`);
    console.log(`🖼️ [AI Studio] Images count: ${images.length}`);
    console.log(`⏱️ [AI Studio] Duration: ${duration}s`);

    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    // TODO: Replace this with actual Sora API call when available
    // Expected API structure based on OpenAI patterns:
    /*
    const response = await openai.video.generations.create({
      model: "sora-2",
      images: images,
      prompt: prompt,
      duration: duration,
      resolution: resolution,
    });
    
    return {
      videoUrl: response.data[0].url,
      duration: response.data[0].duration,
      format: "mp4"
    };
    */

    throw new Error(
      "Sora API not yet available. OpenAI has announced Sora API is coming soon. " +
      "Video generation will be enabled once the public API is released. " +
      `Your ${images.length} images are saved and ready for video creation.`
    );
  } catch (error: any) {
    console.error("❌ [AI Studio] Sora video generation error:", error);
    throw error;
  }
}

/**
 * Calculate video pricing based on number of images
 * 10 images = 1 XRP
 * 100 images = 9 XRP (10% discount)
 */
export function calculateVideoPrice(imageCount: number): number {
  if (imageCount <= 0) return 0;
  
  if (imageCount === 10) {
    return 1; // 1 XRP for 10 images
  } else if (imageCount === 100) {
    return 9; // 9 XRP for 100 images (discount)
  }
  
  // Linear pricing for other amounts
  const pricePerImage = 0.1; // 0.1 XRP per image
  return imageCount * pricePerImage;
}

/**
 * Generate NFT metadata for an image or video
 */
export async function generateNFTMetadata(options: {
  name: string;
  description: string;
  imageUrl: string;
  attributes?: Record<string, any>;
}): Promise<Record<string, any>> {
  const { name, description, imageUrl, attributes = {} } = options;

  const metadata = {
    schema: "ipfs://QmNpi8rcXEkohca8iXu7zysKKSJYqCvBJn3xJwga8jXqWU",
    nftType: "art.v0",
    name,
    description,
    image: imageUrl,
    attributes: Object.entries(attributes).map(([trait_type, value]) => ({
      trait_type,
      value,
    })),
    properties: {
      category: "ai_generated",
      creators: [],
      files: [
        {
          uri: imageUrl,
          type: "image/png",
        },
      ],
    },
  };

  console.log(`📄 [AI Studio] Generated NFT metadata for: ${name}`);
  return metadata;
}