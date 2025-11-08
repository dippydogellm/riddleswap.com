import { Router, Request, Response } from "express";
import { db } from "../db";
import { inquisitionPlayerProfiles, inquisitionNftAudit } from "../../shared/inquisition-audit-schema";
import { eq, and, sql } from "drizzle-orm";
import OpenAI from "openai";
import { readOnlyAuth } from "../middleware/read-only-auth";

const router = Router();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Character class options
const CHARACTER_CLASSES = [
  "Warrior", "Mage", "Rogue", "Paladin", "Ranger",
  "Cleric", "Warlock", "Bard", "Monk", "Druid"
];

/**
 * GET /api/inquisition/player/my-profile
 * Fetch the current user's player profile
 * Uses readOnlyAuth - works with session token only (no private keys needed)
 */
router.get("/my-profile", readOnlyAuth, async (req: any, res: Response) => {
  try {
    const walletAddress = req.user?.walletAddress;

    if (!walletAddress) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated - please login first"
      });
    }

    const profile = await db
      .select()
      .from(inquisitionPlayerProfiles)
      .where(eq(inquisitionPlayerProfiles.wallet_address, walletAddress))
      .limit(1);

    if (profile.length === 0) {
      return res.json({
        success: true,
        data: null,
        message: "No profile found - please complete the character wizard"
      });
    }

    return res.json({
      success: true,
      data: profile[0]
    });
  } catch (error: any) {
    console.error("[PLAYER PROFILE ERROR]", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch player profile"
    });
  }
});

/**
 * POST /api/inquisition/player/create-profile
 * Create or update a player profile
 * Uses readOnlyAuth but POST requires private keys
 */
router.post("/create-profile", readOnlyAuth, async (req: any, res: Response) => {
  try {
    const walletAddress = req.user?.walletAddress;
    const userHandle = req.user?.userHandle;

    if (!walletAddress) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated - please login first"
      });
    }

    const { characterName, characterClass, characterBio, profileMetadata } = req.body;

    if (!characterName || !characterClass) {
      return res.status(400).json({
        success: false,
        error: "Character name and class are required"
      });
    }

    if (!CHARACTER_CLASSES.includes(characterClass)) {
      return res.status(400).json({
        success: false,
        error: `Invalid character class. Must be one of: ${CHARACTER_CLASSES.join(", ")}`
      });
    }

    // Check if profile exists
    const existing = await db
      .select()
      .from(inquisitionPlayerProfiles)
      .where(eq(inquisitionPlayerProfiles.wallet_address, walletAddress))
      .limit(1);

    let profile;

    if (existing.length > 0) {
      // Update existing profile
      const updated = await db
        .update(inquisitionPlayerProfiles)
        .set({
          character_name: characterName,
          character_class: characterClass,
          character_bio: characterBio,
          profile_metadata: profileMetadata || {},
          user_handle: userHandle || existing[0].user_handle,
          updated_at: new Date(),
        })
        .where(eq(inquisitionPlayerProfiles.wallet_address, walletAddress))
        .returning();
      
      profile = updated[0];
    } else {
      // Create new profile
      const inserted = await db
        .insert(inquisitionPlayerProfiles)
        .values({
          wallet_address: walletAddress,
          user_handle: userHandle,
          character_name: characterName,
          character_class: characterClass,
          character_bio: characterBio,
          profile_metadata: profileMetadata || {},
        } as any)
        .returning();
      
      profile = inserted[0];
    }

    return res.json({
      success: true,
      data: profile,
      message: "Profile saved successfully"
    });
  } catch (error: any) {
    console.error("[CREATE PROFILE ERROR]", error);
    return res.status(500).json({
      success: false,
      error: "Failed to create profile"
    });
  }
});

/**
 * POST /api/inquisition/player/generate-profile-image
 * Generate a character portrait using The Oracle (DALL-E)
 * Rate limited to once per 30 days
 * Uses readOnlyAuth but POST requires private keys
 */
