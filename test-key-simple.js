/**
 * Simple Bithomp API key test
 */

const BITHOMP_API_KEY = process.env.BITHOMP_API_KEY;

console.log('Testing Bithomp API Key:\n');
console.log('Raw key from env:', BITHOMP_API_KEY);
console.log('Key length:', BITHOMP_API_KEY?.length);
console.log('First 10 chars:', BITHOMP_API_KEY?.substring(0, 10));
console.log('Last 5 chars:', BITHOMP_API_KEY?.substring(BITHOMP_API_KEY.length - 5));
console.log('Has quotes?:', BITHOMP_API_KEY?.includes('"'));
console.log('\n');

async function test() {
  const url = 'https://bithomp.com/api/v2/nfts?issuer=rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH&taxon=2&limit=1';
  
  console.log('Fetching:', url);
  console.log('Header value:', BITHOMP_API_KEY);
  console.log('\n');
  
  const response = await fetch(url, {
    headers: {
      'x-bithomp-token': BITHOMP_API_KEY,
      'Accept': 'application/json'
    }
  });
  
  console.log('Status:', response.status, response.statusText);
  const text = await response.text();
  console.log('Response:', text.substring(0, 500));
}

test().catch(console.error);
