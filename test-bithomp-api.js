/**
 * Comprehensive API test before running scanner
 * Tests both Bithomp and OpenAI APIs
 */

import OpenAI from 'openai';

const BITHOMP_API_KEY = process.env.BITHOMP_API_KEY || '95b64250-f24f-4654-9b4b-b155a3a6867b';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

let testsPassed = 0;
let testsFailed = 0;

async function testBithompAPI() {
  console.log('\n🔵 BITHOMP API TESTS\n');
  console.log(`API Key: ${BITHOMP_API_KEY?.substring(0, 10)}...${BITHOMP_API_KEY?.substring(BITHOMP_API_KEY.length - 5)}\n`);

  // Test 1: Ping endpoint
  console.log('Test 1: Ping endpoint...');
  try {
    const pingRes = await fetch('https://bithomp.com/api/v2/ping', {
      headers: {
        'x-bithomp-token': BITHOMP_API_KEY,
        'Accept': 'application/json'
      }
    });
    console.log(`Status: ${pingRes.status} ${pingRes.statusText}`);
    if (pingRes.ok) {
      const data = await pingRes.json();
      console.log('Response:', data);
      console.log('✅ Ping successful\n');
      testsPassed++;
    } else {
      const errorText = await pingRes.text();
      console.log('❌ Ping failed:', errorText, '\n');
      testsFailed++;
      return false;
    }
  } catch (error) {
    console.error('❌ Ping error:', error.message, '\n');
    testsFailed++;
    return false;
  }

  // Test 2: Fetch NFT list
  console.log('Test 2: Fetch NFT list from The Inquisition (taxon 2)...');
  let testNftId = null;
  try {
    const nftsRes = await fetch('https://bithomp.com/api/v2/nfts?issuer=rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH&taxon=2&limit=5', {
      headers: {
        'x-bithomp-token': BITHOMP_API_KEY,
        'Accept': 'application/json'
      }
    });
    console.log(`Status: ${nftsRes.status} ${nftsRes.statusText}`);
    if (nftsRes.ok) {
      const data = await nftsRes.json();
      console.log(`Found ${data.nfts?.length || 0} NFTs`);
      if (data.nfts?.[0]) {
        testNftId = data.nfts[0].nftokenID;
        console.log('First NFT ID:', testNftId);
        console.log('Owner:', data.nfts[0].owner || 'Unknown');
        console.log('✅ NFT list fetch successful\n');
        testsPassed++;
      } else {
        console.log('❌ No NFTs returned\n');
        testsFailed++;
        return false;
      }
    } else {
      const errorText = await nftsRes.text();
      console.log('❌ NFT fetch failed:', errorText, '\n');
      testsFailed++;
      return false;
    }
  } catch (error) {
    console.error('❌ NFT fetch error:', error.message, '\n');
    testsFailed++;
    return false;
  }

  // Test 3: Fetch individual NFT with metadata
  console.log('Test 3: Fetch individual NFT with full metadata...');
  if (!testNftId) {
    console.log('❌ No NFT ID available for testing\n');
    testsFailed++;
    return false;
  }

  try {
    const detailRes = await fetch(`https://bithomp.com/api/v2/nft/${testNftId}?metadata=true`, {
      headers: {
        'x-bithomp-token': BITHOMP_API_KEY,
        'Accept': 'application/json'
      }
    });
    
    console.log(`Status: ${detailRes.status} ${detailRes.statusText}`);
    if (detailRes.ok) {
      const nft = await detailRes.json();
      console.log('NFT ID:', nft.nftokenID || testNftId);
      console.log('NFT Name:', nft.name || nft.metadata?.name || 'No name');
      console.log('Has Metadata:', !!nft.metadata);
      console.log('Has Attributes:', !!nft.metadata?.attributes);
      
      if (nft.metadata?.attributes && Array.isArray(nft.metadata.attributes)) {
        console.log('Trait Count:', nft.metadata.attributes.length);
        console.log('Sample Traits:', JSON.stringify(nft.metadata.attributes.slice(0, 3), null, 2));
      }
      
      console.log('Image URL:', nft.metadata?.image || 'No image');
      console.log('✅ Individual NFT fetch successful\n');
      testsPassed++;
      return true;
    } else {
      const errorText = await detailRes.text();
      console.log('❌ Single NFT fetch failed:', errorText, '\n');
      testsFailed++;
      return false;
    }
  } catch (error) {
    console.error('❌ Single NFT fetch error:', error.message, '\n');
    testsFailed++;
    return false;
  }
}