router.post("/generate-profile-image", readOnlyAuth, async (req: any, res: Response) => {
  try {
    const walletAddress = req.user?.walletAddress;

    if (!walletAddress) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated - please login first"
      });
    }

    // Fetch player profile
    const profiles = await db
      .select()
      .from(inquisitionPlayerProfiles)
      .where(eq(inquisitionPlayerProfiles.wallet_address, walletAddress))
      .limit(1);

    if (profiles.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Profile not found - please create your character first"
      });
    }

    const profile = profiles[0];

    // Check rate limiting - 30 days
    if (profile.last_profile_generation_at) {
      const daysSinceLastGen = (Date.now() - new Date(profile.last_profile_generation_at).getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSinceLastGen < 30) {
        const daysRemaining = Math.ceil(30 - daysSinceLastGen);
        return res.status(429).json({
          success: false,
          error: `You can only regenerate your profile image once per month. Please wait ${daysRemaining} more days.`,
          daysRemaining
        });
      }
    }

    // Fetch user's NFTs to enrich the prompt
    const userNfts = await db
      .select()
      .from(inquisitionNftAudit)
      .where(eq(inquisitionNftAudit.current_owner, walletAddress))
      .limit(10);

    // Build context-rich prompt for DALL-E
    let prompt = `Create a detailed medieval fantasy character portrait in a dark, mystical art style. 

Character Details:
- Name: ${profile.character_name}
- Class: ${profile.character_class}
${profile.character_bio ? `- Background: ${profile.character_bio}` : ''}

Style: Dark medieval fantasy art, dramatic lighting, intricate details, mysterious atmosphere, professional digital painting quality. The character should look powerful and enigmatic, fitting for "The Trolls Inquisition" universe.`;

    // Add NFT context if available
    if (userNfts.length > 0) {
      const collectionThemes = userNfts.map((nft: any) => nft.name).join(", ");
      prompt += `\n\nThematic Influence: This warrior owns NFTs including: ${collectionThemes}. Incorporate subtle visual elements that reflect these themes.`;
    }

    console.log("🎨 [ORACLE] Generating profile image for:", profile.character_name);
    console.log("📝 [ORACLE] Prompt:", prompt.substring(0, 200) + "...");

    // Generate image with DALL-E 3
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      style: "vivid",
    });

    if (!response.data || response.data.length === 0) {
      throw new Error("No image data returned from OpenAI");
    }

    const imageUrl = response.data[0]?.url;

    if (!imageUrl) {
      throw new Error("No image URL returned from OpenAI");
    }

    console.log("🎨 [ORACLE] Got OpenAI URL, downloading and saving to persistent storage...");

    // 🔥 FIX: Download image from OpenAI and save to Replit Object Storage
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image from OpenAI: ${imageResponse.statusText}`);
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');

    // Save to Replit Object Storage for persistence
    const { saveInquisitionImage } = await import('../inquisition-image-generator');
    const fileName = `profile_${profile.character_name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
    const persistentUrl = await saveInquisitionImage(base64Image, fileName, 'profiles');

    console.log("✅ [ORACLE] Profile image saved to persistent storage:", persistentUrl);

    // Update profile with persistent image URL and timestamp
    const updated = await db
      .update(inquisitionPlayerProfiles)
      .set({ 
        profile_image_url: persistentUrl,
        last_profile_generation_at: new Date(),
        total_generations: (profile.total_generations || 0) + 1,
        updated_at: new Date(),
       } as any)
      .where(eq(inquisitionPlayerProfiles.wallet_address, walletAddress))
      .returning();

    console.log("✅ [ORACLE] Profile image generated successfully");

    return res.json({
      success: true,
      data: {
        profile: updated[0],
        imageUrl: persistentUrl,
      },
      message: "The Oracle has created your character portrait!"
    });
  } catch (error: any) {
    console.error("[GENERATE PROFILE IMAGE ERROR]", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to generate profile image"
    });
  }
});

/**
 * POST /api/inquisition/player/generate-crest
 * Generate a personal crest/emblem using The Oracle (DALL-E)
 * Rate limited to once per 30 days
 * Supports custom prompts from user
 * Uses readOnlyAuth but POST requires private keys
 */
