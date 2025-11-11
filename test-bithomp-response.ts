/**
 * TEST BITHOMP API RESPONSE
 * Check what data structure we're actually getting
 */

import 'dotenv/config';

const BITHOMP_API_KEY = '95b64250-f24f-4654-9b4b-b155a3a6867b';
const BITHOMP_BASE = 'https://bithomp.com/api/v2';

async function testBithompAPI() {
  console.log('🧪 TESTING BITHOMP API RESPONSE\n');
  
  // Test with DANTES AURUM (we know has 43 NFTs)
  const issuer = 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH';
  const taxon = 4;
  
  console.log(`Collection: DANTES AURUM`);
  console.log(`Issuer: ${issuer}`);
  console.log(`Taxon: ${taxon}\n`);
  
  const url = `${BITHOMP_BASE}/nfts?issuer=${issuer}&taxon=${taxon}&limit=5&metadata=true&assets=true`;
  
  console.log(`URL: ${url}\n`);
  
  try {
    const response = await fetch(url, {
      headers: {
        'x-bithomp-token': BITHOMP_API_KEY,
        'Accept': 'application/json'
      }
    });
    
    console.log(`Status: ${response.status} ${response.statusText}\n`);
    
    if (!response.ok) {
      const text = await response.text();
      console.log('Error response:', text);
      return;
    }
    
    const data = await response.json();
    
    console.log('📦 FULL RESPONSE STRUCTURE:\n');
    console.log(JSON.stringify(data, null, 2));
    
    console.log('\n\n📋 KEYS IN RESPONSE:');
    console.log(Object.keys(data));
    
    if (data.nfts && data.nfts.length > 0) {
      console.log('\n\n🎨 FIRST NFT STRUCTURE:\n');
      console.log(JSON.stringify(data.nfts[0], null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testBithompAPI();
