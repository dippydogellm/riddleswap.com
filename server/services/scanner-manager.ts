import { Pool } from '@neondatabase/serverless';
import type { Request, Response } from 'express';

// Scanner types
export type ScannerType = 'nft_rarity' | 'civilization' | 'riddlecity' | 'land_plots' | 'collections';

interface ScannerStatus {
  type: ScannerType;
  name: string;
  status: 'idle' | 'running' | 'error' | 'completed';
  lastRun: string | null;
  nextRun: string | null;
  itemsProcessed: number;
  totalItems: number;
  duration: number | null;
  error: string | null;
  progress: number;
}

interface ScannerConfig {
  enabled: boolean;
  interval: number; // minutes
  autoStart: boolean;
}

class ScannerManager {
  private db: Pool;
  private scanners: Map<ScannerType, ScannerStatus> = new Map();
  private configs: Map<ScannerType, ScannerConfig> = new Map();
  private runningScans: Map<ScannerType, boolean> = new Map();
  private intervals: Map<ScannerType, NodeJS.Timeout> = new Map();

  constructor(db: Pool) {
    this.db = db;
    this.initializeScanners();
  }

  private initializeScanners() {
    const scannerDefinitions: Array<{ type: ScannerType; name: string; interval: number }> = [
      { type: 'nft_rarity', name: 'NFT Rarity Scanner', interval: 180 },
      { type: 'civilization', name: 'Civilization Power Scanner', interval: 60 },
      { type: 'riddlecity', name: 'RiddleCity Scanner', interval: 120 },
      { type: 'land_plots', name: 'Land Plots Scanner', interval: 240 },
      { type: 'collections', name: 'Collections Scanner', interval: 360 },
    ];

    scannerDefinitions.forEach(({ type, name, interval }) => {
      this.scanners.set(type, {
        type,
        name,
        status: 'idle',
        lastRun: null,
        nextRun: null,
        itemsProcessed: 0,
        totalItems: 0,
        duration: null,
        error: null,
        progress: 0,
      });

      this.configs.set(type, {
        enabled: true,
        interval,
        autoStart: type === 'nft_rarity' || type === 'civilization', // Auto-start critical scanners
      });

      this.runningScans.set(type, false);
    });

    console.log('🔧 [SCANNER-MANAGER] Initialized', this.scanners.size, 'scanners');
  }

  // Start all auto-start scanners
  public startAutoScanners() {
    console.log('🚀 [SCANNER-MANAGER] Starting auto-start scanners...');
    
    this.configs.forEach((config, type) => {
      if (config.enabled && config.autoStart) {
        this.scheduleScanner(type);
      }
    });
  }

  // Schedule a scanner to run at intervals
  private scheduleScanner(type: ScannerType) {
    const config = this.configs.get(type);
    if (!config || !config.enabled) return;

    // Clear existing interval if any
    const existingInterval = this.intervals.get(type);
    if (existingInterval) {
      clearInterval(existingInterval);
    }

    // Run immediately
    this.runScanner(type);

    // Schedule recurring runs
    const interval = setInterval(() => {
      this.runScanner(type);
    }, config.interval * 60 * 1000);

    this.intervals.set(type, interval);

    const status = this.scanners.get(type);
    if (status) {
      status.nextRun = new Date(Date.now() + config.interval * 60 * 1000).toISOString();
    }

    console.log(`⏰ [SCANNER-MANAGER] Scheduled ${type} every ${config.interval} minutes`);
  }

