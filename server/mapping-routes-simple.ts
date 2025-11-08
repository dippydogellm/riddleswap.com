import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { sessionAuth } from './middleware/session-auth';
import { OpenAI } from 'openai';

const router = Router();

// Initialize OpenAI for image generation
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// In-memory storage for demo purposes - in production this would use database
const mappingData = {
  locations: new Map<string, any>(),
  zones: new Map<string, any>(),
  logs: new Map<string, any[]>(),
  assets: new Map<string, any>(),
  nextId: 1
};

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

// Generate unique ID
function generateId(): string {
  return `map_${mappingData.nextId++}_${Date.now()}`;
}

// === LOCATION MANAGEMENT ROUTES ===

// Get all locations with optional filtering
router.get('/locations', sessionAuth, async (req: Request, res: Response) => {
  try {
    const { zone, status, location_type, limit = 100 } = req.query;
    
    let locations = Array.from(mappingData.locations.values());
    
    // Apply filters
    if (zone) {
      locations = locations.filter(loc => loc.zone === zone);
    }
    if (status) {
      locations = locations.filter(loc => loc.status === status);
    }
    if (location_type) {
      locations = locations.filter(loc => loc.location_type === location_type);
    }
    
    // Apply limit
    locations = locations.slice(0, parseInt(limit as string));
    
    console.log('🗺️ [MAPPING] Retrieved', locations.length, 'locations');
    res.json(locations);
  } catch (error) {
    console.error('❌ [MAPPING] Failed to get locations:', error);
    res.status(500).json({ error: 'Failed to retrieve locations' });
  }
});

// Get specific location by ID
router.get('/locations/:id', sessionAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const location = mappingData.locations.get(id);
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }
    
    console.log('🎯 [MAPPING] Retrieved location:', location.name);
    res.json(location);
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
    
    const id = generateId();
    const location = {
      id,
      ...validatedData,
      status: 'active',
      discovered_by: userHandle,
      discovery_date: new Date().toISOString(),
      last_visited: null,
      visit_count: 0,
      riddleauthor_notes: '',
      map_image_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    mappingData.locations.set(id, location);
    
    console.log('✅ [MAPPING] Created location:', validatedData.name);
    res.status(201).json(location);
  } catch (error) {
    console.error('❌ [MAPPING] Failed to create location:', error);
    res.status(500).json({ error: 'Failed to create location' });
  }
});

// Update location status
router.patch('/locations/:id/status', sessionAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, event_type = 'manual_update', details = {} } = req.body;
    const userHandle = (req as any).user?.handle || 'system';
    
    const location = mappingData.locations.get(id);
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }
    
    const previousStatus = location.status;
    location.status = status;
    location.updated_at = new Date().toISOString();
    
    // Log the status change
    const logId = generateId();
    const logEntry = {
      id: logId,
      location_id: id,
      user_handle: userHandle,
      status_change: `Status changed from ${previousStatus} to ${status}`,
      previous_status: previousStatus,
      new_status: status,
      event_type,
      coordinates: location.coordinates,
      details,
      riddleauthor_triggered: false,
      narrative_event: null,
      created_at: new Date().toISOString()
    };
    
    if (!mappingData.logs.has(id)) {
      mappingData.logs.set(id, []);
    }
    mappingData.logs.get(id)!.push(logEntry);
    
    console.log('🔄 [MAPPING] Updated location status:', id, '→', status);
    res.json(location);
  } catch (error) {
    console.error('❌ [MAPPING] Failed to update location status:', error);
    res.status(500).json({ error: 'Failed to update location status' });
  }
});

// === ZONE MANAGEMENT ROUTES ===

// Get all zones
router.get('/zones', sessionAuth, async (req: Request, res: Response) => {
  try {
    const zones = Array.from(mappingData.zones.values());
    
    console.log('🗺️ [MAPPING] Retrieved', zones.length, 'zones');
    res.json(zones);
  } catch (error) {
    console.error('❌ [MAPPING] Failed to get zones:', error);
    res.status(500).json({ error: 'Failed to retrieve zones' });
  }
});

