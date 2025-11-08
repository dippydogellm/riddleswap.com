// Public swap utilities for wallet-based signing (no private keys)
// Use inline market price functions for now
async function fetchLiveXRPPrice(): Promise<number> {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd');
    const data = await response.json() as any;
    return data.ripple.usd;
  } catch (error) {
    console.error('Error fetching XRP price:', error);
    throw new Error('Unable to fetch live XRP price');
  }
}

async function fetchLiveXRPLTokenPrice(symbol: string, issuer: string): Promise<number> {
  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${symbol.toLowerCase()}.${issuer.toLowerCase()}`);
    const data = await response.json() as any;
    if (data?.pairs?.[0]?.priceUsd) {
      return parseFloat(data.pairs[0].priceUsd);
    }
    throw new Error(`No live price data available for ${symbol}`);
  } catch (error) {
    console.error('Error fetching token price:', error);
    throw new Error(`Failed to fetch live price for ${symbol}: ${error.message}`);
  }
}

export async function calculateLiveFee(amount: string, fromToken: string): Promise<string> {
  try {
    let amountUSD = 0;
    
    if (fromToken === 'XRP') {
      const xrpPrice = await fetchLiveXRPPrice();
      amountUSD = parseFloat(amount) * xrpPrice;
    } else {
      // For tokens, get the USD value
      const tokenPrice = await fetchLiveXRPLTokenPrice(fromToken, '');
      amountUSD = parseFloat(amount) * tokenPrice;
    }
    
    // 1% platform fee in USD
    const feeUSD = amountUSD * 0.01;
    
    // Convert fee to XRP
    const xrpPrice = await fetchLiveXRPPrice();
    const feeXRP = feeUSD / xrpPrice;
    
    return feeXRP.toFixed(6);
  } catch (error) {
    console.error('Fee calculation error:', error);
    throw new Error(`Unable to calculate fee: ${error.message}`);
  }
}

export async function calculateExchangeRate(
  fromToken: string, 
  toToken: string, 
  amount: string,
  fromIssuer?: string,
  toIssuer?: string
): Promise<{
  expectedOutput: string;
  rate: string;
  txType: string;
}> {
  try {
    // Get live prices
    const fromPrice = fromToken === 'XRP' 
      ? await fetchLiveXRPPrice()
      : await fetchLiveXRPLTokenPrice(fromToken, fromIssuer || '');
    
    const toPrice = toToken === 'XRP'
      ? await fetchLiveXRPPrice()
      : await fetchLiveXRPLTokenPrice(toToken, toIssuer || '');
    
    // Calculate exchange rate
    const rate = fromPrice / toPrice;
    const expectedOutput = parseFloat(amount) * rate;
    
    // Determine transaction type
    let txType = 'TokenToToken';
    if (fromToken === 'XRP' && toToken !== 'XRP') {
      txType = 'XRPToToken';
    } else if (fromToken !== 'XRP' && toToken === 'XRP') {
      txType = 'TokenToXRP';
    }
    
    return {
      expectedOutput: expectedOutput.toFixed(6),
      rate: rate.toFixed(6),
      txType
    };
  } catch (error) {
    console.error('Exchange rate calculation error:', error);
    throw error;
  }
}