  // Run a specific scanner
  public async runScanner(type: ScannerType): Promise<void> {
    const isRunning = this.runningScans.get(type);
    if (isRunning) {
      console.log(`⏭️ [SCANNER-MANAGER] ${type} already running, skipping...`);
      return;
    }

    const status = this.scanners.get(type);
    if (!status) return;

    this.runningScans.set(type, true);
    status.status = 'running';
    status.itemsProcessed = 0;
    status.totalItems = 0;
    status.error = null;
    status.progress = 0;

    const startTime = Date.now();
    console.log(`▶️ [SCANNER-MANAGER] Starting ${type}...`);

    try {
      switch (type) {
        case 'nft_rarity':
          await this.scanNFTRarity(status);
          break;
        case 'civilization':
          await this.scanCivilizations(status);
          break;
        case 'riddlecity':
          await this.scanRiddleCity(status);
          break;
        case 'land_plots':
          await this.scanLandPlots(status);
          break;
        case 'collections':
          await this.scanCollections(status);
          break;
      }

      status.status = 'completed';
      status.duration = Date.now() - startTime;
      status.lastRun = new Date().toISOString();
      status.progress = 100;

      // Set next run time
      const config = this.configs.get(type);
      if (config) {
        status.nextRun = new Date(Date.now() + config.interval * 60 * 1000).toISOString();
      }

      console.log(`✅ [SCANNER-MANAGER] ${type} completed in ${status.duration}ms - ${status.itemsProcessed}/${status.totalItems} items`);
    } catch (error) {
      status.status = 'error';
      status.error = error instanceof Error ? error.message : String(error);
      status.duration = Date.now() - startTime;
      status.lastRun = new Date().toISOString();
      console.error(`❌ [SCANNER-MANAGER] ${type} failed:`, error);
    } finally {
      this.runningScans.set(type, false);
      
      // Reset to idle after a delay
      setTimeout(() => {
        if (status.status === 'completed' || status.status === 'error') {
          status.status = 'idle';
        }
      }, 5000);
    }
  }

  // NFT Rarity Scanner
  private async scanNFTRarity(status: ScannerStatus): Promise<void> {
    // Get all collections
    const collectionsResult = await this.db.query(`
      SELECT DISTINCT collection_id 
      FROM gaming_nfts 
      WHERE collection_id IS NOT NULL
    `);

    status.totalItems = collectionsResult.rows.length;

    for (const row of collectionsResult.rows) {
      const collectionId = row.collection_id;

      // Calculate rarity scores and ranks for this collection using game_stats JSON
      await this.db.query(`
        WITH rarity_calc AS (
          SELECT 
            id,
            collection_id,
            COALESCE(
              (COALESCE((game_stats->>'army_power')::numeric, 0) * 2) +
              (COALESCE((game_stats->>'religion_power')::numeric, 0) * 1.5) +
              (COALESCE((game_stats->>'bank_power')::numeric, 0) * 1.8) +
              (COALESCE((game_stats->>'merchant_power')::numeric, 0) * 1.3) +
              (COALESCE((game_stats->>'special_power')::numeric, 0) * 2.5) +
              (COALESCE((game_stats->>'land_power')::numeric, 0) * 1.2) +
              (COALESCE((game_stats->>'ship_power')::numeric, 0) * 1.4) +
              (COALESCE((game_stats->>'total_power')::numeric, 0)),
              0
            ) as calculated_rarity,
            ROW_NUMBER() OVER (PARTITION BY collection_id ORDER BY 
              (COALESCE((game_stats->>'army_power')::numeric, 0) * 2) +
              (COALESCE((game_stats->>'religion_power')::numeric, 0) * 1.5) +
              (COALESCE((game_stats->>'bank_power')::numeric, 0) * 1.8) +
              (COALESCE((game_stats->>'merchant_power')::numeric, 0) * 1.3) +
              (COALESCE((game_stats->>'special_power')::numeric, 0) * 2.5) +
              (COALESCE((game_stats->>'land_power')::numeric, 0) * 1.2) +
              (COALESCE((game_stats->>'ship_power')::numeric, 0) * 1.4) +
              (COALESCE((game_stats->>'total_power')::numeric, 0)) DESC
            ) as calculated_rank
          FROM gaming_nfts
          WHERE collection_id = $1
        )
        UPDATE gaming_nfts
        SET 
          rarity_score = rarity_calc.calculated_rarity,
          rarity_rank = rarity_calc.calculated_rank::integer,
          updated_at = NOW()
        FROM rarity_calc
        WHERE gaming_nfts.id = rarity_calc.id
      `, [collectionId]);

      status.itemsProcessed++;
      status.progress = Math.round((status.itemsProcessed / status.totalItems) * 100);
    }
  }

