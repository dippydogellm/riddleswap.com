import { Router } from 'express';
import { db } from './db';
import { gamingNfts, nftPowerAttributes } from '../shared/schema';
import { eq, and, like, sql, asc, desc } from 'drizzle-orm';
import { uploadToGCS, getGCSPublicUrl } from './gcs-upload.js';
import OpenAI from 'openai';

const router = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * GET /api/gaming/nfts
 * Get all gaming NFTs with optional filters
 */
router.get('/gaming/nfts', async (req, res) => {
  try {
    const { owner, civilization, sort, dir, page, pageSize } = req.query as Record<string, string | undefined>;

    let query = db
      .select({
        id: gamingNfts.id,
        nft_token_id: gamingNfts.nft_id,
        nft_name: gamingNfts.name,
        collection_name: sql<string>`(SELECT name FROM gaming_nft_collections WHERE id = ${gamingNfts.collection_id})`,
        original_image_url: gamingNfts.image_url,
        battle_image_url: gamingNfts.ai_generated_image_url,
        current_owner: gamingNfts.owner_address,
        army_power: nftPowerAttributes.army_power,
        religion_power: nftPowerAttributes.religion_power,
        civilization_power: nftPowerAttributes.civilization_power,
        economic_power: nftPowerAttributes.economic_power,
        total_power: nftPowerAttributes.total_power,
        character_class: nftPowerAttributes.character_class,
        rarity_score: gamingNfts.rarity_score,
      })
      .from(gamingNfts)
      .leftJoin(nftPowerAttributes, eq(gamingNfts.id, nftPowerAttributes.nft_id));

    const conditions = [];
    if (owner) {
      conditions.push(like(gamingNfts.owner_address, `%${owner}%`));
    }
    if (civilization && civilization !== 'all') {
      conditions.push(eq(nftPowerAttributes.character_class, civilization as string));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    // Sorting support
    const sortField = (sort || '').toLowerCase();
    const direction = (dir || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
    const applyOrder = (expr: any) => direction === 'asc' ? asc(expr) : desc(expr);
    let orderExpr: any = nftPowerAttributes.total_power;
    switch (sortField) {
      case 'rarity_score':
        orderExpr = gamingNfts.rarity_score; break;
      case 'army_power':
        orderExpr = nftPowerAttributes.army_power; break;
      case 'nft_name':
        orderExpr = gamingNfts.name; break;
      case 'total_power':
      default:
        orderExpr = nftPowerAttributes.total_power;
    }
    const orderedQuery = (query as any).orderBy(applyOrder(orderExpr));

    // Fetch all (dataset ~5.5k) then paginate in memory
  const all = await orderedQuery;
    const pageNum = Math.max(parseInt(page || '1', 10), 1);
    const sizeNum = Math.min(Math.max(parseInt(pageSize || '50', 10), 1), 200);
    const offset = (pageNum - 1) * sizeNum;
    const slice = all.slice(offset, offset + sizeNum);
    res.json({
      data: slice,
      page: pageNum,
      pageSize: sizeNum,
      total: all.length,
      totalPages: Math.ceil(all.length / sizeNum),
      sort: sortField || 'total_power',
      direction,
    });
  } catch (error: any) {
    console.error('❌ [GAMING NFTS] Error fetching NFTs:', error);
    res.status(500).json({ error: 'Failed to fetch gaming NFTs', details: error.message });
  }
});

/**
 * GET /api/gaming/nfts/:id
 * Get detailed info for a single NFT
 */
router.get('/gaming/nfts/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [nft] = await db
      .select({
        id: gamingNfts.id,
        nft_token_id: gamingNfts.nft_id,
        nft_name: gamingNfts.name,
        collection_name: sql<string>`(SELECT name FROM gaming_nft_collections WHERE id = ${gamingNfts.collection_id})`,
        original_image_url: gamingNfts.image_url,
        battle_image_url: gamingNfts.ai_generated_image_url,
        current_owner: gamingNfts.owner_address,
        full_metadata: gamingNfts.metadata,
        traits: gamingNfts.traits,
        army_power: nftPowerAttributes.army_power,
        religion_power: nftPowerAttributes.religion_power,
        civilization_power: nftPowerAttributes.civilization_power,
        economic_power: nftPowerAttributes.economic_power,
        total_power: nftPowerAttributes.total_power,
        character_class: nftPowerAttributes.character_class,
        rarity_score: gamingNfts.rarity_score,
        special_powers: nftPowerAttributes.special_powers,
      })
      .from(gamingNfts)
      .leftJoin(nftPowerAttributes, eq(gamingNfts.id, nftPowerAttributes.nft_id))
      .where(eq(gamingNfts.id, id));

    if (!nft) {
      return res.status(404).json({ error: 'NFT not found' });
    }

    res.json(nft);
  } catch (error: any) {
    console.error('❌ [GAMING NFT DETAIL] Error:', error);
    res.status(500).json({ error: 'Failed to fetch NFT details', details: error.message });
  }
});

