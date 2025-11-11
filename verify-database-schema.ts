/**
 * Verify Database Schema for Background NFT Scanner
 * 
 * This script checks that all required fields exist in the database tables:
 * 1. gaming_nfts - stores NFT data with traits, images, and rarity scores
 * 2. gaming_nft_collections - stores collection metadata with AI scores
 * 3. project_master_cards - stores project/collection metadata
 * 4. project_score_cards - stores AI-generated trait scorecards
 */

import 'dotenv/config';
import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function verifySchema() {
  console.log('🔍 Verifying database schema...\n');

  try {
    // Check gaming_nfts table
    console.log('📋 Checking gaming_nfts table...');
    const nftColumns = await db.execute(sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'gaming_nfts'
      ORDER BY ordinal_position;
    `);
    
    const requiredNftFields = [
      'id', 'collection_id', 'token_id', 'nft_id', 'owner_address',
      'metadata', 'traits', 'image_url', 'name', 'description',
      'rarity_rank', 'rarity_score', 'trait_rarity_breakdown',
      'game_stats', 'created_at', 'updated_at'
    ];
    
    const nftFieldNames = nftColumns.rows.map((c: any) => c.column_name);
    const missingNftFields = requiredNftFields.filter(f => !nftFieldNames.includes(f));
    
    if (missingNftFields.length > 0) {
      console.log(`⚠️  Missing fields in gaming_nfts: ${missingNftFields.join(', ')}`);
    } else {
      console.log(`✅ All required fields present (${nftColumns.rows.length} total columns)`);
    }

    // Check gaming_nft_collections table
    console.log('\n📋 Checking gaming_nft_collections table...');
    const collectionColumns = await db.execute(sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'gaming_nft_collections'
      ORDER BY ordinal_position;
    `);
    
    const requiredCollectionFields = [
      'id', 'collection_name', 'collection_id', 'taxon',
      'ai_score', 'ai_analysis', 'created_at', 'updated_at'
    ];
    
    const collectionFieldNames = collectionColumns.rows.map((c: any) => c.column_name);
    const missingCollectionFields = requiredCollectionFields.filter(f => !collectionFieldNames.includes(f));
    
    if (missingCollectionFields.length > 0) {
      console.log(`⚠️  Missing fields in gaming_nft_collections: ${missingCollectionFields.join(', ')}`);
    } else {
      console.log(`✅ All required fields present (${collectionColumns.rows.length} total columns)`);
    }

    // Check project_master_cards table
    console.log('\n📋 Checking project_master_cards table...');
    const masterCardsResult = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'project_master_cards'
      );
    `);
    
    if (masterCardsResult.rows[0].exists) {
      const masterCardColumns = await db.execute(sql`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'project_master_cards'
        ORDER BY ordinal_position;
      `);
      console.log(`✅ Table exists with ${masterCardColumns.rows.length} columns`);
      console.log(`   Columns: ${masterCardColumns.rows.map((c: any) => c.column_name).join(', ')}`);
    } else {
      console.log('⚠️  Table does not exist - will be created by migration');
    }

    // Check project_score_cards table
    console.log('\n📋 Checking project_score_cards table...');
    const scoreCardsResult = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'project_score_cards'
      );
    `);
    
    if (scoreCardsResult.rows[0].exists) {
      const scoreCardColumns = await db.execute(sql`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'project_score_cards'
        ORDER BY ordinal_position;
      `);
      console.log(`✅ Table exists with ${scoreCardColumns.rows.length} columns`);
      
      const requiredScoreFields = [
        'id', 'project_id', 'trait_category', 'trait_value',
        'gaming_utility_score', 'visual_impact_score', 'rarity_value_score',
        'synergy_score', 'overall_trait_score', 'ai_reasoning'
      ];
      
      const scoreFieldNames = scoreCardColumns.rows.map((c: any) => c.column_name);
      const missingScoreFields = requiredScoreFields.filter(f => !scoreFieldNames.includes(f));
      
      if (missingScoreFields.length > 0) {
        console.log(`   ⚠️  Missing fields: ${missingScoreFields.join(', ')}`);
      } else {
        console.log(`   ✅ All AI scoring fields present`);
      }
    } else {
      console.log('⚠️  Table does not exist - will be created by migration');
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SCHEMA VERIFICATION SUMMARY\n');
    
    const allTablesExist = masterCardsResult.rows[0].exists && scoreCardsResult.rows[0].exists;
    const allFieldsPresent = missingNftFields.length === 0 && missingCollectionFields.length === 0;
    
    if (allTablesExist && allFieldsPresent) {
      console.log('✅ Database is ready for background NFT scanner');
      console.log('✅ All required tables and fields are present');
      console.log('\n🚀 You can now run: npm run scan:nfts');
    } else {
      console.log('⚠️  Database schema needs updates:');
      if (!allTablesExist) {
        console.log('   - Run: npx tsx apply-scorecard-migrations.js');
      }
      if (!allFieldsPresent) {
        console.log('   - Some fields are missing in core tables');
        console.log('   - Run the migration: npx tsx apply-scorecard-migrations.js');
      }
    }

    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Error verifying schema:', error);
    process.exit(1);
  }
}

// Run verification
verifySchema();