  // Civilization Scanner
  private async scanCivilizations(status: ScannerStatus): Promise<void> {
    // Get all unique owners
    const ownersResult = await this.db.query(`
      SELECT DISTINCT owner_address 
      FROM gaming_nfts 
      WHERE owner_address IS NOT NULL AND owner_address != ''
    `);

    status.totalItems = ownersResult.rows.length;

    for (const row of ownersResult.rows) {
      const ownerAddress = row.owner_address;

      // Calculate civilization powers
      const powerResult = await this.db.query(`
        SELECT 
          COUNT(*) as nft_count,
          SUM(COALESCE(army_power, 0)) as total_army,
          SUM(COALESCE(religion_power, 0)) as total_religion,
          SUM(COALESCE(bank_power, 0)) as total_bank,
          SUM(COALESCE(merchant_power, 0)) as total_merchant,
          SUM(COALESCE(special_power, 0)) as total_special,
          SUM(COALESCE(land_power, 0)) as total_land,
          SUM(COALESCE(ship_power, 0)) as total_ship,
          SUM(COALESCE(rarity_score, 0)) as total_rarity
        FROM gaming_nfts
        WHERE owner_address = $1
      `, [ownerAddress]);

      const powers = powerResult.rows[0];
      
      // Calculate total power and battle readiness
      const totalPower = 
        (powers.total_army || 0) * 2 +
        (powers.total_religion || 0) * 1.5 +
        (powers.total_bank || 0) * 1.8 +
        (powers.total_merchant || 0) * 1.3 +
        (powers.total_special || 0) * 2.5 +
        (powers.total_land || 0) * 1.2 +
        (powers.total_ship || 0) * 1.4;

      const battleReadiness = Math.min(100, Math.round(
        ((powers.total_army || 0) / Math.max(1, powers.nft_count || 1)) * 10
      ));

      // Upsert civilization data
      await this.db.query(`
        INSERT INTO player_civilizations (
          player_address,
          total_nfts,
          army_power,
          religion_power,
          bank_power,
          merchant_power,
          special_power,
          land_power,
          ship_power,
          total_power,
          battle_readiness,
          last_calculated
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        ON CONFLICT (player_address) 
        DO UPDATE SET
          total_nfts = EXCLUDED.total_nfts,
          army_power = EXCLUDED.army_power,
          religion_power = EXCLUDED.religion_power,
          bank_power = EXCLUDED.bank_power,
          merchant_power = EXCLUDED.merchant_power,
          special_power = EXCLUDED.special_power,
          land_power = EXCLUDED.land_power,
          ship_power = EXCLUDED.ship_power,
          total_power = EXCLUDED.total_power,
          battle_readiness = EXCLUDED.battle_readiness,
          last_calculated = NOW()
      `, [
        ownerAddress,
        powers.nft_count || 0,
        powers.total_army || 0,
        powers.total_religion || 0,
        powers.total_bank || 0,
        powers.total_merchant || 0,
        powers.total_special || 0,
        powers.total_land || 0,
        powers.total_ship || 0,
        totalPower,
        battleReadiness
      ]);

      status.itemsProcessed++;
      status.progress = Math.round((status.itemsProcessed / status.totalItems) * 100);
    }
  }

