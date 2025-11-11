/**
 * Comprehensive API Test - Bithomp & OpenAI
 */

import 'dotenv/config';

const BITHOMP_API_KEY = process.env.BITHOMP_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

console.log('🧪 COMPREHENSIVE API TEST\n');
console.log('═'.repeat(60));

// Test 1: Bithomp API Key Format
console.log('\n📋 Test 1: API Key Format Check');
console.log(`Bithomp Key Length: ${BITHOMP_API_KEY?.length || 0}`);
console.log(`Bithomp Key First 10 chars: ${BITHOMP_API_KEY?.substring(0, 10)}`);
console.log(`Bithomp Key Last 5 chars: ${BITHOMP_API_KEY?.substring(BITHOMP_API_KEY.length - 5)}`);
console.log(`Has quotes: ${BITHOMP_API_KEY?.includes('"') ? '❌ YES (BAD)' : '✅ NO (GOOD)'}`);
console.log(`OpenAI Key Present: ${OPENAI_API_KEY ? '✅ YES' : '❌ NO'}`);

// Test 2: Bithomp Ping
console.log('\n\n🔌 Test 2: Bithomp Ping');
try {
  const pingRes = await fetch('https://bithomp.com/api/v2/ping', {
    headers: {
      'x-bithomp-token': BITHOMP_API_KEY!,
      'Accept': 'application/json'
    }
  });
  console.log(`Status: ${pingRes.status} ${pingRes.statusText}`);
  if (pingRes.ok) {
    const data = await pingRes.json();
    console.log('✅ Bithomp API Connected');
    console.log(`Response:`, JSON.stringify(data).substring(0, 100));
  } else {
    const error = await pingRes.text();
    console.log(`❌ Bithomp API Error: ${error}`);
  }
} catch (error: any) {
  console.log(`❌ Bithomp Connection Failed: ${error.message}`);
}

// Test 3: Fetch NFT Collection List
console.log('\n\n📦 Test 3: Fetch NFT Collection');
try {
  const nftsRes = await fetch('https://bithomp.com/api/v2/nfts?issuer=rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH&taxon=2&limit=3&metadata=true&assets=true', {
    headers: {
      'x-bithomp-token': BITHOMP_API_KEY!,
      'Accept': 'application/json'
    }
  });
  
  console.log(`Status: ${nftsRes.status} ${nftsRes.statusText}`);
  
  if (nftsRes.ok) {
    const data = await nftsRes.json();
    console.log(`✅ Found ${data.nfts?.length || 0} NFTs`);
    
    if (data.nfts?.[0]) {
      const nft = data.nfts[0];
      console.log(`\nFirst NFT:`);
      console.log(`  ID: ${nft.nftokenID?.substring(0, 20)}...`);
      console.log(`  Name: ${nft.metadata?.name || nft.name || 'No name'}`);
      console.log(`  Has Metadata: ${!!nft.metadata}`);
      console.log(`  Has Traits: ${!!nft.metadata?.attributes}`);
      console.log(`  Trait Count: ${nft.metadata?.attributes?.length || 0}`);
      console.log(`  Image: ${nft.assets?.image || nft.metadata?.image || 'No image'}`);
    }
  } else {
    const error = await nftsRes.text();
    console.log(`❌ Failed: ${error}`);
  }
} catch (error: any) {
  console.log(`❌ Error: ${error.message}`);
}

// Test 4: Fetch Single NFT Details
console.log('\n\n🎨 Test 4: Fetch Individual NFT');
try {
  // First get an NFT ID
  const listRes = await fetch('https://bithomp.com/api/v2/nfts?issuer=rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH&taxon=2&limit=1', {
    headers: {
      'x-bithomp-token': BITHOMP_API_KEY!,
      'Accept': 'application/json'
    }
  });
  
  if (listRes.ok) {
    const listData = await listRes.json();
    const nftId = listData.nfts?.[0]?.nftokenID;
    
    if (nftId) {
      console.log(`Testing with NFT: ${nftId.substring(0, 20)}...`);
      
      const detailRes = await fetch(`https://bithomp.com/api/v2/nft/${nftId}?metadata=true&assets=true`, {
        headers: {
          'x-bithomp-token': BITHOMP_API_KEY!,
          'Accept': 'application/json'
        }
      });
      
      console.log(`Status: ${detailRes.status} ${detailRes.statusText}`);
      
      if (detailRes.ok) {
        const nft = await detailRes.json();
        console.log(`✅ Individual NFT Fetch Successful`);
        console.log(`  Name: ${nft.metadata?.name || nft.name || 'No name'}`);
        console.log(`  Owner: ${nft.owner?.substring(0, 15)}...`);
        console.log(`  Sequence: ${nft.sequence}`);
        console.log(`  Has Assets: ${!!nft.assets}`);
        console.log(`  Assets Image: ${nft.assets?.image || 'None'}`);
        console.log(`  Metadata Image: ${nft.metadata?.image || 'None'}`);
        console.log(`  CDN Image: https://bithomp.com/api/v2/nft/${nftId}/image`);
        
        if (nft.metadata?.attributes) {
          console.log(`  Traits: ${nft.metadata.attributes.length}`);
          if (nft.metadata.attributes[0]) {
            console.log(`  Sample: ${nft.metadata.attributes[0].trait_type} = ${nft.metadata.attributes[0].value}`);
          }
        }
      } else {
        const error = await detailRes.text();
        console.log(`❌ Failed: ${error}`);
      }
    }
  }
} catch (error: any) {
  console.log(`❌ Error: ${error.message}`);
}

// Test 5: OpenAI API
console.log('\n\n🤖 Test 5: OpenAI API');
if (!OPENAI_API_KEY) {
  console.log('❌ OpenAI API Key not set');
} else {
  try {
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Say 'API test successful' if you can read this." }
      ],
      max_tokens: 50
    });
    
    const response = completion.choices[0].message.content;
    console.log(`✅ OpenAI API Connected`);
    console.log(`Response: ${response}`);
  } catch (error: any) {
    console.log(`❌ OpenAI Error: ${error.message}`);
  }
}

// Test 6: Image URL Handling
console.log('\n\n🖼️  Test 6: Image URL Priority');
const testNFT = {
  nftokenID: 'TEST123',
  assets: { image: 'https://cdn.bithomp.com/test.jpg' },
  metadata: { image: 'ipfs://QmTest123' }
};
console.log('Test NFT Data:', JSON.stringify(testNFT, null, 2));
console.log('\nExpected: Should use CDN URL (https://bithomp.com/api/v2/nft/TEST123/image)');
console.log('Should avoid: ipfs:// URLs');

console.log('\n\n═'.repeat(60));
console.log('✅ ALL API TESTS COMPLETE');
console.log('═'.repeat(60));
