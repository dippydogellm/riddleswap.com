import { Express } from 'express';

interface SPLToken {
  mint: string;
  symbol: string;
  name: string;
  balance: string;
  decimals: number;
  usdValue: string;
  logo?: string;
}

interface SolanaTransaction {
  signature: string;
  timestamp: number;
  type: 'send' | 'receive' | 'swap';
  amount: string;
  token: string;
  from: string;
  to: string;
  fee: string;
  status: 'confirmed' | 'pending' | 'failed';
}

export function registerSolanaEndpoints(app: Express) {
  console.log('🟣 Registering Solana SPL token endpoints...');

  // Get SPL tokens for an address
  app.get('/api/sol/tokens/:address', async (req, res) => {
    try {
      const { address } = req.params;
      console.log(`🔍 Fetching SPL tokens for: ${address}`);

      // Connect to Solana RPC
      const response = await fetch('https://api.mainnet-beta.solana.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getTokenAccountsByOwner',
          params: [
            address,
            { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' }, // SPL Token Program
            { encoding: 'jsonParsed' }
          ]
        })
      });

      const data = await response.json() as any;
      
      if (!data.result?.value) {
        return res.json({
          success: true,
          tokens: [],
          message: 'No SPL tokens found'
        });
      }

      // Process token accounts
      const tokenAccounts = data.result.value;
      const tokens: SPLToken[] = [];

      // Get SOL price for USD calculations
      const priceResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
      const priceData = await priceResponse.json();
      const solPrice = priceData.solana?.usd || 200;

      for (const account of tokenAccounts) {
        try {
          const tokenInfo = account.account.data.parsed.info;
          const mint = tokenInfo.mint;
          const balance = parseFloat(tokenInfo.tokenAmount.uiAmount || '0');
          const decimals = tokenInfo.tokenAmount.decimals;

          if (balance > 0) {
            // Try to get token metadata
            let tokenData = await getTokenMetadata(mint);
            if (!tokenData) {
              tokenData = {
                symbol: mint.substring(0, 8) + '...',
                name: 'Unknown Token',
                logo: null
              };
            }

            // Estimate USD value (for known tokens, use API; for unknown, estimate as 0)
            let usdValue = '0.00';
            if (tokenData.symbol === 'USDC' || tokenData.symbol === 'USDT') {
              usdValue = balance.toFixed(2);
            } else if (tokenData.price) {
              usdValue = (balance * tokenData.price).toFixed(2);
            }

            tokens.push({
              mint,
              symbol: tokenData.symbol,
              name: tokenData.name,
              balance: balance.toFixed(decimals),
              decimals,
              usdValue,
              logo: tokenData.logo || undefined
            });

            console.log(`✅ Found SPL token: ${tokenData.symbol} (${balance})`);
          }
        } catch (error) {
          console.error('Error processing token account:', error);
        }
      }

      console.log(`✅ Found ${tokens.length} SPL tokens with balance`);

      res.json({
        success: true,
        tokens,
        totalTokens: tokens.length
      });

    } catch (error) {
      console.error('❌ SPL token fetch error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch SPL tokens',
        tokens: []
      });
    }
  });

  // Get Solana transaction history
  app.get('/api/sol/transactions/:address', async (req, res) => {
    try {
      const { address } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;
      
      console.log(`🔍 Fetching Solana transactions for: ${address}`);

      // Get confirmed signatures for the address
      const response = await fetch('https://api.mainnet-beta.solana.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getSignaturesForAddress',
          params: [address, { limit }]
        })
      });

      const data = await response.json() as any;
      
      if (!data.result) {
        return res.json({
          success: true,
          transactions: []
        });
      }

      const signatures = data.result;
      const transactions: SolanaTransaction[] = [];

      // Get detailed transaction info for each signature
      for (const sig of signatures.slice(0, limit)) {
        try {
          const txResponse = await fetch('https://api.mainnet-beta.solana.com', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'getTransaction',
              params: [sig.signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }]
            })
          });

          const txData = await txResponse.json();
          
          if (txData.result) {
            const tx = txData.result;
            const meta = tx.meta;
            
            // Determine transaction type and amount
            let type: 'send' | 'receive' | 'swap' = 'send';
            let amount = '0';
            let token = 'SOL';
            
            // Check SOL balance changes
            const preBalance = meta.preBalances?.[0] || 0;
            const postBalance = meta.postBalances?.[0] || 0;
            const solChange = (postBalance - preBalance) / 1e9;
            
            if (solChange > 0) {
              type = 'receive';
              amount = Math.abs(solChange).toFixed(6);
            } else if (solChange < 0) {
              type = 'send';
              amount = Math.abs(solChange).toFixed(6);
            }

            // Check for SPL token transfers
            if (meta.postTokenBalances && meta.preTokenBalances) {
              for (const postToken of meta.postTokenBalances) {
                const preToken = meta.preTokenBalances.find(
                  (pre: any) => pre.accountIndex === postToken.accountIndex
                );
                
                if (preToken) {
                  const tokenChange = parseFloat(postToken.uiTokenAmount.uiAmountString || '0') - 
                                    parseFloat(preToken.uiTokenAmount.uiAmountString || '0');
                  
                  if (Math.abs(tokenChange) > 0) {
                    amount = Math.abs(tokenChange).toFixed(6);
                    token = postToken.mint.substring(0, 8) + '...';
                    type = tokenChange > 0 ? 'receive' : 'send';
                    break;
                  }
                }
              }
            }

            transactions.push({
              signature: sig.signature,
              timestamp: sig.blockTime * 1000,
              type,
              amount,
              token,
              from: tx.transaction.message.accountKeys[0].pubkey,
              to: tx.transaction.message.accountKeys[1]?.pubkey || 'System',
              fee: (meta.fee / 1e9).toFixed(6),
              status: sig.err ? 'failed' : 'confirmed'
            });

          }
        } catch (error) {
          console.error(`Error fetching transaction ${sig.signature}:`, error);
        }
      }

      console.log(`✅ Found ${transactions.length} Solana transactions`);

      res.json({
        success: true,
        transactions
      });

    } catch (error) {
      console.error('❌ Solana transaction fetch error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch transactions',
        transactions: []
      });
    }
  });

  console.log('✅ Solana endpoints registered');
}

// Helper function to get token metadata
async function getTokenMetadata(mint: string): Promise<{symbol: string, name: string, logo: string | null, price?: number} | null> {
  try {
    // Try to get token info from Jupiter API
    const response = await fetch(`https://quote-api.jup.ag/v6/tokens`);
    const data = await response.json() as any;
    
    const token = data[mint];
    if (token) {
      return {
        symbol: token.symbol,
        name: token.name,
        logo: token.logoURI || null,
        price: 0 // Jupiter doesn't provide prices in this endpoint
      };
    }

    // Fallback for well-known tokens
    const knownTokens: Record<string, any> = {
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { symbol: 'USDC', name: 'USD Coin', logo: null, price: 1.0 },
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': { symbol: 'USDT', name: 'Tether USD', logo: null, price: 1.0 },
      'So11111111111111111111111111111111111111112': { symbol: 'SOL', name: 'Solana', logo: null },
      'RDLuvH5CowJc6cXunCXDCbWWGYRSfzZ1MrwUBGGSxn4': { symbol: 'SRDL', name: 'Solana RDL', logo: null }
    };

    return knownTokens[mint] || null;
  } catch (error) {
    console.error('Error fetching token metadata:', error);
    return null;
  }
}