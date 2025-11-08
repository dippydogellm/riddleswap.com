#!/usr/bin/env tsx
import { syncPlayerNFTs } from "../services/player-nft-sync";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { inquisitionNftAudit } from "@shared/inquisition-audit-schema";

async function syncLegendUser() {
  console.log("🚀 Starting manual NFT sync for legend user...");
  
  try {
    // First, let's update the NFT audit records to have proper power values
    // The legend user's NFTs currently have 0 power, let's assign them power based on their points
    const legendNFTs = await db
      .select()
      .from(inquisitionNftAudit)
      .where(eq(inquisitionNftAudit.current_owner, 'rEieK5YcvpdE2eCSrnx9PB159su7LL4mhd'));
    
    console.log(`Found ${legendNFTs.length} NFTs for legend user`);
    
    // Update each NFT with power values based on total points
    for (const nft of legendNFTs) {
      const totalPoints = parseFloat(String(nft.total_points)) || 0;
      
      // Distribute points across power categories
      const powerStrength = Math.floor(totalPoints * 0.3);
      const powerDefense = Math.floor(totalPoints * 0.3);
      const powerMagic = Math.floor(totalPoints * 0.2);
      const powerSpeed = Math.floor(totalPoints * 0.2);
      
      console.log(`Updating NFT ${nft.nft_token_id.substring(0, 10)}... with power values`);
      console.log(`  Points: ${totalPoints} -> S:${powerStrength}, D:${powerDefense}, M:${powerMagic}, Sp:${powerSpeed}`);
      
      await db.update(inquisitionNftAudit)
        .set({ 
          power_strength: String(powerStrength),
          power_defense: String(powerDefense),
          power_magic: String(powerMagic),
          power_speed: String(powerSpeed),
         } as any)
        .where(eq(inquisitionNftAudit.id, nft.id));
    }
    
    console.log("✅ Updated NFT power values");
    
    // Now sync the player's NFTs to update their gaming profile
    const stats = await syncPlayerNFTs('rEieK5YcvpdE2eCSrnx9PB159su7LL4mhd', 'legend');
    
    console.log("✅ Sync complete!");
    console.log("📊 Player Stats:", {
      total_nfts: stats.total_nfts,
      total_power: stats.total_power,
      army_power: stats.army_power,
      bank_power: stats.bank_power,
      merchant_power: stats.merchant_power,
      special_power: stats.special_power,
    });
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error syncing:", error);
    process.exit(1);
  }
}

syncLegendUser();