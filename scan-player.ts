/**
 * Player NFT Ownership Scanner
 *
 * Usage:
 *   npm run scan:player -- <user_handle>
 *
 * Scans the player's Riddle wallet(s) on XRPL, syncs ownership to
 * inquisition_user_ownership, and prints a compact summary.
 */

import { nftOwnershipScanner } from './server/services/nft-ownership-scanner';

async function main() {
  const [, , handleArg] = process.argv;

  if (!handleArg || handleArg.startsWith('-')) {
    console.error('Usage: npm run scan:player -- <user_handle>');
    process.exit(1);
  }

  const userHandle = handleArg.trim();
  console.log(`\n🎮 Player Scanner: @${userHandle}`);

  try {
    const results = await nftOwnershipScanner.scanAllUserWallets(userHandle);

    if (!results || results.length === 0) {
      console.log('⚠️  No Riddle wallet found for this handle or no NFTs detected.');
      process.exit(0);
    }

    let totalNfts = 0;
    let totalPower = 0;
    for (const r of results) {
      totalNfts += r.total_nfts;
      totalPower += r.total_power;
    }

    console.log('\n===== Scan Summary =====');
    for (const r of results) {
      const collections = Object.entries(r.collections).map(([k, v]) => `${k} (${v.count})`).join(', ');
      console.log(`- Wallet: ${r.wallet_address} [${r.wallet_source || 'unknown'}]`);
      console.log(`  NFTs: ${r.total_nfts}, Power: ${r.total_power}`);
      if (collections) console.log(`  Collections: ${collections}`);
      if (r.new_nfts.length || r.removed_nfts.length) {
        console.log(`  Δ New: ${r.new_nfts.length}, Removed: ${r.removed_nfts.length}`);
      }
    }
    console.log('========================');
    console.log(`👑 Total NFTs: ${totalNfts}`);
    console.log(`⚡ Total Power: ${totalPower}`);

    process.exit(0);
  } catch (err: any) {
    console.error('❌ Player scan failed:', err?.message || err);
    process.exit(2);
  }
}

main();