/**
 * POST /api/gaming/nfts/:id/generate-battle-image
 * Generate AI battle image for an NFT
 */
router.post('/gaming/nfts/:id/generate-battle-image', async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`🎨 [BATTLE IMAGE] Generating for NFT ${id}`);

    // Get NFT data
    const [nft] = await db
      .select({
        nft_name: gamingNfts.name,
        collection_name: sql<string>`(SELECT name FROM gaming_nft_collections WHERE id = ${gamingNfts.collection_id})`,
        nft_token_id: gamingNfts.nft_id,
        character_class: nftPowerAttributes.character_class,
        army_power: nftPowerAttributes.army_power,
        religion_power: nftPowerAttributes.religion_power,
        traits: gamingNfts.traits,
      })
      .from(gamingNfts)
      .leftJoin(nftPowerAttributes, eq(gamingNfts.id, nftPowerAttributes.nft_id))
      .where(eq(gamingNfts.id, id));

    if (!nft) {
      return res.status(404).json({ error: 'NFT not found' });
    }

    // Generate battle image prompt
    const characterClass = nft.character_class || 'warrior';
    const armyPower = parseFloat(nft.army_power as string) || 0;
    const religionPower = parseFloat(nft.religion_power as string) || 0;

    const prompt = `Epic battle scene featuring a powerful ${characterClass} in heroic action pose. 
High-detail fantasy art, dramatic lighting, powerful presence. 
Army power emphasis: ${armyPower > 200 ? 'heavily armored with weapons' : 'light tactical gear'}.
Religion power emphasis: ${religionPower > 200 ? 'divine aura and sacred symbols' : 'subtle mystical elements'}.
Cinematic composition, game card art style, vibrant colors, 4K quality.`;

    console.log(`🎨 [BATTLE IMAGE] Prompt: ${prompt.substring(0, 100)}...`);

    // Generate image with DALL-E
    const imageResponse = await openai.images.generate({
      model: 'dall-e-3',
      prompt: prompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
    });

    const imageUrl = imageResponse.data[0]?.url;
    if (!imageUrl) {
      throw new Error('No image URL returned from DALL-E');
    }

    console.log(`✅ [BATTLE IMAGE] Generated, downloading...`);

    // Download the image
    const imageBuffer = await fetch(imageUrl).then(r => r.arrayBuffer());
    
    // Upload to GCS
    const gcsPath = `battle-images/${id}-${Date.now()}.png`;
    await uploadToGCS(Buffer.from(imageBuffer), gcsPath, 'image/png');
    
    const publicUrl = getGCSPublicUrl(gcsPath);
    console.log(`✅ [BATTLE IMAGE] Uploaded to GCS: ${publicUrl}`);

    // Update database with battle image URL
    await db
      .update(gamingNfts)
      .set({
        ai_generated_image_url: publicUrl,
        ai_image_generated_at: new Date() as any,
        updated_at: new Date() as any,
      } as any)
      .where(eq(gamingNfts.id, id));

    console.log(`✅ [BATTLE IMAGE] Database updated for NFT ${id}`);

    res.json({ 
      success: true, 
      battle_image_url: publicUrl,
      message: 'Battle image generated successfully' 
    });

  } catch (error: any) {
    console.error('❌ [BATTLE IMAGE] Error:', error);
    res.status(500).json({ 
      error: 'Failed to generate battle image', 
      details: error.message 
    });
  }
});

/**
 * GET /api/gaming/collections
 * Get all gaming collections with NFT counts
 */
router.get('/gaming/collections', async (req, res) => {
  try {
    const collections = await db
      .select({
        collection_name: sql<string>`(SELECT name FROM gaming_nft_collections WHERE id = ${gamingNfts.collection_id})`,
        count: sql<number>`count(*)::int`,
        total_power: sql<number>`sum(${nftPowerAttributes.total_power})::int`,
      })
      .from(gamingNfts)
      .leftJoin(nftPowerAttributes, eq(gamingNfts.id, nftPowerAttributes.nft_id))
      .groupBy(gamingNfts.collection_id);

    res.json(collections);
  } catch (error: any) {
    console.error('❌ [GAMING COLLECTIONS] Error:', error);
    res.status(500).json({ error: 'Failed to fetch collections', details: error.message });
  }
});

export default router;
