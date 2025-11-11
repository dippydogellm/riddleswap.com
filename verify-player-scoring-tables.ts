/**
 * Verify Player Scoring Database Tables
 * 
 * Checks that all required tables exist for the player scoring system
 */

import dotenv from 'dotenv';
dotenv.config();

import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function verifyTables() {
  console.log(`\n📊 Verifying Player Scoring Database Tables...\n`);
  
  const requiredTables = [
    'gaming_players',
    'gaming_nfts',
    'gaming_nft_collections',
    'nft_power_attributes',
    'social_profiles',
    'riddle_wallets',
    'inquisition_user_ownership',
    'inquisition_nft_audit'
  ];
  
  let allTablesExist = true;
  
  for (const tableName of requiredTables) {
    try {
      const result = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = ${tableName}
        );
      `);
      
      const exists = result.rows[0]?.exists;
      
      if (exists) {
        // Count rows
        const countResult = await db.execute(sql`SELECT COUNT(*) as count FROM ${sql.identifier(tableName)}`);
        const count = countResult.rows[0]?.count || 0;
        console.log(`✅ ${tableName.padEnd(30)} - ${count} rows`);
      } else {
        console.log(`❌ ${tableName.padEnd(30)} - MISSING`);
        allTablesExist = false;
      }
    } catch (error: any) {
      console.log(`❌ ${tableName.padEnd(30)} - ERROR: ${error.message}`);
      allTablesExist = false;
    }
  }
  
  console.log(`\n${allTablesExist ? '✅' : '❌'} Database ${allTablesExist ? 'Ready' : 'NOT Ready'} for Player Scoring\n`);
  
  if (!allTablesExist) {
    console.log(`⚠️  Run database migrations or create missing tables before running player scanner.\n`);
    process.exit(1);
  }
  
  // Check for sample data in key tables
  console.log(`\n📋 Checking for data availability...\n`);
  
  try {
    const ownersResult = await db.execute(sql`
      SELECT COUNT(DISTINCT user_handle) as unique_players
      FROM inquisition_user_ownership
      WHERE is_current_owner = true AND user_handle IS NOT NULL
    `);
    const uniquePlayers = ownersResult.rows[0]?.unique_players || 0;
    console.log(`   Players with NFTs: ${uniquePlayers}`);
    
    if (uniquePlayers === 0) {
      console.log(`\n⚠️  No players found with NFT ownership. Run NFT scanner first.\n`);
      process.exit(1);
    }
    
    const nftsResult = await db.execute(sql`
      SELECT COUNT(*) as total_nfts
      FROM gaming_nfts
    `);
    const totalNfts = nftsResult.rows[0]?.total_nfts || 0;
    console.log(`   Total gaming NFTs: ${totalNfts}`);
    
    const collectionsResult = await db.execute(sql`
      SELECT COUNT(*) as total_collections
      FROM gaming_nft_collections
    `);
    const totalCollections = collectionsResult.rows[0]?.total_collections || 0;
    console.log(`   Gaming collections: ${totalCollections}`);
    
  } catch (error: any) {
    console.error(`\n❌ Data check failed: ${error.message}\n`);
    process.exit(1);
  }
  
  console.log(`\n✅ Database is ready for player scoring!\n`);
  process.exit(0);
}

verifyTables().catch((error) => {
  console.error(`\n❌ Verification failed:`, error);
  process.exit(1);
});
