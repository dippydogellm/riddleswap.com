import { Express } from 'express';
import { sessionAuth } from './middleware/session-auth';
import fetch from 'node-fetch';

export default function registerWalletProfileRoutes(app: Express) {
  
  // SECURE: Get wallet NFTs - authenticated users only, own wallet only
  app.get('/api/wallet/nfts/:address', sessionAuth, async (req, res) => {
    try {
      const { address } = req.params;
      
      // SECURITY: Only allow access to authenticated user's own wallet
      if (address !== (req.user as any)?.walletAddress) {
        return res.status(403).json({
          success: false,
          error: 'Access denied - can only view your own wallet data'
        });
      }
      
      if (!address || !address.startsWith('r')) {
        return res.status(400).json({ error: 'Invalid XRPL address' });
      }
      
      console.log(`🎨 [WALLET] Fetching NFTs for address: ${address}`);
      
      // Use the proper Bithomp NFTs endpoint with premium offer parameters
      const response = await fetch(`https://bithomp.com/api/v2/nfts?owner=${address}&limit=100&metadata=true&sellOffers=true&buyOffers=true&offersValidate=true`, {
        headers: {
          'x-bithomp-token': process.env.BITHOMP_API_KEY || '',
          'Accept': 'application/json'
        }
      });
      
      let nfts = [];
      if (response.ok) {
        const data = await response.json() as any;
        const nftsList = data.nfts || data.result || [];
        
        console.log(`📦 Raw NFTs data: ${nftsList.length} items`);
        
        nfts = nftsList.map((nft: any) => {
          const nftokenID = nft.nftokenID || nft.nfTokenID || '';
          let metadata = nft.metadata || nft.jsonMeta || {};
          
          // Parse metadata if it's a string
          if (typeof metadata === 'string') {
            try {
              metadata = JSON.parse(metadata);
            } catch (e) {
              metadata = {};
            }
          }
          
          // Extract collection name from description or create readable name
          let collectionName = 'Unknown Collection';
          
          if (metadata?.description && typeof metadata.description === 'string') {
            // Extract from "Collection of X Bricks" format
            const match = metadata.description.match(/Collection of \d+ ([^.]+)/i);
            if (match && match[1]) {
              collectionName = match[1].trim();
            }
          }
          
          // Fallback to readable issuer-based name
          if (collectionName === 'Unknown Collection') {
            const issuerShort = `${nft.issuer?.slice(0, 6)}...${nft.issuer?.slice(-4)}`;
            collectionName = `${issuerShort} #${nft.nftokenTaxon || 0}`;
          }
          
          // Ensure proper image URL handling - convert IPFS to working gateway
          let imageUrl = metadata?.image || nft.image;
          if (!imageUrl) {
            // Use proxy endpoint as fallback
            imageUrl = `/api/nft/image/${nftokenID}`;
          } else if (imageUrl.startsWith('ipfs://')) {
            // Convert IPFS to working gateway URL (Cloudflare IPFS gateway)
            const ipfsHash = imageUrl.replace('ipfs://', '');
            imageUrl = `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`;
          } else if (imageUrl.includes('bithomp.com/en/nft/image/')) {
            // Fix broken format to working format
            const tokenId = imageUrl.split('/').pop();
            imageUrl = `/api/nft/image/${tokenId}`;
          }
          
          return {
            nft_id: nftokenID,
            nftokenID: nftokenID,
            name: metadata?.name || nft.name || `NFT #${nftokenID.slice(-6)}`,
            image: imageUrl,
            collection: collectionName,
            issuer: nft.issuer,
            taxon: nft.nftokenTaxon || nft.taxon || 0,
            rarity: metadata?.rarity || nft.rarity || 'Common',
            attributes: metadata?.attributes || nft.attributes || [],
            floor_price: parseFloat(nft.floorPrice || '0'),
            owner: nft.owner || address
          };
        });
        
        console.log(`✅ Processed ${nfts.length} NFTs for wallet`);
      } else {
        console.log(`⚠️ Bithomp API error for ${address}: ${response.status}`);
      }
      
      console.log(`✅ Found ${nfts.length} NFTs for wallet ${address}`);
      
      res.json({
        success: true,
        nfts: nfts,
        count: nfts.length
      });
      
    } catch (error) {
      console.error('Error fetching wallet NFTs:', error);
      res.status(500).json({ 
        error: 'Failed to fetch wallet NFTs',
        nfts: [],
        count: 0
      });
    }
  });

  // SECURE: Get wallet tokens/balances - authenticated users only, own wallet only
  app.get('/api/wallet/tokens/:address', sessionAuth, async (req, res) => {
    try {
      const { address } = req.params;
      
      // SECURITY: Only allow access to authenticated user's own wallet
      if (address !== (req.user as any)?.walletAddress) {
        return res.status(403).json({
          success: false,
          error: 'Access denied - can only view your own wallet data'
        });
      }
      
      if (!address || !address.startsWith('r')) {
        return res.status(400).json({ error: 'Invalid XRPL address' });
      }
      
      console.log(`🪙 [WALLET] Fetching tokens for address: ${address}`);
      
      let tokens = [];
      
      // First get XRP balance from our existing endpoint
      const xrpBalanceResponse = await fetch(`http://localhost:5000/api/wallets/xrp/balance/${address}`, {
        headers: {
          'Authorization': req.headers.authorization || ''
        }
      });
      
      if (xrpBalanceResponse.ok) {
        const xrpData = await xrpBalanceResponse.json() as any;
        
        // Add XRP balance with real data
        const xrpBalance = xrpData.balance || xrpData.totalBalance || '0';
        const xrpNum = parseFloat(xrpBalance);
        
        tokens.push({
          currency: 'XRP',
          balance: xrpNum.toFixed(6),
          value: xrpNum,
          logo: '/images/chains/xrp-logo.png',
          issuer: null,
          available: xrpData.availableBalance || '0',
          reserved: xrpData.reservedBalance || '0'
        });
        
        console.log(`💰 XRP Balance: ${xrpNum} XRP (Available: ${xrpData.availableBalance}, Reserved: ${xrpData.reservedBalance})`);
      }
      
      // Then get token balances (trustlines) directly from XRPL using WebSocket
      try {
        const ws = await import('ws');
        const WebSocket = ws.default;
        const trustlinePromise = new Promise((resolve) => {
          const ws = new WebSocket('wss://s1.ripple.com');
          const timeout = setTimeout(() => {
            ws.close();
            resolve([]);
          }, 3000);
          
          ws.on('open', () => {
            ws.send(JSON.stringify({
              id: 1,
              command: 'account_lines',
              account: address,
              ledger_index: 'validated'
            }));
          });
          
          ws.on('message', (data: any) => {
            try {
              const response = JSON.parse(data.toString());
              if (response.result && response.result.lines) {
                clearTimeout(timeout);
                ws.close();
                resolve(response.result.lines);
              }
            } catch (e) {
              console.error('Error parsing XRPL response:', e);
            }
          });
          
          ws.on('error', () => {
            clearTimeout(timeout);
            resolve([]);
          });
        });
        
        const trustlines = await trustlinePromise as any[];
        console.log(`📊 Found ${trustlines.length} trustlines from XRPL WebSocket`);
        
        // Process all trustlines with DexScreener metadata enrichment
        for (const line of trustlines) {
          const tokenBalance = parseFloat(line.balance || '0');
          
          // Get token metadata from DexScreener API
          let tokenName = line.currency;
          let tokenSymbol = line.currency;
          let tokenLogo = null;
          let priceUsd = 0;
          
          try {
            // Convert hex currency codes to readable names
            if (line.currency.length === 40 && line.currency.match(/^[0-9A-Fa-f]+$/)) {
              try {
                // Standard currency codes are 20 bytes (40 hex chars) with null padding
                const hexToString = Buffer.from(line.currency, 'hex').toString('utf8').replace(/\0+$/g, '');
                // Check if it's a valid ASCII string for currency codes
                if (hexToString && hexToString.length >= 2 && hexToString.length <= 20) {
                  // Remove any non-printable characters and validate
                  const cleanString = hexToString.replace(/[^\x20-\x7E]/g, '');
                  if (cleanString && cleanString.length >= 2 && /^[A-Za-z0-9]+$/.test(cleanString)) {
                    tokenSymbol = cleanString;
                    tokenName = cleanString;
                    console.log(`🔍 Converted hex ${line.currency.slice(0, 10)}... to ${cleanString}`);
                  }
                }
              } catch (e) {
                // Keep original if conversion fails
                console.log(`⚠️ Failed to convert hex ${line.currency.slice(0, 10)}...`);
              }
            }
            
            // Enhanced token mappings for better display - names only, no price estimates
            const knownTokens: {[key: string]: {name: string, symbol: string, logo?: string}} = {
              'SIG': { name: 'Signum', symbol: 'SIG' },
              'RDL': { name: 'RiddleSwap Token', symbol: 'RDL' },
              'BKT': { name: 'Bucket Token', symbol: 'BKT' },
              'USD': { name: 'USD Coin', symbol: 'USD' },
              'XMEME': { name: 'XRPL Meme', symbol: 'XMEME' },
              'RLSD': { name: 'RippleUSD', symbol: 'RLSD' },
              'ARMY': { name: 'ARMY Token', symbol: 'ARMY' },
              'SIGMA': { name: 'Sigma Token', symbol: 'SIGMA' },
              'SEAL': { name: 'Seal Token', symbol: 'SEAL' },
              'GRIM': { name: 'Grim Token', symbol: 'GRIM' },
              'LOX': { name: 'LOX Token', symbol: 'LOX' },
              'ATM': { name: 'ATM Token', symbol: 'ATM' },
              'GEN': { name: 'GEN Token', symbol: 'GEN' },
              'BCHAMP': { name: 'BCHAMP', symbol: 'BCHAMP' },
              'CBIRD': { name: 'CBIRD', symbol: 'CBIRD' },
              'STIMPY': { name: 'STIMPY', symbol: 'STIMPY' }
            };
            
            if (knownTokens[tokenSymbol]) {
              tokenName = knownTokens[tokenSymbol].name;
              tokenSymbol = knownTokens[tokenSymbol].symbol;
              tokenLogo = knownTokens[tokenSymbol].logo || null;
            }
            
            // For ALL tokens with balance, try multiple APIs to get real price data
            if (tokenBalance > 0) {
              console.log(`🔍 [PRICE] Getting real price data for ${tokenSymbol} (${line.account})`);
              
              try {
                // Method 1: DexScreener search by token symbol
                const symbolSearch = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(tokenSymbol)}`);
                if (symbolSearch.ok) {
                  const symbolData = await symbolSearch.json() as any;
                  const xrplPairs = symbolData.pairs?.filter((pair: any) => 
                    pair.chainId === 'xrpl' && 
                    (pair.baseToken?.symbol === tokenSymbol || pair.quoteToken?.symbol === tokenSymbol)
                  ) || [];
                  
                  if (xrplPairs.length > 0) {
                    const pair = xrplPairs[0];
                    priceUsd = parseFloat(pair.priceUsd || '0');
                    console.log(`✅ [PRICE] DexScreener symbol search - ${tokenSymbol}: $${priceUsd}`);
                  }
                }
                
                // Method 2: If no price found, try issuer address search
                if (priceUsd === 0) {
                  const issuerSearch = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(line.account)}`);
                  if (issuerSearch.ok) {
                    const issuerData = await issuerSearch.json() as any;
                    const issuerPairs = issuerData.pairs?.filter((pair: any) => 
                      pair.chainId === 'xrpl' && 
                      (pair.baseToken?.address === line.account || pair.quoteToken?.address === line.account)
                    ) || [];
                    
                    if (issuerPairs.length > 0) {
                      const pair = issuerPairs[0];
                      priceUsd = parseFloat(pair.priceUsd || '0');
                      console.log(`✅ [PRICE] DexScreener issuer search - ${tokenSymbol}: $${priceUsd}`);
                    }
                  }
                }
                
                // Method 3: Try our internal XRPL token search API
                if (priceUsd === 0) {
                  const internalSearch = await fetch(`http://localhost:5000/api/xrpl/tokens/search?q=${encodeURIComponent(tokenSymbol)}`);
                  if (internalSearch.ok) {
                    const internalData = await internalSearch.json() as any;
                    if (internalData.success && internalData.tokens?.length > 0) {
                      const matchedToken = internalData.tokens.find((t: any) => 
                        t.symbol === tokenSymbol && t.issuer === line.account
                      );
                      if (matchedToken && matchedToken.price_usd) {
                        priceUsd = parseFloat(matchedToken.price_usd);
                        console.log(`✅ [PRICE] Internal API - ${tokenSymbol}: $${priceUsd}`);
                      }
                    }
                  }
                }
                
                if (priceUsd > 0) {
                  console.log(`💰 [PRICE] Final price for ${tokenSymbol}: $${priceUsd}`);
                } else {
                  console.log(`⚠️ [PRICE] No real price data found for ${tokenSymbol}`);
                }
                
              } catch (priceError) {
                console.log(`❌ [PRICE] Error fetching real price for ${tokenSymbol}:`, priceError);
              }
            }
            
          } catch (metadataError) {
            console.log(`⚠️ Could not process metadata for ${line.currency}:`, metadataError);
          }
          
          tokens.push({
            currency: tokenSymbol,
            name: tokenName,
            issuer: line.account,
            balance: tokenBalance.toFixed(6),
            value: tokenBalance,
            price_usd: priceUsd,
            limit: line.limit || '0',
            logo: tokenLogo
          });
        }
      } catch (trustlineError) {
        console.log(`⚠️ Could not fetch trustlines: ${trustlineError}`);
      }
      
      // If no tokens found, return at least empty XRP
      if (tokens.length === 0) {
        console.log(`⚠️ No balances found for ${address}`);
        tokens = [{
          currency: 'XRP',
          balance: '0.000000',
          value: 0,
          logo: '/images/chains/xrp-logo.png',
          issuer: null
        }];
      }
      
      
      console.log(`✅ Found ${tokens.length} tokens for wallet ${address}`);
      
      res.json({
        success: true,
        tokens: tokens,
        count: tokens.length
      });
      
    } catch (error) {
      console.error('Error fetching wallet tokens:', error);
      res.status(500).json({ 
        error: 'Failed to fetch wallet tokens',
        tokens: [],
        count: 0
      });
    }
  });

  // SECURE: Sell ALL tokens and remove trustline - authenticated users only
  app.post('/api/wallet/trustline/sell-all-and-remove', sessionAuth, async (req, res) => {
    try {
      const { currency, issuer, confirmRemoval, slippage = 10 } = req.body;
      const user = req.user as any;
      
      if (!currency || !issuer || !confirmRemoval) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: currency, issuer, confirmRemoval'
        });
      }
      
      if (!user?.handle) {
        return res.status(401).json({
          success: false,
          error: 'User handle not found in session'
        });
      }
      
      console.log(`🗑️💱 [SELL ALL & REMOVE] User ${user.handle} selling ALL ${currency} and removing trustline`);
      
      // Get cached private key from activeSessions
      const authHeader = req.headers.authorization;
      const sessionToken = authHeader?.replace('Bearer ', '');
      let xrpPrivateKey: string | null = null;
      
      if (sessionToken) {
        const { activeSessions } = await import('./riddle-wallet-auth');
        const session = activeSessions.get(sessionToken);
        
        if (session?.cachedKeys?.xrpPrivateKey) {
          console.log(`🔑 [SELL ALL & REMOVE] Using cached XRP private key from session for ${session.handle}`);
          xrpPrivateKey = session.cachedKeys.xrpPrivateKey;
        }
      }
      
      // If no cached key, fail
      if (!xrpPrivateKey) {
        console.error(`❌ [SELL ALL & REMOVE] No cached XRP private key available for ${user.handle}`);
        return res.status(401).json({
          success: false,
          error: 'XRP private key not available in session - please renew your session'
        });
      }

      // STEP 1: Get current token balance from XRPL
      const { Client } = await import('xrpl');
      const client = new Client('wss://s1.ripple.com');
      await client.connect();
      
      let currentBalance = '0';
      try {
        const accountLines = await client.request({
          command: 'account_lines',
          account: user.walletAddress
        });
        
        const line = accountLines.result.lines.find((l: any) => 
          l.currency === currency && l.account === issuer
        );
        
        if (line) {
          currentBalance = line.balance;
          console.log(`💰 [SELL ALL & REMOVE] Current ${currency} balance: ${currentBalance}`);
        } else {
          await client.disconnect();
          return res.status(400).json({
            success: false,
            error: `No trustline found for ${currency} or balance is already zero`
          });
        }
      } catch (error) {
        await client.disconnect();
        throw error;
      }
      await client.disconnect();
      
      // STEP 2: Sell ALL tokens to XRP with high slippage tolerance
      let swapResult: any = null;
      
      if (parseFloat(currentBalance) === 0) {
        console.log(`✅ [SELL ALL & REMOVE] Balance already zero, skipping sale`);
        // Skip to removal
      } else {
        console.log(`💱 [SELL ALL & REMOVE] Selling ${currentBalance} ${currency} to XRP...`);
        
        const cachedKeys = {
          xrpPrivateKey: xrpPrivateKey,
          handle: user.handle,
          walletAddress: user.walletAddress
        };
        
        const swapModule = await import('./xrpl/xrpl-swap-cached');
        swapResult = await swapModule.executeXrplSwapWithCachedKeys(
          cachedKeys,
          currency,
          'XRP',
          currentBalance, // Sell ENTIRE balance
          issuer,
          '',
          user.handle,
          user.walletAddress,
          slippage // Use higher slippage for dust
        );
        
        if (!swapResult || !swapResult.success) {
          const errorMsg = (swapResult && swapResult.error) || 'Failed to sell all tokens';
          console.error(`❌ [SELL ALL & REMOVE] Token sale failed:`, errorMsg);
          return res.status(400).json({
            success: false,
            error: `Failed to sell tokens: ${errorMsg}`,
            step: 'sell'
          });
        }
        
        console.log(`✅ [SELL ALL & REMOVE] All tokens sold: ${swapResult.txHash}`);
        
        // Wait for the transaction to be validated
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      
      // STEP 3: Remove trustline
      console.log(`🗑️ [SELL ALL & REMOVE] Removing trustline for ${currency}...`);
      
      const { removeTrustlineWithCachedKey } = await import('./xrpl/xrpl-trustline');
      const removeResult = await removeTrustlineWithCachedKey(
        xrpPrivateKey,
        user.walletAddress,
        currency,
        issuer
      );
      
      if (removeResult.success) {
        console.log(`✅ [SELL ALL & REMOVE] Trustline removed: ${removeResult.txHash}`);
        
        res.json({
          success: true,
          message: `Successfully sold all ${currency} tokens and removed trustline`,
          sellTxHash: parseFloat(currentBalance) > 0 ? swapResult?.txHash : null,
          removeTxHash: removeResult.txHash,
          currency,
          issuer,
          amountSold: currentBalance
        });
      } else {
        console.error(`❌ [SELL ALL & REMOVE] Trustline removal failed: ${removeResult.error}`);
        
        res.status(400).json({
          success: false,
          error: `Sold tokens but failed to remove trustline: ${removeResult.error}`,
          step: 'remove',
          sellTxHash: swapResult?.txHash
        });
      }
      
    } catch (error) {
      console.error('❌ [SELL ALL & REMOVE] Error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error during sell and remove operation'
      });
    }
  });

  // SECURE: Remove trustline - authenticated users only, zero balance required
  app.post('/api/wallet/trustline/remove', sessionAuth, async (req, res) => {
    try {
      const { currency, issuer, confirmRemoval } = req.body;
      const user = req.user as any;
      
      if (!currency || !issuer || !confirmRemoval) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: currency, issuer, confirmRemoval'
        });
      }
      
      if (!user?.handle) {
        return res.status(401).json({
          success: false,
          error: 'User handle not found in session'
        });
      }
      
      console.log(`🗑️ [TRUSTLINE REMOVE] User ${user.handle} removing trustline: ${currency} (${issuer})`);
      
      // Get cached private key from activeSessions
      const authHeader = req.headers.authorization;
      const sessionToken = authHeader?.replace('Bearer ', '');
      let xrpPrivateKey: string | null = null;
      
      if (sessionToken) {
        const { activeSessions } = await import('./riddle-wallet-auth');
        const session = activeSessions.get(sessionToken);
        
        if (session?.cachedKeys?.xrpPrivateKey) {
          console.log(`🔑 [TRUSTLINE REMOVE] Using cached XRP private key from session for ${session.handle}`);
          xrpPrivateKey = session.cachedKeys.xrpPrivateKey;
        }
      }
      
      // If no cached key, fail
      if (!xrpPrivateKey) {
        console.error(`❌ [TRUSTLINE REMOVE] No cached XRP private key available for ${user.handle}`);
        return res.status(401).json({
          success: false,
          error: 'XRP private key not available in session - please renew your session'
        });
      }
      
      // Use the cached-key trustline removal function
      const { removeTrustlineWithCachedKey } = await import('./xrpl/xrpl-trustline');
      const result = await removeTrustlineWithCachedKey(
        xrpPrivateKey,
        user.walletAddress,
        currency,
        issuer
      );
      
      if (result.success) {
        console.log(`✅ [TRUSTLINE REMOVE] Successfully removed ${currency} trustline: ${result.txHash}`);
        
        res.json({
          success: true,
          message: `Trustline for ${currency} removed successfully`,
          txHash: result.txHash,
          currency,
          issuer
        });
      } else {
        console.error(`❌ [TRUSTLINE REMOVE] Failed: ${result.error}`);
        
        res.status(400).json({
          success: false,
          error: result.error || 'Failed to remove trustline'
        });
      }
      
    } catch (error) {
      console.error('❌ [TRUSTLINE REMOVE] Error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error while removing trustline'
      });
    }
  });

  // SECURE: Get removable trustlines - authenticated users only  
  app.get('/api/wallet/trustlines/removable', sessionAuth, async (req, res) => {
    try {
      const user = req.user as any;
      
      if (!user?.walletAddress) {
        return res.status(400).json({
          success: false,
          error: 'Wallet address not found in session'
        });
      }
      
      console.log(`🔍 [REMOVABLE TRUSTLINES] Finding zero-balance trustlines for ${user.walletAddress}`);
      
      // Get current trustlines using existing token endpoint logic
      const tokensResponse = await fetch(`http://localhost:5000/api/wallet/tokens/${user.walletAddress}`, {
        headers: {
          'Authorization': req.headers.authorization || ''
        }
      });
      
      if (!tokensResponse.ok) {
        throw new Error('Failed to fetch current tokens');
      }
      
      const tokensData = await tokensResponse.json() as any;
      const tokens = tokensData.tokens || [];
      
      // Filter for tokens with zero balance (excluding XRP)
      const removableTokens = tokens.filter((token: any) => 
        token.currency !== 'XRP' && 
        parseFloat(token.balance || '0') === 0 &&
        token.issuer
      );
      
      console.log(`📋 [REMOVABLE TRUSTLINES] Found ${removableTokens.length} removable trustlines`);
      
      res.json({
        success: true,
        removableTrustlines: removableTokens.map((token: any) => ({
          currency: token.currency,
          name: token.name || token.currency,
          issuer: token.issuer,
          balance: token.balance,
          limit: token.limit || '0'
        })),
        count: removableTokens.length,
        message: removableTokens.length > 0 
          ? `Found ${removableTokens.length} trustlines that can be safely removed`
          : 'No trustlines available for removal'
      });
      
    } catch (error) {
      console.error('❌ [REMOVABLE TRUSTLINES] Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch removable trustlines'
      });
    }
  });

  // SECURE: Get sellable tokens with balances - authenticated users only  
  app.get('/api/wallet/tokens/sellable', sessionAuth, async (req, res) => {
    try {
      const user = req.user as any;
      
      if (!user?.walletAddress) {
        return res.status(400).json({
          success: false,
          error: 'Wallet address not found in session'
        });
      }
      
      console.log(`🔍 [SELLABLE TOKENS] Fetching tokens with balances for wallet: ${user.walletAddress}`);
      
      // Get current tokens using existing token endpoint logic
      const tokensResponse = await fetch(`http://localhost:5000/api/wallet/tokens/${user.walletAddress}`, {
        headers: {
          'Authorization': req.headers.authorization || ''
        }
      });
      
      if (!tokensResponse.ok) {
        throw new Error('Failed to fetch current tokens');
      }
      
      const tokensData = await tokensResponse.json() as any;
      const tokens = tokensData.tokens || [];
      
      // Filter for tokens with positive balances (excluding XRP)
      const sellableTokens = tokens.filter((token: any) => 
        token.currency !== 'XRP' && 
        parseFloat(token.balance || '0') > 0 &&
        token.issuer
      );
      
      console.log(`💰 [SELLABLE TOKENS] Found ${sellableTokens.length} tokens with balances`);
      
      res.json({
        success: true,
        sellableTokens: sellableTokens.map((token: any) => ({
          currency: token.currency,
          name: token.name || token.currency,
          issuer: token.issuer,
          balance: token.balance,
          limit: token.limit || '0',
          symbol: token.symbol || token.currency
        })),
        count: sellableTokens.length,
        message: sellableTokens.length > 0 
          ? `Found ${sellableTokens.length} tokens with balances that can be sold`
          : 'No tokens with balances found'
      });
      
    } catch (error) {
      console.error('❌ [SELLABLE TOKENS] Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch sellable tokens'
      });
    }
  });

  // SECURE: Sell individual token to XRP - authenticated users only
  app.post('/api/wallet/tokens/sell-to-xrp', sessionAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const { currency, issuer, amount, slippage = 5 } = req.body;
      
      if (!user?.handle) {
        return res.status(400).json({
          success: false,
          error: 'User handle not found in session'
        });
      }
      
      if (!currency || !issuer || !amount) {
        return res.status(400).json({
          success: false,
          error: 'Currency, issuer, and amount are required'
        });
      }
      
      console.log(`💱 [SELL TOKEN] Selling ${amount} ${currency} to XRP for user: ${user.handle}`);
      
      // Get cached private key from activeSessions
      const authHeader = req.headers.authorization;
      const sessionToken = authHeader?.replace('Bearer ', '');
      let xrpPrivateKey: string | null = null;
      
      if (sessionToken) {
        const { activeSessions } = await import('./riddle-wallet-auth');
        const session = activeSessions.get(sessionToken);
        
        if (session?.cachedKeys?.xrpPrivateKey) {
          console.log(`🔑 [SELL TOKEN] Using cached XRP private key from session for ${session.handle}`);
          xrpPrivateKey = session.cachedKeys.xrpPrivateKey;
        }
      }
      
      // If no cached key, fail
      if (!xrpPrivateKey) {
        console.error(`❌ [SELL TOKEN] No cached XRP private key available for ${user.handle}`);
        return res.status(400).json({
          success: false,
          error: 'No XRP private key available in cache - please renew your session'
        });
      }

      const cachedKeys = {
        xrpPrivateKey: xrpPrivateKey,
        handle: user.handle,
        walletAddress: user.walletAddress
      };
      
      // Use the existing XRPL swap functionality to sell token to XRP
      const swapModule = await import('./xrpl/xrpl-swap-cached');
      const swapResult = await swapModule.executeXrplSwapWithCachedKeys(
        cachedKeys,   // cachedKeys (FIRST parameter!)
        currency,     // fromToken
        'XRP',        // toToken  
        amount,       // amount
        issuer,       // fromIssuer
        '',           // toIssuer (empty for XRP)
        user.handle,  // userHandle
        user.walletAddress, // walletAddress
        slippage      // slippage
      );
      
      if (swapResult && swapResult.success) {
        console.log(`✅ [SELL TOKEN] Successfully sold ${currency} to XRP: ${swapResult.txHash}`);
        
        res.json({
          success: true,
          txHash: swapResult.txHash,
          currency: currency,
          issuer: issuer,
          amountSold: amount,
          message: `Successfully sold ${amount} ${currency} to XRP`
        });
      } else {
        const errorMsg = (swapResult && swapResult.error) || 'Failed to sell token to XRP';
        console.error(`❌ [SELL TOKEN] Failed to sell ${currency}:`, errorMsg);
        
        res.status(400).json({
          success: false,
          error: errorMsg
        });
      }
      
    } catch (error) {
      console.error('❌ [SELL TOKEN] Error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error while selling token'
      });
    }
  });

  // SECURE: Burn individual token - authenticated users only
  app.post('/api/wallet/tokens/burn', sessionAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const { currency, issuer, amount } = req.body;

      if (!user?.handle) {
        return res.status(400).json({
          success: false,
          error: 'User handle not found in session'
        });
      }

      if (!currency || !issuer || !amount) {
        return res.status(400).json({
          success: false,
          error: 'Currency, issuer, and amount are required'
        });
      }

      console.log(`🔥 [BURN TOKEN] Burning ${amount} ${currency} from ${user.handle}`);

      // Use the existing XRPL wallet operations burn functionality
      const walletOpsModule = await import('./xrpl-wallet-operations');
      const burnResult = await fetch('http://localhost:5000/api/xrpl-wallet-operations/burn/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': req.headers.authorization || ''
        },
        body: JSON.stringify({
          issuer,
          currency,
          amount
        })
      });

      const burnData = await burnResult.json() as any;

      if (burnResult.ok && burnData.success) {
        console.log(`✅ [BURN TOKEN] Successfully burned ${currency}: ${burnData.hash}`);

        res.json({
          success: true,
          txHash: burnData.hash,
          currency: currency,
          issuer: issuer,
          amountBurned: amount,
          message: `Successfully burned ${amount} ${currency}`
        });
      } else {
        const errorMsg = burnData.error || 'Failed to burn token';
        console.error(`❌ [BURN TOKEN] Failed to burn ${currency}:`, errorMsg);

        res.status(400).json({
          success: false,
          error: errorMsg
        });
      }

    } catch (error) {
      console.error('❌ [BURN TOKEN] Error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error while burning token'
      });
    }
  });

  // SECURE: Get total portfolio value - tokens + NFTs - authenticated users only
  app.get('/api/wallet/portfolio/total/:address', sessionAuth, async (req, res) => {
    try {
      const { address } = req.params;
      const user = req.user as any;
      
      // SECURITY: Only allow access to authenticated user's own wallet
      if (address !== user?.walletAddress) {
        return res.status(403).json({
          success: false,
          error: 'Access denied - can only view your own portfolio data'
        });
      }
      
      console.log(`💰 [PORTFOLIO] Calculating total portfolio value for ${address}`);
      
      let tokenValue = 0;
      let nftValue = 0;
      let tokenDetails: any[] = [];
      let nftDetails: any[] = [];
      let xrpPrice = 0; // Declare at function scope for use in NFT calculations
      
      // === 1. FETCH TOKEN BALANCES AND VALUES ===
      try {
        const tokensResponse = await fetch(`http://localhost:5000/api/wallet/tokens/${address}`, {
          headers: { 'Authorization': req.headers.authorization || '' }
        });
        
        if (tokensResponse.ok) {
          const tokensData = await tokensResponse.json() as any;
          const tokens = tokensData.tokens || [];
          
          // Get live XRP price using the price service
          try {
            console.log('💰 [PORTFOLIO] Fetching live XRP price using price service...');
            const { getTokenPrice } = await import('./price-service.js');
            const xrpTokenPrice = await getTokenPrice('XRP');
            
            if (xrpTokenPrice && xrpTokenPrice.price_usd > 0) {
              xrpPrice = xrpTokenPrice.price_usd;
              console.log(`💲 [PORTFOLIO] XRP price from price service: $${xrpPrice}`);
            } else {
              console.log('⚠️ [PORTFOLIO] Price service returned no XRP price');
            }
          } catch (e) {
            console.log('⚠️ [PORTFOLIO] Price service failed:', e);
          }
          
          // No hardcoded fallback - if price unavailable, leave at 0
          if (xrpPrice === 0) {
            console.log('🔄 [PORTFOLIO] XRP price unavailable, portfolio value may be incomplete');
          }
          
          for (const token of tokens) {
            const balance = parseFloat(token.balance || '0');
            let price = parseFloat(token.price_usd || '0');
            
            // Use live XRP price for XRP
            if (token.currency === 'XRP' && xrpPrice > 0) {
              price = xrpPrice;
            }
            
            const value = balance * price;
            tokenValue += value;
            
            if (balance > 0) {
              tokenDetails.push({
                currency: token.currency,
                name: token.name || token.currency,
                balance: balance,
                price_usd: price,
                value_usd: value
              });
            }
          }
        }
      } catch (tokenError) {
        console.log('⚠️ Error fetching token data:', tokenError);
      }
      
      // === 2. FETCH NFT COLLECTIONS AND VALUES ===
      try {
        const nftsResponse = await fetch(`http://localhost:5000/api/wallet/nfts/${address}`, {
          headers: { 'Authorization': req.headers.authorization || '' }
        });
        
        if (nftsResponse.ok) {
          const nftsData = await nftsResponse.json() as any;
          const nfts = nftsData.nfts || [];
          
          // Group NFTs by collection
          const collections: { [key: string]: any[] } = {};
          for (const nft of nfts) {
            const collection = nft.collection || 'Unknown Collection';
            if (!collections[collection]) {
              collections[collection] = [];
            }
            collections[collection].push(nft);
          }
          
          // Calculate collection values using Bithomp collection API
          for (const [collectionName, collectionNfts] of Object.entries(collections)) {
            const count = collectionNfts.length;
            let floorPrice = parseFloat(collectionNfts[0]?.floor_price || '0');
            
            // Get real floor price from Bithomp collection endpoint
            console.log(`🔍 [NFT DEBUG] Initial floor price: ${floorPrice}, has issuer: ${!!collectionNfts[0]?.issuer}`);
            if (collectionNfts[0]?.issuer) {
              const issuer = collectionNfts[0].issuer;
              const taxon = collectionNfts[0].taxon || 0;
              const collectionId = `${issuer}:${taxon}`;
              
              console.log(`🔍 [NFT FLOOR] Getting collection floor price for ${collectionName} (${collectionId})`);
              
              try {
                // Use the proper collection endpoint with floor price data
                const apiUrl = `https://bithomp.com/api/v2/nft-collection/${collectionId}?floorPrice=true&statistics=true`;
                console.log(`🌐 [NFT API] Calling: ${apiUrl}`);
                
                const collectionResponse = await fetch(apiUrl, {
                  headers: {
                    'x-bithomp-token': process.env.BITHOMP_API_KEY || '',
                    'Accept': 'application/json'
                  }
                });
                
                console.log(`📡 [NFT API] Response status: ${collectionResponse.status}`);
                
                if (collectionResponse.ok) {
                  const collectionData = await collectionResponse.json() as any;
                  console.log(`📦 [NFT API] Response data:`, JSON.stringify(collectionData, null, 2).slice(0, 500));
                  
                  const floorPrices = collectionData.collection?.floorPrices || [];
                  console.log(`💰 [NFT FLOOR] Found ${floorPrices.length} floor prices`);
                  
                  if (floorPrices.length > 0) {
                    let minFloorPrice = Infinity;
                    
                    // Parse ALL floor prices from every available source
                    for (const priceData of floorPrices) {
                      console.log(`🔍 [NFT FLOOR] Processing price data:`, JSON.stringify(priceData, null, 2));
                      
                      // Check open market prices - handle all formats
                      if (priceData.open?.amount) {
                        let price = 0;
                        if (typeof priceData.open.amount === 'string') {
                          const amountValue = parseInt(priceData.open.amount);
                          if (amountValue > 0) {
                            // Price in drops (1 XRP = 1,000,000 drops)
                            price = amountValue / 1000000;
                            console.log(`📈 [NFT FLOOR] Open market: ${priceData.open.amount} drops = ${price} XRP`);
                          }
                        } else if (typeof priceData.open.amount === 'object' && priceData.open.amount.currency && priceData.open.amount.value) {
                          // Handle token-denominated prices
                          const tokenValue = parseFloat(priceData.open.amount.value);
                          const currency = priceData.open.amount.currency;
                          console.log(`🪙 [NFT FLOOR] Open market token price: ${tokenValue} ${currency.slice(0, 8)}...`);
                          
                          // Try to get XRP equivalent for known tokens
                          if (currency === 'XRP' || currency.length === 40) {
                            // Treat as XRP equivalent for calculation
                            price = tokenValue;
                            console.log(`💱 [NFT FLOOR] Treating token as XRP equivalent: ${price} XRP`);
                          }
                        }
                        if (price > 0 && price < minFloorPrice) {
                          minFloorPrice = price;
                        }
                      }
                      
                      // Check private market prices - handle all formats
                      if (priceData.private?.amount) {
                        let price = 0;
                        if (typeof priceData.private.amount === 'string') {
                          const amountValue = parseInt(priceData.private.amount);
                          if (amountValue > 0) {
                            // Price in drops
                            price = amountValue / 1000000;
                            console.log(`🔒 [NFT FLOOR] Private market: ${priceData.private.amount} drops = ${price} XRP`);
                          }
                        } else if (typeof priceData.private.amount === 'object' && priceData.private.amount.currency && priceData.private.amount.value) {
                          // Handle token-denominated private prices
                          const tokenValue = parseFloat(priceData.private.amount.value);
                          const currency = priceData.private.amount.currency;
                          console.log(`🪙 [NFT FLOOR] Private market token price: ${tokenValue} ${currency.slice(0, 8)}...`);
                          
                          if (currency === 'XRP' || currency.length === 40) {
                            price = tokenValue;
                            console.log(`💱 [NFT FLOOR] Treating private token as XRP equivalent: ${price} XRP`);
                          }
                        }
                        if (price > 0 && price < minFloorPrice) {
                          minFloorPrice = price;
                        }
                      }
                    }
                    
                    // Try alternative sources for more comprehensive floor price data
                    if (minFloorPrice === Infinity) {
                      console.log(`🔍 [NFT FLOOR] Bithomp API shows no floor prices, trying additional sources...`);
                      
                      // Method 1: Check recent sales for pricing trends
                      try {
                        const salesResponse = await fetch(`https://bithomp.com/api/v2/nft-sales?issuer=${issuer}&taxon=${taxon}&limit=20`, {
                          headers: {
                            'x-bithomp-token': process.env.BITHOMP_API_KEY || '',
                            'Accept': 'application/json'
                          }
                        });
                        
                        if (salesResponse.ok) {
                          const salesData = await salesResponse.json() as any;
                          const sales = salesData.sales || [];
                          
                          if (sales.length > 0) {
                            const recentPrices = sales.slice(0, 10)
                              .map((sale: any) => parseFloat(sale.price || '0'))
                              .filter((p: number) => p > 0);
                            
                            if (recentPrices.length > 0) {
                              // Use minimum of recent sales as conservative floor
                              minFloorPrice = Math.min(...recentPrices);
                              console.log(`✅ [NFT FLOOR] Found floor from ${recentPrices.length} recent sales: ${minFloorPrice} XRP`);
                            }
                          }
                        }
                      } catch (salesError) {
                        console.log(`⚠️ Could not fetch sales data for floor price discovery`);
                      }
                      
                      // Mark as not available if no real API data found
                      if (minFloorPrice === Infinity) {
                        console.log(`⚠️ [NFT FLOOR] No real floor price data available from APIs`);
                        minFloorPrice = 0; // Set to 0 to indicate not available
                      }
                      
                      // Method 3: Check for active listings/offers
                      if (minFloorPrice === Infinity) {
                        console.log(`🔍 [NFT FLOOR] Checking active NFT offers...`);
                        try {
                          const offersResponse = await fetch(`https://bithomp.com/api/v2/nft-offers?issuer=${issuer}&taxon=${taxon}&limit=20`, {
                            headers: {
                              'x-bithomp-token': process.env.BITHOMP_API_KEY || '',
                              'Accept': 'application/json'
                            }
                          });
                          
                          if (offersResponse.ok) {
                            const offersData = await offersResponse.json() as any;
                            const offers = offersData.nftOffers || [];
                            
                            if (offers.length > 0) {
                              const offerPrices = offers
                                .map((offer: any) => parseFloat(offer.amount || '0'))
                                .filter((p: number) => p > 0);
                              
                              if (offerPrices.length > 0) {
                                minFloorPrice = Math.min(...offerPrices);
                                console.log(`✅ [NFT FLOOR] Found floor from active offers: ${minFloorPrice} XRP`);
                              }
                            }
                          }
                        } catch (offersError) {
                          console.log(`⚠️ Could not fetch offers data for floor price discovery`);
                        }
                      }
                    }
                    
                    if (minFloorPrice !== Infinity) {
                      floorPrice = minFloorPrice;
                      console.log(`✅ [NFT FLOOR] Found real collection floor price: ${floorPrice} XRP`);
                    } else {
                      console.log(`⚠️ [NFT FLOOR] No valid XRP floor prices found`);
                    }
                  } else {
                    console.log(`⚠️ [NFT FLOOR] No floor prices in response`);
                  }
                  
                  // Log collection statistics if available
                  const stats = collectionData.collection?.statistics;
                  if (stats) {
                    console.log(`📊 [NFT STATS] ${collectionName}: ${stats.nfts} NFTs, ${stats.owners} owners`);
                  }
                } else {
                  const errorText = await collectionResponse.text();
                  console.log(`❌ [NFT API] Error response: ${collectionResponse.status} - ${errorText}`);
                }
              } catch (e) {
                console.log(`⚠️ Could not fetch collection data for ${collectionName}:`, e);
              }
              
              // Only use real marketplace data - no fallbacks
              console.log(`🔍 [NFT DEBUG] Final floor price (real data only): ${floorPrice}`);
              if (floorPrice === 0) {
                console.log(`⚠️ [NFT FLOOR] No real marketplace floor price found for ${collectionName} - marking as not available`);
              }
            }
            
            // Calculate collection value and mark data availability
            const collectionValueXrp = floorPrice * count;
            const collectionValueUsd = collectionValueXrp * xrpPrice; // Convert to USD
            let floorStatus = 'not_available';
            
            if (floorPrice > 0) {
              nftValue += collectionValueUsd; // Add USD value to total
              console.log(`💰 [NFT VALUE] ${collectionName}: ${count} × ${floorPrice} XRP (${(floorPrice * xrpPrice).toFixed(2)} USD) = ${collectionValueUsd.toFixed(2)} USD`);
              floorStatus = 'available';
            } else {
              console.log(`⚠️ [NFT VALUE] ${collectionName}: ${count} NFTs - floor price not available from APIs`);
              floorStatus = 'not_available';
            }
            
            nftDetails.push({
              collection: collectionName,
              count: count,
              floor_price: floorPrice,
              floor_status: floorStatus,
              total_value: collectionValueUsd, // Use USD value
              sample_nft: {
                name: collectionNfts[0]?.name || 'Unknown',
                issuer: collectionNfts[0]?.issuer
              }
            });
          }
        }
      } catch (nftError) {
        console.log('⚠️ Error fetching NFT data:', nftError);
      }
      
      const totalPortfolioValue = tokenValue + nftValue;
      
      console.log(`💰 [PORTFOLIO] Token Value: $${tokenValue.toFixed(2)}, NFT Value: $${nftValue.toFixed(2)}, Total: $${totalPortfolioValue.toFixed(2)}`);
      
      res.json({
        success: true,
        portfolio: {
          total_value_usd: totalPortfolioValue,
          tokens: {
            total_value_usd: tokenValue,
            count: tokenDetails.length,
            details: tokenDetails
          },
          nfts: {
            total_value_usd: nftValue,
            total_count: nftDetails.reduce((sum, collection) => sum + collection.count, 0),
            collections_count: nftDetails.length,
            details: nftDetails
          }
        },
        timestamp: new Date().toISOString(),
        wallet_address: address
      });
      
    } catch (error) {
      console.error('❌ [PORTFOLIO] Error calculating portfolio:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to calculate portfolio value'
      });
    }
  });

  console.log('✅ Wallet profile routes registered successfully');
}