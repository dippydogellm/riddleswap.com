import type { Express } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";

export function registerCivilizationRoutes(app: Express) {
  
  // Get player's civilization data
  app.get("/api/player/civilization", async (req, res) => {
    try {
      const walletAddress = req.query.wallet || (req.session as any)?.walletAddress;
      
      if (!walletAddress) {
        return res.status(401).json({ error: "Wallet not connected" });
      }

      const result = await db.execute(sql`
        SELECT 
          wallet_address,
          civilization_name,
          army_power,
          religion_power,
          bank_power,
          merchant_power,
          special_power,
          total_power,
          army_count,
          religion_count,
          bank_count,
          merchant_count,
          special_count,
          land_count,
          ship_count,
          material_output,
          battle_readiness,
          overall_rank
        FROM player_civilizations
        WHERE wallet_address = ${walletAddress as string}
        LIMIT 1
      `);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Civilization not found" });
      }

      res.json(result.rows[0]);
    } catch (error: any) {
      console.error("Error fetching civilization:", error);
      res.status(500).json({ error: "Failed to fetch civilization data" });
    }
  });

  // Get top civilizations leaderboard
  app.get("/api/civilizations/leaderboard", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      
      const result = await db.execute(sql`
        SELECT 
          wallet_address,
          civilization_name,
          total_power,
          overall_rank,
          army_count,
          religion_count,
          bank_count,
          merchant_count,
          special_count,
          land_count,
          battle_readiness,
          material_output
        FROM player_civilizations
        ORDER BY overall_rank ASC
        LIMIT ${limit}
      `);

      res.json(result.rows);
    } catch (error: any) {
      console.error("Error fetching leaderboard:", error);
      res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
  });

  // Get civilization battle stats
  app.get("/api/player/civilization/battle-stats", async (req, res) => {
    try {
      const walletAddress = req.query.wallet || (req.session as any)?.walletAddress;
      
      if (!walletAddress) {
        return res.status(401).json({ error: "Wallet not connected" });
      }

      const result = await db.execute(sql`
        SELECT 
          c.wallet_address,
          c.battle_readiness,
          c.army_count,
          c.ship_count,
          c.special_count,
          COUNT(DISTINCT n.id) as total_nfts,
          AVG(n.rarity_score) as avg_rarity,
          MAX(n.rarity_score) as best_rarity
        FROM player_civilizations c
        LEFT JOIN gaming_nfts n ON n.owner_address = c.wallet_address
        WHERE c.wallet_address = ${walletAddress as string}
        GROUP BY c.wallet_address, c.battle_readiness, c.army_count, c.ship_count, c.special_count
      `);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Battle stats not found" });
      }

      res.json(result.rows[0]);
    } catch (error: any) {
      console.error("Error fetching battle stats:", error);
      res.status(500).json({ error: "Failed to fetch battle stats" });
    }
  });

  // Get player's NFT army details
  app.get("/api/player/civilization/army", async (req, res) => {
    try {
      const walletAddress = req.query.wallet || (req.session as any)?.walletAddress;
      
      if (!walletAddress) {
        return res.status(401).json({ error: "Wallet not connected" });
      }

      const result = await db.execute(sql`
        SELECT 
          n.id,
          n.name,
          n.game_role,
          n.rarity_rank,
          n.rarity_score,
          n.image_url,
          c.collection_name
        FROM gaming_nfts n
        LEFT JOIN gaming_nft_collections c ON c.id = n.collection_id
        WHERE n.owner_address = ${walletAddress as string}
          AND (n.game_role = 'army' OR c.game_role = 'army')
        ORDER BY n.rarity_score DESC
        LIMIT 100
      `);

      res.json(result.rows);
    } catch (error: any) {
      console.error("Error fetching army:", error);
      res.status(500).json({ error: "Failed to fetch army details" });
    }
  });

  // Compare two civilizations
  app.get("/api/civilizations/compare", async (req, res) => {
    try {
      const wallet1 = req.query.wallet1 as string;
      const wallet2 = req.query.wallet2 as string;

      if (!wallet1 || !wallet2) {
        return res.status(400).json({ error: "Both wallet addresses required" });
      }

      const result = await db.execute(sql`
        SELECT 
          wallet_address,
          civilization_name,
          total_power,
          army_power,
          religion_power,
          bank_power,
          merchant_power,
          special_power,
          army_count,
          religion_count,
          bank_count,
          merchant_count,
          special_count,
          land_count,
          ship_count,
          battle_readiness,
          material_output,
          overall_rank
        FROM player_civilizations
        WHERE wallet_address IN (${wallet1}, ${wallet2})
        ORDER BY overall_rank ASC
      `);

      res.json(result.rows);
    } catch (error: any) {
      console.error("Error comparing civilizations:", error);
      res.status(500).json({ error: "Failed to compare civilizations" });
    }
  });
}
