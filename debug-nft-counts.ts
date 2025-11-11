import dotenv from 'dotenv';
dotenv.config();

import { db } from './server/db';
import { sql } from 'drizzle-orm';
import { inquisitionUserOwnership } from './shared/inquisition-audit-schema';
import { eq, and } from 'drizzle-orm';

async function debugNftCounts() {
  console.log('\n🔍 Debugging NFT Ownership Counts...\n');
  
  // Get raw counts from inquisition_user_ownership
  const ownershipCounts = await db.execute(sql`
    SELECT 
      user_handle, 
      COUNT(*) as nft_count,
      COUNT(DISTINCT nft_token_id) as unique_nfts
    FROM inquisition_user_ownership 
    WHERE is_current_owner = true 
      AND user_handle IS NOT NULL 
    GROUP BY user_handle 
    ORDER BY nft_count DESC
  `);
  
  console.log('📊 Raw Ownership Data:');
  console.log('================================================================================');
  const ownershipRows = (ownershipCounts.rows as any[]).map(r => ({
    user_handle: String(r.user_handle || ''),
    nft_count: Number(r.nft_count || 0),
    unique_nfts: Number(r.unique_nfts || 0)
  })) as Array<{ user_handle: string; nft_count: number; unique_nfts: number }>;
  for (const row of ownershipRows) {
    console.log(`  ${row.user_handle.padEnd(20)} - ${row.nft_count} records (${row.unique_nfts} unique NFTs)`);
  }
  
  // Now check what the scanner is seeing
  console.log('\n🔍 Testing Scanner Logic...\n');
  
  const testHandle: string | undefined = ownershipRows[0]?.user_handle;
  if (testHandle) {
    console.log(`Testing with: ${testHandle}\n`);
    
    // This is what the scanner does
    const ownedNfts = await db
      .select({
        nft_id: inquisitionUserOwnership.nft_token_id,
        user_handle: inquisitionUserOwnership.user_handle,
        is_current: inquisitionUserOwnership.is_current_owner
      })
      .from(inquisitionUserOwnership)
      .where(and(
        eq(inquisitionUserOwnership.user_handle, testHandle),
        eq(inquisitionUserOwnership.is_current_owner, true)
      ));
    
    console.log(`Scanner found ${ownedNfts.length} NFTs for ${testHandle}`);
    console.log('Sample NFTs:', ownedNfts.slice(0, 5).map(n => n.nft_id));
  }
  
  process.exit(0);
}

debugNftCounts().catch(console.error);
