import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { sessionAuth } from './middleware/session-auth';
import { OpenAI } from 'openai';
import { db } from './db';
import { sql } from 'drizzle-orm';

// Simple storage interface for mapping data
const mappingStorage = {
  locations: new Map(),
  zones: new Map(),
  logs: new Map(),
  assets: new Map()
};

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
    
    const conditions: any[] = [];
    if (zone) conditions.push(sql`zone = ${zone as string}`);
    if (status) conditions.push(sql`status = ${status as string}`);
    if (location_type) conditions.push(sql`location_type = ${location_type as string}`);

    const whereClause = conditions.length ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;

    const result = await db.execute(sql`
      SELECT 
        id, name, description, zone, coordinates, latitude, longitude,
        elevation, location_type, status, danger_level, resources,
        accessibility, special_properties, discovered_by, discovery_date,
        last_visited, visit_count, riddleauthor_notes, map_image_url,
        created_at, updated_at
      FROM game_locations
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${parseInt(limit as string)}
    `);
    
    console.log('🗺️ [MAPPING] Retrieved', result.rows.length, 'locations');
    res.json(result.rows);
  } catch (error) {
    console.error('❌ [MAPPING] Failed to get locations:', error);
    res.status(500).json({ error: 'Failed to retrieve locations' });
  }
});

// Get specific location by ID
router.get('/locations/:id', sessionAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const result = await db.execute(sql`SELECT * FROM game_locations WHERE id = ${id}`);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Location not found' });
    }
    
    console.log('🎯 [MAPPING] Retrieved location:', result.rows[0].name);
    res.json(result.rows[0]);
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
    
    const result = await db.execute(sql`
      INSERT INTO game_locations (
        name, description, zone, coordinates, latitude, longitude,
        elevation, location_type, status, danger_level, resources,
        accessibility, special_properties, discovered_by
      ) VALUES (
        ${validatedData.name},
        ${validatedData.description || ''},
        ${validatedData.zone},
        ${JSON.stringify(validatedData.coordinates)},
        ${validatedData.latitude ?? null},
        ${validatedData.longitude ?? null},
        ${validatedData.elevation},
        ${validatedData.location_type},
        ${'active'},
        ${validatedData.danger_level},
        ${JSON.stringify(validatedData.resources)},
        ${validatedData.accessibility},
        ${JSON.stringify(validatedData.special_properties)},
        ${userHandle}
      )
      RETURNING *
    `);
    
    console.log('✅ [MAPPING] Created location:', validatedData.name);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('❌ [MAPPING] Failed to create location:', error);
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
    const currentResult = await db.execute(sql`SELECT status, coordinates FROM game_locations WHERE id = ${id}`);
    
    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Location not found' });
    }
    
    const currentLocation = currentResult.rows[0];
    
    // Update location status
    const updateResult = await db.execute(sql`
      UPDATE game_locations SET status = ${validatedData.status}, updated_at = NOW() WHERE id = ${id} RETURNING *
    `);
    
    // Log the status change
    await db.execute(sql`
      INSERT INTO location_status_logs (
        location_id, user_handle, status_change, previous_status, new_status,
        event_type, coordinates, details
      ) VALUES (
        ${id},
        ${userHandle},
        ${`Status changed from ${currentLocation.status} to ${validatedData.status}`},
        ${currentLocation.status},
        ${validatedData.status},
        ${validatedData.event_type || 'manual_update'},
        ${currentLocation.coordinates},
        ${JSON.stringify(validatedData.details)}
      )
    `);
    
    console.log('🔄 [MAPPING] Updated location status:', id, '→', validatedData.status);
    res.json(updateResult.rows[0]);
  } catch (error) {
    console.error('❌ [MAPPING] Failed to update location status:', error);
    res.status(500).json({ error: 'Failed to update location status' });
  }
});

// === ZONE MANAGEMENT ROUTES ===

