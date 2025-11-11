/**
 * FETCH ALL NFTS FROM TAXON 2
 * This is where The Inquisition's 1200 NFTs are!
 */

const BITHOMP_API_KEY = '95b64250-f24f-4654-9b4b-b155a3a6867b';
const BITHOMP_BASE_URL = 'https://bithomp.com/api/v2';

const ISSUER = 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH';
const TAXON = 2; // THE REAL INQUISITION COLLECTION!

async function fetchAllInquisitionNfts() {
  console.log('🎯 Fetching ALL NFTs from The Inquisition (Taxon 2)\n');

  const allNfts = [];
  let marker = undefined;
  let batchCount = 0;

  while (true) {
    batchCount++;
    
    let url = `${BITHOMP_BASE_URL}/nfts?issuer=${ISSUER}&taxon=${TAXON}&limit=400`;
    if (marker) {
      url += `&marker=${marker}`;
    }

    console.log(`📡 Batch ${batchCount}: Fetching...`);

    const response = await fetch(url, {
      headers: {
        'x-bithomp-token': BITHOMP_API_KEY,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`❌ HTTP ${response.status}`);
      break;
    }

    const data = await response.json();
    const nfts = data.nfts || [];

    console.log(`   ✅ Received ${nfts.length} NFTs (Total: ${allNfts.length + nfts.length})`);

    if (nfts.length === 0) break;

    allNfts.push(...nfts);

    marker = data.marker;
    if (!marker) {
      console.log(`   ✅ No more pages`);
      break;
    }

    await new Promise(resolve => setTimeout(resolve, 300));
  }

  console.log(`\n✅ COMPLETE!`);
  console.log(`📊 Total NFTs fetched: ${allNfts.length}`);
  console.log(`📦 Total batches: ${batchCount}`);

  const owners = new Set(allNfts.map(n => n.owner).filter(o => o));
  console.log(`👥 Unique owners: ${owners.size}`);
  console.log(`📈 Average NFTs per owner: ${(allNfts.length / owners.size).toFixed(2)}`);
}

fetchAllInquisitionNfts();
