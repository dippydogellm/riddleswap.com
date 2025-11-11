import dotenv from 'dotenv';
dotenv.config();

import { db } from './server/db';
import { sql, eq, and } from 'drizzle-orm';
import { gamingNfts, nftPowerAttributes } from './shared/schema';
import { inquisitionUserOwnership } from './shared/inquisition-audit-schema';

async function debugJoinIssue() {
  console.log('\n🔍 Debugging Join Issues...\n');
  
  const testHandle = 'orangepeels';
  
  // Step 1: Get owned NFT IDs
  console.log(`Step 1: NFTs owned by ${testHandle}:`);
  const owned = await db
    .select({
      nft_token_id: inquisitionUserOwnership.nft_token_id
    })
    .from(inquisitionUserOwnership)
    .where(and(
      eq(inquisitionUserOwnership.user_handle, testHandle),
      eq(inquisitionUserOwnership.is_current_owner, true)
    ))
    .limit(5);
  
  console.log(`  Found ${owned.length} NFTs (showing first 5)`);
  owned.forEach(o => console.log(`    ${o.nft_token_id}`));
  
  // Step 2: Check if those NFTs exist in gaming_nfts
  console.log(`\nStep 2: Checking gaming_nfts table:`);
  const testNftId = owned[0]?.nft_token_id;
  if (testNftId) {
    const gamingNft = await db
      .select()
      .from(gamingNfts)
      .where(eq(gamingNfts.nft_id, testNftId));
    
    console.log(`  Looking for NFT: ${testNftId}`);
    console.log(`  Found in gaming_nfts: ${gamingNft.length > 0 ? 'YES' : 'NO'}`);
    if (gamingNft.length > 0) {
      console.log(`  Gaming NFT ID: ${gamingNft[0].id}`);
      console.log(`  Collection ID: ${gamingNft[0].collection_id}`);
      console.log(`  Rarity Rank: ${gamingNft[0].rarity_rank}`);
    }
  }
  
  // Step 3: Test the full join
  console.log(`\nStep 3: Testing full join query:`);
  const joinResult = await db
    .select({
      nft_token_id: inquisitionUserOwnership.nft_token_id,
      gaming_nft_id: gamingNfts.id,
      collection_id: gamingNfts.collection_id,
      rarity_rank: gamingNfts.rarity_rank,
      has_power: sql<boolean>`${nftPowerAttributes.id} IS NOT NULL`.as('has_power')
    })
    .from(inquisitionUserOwnership)
    .leftJoin(gamingNfts, eq(gamingNfts.nft_id, inquisitionUserOwnership.nft_token_id))
    .leftJoin(nftPowerAttributes, eq(nftPowerAttributes.nft_id, gamingNfts.id))
    .where(and(
      eq(inquisitionUserOwnership.user_handle, testHandle),
      eq(inquisitionUserOwnership.is_current_owner, true)
    ))
    .limit(5);
  
  console.log(`  Join returned ${joinResult.length} rows (showing first 5):`);
  joinResult.forEach(r => {
    console.log(`    NFT: ${r.nft_token_id?.substring(0, 20)}...`);
    console.log(`      Gaming NFT ID: ${r.gaming_nft_id || 'NULL'}`);
    console.log(`      Collection: ${r.collection_id || 'NULL'}`);
    console.log(`      Rarity: ${r.rarity_rank || 'NULL'}`);
    console.log(`      Has Power: ${r.has_power}`);
  });
  
  process.exit(0);
}

debugJoinIssue().catch(console.error);
