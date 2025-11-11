import 'dotenv/config';
import { db } from './server/db';
// NOTE: Using a relative import instead of the shared alias so this script can be
// executed directly with ts-node/node without requiring tsconfig-paths/register.
// If you prefer to keep the alias, install `tsconfig-paths` and run with:
//   node -r ts-node/register -r tsconfig-paths/register check-collections.ts
// or (with tsx):
//   tsx -r tsconfig-paths/register check-collections.ts
import { gamingNftCollections, gamingNfts } from './shared/schema';
import { sql } from 'drizzle-orm';

async function checkCollections() {
  console.log('🔍 Checking gaming_nft_collections table...\n');
  
  try {
    // Get all collections
    const collections = await db.select().from(gamingNftCollections);
    
    console.log(`📦 Found ${collections.length} collections\n`);
    
    if (collections.length > 0) {
      console.log('Collections:');
      for (const col of collections) {
        console.log(`  - ${col.collection_name} (Taxon: ${col.taxon}, ID: ${col.collection_id})`);
        
        // Count NFTs for this collection
        const nftCount = await db.select({ count: sql<number>`count(*)` })
          .from(gamingNfts)
          .where(sql`${gamingNfts.collection_id} = ${col.id}`);
        
        console.log(`    NFTs: ${nftCount[0]?.count || 0}`);
      }
    } else {
      console.log('⚠️  No collections found in gaming_nft_collections table');
      console.log('\nPlease run the data population script first.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkCollections();
