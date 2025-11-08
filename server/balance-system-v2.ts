// Balance System V2 - Clean implementation for all chains
import fetch from 'node-fetch';

interface BalanceResult {
  success: boolean;
  balance: string;
  balanceUSD: number;
  priceUSD: number;
  error?: string;
  timestamp: number;
}

// Fetch live prices from CoinGecko
async function fetchPrices(): Promise<Record<string, number>> {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ripple,ethereum,solana,bitcoin&vs_currencies=usd');
    const data = await response.json() as any;
    
    if (!data.ripple?.usd || !data.ethereum?.usd || !data.solana?.usd || !data.bitcoin?.usd) {
      throw new Error('Incomplete price data from CoinGecko API');
    }
    
    return {
      xrp: data.ripple.usd,
      eth: data.ethereum.usd,
      sol: data.solana.usd,
      btc: data.bitcoin.usd
    };
  } catch (error) {
    console.error('Failed to fetch prices:', error);
    throw new Error('Unable to fetch live token prices from CoinGecko');
  }
}

// Get XRP balance using WebSocket connection
async function getXRPBalance(address: string): Promise<BalanceResult> {
  let client: any = null;
  
  try {
    // Import XRPL client dynamically
    const { Client } = await import('xrpl');
    client = new Client('wss://s1.ripple.com');
    await client.connect();
    
    const response = await client.request({
      command: 'account_info',
      account: address,
      ledger_index: 'validated'
    });
    
    if (response.result?.account_data) {
      const drops = parseFloat(response.result.account_data.Balance);
      const xrpBalance = drops / 1000000; // Convert drops to XRP
      const prices = await fetchPrices();
      
      return {
        success: true,
        balance: xrpBalance.toFixed(6),
        balanceUSD: xrpBalance * prices.xrp,
        priceUSD: prices.xrp,
        timestamp: Date.now()
      };
    }
    
    throw new Error('Account not found');
  } catch (error) {
    return {
      success: false,
      balance: '0',
      balanceUSD: 0,
      priceUSD: 0,
      error: error instanceof Error ? error.message : 'Failed to fetch XRP balance',
      timestamp: Date.now()
    };
  } finally {
    if (client && client.isConnected()) {
      await client.disconnect();
    }
  }
}

// Get ETH balance
async function getETHBalance(address: string): Promise<BalanceResult> {
  try {
    const response = await fetch('https://eth.llamarpc.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getBalance',
        params: [address, 'latest'],
        id: 1
      })
    });
    
    const data = await response.json() as any;
    
    if (data.result) {
      const wei = parseInt(data.result, 16);
      const ethBalance = wei / Math.pow(10, 18);
      const prices = await fetchPrices();
      
      return {
        success: true,
        balance: ethBalance.toFixed(6),
        balanceUSD: ethBalance * prices.eth,
        priceUSD: prices.eth,
        timestamp: Date.now()
      };
    }
    
    throw new Error('Failed to get balance');
  } catch (error) {
    return {
      success: false,
      balance: '0',
      balanceUSD: 0,
      priceUSD: 0,
      error: error instanceof Error ? error.message : 'Failed to fetch ETH balance',
      timestamp: Date.now()
    };
  }
}

// Get SOL balance
async function getSOLBalance(address: string): Promise<BalanceResult> {
  try {
    const response = await fetch('https://api.mainnet-beta.solana.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getBalance',
        params: [address]
      })
    });
    
    const data = await response.json() as any;
    
    if (data.result?.value !== undefined) {
      const lamports = data.result.value;
      const solBalance = lamports / Math.pow(10, 9);
      const prices = await fetchPrices();
      
      return {
        success: true,
        balance: solBalance.toFixed(6),
        balanceUSD: solBalance * prices.sol,
        priceUSD: prices.sol,
        timestamp: Date.now()
      };
    }
    
    throw new Error('Failed to get balance');
  } catch (error) {
    return {
      success: false,
      balance: '0',
      balanceUSD: 0,
      priceUSD: 0,
      error: error instanceof Error ? error.message : 'Failed to fetch SOL balance',
      timestamp: Date.now()
    };
  }
}

// Get BTC balance
async function getBTCBalance(address: string): Promise<BalanceResult> {
  try {
    const response = await fetch(`https://api.blockcypher.com/v1/btc/main/addrs/${address}/balance`);
    const data = await response.json() as any;
    
    if (data.balance !== undefined) {
      const satoshis = data.balance;
      const btcBalance = satoshis / 100000000;
      const prices = await fetchPrices();
      
      return {
        success: true,
        balance: btcBalance.toFixed(8),
        balanceUSD: btcBalance * prices.btc,
        priceUSD: prices.btc,
        timestamp: Date.now()
      };
    }
    
    throw new Error('Failed to get balance');
  } catch (error) {
    return {
      success: false,
      balance: '0',
      balanceUSD: 0,
      priceUSD: 0,
      error: error instanceof Error ? error.message : 'Failed to fetch BTC balance',
      timestamp: Date.now()
    };
  }
}

// Main balance fetching function
export async function getBalanceV2(chain: string, address: string): Promise<BalanceResult> {
  if (!address) {
    return {
      success: false,
      balance: '0',
      balanceUSD: 0,
      priceUSD: 0,
      error: 'Address is required',
      timestamp: Date.now()
    };
  }

  console.log(`📊 Fetching ${chain} balance for ${address.substring(0, 10)}...`);

  switch (chain.toLowerCase()) {
    case 'xrp':
      return getXRPBalance(address);
    case 'eth':
      return getETHBalance(address);
    case 'sol':
      return getSOLBalance(address);
    case 'btc':
      return getBTCBalance(address);
    default:
      return {
        success: false,
        balance: '0',
        balanceUSD: 0,
        priceUSD: 0,
        error: `Unsupported chain: ${chain}`,
        timestamp: Date.now()
      };
  }
}

// Test function
export async function testBalanceSystemV2() {
  console.log('🧪 Testing Balance System V2...\n');
  
  const testAddresses = {
    xrp: 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH',
    eth: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
    sol: '11111111111111111111111111111111',
    btc: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'
  };
  
  for (const [chain, address] of Object.entries(testAddresses)) {
    const result = await getBalanceV2(chain, address);
    console.log(`${chain.toUpperCase()}:`, result);
  }
  
  console.log('\n✅ Balance System V2 test complete');
}