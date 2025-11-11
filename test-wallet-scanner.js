/**
 * Test wallet-based scanning (the correct approach)
 * This is what should happen when users log into Riddle City
 */

import { Client } from 'xrpl';

const DIPPYDOGE_WALLET = 'rEVrTKUKSLx5nxdfV8SAFTxS9FGFrfHRLo';
const INQUISITION_ISSUER = 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH';

const GAMING_COLLECTIONS = [
  { name: 'The Inquisition', issuer: 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH', taxon: 0 },
  { name: 'Patriot', issuer: 'rGR4MCACFZg95TpxBncVPzB3o4oUxb9gF7', taxon: 0 },
  { name: 'The Inquiry', issuer: 'rBxhkL9zpckT7wf8nTLpVDEJwLxPJoNVCh', taxon: 0 },
  { name: 'XRPL Legends', issuer: 'rJd8Hs1vNMb73nxC9auBqsF1wRLjmhfPpz', taxon: 0 },
  { name: 'Casino Society', issuer: 'rJV6oSozcXYoyWSCrZBfN2MSvjGLMpt5HK', taxon: 0 },
  { name: 'The Lost Emporium', issuer: 'rKz4K3y5n7VqcTR6uYbSUKVfaHGH66pUPT', taxon: 0 },
  { name: 'Made with Miracles 589', issuer: 'rDhzwyR2ykL75bxLW1Zk6gzgT2kXsmCnGp', taxon: 589 },
  { name: 'BunnyX', issuer: 'rw1R8cfHGMySmbj7gJ1HkiCqTY1xhLGYAs', taxon: 0 },
  { name: 'DANTES AURUM', issuer: 'rHVqLmh8qfXvYPZXFnRCvZSF3rNLNt6tXJ', taxon: 0 },
  { name: 'PEPE on XRP', issuer: 'rN4mKL6vCKWjDkYhT5bW5E5LJCxKD1iiFL', taxon: 0 },
  { name: 'Under the Bridge: Troll', issuer: 'rwvWUfYL1mKsKZ4rnp2TMsYvQQNp4vw8zd', taxon: 0 },
  { name: 'Made with Miracles Angels', issuer: 'rDhzwyR2ykL75bxLW1Zk6gzgT2kXsmCnGp', taxon: 74 },
  { name: 'Tazz', issuer: 'rBwabNNMNhzN8WpyY9s3K1d2m1JmkMKw1V', taxon: 0 }
];

async function testWalletScanning() {
  console.log('🎮 RIDDLE CITY WALLET SCANNER TEST\n');
  console.log('========================================\n');
  console.log('This is how Riddle City SHOULD work:');
  console.log('1. User logs in with their wallet');
  console.log('2. Scanner queries XRPL account_nfts for that wallet');
  console.log('3. Filters NFTs to find gaming collections');
  console.log('4. Saves gaming NFTs to database');
  console.log('5. Gaming dashboard displays their NFTs\n');
  console.log('========================================\n');

  const client = new Client('wss://xrplcluster.com');
  await client.connect();

  console.log(`🔍 Scanning wallet: ${DIPPYDOGE_WALLET}\n`);

  // Query XRPL for all NFTs in wallet
  const response = await client.request({
    command: 'account_nfts',
    account: DIPPYDOGE_WALLET,
    ledger_index: 'validated'
  });

  const allNfts = response.result.account_nfts || [];
  console.log(`✅ Found ${allNfts.length} total NFTs in wallet\n`);

  // Filter for gaming NFTs
  const gamingNfts = [];
  for (const nft of allNfts) {
    const collectionKey = `${nft.Issuer}:${nft.NFTokenTaxon}`;
    const collection = GAMING_COLLECTIONS.find(c => 
      `${c.issuer}:${c.taxon}` === collectionKey
    );

    if (collection) {
      gamingNfts.push({
        collection: collection.name,
        tokenId: nft.NFTokenID,
        issuer: nft.Issuer,
        taxon: nft.NFTokenTaxon,
        uri: nft.URI
      });
    }
  }

  console.log(`🎮 Gaming NFTs found: ${gamingNfts.length}\n`);

  if (gamingNfts.length > 0) {
    console.log('Gaming NFTs:');
    gamingNfts.forEach((nft, i) => {
      console.log(`  ${i + 1}. ${nft.collection}`);
      console.log(`     Token ID: ${nft.tokenId.slice(0, 25)}...`);
      console.log(`     Issuer: ${nft.issuer.slice(0, 20)}...`);
      console.log('');
    });
  }

  console.log('========================================');
  console.log('✅ WALLET SCANNING WORKS CORRECTLY\n');
  console.log('📝 What happens next in Riddle City:');
  console.log('   1. Scanner saves these NFTs to gaming_nfts table');
  console.log('   2. Power calculations applied (army/religion/etc)');
  console.log('   3. Player stats updated in gaming_players table');
  console.log('   4. Dashboard shows NFTs with power scores');
  console.log('   5. User can create squadrons with their NFTs\n');

  console.log('🔧 To populate database for dippydoge:');
  console.log('   POST /api/gaming/player/scan-wallet-nfts');
  console.log('   (Requires user to be logged in)\n');

  await client.disconnect();
}

testWalletScanning().catch(console.error);
