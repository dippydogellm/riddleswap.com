import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { sessionAuth } from './middleware/session-auth';
import { OpenAI } from 'openai';
import { db } from './db';
import { gameLocations, coordinateZones, locationStatusLogs, mapAssets } from '../shared/schema';
import { eq, and, gte, lte, sql, desc, asc } from 'drizzle-orm';

const router = Router();

// Initialize OpenAI for image generation
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Validation schemas
const createLocationSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  zone: z.string().default('unknown'),
  coordinates: z.object({
    x: z.number(),
    y: z.number(),
    z: z.number().optional()
  }),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  elevation: z.number().default(0),
  location_type: z.string().default('waypoint'),
  danger_level: z.number().min(0).max(10).default(0),
  resources: z.record(z.any()).default({}),
  accessibility: z.string().default('public'),
  special_properties: z.record(z.any()).default({})
});

const createZoneSchema = z.object({
  zone_name: z.string().min(1).max(100),
  description: z.string().optional(),
  boundaries: z.object({
    north: z.number(),
    south: z.number(),
    east: z.number(),
    west: z.number()
  }),
  center_lat: z.number().min(-90).max(90).optional(),
  center_lng: z.number().min(-180).max(180).optional(),
  radius_km: z.number().positive().optional(),
  zone_type: z.string().default('exploration'),
  control_faction: z.string().optional(),
  security_level: z.string().default('neutral'),
  climate: z.string().default('temperate'),
  terrain_type: z.string().default('mixed'),
  population: z.number().default(0),
  resources: z.record(z.any()).default({})
});

const updateLocationStatusSchema = z.object({
  status: z.string(),
  event_type: z.string().optional(),
  details: z.record(z.any()).default({})
});

// === LOCATION MANAGEMENT ROUTES ===

// Get all locations with optional filtering
router.get('/locations', sessionAuth, async (req: Request, res: Response) => {
  try {
    const { zone, status, location_type, limit = 100 } = req.query;
    
    let query = db.select().from(gameLocations);
    
    // Apply filters using Drizzle ORM
    const conditions = [];
    if (zone) {
      conditions.push(eq(gameLocations.zone, zone as string));
    }
    if (status) {
      conditions.push(eq(gameLocations.status, status as string));
    }
    if (location_type) {
      conditions.push(eq(gameLocations.location_type, location_type as string));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    const result = await query
      .orderBy(desc(gameLocations.created_at))
      .limit(parseInt(limit as string));
    
    console.log('🗺️ [MAPPING] Retrieved', result.length, 'locations from database');
    res.json(result);
  } catch (error) {
    console.error('❌ [MAPPING] Failed to get locations:', error);
    res.status(500).json({ error: 'Failed to retrieve locations' });
  }
});

// Get specific location by ID
router.get('/locations/:id', sessionAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const result = await db.select()
      .from(gameLocations)
      .where(eq(gameLocations.id, id))
      .limit(1);
    
    if (result.length === 0) {
      return res.status(404).json({ error: 'Location not found' });
    }
    
    console.log('🎯 [MAPPING] Retrieved location:', result[0].name);
    res.json(result[0]);
  } catch (error) {
    console.error('❌ [MAPPING] Failed to get location:', error);
    res.status(500).json({ error: 'Failed to retrieve location' });
  }
});

// Create new location
router.post('/locations', sessionAuth, async (req: Request, res: Response) => {
  try {
    const validatedData = createLocationSchema.parse(req.body);
    const userHandle = (req as any).user?.handle || 'system';
    
    const result = await db.insert(gameLocations).values({
      name: validatedData.name,
      description: validatedData.description || '',
      zone: validatedData.zone,
      coordinates: validatedData.coordinates,
      latitude: validatedData.latitude ? validatedData.latitude.toString() : null,
      longitude: validatedData.longitude ? validatedData.longitude.toString() : null,
      elevation: validatedData.elevation,
      location_type: validatedData.location_type,
      status: 'active',
      danger_level: validatedData.danger_level,
      resources: validatedData.resources,
      accessibility: validatedData.accessibility,
      special_properties: validatedData.special_properties,
      discovered_by: userHandle,
    }).returning();
    
    console.log('✅ [MAPPING] Created location:', validatedData.name);
    res.status(201).json(result[0]);
  } catch (error) {
    console.error('❌ [MAPPING] Failed to create location:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create location' });
  }
});

