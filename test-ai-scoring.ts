/**
 * TEST AI SCORING WITH ERROR HANDLING
 * Tests the improved AI scoring system with JSON validation
 */

import 'dotenv/config';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function testAIScoring() {
  console.log('🧪 TESTING AI SCORING WITH ERROR HANDLING\n');
  
  // Test with a realistic batch of trait values
  const testBatch = [
    { value: 'Golden Armor', count: 5, percentage: 0.5 },
    { value: 'Silver Sword', count: 10, percentage: 1.0 },
    { value: 'Bronze Shield', count: 20, percentage: 2.0 },
    { value: 'Steel Helmet', count: 50, percentage: 5.0 },
    { value: 'Iron Boots', count: 100, percentage: 10.0 }
  ];

  const collectionName = 'Test Collection';
  const gameRole = 'army';
  const traitType = 'Equipment';

  console.log(`Collection: ${collectionName}`);
  console.log(`Role: ${gameRole}`);
  console.log(`Trait: ${traitType}`);
  console.log(`\nTesting with ${testBatch.length} values:\n`);
  
  testBatch.forEach(v => {
    console.log(`  - ${v.value}: ${v.count} (${v.percentage}%)`);
  });

  console.log('\n' + '='.repeat(70));
  console.log('Sending request to OpenAI...\n');

  try {
    const prompt = `Score NFT traits for ${collectionName} (${gameRole}):
${traitType}: ${testBatch.map(v => `${v.value} (${v.percentage.toFixed(0)}%)`).join(', ')}

Rate each 0-100: gaming_utility, visual_impact, synergy_potential

JSON: {"values":[{"value":"name","gaming_utility":70,"visual_impact":80,"synergy_potential":60,"reasoning":"2-5 words"}]}`;

    console.log('📝 Prompt:');
    console.log(prompt);
    console.log('\n' + '='.repeat(70));

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: 'NFT trait analyzer. Return valid JSON only. Very brief reasoning.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 1000
    });

    const rawContent = response.choices[0].message.content || '{}';
    
    console.log('\n📦 RAW RESPONSE:');
    console.log(rawContent);
    console.log('\n' + '='.repeat(70));

    // Validate JSON
    let cleanedContent = rawContent.trim();
    
    console.log('\n🔍 JSON VALIDATION:');
    
    // Check truncation
    if (!cleanedContent.endsWith('}') && !cleanedContent.endsWith(']')) {
      console.log('❌ TRUNCATED: JSON does not end with } or ]');
      throw new Error('Truncated JSON response');
    } else {
      console.log('✅ Not truncated');
    }
    
    // Check quotes
    const openQuotes = (cleanedContent.match(/"/g) || []).length;
    console.log(`✅ Quote count: ${openQuotes} (${openQuotes % 2 === 0 ? 'balanced' : 'UNBALANCED'})`);
    
    if (openQuotes % 2 !== 0) {
      throw new Error('Unbalanced quotes in JSON');
    }

    // Parse
    const analysis = JSON.parse(cleanedContent);
    
    console.log('\n✅ JSON PARSED SUCCESSFULLY!');
    console.log('\n📊 PARSED DATA:');
    console.log(JSON.stringify(analysis, null, 2));
    
    console.log('\n' + '='.repeat(70));
    console.log('📋 PROCESSING RESULTS:\n');
    
    for (const v of testBatch) {
      const aiData = analysis.values?.find((av: any) => 
        av.value === v.value || av.value?.toLowerCase() === v.value.toLowerCase()
      ) || {};
      
      const gamingUtility = Math.min(100, Math.max(0, aiData.gaming_utility || 50));
      const visualImpact = Math.min(100, Math.max(0, aiData.visual_impact || 50));
      const rarityValue = Math.min(100, Math.round(100 / v.percentage));
      const synergy = Math.min(100, Math.max(0, aiData.synergy_potential || 50));
      const overall = Math.round((gamingUtility + visualImpact + rarityValue + synergy) / 4);
      
      console.log(`${v.value}:`);
      console.log(`  Gaming: ${gamingUtility}/100`);
      console.log(`  Visual: ${visualImpact}/100`);
      console.log(`  Rarity: ${rarityValue}/100`);
      console.log(`  Synergy: ${synergy}/100`);
      console.log(`  Overall: ${overall}/100`);
      console.log(`  Reasoning: ${aiData.reasoning || 'N/A'}\n`);
    }
    
    console.log('='.repeat(70));
    console.log('✅ TEST PASSED!\n');
    
  } catch (error: any) {
    console.error('\n❌ TEST FAILED:');
    console.error(error);
    console.log('\n📝 Using default scores...\n');
    
    for (const v of testBatch) {
      const rarityValue = Math.min(100, Math.round(100 / v.percentage));
      const overall = Math.round((50 + 50 + rarityValue + 50) / 4);
      
      console.log(`${v.value}: Default scores (Overall: ${overall}/100)`);
    }
    
    console.log('\n' + '='.repeat(70));
  }
}

testAIScoring();
