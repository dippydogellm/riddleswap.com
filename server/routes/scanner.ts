import type { Express, Request, Response } from 'express';
import { db } from '../db';
import ScannerManager from '../services/scanner-manager';
import { sql } from 'drizzle-orm';

// Initialize scanner manager
let scannerManager: ScannerManager | null = null;

export function initializeScannerManager() {
  if (!scannerManager) {
    // Pass the underlying pool client from drizzle
    scannerManager = new ScannerManager((db as any).$client);
    scannerManager.startAutoScanners();
    console.log('✅ [SCANNER-API] Scanner manager initialized');
  }
  return scannerManager;
}

export function registerScannerRoutes(app: Express) {
  console.log('🔧 Registering Scanner Management routes...');

  // Ensure scanner manager is initialized
  if (!scannerManager) {
    scannerManager = initializeScannerManager();
  }

  // Get all scanner statuses
  app.get('/api/admin/scanners/status', async (req: Request, res: Response) => {
    try {
      if (!scannerManager) {
        return res.status(500).json({ error: 'Scanner manager not initialized' });
      }

      const statuses = scannerManager.getAllStatuses();
      res.json({ success: true, scanners: statuses });
    } catch (error) {
      console.error('Error fetching scanner statuses:', error);
      res.status(500).json({ error: 'Failed to fetch scanner statuses' });
    }
  });

  // Get specific scanner status
  app.get('/api/admin/scanners/status/:type', async (req: Request, res: Response) => {
    try {
      if (!scannerManager) {
        return res.status(500).json({ error: 'Scanner manager not initialized' });
      }

      const { type } = req.params;
      const status = scannerManager.getStatus(type as any);

      if (!status) {
        return res.status(404).json({ error: 'Scanner not found' });
      }

      res.json({ success: true, scanner: status });
    } catch (error) {
      console.error('Error fetching scanner status:', error);
      res.status(500).json({ error: 'Failed to fetch scanner status' });
    }
  });

  // Start a scanner
  app.post('/api/admin/scanners/start/:type', async (req: Request, res: Response) => {
    try {
      if (!scannerManager) {
        return res.status(500).json({ error: 'Scanner manager not initialized' });
      }

      const { type } = req.params;
      await scannerManager.startScanner(type as any);

      res.json({ 
        success: true, 
        message: `Scanner ${type} started successfully`,
        scanner: scannerManager.getStatus(type as any)
      });
    } catch (error) {
      console.error('Error starting scanner:', error);
      res.status(500).json({ error: 'Failed to start scanner' });
    }
  });

  // Stop a scanner
  app.post('/api/admin/scanners/stop/:type', async (req: Request, res: Response) => {
    try {
      if (!scannerManager) {
        return res.status(500).json({ error: 'Scanner manager not initialized' });
      }

      const { type } = req.params;
      scannerManager.stopScanner(type as any);

      res.json({ 
        success: true, 
        message: `Scanner ${type} stopped successfully`,
        scanner: scannerManager.getStatus(type as any)
      });
    } catch (error) {
      console.error('Error stopping scanner:', error);
      res.status(500).json({ error: 'Failed to stop scanner' });
    }
  });

  // Run a scanner immediately
  app.post('/api/admin/scanners/run/:type', async (req: Request, res: Response) => {
    try {
      if (!scannerManager) {
        return res.status(500).json({ error: 'Scanner manager not initialized' });
      }

      const { type } = req.params;
      
      // Run scanner asynchronously
      scannerManager.runScanner(type as any).catch(error => {
        console.error(`Error running scanner ${type}:`, error);
      });

      res.json({ 
        success: true, 
        message: `Scanner ${type} started`,
        scanner: scannerManager.getStatus(type as any)
      });
    } catch (error) {
      console.error('Error running scanner:', error);
      res.status(500).json({ error: 'Failed to run scanner' });
    }
  });

  // Update scanner configuration
  app.put('/api/admin/scanners/config/:type', async (req: Request, res: Response) => {
    try {
      if (!scannerManager) {
        return res.status(500).json({ error: 'Scanner manager not initialized' });
      }

      const { type } = req.params;
      const { enabled, interval, autoStart } = req.body;

      const config: any = {};
      if (typeof enabled === 'boolean') config.enabled = enabled;
      if (typeof interval === 'number') config.interval = interval;
      if (typeof autoStart === 'boolean') config.autoStart = autoStart;

      scannerManager.updateConfig(type as any, config);

      res.json({ 
        success: true, 
        message: `Scanner ${type} configuration updated`,
        scanner: scannerManager.getStatus(type as any)
      });
    } catch (error) {
      console.error('Error updating scanner config:', error);
      res.status(500).json({ error: 'Failed to update scanner configuration' });
    }
  });

  // Get RiddleCity plots
  app.get('/api/riddlecity/plots', async (req: Request, res: Response) => {
    try {
      const { owner, district, type, limit = 50, offset = 0 } = req.query;

      let query = 'SELECT * FROM riddlecity_plots WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (owner) {
        query += ` AND owner_address = $${paramIndex++}`;
        params.push(owner);
      }

      if (district) {
        query += ` AND district = $${paramIndex++}`;
        params.push(district);
      }

      if (type) {
        query += ` AND plot_type = $${paramIndex++}`;
        params.push(type);
      }

      query += ` ORDER BY plot_number LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
      params.push(limit, offset);

      const result = await (db as any).$client.query(query, params);

      // Get total count
      let countQuery = 'SELECT COUNT(*) FROM riddlecity_plots WHERE 1=1';
      const countParams: any[] = [];
      let countIndex = 1;

      if (owner) {
        countQuery += ` AND owner_address = $${countIndex++}`;
        countParams.push(owner);
      }

      if (district) {
        countQuery += ` AND district = $${countIndex++}`;
        countParams.push(district);
      }

      if (type) {
        countQuery += ` AND plot_type = $${countIndex++}`;
        countParams.push(type);
      }

      const countResult = await (db as any).$client.query(countQuery, countParams);
      const totalCount = parseInt(countResult.rows[0]?.count || '0');

      res.json({
        success: true,
        plots: result.rows,
        pagination: {
          total: totalCount,
          limit: Number(limit),
          offset: Number(offset),
          hasMore: Number(offset) + result.rows.length < totalCount
        }
      });
    } catch (error) {
      console.error('Error fetching RiddleCity plots:', error);
      res.status(500).json({ error: 'Failed to fetch plots' });
    }
  });

  // Get RiddleCity plot by number
  app.get('/api/riddlecity/plots/:plotNumber', async (req: Request, res: Response) => {
    try {
      const { plotNumber } = req.params;

      const result = await (db as any).$client.query(
        'SELECT * FROM riddlecity_plots WHERE plot_number = $1',
        [plotNumber]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Plot not found' });
      }

      res.json({ success: true, plot: result.rows[0] });
    } catch (error) {
      console.error('Error fetching plot:', error);
      res.status(500).json({ error: 'Failed to fetch plot' });
    }
  });

  // Get RiddleCity statistics
  app.get('/api/riddlecity/stats', async (req: Request, res: Response) => {
    try {
      const statsResult = await (db as any).$client.query(`
        SELECT 
          COUNT(*) as total_plots,
          COUNT(DISTINCT owner_address) as unique_owners,
          COUNT(DISTINCT city_name) as total_cities,
          COUNT(DISTINCT district) as total_districts,
          SUM(resources_gold) as total_gold,
          SUM(resources_wood) as total_wood,
          SUM(resources_stone) as total_stone,
          SUM(resources_food) as total_food,
          SUM(total_value) as total_value,
          AVG(building_level) as avg_building_level
        FROM riddlecity_plots
      `);

      const typeDistribution = await (db as any).$client.query(`
        SELECT plot_type, COUNT(*) as count
        FROM riddlecity_plots
        GROUP BY plot_type
        ORDER BY count DESC
      `);

      const topOwners = await (db as any).$client.query(`
        SELECT 
          owner_address,
          COUNT(*) as plot_count,
          SUM(total_value) as total_value
        FROM riddlecity_plots
        WHERE owner_address IS NOT NULL
        GROUP BY owner_address
        ORDER BY plot_count DESC
        LIMIT 10
      `);

      res.json({
        success: true,
        stats: statsResult.rows[0],
        typeDistribution: typeDistribution.rows,
        topOwners: topOwners.rows
      });
    } catch (error) {
      console.error('Error fetching RiddleCity stats:', error);
      res.status(500).json({ error: 'Failed to fetch statistics' });
    }
  });

  console.log('✅ Scanner Management routes registered successfully');
}

// Export for use in other modules
export { scannerManager };