// Update location status
router.patch('/locations/:id/status', sessionAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validatedData = updateLocationStatusSchema.parse(req.body);
    const userHandle = (req as any).user?.handle || 'system';
    
    // Get current location data
    const currentLocation = await db.select()
      .from(gameLocations)
      .where(eq(gameLocations.id, id))
      .limit(1);
    
    if (currentLocation.length === 0) {
      return res.status(404).json({ error: 'Location not found' });
    }
    
    const location = currentLocation[0];
    
    // Update location status
    const updateResult = await db.update(gameLocations)
      .set({  
        status: validatedData.status,
        updated_at: new Date()
       } as any)
      .where(eq(gameLocations.id, id))
      .returning();
    
    // Log the status change
    await db.insert(locationStatusLogs).values({
      location_id: id,
      user_handle: userHandle,
      status_change: `Status changed from ${location.status} to ${validatedData.status}`,
      previous_status: location.status,
      new_status: validatedData.status,
      event_type: validatedData.event_type || 'manual_update',
      coordinates: location.coordinates,
      details: validatedData.details,
    } as any);
    
    console.log('🔄 [MAPPING] Updated location status:', id, '→', validatedData.status);
    res.json(updateResult[0]);
  } catch (error) {
    console.error('❌ [MAPPING] Failed to update location status:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to update location status' });
  }
});

// === ZONE MANAGEMENT ROUTES ===

// Get all zones
router.get('/zones', sessionAuth, async (req: Request, res: Response) => {
  try {
    const result = await db.select()
      .from(coordinateZones)
      .orderBy(asc(coordinateZones.zone_name));
    
    console.log('🗺️ [MAPPING] Retrieved', result.length, 'zones from database');
    res.json(result);
  } catch (error) {
    console.error('❌ [MAPPING] Failed to get zones:', error);
    res.status(500).json({ error: 'Failed to retrieve zones' });
  }
});

// Create new zone
router.post('/zones', sessionAuth, async (req: Request, res: Response) => {
  try {
    const validatedData = createZoneSchema.parse(req.body);
    
    const result = await db.insert(coordinateZones).values({
      zone_name: validatedData.zone_name,
      description: validatedData.description || '',
      boundaries: validatedData.boundaries,
      center_lat: validatedData.center_lat ? validatedData.center_lat.toString() : null,
      center_lng: validatedData.center_lng ? validatedData.center_lng.toString() : null,
      radius_km: validatedData.radius_km ? validatedData.radius_km.toString() : null,
      zone_type: validatedData.zone_type,
      control_faction: validatedData.control_faction || null,
      security_level: validatedData.security_level,
      climate: validatedData.climate,
      terrain_type: validatedData.terrain_type,
      population: validatedData.population,
      resources: validatedData.resources,
    }).returning();
    
    console.log('✅ [MAPPING] Created zone:', validatedData.zone_name);
    res.status(201).json(result[0]);
  } catch (error) {
    console.error('❌ [MAPPING] Failed to create zone:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create zone' });
  }
});

// === COORDINATE OPERATIONS ===