  // RiddleCity Scanner
  private async scanRiddleCity(status: ScannerStatus): Promise<void> {
    // Ensure riddlecity_plots table exists
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS riddlecity_plots (
        id SERIAL PRIMARY KEY,
        plot_number INTEGER UNIQUE NOT NULL,
        owner_address TEXT,
        city_name TEXT,
        district TEXT,
        plot_type TEXT,
        building_level INTEGER DEFAULT 0,
        population INTEGER DEFAULT 0,
        resources_gold INTEGER DEFAULT 0,
        resources_wood INTEGER DEFAULT 0,
        resources_stone INTEGER DEFAULT 0,
        resources_food INTEGER DEFAULT 0,
        total_value NUMERIC DEFAULT 0,
        last_updated TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.db.query(`
      CREATE INDEX IF NOT EXISTS idx_riddlecity_owner ON riddlecity_plots(owner_address)
    `);

    // Get all land NFTs
    const landResult = await this.db.query(`
      SELECT 
        nft_token_id,
        owner_address,
        name,
        metadata
      FROM gaming_nfts
      WHERE game_role = 'Land' OR collection_name ILIKE '%city%' OR collection_name ILIKE '%land%'
    `);

    status.totalItems = landResult.rows.length;

    for (const land of landResult.rows) {
      // Extract plot number from name or token
      const plotNumber = this.extractPlotNumber(land.name, land.nft_token_id);
      
      // Parse metadata for building info
      let metadata: any = {};
      try {
        metadata = typeof land.metadata === 'string' ? JSON.parse(land.metadata) : land.metadata;
      } catch (e) {
        // Ignore parse errors
      }

      // Extract city info
      const cityName = metadata.city_name || metadata.city || `City #${Math.floor(plotNumber / 100)}`;
      const district = metadata.district || this.determineDistrict(plotNumber);
      const plotType = metadata.plot_type || metadata.type || 'residential';
      const buildingLevel = metadata.building_level || 0;

      // Calculate resources based on building level and plot type
      const resources = this.calculatePlotResources(plotType, buildingLevel);

      // Upsert plot data
      await this.db.query(`
        INSERT INTO riddlecity_plots (
          plot_number,
          owner_address,
          city_name,
          district,
          plot_type,
          building_level,
          resources_gold,
          resources_wood,
          resources_stone,
          resources_food,
          total_value,
          last_updated
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        ON CONFLICT (plot_number)
        DO UPDATE SET
          owner_address = EXCLUDED.owner_address,
          city_name = EXCLUDED.city_name,
          district = EXCLUDED.district,
          plot_type = EXCLUDED.plot_type,
          building_level = EXCLUDED.building_level,
          resources_gold = EXCLUDED.resources_gold,
          resources_wood = EXCLUDED.resources_wood,
          resources_stone = EXCLUDED.resources_stone,
          resources_food = EXCLUDED.resources_food,
          total_value = EXCLUDED.total_value,
          last_updated = NOW()
      `, [
        plotNumber,
        land.owner_address,
        cityName,
        district,
        plotType,
        buildingLevel,
        resources.gold,
        resources.wood,
        resources.stone,
        resources.food,
        resources.total
      ]);

      status.itemsProcessed++;
      status.progress = Math.round((status.itemsProcessed / status.totalItems) * 100);
    }
  }

  // Land Plots Scanner
  private async scanLandPlots(status: ScannerStatus): Promise<void> {
    // This is a lighter version focusing on basic land ownership
    const landResult = await this.db.query(`
      SELECT id, nft_token_id, owner_address 
      FROM gaming_nfts 
      WHERE game_role = 'Land'
    `);

    status.totalItems = landResult.rows.length;

    for (const land of landResult.rows) {
      // Update last scanned timestamp
      await this.db.query(`
        UPDATE gaming_nfts 
        SET last_scanned_at = NOW() 
        WHERE id = $1
      `, [land.id]);

      status.itemsProcessed++;
      status.progress = Math.round((status.itemsProcessed / status.totalItems) * 100);
    }
  }

  // Collections Scanner
  private async scanCollections(status: ScannerStatus): Promise<void> {
    // Get collection statistics
    const collectionsResult = await this.db.query(`
      SELECT 
        collection_id,
        collection_name,
        COUNT(*) as nft_count,
        COUNT(DISTINCT owner_address) as unique_owners,
        AVG(rarity_score) as avg_rarity
      FROM gaming_nfts
      WHERE collection_id IS NOT NULL
      GROUP BY collection_id, collection_name
    `);

    status.totalItems = collectionsResult.rows.length;

    for (const collection of collectionsResult.rows) {
      // Update collection metadata (would need a collections table)
      // For now, just count as processed
      status.itemsProcessed++;
      status.progress = Math.round((status.itemsProcessed / status.totalItems) * 100);
    }
  }

  // Helper methods
  private extractPlotNumber(name: string, tokenId: string): number {
    // Try to extract from name
    const nameMatch = name?.match(/\d+/);
    if (nameMatch) return parseInt(nameMatch[0]);

    // Fallback to token ID
    const tokenMatch = tokenId?.match(/\d+/);
    if (tokenMatch) return parseInt(tokenMatch[0]);

    return Math.floor(Math.random() * 10000);
  }

  private determineDistrict(plotNumber: number): string {
    const districts = ['Central', 'North', 'South', 'East', 'West', 'Harbor', 'Market', 'Industrial'];
    return districts[plotNumber % districts.length];
  }

  private calculatePlotResources(plotType: string, buildingLevel: number): {
    gold: number;
    wood: number;
    stone: number;
    food: number;
    total: number;
  } {
    const baseMultiplier = (buildingLevel + 1) * 10;
    
    const typeMultipliers: Record<string, any> = {
      residential: { gold: 1, wood: 0.5, stone: 0.5, food: 1.5 },
      commercial: { gold: 2, wood: 0.3, stone: 0.3, food: 0.5 },
      industrial: { gold: 1.5, wood: 1.5, stone: 2, food: 0.3 },
      agricultural: { gold: 0.5, wood: 1, stone: 0.3, food: 3 },
      military: { gold: 1, wood: 1, stone: 2, food: 1 },
    };

    const multipliers = typeMultipliers[plotType] || typeMultipliers.residential;

    const resources = {
      gold: Math.floor(baseMultiplier * multipliers.gold),
      wood: Math.floor(baseMultiplier * multipliers.wood),
      stone: Math.floor(baseMultiplier * multipliers.stone),
      food: Math.floor(baseMultiplier * multipliers.food),
      total: 0
    };

    resources.total = resources.gold + resources.wood + resources.stone + resources.food;
    return resources;
  }

  // Public API methods
  public getAllStatuses(): ScannerStatus[] {
    return Array.from(this.scanners.values());
  }

  public getStatus(type: ScannerType): ScannerStatus | undefined {
    return this.scanners.get(type);
  }

  public async startScanner(type: ScannerType): Promise<void> {
    const config = this.configs.get(type);
    if (config) {
      config.enabled = true;
      this.scheduleScanner(type);
    }
  }

  public stopScanner(type: ScannerType): void {
    const interval = this.intervals.get(type);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(type);
    }

    const status = this.scanners.get(type);
    if (status) {
      status.nextRun = null;
    }

    console.log(`⏹️ [SCANNER-MANAGER] Stopped ${type}`);
  }

  public updateConfig(type: ScannerType, config: Partial<ScannerConfig>): void {
    const currentConfig = this.configs.get(type);
    if (currentConfig) {
      Object.assign(currentConfig, config);
      
      // Restart if interval changed
      if (config.interval && currentConfig.enabled) {
        this.stopScanner(type);
        this.scheduleScanner(type);
      }
    }
  }

  public stopAll(): void {
    console.log('🛑 [SCANNER-MANAGER] Stopping all scanners...');
    this.intervals.forEach((interval, type) => {
      clearInterval(interval);
      this.stopScanner(type);
    });
  }
}

export default ScannerManager;
