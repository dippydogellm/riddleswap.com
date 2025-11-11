import { db } from '../server/db';
import { sql, eq, and, isNotNull } from 'drizzle-orm';
import { riddleWallets, gamingNfts, gamingPlayers } from '../shared/schema';
import { inquisitionUserOwnership } from '../shared/inquisition-audit-schema';

async function main() {
  console.log('\n🔎 Player Scoring Diagnostics');

  // 1) Owners by handle vs wallet
  const owners = await db
    .select({
      user_handle: inquisitionUserOwnership.user_handle,
      wallet_address: inquisitionUserOwnership.wallet_address
    })
    .from(inquisitionUserOwnership)
    .where(eq(inquisitionUserOwnership.is_current_owner, true));

  const walletRecords = await db
    .select({
      handle: riddleWallets.handle,
      linked: riddleWallets.linkedWalletAddress,
      eth: riddleWallets.ethAddress,
      xrp: riddleWallets.xrpAddress,
      sol: riddleWallets.solAddress,
      btc: riddleWallets.btcAddress,
    })
    .from(riddleWallets);

  const addressToHandle = new Map<string, string>();
  for (const w of walletRecords) {
    [w.linked, w.eth, w.xrp, w.sol, w.btc].filter(Boolean).forEach((addr) => {
      addressToHandle.set(addr as string, w.handle);
    });
  }

  let handlesWithOwnership = new Set<string>();
  let walletOnlyParticipants = new Set<string>();
  let unmatchedAddresses = new Set<string>();

  for (const o of owners) {
    const addr = o.wallet_address || '';
    if (o.user_handle) {
      handlesWithOwnership.add(o.user_handle);
    } else if (addr) {
      const resolved = addressToHandle.get(addr);
      if (resolved) handlesWithOwnership.add(resolved);
      else walletOnlyParticipants.add(addr);
    }
  }

  console.log(`\n• Distinct owners (user_handle present): ${handlesWithOwnership.size}`);
  console.log(`• Wallet-only addresses (no user_handle mapping): ${walletOnlyParticipants.size}`);

  // 2) Coverage of gaming_nfts join
  const missingGamingNfts = await db
    .select({ c: sql`COUNT(*)`.as('c') })
    .from(inquisitionUserOwnership)
    .leftJoin(gamingNfts, eq(gamingNfts.nft_id, inquisitionUserOwnership.nft_token_id))
    .where(and(eq(inquisitionUserOwnership.is_current_owner, true), sql`${gamingNfts.id} IS NULL`));

  console.log(`• Ownership entries missing gaming_nfts: ${missingGamingNfts[0]?.c || 0}`);

  // 3) Duplicates in gaming_players
  const dupes = await db.execute(sql`SELECT user_handle, COUNT(*) AS c FROM gaming_players GROUP BY user_handle HAVING COUNT(*) > 1 ORDER BY c DESC LIMIT 20;`);
  console.log(`• Duplicate handles in gaming_players: ${dupes.rows.length}`);
  if (dupes.rows.length) console.log(dupes.rows);

  // 4) Players without wallet_address
  const noWallet = await db.execute(sql`SELECT COUNT(*) AS c FROM gaming_players WHERE wallet_address IS NULL OR wallet_address = ''`);
  console.log(`• Players missing wallet_address: ${noWallet.rows[0]?.c}`);

  console.log('\n✅ Diagnostics complete');
}

main().catch((e) => { console.error(e); process.exit(1); });