// Get locations within coordinate bounds
router.get('/coordinates/within-bounds', sessionAuth, async (req: Request, res: Response) => {
  try {
    const { north, south, east, west } = req.query;
    
    if (!north || !south || !east || !west) {
      return res.status(400).json({ error: 'Missing coordinate bounds' });
    }
    
    const result = await db.select()
      .from(gameLocations)
      .where(
        and(
          gte(sql`CAST(${gameLocations.latitude} AS DECIMAL)`, parseFloat(south as string)),
          lte(sql`CAST(${gameLocations.latitude} AS DECIMAL)`, parseFloat(north as string)),
          gte(sql`CAST(${gameLocations.longitude} AS DECIMAL)`, parseFloat(west as string)),
          lte(sql`CAST(${gameLocations.longitude} AS DECIMAL)`, parseFloat(east as string))
        )
      )
      .orderBy(desc(gameLocations.created_at));
    
    console.log('📍 [MAPPING] Found', result.length, 'locations within bounds');
    res.json(result);
  } catch (error) {
    console.error('❌ [MAPPING] Failed to get locations within bounds:', error);
    res.status(500).json({ error: 'Failed to retrieve locations within bounds' });
  }
});

// Find nearest locations to coordinates
router.get('/coordinates/nearest', sessionAuth, async (req: Request, res: Response) => {
  try {
    const { lat, lng, radius = 10, limit = 10 } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Missing latitude or longitude' });
    }
    
    // Using PostgreSQL's distance calculation
    const result = await db.execute(sql`
      SELECT *, 
        (6371 * acos(
          cos(radians(${parseFloat(lat as string)})) * cos(radians(CAST(latitude AS DECIMAL))) * 
          cos(radians(CAST(longitude AS DECIMAL)) - radians(${parseFloat(lng as string)})) + 
          sin(radians(${parseFloat(lat as string)})) * sin(radians(CAST(latitude AS DECIMAL)))
        )) AS distance_km
      FROM game_locations 
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
      HAVING distance_km <= ${parseFloat(radius as string)}
      ORDER BY distance_km ASC
      LIMIT ${parseInt(limit as string)}
    `);
    
    console.log('🎯 [MAPPING] Found', result.rows.length, 'nearest locations');
    res.json(result);
  } catch (error) {
    console.error('❌ [MAPPING] Failed to find nearest locations:', error);
    res.status(500).json({ error: 'Failed to find nearest locations' });
  }
});

// === IMAGE GENERATION ROUTES ===

// Generate map image for zone
router.post('/zones/:id/generate-image', sessionAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { prompt, style = 'fantasy map' } = req.body;
    
    // Get zone data
    const zoneResult = await db.select()
      .from(coordinateZones)
      .where(eq(coordinateZones.id, id))
      .limit(1);
    
    if (zoneResult.length === 0) {
      return res.status(404).json({ error: 'Zone not found' });
    }
    
    const zone = zoneResult[0];
    
    // Generate image with DALL-E
    const imagePrompt = prompt || `A detailed ${style} showing the ${zone.zone_name} region, featuring ${zone.terrain_type} terrain with ${zone.climate} climate. The area has ${zone.security_level} security and is controlled by ${zone.control_faction || 'neutral forces'}. Show key landmarks and geographical features in a top-down map view.`;
    
    console.log('🎨 [MAPPING] Generating image for zone:', zone.zone_name);
    
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: imagePrompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      style: "vivid"
    });
    
    const imageUrl = response.data?.[0]?.url;
    
    if (!imageUrl) {
      throw new Error('No image URL returned from OpenAI');
    }
    
    // Update zone with image URL
    await db.update(coordinateZones)
      .set({  
        map_image_url: imageUrl,
        map_generated: true,
        updated_at: new Date()
       } as any)
      .where(eq(coordinateZones.id, id));
    
    // Save to map assets
    await db.insert(mapAssets).values({
      asset_name: `${zone.zone_name} Map`,
      asset_type: 'zone_map',
      zone_id: id,
      image_url: imageUrl,
      prompt_used: imagePrompt,
      generation_metadata: { model: 'dall-e-3', size: '1024x1024', quality: 'standard' },
      asset_tags: [zone.terrain_type, zone.climate, style],
      created_by: 'riddleauthor',
    } as any);
    
    console.log('✅ [MAPPING] Generated map image for zone:', zone.zone_name);
    res.json({
      zone_id: id,
      zone_name: zone.zone_name,
      image_url: imageUrl,
      prompt_used: imagePrompt
    });
  } catch (error) {
    console.error('❌ [MAPPING] Failed to generate zone image:', error);
    res.status(500).json({ error: 'Failed to generate zone image' });
  }
});

