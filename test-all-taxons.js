/**
 * TEST ALL TAXONS FOR THE INQUISITION
 * Check taxons 0, 1, 2, 3 to find where the 1200 NFTs are
 */

const BITHOMP_API_KEY = '95b64250-f24f-4654-9b4b-b155a3a6867b';
const BITHOMP_BASE_URL = 'https://bithomp.com/api/v2';

// The Inquisition issuer
const ISSUER = 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH';

async function testAllTaxons() {
  console.log('🧪 Testing All Taxons for The Inquisition\n');
  console.log(`Issuer: ${ISSUER}\n`);

  // Test taxons 0 through 5
  for (let taxon = 0; taxon <= 5; taxon++) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📚 Testing TAXON ${taxon}`);
    console.log('='.repeat(60));

    try {
      const url = `${BITHOMP_BASE_URL}/nfts?issuer=${ISSUER}&taxon=${taxon}&limit=400`;

      const response = await fetch(url, {
        headers: {
          'x-bithomp-token': BITHOMP_API_KEY,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        console.log(`   ❌ HTTP ${response.status}: ${response.statusText}`);
        continue;
      }

      const data = await response.json();
      const nfts = data.nfts || [];

      console.log(`   ✅ Found ${nfts.length} NFTs`);

      if (nfts.length > 0) {
        // Show first NFT
        const firstNft = nfts[0];
        console.log(`\n   🔍 First NFT Details:`);
        console.log(`      Token ID: ${firstNft.nftokenID}`);
        console.log(`      Sequence: ${firstNft.sequence}`);
        console.log(`      Taxon: ${firstNft.nftokenTaxon}`);
        console.log(`      Owner: ${firstNft.owner || 'N/A'}`);
        console.log(`      Name: ${firstNft.metadata?.name || 'N/A'}`);

        // Count unique owners
        const owners = new Set(nfts.map(n => n.owner).filter(o => o));
        console.log(`\n   👥 Unique owners: ${owners.size}`);
        console.log(`   📊 Marker: ${data.marker ? 'Yes (more NFTs available)' : 'No (end of collection)'}`);

        // If this taxon has many NFTs, it might be the right one!
        if (nfts.length >= 100) {
          console.log(`\n   🎯 THIS MIGHT BE THE MAIN COLLECTION!`);
        }
      } else {
        console.log(`   ℹ️  No NFTs found for this taxon`);
      }

      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('✅ Taxon scan complete!');
  console.log('='.repeat(60));
}

testAllTaxons();
