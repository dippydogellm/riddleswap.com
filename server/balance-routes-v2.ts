// Clean Balance Routes V2 - Separate from corrupted system
import type { Express } from 'express';
import { getBalanceV2, testBalanceSystemV2 } from './balance-system-v2';
import { requireAuthentication, AuthenticatedRequest, sessionAuth } from './middleware/session-auth';

export function setupBalanceRoutesV2(app: Express) {
  console.log('🚀 Setting up Balance System V2 routes...');

  // New clean balance endpoint (primary path)
  app.get('/api/v2/balance/:chain/:address', async (req, res) => {
    try {
      const { chain, address } = req.params;
      
      console.log(`📊 Balance request V2: ${chain}/${address}`);
      
      const result = await getBalanceV2(chain, address);
      
      if (result.success) {
        console.log(`✅ Balance V2 success: ${result.balance} ${chain} ($${result.balanceUSD.toFixed(2)})`);
      } else {
        console.log(`❌ Balance V2 failed: ${result.error}`);
      }
      
      res.json(result);
    } catch (error) {
      console.error('Balance V2 endpoint error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Alternative path for frontend compatibility
  app.get('/api/balance-v2/:chain/:address', async (req, res) => {
    try {
      const { chain, address } = req.params;
      
      console.log(`📊 Balance request V2 (alt): ${chain}/${address}`);
      
      const result = await getBalanceV2(chain, address);
      
      if (result.success) {
        console.log(`✅ Balance V2 success: ${result.balance} ${chain} ($${result.balanceUSD.toFixed(2)})`);
      } else {
        console.log(`❌ Balance V2 failed: ${result.error}`);
      }
      
      res.json(result);
    } catch (error) {
      console.error('Balance V2 endpoint error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Frontend-compatible endpoint with query parameters 
  app.get('/api/balance/v2', async (req, res) => {
    try {
      const { chain, address } = req.query;
      
      if (!chain || !address || typeof chain !== 'string' || typeof address !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters',
          message: 'Both chain and address query parameters are required'
        });
      }
      
      console.log(`📊 Balance request V2 (query): ${chain}/${address}`);
      
      const result = await getBalanceV2(chain, address);
      
      if (result.success) {
        console.log(`✅ Balance V2 success: ${result.balance} ${chain} ($${result.balanceUSD.toFixed(2)})`);
      } else {
        console.log(`❌ Balance V2 failed: ${result.error}`);
      }
      
      res.json(result);
    } catch (error) {
      console.error('Balance V2 query endpoint error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Test endpoint to verify system works
  app.get('/api/v2/balance-test', async (req, res) => {
    try {
      await testBalanceSystemV2();
      res.json({
        success: true,
        message: 'Balance System V2 test completed - check console for results'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Test failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Batch balance endpoint for multiple addresses
  app.post('/api/v2/balances', requireAuthentication, async (req: AuthenticatedRequest, res) => {
    try {
      const { addresses } = req.body; // Array of { chain, address } objects
      
      if (!Array.isArray(addresses)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request',
          message: 'addresses must be an array'
        });
      }

      const results = await Promise.all(
        addresses.map(({ chain, address }) => getBalanceV2(chain, address))
      );

      res.json({
        success: true,
        balances: results,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Batch balance error:', error);
      res.status(500).json({
        success: false,
        error: 'Batch request failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // XRPL Token endpoints - fetch from user's trustlines only
  app.get('/api/xrpl/tokens', async (req, res) => {
    try {
      const { address } = req.query;
      
      if (!address) {
        return res.json({
          success: true,
          tokens: [],
          message: 'No address provided'
        });
      }
      
      // Fetch user's trustlines to get their available tokens
      const baseUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5000';
      const trustlinesResponse = await fetch(`${baseUrl}/api/xrpl/trustlines/${address}`);
      
      if (!trustlinesResponse.ok) {
        return res.json({
          success: true,
          tokens: [],
          message: 'Could not fetch trustlines'
        });
      }
      
      const trustlinesData = await trustlinesResponse.json();
      
      // Always include XRP first
      const tokens = [{
        symbol: 'XRP',
        currency_code: 'XRP',
        name: 'XRP',
        issuer: '',
        icon_url: '/images/chains/xrp-logo.png',
        logo_url: '/images/chains/xrp-logo.png',
        verified: true,
        source: 'xrpl'
      }];
      
      // Add tokens from user's trustlines
      if (trustlinesData.success && trustlinesData.trustlines) {
        trustlinesData.trustlines.forEach((tl: any) => {
          // Convert hex currency codes to readable names
          let symbol = tl.currency;
          if (tl.currency && tl.currency.length === 40 && /^[0-9A-F]+$/.test(tl.currency)) {
            try {
              const cleanHex = tl.currency.replace(/0+$/, '');
              const decoded = Buffer.from(cleanHex, 'hex').toString('utf8').replace(/\0/g, '');
              symbol = decoded.length > 0 ? decoded : tl.currency.substring(0, 8);
            } catch {
              symbol = tl.currency.substring(0, 8);
            }
          }
          
          tokens.push({
            symbol,
            currency_code: tl.currency,
            name: symbol,
            issuer: tl.issuer,
            icon_url: `https://dd.dexscreener.com/ds-data/tokens/xrpl/${symbol.toLowerCase()}.${tl.issuer.toLowerCase()}.png?key=7c1c6a`,
            logo_url: `https://dd.dexscreener.com/ds-data/tokens/xrpl/${symbol.toLowerCase()}.${tl.issuer.toLowerCase()}.png?key=7c1c6a`,
            verified: true,
            source: 'trustline'
          });
        });
      }

      res.json({
        success: true,
        tokens,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('XRPL tokens error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch XRPL tokens'
      });
    }
  });
  
  // Popular tokens endpoint for token modal - fetch from multiple authentic APIs
  app.get('/api/xrpl/popular-tokens', async (req, res) => {
    try {
      console.log('📊 Fetching ALL XRPL tokens from authentic sources...');
      
      let allTokens = [];
      
      // Method 1: Try XRPLMeta first
      try {
        const xrplMetaResponse = await fetch('https://s1.xrplmeta.org/tokens', {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'RiddleSwap/1.0'
          },
          signal: AbortSignal.timeout(5000)
        });
        
        if (xrplMetaResponse.ok) {
          const xrplData = await xrplMetaResponse.json();
          const xrplTokens = xrplData
            .filter((token: any) => token.currency && token.issuer)
            .map((token: any) => ({
              symbol: token.currency,
              currency_code: token.currency_hex || token.currency,
              name: token.meta?.token?.name || token.currency,
              issuer: token.issuer,
              icon_url: token.meta?.token?.icon || `/chain-logos/${(token.currency || '').toLowerCase()}-logo.svg`,
              logo_url: token.meta?.token?.icon || `/chain-logos/${(token.currency || '').toLowerCase()}-logo.svg`,
              verified: true,
              source: 'xrplmeta'
            }));
          allTokens.push(...xrplTokens);
          console.log(`✅ Fetched ${xrplTokens.length} tokens from XRPLMeta`);
        }
      } catch (error) {
        console.log('❌ XRPLMeta failed, continuing with other sources...');
      }
      
      // Method 2: Try Bithomp API for tokens
      try {
        const bithompResponse = await fetch('https://bithomp.com/api/v2/tokens?limit=500', {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'RiddleSwap/1.0'
          },
          signal: AbortSignal.timeout(5000)
        });
        
        if (bithompResponse.ok) {
          const bithompData = await bithompResponse.json();
          if (bithompData.tokens) {
            const bithompTokens = bithompData.tokens
              .filter((token: any) => token.currency && token.issuer)
              .map((token: any) => ({
                symbol: token.currency,
                currency_code: token.currencyHex || token.currency,
                name: token.name || token.currency,
                issuer: token.issuer,
                icon_url: token.avatar || `/chain-logos/${(token.currency || '').toLowerCase()}-logo.svg`,
                logo_url: token.avatar || `/chain-logos/${(token.currency || '').toLowerCase()}-logo.svg`,
                verified: true,
                source: 'bithomp'
              }));
            allTokens.push(...bithompTokens);
            console.log(`✅ Fetched ${bithompTokens.length} tokens from Bithomp`);
          }
        }
      } catch (error) {
        console.log('❌ Bithomp failed, continuing...');
      }
      
      // Method 3: Add popular known tokens with authentic DexScreener logos
      const popularTokens = [
        { symbol: 'SOLO', currency_code: '534F4C4F00000000000000000000000000000000', name: 'SOLO', issuer: 'rsoLo2S1kiGeCcn6hCUXVrCpGMWLrRrLZz', verified: true, source: 'popular' },
        { symbol: 'CSC', currency_code: '43534300000000000000000000000000000000000', name: 'CasinoCoin', issuer: 'rCSCManTZ8ME9EoLrSHHYKW8PPwWMgkwr', verified: true, source: 'popular' },
        { symbol: 'CORE', currency_code: '434F524500000000000000000000000000000000', name: 'CORE', issuer: 'rcoreNywaoz2ZCQ8Lg2EbSLnGuRBmun6D', verified: true, source: 'popular' },
        { symbol: 'USD', currency_code: '555344000000000000000000000000000000000000', name: 'USD', issuer: 'rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq', verified: true, source: 'popular' },
        { symbol: 'BTC', currency_code: '425443000000000000000000000000000000000000', name: 'BTC', issuer: 'rchGBxcD1A1C2tdxF6papQYZ8kjRKMYcL', verified: true, source: 'popular' },
        { symbol: 'ETH', currency_code: '455448000000000000000000000000000000000000', name: 'ETH', issuer: 'rcA8X3TVMST1n3CJeAdGk1RdRCHii7N2h', verified: true, source: 'popular' }
      ].map(token => ({
        ...token,
        icon_url: `https://dd.dexscreener.com/ds-data/tokens/xrpl/${token.symbol.toLowerCase()}.${token.issuer.toLowerCase()}.png?key=7c1c6a`,
        logo_url: `https://dd.dexscreener.com/ds-data/tokens/xrpl/${token.symbol.toLowerCase()}.${token.issuer.toLowerCase()}.png?key=7c1c6a`
      }));
      
      allTokens.push(...popularTokens);
      
      // Remove duplicates based on issuer + currency
      const uniqueTokens = allTokens.filter((token, index, self) => 
        index === self.findIndex((t) => t.issuer === token.issuer && t.currency_code === token.currency_code)
      );
      
      console.log(`✅ Total unique XRPL tokens available: ${uniqueTokens.length}`);
      
      res.json({
        success: true,
        tokens: uniqueTokens,
        count: uniqueTokens.length
      });
    } catch (error) {
      console.error('Popular tokens error:', error);
      
      // Even on error, return some popular tokens so search works
      const fallbackTokens = [
        { symbol: 'SOLO', currency_code: '534F4C4F00000000000000000000000000000000', name: 'SOLO', issuer: 'rsoLo2S1kiGeCcn6hCUXVrCpGMWLrRrLZz', icon_url: '/chain-logos/solo-logo.svg', logo_url: '/chain-logos/solo-logo.svg', verified: true, source: 'fallback' },
        { symbol: 'CSC', currency_code: '43534300000000000000000000000000000000000', name: 'CasinoCoin', issuer: 'rCSCManTZ8ME9EoLrSHHYKW8PPwWMgkwr', icon_url: '/chain-logos/csc-logo.svg', logo_url: '/chain-logos/csc-logo.svg', verified: true, source: 'fallback' }
      ];
      
      res.json({
        success: true,
        tokens: fallbackTokens,
        error: 'Using fallback token list'
      });
    }
  });
  
  // XRPL Token search endpoint - search from user's trustlines only
  app.get('/api/xrpl/search-tokens', async (req, res) => {
    try {
      const { query, address } = req.query;
      console.log(`🔍 Searching XRPL tokens for: ${query}`);
      
      if (!query) {
        return res.json({
          success: true,
          tokens: []
        });
      }
      
      if (!address) {
        return res.json({
          success: true,
          tokens: [],
          message: 'Address required for token search'
        });
      }
      
      // Search through user's actual trustlines
      const baseUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5000';
      const trustlinesResponse = await fetch(`${baseUrl}/api/xrpl/trustlines/${address}`);
      
      if (!trustlinesResponse.ok) {
        return res.json({
          success: true,
          tokens: []
        });
      }
      
      const trustlinesData = await trustlinesResponse.json();
      const searchTerm = String(query).toLowerCase();
      const matchingTokens: any[] = [];
      
      // Search through user's trustlines
      if (trustlinesData.success && trustlinesData.trustlines) {
        trustlinesData.trustlines.forEach((tl: any) => {
          // Convert hex currency codes to readable names
          let symbol = tl.currency;
          if (tl.currency && tl.currency.length === 40 && /^[0-9A-F]+$/.test(tl.currency)) {
            try {
              const cleanHex = tl.currency.replace(/0+$/, '');
              const decoded = Buffer.from(cleanHex, 'hex').toString('utf8').replace(/\0/g, '');
              symbol = decoded.length > 0 ? decoded : tl.currency.substring(0, 8);
            } catch {
              symbol = tl.currency.substring(0, 8);
            }
          }
          
          if (symbol.toLowerCase().includes(searchTerm) || 
              tl.currency.toLowerCase().includes(searchTerm) ||
              tl.issuer.toLowerCase().includes(searchTerm)) {
            matchingTokens.push({
              symbol,
              currency_code: tl.currency,
              name: symbol,
              issuer: tl.issuer,
              icon_url: `/chain-logos/${symbol.toLowerCase()}-logo.svg`,
              verified: true,
              source: 'trustline'
            });
          }
        });
      }
      
      res.json({
        success: true,
        tokens: matchingTokens
      });
      
    } catch (error) {
      console.error('Token search error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to search tokens'
      });
    }
  });

  // XRPL Wallets endpoint to prevent HTML responses
  app.get('/api/xrpl/wallets', async (req, res) => {
    try {
      // Return wallet information for XRPL interface
      res.json({
        success: true,
        wallets: [],
        message: 'XRPL wallets endpoint',
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('XRPL wallets error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch XRPL wallets'
      });
    }
  });

  // Batch NFTs endpoint for multiple addresses - NO individual calls
  app.post('/api/v2/nfts/batch', sessionAuth, async (req: any, res) => {
    try {
      const { addresses } = req.body; // Array of { chain, address } objects
      
      if (!Array.isArray(addresses)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request',
          message: 'addresses must be an array'
        });
      }

      console.log(`🎨 [BATCH NFTs] Processing ${addresses.length} addresses`);

      const results = await Promise.all(
        addresses.map(async ({ chain, address }) => {
          if (chain?.toLowerCase() === 'xrp') {
            try {
              // Call Bithomp API directly for NFTs
              const { getBithompNFTs } = await import('./bithomp-api-v2');
              const nftsResult = await getBithompNFTs(address);
              
              if (nftsResult.success) {
                return {
                  success: true,
                  chain,
                  address,
                  nfts: nftsResult.nfts || [],
                  count: (nftsResult.nfts || []).length
                };
              } else {
                return {
                  success: false,
                  chain,
                  address,
                  nfts: [],
                  count: 0,
                  error: nftsResult.error || 'Failed to fetch NFTs'
                };
              }
            } catch (error) {
              return {
                success: false,
                chain,
                address,
                nfts: [],
                count: 0,
                error: error instanceof Error ? error.message : 'Unknown error'
              };
            }
          } else {
            // For other chains, return empty for now
            return {
              success: true,
              chain,
              address,
              nfts: [],
              count: 0,
              message: 'Chain not supported yet'
            };
          }
        })
      );

      console.log(`✅ [BATCH NFTs] Processed ${results.length} addresses`);

      res.json({
        success: true,
        results: results,
        totalAddresses: addresses.length,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('❌ [BATCH NFTs] Error:', error);
      res.status(500).json({
        success: false,
        error: 'Batch NFT request failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Batch tokens endpoint for multiple addresses - NO individual calls  
  app.post('/api/v2/tokens/batch', sessionAuth, async (req: any, res) => {
    try {
      const { addresses } = req.body; // Array of { chain, address } objects
      
      if (!Array.isArray(addresses)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request',
          message: 'addresses must be an array'
        });
      }

      console.log(`🪙 [BATCH TOKENS] Processing ${addresses.length} addresses`);

      const results = await Promise.all(
        addresses.map(async ({ chain, address }) => {
          if (chain?.toLowerCase() === 'xrp') {
            try {
              // Call Bithomp API directly for tokens
              const { getBithompTokens } = await import('./bithomp-api-v2');
              const tokensResult = await getBithompTokens(address);
              
              if (tokensResult.success) {
                return {
                  success: true,
                  chain,
                  address,
                  tokens: tokensResult.tokens || [],
                  count: (tokensResult.tokens || []).length
                };
              } else {
                return {
                  success: false,
                  chain,
                  address,
                  tokens: [],
                  count: 0,
                  error: tokensResult.error || 'Failed to fetch tokens'
                };
              }
            } catch (error) {
              return {
                success: false,
                chain,
                address,
                tokens: [],
                count: 0,
                error: error instanceof Error ? error.message : 'Unknown error'
              };
            }
          } else {
            // For other chains, return empty for now
            return {
              success: true,
              chain,
              address,
              tokens: [],
              count: 0,
              message: 'Chain not supported yet'
            };
          }
        })
      );

      console.log(`✅ [BATCH TOKENS] Processed ${results.length} addresses`);

      res.json({
        success: true,
        results: results,
        totalAddresses: addresses.length,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('❌ [BATCH TOKENS] Error:', error);
      res.status(500).json({
        success: false,
        error: 'Batch token request failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // REMOVED: Individual NFT detail endpoint (stub) - This was conflicting with the live endpoint in nft-marketplace-routes.ts
  // The live endpoint at /api/nft/detail/:tokenId in nft-marketplace-routes.ts now handles all NFT detail requests

  // TEMPORARY: Test NFT endpoint with your actual NFT data (no auth)
  app.get('/api/test/nfts/dippydoge', async (req, res) => {
    res.json({
      success: true,
      results: [{
        success: true,
        chain: 'xrp',
        address: 'rEVrTKUKSLx5nxdfV8SAFTxS9FGFrfHRLo',
        nfts: [
          {
            tokenID: '00080BB84047A9C1CA01632DCBE55AE16223C3C86C3D44D2D5B3FCA905D2560D',
            name: 'Riddle Raffle #5',
            image: 'https://cdn.bithomp.com/image/bafybeigh2eafch4xeqndgjxdzecbe7pz5pqxrq6mj3xciu7vvcboacvkt4%2FRaffle.png',
            preview: 'https://cdn.bithomp.com/preview/bafybeigh2eafch4xeqndgjxdzecbe7pz5pqxrq6mj3xciu7vvcboacvkt4%2FRaffle.png',
            thumbnail: 'https://cdn.bithomp.com/thumbnail/bafybeigh2eafch4xeqndgjxdzecbe7pz5pqxrq6mj3xciu7vvcboacvkt4%2FRaffle.png',
            collection: { name: 'Riddle Raffle', description: 'Add Collection Description' },
            description: 'Add NFT Description',
            issuer: 'raitaXppXqftnQt8Jd2dp6uxh6dKDENDpg',
            transferFee: 3000,
            attributes: [{ trait_type: 'Riddle Raffle Ticket', value: 1 }]
          },
          {
            tokenID: '00080BB812C36A8E1C6C8B3DCE5BA3902299EF5B6EB51C8F5135507605BA1DD9',
            name: 'The Silver Rogue',
            image: 'https://cdn.bithomp.com/image/bafybeigp2mspowp7lvifxf7nujgnltgvbhjioqykwojbqjk53wivqdl33m%2F2041.png',
            preview: 'https://cdn.bithomp.com/preview/bafybeigp2mspowp7lvifxf7nujgnltgvbhjioqykwojbqjk53wivqdl33m%2F2041.png',
            thumbnail: 'https://cdn.bithomp.com/thumbnail/bafybeigp2mspowp7lvifxf7nujgnltgvbhjioqykwojbqjk53wivqdl33m%2F2041.png',
            collection: { name: 'The Inquisition Collectors Deck', description: 'Find peace in having nothing. Find strength in having something. Find drive in wanting it all. Welcome, to the Inquisition. Abstract, and from the World of RDL explore conflict excitement and enchantment as a community. Be a collector. Be riddle.' },
            description: 'I reveal in eternity, yet see everything. What am I?',
            issuer: 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH',
            transferFee: 3000,
            attributes: [
              { trait_type: 'Element', value: 'Silver' },
              { trait_type: 'Health', value: '80' },
              { trait_type: 'Power', value: '61' },
              { trait_type: 'Defence', value: '94' },
              { trait_type: 'Special Ability 1', value: 'Mind Control' },
              { trait_type: 'Special Ability 2', value: 'Mind Whisper' },
              { trait_type: 'Defence Ability', value: 'Life Drain' },
              { trait_type: 'IQ Level', value: '85' }
            ]
          },
          {
            tokenID: '00080BB812C36A8E1C6C8B3DCE5BA3902299EF5B6EB51C8FDC0717BE05BA1D21',
            name: 'The Adamantium Priest',
            image: 'https://cdn.bithomp.com/image/bafybeigp2mspowp7lvifxf7nujgnltgvbhjioqykwojbqjk53wivqdl33m%2F774.png',
            preview: 'https://cdn.bithomp.com/preview/bafybeigp2mspowp7lvifxf7nujgnltgvbhjioqykwojbqjk53wivqdl33m%2F774.png',
            thumbnail: 'https://cdn.bithomp.com/thumbnail/bafybeigp2mspowp7lvifxf7nujgnltgvbhjioqykwojbqjk53wivqdl33m%2F774.png',
            collection: { name: 'The Inquisition Collectors Deck', description: 'Find peace in having nothing. Find strength in having something. Find drive in wanting it all. Welcome, to the Inquisition.' },
            description: 'I find answers, though movement. What am I?',
            issuer: 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH',
            transferFee: 3000,
            attributes: [
              { trait_type: 'Element', value: 'Adamantium' },
              { trait_type: 'Health', value: '75' },
              { trait_type: 'Power', value: '100' },
              { trait_type: 'Defence', value: '89' },
              { trait_type: 'Special Ability 1', value: 'Life Drain' },
              { trait_type: 'Special Ability 2', value: 'Light Shield' },
              { trait_type: 'Defence Ability', value: 'Soul Bind' },
              { trait_type: 'IQ Level', value: '90' }
            ]
          },
          {
            tokenID: '00081388ED0CAB5CF36A7B9A5408FACEA72660FB7E2EB5335354FF8D05B8C1F4',
            name: 'Bricky #431',
            image: 'https://cdn.bithomp.com/image/bafybeibq6elzovos7szhcxzdv56acpkrmulewwe2ou6gbhhmz7qvh4oyce%2Fbricky-%23431.png',
            preview: 'https://cdn.bithomp.com/preview/bafybeibq6elzovos7szhcxzdv56acpkrmulewwe2ou6gbhhmz7qvh4oyce%2Fbricky-%23431.png',
            thumbnail: 'https://cdn.bithomp.com/thumbnail/bafybeibq6elzovos7szhcxzdv56acpkrmulewwe2ou6gbhhmz7qvh4oyce%2Fbricky-%23431.png',
            collection: { name: 'Bricky Collection', description: 'Collection of 589 Bricks.' },
            description: 'Collection of 589 Bricks.',
            issuer: 'r4cQKkQ3bGLVoNSPicZ6mZFNJx4MybNKLQ',
            transferFee: 5000,
            attributes: [
              { trait_type: 'Background', value: 'Western' },
              { trait_type: 'Body', value: 'Ice' },
              { trait_type: 'Arms', value: 'Numba Won' },
              { trait_type: 'Face', value: 'Smirk' },
              { trait_type: 'Headwear', value: 'Astroid' }
            ]
          }
        ]
      }]
    });
  });

  console.log('✅ Balance System V2 routes with batch endpoints setup complete');
}