// Generate location image
router.post('/locations/:id/generate-image', sessionAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { prompt, style = 'detailed landscape' } = req.body;
    
    // Get location data
    const locationResult = await db.select()
      .from(gameLocations)
      .where(eq(gameLocations.id, id))
      .limit(1);
    
    if (locationResult.length === 0) {
      return res.status(404).json({ error: 'Location not found' });
    }
    
    const location = locationResult[0];
    
    // Generate image with DALL-E
    const imagePrompt = prompt || `A ${style} view of ${location.name}, a ${location.location_type} located in the ${location.zone} zone. ${location.description}. The area has danger level ${location.danger_level}/10 and is ${location.accessibility} to travelers. Show the unique characteristics and atmosphere of this location.`;
    
    console.log('🎨 [MAPPING] Generating image for location:', location.name);
    
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: imagePrompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      style: "vivid"
    });
    
    const imageUrl = response.data?.[0]?.url;
    
    if (!imageUrl) {
      throw new Error('No image URL returned from OpenAI');
    }
    
    // Update location with image URL
    await db.update(gameLocations)
      .set({  
        map_image_url: imageUrl,
        updated_at: new Date()
       } as any)
      .where(eq(gameLocations.id, id));
    
    // Save to map assets
    await db.insert(mapAssets).values({
      asset_name: location.name,
      asset_type: 'location_image',
      location_id: id,
      image_url: imageUrl,
      prompt_used: imagePrompt,
      generation_metadata: { model: 'dall-e-3', size: '1024x1024', quality: 'standard' },
      coordinates: location.coordinates,
      asset_tags: [location.location_type, location.zone, style],
      created_by: 'riddleauthor',
    } as any);
    
    console.log('✅ [MAPPING] Generated image for location:', location.name);
    res.json({
      location_id: id,
      location_name: location.name,
      image_url: imageUrl,
      prompt_used: imagePrompt
    });
  } catch (error) {
    console.error('❌ [MAPPING] Failed to generate location image:', error);
    res.status(500).json({ error: 'Failed to generate location image' });
  }
});

// === STATUS AND LOGS ===

// Get location status logs
router.get('/locations/:id/logs', sessionAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit = 50 } = req.query;
    
    const result = await db.select()
      .from(locationStatusLogs)
      .where(eq(locationStatusLogs.location_id, id))
      .orderBy(desc(locationStatusLogs.created_at))
      .limit(parseInt(limit as string));
    
    console.log('📋 [MAPPING] Retrieved', result.length, 'status logs for location');
    res.json(result);
  } catch (error) {
    console.error('❌ [MAPPING] Failed to get location logs:', error);
    res.status(500).json({ error: 'Failed to retrieve location logs' });
  }
});

