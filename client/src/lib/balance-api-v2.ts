// Clean Balance API V2 - Frontend interface
// Connects to the new corruption-free balance system

interface BalanceResult {
  success: boolean;
  chain: string;
  address: string;
  balance: string;
  balanceUSD: number;
  timestamp: number;
  source?: string;
  error?: string;
}

interface BatchBalanceRequest {
  chain: string;
  address: string;
}

// Fetch single balance
export async function fetchBalanceV2(chain: string, address: string): Promise<BalanceResult> {
  try {
    const response = await fetch(`/api/v2/balance/${chain}/${address}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch balance: ${response.statusText}`);
    }
    return await response.json() as any;
  } catch (error) {

    return {
      success: false,
      chain,
      address,
      balance: '0',
      balanceUSD: 0,
      timestamp: Date.now(),
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Fetch multiple balances at once
export async function fetchBatchBalancesV2(requests: BatchBalanceRequest[]): Promise<BalanceResult[]> {
  try {
    const response = await fetch('/api/v2/balances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addresses: requests })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch balances: ${response.statusText}`);
    }
    
    const data = await response.json() as any;
    return data.balances || [];
  } catch (error) {

    // Return error results for all requested addresses
    return requests.map(req => ({
      success: false,
      chain: req.chain,
      address: req.address,
      balance: '0',
      balanceUSD: 0,
      timestamp: Date.now(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }));
  }
}

// Format balance for display
export function formatBalanceV2(balance: string | number, decimals: number = 6): string {
  const num = typeof balance === 'string' ? parseFloat(balance) : balance;
  
  if (isNaN(num)) return '0';
  
  // For very small numbers
  if (num > 0 && num < 0.000001) {
    return '<0.000001';
  }
  
  // For normal numbers
  if (num < 1) {
    return num.toFixed(decimals);
  }
  
  // For large numbers
  if (num >= 1000000) {
    return (num / 1000000).toFixed(2) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(2) + 'K';
  }
  
  return num.toFixed(4);
}

// Format USD value - FIXED: Remove $0.00 minimum override that was causing XRP to show $0.00 instead of $12.14
export function formatUSDV2(value: number): string {
  if (value === 0) return '$0.00';
  if (value < 0.001) return `$${value.toFixed(6)}`; // Show very small amounts properly
  if (value < 1) return `$${value.toFixed(4)}`;
  if (value < 1000) return `$${value.toFixed(2)}`;
  if (value < 1000000) return `$${(value / 1000).toFixed(2)}K`;
  if (value < 1000000000) return `$${(value / 1000000).toFixed(2)}M`;
  return `$${(value / 1000000000).toFixed(2)}B`;
}

// Test the balance system
export async function testBalanceSystemV2() {

  
  const testCases = [
    { chain: 'BTC', address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh' },
    { chain: 'ETH', address: '0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe' },
    { chain: 'XRP', address: 'rEVrTKUKSLx5nxdfV8SAFTxS9FGFrfHRLo' },
    { chain: 'SOL', address: '7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj' }
  ];
  
  // Test single fetches
  for (const test of testCases) {
    const result = await fetchBalanceV2(test.chain, test.address);
  }
  
  // Test batch fetch

  const batchResults = await fetchBatchBalancesV2(testCases);
  batchResults.forEach(result => {
  });
}