async function testOpenAIAPI() {
  console.log('\n🟢 OPENAI API TESTS\n');

  if (!OPENAI_API_KEY) {
    console.log('⚠️  No OpenAI API key found. Skipping AI tests.\n');
    return true;
  }

  console.log(`API Key: ${OPENAI_API_KEY?.substring(0, 15)}...${OPENAI_API_KEY?.substring(OPENAI_API_KEY.length - 10)}\n`);

  try {
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    // Test 1: Simple completion
    console.log('Test 1: Simple AI completion...');
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Respond with exactly: 'API Test Successful'" }
      ],
      max_tokens: 20,
      temperature: 0
    });

    const response = completion.choices[0].message.content;
    console.log('Response:', response);
    
    if (response?.includes('Successful')) {
      console.log('✅ OpenAI API connection successful\n');
      testsPassed++;
    } else {
      console.log('⚠️  Unexpected response\n');
      testsFailed++;
      return false;
    }

    // Test 2: JSON response format
    console.log('Test 2: JSON structured response...');
    const jsonCompletion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        { role: "system", content: "Return only valid JSON. No markdown." },
        { role: "user", content: 'Return this exact JSON: {"test": "success", "score": 100}' }
      ],
      response_format: { type: "json_object" },
      max_tokens: 50,
      temperature: 0
    });

    const jsonResponse = JSON.parse(jsonCompletion.choices[0].message.content || '{}');
    console.log('JSON Response:', jsonResponse);
    
    if (jsonResponse.test === 'success') {
      console.log('✅ OpenAI JSON formatting works\n');
      testsPassed++;
    } else {
      console.log('⚠️  JSON response issue\n');
      testsFailed++;
      return false;
    }

    // Test 3: Trait scoring simulation
    console.log('Test 3: Simulated trait scoring...');
    const traitCompletion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        { 
          role: "system", 
          content: "You score NFT traits. Return ONLY valid JSON array. No markdown, no explanations." 
        },
        { 
          role: "user", 
          content: `Score these sample traits for a test NFT collection. Return JSON array:
[
  {
    "trait_type": "Background",
    "base_score": 75,
    "values": [
      {
        "value": "Blue",
        "gaming_utility": 60,
        "visual_impact": 80,
        "rarity_value": 70,
        "synergy_potential": 85,
        "overall_score": 74,
        "reasoning": "Common but versatile"
      }
    ]
  }
]` 
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 300,
      temperature: 0.3
    });

    const traitResponse = JSON.parse(traitCompletion.choices[0].message.content || '{}');
    console.log('Trait Scoring Response:', JSON.stringify(traitResponse, null, 2).substring(0, 300) + '...');
    
    if (traitResponse) {
      console.log('✅ OpenAI trait scoring format works\n');
      testsPassed++;
      return true;
    } else {
      console.log('⚠️  Trait scoring response issue\n');
      testsFailed++;
      return false;
    }

  } catch (error) {
    console.error('❌ OpenAI API error:', error.message, '\n');
    testsFailed++;
    return false;
  }
}

async function runAllTests() {
  console.log('🧪 COMPREHENSIVE API TESTING\n');
  console.log('═'.repeat(60));
  console.log('Testing external API connections before running scanner...\n');

  const bithompSuccess = await testBithompAPI();
  const openaiSuccess = await testOpenAIAPI();

  console.log('═'.repeat(60));
  console.log('\n📊 TEST RESULTS\n');
  console.log(`✅ Tests Passed: ${testsPassed}`);
  console.log(`❌ Tests Failed: ${testsFailed}`);
  
  if (testsFailed === 0 && testsPassed >= 3) {
    console.log('\n🎉 ALL TESTS PASSED! Ready to run scanner.\n');
    process.exit(0);
  } else if (!bithompSuccess) {
    console.log('\n❌ CRITICAL: Bithomp API tests failed. Cannot run scanner.\n');
    console.log('Check your BITHOMP_API_KEY in .env file.');
    console.log('Ensure there are no quotes around the key value.\n');
    process.exit(1);
  } else if (!openaiSuccess && OPENAI_API_KEY) {
    console.log('\n⚠️  WARNING: OpenAI tests failed. Scanner will run without AI scoring.\n');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Review errors above.\n');
    process.exit(1);
  }
}

runAllTests().catch(error => {
  console.error('\n💥 FATAL ERROR:', error);
  process.exit(1);
});