// Get map assets
router.get('/assets', sessionAuth, async (req: Request, res: Response) => {
  try {
    const { asset_type, zone_id, location_id, limit = 100 } = req.query;
    
    let query = db.select().from(mapAssets);
    
    // Apply filters
    const conditions = [];
    if (asset_type) {
      conditions.push(eq(mapAssets.asset_type, asset_type as string));
    }
    if (zone_id) {
      conditions.push(eq(mapAssets.zone_id, zone_id as string));
    }
    if (location_id) {
      conditions.push(eq(mapAssets.location_id, location_id as string));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    const result = await query
      .orderBy(desc(mapAssets.created_at))
      .limit(parseInt(limit as string));
    
    console.log('🎨 [MAPPING] Retrieved', result.length, 'map assets from database');
    res.json(result);
  } catch (error) {
    console.error('❌ [MAPPING] Failed to get map assets:', error);
    res.status(500).json({ error: 'Failed to retrieve map assets' });
  }
});

// === SAMPLE DATA CREATION ===

// Create sample data for testing
router.post('/sample-data', sessionAuth, async (req: Request, res: Response) => {
  try {
    // Create sample zones first
    const sampleZones = [
      {
        zone_name: 'Mystic Forest',
        description: 'A dense forest filled with ancient magic and mysterious creatures',
        boundaries: { north: 45.0, south: 40.0, east: -70.0, west: -75.0 },
        center_lat: '42.5',
        center_lng: '-72.5',
        radius_km: '50',
        zone_type: 'exploration',
        control_faction: 'Forest Guardians',
        security_level: 'moderate',
        climate: 'temperate',
        terrain_type: 'forest',
        population: 500,
        resources: { wood: 'abundant', herbs: 'common', crystals: 'rare' }
      },
      {
        zone_name: 'Dragon Peak Mountains',
        description: 'Towering peaks where ancient dragons once roamed',
        boundaries: { north: 50.0, south: 45.0, east: -65.0, west: -70.0 },
        center_lat: '47.5',
        center_lng: '-67.5',
        radius_km: '75',
        zone_type: 'dangerous',
        control_faction: 'Mountain Clans',
        security_level: 'high_danger',
        climate: 'alpine',
        terrain_type: 'mountains',
        population: 200,
        resources: { stone: 'abundant', ore: 'common', gems: 'uncommon' }
      }
    ];
    
    const createdZones = await db.insert(coordinateZones).values(sampleZones as any).returning();
    
    // Create sample locations
    const sampleLocations = [
      {
        name: 'Crystal Cave',
        description: 'A shimmering cave filled with magical crystals',
        zone: 'Mystic Forest',
        coordinates: { x: 100, y: 200, z: 50 },
        latitude: '42.3',
        longitude: '-72.7',
        elevation: 150,
        location_type: 'dungeon',
        danger_level: 3,
        resources: { crystals: 'abundant', water: 'pure' },
        accessibility: 'hidden',
        special_properties: { magical_resonance: 'high', light_source: 'natural' },
        discovered_by: 'system'
      },
      {
        name: 'Ancient Watchtower',
        description: 'A crumbling tower that once guarded the valley',
        zone: 'Dragon Peak Mountains',
        coordinates: { x: 300, y: 150, z: 200 },
        latitude: '47.8',
        longitude: '-67.2',
        elevation: 1200,
        location_type: 'landmark',
        danger_level: 1,
        resources: { stone: 'common', view: 'excellent' },
        accessibility: 'public',
        special_properties: { visibility: 'high', defensible: true },
        discovered_by: 'system'
      },
      {
        name: 'Troll Bridge',
        description: 'A stone bridge where travelers must pay a toll to a cunning troll',
        zone: 'Mystic Forest',
        coordinates: { x: 150, y: 180, z: 0 },
        latitude: '42.1',
        longitude: '-72.3',
        elevation: 50,
        location_type: 'encounter',
        danger_level: 4,
        resources: { toll_revenue: 'variable' },
        accessibility: 'public',
        special_properties: { npc_present: true, puzzle_required: true },
        discovered_by: 'system'
      }
    ];
    
    const createdLocations = await db.insert(gameLocations).values(sampleLocations as any).returning();
    
    console.log('✅ [MAPPING] Created sample data:', createdZones.length, 'zones,', createdLocations.length, 'locations');
    res.json({
      success: true,
      zones_created: createdZones.length,
      locations_created: createdLocations.length,
      message: 'Sample mapping data created successfully'
    });
  } catch (error) {
    console.error('❌ [MAPPING] Failed to create sample data:', error);
    res.status(500).json({ error: 'Failed to create sample data' });
  }
});

export default router;