router.post("/generate-crest", readOnlyAuth, async (req: any, res: Response) => {
  try {
    const userHandle = req.user?.userHandle;

    if (!userHandle) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated - please login first"
      });
    }

    const { customPrompt } = req.body;

    // Import gaming tables
    const { gamingPlayers, playerCivilizations } = await import("../../shared/schema");

    // Fetch player profile from gaming tables
    const player = await db.query.gamingPlayers.findFirst({
      where: eq(gamingPlayers.user_handle, userHandle)
    });

    if (!player) {
      return res.status(404).json({
        success: false,
        error: "Player profile not found - please complete setup first"
      });
    }

    // Fetch civilization data
    const civilization = await db.query.playerCivilizations.findFirst({
      where: eq(playerCivilizations.player_id, player.id)
    });

    // Rate limiting removed - schema doesn't have crest_generated_at field
    // Users can regenerate crests freely

    // Build extremely detailed prompt using actual player data
    const civName = civilization?.civilization_name || player.player_name || userHandle;
    const playType = player.play_type || 'warmonger';
    const motto = civilization?.motto || 'Strength and Honor';
    const commanderClass = player.commander_class || 'warrior';
    const religion = player.religion || 'Secular';
    const totalPower = player.total_power_level || 0;

    // Map play types to visual themes
    const themeMap: Record<string, string> = {
      'warmonger': 'crossed swords, battle axes, flames, aggressive red and black colors, military symbols',
      'religious_state': 'holy symbols, divine light rays, golden halos, temple architecture, sacred geometric patterns',
      'trader': 'merchant ships, gold coins, balanced scales, trade routes, rich purple and gold',
      'diplomat': 'olive branches, handshake symbols, white doves, peaceful blue and white colors, balance',
      'expansionist': 'expanding borders, growing vines, territorial maps, ambitious green and gold',
      'defensive': 'castle walls, shields, protective barriers, strong blue and silver',
      'nomadic': 'horse riders, tent camps, migration paths, earthy browns and tans, freedom symbols',
      'builder': 'construction tools, architectural blueprints, rising buildings, creative orange and bronze'
    };

    const theme = themeMap[playType] || 'balanced medieval symbols';

    const basePrompt = `Create an extremely detailed medieval coat of arms and heraldic emblem for the civilization "${civName}". This is a ${playType} civilization led by a ${commanderClass} commander. Their motto is "${motto}". They follow ${religion} beliefs and have achieved ${totalPower} total power.

VISUAL REQUIREMENTS:
- Shield-shaped heraldic emblem with ornate border decorations
- Include symbols representing: ${theme}
- Traditional medieval heraldry style with quartered shield design
- Rich, royal colors: deep blues (#1E3A8A), fiery oranges (#FF8C00), crimson reds (#FF4444), gleaming gold (#FFD700)
- Intricate filigree work and decorative scrollwork around the border
- Banner ribbon at bottom with the motto "${motto}"
- Crown or helm above the shield representing ${commanderClass} leadership
- Supporting elements: ${playType === 'religious_state' ? 'angel wings or divine creatures' : playType === 'warmonger' ? 'lions or eagles in aggressive poses' : 'appropriate creatures for the civilization type'}
- Symmetrical composition with perfect balance
- Medieval manuscript illumination quality
- High contrast, dramatic lighting with golden highlights
- Professional heraldic artist quality, museum-grade detail
- Dark atmospheric background with mystical glowing effects`;

    const finalPrompt = customPrompt || basePrompt;

    console.log("🛡️ [ORACLE] Generating crest for:", civName);
    console.log("📝 [ORACLE] Prompt length:", finalPrompt.length, "characters");

    // Generate image with DALL-E 3
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: finalPrompt,
      n: 1,
      size: "1024x1024",
      quality: "hd",
      style: "vivid",
    });

    if (!response.data || response.data.length === 0) {
      throw new Error("No image data returned from OpenAI");
    }

    const imageUrl = response.data[0]?.url;

    if (!imageUrl) {
      throw new Error("No image URL returned from OpenAI");
    }

    console.log("🎨 [ORACLE] Got OpenAI URL, downloading and saving to persistent storage...");

    // 🔥 FIX: Download image from OpenAI and save to Replit Object Storage
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image from OpenAI: ${imageResponse.statusText}`);
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');

    // Save to Replit Object Storage for persistence
    const { saveInquisitionImage } = await import('../inquisition-image-generator');
    const fileName = `crest_${userHandle.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
    const persistentUrl = await saveInquisitionImage(base64Image, fileName, 'crests');

    console.log("✅ [ORACLE] Crest saved to persistent storage:", persistentUrl);

    // Create or update civilization record with persistent crest URL
    const civData = {
      player_id: player.id,
      crest_image: persistentUrl,
      updated_at: new Date(),
      civilization_name: civilization?.civilization_name || civName,
      ...(civilization?.motto && { motto: civilization.motto })
    };

    await db.insert(playerCivilizations)
      .values(civData as any as any)
      .onConflictDoUpdate({
        target: playerCivilizations.player_id,
        set: civData as any
      });

    console.log("✅ [ORACLE] Crest saved to civilization for:", civName);

    return res.json({
      success: true,
      data: {
        imageUrl: persistentUrl,  // 🔥 FIX: Return persistent Object Storage URL, not temporary OpenAI URL
        civilizationName: civName
      },
      message: "The Oracle has forged your personal crest!"
    });
  } catch (error: any) {
    console.error("[GENERATE CREST ERROR]", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to generate crest"
    });
  }
});

/**
 * POST /api/inquisition/player/complete-wizard
 * Mark the character wizard as completed
 * Uses readOnlyAuth but POST requires private keys
 */
router.post("/complete-wizard", readOnlyAuth, async (req: any, res: Response) => {
  try {
    const walletAddress = req.user?.walletAddress;

    if (!walletAddress) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated"
      });
    }

    const updated = await db
      .update(inquisitionPlayerProfiles)
      .set({ 
        is_profile_complete: true,
        wizard_completed_at: new Date(),
        updated_at: new Date(),
       } as any)
      .where(eq(inquisitionPlayerProfiles.wallet_address, walletAddress))
      .returning();

    return res.json({
      success: true,
      data: updated[0],
      message: "Welcome to The Trolls Inquisition!"
    });
  } catch (error: any) {
    console.error("[COMPLETE WIZARD ERROR]", error);
    return res.status(500).json({
      success: false,
      error: "Failed to complete wizard"
    });
  }
});

/**
 * GET /api/inquisition/player/character-classes
 * Get list of available character classes
 */
router.get("/character-classes", async (req: Request, res: Response) => {
  return res.json({
    success: true,
    data: CHARACTER_CLASSES
  });
});

export default router;
