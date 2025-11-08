// Token balance service for SOL and ETH wallets

export interface TokenBalance {
  address: string;
  symbol: string;
  name: string;
  balance: string;
  balanceUSD: number;
  decimals: number;
  logoURI?: string;
  price?: number;
}

// Fetch ETH token balances using Etherscan
export async function getETHTokenBalances(walletAddress: string): Promise<TokenBalance[]> {
  try {
    console.log(`🔍 Fetching ETH token balances for ${walletAddress}`);
    
    // Get token list from Etherscan (top ERC-20 tokens)
    const tokenListResponse = await fetch(`https://api.etherscan.io/api?module=account&action=tokentx&address=${walletAddress}&startblock=0&endblock=999999999&sort=desc&apikey=YourApiKeyToken`);
    
    if (!tokenListResponse.ok) {
      console.log('❌ Failed to fetch ETH token transactions');
      return [];
    }
    
    const tokenData = await tokenListResponse.json() as any;
    
    if (!tokenData.result || !Array.isArray(tokenData.result)) {
      console.log('❌ No token transactions found');
      return [];
    }
    
    // Get unique tokens from transactions
    const uniqueTokens = new Map<string, any>();
    tokenData.result.forEach((tx: any) => {
      if (tx.tokenSymbol && tx.contractAddress) {
        uniqueTokens.set(tx.contractAddress.toLowerCase(), {
          address: tx.contractAddress,
          symbol: tx.tokenSymbol,
          name: tx.tokenName,
          decimals: parseInt(tx.tokenDecimal) || 18
        });
      }
    });
    
    // Get balances for each token
    const tokenBalances: TokenBalance[] = [];
    
    for (const [contractAddress, tokenInfo] of Array.from(uniqueTokens.entries())) {
      try {
        // Get token balance using Etherscan
        const balanceResponse = await fetch(`https://api.etherscan.io/api?module=account&action=tokenbalance&contractaddress=${contractAddress}&address=${walletAddress}&tag=latest&apikey=YourApiKeyToken`);
        
        if (balanceResponse.ok) {
          const balanceData = await balanceResponse.json() as any;
          
          if (balanceData.result && balanceData.result !== '0') {
            const balance = parseFloat(balanceData.result) / Math.pow(10, tokenInfo.decimals);
            
            if (balance > 0) {
              tokenBalances.push({
                address: tokenInfo.address,
                symbol: tokenInfo.symbol,
                name: tokenInfo.name,
                balance: balance.toFixed(6),
                balanceUSD: 0, // Price lookup would go here
                decimals: tokenInfo.decimals,
                logoURI: `https://tokens.1inch.io/${tokenInfo.address.toLowerCase()}.png`
              });
            }
          }
        }
      } catch (error) {
        console.log(`⚠️ Failed to get balance for token ${tokenInfo.symbol}:`, error);
      }
    }
    
    console.log(`✅ Found ${tokenBalances.length} ETH tokens with balances`);
    return tokenBalances;
    
  } catch (error) {
    console.error('❌ ETH token balance fetch error:', error);
    return [];
  }
}

// Simple token metadata - just use mint address as symbol
function getSimpleTokenInfo(mint: string): { symbol: string; name: string; logoURI: string } {
  return {
    symbol: mint,
    name: `Token ${mint.substring(0, 8)}...`,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png'
  };
}

// Fetch SOL token balances using RPC - SHOW ALL TOKENS
export async function getSOLTokenBalances(walletAddress: string): Promise<TokenBalance[]> {
  try {
    console.log(`🔍 Fetching ALL SOL tokens for ${walletAddress}`);
    
    const rpcEndpoints = [
      'https://api.mainnet-beta.solana.com',
      'https://solana-api.projectserum.com',
      'https://rpc.ankr.com/solana'
    ];
    
    for (const endpoint of rpcEndpoints) {
      try {
        // Get ALL token accounts by owner
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getTokenAccountsByOwner',
            params: [
              walletAddress,
              { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
              { encoding: 'jsonParsed' }
            ]
          })
        });
        
        if (!response.ok) continue;
        
        const data = await response.json() as any;
        
        if (!data.result?.value) continue;
        
        const tokenBalances: TokenBalance[] = [];
        
        // Process ALL tokens found
        for (const tokenAccount of data.result.value) {
          try {
            const accountInfo = tokenAccount.account.data.parsed.info;
            const mint = accountInfo.mint;
            const balance = accountInfo.tokenAmount.uiAmount || 0;
            const decimals = accountInfo.tokenAmount.decimals;
            
            // Get basic token info
            const tokenInfo = getSimpleTokenInfo(mint);
            
            // Add EVERY token to the list
            tokenBalances.push({
              address: mint,
              symbol: tokenInfo.symbol,
              name: tokenInfo.name,
              balance: balance.toString(),
              balanceUSD: 0,
              decimals: decimals,
              logoURI: tokenInfo.logoURI
            });
            
            console.log(`📊 Found token: ${mint} with balance: ${balance}`);
          } catch (error) {
            console.log('⚠️ Failed to parse token account:', error);
          }
        }
        
        console.log(`✅ Found ${tokenBalances.length} total SOL tokens (including zero balance)`);
        return tokenBalances;
        
      } catch (error) {
        console.log(`⚠️ RPC ${endpoint} failed, trying next...`);
        continue;
      }
    }
    
    console.log('❌ All SOL RPC endpoints failed');
    return [];
    
  } catch (error) {
    console.error('❌ SOL token balance fetch error:', error);
    return [];
  }
}

// Get popular tokens for a chain (fallback when no balances found)
export async function getPopularTokens(chain: 'ETH' | 'SOL'): Promise<TokenBalance[]> {
  const popularTokens: { [key: string]: TokenBalance[] } = {
    ETH: [
      {
        address: '0xA0b86a33E6441c3EF8fBF18e0C4c6d6d39Ab40D4',
        symbol: 'USDC',
        name: 'USD Coin',
        balance: '0.00',
        balanceUSD: 0,
        decimals: 6,
        logoURI: 'https://tokens.1inch.io/0xa0b86a33e6441c3ef8fbf18e0c4c6d6d39ab40d4.png'
      },
      {
        address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        symbol: 'USDT',
        name: 'Tether USD',
        balance: '0.00',
        balanceUSD: 0,
        decimals: 6,
        logoURI: 'https://tokens.1inch.io/0xdac17f958d2ee523a2206206994597c13d831ec7.png'
      }
    ],
    SOL: [
      {
        address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        symbol: 'USDC',
        name: 'USD Coin',
        balance: '0.00',
        balanceUSD: 0,
        decimals: 6,
        logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png'
      },
      {
        address: 'So11111111111111111111111111111111111111112',
        symbol: 'SOL',
        name: 'Wrapped SOL',
        balance: '0.00',
        balanceUSD: 0,
        decimals: 9,
        logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png'
      }
    ]
  };
  
  return popularTokens[chain] || [];
}