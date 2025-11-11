import fetch from 'node-fetch';

const BITHOMP_API_KEY = '95b64250-f24f-4654-9b4b-b155a3a6867b';

// All 13 gaming collections
const COLLECTIONS = [
  { name: 'The Inquisition', issuer: 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH', current_taxon: 2 },
  { name: 'Patriot', issuer: 'rGR4MCACFZg95TpxBncVPzB3o4oUxb9gF7', current_taxon: 0 },
  { name: 'The Inquiry', issuer: 'rBxhkL9zpckT7wf8nTLpVDEJwLxPJoNVCh', current_taxon: 0 },
  { name: 'XRPL Legends', issuer: 'rJd8Hs1vNMb73nxC9auBqsF1wRLjmhfPpz', current_taxon: 0 },
  { name: 'Casino Society', issuer: 'rJV6oSozcXYoyWSCrZBfN2MSvjGLMpt5HK', current_taxon: 0 },
  { name: 'The Lost Emporium', issuer: 'rKz4K3y5n7VqcTR6uYbSUKVfaHGH66pUPT', current_taxon: 0 },
  { name: 'Made with Miracles 589', issuer: 'rDhzwyR2ykL75bxLW1Zk6gzgT2kXsmCnGp', current_taxon: 589 },
  { name: 'BunnyX', issuer: 'rw1R8cfHGMySmbj7gJ1HkiCqTY1xhLGYAs', current_taxon: 0 },
  { name: 'DANTES AURUM', issuer: 'rHVqLmh8qfXvYPZXFnRCvZSF3rNLNt6tXJ', current_taxon: 0 },
  { name: 'Muses', issuer: 'r44xKnK4d9sbUnCpnrmjTMFL7r9J5Lz8Kg', current_taxon: 0 },
  { name: 'XLovebirds', issuer: 'rw8RQo7AQsj9Z7N9xUC4tWUJ9QPPV2NG8M', current_taxon: 0 },
  { name: 'Cryptomon NFT', issuer: 'rDN6KtA8qeCQQ2p6wXWL6iDCk8XBvA9yKY', current_taxon: 0 },
  { name: 'XDunks', issuer: 'rhcAT4onBm19PRkUm9M5rH79BbqU32y6jjY', current_taxon: 2539302139 }
];

async function checkTaxon(issuer, taxon) {
  try {
    const url = `https://bithomp.com/api/v2/nfts?issuer=${issuer}&taxon=${taxon}&limit=1&includeDeleted=false`;
    const response = await fetch(url, {
      headers: {
        'x-bithomp-token': BITHOMP_API_KEY,
        'Accept': 'application/json'
      },
      timeout: 30000
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return {
      count: data.nfts?.length || 0,
      marker: data.marker || null,
      firstNft: data.nfts?.[0] || null
    };
  } catch (error) {
    return null;
  }
}

async function verifyCollection(collection) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📦 ${collection.name}`);
  console.log(`   Issuer: ${collection.issuer}`);
  console.log(`   Current Taxon: ${collection.current_taxon}`);
  console.log(`${'='.repeat(80)}`);

  // Test taxons 0-10 and the current taxon
  const taxonsToTest = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  if (!taxonsToTest.includes(collection.current_taxon)) {
    taxonsToTest.push(collection.current_taxon);
  }

  const results = [];

  for (const taxon of taxonsToTest) {
    const result = await checkTaxon(collection.issuer, taxon);
    
    if (result && result.count > 0) {
      const firstNftName = result.firstNft?.metadata?.name || result.firstNft?.nftokenID || 'Unknown';
      const hasMore = result.marker ? '📍 (MORE AVAILABLE)' : '';
      
      console.log(`   Taxon ${taxon}: ${result.count} NFTs ${hasMore}`);
      console.log(`      └─ First NFT: "${firstNftName}"`);
      
      results.push({
        taxon,
        count: result.count,
        hasMore: !!result.marker,
        firstNftName
      });
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Summary
  if (results.length === 0) {
    console.log(`   ⚠️  NO NFTs FOUND in any tested taxon!`);
  } else if (results.length === 1) {
    console.log(`   ✅ VERIFIED: Taxon ${results[0].taxon} has ${results[0].count}+ NFTs`);
  } else {
    console.log(`   ⚠️  MULTIPLE TAXONS FOUND:`);
    results.forEach(r => {
      const marker = r.hasMore ? ' (has more pages)' : '';
      console.log(`      • Taxon ${r.taxon}: ${r.count}+ NFTs${marker}`);
    });
    
    // Find the one with most NFTs or marker
    const bestTaxon = results.find(r => r.hasMore) || results.sort((a, b) => b.count - a.count)[0];
    console.log(`   💡 RECOMMENDED: Taxon ${bestTaxon.taxon} (${bestTaxon.count}+ NFTs)`);
  }

  return results;
}

async function main() {
  console.log('🔍 VERIFYING ALL GAMING COLLECTION TAXONS');
  console.log('=' .repeat(80));

  const allResults = {};

  for (const collection of COLLECTIONS) {
    const results = await verifyCollection(collection);
    allResults[collection.name] = results;
    
    // Longer pause between collections
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Final summary
  console.log('\n\n');
  console.log('═'.repeat(80));
  console.log('📊 FINAL SUMMARY - ISSUER & TAXON FOR EACH COLLECTION');
  console.log('═'.repeat(80));

  for (const collection of COLLECTIONS) {
    const results = allResults[collection.name];
    
    if (!results || results.length === 0) {
      console.log(`❌ ${collection.name}`);
      console.log(`   Issuer: ${collection.issuer}`);
      console.log(`   Taxon: ⚠️  NO NFTs FOUND`);
    } else if (results.length === 1) {
      console.log(`✅ ${collection.name}`);
      console.log(`   Issuer: ${collection.issuer}`);
      console.log(`   Taxon: ${results[0].taxon} (${results[0].count}+ NFTs)`);
    } else {
      const bestTaxon = results.find(r => r.hasMore) || results.sort((a, b) => b.count - a.count)[0];
      console.log(`⚠️  ${collection.name} (MULTIPLE TAXONS)`);
      console.log(`   Issuer: ${collection.issuer}`);
      console.log(`   Recommended Taxon: ${bestTaxon.taxon} (${bestTaxon.count}+ NFTs)`);
      console.log(`   All Taxons: ${results.map(r => `${r.taxon} (${r.count}+)`).join(', ')}`);
    }
    console.log('');
  }

  console.log('═'.repeat(80));
  console.log('✅ VERIFICATION COMPLETE');
}

main().catch(console.error);
