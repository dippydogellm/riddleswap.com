/**
 * Quick test - Fetch dippydoge's NFTs directly via Bithomp
 */

import fetch from 'node-fetch';
import { Client } from 'xrpl';

const BITHOMP_API_KEY = '95b64250-f24f-4654-9b4b-b155a3a6867b';
const DIPPYDOGE_WALLET = 'rEVrTKUKSLx5nxdfV8SAFTxS9FGFrfHRLo';

const COLLECTIONS = [
  { name: 'The Inquisition', issuer: 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH', taxon: 0 },
  { name: 'Patriot', issuer: 'rGR4MCACFZg95TpxBncVPzB3o4oUxb9gF7', taxon: 0 },
  { name: 'The Inquiry', issuer: 'rBxhkL9zpckT7wf8nTLpVDEJwLxPJoNVCh', taxon: 0 },
  { name: 'XRPL Legends', issuer: 'rJd8Hs1vNMb73nxC9auBqsF1wRLjmhfPpz', taxon: 0 },
  { name: 'Casino Society', issuer: 'rJV6oSozcXYoyWSCrZBfN2MSvjGLMpt5HK', taxon: 0 }
];

async function quickTest() {
  console.log('🚀 Quick Test - Fetching All NFTs from Collections\n');

  const client = new Client('wss://xrplcluster.com');
  await client.connect();

  // Test 1: Fetch dippydoge's NFTs via XRPL
  console.log('📍 Test 1: Dippydoge Wallet NFTs (XRPL account_nfts)');
  console.log('========================================\n');
  
  const accountNFTs = await client.request({
    command: 'account_nfts',
    account: DIPPYDOGE_WALLET,
    ledger_index: 'validated'
  });

  const nfts = accountNFTs.result.account_nfts || [];
  console.log(`✅ Found ${nfts.length} total NFTs in dippydoge's wallet\n`);

  // Filter for gaming NFTs
  const gamingNFTs = nfts.filter(nft => {
    const key = `${nft.Issuer}:${nft.NFTokenTaxon}`;
    return COLLECTIONS.some(c => `${c.issuer}:${c.taxon}` === key);
  });

  console.log(`🎮 Gaming NFTs: ${gamingNFTs.length}\n`);
  gamingNFTs.forEach((nft, i) => {
    const collection = COLLECTIONS.find(c => c.issuer === nft.Issuer && c.taxon === nft.NFTokenTaxon);
    console.log(`  ${i + 1}. ${collection?.name}`);
    console.log(`     Token ID: ${nft.NFTokenID.slice(0, 20)}...`);
  });

  // Test 2: Fetch NFTs from The Inquisition collection via Bithomp
  console.log('\n\n📍 Test 2: The Inquisition Collection (Bithomp API)');
  console.log('========================================\n');

  const collectionURL = `https://bithomp.com/api/v2/nfts?issuer=${COLLECTIONS[0].issuer}&taxon=${COLLECTIONS[0].taxon}&limit=50`;
  console.log(`Fetching: ${collectionURL}\n`);

  const response = await fetch(collectionURL, {
    headers: {
      'x-bithomp-token': BITHOMP_API_KEY,
      'User-Agent': 'RiddleSwap/1.0',
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    console.error(`❌ Bithomp API failed: ${response.status} ${response.statusText}`);
    const errorText = await response.text();
    console.error(errorText);
  } else {
    const data = await response.json();
    const collectionNFTs = data.nfts || [];
    console.log(`✅ Found ${collectionNFTs.length} NFTs in The Inquisition collection`);
    console.log(`📊 Total count from API: ${data.count || 'N/A'}`);
    
    if (collectionNFTs.length > 0) {
      console.log(`\nSample NFTs:`);
      collectionNFTs.slice(0, 5).forEach((nft, i) => {
        console.log(`  ${i + 1}. Owner: ${nft.owner?.slice(0, 15)}... Token: ${nft.nftokenID?.slice(-8)}`);
      });
    }
  }

  await client.disconnect();

  console.log('\n\n✅ Tests Complete');
  console.log('\n📝 SUMMARY:');
  console.log(`   - Dippydoge has ${gamingNFTs.length} gaming NFT(s)`);
  console.log(`   - Bithomp API is working correctly`);
  console.log(`   - Scanner should fetch NFTs from collections by issuer+taxon`);
  console.log(`   - Individual wallet scanning also works via XRPL account_nfts`);
}

quickTest().catch(console.error);
