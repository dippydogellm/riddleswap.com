/**
 * TEST COLLECTION FETCHING
 * Test fetching ALL NFTs from The Inquisition collection
 */

const BITHOMP_API_KEY = '95b64250-f24f-4654-9b4b-b155a3a6867b';
const BITHOMP_BASE_URL = 'https://bithomp.com/api/v2';

// The Inquisition collection
const ISSUER = 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH';
const TAXON = 0;

async function testCollectionFetch() {
  console.log('🧪 Testing Bithomp Collection Fetch\n');
  console.log(`Collection: The Inquisition`);
  console.log(`Issuer: ${ISSUER}`);
  console.log(`Taxon: ${TAXON}\n`);

  try {
    const allNfts = [];
    let marker = undefined;
    let batchCount = 0;
    const limit = 400;

    while (true) {
      batchCount++;
      
      // Build URL
      let url = `${BITHOMP_BASE_URL}/nfts?issuer=${ISSUER}&taxon=${TAXON}&limit=${limit}&includeDeleted=false`;
      if (marker) {
        url += `&marker=${marker}`;
      }

      console.log(`📡 Batch ${batchCount}: Fetching up to ${limit} NFTs...`);

      const response = await fetch(url, {
        headers: {
          'x-bithomp-token': BITHOMP_API_KEY,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        console.error(`❌ HTTP ${response.status}: ${response.statusText}`);
        const text = await response.text();
        console.error(text);
        break;
      }

      const data = await response.json();
      const nfts = data.nfts || [];

      console.log(`   ✅ Received ${nfts.length} NFTs`);
      
      if (nfts.length > 0) {
        allNfts.push(...nfts);
        console.log(`   📊 Total so far: ${allNfts.length}`);
        
        // Show first NFT details
        if (batchCount === 1 && nfts[0]) {
          console.log(`\n   🔍 First NFT:`);
          console.log(`      ID: ${nfts[0].nftokenID}`);
          console.log(`      Owner: ${nfts[0].owner || 'N/A'}`);
          console.log(`      Sequence: ${nfts[0].sequence || 'N/A'}`);
          console.log(`      Name: ${nfts[0].metadata?.name || 'N/A'}\n`);
        }
      }

      if (nfts.length === 0) {
        console.log(`   ℹ️  No more NFTs (empty batch)`);
        break;
      }

      marker = data.marker;
      if (!marker) {
        console.log(`   ℹ️  No marker returned (end of collection)`);
        break;
      }

      console.log(`   🔄 Marker for next page: ${marker.substring(0, 20)}...`);
      
      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log(`\n✅ COMPLETE!`);
    console.log(`📊 Total NFTs fetched: ${allNfts.length}`);
    console.log(`📦 Total batches: ${batchCount}`);

    // Show owner distribution
    const ownerCounts = {};
    allNfts.forEach(nft => {
      const owner = nft.owner || 'Unknown';
      ownerCounts[owner] = (ownerCounts[owner] || 0) + 1;
    });

    console.log(`\n👥 Unique owners: ${Object.keys(ownerCounts).length}`);
    console.log(`📈 Average NFTs per owner: ${(allNfts.length / Object.keys(ownerCounts).length).toFixed(2)}`);

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error);
  }
}

testCollectionFetch();
