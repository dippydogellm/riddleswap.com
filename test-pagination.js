/**
 * Test pagination - Fetch ALL NFTs from The Inquisition (1200+ NFTs)
 */

import fetch from 'node-fetch';

const BITHOMP_API_KEY = '95b64250-f24f-4654-9b4b-b155a3a6867b';
const INQUISITION_ISSUER = 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH';
const INQUISITION_TAXON = 0;

async function testPagination() {
  console.log('🔍 Testing Bithomp Pagination for The Inquisition\n');
  console.log('========================================\n');

  const allNfts = [];
  let marker = undefined;
  let batchCount = 0;
  const batchSize = 400;

  while (batchCount < 10) { // Safety limit: max 10 batches (4000 NFTs)
    batchCount++;
    
    let url = `https://bithomp.com/api/v2/nfts?issuer=${INQUISITION_ISSUER}&taxon=${INQUISITION_TAXON}&limit=${batchSize}`;
    if (marker) {
      url += `&marker=${marker}`;
    }

    console.log(`📡 Batch ${batchCount}: Fetching...`);
    
    const startTime = Date.now();
    const response = await fetch(url, {
      headers: {
        'x-bithomp-token': BITHOMP_API_KEY,
        'User-Agent': 'RiddleSwap/1.0',
        'Accept': 'application/json'
      }
    });

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      console.error(`❌ Failed: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error(errorText);
      break;
    }

    const data = await response.json();
    const nfts = data.nfts || [];

    if (nfts.length === 0) {
      console.log(`✅ No more NFTs (empty batch)\n`);
      break;
    }

    allNfts.push(...nfts);
    
    console.log(`   ✅ Received: ${nfts.length} NFTs`);
    console.log(`   📊 Total so far: ${allNfts.length} NFTs`);
    console.log(`   ⏱️  Response time: ${responseTime}ms`);
    console.log(`   🔗 Marker: ${data.marker ? 'Yes' : 'No'}\n`);

    marker = data.marker;
    if (!marker) {
      console.log(`✅ Reached end - No more marker\n`);
      break;
    }

    // Rate limit
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  console.log('========================================');
  console.log('📊 FINAL RESULTS');
  console.log('========================================\n');
  console.log(`Total NFTs fetched: ${allNfts.length}`);
  console.log(`Total batches: ${batchCount}`);
  console.log(`Expected: ~1200 NFTs for The Inquisition\n`);

  if (allNfts.length >= 1000) {
    console.log('✅ SUCCESS: Pagination working correctly!');
    console.log('   Fetched over 1000 NFTs across multiple requests\n');
  } else {
    console.log('⚠️  WARNING: Only fetched', allNfts.length, 'NFTs');
    console.log('   Expected around 1200 for The Inquisition\n');
  }

  // Show sample NFT owners
  if (allNfts.length > 0) {
    console.log('📝 Sample NFT Owners (first 10):');
    allNfts.slice(0, 10).forEach((nft, i) => {
      console.log(`   ${i + 1}. ${nft.owner?.slice(0, 20)}... | Token: ${nft.nftokenID?.slice(-8)}`);
    });
  }

  // Count unique owners
  const uniqueOwners = new Set(allNfts.map(nft => nft.owner));
  console.log(`\n👥 Unique owners: ${uniqueOwners.size}`);
  console.log(`📈 Average NFTs per owner: ${(allNfts.length / uniqueOwners.size).toFixed(2)}`);
}

testPagination().catch(console.error);