// Create new zone
router.post('/zones', sessionAuth, async (req: Request, res: Response) => {
  try {
    const validatedData = createZoneSchema.parse(req.body);
    
    const id = generateId();
    const zone = {
      id,
      ...validatedData,
      riddleauthor_lore: '',
      map_generated: false,
      map_image_url: null,
      events_active: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    mappingData.zones.set(id, zone);
    
    console.log('✅ [MAPPING] Created zone:', validatedData.zone_name);
    res.status(201).json(zone);
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
    
    const locations = Array.from(mappingData.locations.values()).filter(location => {
      if (!location.latitude || !location.longitude) return false;
      
      return location.latitude >= parseFloat(south as string) &&
             location.latitude <= parseFloat(north as string) &&
             location.longitude >= parseFloat(west as string) &&
             location.longitude <= parseFloat(east as string);
    });
    
    console.log('📍 [MAPPING] Found', locations.length, 'locations within bounds');
    res.json(locations);
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
    
    const targetLat = parseFloat(lat as string);
    const targetLng = parseFloat(lng as string);
    const maxRadius = parseFloat(radius as string);
    
    // Calculate distance using Haversine formula
    const locations = Array.from(mappingData.locations.values())
      .filter(location => location.latitude && location.longitude)
      .map(location => {
        const lat1 = targetLat * Math.PI / 180;
        const lat2 = location.latitude * Math.PI / 180;
        const deltaLat = (location.latitude - targetLat) * Math.PI / 180;
        const deltaLng = (location.longitude - targetLng) * Math.PI / 180;
        
        const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
                  Math.cos(lat1) * Math.cos(lat2) *
                  Math.sin(deltaLng/2) * Math.sin(deltaLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = 6371 * c; // Earth's radius in km
        
        return { ...location, distance_km: distance };
      })
      .filter(location => location.distance_km <= maxRadius)
      .sort((a, b) => a.distance_km - b.distance_km)
      .slice(0, parseInt(limit as string));
    
    console.log('🎯 [MAPPING] Found', locations.length, 'nearest locations');
    res.json(locations);
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
    
    const zone = mappingData.zones.get(id);
    if (!zone) {
      return res.status(404).json({ error: 'Zone not found' });
    }
    
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
    
    const imageUrl = response.data[0]?.url;
    
    if (!imageUrl) {
      throw new Error('No image URL returned from OpenAI');
    }
    
    // Update zone with image URL
    zone.map_image_url = imageUrl;
    zone.map_generated = true;
    zone.updated_at = new Date().toISOString();
    
    // Save to map assets
    const assetId = generateId();
    const asset = {
      id: assetId,
      asset_name: `${zone.zone_name} Map`,
      asset_type: 'zone_map',
      zone_id: id,
      location_id: null,
      image_url: imageUrl,
      prompt_used: imagePrompt,
      generation_metadata: { model: 'dall-e-3', size: '1024x1024', quality: 'standard' },
      coordinates: null,
      asset_tags: [zone.terrain_type, zone.climate, style],
      usage_context: 'general',
      created_by: 'riddleauthor',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    mappingData.assets.set(assetId, asset);
    
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
    
    const location = mappingData.locations.get(id);
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }
    
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
    
    const imageUrl = response.data[0]?.url;
    
    if (!imageUrl) {
      throw new Error('No image URL returned from OpenAI');
    }
    
    // Update location with image URL
    location.map_image_url = imageUrl;
    location.updated_at = new Date().toISOString();
    
    // Save to map assets
    const assetId = generateId();
    const asset = {
      id: assetId,
      asset_name: location.name,
      asset_type: 'location_image',
      zone_id: null,
      location_id: id,
      image_url: imageUrl,
      prompt_used: imagePrompt,
      generation_metadata: { model: 'dall-e-3', size: '1024x1024', quality: 'standard' },
      coordinates: location.coordinates,
      asset_tags: [location.location_type, location.zone, style],
      usage_context: 'general',
      created_by: 'riddleauthor',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    mappingData.assets.set(assetId, asset);
    
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
    
    const logs = mappingData.logs.get(id) || [];
    const limitedLogs = logs.slice(-parseInt(limit as string));
    
    console.log('📋 [MAPPING] Retrieved', limitedLogs.length, 'status logs for location');
    res.json(limitedLogs);
  } catch (error) {
    console.error('❌ [MAPPING] Failed to get location logs:', error);
    res.status(500).json({ error: 'Failed to retrieve location logs' });
  }
});

// Get map assets
router.get('/assets', sessionAuth, async (req: Request, res: Response) => {
  try {
    const { asset_type, zone_id, location_id, limit = 100 } = req.query;
    
    let assets = Array.from(mappingData.assets.values());
    
    // Apply filters
    if (asset_type) {
      assets = assets.filter(asset => asset.asset_type === asset_type);
    }
    if (zone_id) {
      assets = assets.filter(asset => asset.zone_id === zone_id);
    }
    if (location_id) {
      assets = assets.filter(asset => asset.location_id === location_id);
    }
    
    // Apply limit
    assets = assets.slice(0, parseInt(limit as string));
    
    console.log('🎨 [MAPPING] Retrieved', assets.length, 'map assets');
    res.json(assets);
  } catch (error) {
    console.error('❌ [MAPPING] Failed to get map assets:', error);
    res.status(500).json({ error: 'Failed to retrieve map assets' });
  }
});

// === SAMPLE DATA CREATION ===

// Create sample data for testing
router.post('/sample-data', sessionAuth, async (req: Request, res: Response) => {
  try {
    // Create sample zones
    const zones = [
      {
        zone_name: 'Mystic Forest',
        description: 'A dense forest filled with ancient magic and mysterious creatures',
        boundaries: { north: 45.0, south: 40.0, east: -70.0, west: -75.0 },
        center_lat: 42.5,
        center_lng: -72.5,
        radius_km: 50,
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
        center_lat: 47.5,
        center_lng: -67.5,
        radius_km: 75,
        zone_type: 'dangerous',
        control_faction: 'Mountain Clans',
        security_level: 'high_danger',
        climate: 'alpine',
        terrain_type: 'mountains',
        population: 200,
        resources: { stone: 'abundant', ore: 'common', gems: 'uncommon' }
      }
    ];
    
    zones.forEach(zoneData => {
      const id = generateId();
      const zone = {
        id,
        ...zoneData,
        riddleauthor_lore: '',
        map_generated: false,
        map_image_url: null,
        events_active: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      mappingData.zones.set(id, zone);
    });
    
    // Create sample locations
    const locations = [
      {
        name: 'Crystal Cave',
        description: 'A shimmering cave filled with magical crystals',
        zone: 'Mystic Forest',
        coordinates: { x: 100, y: 200, z: 50 },
        latitude: 42.3,
        longitude: -72.7,
        elevation: 150,
        location_type: 'dungeon',
        danger_level: 3,
        resources: { crystals: 'abundant', water: 'pure' },
        accessibility: 'hidden',
        special_properties: { magical_resonance: 'high', light_source: 'natural' }
      },
      {
        name: 'Ancient Watchtower',
        description: 'A crumbling tower that once guarded the valley',
        zone: 'Dragon Peak Mountains',
        coordinates: { x: 300, y: 150, z: 200 },
        latitude: 47.8,
        longitude: -67.2,
        elevation: 1200,
        location_type: 'landmark',
        danger_level: 1,
        resources: { stone: 'common', view: 'excellent' },
        accessibility: 'public',
        special_properties: { visibility: 'high', defensible: true }
      },
      {
        name: 'Troll Bridge',
        description: 'A stone bridge where travelers must pay a toll to a cunning troll',
        zone: 'Mystic Forest',
        coordinates: { x: 150, y: 180, z: 0 },
        latitude: 42.1,
        longitude: -72.3,
        elevation: 50,
        location_type: 'encounter',
        danger_level: 4,
        resources: { toll_revenue: 'variable' },
        accessibility: 'public',
        special_properties: { npc_present: true, puzzle_required: true }
      }
    ];
    
    locations.forEach(locationData => {
      const id = generateId();
      const location = {
        id,
        ...locationData,
        status: 'active',
        discovered_by: 'system',
        discovery_date: new Date().toISOString(),
        last_visited: null,
        visit_count: 0,
        riddleauthor_notes: '',
        map_image_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      mappingData.locations.set(id, location);
    });
    
    console.log('✅ [MAPPING] Created sample data:', zones.length, 'zones,', locations.length, 'locations');
    res.json({
      success: true,
      zones_created: zones.length,
      locations_created: locations.length,
      message: 'Sample mapping data created successfully'
    });
  } catch (error) {
    console.error('❌ [MAPPING] Failed to create sample data:', error);
    res.status(500).json({ error: 'Failed to create sample data' });
  }
});

export default router;