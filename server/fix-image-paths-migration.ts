/**
 * Database Migration: Fix Image Paths
 * Ensures all AI-generated image URLs in the database have proper /api/storage/ prefix
 */

import { db } from './db';
import { gamingNfts, aiGeneratedImages, inquisitionPlayerProfiles, medievalLandPlots } from '../shared/schema';
import { inquisitionNftAudit } from '../shared/inquisition-audit-schema';
import { sql } from 'drizzle-orm';
import { normalizeImagePath, isExpiredDalleUrl } from './image-path-utils';

interface MigrationStats {
  table: string;
  totalRows: number;
  fixedRows: number;
  expiredUrls: number;
}

/**
 * Fix image paths in a specific table
 */
async function fixImagePathsInTable(
  tableName: string,
  table: any,
  imageColumns: string[]
): Promise<MigrationStats> {
  console.log(`\n🔍 Checking ${tableName}...`);
  
  const stats: MigrationStats = {
    table: tableName,
    totalRows: 0,
    fixedRows: 0,
    expiredUrls: 0,
  };
  
  try {
    // Fetch all rows
    const rows = await db.select().from(table);
    stats.totalRows = rows.length;
    
    console.log(`  📊 Found ${rows.length} total rows`);
    
    // Process each row
    for (const row of rows) {
      let needsUpdate = false;
      const updates: Record<string, any> = {};
      
      // Check each image column
      for (const column of imageColumns) {
        const currentValue = (row as any)[column];
        
        if (!currentValue) continue;
        
        // Check if it's an expired DALL-E URL
        if (isExpiredDalleUrl(currentValue)) {
          console.log(`  ⚠️  Expired DALL-E URL found in ${tableName}.${column}: ${currentValue.substring(0, 60)}...`);
          stats.expiredUrls++;
          // Don't fix expired URLs - they need to be regenerated
          continue;
        }
        
        // Normalize the path
        const normalizedPath = normalizeImagePath(currentValue);
        
        // If it changed, mark for update
        if (normalizedPath && normalizedPath !== currentValue) {
          console.log(`  🔧 Fixing ${column}: ${currentValue} → ${normalizedPath}`);
          updates[column] = normalizedPath;
          needsUpdate = true;
        }
      }
      
      // Update if needed
      if (needsUpdate) {
        await db
          .update(table)
          .set({  ...updates, updated_at: new Date()  } as any)
          .where(sql`${table.id} = ${(row as any).id}`);
        
        stats.fixedRows++;
      }
    }
    
    console.log(`  ✅ Fixed ${stats.fixedRows} rows in ${tableName}`);
    if (stats.expiredUrls > 0) {
      console.log(`  ⚠️  Found ${stats.expiredUrls} expired DALL-E URLs that need regeneration`);
    }
    
  } catch (error: any) {
    console.error(`  ❌ Error processing ${tableName}:`, error.message);
  }
  
  return stats;
}

/**
 * Run the migration across all tables with image URLs
 */
export async function runImagePathMigration(): Promise<void> {
  console.log('🚀 Starting Image Path Migration...\n');
  console.log('This will fix all image URLs to use proper /api/storage/ prefix\n');
  
  const allStats: MigrationStats[] = [];
  
  // 1. Fix gaming NFTs (ai_generated_image_url, image_url)
  const gamingNftsStats = await fixImagePathsInTable(
    'gaming_nfts',
    gamingNfts,
    ['ai_generated_image_url', 'image_url']
  );
  allStats.push(gamingNftsStats);
  
  // 2. Fix AI generated images (output_image_url, input_image_url)
  const aiImagesStats = await fixImagePathsInTable(
    'ai_generated_images',
    aiGeneratedImages,
    ['output_image_url', 'input_image_url']
  );
  allStats.push(aiImagesStats);
  
  // 3. Fix Inquisition player profiles (profile_image_url)
  const playerProfilesStats = await fixImagePathsInTable(
    'inquisition_player_profiles',
    inquisitionPlayerProfiles,
    ['profile_image_url']
  );
  allStats.push(playerProfilesStats);
  
  // 4. Fix Inquisition NFT audit (image_url, ai_generated_image_url)
  const inquisitionAuditStats = await fixImagePathsInTable(
    'inquisition_nft_audit',
    inquisitionNftAudit,
    ['image_url', 'ai_generated_image_url']
  );
  allStats.push(inquisitionAuditStats);
  
  // 5. Fix medieval land plots (image_url)
  const landPlotsStats = await fixImagePathsInTable(
    'medieval_land_plots',
    medievalLandPlots,
    ['image_url']
  );
  allStats.push(landPlotsStats);
  
  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 MIGRATION SUMMARY');
  console.log('='.repeat(60));
  
  let totalFixed = 0;
  let totalExpired = 0;
  let totalRows = 0;
  
  for (const stats of allStats) {
    totalFixed += stats.fixedRows;
    totalExpired += stats.expiredUrls;
    totalRows += stats.totalRows;
    
    console.log(`\n${stats.table}:`);
    console.log(`  Total rows: ${stats.totalRows}`);
    console.log(`  Fixed: ${stats.fixedRows}`);
    console.log(`  Expired URLs: ${stats.expiredUrls}`);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`✅ Migration Complete!`);
  console.log(`   Total rows processed: ${totalRows}`);
  console.log(`   Total paths fixed: ${totalFixed}`);
  console.log(`   Total expired URLs: ${totalExpired}`);
  console.log('='.repeat(60) + '\n');
  
  if (totalExpired > 0) {
    console.log('⚠️  WARNING: Found expired DALL-E URLs');
    console.log('   These images need to be regenerated as they expire after ~1 hour');
    console.log('   All NEW images are automatically saved to permanent storage\n');
  }
}

// DISABLED: Auto-run migration to prevent production startup crashes
// This migration was scanning 11,000+ database rows on every startup
// causing deployment timeouts and 500 errors
// Only run manually via admin endpoint: POST /api/admin/image-storage/run-migration
/*
if (import.meta.url === `file://${process.argv[1]}`) {
  runImagePathMigration()
    .then(() => {
      console.log('✅ Migration script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration script failed:', error);
      process.exit(1);
    });
}
*/
