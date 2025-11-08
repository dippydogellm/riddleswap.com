import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { sessionAuth } from './middleware/session-auth';
import { OpenAI } from 'openai';

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
    
    let query = `
      SELECT 
        id, name, description, zone, coordinates, latitude, longitude,
        elevation, location_type, status, danger_level, resources,
        accessibility, special_properties, discovered_by, discovery_date,
        last_visited, visit_count, riddleauthor_notes, map_image_url,
        created_at, updated_at
      FROM game_locations
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramIndex = 1;
    
    if (zone) {
      query += ` AND zone = $${paramIndex}`;
      params.push(zone);
      paramIndex++;
    }
    
    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    if (location_type) {
      query += ` AND location_type = $${paramIndex}`;
      params.push(location_type);
      paramIndex++;
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
    params.push(parseInt(limit as string));
    
    const result = await db.execute(query, params);
    
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
    
    const result = await db.execute(
      'SELECT * FROM game_locations WHERE id = $1',
      [id]
    );
    
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
    
    const result = await db.execute(`
      INSERT INTO game_locations (
        name, description, zone, coordinates, latitude, longitude,
        elevation, location_type, status, danger_level, resources,
        accessibility, special_properties, discovered_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `, [
      validatedData.name,
      validatedData.description || '',
      validatedData.zone,
      JSON.stringify(validatedData.coordinates),
      validatedData.latitude || null,
      validatedData.longitude || null,
      validatedData.elevation,
      validatedData.location_type,
      'active',
      validatedData.danger_level,
      JSON.stringify(validatedData.resources),
      validatedData.accessibility,
      JSON.stringify(validatedData.special_properties),
      userHandle
    ]);
    
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
    const currentResult = await db.execute(
      'SELECT status, coordinates FROM game_locations WHERE id = $1',
      [id]
    );
    
    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Location not found' });
    }
    
    const currentLocation = currentResult.rows[0];
    
    // Update location status
    const updateResult = await db.execute(
      'UPDATE game_locations SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [validatedData.status, id]
    );
    
    // Log the status change
    await db.execute(`
      INSERT INTO location_status_logs (
        location_id, user_handle, status_change, previous_status, new_status,
        event_type, coordinates, details
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      id,
      userHandle,
      `Status changed from ${currentLocation.status} to ${validatedData.status}`,
      currentLocation.status,
      validatedData.status,
      validatedData.event_type || 'manual_update',
      currentLocation.coordinates,
      JSON.stringify(validatedData.details)
    ]);
    
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
    const result = await db.execute(`
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
    
    const result = await db.execute(`
      INSERT INTO coordinate_zones (
        zone_name, description, boundaries, center_lat, center_lng,
        radius_km, zone_type, control_faction, security_level,
        climate, terrain_type, population, resources
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [
      validatedData.zone_name,
      validatedData.description || '',
      JSON.stringify(validatedData.boundaries),
      validatedData.center_lat || null,
      validatedData.center_lng || null,
      validatedData.radius_km || null,
      validatedData.zone_type,
      validatedData.control_faction || null,
      validatedData.security_level,
      validatedData.climate,
      validatedData.terrain_type,
      validatedData.population,
      JSON.stringify(validatedData.resources)
    ]);
    
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
    
    const result = await db.execute(`
      SELECT * FROM game_locations 
      WHERE latitude BETWEEN $1 AND $2 
      AND longitude BETWEEN $3 AND $4
      ORDER BY created_at DESC
    `, [
      parseFloat(south as string),
      parseFloat(north as string),
      parseFloat(west as string),
      parseFloat(east as string)
    ]);
    
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
    const result = await db.execute(`
      SELECT *, 
        (6371 * acos(
          cos(radians($1)) * cos(radians(latitude)) * 
          cos(radians(longitude) - radians($2)) + 
          sin(radians($1)) * sin(radians(latitude))
        )) AS distance_km
      FROM game_locations 
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
      HAVING distance_km <= $3
      ORDER BY distance_km ASC
      LIMIT $4
    `, [
      parseFloat(lat as string),
      parseFloat(lng as string),
      parseFloat(radius as string),
      parseInt(limit as string)
    ]);
    
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
    const zoneResult = await db.execute(
      'SELECT * FROM coordinate_zones WHERE id = $1',
      [id]
    );
    
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
    await db.execute(
      'UPDATE coordinate_zones SET map_image_url = $1, map_generated = true, updated_at = NOW() WHERE id = $2',
      [imageUrl, id]
    );
    
    // Save to map assets
    await db.execute(`
      INSERT INTO map_assets (
        asset_name, asset_type, zone_id, image_url, prompt_used,
        generation_metadata, asset_tags, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      `${zone.zone_name} Map`,
      'zone_map',
      id,
      imageUrl,
      imagePrompt,
      JSON.stringify({ model: 'dall-e-3', size: '1024x1024', quality: 'standard' }),
      [zone.terrain_type, zone.climate, style],
      'riddleauthor'
    ]);
    
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
    const locationResult = await db.execute(
      'SELECT * FROM game_locations WHERE id = $1',
      [id]
    );
    
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
    await db.execute(
      'UPDATE game_locations SET map_image_url = $1, updated_at = NOW() WHERE id = $2',
      [imageUrl, id]
    );
    
    // Save to map assets
    await db.execute(`
      INSERT INTO map_assets (
        asset_name, asset_type, location_id, image_url, prompt_used,
        generation_metadata, coordinates, asset_tags, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      location.name,
      'location_image',
      id,
      imageUrl,
      imagePrompt,
      JSON.stringify({ model: 'dall-e-3', size: '1024x1024', quality: 'standard' }),
      location.coordinates,
      [location.location_type, location.zone, style],
      'riddleauthor'
    ]);
    
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
    
    const result = await db.execute(`
      SELECT * FROM location_status_logs 
      WHERE location_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `, [id, parseInt(limit as string)]);
    
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
    
    let query = 'SELECT * FROM map_assets WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;
    
    if (asset_type) {
      query += ` AND asset_type = $${paramIndex}`;
      params.push(asset_type);
      paramIndex++;
    }
    
    if (zone_id) {
      query += ` AND zone_id = $${paramIndex}`;
      params.push(zone_id);
      paramIndex++;
    }
    
    if (location_id) {
      query += ` AND location_id = $${paramIndex}`;
      params.push(location_id);
      paramIndex++;
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
    params.push(parseInt(limit as string));
    
    const result = await db.execute(query, params);
    
    console.log('🎨 [MAPPING] Retrieved', result.rows.length, 'map assets');
    res.json(result.rows);
  } catch (error) {
    console.error('❌ [MAPPING] Failed to get map assets:', error);
    res.status(500).json({ error: 'Failed to retrieve map assets' });
  }
});

export default router;