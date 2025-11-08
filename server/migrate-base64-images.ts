/**
 * ONE-TIME MIGRATION: Convert base64 images to Object Storage URLs
 * Run this script to fix existing base64 data in gaming_players table
 * 
 * Usage: tsx server/migrate-base64-images.ts
 */

import { db } from "./db";
import { gamingPlayers } from "../shared/schema";
import { unifiedStorage } from "./unified-storage";
import { eq } from "drizzle-orm";

async function migrateBase64Images() {
  console.log("🔄 [MIGRATION] Starting base64 to Object Storage migration...\n");
  
  try {
    // Get all players
    const players = await db.select().from(gamingPlayers);
    
    console.log(`📊 [MIGRATION] Found ${players.length} players to check\n`);
    
    let convertedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const player of players) {
      console.log(`\n👤 [MIGRATION] Checking player: ${player.user_handle}`);
      
      const updates: any = {};
      let hasUpdates = false;
      
      // Check commander_profile_image
      if (player.commander_profile_image && player.commander_profile_image.startsWith('data:image/')) {
        console.log(`  🔄 Converting commander_profile_image (${player.commander_profile_image.length} chars)...`);
        
        try {
          const matches = player.commander_profile_image.match(/^data:image\/(\w+);base64,(.+)$/);
          if (matches) {
            const [, format, base64Data] = matches;
            const buffer = Buffer.from(base64Data, 'base64');
            const mimeType = `image/${format}`;
            
            const objectStorageUrl = await unifiedStorage.uploadFile(buffer, 'profile', mimeType);
            updates.commander_profile_image = objectStorageUrl;
            hasUpdates = true;
            convertedCount++;
            
            console.log(`  ✅ Converted commander_profile_image: ${objectStorageUrl}`);
          } else {
            console.warn(`  ⚠️ Invalid data URI format for commander_profile_image`);
            errorCount++;
          }
        } catch (error: any) {
          console.error(`  ❌ Error converting commander_profile_image:`, error.message);
          errorCount++;
        }
      } else if (player.commander_profile_image) {
        console.log(`  ✓ commander_profile_image already a URL: ${player.commander_profile_image.substring(0, 50)}...`);
        skippedCount++;
      }
      
      // Check crest_image
      if (player.crest_image && player.crest_image.startsWith('data:image/')) {
        console.log(`  🔄 Converting crest_image (${player.crest_image.length} chars)...`);
        
        try {
          const matches = player.crest_image.match(/^data:image\/(\w+);base64,(.+)$/);
          if (matches) {
            const [, format, base64Data] = matches;
            const buffer = Buffer.from(base64Data, 'base64');
            const mimeType = `image/${format}`;
            
            const objectStorageUrl = await unifiedStorage.uploadFile(buffer, 'generated', mimeType);
            updates.crest_image = objectStorageUrl;
            hasUpdates = true;
            convertedCount++;
            
            console.log(`  ✅ Converted crest_image: ${objectStorageUrl}`);
          } else {
            console.warn(`  ⚠️ Invalid data URI format for crest_image`);
            errorCount++;
          }
        } catch (error: any) {
          console.error(`  ❌ Error converting crest_image:`, error.message);
          errorCount++;
        }
      } else if (player.crest_image) {
        console.log(`  ✓ crest_image already a URL: ${player.crest_image.substring(0, 50)}...`);
        skippedCount++;
      }
      
      // Update database if we have changes
      if (hasUpdates) {
        await db.update(gamingPlayers)
          .set({ 
            ...updates,
            updated_at: new Date()
           } as any)
          .where(eq(gamingPlayers.user_handle, player.user_handle));
        
        console.log(`  💾 Database updated for ${player.user_handle}`);
      } else {
        console.log(`  ⏭️ No updates needed for ${player.user_handle}`);
      }
    }
    
    console.log("\n\n" + "=".repeat(60));
    console.log("✅ [MIGRATION] COMPLETE!");
    console.log("=".repeat(60));
    console.log(`📊 Statistics:`);
    console.log(`   - Total players checked: ${players.length}`);
    console.log(`   - Images converted: ${convertedCount}`);
    console.log(`   - Images already URLs: ${skippedCount}`);
    console.log(`   - Errors: ${errorCount}`);
    console.log("=".repeat(60) + "\n");
    
  } catch (error: any) {
    console.error("\n❌ [MIGRATION] FATAL ERROR:", error);
    throw error;
  }
}

// Run migration
migrateBase64Images()
  .then(() => {
    console.log("🎉 Migration completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Migration failed:", error);
    process.exit(1);
  });