// Get all zones
router.get('/zones', sessionAuth, async (req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT * FROM coordinate_zones 
      ORDER BY zone_name ASC
    `);
    
    console.log('🗺️ [MAPPING] Retrieved', result.rows.length, 'zones');
    res.json(result.rows);
  } catch (error) {
    console.error('❌ [MAPPING] Failed to get zones:', error);
    res.status(500).json({ error: 'Failed to retrieve zones' });
  }
});

// Create new zone
router.post('/zones', sessionAuth, async (req: Request, res: Response) => {
  try {
    const validatedData = createZoneSchema.parse(req.body);
    
    const result = await db.execute(sql`
      INSERT INTO coordinate_zones (
        zone_name, description, boundaries, center_lat, center_lng,
        radius_km, zone_type, control_faction, security_level,
        climate, terrain_type, population, resources
      ) VALUES (
        ${validatedData.zone_name},
        ${validatedData.description || ''},
        ${JSON.stringify(validatedData.boundaries)},
        ${validatedData.center_lat ?? null},
        ${validatedData.center_lng ?? null},
        ${validatedData.radius_km ?? null},
        ${validatedData.zone_type},
        ${validatedData.control_faction || null},
        ${validatedData.security_level},
        ${validatedData.climate},
        ${validatedData.terrain_type},
        ${validatedData.population},
        ${JSON.stringify(validatedData.resources)}
      )
      RETURNING *
    `);
    
    console.log('✅ [MAPPING] Created zone:', validatedData.zone_name);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('❌ [MAPPING] Failed to create zone:', error);
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
    
    const result = await db.execute(sql`
      SELECT * FROM game_locations 
      WHERE latitude BETWEEN ${parseFloat(south as string)} AND ${parseFloat(north as string)}
      AND longitude BETWEEN ${parseFloat(west as string)} AND ${parseFloat(east as string)}
      ORDER BY created_at DESC
    `);
    
    console.log('📍 [MAPPING] Found', result.rows.length, 'locations within bounds');
    res.json(result.rows);
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
    
    // Using Haversine formula for distance calculation
    const result = await db.execute(sql`
      SELECT *, 
        (6371 * acos(
          cos(radians(${parseFloat(lat as string)})) * cos(radians(latitude)) * 
          cos(radians(longitude) - radians(${parseFloat(lng as string)})) + 
          sin(radians(${parseFloat(lat as string)})) * sin(radians(latitude))
        )) AS distance_km
      FROM game_locations 
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
      HAVING distance_km <= ${parseFloat(radius as string)}
      ORDER BY distance_km ASC
      LIMIT ${parseInt(limit as string)}
    `);
    
    console.log('🎯 [MAPPING] Found', result.rows.length, 'nearest locations');
    res.json(result.rows);
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
    const zoneResult = await db.execute(sql`SELECT * FROM coordinate_zones WHERE id = ${id}`);
    
    if (zoneResult.rows.length === 0) {
      return res.status(404).json({ error: 'Zone not found' });
    }
    
    const zone = zoneResult.rows[0];
    
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
    
    const imageUrl = response.data[0].url;
    
    if (!imageUrl) {
      throw new Error('No image URL returned from OpenAI');
    }
    
    // Update zone with image URL
    await db.execute(sql`UPDATE coordinate_zones SET map_image_url = ${imageUrl}, map_generated = true, updated_at = NOW() WHERE id = ${id}`);
    
    // Save to map assets
    await db.execute(sql`
      INSERT INTO map_assets (
        asset_name, asset_type, zone_id, image_url, prompt_used,
        generation_metadata, asset_tags, created_by
      ) VALUES (
        ${`${zone.zone_name} Map`},
        ${'zone_map'},
        ${id},
        ${imageUrl},
        ${imagePrompt},
        ${JSON.stringify({ model: 'dall-e-3', size: '1024x1024', quality: 'standard' })},
        ${[zone.terrain_type, zone.climate, style] as any},
        ${'riddleauthor'}
      )
    `);
    
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
    const locationResult = await db.execute(sql`SELECT * FROM game_locations WHERE id = ${id}`);
    
    if (locationResult.rows.length === 0) {
      return res.status(404).json({ error: 'Location not found' });
    }
    
    const location = locationResult.rows[0];
    
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
    
    const imageUrl = response.data[0].url;
    
    if (!imageUrl) {
      throw new Error('No image URL returned from OpenAI');
    }
    
    // Update location with image URL
    await db.execute(sql`UPDATE game_locations SET map_image_url = ${imageUrl}, updated_at = NOW() WHERE id = ${id}`);
    
    // Save to map assets
    await db.execute(sql`
      INSERT INTO map_assets (
        asset_name, asset_type, location_id, image_url, prompt_used,
        generation_metadata, coordinates, asset_tags, created_by
      ) VALUES (
        ${location.name},
        ${'location_image'},
        ${id},
        ${imageUrl},
        ${imagePrompt},
        ${JSON.stringify({ model: 'dall-e-3', size: '1024x1024', quality: 'standard' })},
        ${location.coordinates},
        ${[location.location_type, location.zone, style] as any},
        ${'riddleauthor'}
      )
    `);
    
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
    
    const result = await db.execute(sql`
      SELECT * FROM location_status_logs 
      WHERE location_id = ${id}
      ORDER BY created_at DESC 
      LIMIT ${parseInt(limit as string)}
    `);
    
    console.log('📋 [MAPPING] Retrieved', result.rows.length, 'status logs for location');
    res.json(result.rows);
  } catch (error) {
    console.error('❌ [MAPPING] Failed to get location logs:', error);
    res.status(500).json({ error: 'Failed to retrieve location logs' });
  }
});

// Get map assets
router.get('/assets', sessionAuth, async (req: Request, res: Response) => {
  try {
    const { asset_type, zone_id, location_id, limit = 100 } = req.query;
    
    const assetConds: any[] = [];
    if (asset_type) assetConds.push(sql`asset_type = ${asset_type as string}`);
    if (zone_id) assetConds.push(sql`zone_id = ${zone_id as string}`);
    if (location_id) assetConds.push(sql`location_id = ${location_id as string}`);

    const assetWhere = assetConds.length ? sql`WHERE ${sql.join(assetConds, sql` AND `)}` : sql``;
    const result = await db.execute(sql`
      SELECT * FROM map_assets
      ${assetWhere}
      ORDER BY created_at DESC
      LIMIT ${parseInt(limit as string)}
    `);
    
    console.log('🎨 [MAPPING] Retrieved', result.rows.length, 'map assets');
    res.json(result.rows);
  } catch (error) {
    console.error('❌ [MAPPING] Failed to get map assets:', error);
    res.status(500).json({ error: 'Failed to retrieve map assets' });
  }
});

export default router;