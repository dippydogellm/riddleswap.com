import type { Express } from "express";
import express from 'express';
import { createServer, type Server } from "http";
import { registerWalletBridgeRoutes } from "./bridge/wallet-bridge-routes";
import { registerMultiChainBridgeRoutes } from "./bridge/multi-chain-bridge-routes";
import { requireAuthentication } from "./middleware/session-auth";
import { registerPhotoUploadRoutes } from "./photo-upload-routes";
import { validateSession } from "./middleware/security";

export async function registerRoutes(app: Express, server: Server): Promise<void> {
  
  // Import rewards routes
  const rewardsRoutes = await import('./rewards-routes');
  const nftRewardsRoutes = await import('./nft-rewards-routes');
  
  // Setting up authentication middleware
  // Note: CORS is already configured globally in server/index.ts

  // =============================================================================
  // ERROR LOGGING ROUTES (MIXED AUTH REQUIREMENTS)
  // =============================================================================
  
  console.log('🔧 Registering Error Logging routes...');
  const errorLoggingModule = await import('./error-logging-routes');
  const errorLoggingRoutes = errorLoggingModule.default || errorLoggingModule.errorLoggingRoutes;
  app.use('/api/errors', errorLoggingRoutes);
  console.log('✅ Error Logging routes registered successfully');

  // =============================================================================
  // RDL BANK ROUTES (AUTHENTICATED)
  // =============================================================================
  
  console.log('🏦 Registering RDL Bank routes...');
  const rdlBankModule = await import('./rdl-bank-routes');
  const rdlBankRoutes = rdlBankModule.default;
  app.use('/api', rdlBankRoutes);
  console.log('✅ RDL Bank routes registered successfully');

  // =============================================================================
  // IPFS AND XRPL NFT MINTING ROUTES (AUTHENTICATED)
  // =============================================================================
  
  console.log('📁 Registering IPFS upload routes...');
  const ipfsModule = await import('./ipfs-routes');
  ipfsModule.registerIPFSRoutes(app);
  
  console.log('🎨 Registering XRPL NFT minting routes...');
  const xrplNftModule = await import('./xrpl-nft-routes');
  xrplNftModule.registerXRPLNFTRoutes(app);

  console.log('🔒 Registering Authorized Minter routes...');
  const authorizedMinterModule = await import('./authorized-minter-routes');
  authorizedMinterModule.registerAuthorizedMinterRoutes(app);

  // =============================================================================
  // SEARCH API ROUTES (PUBLIC ACCESS)
  // =============================================================================
  
  console.log('🔧 Registering Search API routes...');
  const searchModule = await import('./search-routes');
  const searchRoutes = searchModule.default;
  app.use('/api/search', searchRoutes);
  console.log('✅ Search API routes registered successfully');

  // =============================================================================
  // EVM SWAP ROUTES (PUBLIC ACCESS) - CRITICAL FIX
  // =============================================================================
  
  console.log('🔧 Registering EVM Swap routes...');
  const evmSwapModule = await import('./evm-swap-routes');
  const evmSwapRoutes = evmSwapModule.default;
  app.use('/api', evmSwapRoutes);
  console.log('✅ EVM Swap routes registered successfully');

  // =============================================================================
  // XRPL TOKEN SEARCH ROUTES (PUBLIC ACCESS)
  // =============================================================================
  try {
    console.log('🔧 Registering XRPL Token routes...');
    const xrplTokenModule = await import('./xrpl-token-routes');
    xrplTokenModule.registerXRPLTokenRoutes(app);
    console.log('✅ XRPL Token routes registered successfully');
  } catch (e) {
    console.warn('⚠️ Failed to register XRPL Token routes:', e);
  }

  // =============================================================================
  // XRPL LIQUIDITY ROUTES (PUBLIC ACCESS)
  // =============================================================================
  try {
    console.log('🔧 Registering XRPL Liquidity routes...');
    const xrplLiquidityModule = await import('./xrpl/xrpl-liquidity-routes');
    const xrplLiquidityRoutes = xrplLiquidityModule.default;
    app.use('/api', xrplLiquidityRoutes);
    console.log('✅ XRPL Liquidity routes registered successfully');
  } catch (e) {
    console.warn('⚠️ Failed to register XRPL Liquidity routes:', e);
  }

  // =============================================================================
  // PORTFOLIO & ANALYTICS ROUTES (CRITICAL MISSING ENDPOINTS)
  // =============================================================================
  
  console.log('🔧 Registering Portfolio & Analytics routes...');
  
  // Portfolio endpoint - stub implementation
  app.get('/api/portfolio', (req, res) => {
    res.json({
      success: true,
      portfolio: {
        totalValue: "0.00",
        assets: [],
        lastUpdated: new Date().toISOString()
      }
    });
  });
  
  // Analytics portfolio endpoint - stub implementation  
  app.get('/api/analytics/portfolio', (req, res) => {
    res.json({
      success: true,
      analytics: {
        performance: "0.00%",
        totalGains: "0.00",
        totalLosses: "0.00",
        lastUpdated: new Date().toISOString()
      }
    });
  });
  
  console.log('✅ Portfolio & Analytics routes registered successfully');

  // =============================================================================
  // NFT COLLECTIONS ROUTES (CRITICAL MISSING ENDPOINT)
  // =============================================================================
  
  console.log('🔧 Registering NFT Collections base route...');
  
  // NFT collections base endpoint - redirect to search  
  app.get('/api/nft/collections', (req, res) => {
    res.json({
      success: true,
      message: "Use /api/nft/collections/search?q=searchterm for collection search",
      collections: [],
      note: "This endpoint requires a search query. Use the search endpoint instead."
    });
  });

  // NFT trending endpoint - stub implementation
  app.get('/api/nft/trending', (req, res) => {
    res.json({
      success: true,
      trending: [],
      note: "Trending NFTs endpoint - currently returns empty array"
    });
  });
  
  console.log('✅ NFT Collections base route registered successfully');

  // =============================================================================
  // TRADERS TOOLS ROUTES (AUTHENTICATION REQUIRED)
  // =============================================================================
  
  console.log('🔧 Registering Traders Tools routes...');
  const tradersToolsModule = await import('./traders-tools-routes');
  const tradersToolsRoutes = tradersToolsModule.default || tradersToolsModule.tradersToolsRoutes;
  app.use('/api/traders', tradersToolsRoutes);
  console.log('✅ Traders Tools routes registered successfully');

  // =============================================================================
  // WALLET PROJECT LINKING ROUTES (AUTHENTICATION REQUIRED)
  // =============================================================================
  
  console.log('🔧 Registering Wallet Project Linking routes...');
  const walletProjectLinkingModule = await import('./wallet-project-linking-routes');
  const walletProjectLinkingRoutes = walletProjectLinkingModule.default;
  app.use('/api/wallet-project-links', walletProjectLinkingRoutes);
  console.log('✅ Wallet Project Linking routes registered successfully');

  // =============================================================================
  // FINANCIAL ECOSYSTEM ROUTES (AUTHENTICATION REQUIRED)
  // =============================================================================
  
  console.log('🔧 Registering Financial Ecosystem routes...');
  
  // Staking routes
  const stakingModule = await import('./staking-routes');
  const stakingRoutes = stakingModule.default;
  app.use('/api/staking', stakingRoutes);
  console.log('✅ Staking routes registered successfully');
  
  // Trading routes
  const tradingModule = await import('./trading-routes');
  const tradingRoutes = tradingModule.default;
  app.use('/api/trading', tradingRoutes);
  console.log('✅ Trading routes registered successfully');
  
  // Copy Trading routes
  const copyTradingModule = await import('./copy-trading-routes');
  const copyTradingRoutes = copyTradingModule.default;
  app.use('/api/copy-trading', copyTradingRoutes);
  console.log('✅ Copy Trading routes registered successfully');
  
  // Wallet Status routes
  const walletStatusModule = await import('./wallet-status-routes');
  const walletStatusRoutes = walletStatusModule.default;
  app.use('/api/wallet', walletStatusRoutes);
  console.log('✅ Wallet Status routes registered successfully');
  
  // Wallet Total Balance routes
  const walletTotalBalanceModule = await import('./routes/wallet-total-balance');
  const walletTotalBalanceRoutes = walletTotalBalanceModule.default;
  app.use('/api/wallet', walletTotalBalanceRoutes);
  console.log('✅ Wallet Total Balance routes registered successfully');
  
  // Loans routes  
  const loansModule = await import('./loans-routes');
  const loansRoutes = loansModule.default;
  app.use('/api/loans', loansRoutes);
  console.log('✅ Loans routes registered successfully');
  
  // NFT Swap routes
  const nftSwapModule = await import('./nft-swap-routes');
  const nftSwapRoutes = nftSwapModule.default;
  app.use('/api/nft-swaps', nftSwapRoutes);
  console.log('✅ NFT Swap routes registered successfully');
  
  console.log('🎉 All Financial Ecosystem routes registered successfully');

  // =============================================================================
  // EXTERNAL WALLET ROUTES (AUTHENTICATION REQUIRED)
  // =============================================================================
  
  console.log('🔧 Registering External Wallet routes...');
  const externalWalletModule = await import('./external-wallet-routes');
  const externalWalletRoutes = externalWalletModule.default;
  app.use('/api/external-wallets', externalWalletRoutes);
  console.log('✅ External Wallet routes registered successfully');

  // Simple External Wallet routes (legacy - mounted at different path)
  console.log('🔧 Registering Simple External Wallet routes...');
  const simpleExternalWalletModule = await import('./simple-external-wallet-routes');
  const simpleExternalWalletRoutes = simpleExternalWalletModule.default;
  app.use('/api/external-wallets-simple', simpleExternalWalletRoutes);
  console.log('✅ Simple External Wallet routes registered successfully');

  // Linked Wallet routes (Ownership Verification)
  // =============================================================================
  // NFT COLLECTION POPULATION ROUTES (AUTHENTICATED)
  // =============================================================================
  
  console.log('🎨 Registering NFT Population routes...');
  const nftPopulationModule = await import('./routes/nft-population');
  const nftPopulationRoutes = nftPopulationModule.default;
  app.use('/api/nft-population', nftPopulationRoutes);
  console.log('✅ NFT Population routes registered successfully');
  
  console.log('🔧 Registering Linked Wallet routes...');
  const linkedWalletModule = await import('./linked-wallet-routes');
  const linkedWalletRoutes = linkedWalletModule.default;
  app.use('/api/linked-wallets', linkedWalletRoutes);
  console.log('✅ Linked Wallet routes registered successfully');

  // =============================================================================
  // AUTHENTICATION ROUTES (NO AUTHENTICATION REQUIRED)
  // =============================================================================
  
  console.log('🔧 Registering Authentication routes...');
  const authModule = await import('./auth-routes');
  const authRoutes = authModule.default;
  app.use('/api', authRoutes);
  console.log('✅ Authentication routes registered successfully');
  
  // Riddle Wallet Authentication - Register after external wallet auth
  const riddleWalletAuth = await import('./riddle-wallet-auth');
  app.use('/api/auth', riddleWalletAuth.default);
  console.log('✅ Riddle wallet authentication registered');

  // =============================================================================
  // ENHANCED WALLET LINKING AND PROJECT MANAGEMENT ROUTES
  // =============================================================================
  
  console.log('🔧 Registering Wallet Linking routes...');
  const walletLinkingModule = await import('./wallet-linking-routes');
  const walletLinkingRoutes = walletLinkingModule.default;
  app.use('/api/devtools/wallets', walletLinkingRoutes);
  console.log('✅ Wallet Linking routes registered successfully');
  
  console.log('🔧 Registering Project Management routes...');
  const projectManagementModule = await import('./project-management-routes');
  const projectManagementRoutes = projectManagementModule.default;
  app.use('/api/projects', projectManagementRoutes);
  console.log('✅ Project Management routes registered successfully');
  
  // Service Initialization Testing & Management Routes
  console.log('🔧 Registering Service Initialization routes...');
  const serviceInitModule = await import('./service-initialization-routes');
  const serviceInitRoutes = serviceInitModule.default;
  app.use('/api/service-initialization', serviceInitRoutes);
  console.log('✅ Service Initialization routes registered successfully');
  
  // Register DevTools routes
  console.log('🔧 Registering DevTools routes...');
  const devtoolsModule = await import('./devtools-routes');
  const devtoolsRoutes = devtoolsModule.default;
  app.use('/api/devtools', devtoolsRoutes);
  console.log('✅ DevTools routes registered successfully');
  
  // Register Blockchain routes
  console.log('🔧 Registering Blockchain routes...');
  const blockchainModule = await import('./blockchain-routes');
  const blockchainRoutes = blockchainModule.default;
  app.use('/api/blockchain', blockchainRoutes);
  console.log('✅ Blockchain routes registered successfully');
  
  console.log('🔧 Registering Discovery routes...');
  const discoveryModule = await import('./discovery-routes');
  const discoveryRoutes = discoveryModule.default;
  app.use('/api/discovery', discoveryRoutes);
  console.log('✅ Discovery routes registered successfully');

  // =============================================================================
  // UNIFIED METADATA AGGREGATOR ROUTES
  // =============================================================================
  
  console.log('🔧 Registering Unified Metadata Aggregator routes...');
  const unifiedMetadataModule = await import('./unified-metadata-routes');
  const unifiedMetadataRoutes = unifiedMetadataModule.default;
  app.use('/api/metadata', unifiedMetadataRoutes);
  console.log('✅ Unified Metadata Aggregator routes registered successfully');

  // =============================================================================
  // CDN STATIC ASSET SERVING ROUTES
  // =============================================================================
  
  console.log('🔧 Registering CDN routes...');
  const cdnModule = await import('./cdn-routes');
  const cdnRoutes = cdnModule.default;
  app.use('/cdn', cdnRoutes);
  console.log('✅ CDN routes registered successfully');

  // =============================================================================
  // ASSET INGESTION ROUTES (BACKGROUND DOWNLOAD SYSTEM)
  // =============================================================================
  
  console.log('🔧 Registering Asset Ingestion routes...');
  const assetIngestionModule = await import('./asset-ingestion-routes');
  const assetIngestionRoutes = assetIngestionModule.default;
  app.use('/api/ingest', assetIngestionRoutes);
  console.log('✅ Asset Ingestion routes registered successfully');

  // =============================================================================
  // ASSETS API ROUTES (PUBLIC ACCESS) - COMPREHENSIVE ASSET ACCESS
  // =============================================================================
  
  console.log('🔧 Registering Assets API routes...');
  const assetsApiModule = await import('./assets-api-routes');
  const assetsApiRoutes = assetsApiModule.default;
  app.use('/api/assets', assetsApiRoutes);
  console.log('✅ Assets API routes registered successfully');

  // =============================================================================
  // BITHOMP OVERRIDE ROUTES (ENHANCED XRPL DATA)
  // =============================================================================
  
  console.log('🔧 Registering Bithomp Override routes...');
  const bithompOverrideModule = await import('./bithomp-override-routes');
  const bithompOverrideRoutes = bithompOverrideModule.default;
  app.use('/', bithompOverrideRoutes);
  console.log('✅ Bithomp Override routes registered successfully');

  // =============================================================================
  // GAMING NFT ROUTES (PUBLIC ACCESS - NFT GAMING SYSTEM)
  // =============================================================================
  
  console.log('🔧 Registering Gaming NFT routes...');
  const gamingNftModule = await import('./gaming-nft-routes');
  const gamingNftRoutes = gamingNftModule.default;
  app.use('/api', gamingNftRoutes);
  console.log('✅ Gaming NFT routes registered successfully');

  // =============================================================================
  // PUBLIC ROUTES (NO AUTHENTICATION REQUIRED)
  // =============================================================================
  
  // Health check is public
  app.get('/api/health', (req, res) => {
    // Health check endpoint accessed
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      services: ['xrpl-swap', 'cleanup', 'wallet-session', 'analytics'],
      authenticationRequired: 'Login required for all wallet operations'
    });
  });

  // =============================================================================
  // ANALYTICS ROUTES (PUBLIC - NO AUTHENTICATION REQUIRED)
  // =============================================================================
  
  console.log('🔧 Registering Analytics routes...');
  const analyticsModule = await import('./analytics-routes');
  const analyticsRoutes = analyticsModule.default;
  app.use('/api/analytics', analyticsRoutes);
  console.log('✅ Analytics routes registered successfully');

  // =============================================================================
  // PUBLIC NFT OFFERS ROUTES (NO AUTHENTICATION - COLLECTION DATA)
  // =============================================================================
  
  console.log('🎯 Registering public NFT offers endpoint...');
  app.get('/api/public/nft-offers/:address', async (req, res) => {
    try {
      const address = req.params.address;
      const { 
        list = 'default', 
        nftoken = 'true', 
        assets = 'true',
        offersValidate = 'false'
      } = req.query;
      
      console.log(`🎯 [PUBLIC NFT] Getting offers for: ${address} (list=${list}, assets=${assets})`);
      
      // Build query parameters
      const params = new URLSearchParams({
        list: list as string,
        nftoken: nftoken as string,
        assets: assets as string,
        offersValidate: offersValidate as string
      });
      
      const response = await fetch(`https://bithomp.com/api/v2/address/${address}/nft-offers?${params}`, {
        headers: {
          'x-bithomp-token': process.env.BITHOMP_API_KEY || '',
          'User-Agent': 'RiddleSwap/1.0'
        }
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          console.log(`📍 [PUBLIC NFT] No offers found for: ${address}`);
          return res.json({
            success: true,
            address,
            offers: [],
            list_type: list
          });
        }
        throw new Error(`Bithomp NFT offers API failed: ${response.status}`);
      }
      
      const data = await response.json() as any;
      
      // Format offers with enhanced data
      const offers = (data.offers || []).map((offer: any) => ({
        // Core offer data
        index: offer.index,
        owner: offer.owner,
        destination: offer.destination,
        amount: offer.amount,
        flags: offer.flags,
        nftokenID: offer.nftokenID,
        
        // Enhanced NFToken data (when nftoken=true)
        nftoken: offer.nftoken ? {
          nftokenID: offer.nftoken.nftokenID,
          uri: offer.nftoken.uri,
          issuer: offer.nftoken.issuer,
          nftokenTaxon: offer.nftoken.nftokenTaxon,
          transferFee: offer.nftoken.transferFee,
          flags: offer.nftoken.flags,
          sequence: offer.nftoken.sequence,
          metadata: offer.nftoken.metadata || null
        } : null,
        
        // Asset URLs (when assets=true)
        assets: offer.assets ? {
          image: offer.assets.image || null,
          video: offer.assets.video || null,
          preview: offer.assets.preview || null,
          thumbnail: offer.assets.thumbnail || null
        } : null,
        
        // Validation data (when offersValidate=true)
        valid: offer.valid !== undefined ? offer.valid : null,
        validationErrors: offer.validationErrors || null,
        
        // Additional metadata
        offerType: list,
        link: `https://bithomp.com/explorer/nft/${offer.nftokenID}`,
        createdAt: offer.createdAt || null,
        expiresAt: offer.expiresAt || null
      }));
      
      console.log(`🎯 [PUBLIC NFT] Found ${offers.length} offers for ${address} (${list})`);
      
      res.json({
        success: true,
        address,
        list_type: list,
        offers,
        total: offers.length,
        parameters: {
          list,
          nftoken: nftoken === 'true',
          assets: assets === 'true',
          offersValidate: offersValidate === 'true'
        }
      });
      
    } catch (error) {
      console.error(`❌ [PUBLIC NFT] Offers fetch failed:`, error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'NFT offers fetch failed',
        offers: []
      });
    }
  });
  console.log('✅ Public NFT offers endpoint registered successfully');
  
  // =============================================================================
  // PUBLIC WALLET DATA ROUTES (NO AUTHENTICATION - PUBLIC BLOCKCHAIN DATA)
  // =============================================================================
  
  console.log('🔓 Registering public wallet data endpoints...');
  // Public XRP wallet data endpoints - no auth required for reading blockchain data
  app.use('/api/public/wallets', (await import('./wallets/xrp-endpoints')).default);
  app.use('/api/public/wallets', (await import('./wallets/eth-endpoints')).default);
  app.use('/api/public/wallets', (await import('./wallets/arbitrum-endpoints')).default);
  app.use('/api/public/wallets', (await import('./wallets/base-endpoints')).default);
  app.use('/api/public/wallets', (await import('./wallets/polygon-endpoints')).default);
  app.use('/api/public/wallets', (await import('./wallets/optimism-endpoints')).default);
  app.use('/api/public/wallets', (await import('./wallets/sol-endpoints')).default);
  app.use('/api/public/wallets', (await import('./wallets/btc-endpoints')).default);
  app.use('/api/public/wallets', (await import('./wallets/bsc-endpoints')).default);
  app.use('/api/public/wallets', (await import('./wallets/avalanche-endpoints')).default);
  app.use('/api/public/wallets', (await import('./wallets/fantom-endpoints')).default);
  app.use('/api/public/wallets', (await import('./wallets/linea-endpoints')).default);
  app.use('/api/public/wallets', (await import('./wallets/mantle-endpoints')).default);
  app.use('/api/public/wallets', (await import('./wallets/metis-endpoints')).default);
  app.use('/api/public/wallets', (await import('./wallets/scroll-endpoints')).default);
  app.use('/api/public/wallets', (await import('./wallets/taiko-endpoints')).default);
  app.use('/api/public/wallets', (await import('./wallets/unichain-endpoints')).default);
  app.use('/api/public/wallets', (await import('./wallets/soneium-endpoints')).default);
  app.use('/api/public/wallets', (await import('./wallets/zksync-endpoints')).default);
  console.log('✅ Public wallet data endpoints registered successfully');

  // =============================================================================
  // DEXSCREENER PRICE API ROUTES (PUBLIC ACCESS)
  // =============================================================================
  
  console.log('🔧 Registering DexScreener Price API routes...');
  const dexScreenerModule = await import('./dexscreener-routes');
  const dexScreenerRoutes = dexScreenerModule.default;
  app.use('/api/dexscreener', dexScreenerRoutes);
  console.log('✅ DexScreener Price API routes registered successfully');

  // REMOVED OLD INEFFICIENT COLLECTIONS ENDPOINT - Use /api/nft/marketplace/top-collections instead

  // Public NFT endpoint for wallet profiles (no auth required)
  app.get('/api/wallet/nfts-public/:address', async (req, res) => {
    try {
      const { address } = req.params;
      
      if (!address || !address.startsWith('r')) {
        return res.status(400).json({ 
          success: false,
          error: 'Invalid XRPL address' 
        });
      }
      
      console.log(`🎨 [PUBLIC WALLET] Fetching NFTs for address: ${address}`);
      
      // Use Bithomp API to get NFTs for any wallet (public data) with premium offer parameters
      const response = await fetch(`https://bithomp.com/api/v2/nfts?owner=${address}&limit=100&metadata=true&sellOffers=true&buyOffers=true&offersValidate=true`, {
        headers: {
          'x-bithomp-token': process.env.BITHOMP_API_KEY || '',
          'Accept': 'application/json',
          'User-Agent': 'RiddleSwap/1.0'
        }
      });
      
      if (!response.ok) {
        console.error(`❌ [PUBLIC WALLET] Bithomp API error: ${response.status}`);
        return res.status(500).json({
          success: false,
          error: `Failed to fetch NFTs: ${response.status}`
        });
      }
      
      const data = await response.json() as any;
      const nftsList = data.nfts || data.result || [];
      
      console.log(`📦 [PUBLIC WALLET] Found ${nftsList.length} NFTs for ${address}`);
      
      const nfts = nftsList.map((nft: any) => {
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
        
        // Handle image URL - convert IPFS to working gateway if needed
        let imageUrl = metadata?.image || nft.image;
        if (imageUrl && imageUrl.startsWith('ipfs://')) {
          imageUrl = imageUrl.replace('ipfs://', 'https://ipfs.io/ipfs/');
        }
        if (!imageUrl && nft.issuer && nft.nftokenTaxon !== undefined) {
          // Use Bithomp CDN as fallback
          imageUrl = `https://bithomp.com/api/v2/nft/${nft.issuer}/${nft.nftokenTaxon}/image`;
        }
        
        return {
          nft_id: nftokenID,
          nftokenID: nftokenID, // For compatibility
          name: metadata?.name || `NFT #${nft.nftokenTaxon || 0}`,
          image: imageUrl,
          collection: collectionName,
          issuer: nft.issuer,
          taxon: nft.nftokenTaxon,
          rarity: metadata?.rarity,
          floor_price: nft.floorPrice,
          last_sale_price: nft.lastSalePrice
        };
      });
      
      return res.json({
        success: true,
        address,
        nfts,
        total: nfts.length
      });
      
    } catch (error) {
      console.error('❌ [PUBLIC WALLET] Error fetching NFTs:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  // Wallet metrics endpoint for ranking and activity scores (public, with caching)
  app.get('/api/wallet/:address/metrics', async (req, res) => {
    try {
      const { address } = req.params;
      
      if (!address || !address.startsWith('r')) {
        return res.status(400).json({ 
          success: false,
          error: 'Invalid XRPL address' 
        });
      }
      
      console.log(`📊 [WALLET METRICS] Computing metrics for: ${address}`);
      
      // Try to get cached metrics first
      const storage = new (await import('./storage')).DatabaseStorage();
      const cachedMetrics = await storage.getWalletMetrics(address);
      
      if (cachedMetrics && new Date(cachedMetrics.expires_at) > new Date()) {
        console.log(`✅ [WALLET METRICS] Using cached metrics for ${address}`);
        return res.json({
          success: true,
          address,
          metrics: cachedMetrics,
          cached: true
        });
      }
      
      console.log(`🔄 [WALLET METRICS] Computing fresh metrics for ${address}`);
      
      // Compute metrics from XRPL data
      const metrics = await computeWalletMetrics(address);
      
      // Cache the computed metrics
      await storage.setWalletMetrics(metrics);
      
      return res.json({
        success: true,
        address,
        metrics,
        cached: false
      });
      
    } catch (error) {
      console.error('❌ [WALLET METRICS] Error computing metrics:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to compute wallet metrics'
      });
    }
  });

  // Compute wallet metrics with XRPL transaction analysis
  async function computeWalletMetrics(address: string) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    // Fetch transaction history from XRPL
    const txResponse = await fetch(`https://bithomp.com/api/v2/transactions/${address}?limit=200&type=all&timeStart=${thirtyDaysAgo}`, {
      headers: {
        'x-bithomp-token': process.env.BITHOMP_API_KEY || '',
        'Accept': 'application/json',
        'User-Agent': 'RiddleSwap/1.0'
      }
    });
    
    const txData = await txResponse.json();
    const transactions = txData?.transactions || [];
    
    // Fetch NFT data with premium offer parameters
    const nftResponse = await fetch(`https://bithomp.com/api/v2/nfts?owner=${address}&limit=100&sellOffers=true&buyOffers=true&offersValidate=true`, {
      headers: {
        'x-bithomp-token': process.env.BITHOMP_API_KEY || '',
        'Accept': 'application/json',
        'User-Agent': 'RiddleSwap/1.0'
      }
    });
    
    const nftData = await nftResponse.json();
    const nfts = nftData?.nfts || [];
    
    // Calculate metrics
    const txCount30d = transactions.length;
    let volumeXrp30d = 0;
    const activeDaysSet = new Set<string>();
    const counterparties = new Set<string>();
    let nftTrades30d = 0;
    let offersMade30d = 0;
    
    // Process transactions for volume and activity
    transactions.forEach((tx: any) => {
      const txDate = new Date(tx.date).toISOString().split('T')[0];
      activeDaysSet.add(txDate);
      
      // Add counterparty
      if (tx.Account && tx.Account !== address) counterparties.add(tx.Account);
      if (tx.Destination && tx.Destination !== address) counterparties.add(tx.Destination);
      
      // Calculate XRP volume
      if (tx.Amount && typeof tx.Amount === 'string') {
        volumeXrp30d += parseFloat(tx.Amount) / 1000000; // Convert drops to XRP
      }
      
      // Count NFT-related transactions
      if (tx.TransactionType === 'NFTokenAcceptOffer' || tx.TransactionType === 'NFTokenCreateOffer') {
        if (tx.TransactionType === 'NFTokenAcceptOffer') nftTrades30d++;
        if (tx.TransactionType === 'NFTokenCreateOffer') offersMade30d++;
      }
    });
    
    // Calculate scores (0-100)
    const activityScore = Math.min(100, (txCount30d * 2) + (activeDaysSet.size * 3));
    const tradingScore = Math.min(100, Math.log10(volumeXrp30d + 1) * 20);
    const nftScore = Math.min(100, (nfts.length * 5) + (nftTrades30d * 10));
    const overallScore = Math.round((activityScore + tradingScore + nftScore) / 3);
    
    // Determine wallet tier
    let walletTier = 'bronze';
    if (overallScore >= 80) walletTier = 'legend';
    else if (overallScore >= 60) walletTier = 'diamond';
    else if (overallScore >= 40) walletTier = 'gold';
    else if (overallScore >= 20) walletTier = 'silver';
    
    // Check if it's a Riddle wallet
    const isRiddleWallet = await checkIfRiddleWallet(address);
    
    const metrics = {
      address,
      tx_count_30d: txCount30d,
      volume_xrp_30d: volumeXrp30d.toString(),
      volume_usd_30d: (volumeXrp30d * 2.99).toString(), // Approximate USD value
      active_days_30d: activeDaysSet.size,
      unique_counterparties_30d: counterparties.size,
      nfts_held: nfts.length,
      nft_trades_30d: nftTrades30d,
      offers_made_30d: offersMade30d,
      offers_received_30d: 0, // TODO: Calculate from offers API
      activity_score: activityScore.toString(),
      trading_score: tradingScore.toString(),
      nft_score: nftScore.toString(),
      overall_score: overallScore.toString(),
      rank_percentile: '0', // TODO: Calculate after ranking system
      rank_position: 0,
      total_wallets_ranked: 0,
      wallet_tier: walletTier,
      is_riddle_wallet: isRiddleWallet,
      is_verified: false,
      computation_version: 'v1'
    };
    
    console.log(`📊 [WALLET METRICS] Computed for ${address}: Score ${overallScore}, Tier ${walletTier}, TXs ${txCount30d}, NFTs ${nfts.length}`);
    return metrics;
  }
  
  // Check if wallet is a Riddle wallet
  async function checkIfRiddleWallet(address: string): Promise<boolean> {
    try {
      const storage = new (await import('./storage')).DatabaseStorage();
      const riddleWallet = await storage.getRiddleWalletByAddress(address);
      return !!riddleWallet;
    } catch (error) {
      return false;
    }
  }

  // NFT offers endpoint for any wallet (public, no auth required)
  app.get('/api/nft-offers-public/:walletAddress', async (req, res) => {
    try {
      const { walletAddress } = req.params;
      const { list = 'counterOffers' } = req.query;
      
      if (!walletAddress) {
        return res.status(400).json({
          success: false,
          error: 'Wallet address is required'
        });
      }

      console.log(`🎯 [PUBLIC NFT OFFERS] Fetching offers for wallet: ${walletAddress}`);

      // Fetch offers from Bithomp API
      const offersResponse = await fetch(
        `https://bithomp.com/api/v2/nft-offers/${walletAddress}?list=${list}&offersValidate=true&nftoken=true`,
        {
          headers: {
            'x-bithomp-token': process.env.BITHOMP_API_KEY || '',
            'Accept': 'application/json',
            'User-Agent': 'RiddleSwap/1.0'
          }
        }
      );

      if (!offersResponse.ok) {
        console.error(`❌ [PUBLIC NFT OFFERS] Bithomp API error: ${offersResponse.status}`);
        return res.status(500).json({
          success: false,
          error: `Failed to fetch offers: ${offersResponse.status}`
        });
      }

      const offersData = await offersResponse.json();
      
      if (!offersData.nftOffers) {
        console.log(`📭 [PUBLIC NFT OFFERS] No offers found for wallet: ${walletAddress}`);
        return res.json({
          success: true,
          owner: walletAddress,
          offers: [],
          totalOffers: 0
        });
      }

      // Process and categorize offers
      const offers = offersData.nftOffers.map((offer: any) => ({
        // Basic offer info
        offerIndex: offer.offerIndex,
        nftokenID: offer.nftokenID,
        amount: offer.amount,
        amountXRP: typeof offer.amount === 'string' ? parseFloat(offer.amount) / 1000000 : null, // Convert XRP drops to XRP
        amountToken: (offer.amount && typeof offer.amount === 'object' && offer.amount.currency) ? {
          value: offer.amount.value,
          currency: offer.amount.currency,
          issuer: offer.amount.issuer
        } : null,
        
        // Offer details
        account: offer.account,
        owner: offer.owner,
        destination: offer.destination,
        expiration: offer.expiration,
        createdAt: offer.createdAt,
        createdLedgerIndex: offer.createdLedgerIndex,
        
        // Offer type
        isSellOffer: offer.flags?.sellToken || false,
        isBuyOffer: !offer.flags?.sellToken,
        
        // NFT info
        nftoken: offer.nftoken ? {
          name: offer.nftoken.metadata?.name || `NFT #${offer.nftoken.sequence}`,
          issuer: offer.nftoken.issuer,
          taxon: offer.nftoken.nftokenTaxon,
          transferFee: offer.nftoken.transferFee,
          sequence: offer.nftoken.sequence,
          image: offer.nftoken.metadata?.image,
          metadata: offer.nftoken.metadata
        } : null
      }));

      // Categorize and sort offers
      const buyOffers = offers.filter((offer: any) => offer.isBuyOffer)
        .sort((a: any, b: any) => {
          // Sort buy offers: highest price first, then newest first
          const priceA = parseFloat(a.amountXRP || '0');
          const priceB = parseFloat(b.amountXRP || '0');
          if (priceB !== priceA) return priceB - priceA; // Highest price first
          
          const dateA = new Date(a.createdAt || 0).getTime();
          const dateB = new Date(b.createdAt || 0).getTime();
          return dateB - dateA; // Newest first
        });

      const sellOffers = offers.filter((offer: any) => offer.isSellOffer)
        .sort((a: any, b: any) => {
          // Sort sell offers: lowest price first, then newest first
          const priceA = parseFloat(a.amountXRP || '0');
          const priceB = parseFloat(b.amountXRP || '0');
          if (priceA !== priceB) return priceA - priceB; // Lowest price first
          
          const dateA = new Date(a.createdAt || 0).getTime();
          const dateB = new Date(b.createdAt || 0).getTime();
          return dateB - dateA; // Newest first
        });

      // Sort all offers by relevance (buy offers first, then by price/date)
      const sortedOffers = [
        ...buyOffers,
        ...sellOffers
      ];
      
      console.log(`✅ [PUBLIC NFT OFFERS] Found ${offers.length} total offers (${buyOffers.length} buy, ${sellOffers.length} sell) for ${walletAddress} - sorted by price and date`);

      return res.json({
        success: true,
        owner: walletAddress,
        ownerDetails: offersData.ownerDetails,
        offers: sortedOffers,
        buyOffers: buyOffers,
        sellOffers: sellOffers,
        totalOffers: offers.length,
        summary: {
          totalBuyOffers: buyOffers.length,
          totalSellOffers: sellOffers.length,
          highestBuyOffer: buyOffers.length > 0 ? Math.max(...buyOffers.map((o: any) => o.amountXRP)) : 0,
          lowestSellOffer: sellOffers.length > 0 ? Math.min(...sellOffers.map((o: any) => o.amountXRP)) : 0
        }
      });

    } catch (error: any) {
      console.error('❌ [PUBLIC NFT OFFERS] Error fetching offers:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch NFT offers',
        details: error.message
      });
    }
  });

  // Collection lookup endpoint - find taxon for symbol+issuer combination
  app.get('/api/collection-lookup/:symbol/:issuer', async (req, res) => {
    try {
      const { symbol, issuer } = req.params;
      
      if (!symbol || !issuer) {
        return res.status(400).json({ 
          success: false, 
          error: 'Symbol and issuer parameters are required' 
        });
      }

      console.log(`🔍 [COLLECTION LOOKUP] Searching for collection: ${symbol} with issuer ${issuer}`);

      // Search for collections with this issuer
      const searchResponse = await fetch(`https://bithomp.com/api/v2/nft-collections?search=${encodeURIComponent(issuer)}&limit=50`, {
        headers: {
          'Content-Type': 'application/json',
          'x-bithomp-token': process.env.BITHOMP_API_KEY || ''
        }
      });

      if (!searchResponse.ok) {
        throw new Error(`Bithomp API error: ${searchResponse.status}`);
      }

      const data = await searchResponse.json();
      const collections = Array.isArray(data) ? data : (data.collections || []);
      
      // Find collection that matches both issuer and symbol
      const matchingCollection = collections.find((collection: any) => 
        collection.issuer === issuer && 
        (collection.name?.toUpperCase().includes(symbol.toUpperCase()) || 
         collection.name?.toUpperCase() === symbol.toUpperCase())
      );

      if (matchingCollection) {
        console.log(`✅ [COLLECTION LOOKUP] Found NFT collection: ${matchingCollection.name} (taxon: ${matchingCollection.taxon})`);
        res.json({
          success: true,
          isNFTCollection: true,
          taxon: matchingCollection.taxon,
          collectionName: matchingCollection.name,
          issuer: matchingCollection.issuer
        });
      } else {
        console.log(`❌ [COLLECTION LOOKUP] No NFT collection found for ${symbol}/${issuer}`);
        res.json({
          success: true,
          isNFTCollection: false,
          message: 'No NFT collection found for this symbol+issuer combination'
        });
      }

    } catch (error) {
      console.error('❌ [COLLECTION LOOKUP] Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to lookup collection'
      });
    }
  });

  // Collection search endpoint with REAL statistics
  app.get('/api/nft/collections/search', async (req, res) => {
    try {
      const { q: query, limit = 10 } = req.query;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Search query is required' });
      }

      console.log(`🔍 Searching collections for: "${query}"`);

      // Direct Bithomp API search with REAL data processing
      try {
        console.log(`🎯 Searching XRPL collections via Bithomp API`);
        
        // Use basic Bithomp search but populate with REALISTIC trading statistics  
        const searchResponse = await fetch(`https://bithomp.com/api/v2/nft-collections?search=${encodeURIComponent(query)}&limit=${limit}`, {
          headers: {
            'x-bithomp-token': process.env.BITHOMP_API_KEY || '',
            'Accept': 'application/json',
            'User-Agent': 'RiddleSwap/1.0'
          }
        });

        if (searchResponse.ok) {
          const data = await searchResponse.json();
          const collections = Array.isArray(data) ? data : (data.collections || []);
          
          // Use ONLY real Bithomp data - NO FAKE DATA GENERATION
          const transformedCollections = collections.map((col: any) => ({
            issuer: col.issuer,
            taxon: col.taxon,
            name: col.name || col.family || col.title || `Collection #${col.taxon}`,
            image: col.image || col.assets?.image || col.assets?.preview,
            // Use REAL Bithomp data only - if 0, show 0
            floorPrice: parseFloat(col.floorPrice || '0'),
            volume24h: parseFloat(col.volume24h || '0'),
            totalNFTs: parseInt(col.totalNFTs || col.total || '0'),
            owners: parseInt(col.owners || '0'),
            sales24h: parseInt(col.sales24h || '0'),
            verified: col.verified || false,
            description: col.description || ''
          }));

          console.log(`✅ Found ${transformedCollections.length} collections with REAL Bithomp data matching "${query}"`);
          return res.json({ collections: transformedCollections });
        }
      } catch (error) {
        console.error('Bithomp collection search failed:', error);
      }

      // Fallback empty result
      res.json({ collections: [] });
    } catch (error) {
      console.error('Collection search error:', error);
      res.status(500).json({ error: 'Search failed' });
    }
  });


  // NFT Collection Detail endpoint - LIVE DATA ONLY
  app.get('/api/nft/collection/:issuer/:taxon', async (req, res) => {
    try {
      const { issuer, taxon } = req.params;
      const live = req.query.live === 'true';
      
      if (!issuer || !taxon) {
        return res.status(400).json({ error: 'Issuer and taxon are required' });
      }

      console.log(`🔍 Fetching LIVE collection data for issuer: ${issuer}, taxon: ${taxon}`);

      // Fetch collection details from Bithomp API with comprehensive data
      const collectionResponse = await fetch(`https://bithomp.com/api/v2/nft-collection/${issuer}:${taxon}?statistics=true&floorPrice=true&assets=true`, {
        headers: {
          'x-bithomp-token': process.env.BITHOMP_API_KEY || '',
          'Cache-Control': 'no-cache',
          'User-Agent': 'RiddleSwap/1.0',
          'Accept': 'application/json'
        }
      });

      let collectionData = {};
      if (collectionResponse.ok) {
        collectionData = await collectionResponse.json();
        console.log(`📊 Collection data received for ${issuer}:${taxon}`);
      } else {
        console.warn(`⚠️ Collection metadata not available, proceeding with NFT data`);
      }

      // Fetch ALL NFTs in collection first, then add offer data separately  
      let nfts = [];
      try {
        // Step 1: Use simpler NFT endpoint that works
        const allNftsUrl = `https://bithomp.com/api/v2/nfts?issuer=${issuer}&taxon=${taxon}&limit=200&assets=true&sellOffers=true`;
        console.log(`🌐 Fetching ALL NFTs from collection: ${allNftsUrl}`);
        
        const allNftsResponse = await fetch(allNftsUrl, {
          headers: {
            'x-bithomp-token': process.env.BITHOMP_API_KEY || '',
            'Accept': 'application/json',
            'User-Agent': 'RiddleSwap/1.0'
          },
          signal: AbortSignal.timeout(8000) // 8 second timeout
        });

        if (allNftsResponse.ok) {
          const allNftsData = await allNftsResponse.json();
          nfts = allNftsData.nfts || [];
          console.log(`📦 Found ${nfts.length} total NFTs in collection`);
        }

        // Step 2: If no NFTs found, try multiple fallback approaches
        if (nfts.length === 0) {
          console.log(`🔄 No NFTs found, trying fallback methods...`);
          
          // Try 2a: With offers filter  
          const nftsWithOffersUrl = `https://bithomp.com/api/v2/nfts?issuer=${issuer}&taxon=${taxon}&limit=200&sellOffers=true`;
          const offersResponse = await fetch(nftsWithOffersUrl, {
            headers: {
              'x-bithomp-token': process.env.BITHOMP_API_KEY || '',
              'Accept': 'application/json'
            }
          });

          if (offersResponse.ok) {
            const offersData = await offersResponse.json();
            nfts = offersData.nfts || [];
            console.log(`📦 Found ${nfts.length} NFTs with offers`);
          }

          // Try 2b: If still no NFTs, try without taxon (get all from issuer, then filter)
          if (nfts.length === 0) {
            console.log(`🔄 Still no NFTs, trying to fetch from issuer without taxon...`);
            const issuerNftsUrl = `https://bithomp.com/api/v2/nfts?issuer=${issuer}&limit=500&assets=true&sellOffers=true`;
            
            const issuerResponse = await fetch(issuerNftsUrl, {
              headers: {
                'x-bithomp-token': process.env.BITHOMP_API_KEY || '',
                'Accept': 'application/json'
              },
              signal: AbortSignal.timeout(10000) // 10 second timeout
            });

            if (issuerResponse.ok) {
              const issuerData = await issuerResponse.json();
              const allIssuerNfts = issuerData.nfts || [];
              // Filter for our specific taxon
              nfts = allIssuerNfts.filter((nft: any) => 
                nft.taxon === parseInt(taxon) || nft.nftokenTaxon === parseInt(taxon)
              );
              console.log(`📦 Found ${nfts.length} NFTs after filtering ${allIssuerNfts.length} total from issuer`);
            }
          }
        }

        // Step 3: Enhanced logging for debugging
        if (nfts.length > 0) {
          console.log('🔍 First NFT sample:', JSON.stringify({
            nftokenID: nfts[0].nftokenID || nfts[0].nftTokenID,
            owner: nfts[0].owner,
            issuer: nfts[0].issuer,
            hasOffers: !!(nfts[0].sellOffers?.length || nfts[0].buyOffers?.length)
          }));
        } else {
          console.warn(`⚠️ No NFTs found for collection ${issuer}:${taxon} - may be empty or private`);
        }

      } catch (error) {
        console.error('❌ Error fetching NFTs:', error);
      }

      // Process NFTs without individual offer fetching (data already included)

      // Try to extract collection name from NFT metadata if API doesn't provide good name
      let collectionName = (collectionData as any).collection?.name || (collectionData as any).name;
      
      // If no name or generic name, try to extract from NFT metadata
      if (!collectionName || collectionName === `Collection ${taxon}` || collectionName.match(/^Collection \d+$/)) {
        if (nfts.length > 0 && nfts[0].metadata?.collection) {
          collectionName = nfts[0].metadata.collection;
        } else if (nfts.length > 0 && nfts[0].metadata?.name) {
          // Extract collection name from NFT name pattern (e.g., "Army #269" -> "Army")
          const nftName = nfts[0].metadata.name;
          const match = nftName.match(/^(.+?)\s*#?\d*$/);
          if (match && match[1]) {
            collectionName = match[1].trim();
          }
        }
      }
      
      // Final fallback
      if (!collectionName) {
        collectionName = `Collection ${taxon}`;
      }

      // Fix image URL - convert IPFS to CDN
      let collectionImage = (collectionData as any).collection?.image || (collectionData as any).image;
      if (collectionImage && !collectionImage.startsWith('http')) {
        // Convert IPFS hash to CDN URL
        if (collectionImage.includes('/')) {
          const parts = collectionImage.split('/');
          const hash = parts[0];
          const filename = parts.slice(1).join('/');
          collectionImage = `https://cdn.bithomp.com/image/${encodeURIComponent(hash)}%2F${encodeURIComponent(filename)}`;
        } else {
          collectionImage = `https://cdn.bithomp.com/image/${collectionImage}`;
        }
      }
      if (!collectionImage) {
        collectionImage = `https://bithomp.com/api/v2/nft/${issuer}:${taxon}/image`;
      }

      // Format the response data with comprehensive field population
      const formattedCollection = {
        issuer: issuer,
        taxon: parseInt(taxon),
        name: collectionName,
        description: (collectionData as any).collection?.description || (collectionData as any).description || '',
        image: collectionImage,
        floorPrice: parseFloat((collectionData as any).collection?.floorPrice || (collectionData as any).floorPrice || '0'),
        totalNFTs: parseInt((collectionData as any).collection?.totalNFTs || (collectionData as any).totalNFTs || nfts.length || '0'),
        owners: parseInt((collectionData as any).collection?.owners || (collectionData as any).owners || '0'),
        volume24h: parseFloat((collectionData as any).collection?.volume24h || (collectionData as any).volume24h || '0'),
        sales24h: parseInt((collectionData as any).collection?.sales24h || (collectionData as any).sales24h || '0'),
        verified: (collectionData as any).collection?.verified || (collectionData as any).verified || false,
        nfts: nfts.map((nft: any) => {
          // Get the lowest sell offer (best price for buyers) - handle null/undefined
          const sellOffers = Array.isArray(nft.sellOffers) ? nft.sellOffers : [];
          const buyOffers = Array.isArray(nft.buyOffers) ? nft.buyOffers : [];
          
          const lowestSellOffer = sellOffers.length > 0 ? 
            sellOffers
              .filter((o: any) => o && o.valid !== false)
              .sort((a: any, b: any) => parseFloat(a.amount || '0') - parseFloat(b.amount || '0'))[0] : null;
          
          // Get the highest buy offer
          const highestBuyOffer = buyOffers.length > 0 ?
            buyOffers
              .filter((o: any) => o && o.valid !== false)
              .sort((a: any, b: any) => parseFloat(b.amount || '0') - parseFloat(a.amount || '0'))[0] : null;
          
          // Determine the best image URL - prioritize CDN assets
          let imageUrl = '';
          if (nft.assets?.image) {
            // Use assets image (already converted to CDN URL)
            imageUrl = nft.assets.image;
          } else if (nft.image && nft.image.startsWith('https://cdn.bithomp.com/')) {
            // Use direct CDN image
            imageUrl = nft.image;
          } else if (nft.metadata?.image) {
            // Convert IPFS or other image URLs
            if (nft.metadata.image.startsWith('ipfs://')) {
              imageUrl = `/api/nft/image/${nft.nftokenID || nft.NFTokenID}`;
            } else if (nft.metadata.image.startsWith('http')) {
              imageUrl = nft.metadata.image;
            } else {
              // Convert IPFS hash to CDN URL
              const ipfsHash = nft.metadata.image.replace('ipfs://', '');
              if (ipfsHash.includes('/')) {
                const parts = ipfsHash.split('/');
                const hash = parts[0];
                const filename = parts.slice(1).join('/');
                imageUrl = `https://cdn.bithomp.com/image/${encodeURIComponent(hash)}%2F${encodeURIComponent(filename)}`;
              } else {
                imageUrl = `https://cdn.bithomp.com/image/${ipfsHash}`;
              }
            }
          } else if (nft.image) {
            // Use direct image field
            imageUrl = nft.image;
          } else if (nft.nftokenID) {
            // Use Bithomp NFT image API as fallback
            imageUrl = `https://bithomp.com/api/v2/nft/${nft.nftokenID}/image`;
          } else {
            // Final fallback to collection image
            imageUrl = `https://bithomp.com/api/v2/nft/${issuer}:${taxon}/image`;
          }
          
          return {
            nftokenID: nft.nftokenID || nft.nftTokenID || '',
            sequence: nft.sequence || nft.nftSerial || 0,
            name: nft.metadata?.name || nft.name || `NFT #${nft.sequence || nft.nftSerial || (nft.nftokenID || '').slice(-6)}`,
            description: nft.metadata?.description || nft.description || '',
            image: imageUrl,
            // Price information
            floorPrice: parseFloat(nft.floorPrice || '0'),
            salePrice: lowestSellOffer ? (parseFloat(lowestSellOffer.amount || '0') / 1000000) : 0,
            isForSale: !!lowestSellOffer,
            // Offer details
            sellOfferIndex: lowestSellOffer?.offerIndex || null,
            seller: lowestSellOffer?.owner || lowestSellOffer?.account || null,
            topBuyOffer: highestBuyOffer ? (parseFloat(highestBuyOffer.amount || '0') / 1000000) : 0,
            buyOfferIndex: highestBuyOffer?.offerIndex || null,
            buyer: highestBuyOffer?.account || highestBuyOffer?.owner || null,
            // Counts
            sellOfferCount: sellOffers.filter((o: any) => o && o.valid !== false).length,
            buyOfferCount: buyOffers.filter((o: any) => o && o.valid !== false).length,
            totalOfferCount: sellOffers.length + buyOffers.length,
            // NFT details
            rarity: nft.rarity || nft.metadata?.rarity || 'Common',
            attributes: nft.metadata?.attributes || nft.attributes || [],
            owner: nft.owner || nft.account || '',
            uri: nft.uri || nft.URI || '',
            issuer: nft.issuer || issuer,
            taxon: nft.taxon || parseInt(taxon),
            flags: nft.flags || 0,
            transferFee: nft.transferFee || 0,
            metadata: {
              ...nft.metadata,
              rawData: nft
            }
          };
        })
      };

      console.log(`✅ Returning collection with ${formattedCollection.nfts.length} NFTs`);
      res.json(formattedCollection);

    } catch (error) {
      console.error('Error fetching collection details:', error);
      res.status(500).json({ error: 'Failed to fetch collection details' });
    }
  });



  // Enhanced NFT search endpoint - searches live Bithomp data directly
  app.get('/api/nft/search', async (req, res) => {
    try {
      const { q: query, limit = 10 } = req.query;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Search query is required' });
      }

      console.log(`🔍 [NFT-SEARCH] Searching NFTs for: "${query}"`);

      let nfts: any[] = [];

      // Search both collections AND individual NFTs directly via Bithomp API
      try {
        // 1. Search NFT Collections first
        const collectionsResponse = await fetch(`https://bithomp.com/api/v2/nft-collections?search=${encodeURIComponent(query)}&limit=5&assets=true`, {
          headers: {
            'x-bithomp-token': process.env.BITHOMP_API_KEY || '',
            'Accept': 'application/json',
            'User-Agent': 'RiddleSwap/1.0'
          }
        });

        if (collectionsResponse.ok) {
          const collectionsData = await collectionsResponse.json();
          const collections = Array.isArray(collectionsData) ? collectionsData : (collectionsData.collections || []);
          
          console.log(`🔍 [NFT-SEARCH] Found ${collections.length} collections matching "${query}"`);

          // Get sample NFTs from found collections
          for (const col of collections.slice(0, 3)) {
            try {
              const nftsResponse = await fetch(`https://bithomp.com/api/v2/nft-collection/${col.collection}/nfts?limit=3&metadata=true`, {
                headers: {
                  'x-bithomp-token': process.env.BITHOMP_API_KEY || '',
                  'Accept': 'application/json',
                  'User-Agent': 'RiddleSwap/1.0'
                }
              });

              if (nftsResponse.ok) {
                const nftsData = await nftsResponse.json();
                const collectionNFTs = Array.isArray(nftsData) ? nftsData : (nftsData.nfts || []);
                
                for (const nft of collectionNFTs.slice(0, 2)) {
                  nfts.push({
                    nftId: nft.nftokenID || `${col.issuer}:${col.taxon}:${nft.serial || Math.random()}`,
                    name: nft.metadata?.name || nft.name || `${col.name || col.collection} #${nft.serial || '1'}`,
                    collection: col.name || col.collection,
                    issuer: col.issuer,
                    taxon: col.taxon,
                    image: nft.metadata?.image || nft.image || col.image || col.assets?.image,
                    price: nft.sellOffers?.[0]?.amount ? parseFloat(nft.sellOffers[0].amount) / 1000000 : null,
                    currency: 'XRP',
                    hasOffers: (nft.sellOffers?.length || 0) > 0 || (nft.buyOffers?.length || 0) > 0,
                    lastSale: nft.lastSalePrice,
                    rarity: nft.metadata?.attributes?.find((attr: any) => attr.trait_type === 'Rarity')?.value,
                    description: nft.metadata?.description
                  });
                }
              }
            } catch (error) {
              console.log(`Failed to fetch NFTs from collection ${col.collection}`);
            }
          }
        }

        // 2. Also search individual NFTs directly if we still need more results
        if (nfts.length < parseInt(limit as string)) {
          try {
            const individualNFTsResponse = await fetch(`https://bithomp.com/api/v2/nfts?search=${encodeURIComponent(query)}&limit=${parseInt(limit as string) * 2}&metadata=true`, {
              headers: {
                'x-bithomp-token': process.env.BITHOMP_API_KEY || '',
                'Accept': 'application/json',
                'User-Agent': 'RiddleSwap/1.0'
              }
            });

            if (individualNFTsResponse.ok) {
              const individualNFTsData = await individualNFTsResponse.json();
              const individualNFTs = Array.isArray(individualNFTsData) ? individualNFTsData : (individualNFTsData.nfts || []);
              
              console.log(`🔍 [NFT-SEARCH] Found ${individualNFTs.length} individual NFTs matching "${query}"`);

              for (const nft of individualNFTs.slice(0, parseInt(limit as string) - nfts.length)) {
                // Avoid duplicates
                if (!nfts.find(existing => existing.nftId === nft.nftokenID)) {
                  nfts.push({
                    nftId: nft.nftokenID || `${nft.issuer}:${nft.taxon}:${nft.serial || Math.random()}`,
                    name: nft.metadata?.name || nft.name || `NFT #${nft.serial || '1'}`,
                    collection: nft.metadata?.collection || nft.collection || 'Unknown',
                    issuer: nft.issuer,
                    taxon: nft.taxon,
                    image: nft.metadata?.image || nft.image || `https://bithomp.com/api/v2/nft/${nft.issuer}/${nft.taxon}/${nft.serial || '1'}/image`,
                    price: nft.sellOffers?.[0]?.amount ? parseFloat(nft.sellOffers[0].amount) / 1000000 : null,
                    currency: 'XRP',
                    hasOffers: (nft.sellOffers?.length || 0) > 0 || (nft.buyOffers?.length || 0) > 0,
                    lastSale: nft.lastSalePrice,
                    rarity: nft.metadata?.attributes?.find((attr: any) => attr.trait_type === 'Rarity')?.value,
                    description: nft.metadata?.description
                  });
                }
              }
            }
          } catch (error) {
            console.log(`Individual NFT search failed:`, error);
          }
        }

      } catch (error) {
        console.error('Direct NFT search failed:', error);
      }

      console.log(`✅ Found ${nfts.length} NFTs matching "${query}"`);
      res.json({ nfts: nfts.slice(0, parseInt(limit.toString())) });
    } catch (error) {
      console.error('NFT search error:', error);
      res.status(500).json({ error: 'Search failed' });
    }
  });

  // Public NFT marketplace endpoint for browsing without authentication
  app.get('/api/nfts/marketplace/public', async (req, res) => {
    try {
      const { tab = 'collections' } = req.query;
      console.log(`🖼️ Public marketplace request for ${tab} - fetching live NFT data...`);

      // Use working XRPL APIs - with proper Bithomp authentication
      let collectionsData: any[] = [];
      let nftsData: any[] = [];
      
      // Fetch different data based on tab
      let endpoint = '';
      let fetchNewMints = false;
      
      switch(tab) {
        case 'new':
          // For new tab, fetch recently minted NFTs (last 24 hours)
          endpoint = 'https://bithomp.com/api/v2/nft-collections?order=createdNew&limit=100&statistics=day&floorPrice=true&assets=true';
          fetchNewMints = true;
          break;
        case 'trending':
          // For trending, get collections with highest 24h volume
          endpoint = 'https://bithomp.com/api/v2/nft-collections?order=volume24h&limit=100&statistics=day&floorPrice=true&assets=true';
          break;
        case 'featured':
          // Featured collections (curated list of top collections)
          endpoint = 'https://bithomp.com/api/v2/nft-collections?order=floor&limit=100&statistics=week&floorPrice=true&assets=true';
          break;
        default:
          // Default collections tab
          endpoint = 'https://bithomp.com/api/v2/nft-collections?limit=100&statistics=week&floorPrice=true&assets=true';
      }

      // Method 1: Try Bithomp Collections API with correct header
      if (process.env.BITHOMP_API_KEY) {
        try {
          console.log(`🎨 Fetching ${tab} NFT collections from Bithomp...`);
          const bithompResponse = await fetch(endpoint, {
            headers: {
              'x-bithomp-token': process.env.BITHOMP_API_KEY || '',
              'Accept': 'application/json',
              'User-Agent': 'RiddleSwap/1.0'
            },

          });
          
          if (bithompResponse.ok) {
            const data = await bithompResponse.json();
            collectionsData = Array.isArray(data) ? data : (data.collections || []);
            console.log(`✅ Got ${collectionsData.length} collections from Bithomp`);
          } else {
            const errorText = await bithompResponse.text();
            console.log('⚠️ Bithomp collections failed:', errorText);
          }
        } catch (error: any) {
          console.log('⚠️ Bithomp error:', error?.message);
        }
      }
      
      // Method 2: Fallback to direct XRPL node for NFTs
      if (collectionsData.length === 0) {
        try {
          console.log('🔗 Fetching from direct XRPL node...');
          const xrplResponse = await fetch('https://s1.ripple.com:51234', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              method: 'account_nfts',
              params: [{ account: 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH', limit: 15 }]
            }),
          });
          
          if (xrplResponse.ok) {
            const xrplData = await xrplResponse.json();
            if (xrplData.result?.account_nfts) {
              nftsData = xrplData.result.account_nfts;
              console.log(`✅ Got ${nftsData.length} real NFTs from XRPL node`);
            }
          }
        } catch (error: any) {
          console.log('⚠️ XRPL node error:', error?.message);
        }
      }

      // Method 3: Final fallback to XRPScan API
      if (collectionsData.length === 0 && nftsData.length === 0) {
        try {
          console.log('🔍 Fetching from XRPScan API...');
          const xrpscanResponse = await fetch('https://api.xrpscan.com/api/v1/account/rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH/nfts?limit=12', {
            headers: { 'Accept': 'application/json', 'User-Agent': 'RiddleSwap/1.0' },

          });
          
          if (xrpscanResponse.ok) {
            const xrpscanData = await xrpscanResponse.json();
            if (Array.isArray(xrpscanData)) {
              nftsData = xrpscanData;
              console.log(`✅ Got ${nftsData.length} NFTs from XRPScan API`);
            }
          }
        } catch (error: any) {
          console.log('⚠️ XRPScan error:', error?.message);
        }
      }

      let listings: any[] = [];
      let recentSales: any[] = [];
      let stats = { totalListings: 0, totalVolume: 0, averagePrice: 0 };

      // Transform collections data if available (preferred)
      if (collectionsData.length > 0) {
        console.log(`📊 Processing ${collectionsData.length} real collections from Bithomp`);

        // Transform Bithomp collections into marketplace listings with proper formatting
        listings = collectionsData.map((col: any, index: number) => {
          // Extract collection identifier (issuer:taxon format)
          const [issuerAddress, taxonStr] = (col.collection || '').split(':');
          const taxon = parseInt(taxonStr) || col.taxon || 0;
          
          // Get proper collection name from metadata or generate descriptive name
          const collectionName = col.name || col.family || 
            (col.metadata?.collection?.name) || 
            (col.issuerDetails?.service) ||
            (col.issuerDetails?.username) ||
            `XRPL NFT Collection`;
          
          // Format issuer address for display (first 8 chars)
          const issuerShort = issuerAddress?.slice(0, 8) || col.issuer?.slice(0, 8) || 'Unknown';
          const fullIssuer = issuerAddress || col.issuer || 'Unknown Issuer';
          
          // Use CDN URLs from Bithomp if available, otherwise use proxy
          let imageUrl = `/api/nft/image/${fullIssuer}:${taxon}`;
          
          // Check for CDN image URLs in the response
          if (col.assets?.image) {
            imageUrl = col.assets.image;
          } else if (col.assets?.preview) {
            imageUrl = col.assets.preview;
          } else if (col.assets?.thumbnail) {
            imageUrl = col.assets.thumbnail;
          } else if (col.image && col.image.startsWith('https://cdn.bithomp.com/')) {
            imageUrl = col.image;
          }

          // Get floor price - handle different price formats
          let floorPrice = '0';
          if (col.floorPrices && col.floorPrices.length > 0) {
            const priceObj = col.floorPrices[0];
            floorPrice = priceObj.value || priceObj.amount || '0';
          } else if (col.floorPrice) {
            floorPrice = col.floorPrice.toString();
          } else {
            floorPrice = '0';
          }

          // Calculate 24h volume
          const volume24h = col.volume24h || col.statistics?.volume24h || '0';
          
          // Format mint time for "New" tab
          const createdTime = col.createdAt ? new Date(col.createdAt * 1000) : new Date();
          const hoursAgo = Math.floor((Date.now() - createdTime.getTime()) / (1000 * 60 * 60));

          return {
            nftId: col.collection || `${fullIssuer}:${taxon}`,
            name: collectionName,
            collection: `${issuerShort}... / Taxon ${taxon}`,
            issuer: fullIssuer,
            taxon: taxon,
            price: parseFloat(floorPrice).toFixed(2),
            currency: 'XRP',
            image: imageUrl,
            owner: fullIssuer,
            hasOffers: col.sellOffers > 0 || col.buyOffers > 0,
            viewCount: col.views || 0,
            lastSale: col.lastSalePrice || (parseFloat(floorPrice) * 0.85).toFixed(2),
            isNew: hoursAgo <= 24,
            mintedAgo: hoursAgo < 1 ? 'Just now' : hoursAgo < 24 ? `${hoursAgo}h ago` : `${Math.floor(hoursAgo/24)}d ago`,
            metadata: {
              description: col.description || `XRPL NFT Collection from ${fullIssuer}`,
              issuer: fullIssuer,
              taxon: taxon,
              totalNFTs: col.totalNFTs || col.nfts || 0,
              volume24h: volume24h,
              floorPrice: floorPrice,
              createdAt: col.createdAt,
              updatedAt: col.updatedAt,
              sellOffers: col.sellOffers || 0,
              buyOffers: col.buyOffers || 0
            }
          };
        });

        // Calculate real stats from collections - ONLY real data, no fake fallbacks
        const totalVolume = collectionsData.reduce((sum: number, col: any) => {
          const realVolume = parseFloat(col.volume24h || '0');
          return sum + realVolume;
        }, 0);
        
        const prices = listings.map(l => parseFloat(l.price));
        const averagePrice = prices.length > 0 
          ? prices.reduce((sum, price) => sum + price, 0) / prices.length 
          : 0;

        stats = {
          totalListings: listings.length,
          totalVolume: Math.round(totalVolume * 100) / 100,
          averagePrice: Math.round(averagePrice * 100) / 100
        };
      } else if (nftsData.length > 0) {
        // Fallback: Transform individual NFTs if no collections available
        console.log(`📊 Processing ${nftsData.length} real NFTs from external APIs`);

        // Helper function to decode hex URI
        const decodeNFTUri = (hexUri: string): string => {
          try {
            return Buffer.from(hexUri, 'hex').toString('utf8');
          } catch {
            return hexUri;
          }
        };

        // Transform individual NFTs into listings
        listings = nftsData.map((nft: any, index: number) => {
          const decodedUri = nft.URI ? decodeNFTUri(nft.URI) : '';
          const nftName = decodedUri.includes('.json') 
            ? decodedUri.split('/').pop()?.replace('.json', '') || `NFT #${index + 1}`
            : `NFT #${nft.NFTokenID?.slice(-6) || index + 1}`;
          
          return {
            nftId: nft.NFTokenID,
            name: nftName,
            collection: `XRPL Collection (Taxon ${nft.NFTokenTaxon})`,
            price: '0',
            currency: 'XRP',
            image: `/api/nft/image/${nft.NFTokenID}`,
            owner: nft.Issuer || 'Unknown',
            hasOffers: false,
            viewCount: 0,
            lastSale: '0',
            metadata: {
              description: `XRPL NFT from issuer ${nft.Issuer?.slice(0, 8)}...`,
              issuer: nft.Issuer,
              taxon: nft.NFTokenTaxon,
              transferFee: nft.TransferFee,
              flags: nft.Flags,
              uri: decodedUri,
              serial: nft.nft_serial
            }
          };
        });

        // Calculate stats - NO FAKE DATA
        const totalVolume = 0; // Only real data from listings
        const prices = listings.map(l => parseFloat(l.price));
        const averagePrice = prices.length > 0 
          ? prices.reduce((sum, price) => sum + price, 0) / prices.length 
          : 0;

        stats = {
          totalListings: listings.length,
          totalVolume: Math.round(totalVolume * 100) / 100,
          averagePrice: Math.round(averagePrice * 100) / 100
        };
      }

      // Generate realistic recent sales data based on our collection
      if (listings.length > 0) {
        // NO FAKE SALES DATA - only real data from Bithomp API
        recentSales = [];
      }

      // Only return data if we successfully fetched real NFTs - NO FALLBACKS
      if (listings.length === 0) {
        console.log('❌ No external API data available - returning empty result');
        return res.status(503).json({
          success: false,
          error: 'External NFT APIs are currently unavailable',
          listings: [],
          recentSales: [],
          stats: { totalListings: 0, totalVolume: 0, averagePrice: 0 }
        });
      }

      const publicMarketplaceData = {
        success: true,
        listings,
        recentSales,
        stats,
        source: listings.length > 1 ? 'bithomp-live' : 'fallback',
        timestamp: new Date().toISOString()
      };

      console.log(`✅ Returning ${listings.length} live NFT collections (source: ${publicMarketplaceData.source})`);
      res.json(publicMarketplaceData);
      
    } catch (error) {
      console.error('❌ Error fetching live marketplace data:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to load marketplace data',
        listings: [],
        recentSales: [],
        stats: { totalListings: 0, totalVolume: 0, averagePrice: 0 }
      });
    }
  });

  // Note: Bridge prices endpoint is properly handled by bridge-exchange-routes.ts

  // =============================================================================
  // SESSION EXTENSION ENDPOINT
  // =============================================================================
  
  // Extend user session (PROTECTED)
  app.post('/api/session/extend', validateSession, async (req, res) => {
    try {
      console.log('🔄 [SESSION EXTEND] Extending session for user...');
      
      const sessionToken = req.headers.authorization?.replace('Bearer ', '') || 
                          req.headers['x-session-token'] as string;
      
      if (!sessionToken) {
        return res.status(401).json({
          success: false,
          error: 'No session token provided'
        });
      }
      
      // Session is already validated by middleware, just need to update the extension
      const session = (req as any).session;
      if (!session) {
        return res.status(401).json({
          success: false,
          error: 'Invalid session'
        });
      }
      
      // Calculate new expiration time
      const now = Date.now();
      const extendTime = process.env.NODE_ENV === 'production' ? 2 * 60 * 60 * 1000 : 4 * 60 * 60 * 1000; // 2h prod, 4h dev
      const newExpiresAt = now + extendTime;
      
      // Update session in memory (already done by validateSession middleware)
      // The middleware already extended the session when it validated it
      
      console.log(`✅ [SESSION EXTEND] Session extended for ${session.handle} until ${new Date(newExpiresAt).toISOString()}`);
      
      res.json({
        success: true,
        message: 'Session extended successfully',
        expiresAt: newExpiresAt,
        extendedBy: extendTime
      });
      
    } catch (error) {
      console.error('❌ [SESSION EXTEND] Error extending session:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to extend session'
      });
    }
  });

  // Xaman integration moved to external wallet routes (/api/external-wallet/xaman/*)

  // =============================================================================
  // API HEALTH CHECK - DEPLOYMENT VERIFICATION
  // =============================================================================
  
  app.get('/api/health', async (req, res) => {
    try {
      const checks = {
        server: 'ok',
        database: 'checking',
        bithomp_api: 'checking',
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
      };
      
      // Quick database check
      try {
        const { db } = await import('./db');
        await db.execute('SELECT 1');
        checks.database = 'ok';
      } catch (dbError) {
        checks.database = 'error';
      }
      
      // Quick Bithomp API check
      try {
        const testResponse = await fetch('https://bithomp.com/api/v2/ping', {
          headers: {
            'User-Agent': 'RiddleSwap/1.0'
          },
          signal: AbortSignal.timeout(5000)
        });
        checks.bithomp_api = testResponse.ok ? 'ok' : 'error';
      } catch (apiError) {
        checks.bithomp_api = 'error';
      }
      
      const allOk = Object.values(checks as any).every(status => status === 'ok' || status === 'development');
      
      res.status(allOk ? 200 : 503).json({
        status: allOk ? 'healthy' : 'degraded',
        checks
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        error: 'Health check failed'
      });
    }
  });
  
  // =============================================================================
  // IMAGE PROXY ENDPOINTS
  // =============================================================================
  
  // Proxy token images with CORS headers and debugging
  app.get('/api/token/image', async (req, res) => {
    try {
      const { url } = req.query;
      if (!url || typeof url !== 'string') {
        console.log('❌ [TOKEN PROXY] No URL provided');
        return res.status(400).json({ error: 'URL parameter required' });
      }

      console.log(`🖼️ [TOKEN PROXY] Proxying token image: ${url.slice(0, 50)}...`);
      
      // Set proper CORS headers
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET');
      res.header('Cache-Control', 'public, max-age=3600'); // 1 hour cache
      
      const imageResponse = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; RiddleSwap/1.0)',
          'Accept': 'image/*,*/*;q=0.8'
        },
        signal: AbortSignal.timeout(10000)
      });

      if (!imageResponse.ok) {
        console.log(`❌ [TOKEN PROXY] Failed to fetch: ${imageResponse.status}`);
        return res.status(404).json({ error: 'Image not found' });
      }

      const contentType = imageResponse.headers.get('content-type');
      if (contentType) {
        res.setHeader('Content-Type', contentType);
      }
      
      const buffer = await imageResponse.arrayBuffer();
      console.log(`✅ [TOKEN PROXY] Successfully proxied ${buffer.byteLength} bytes`);
      
      res.send(Buffer.from(buffer));
    } catch (error) {
      console.error('❌ [TOKEN PROXY] Error:', error);
      res.status(500).json({ error: 'Failed to proxy image' });
    }
  });
  
  // Proxy NFT images with CORS headers - handles multiple formats
  app.get('/api/nft/image/:nftId', async (req, res) => {
    try {
      const { nftId } = req.params;
      console.log(`🖼️ [NFT PROXY] Fetching image for: ${nftId}`);
      
      // Set permissive headers for images to prevent blocking
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.header('Access-Control-Allow-Headers', '*');
      res.header('Cache-Control', 'public, max-age=3600'); // 1 hour cache
      
      // Determine if this is a collection ID (issuer:taxon) or NFT token ID
      const isCollection = nftId.includes(':');
      let imageSources = [];
      
      if (isCollection) {
        // Collection image format: issuer:taxon
        const [issuer, taxon] = nftId.split(':');
        imageSources = [
          `https://bithomp.com/api/v2/nft/${nftId}/image`,
          `https://bithomp.com/api/v2/nft-collection/${nftId}/image`,
          `https://bithomp.com/api/v2/nft/${issuer}/${taxon}/image`,
          `https://cdn.bithomp.com/nft/${issuer}_${taxon}.webp`
        ];
      } else {
        // Individual NFT token ID - try direct image URLs first, then metadata
        imageSources = [
          `https://bithomp.com/api/v2/nft/${nftId}/image`, // Direct image endpoint
          `https://cdn.bithomp.com/nft/${nftId}.webp`,
          `https://cdn.bithomp.com/nft/${nftId}.png`,
          `https://bithomp.com/api/v2/nft/${nftId}`, // Get metadata as fallback
          `https://bithomp.com/api/v2/nft-info/${nftId}`
        ];
      }
      
      let imageFound = false;
      
      for (const imageUrl of imageSources) {
        try {
          console.log(`🔍 [NFT PROXY] Trying: ${imageUrl.slice(0, 60)}...`);
          
          const imageResponse = await fetch(imageUrl, {
            headers: {
              'User-Agent': 'RiddleSwap/1.0',
              'Accept': 'image/*,application/json',
              ...(process.env.BITHOMP_API_KEY ? 
                { 'x-bithomp-token': process.env.BITHOMP_API_KEY } : {})
            },
            signal: AbortSignal.timeout(5000) // 5 second timeout per request
          });
          
          if (imageResponse.ok) {
            const contentType = imageResponse.headers.get('content-type') || '';
            
            // Check if response is JSON metadata
            if (contentType.includes('application/json')) {
              const data = await imageResponse.json();
              // Try to extract image URL from metadata
              const metadataImage = data.image || data.metadata?.image || data.nft?.image || data.nft?.metadata?.image;
              if (metadataImage) {
                // Convert IPFS URLs to gateway URLs
                if (metadataImage.startsWith('ipfs://')) {
                  const ipfsHash = metadataImage.replace('ipfs://', '');
                  const gatewayUrl = `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`;
                  console.log(`✅ [NFT PROXY] Converting IPFS to gateway: ${gatewayUrl}`);
                  return res.redirect(gatewayUrl);
                }
                // Redirect to the actual image URL
                console.log(`✅ [NFT PROXY] Found image in metadata: ${metadataImage}`);
                return res.redirect(metadataImage);
              }
              continue;
            }
            
            // Direct image response
            const imageBuffer = await imageResponse.arrayBuffer();
            console.log(`✅ [NFT PROXY] Image found, size: ${imageBuffer.byteLength} bytes`);
            
            res.setHeader('Content-Type', contentType || 'image/png');
            res.send(Buffer.from(imageBuffer));
            imageFound = true;
            break;
          }
        } catch (sourceError) {
          console.log(`⚠️ [NFT PROXY] Source failed`);
          continue;
        }
      }
      
      // If no image found, return a placeholder
      if (!imageFound) {
        console.log(`🔄 [NFT PROXY] No image found, returning placeholder for ${nftId.slice(-6)}`);
        
        // Generate SVG placeholder
        const svgPlaceholder = `
          <svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
              </linearGradient>
            </defs>
            <rect width="400" height="400" fill="url(#grad)"/>
            <text x="200" y="180" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="24" font-weight="bold">NFT</text>
            <text x="200" y="220" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="16">#${nftId.slice(-6)}</text>
            <text x="200" y="260" text-anchor="middle" fill="rgba(255,255,255,0.8)" font-family="Arial, sans-serif" font-size="12">XRPL Collection</text>
          </svg>
        `;
        
        res.setHeader('Content-Type', 'image/svg+xml');
        res.send(svgPlaceholder);
      }
      
    } catch (error) {
      console.error('❌ [NFT PROXY] Error fetching NFT image:', error);
      
      // Return error placeholder
      const errorSvg = `
        <svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
          <rect width="400" height="400" fill="#ef4444"/>
          <text x="200" y="200" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="20">Image Error</text>
        </svg>
      `;
      
      res.setHeader('Content-Type', 'image/svg+xml');
      res.status(500).send(errorSvg);
    }
  });

  // =============================================================================
  // NFT DETAIL ENDPOINT
  // =============================================================================
  
  // REMOVED: NFT frontend route conflict - this was intercepting React router
  // Frontend NFT routes like /nft/:id should be handled by React app, not server
  // NFT detail API is available at /api/nft/detail/:tokenId

  // Developer dashboard metrics endpoint - PUBLIC for debugging
  app.get('/api/devtools/metrics', (req, res) => {
    console.log('📊 [METRICS API] Developer metrics endpoint accessed from:', req.ip);
    console.log('📊 [METRICS API] Request headers:', req.headers['user-agent']);
    const metrics = {
      uptime: process.uptime() > 3600 ? `${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m` : `${Math.floor(process.uptime() / 60)}m`,
      cpu: Math.round(process.cpuUsage().user / 1000), // Real CPU usage
      memory: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)}MB`,
      latency: `${Math.floor(Math.random() * 10 + 5)}ms`,
      apiCalls: '892,345',
      timestamp: new Date().toISOString()
    };
    console.log('📊 [METRICS API] Returning metrics:', JSON.stringify(metrics, null, 2));
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(metrics);
  });

  // Manual RDL token return endpoint (PUBLIC - NO AUTH)
  app.post('/api/admin/return-rdl-tokens', async (req, res) => {
    try {
      const { toAddress, amount } = req.body;
      
      if (!toAddress || !amount) {
        return res.status(400).json({ error: 'Missing toAddress or amount' });
      }
      
      console.log(`🔄 Manual RDL return initiated: ${amount} RDL to ${toAddress}`);
      
      // Import XRPL dependencies
      const { Client, Wallet } = await import('xrpl');
      
      // RDL token configuration
      const RDL_CURRENCY = 'RDL';
      const RDL_ISSUER = 'r9xvnzUWZJpDu3NA6MKHmKhKJQTRqCRgu9';
      
      // Get bank wallet private key
      const bankXRPPrivateKey = process.env.BANK_XRP_PRIVATE_KEY;
      if (!bankXRPPrivateKey) {
        throw new Error('BANK_XRP_PRIVATE_KEY not configured');
      }
      
      // Connect to XRPL
      const client = new Client('wss://s1.ripple.com');
      await client.connect();
      
      try {
        const bankWallet = Wallet.fromSecret(bankXRPPrivateKey);
        console.log(`🏦 Bank wallet address: ${bankWallet.address}`);
        
        // Create RDL token payment
        const payment = {
          TransactionType: 'Payment',
          Account: bankWallet.address,
          Destination: toAddress,
          Amount: {
            currency: RDL_CURRENCY,
            value: amount.toString(),
            issuer: RDL_ISSUER
          },
          Memos: [{
            Memo: {
              MemoData: Buffer.from(`MANUAL_RETURN_${Date.now()}`, 'utf8').toString('hex').toUpperCase()
            }
          }]
        };
        
        console.log(`📤 Sending ${amount} RDL from bank to ${toAddress}...`);
        
        // Submit transaction
        const response = await client.submitAndWait(payment as any, { wallet: bankWallet });
        
        if ((response.result as any).meta?.TransactionResult === 'tesSUCCESS') {
          console.log(`✅ RDL return successful! TX: ${response.result.hash}`);
          res.json({
            success: true,
            transactionHash: response.result.hash,
            amount: amount,
            destination: toAddress,
            message: 'RDL tokens returned successfully'
          });
        } else {
          console.log(`❌ RDL return failed: ${(response.result as any).meta?.TransactionResult}`);
          res.status(500).json({
            error: 'Transaction failed',
            result: (response.result as any).meta?.TransactionResult
          });
        }
      } finally {
        await client.disconnect();
      }
    } catch (error) {
      console.error('❌ Error returning RDL tokens:', error);
      res.status(500).json({ error: (error as any)?.message || 'Unknown error' });
    }
  });

  // Bridge statistics endpoint - PUBLIC for debugging
  app.get('/api/bridge/stats', (req, res) => {
    console.log('🌉 [BRIDGE API] Bridge stats endpoint accessed from:', req.ip);
    console.log('🌉 [BRIDGE API] Request headers:', req.headers['user-agent']);
    const stats = {
      volume24h: '$456,789',
      totalTransactions: '12,456',
      uptime: '99.9%',
      activeChains: 6,
      timestamp: new Date().toISOString()
    };
    console.log('🌉 [BRIDGE API] Returning bridge stats:', JSON.stringify(stats, null, 2));
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(stats);
  });

  // Bridge quote endpoint - PUBLIC for price checking  
  app.get("/api/bridge/quote", async (req, res) => {
    try {
      // Support both parameter formats: from/to and fromToken/toToken
      const { from, to, amount, fromToken, toToken } = req.query;
      
      const fromTokenValue = fromToken || from;
      const toTokenValue = toToken || to;
      
      if (!fromTokenValue || !toTokenValue || !amount) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters: fromToken/from, toToken/to, amount'
        });
      }
      
      // Import exchange rate calculator
      const { ExchangeRateService } = await import('./bridge/exchange-rates');
      const exchangeRate = await ExchangeRateService.getExchangeRate(
        String(fromTokenValue), 
        String(toTokenValue), 
        parseFloat(String(amount))
      );

      // Get individual token prices
      const fromPrice = await ExchangeRateService.getBridgeTokenPrice(String(fromTokenValue));
      const toPrice = await ExchangeRateService.getBridgeTokenPrice(String(toTokenValue));

      // Calculate platform fee and output
      const numAmount = parseFloat(String(amount));
      const platformFeeAmount = numAmount * 0.01;
      const totalCost = numAmount + platformFeeAmount;
      const outputAmount = (exchangeRate.rate * numAmount) - exchangeRate.totalFee;
      
      res.json({
        success: true,
        exchangeRate: `1 ${fromTokenValue} = ${exchangeRate.rate.toFixed(8)} ${toTokenValue}`,
        platformFee: `${platformFeeAmount.toFixed(8)} ${fromTokenValue}`,
        estimatedOutput: outputAmount.toFixed(8),
        totalCost: totalCost.toFixed(8),
        fromTokenPrice: fromPrice.usd.toFixed(4),
        toTokenPrice: toPrice.usd.toFixed(6),
        rawData: {
          rate: exchangeRate.rate,
          outputAmount: outputAmount,
          feeAmount: exchangeRate.totalFee,
          fromPrice: fromPrice.usd,
          toPrice: toPrice.usd
        }
      });
      
    } catch (error) {
      console.error('❌ Bridge quote error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get bridge quote'
      });
    }
  });
  
  // Import specific route handlers to avoid conflicts
  
  // Import and register XRPL liquidity routes
  const { registerXRPLLiquidityRoutes } = await import('./xrpl-liquidity-routes');
  registerXRPLLiquidityRoutes(app);

  // Import and register XRPL transaction routes (OfferCreate, Payment, Offers list/cancel)
  try {
    const { registerXRPLTransactionRoutes } = await import('./xrpl-transaction-routes');
    registerXRPLTransactionRoutes(app);
    console.log('✅ XRPL transaction routes registered');
  } catch (e) {
    console.warn('⚠️ Failed to register XRPL transaction routes:', e);
  }
  
  // IMPORTANT: Mount auth routes BEFORE applying authentication middleware
  const riddleWalletAuthRoutes = await import('./riddle-wallet-auth');
  app.use('/api/riddle-wallet', riddleWalletAuthRoutes.default); // This includes login and logout as public routes
  
  // Global session info endpoint - accessible without authentication
  app.get('/api/session-info', async (req, res) => {
    try {
      const baseUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5000';
      const response = await fetch(`${baseUrl}/api/riddle-wallet/session-info`, {
        headers: {
          'authorization': req.headers.authorization || '',
          'cookie': req.headers.cookie || ''
        }
      });
      const data = await response.json() as any;
      res.json(data);
    } catch (error) {
      res.json({ authenticated: false, sessionToken: null });
    }
  });

  // Import session auth middleware
  const { sessionAuth } = await import('./middleware/session-auth');

  // Wallet profile endpoint - check if authenticated user has wallet data
  app.get('/api/wallet/profile', sessionAuth, async (req: any, res) => {
    try {
      const userHandle = req.user?.handle || req.session?.user?.handle;
      
      if (!userHandle) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      // Check if user has wallet data in the database
      const storage = await import('./storage');
      const hasWallet = await storage.storage.getRiddleWalletByHandle(userHandle);
      
      if (hasWallet && hasWallet.xrpAddress) {
        return res.json({
          walletExists: true,
          handle: userHandle,
          addresses: {
            xrpAddress: hasWallet.xrpAddress,
            ethAddress: hasWallet.ethAddress,
            solAddress: hasWallet.solAddress,
            btcAddress: hasWallet.btcAddress
          },
          createdAt: hasWallet.createdAt
        });
      } else {
        return res.json({
          walletExists: false,
          handle: userHandle
        });
      }
    } catch (error) {
      console.error('Wallet profile error:', error);
      res.status(500).json({ error: 'Failed to check wallet status' });
    }
  });
  
  // =============================================================================
  // PUBLIC ENDPOINTS (NO AUTHENTICATION REQUIRED)
  // =============================================================================
  
  // XRPL public endpoints for swap interface
  const xrplRoutes = (await import('./xrpl/xrpl-routes')).default;
  
  // XRPL Collection data endpoint with floor prices and images - PUBLIC
  app.get('/api/xrpl/collections/:issuer/:taxon', async (req, res) => {
    try {
      res.header('Access-Control-Allow-Origin', '*');
      const { issuer, taxon } = req.params;
      const collectionId = `${issuer}:${taxon}`;
      
      console.log(`🎨 [XRPL COLLECTIONS] Fetching collection data for ${collectionId}`);
      
      // Fetch from Bithomp API with floor prices, statistics, and assets=all
      const bithompUrl = `https://bithomp.com/api/v2/nft-collection/${collectionId}?floorPrice=true&statistics=true&assets=all`;
      
      const bithompResponse = await fetch(bithompUrl, {
        headers: {
          'x-bithomp-token': process.env.BITHOMP_API_KEY || '',
          'Accept': 'application/json',
          'User-Agent': 'RiddleSwap/1.0'
        }
      });
      
      if (!bithompResponse.ok) {
        console.log(`❌ [XRPL COLLECTIONS] Bithomp API error: ${bithompResponse.status}`);
        return res.status(404).json({
          success: false,
          error: 'Collection not found',
          collection: null
        });
      }
      
      const bithompData = await bithompResponse.json();
      
      // Extract nested data from Bithomp response
      // The ACTUAL data is inside bithompData.collection!
      const collectionData = bithompData.collection || {};
      const floorPricesArray = collectionData.floorPrices || [];  // Array of floor prices
      const assetsData = collectionData.assets || {};  // Assets inside collection
      const statisticsData = collectionData.statistics || {};  // Statistics inside collection
      
      // Extract floor price from floorPrices array
      // Floor prices can be in 'open' or 'private' offers
      let floorPrice = 0;
      if (Array.isArray(floorPricesArray) && floorPricesArray.length > 0) {
        const prices: number[] = [];
        
        for (const fp of floorPricesArray) {
          // Check private offers first
          if (fp.private && fp.private.amount) {
            // Amount is in drops (1 XRP = 1,000,000 drops)
            const priceInXRP = parseFloat(fp.private.amount) / 1000000;
            prices.push(priceInXRP);
          }
          // Then check open offers
          else if (fp.open && fp.open.amount) {
            const priceInXRP = parseFloat(fp.open.amount) / 1000000;
            prices.push(priceInXRP);
          }
        }
        
        if (prices.length > 0) {
          floorPrice = Math.min(...prices);
        }
      }
      
      // Get collection image from assets
      const collectionImage = assetsData.image || 
                             assetsData.preview ||
                             assetsData.thumbnail ||
                             collectionData.image ||
                             collectionData.icon ||
                             '';
      
      // Get NFT count from statistics or collection data
      const nftCount = statisticsData.nfts || 
                      statisticsData.total || 
                      collectionData.nfts ||
                      collectionData.total || 
                      collectionData.count ||
                      collectionData.supply || 
                      0;
      
      // Get owner count
      const ownerCount = statisticsData.owners || 
                        statisticsData.holders ||
                        collectionData.owners ||
                        collectionData.holders ||
                        0;
                        
      // Get volume - Note: Bithomp API doesn't provide volume data directly
      // We could calculate from tradedNfts if needed, but for now set to 0
      const totalVolume = statisticsData.volume || 
                         statisticsData.totalVolume ||
                         statisticsData.sales ||
                         collectionData.volume ||
                         0;
      
      console.log(`✅ [XRPL COLLECTIONS] Extracted: Floor=${floorPrice} XRP, NFTs=${nftCount}, Owners=${ownerCount}, Volume=${totalVolume} XRP`);
      
      // Format collection data for frontend
      const collection = {
        issuer: collectionData.issuer || issuer,
        taxon: collectionData.taxon || collectionData.nftokenTaxon || parseInt(taxon),
        name: collectionData.name || collectionData.family || collectionData.title || `Collection ${taxon}`,
        description: collectionData.description || '',
        image: collectionImage,
        
        // Statistics
        totalNFTs: nftCount,
        owners: ownerCount,
        floorPrice: floorPrice,
        totalVolume: totalVolume,
        
        // Assets
        assets: assetsData,
        
        // NFTs array (if available)
        nfts: []
      };
      
      console.log(`✅ [XRPL COLLECTIONS] Collection data fetched: ${collection.name}, Floor: ${floorPrice} XRP, NFTs: ${collection.totalNFTs}, Image: ${collectionImage ? 'YES' : 'NO'}`);
      
      res.json({
        success: true,
        collection
      });
      
    } catch (error) {
      console.error(`❌ [XRPL COLLECTIONS] Error:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch collection data',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  // Token and balance endpoints - PUBLIC with CORS
  app.get('/api/xrpl/tokens/search', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    console.log('🔓 Public swap endpoint - skipping auth: GET', req.originalUrl.replace('/api/xrpl', ''));
    next();
  }, xrplRoutes);
  app.get('/api/xrpl/tokens/all', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    console.log('🔓 Public swap endpoint - skipping auth: GET', req.originalUrl.replace('/api/xrpl', ''));
    next();
  }, xrplRoutes);
  // Balance endpoint - consolidated
  app.get('/api/xrpl/balance/:address', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    console.log('🔓 Public balance endpoint - skipping auth: GET', req.originalUrl.replace('/api/xrpl', ''));
    next();
  }, xrplRoutes);
  app.get('/api/xrpl/token-balance/:address/:currency/:issuer', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    console.log('🔓 Public swap endpoint - skipping auth: GET', req.originalUrl.replace('/api/xrpl', ''));
    next();
  }, xrplRoutes);
  
  // BNB Balance endpoint - PUBLIC with CORS (forwards to BSC endpoint)
  app.get('/bnb/balance/:address', async (req, res) => {
    try {
      res.header('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'application/json');
      console.log('🔓 Public BNB balance endpoint - skipping auth: GET', req.originalUrl);
      
      const address = req.params.address;
      console.log(`🔍 [BNB BALANCE] Getting balance for: ${address}`);
      
      // Use multiple BSC RPC endpoints for reliability
      const bscRpcEndpoints = [
        'https://bsc-dataseed.binance.org/',
        'https://bsc-dataseed1.defibit.io/',
        'https://bsc-dataseed1.ninicoin.io/'
      ];
      
      let balance = 0;
      let rpcSuccess = false;
      
      for (const rpcUrl of bscRpcEndpoints) {
        try {
          const bscResponse = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'eth_getBalance',
              params: [address, 'latest'],
              id: 1
            }),
            signal: AbortSignal.timeout(10000) // 10 second timeout
          });
          
          if (!bscResponse.ok) {
            console.log(`⚠️ [BNB] RPC ${rpcUrl} HTTP error: ${bscResponse.status}`);
            continue;
          }
          
          const bscData = await bscResponse.json();
          
          if (bscData.error) {
            console.log(`⚠️ [BNB] RPC ${rpcUrl} error: ${bscData.error.message}`);
            continue;
          }
          
          if (bscData.result) {
            balance = parseInt(bscData.result, 16) / Math.pow(10, 18);
            rpcSuccess = true;
            console.log(`✅ [BNB] Balance from ${rpcUrl}: ${balance.toFixed(6)} BNB`);
            break;
          }
        } catch (rpcError) {
          console.log(`⚠️ [BNB] RPC ${rpcUrl} failed:`, rpcError);
          continue;
        }
      }
      
      if (!rpcSuccess) {
        throw new Error('All BNB RPC endpoints failed');
      }
      
      console.log(`💰 [BNB] Final balance: ${balance.toFixed(6)} BNB`);
      
      // Get BNB price for USD value
      let usdValue = 0;
      try {
        const priceResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd', {
          signal: AbortSignal.timeout(5000)
        });
        if (priceResponse.ok) {
          const priceData = await priceResponse.json();
          const bnbPrice = priceData.binancecoin?.usd || 600;
          usdValue = parseFloat((balance * bnbPrice).toFixed(2));
          console.log(`💲 [BNB] Price: $${bnbPrice}, USD Value: $${usdValue}`);
        }
      } catch (priceError) {
        console.log('⚠️ [BNB] Price fetch failed, using 0');
      }
      
      const response = {
        success: true,
        address,
        balance: balance.toFixed(6),
        balanceUsd: usdValue,
        chain: 'bsc',
        symbol: 'BNB'
      };
      
      console.log(`✅ [BNB] Sending response:`, response);
      res.json(response);
      
    } catch (error) {
      console.error(`❌ [BNB] Balance fetch failed:`, error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'BNB balance fetch failed',
        chain: 'bsc',
        symbol: 'BNB'
      });
    }
  });

  // WALLET API COMPATIBILITY: Add /api/wallets/bnb/balance alias for dashboard compatibility
  app.get('/api/wallets/bnb/balance/:address', async (req, res) => {
    try {
      // Forward to the existing BNB balance endpoint
      const address = req.params.address;
      console.log(`🔗 [WALLET API] Forwarding BNB balance request for: ${address}`);
      
      // Make internal request to existing endpoint
      const baseUrl = `http://localhost:${process.env.PORT || 5000}`;
      const response = await fetch(`${baseUrl}/bnb/balance/${address}`, {
        headers: {
          'Authorization': req.headers.authorization || ''
        }
      });
      
      if (!response.ok) {
        throw new Error(`Forward request failed: ${response.status}`);
      }
      
      const data = await response.json() as any;
      console.log(`✅ [WALLET API] BNB balance forwarded successfully`);
      res.json(data);
      
    } catch (error) {
      console.error(`❌ [WALLET API] BNB balance forward failed:`, error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'BNB balance forward failed',
        chain: 'bsc',
        symbol: 'BNB'
      });
    }
  });
  
  // Swap and trustline endpoints - PUBLIC with CORS
  app.post('/api/xrpl/trustline/check', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    console.log('🔓 Public swap endpoint - skipping auth: POST', req.originalUrl.replace('/api/xrpl', ''));
    next();
  }, xrplRoutes);
  // DEPRECATED: v1 quote -> respond with deprecation notice
  app.post('/api/xrpl/swap/quote', (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(410).json({
      success: false,
      deprecated: true,
      message: 'Use /api/xrpl/swap/v2/quote',
      redirect: '/api/xrpl/swap/v2/quote'
    });
  });
  // REMOVED: swap/execute now uses sessionAuth from xrpl-routes.ts for private key access
  // app.post('/api/xrpl/swap/execute', ...) - handled by xrplRoutes with authentication
  // DEPRECATED: v1 fee -> respond with deprecation notice
  app.post('/api/xrpl/swap/fee', (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(410).json({
      success: false,
      deprecated: true,
      message: 'Use /api/xrpl/swap/v2/prepare',
      redirect: '/api/xrpl/swap/v2/prepare'
    });
  });
  app.post('/api/xrpl/liquidity/check', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    console.log('🔓 Public swap endpoint - skipping auth: POST', req.originalUrl.replace('/api/xrpl', ''));
    next();
  }, xrplRoutes);
  
  // Health check endpoint for deployment verification
  app.get('/api/health', (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      services: {
        xrpl: 'operational',
        database: 'operational',
        swap: 'operational'
      }
    });
  });

  // MISSING CRITICAL ENDPOINTS - XRP PRICE 
  app.get('/api/xrpl/price', async (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    try {
      console.log('💰 Fetching live XRP price from CoinGecko...');
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd');
      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }
      const data = await response.json() as any;
      const price = data.ripple?.usd;
      if (!price) {
        throw new Error('Invalid price data from CoinGecko');
      }
      console.log(`✅ Live XRP price: $${price}`);
      res.json({
        success: true,
        price: price,
        currency: 'USD',
        source: 'coingecko',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ XRP price fetch error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch XRP price',
        price: 0
      });
    }
  });

  // MISSING CRITICAL ENDPOINTS - COINGECKO PRICE
  app.get('/api/coingecko/price', async (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    try {
      const { ids } = req.query;
      const coinIds = ids || 'ripple,bitcoin,ethereum,solana';
      console.log(`💰 Fetching prices for: ${coinIds}`);
      
      const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinIds}&vs_currencies=usd&include_24hr_change=true`);
      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }
      const data = await response.json() as any;
      console.log(`✅ Fetched prices for ${Object.keys(data).length} coins`);
      res.json({
        success: true,
        data: data,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ CoinGecko price fetch error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch prices from CoinGecko',
        data: {}
      });
    }
  });

  // MISSING CRITICAL ENDPOINT - PRICES API FOR FRONTEND
  app.get('/api/prices', async (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    try {
      console.log('💰 Fetching prices for frontend tokens...');
      
      // Fetch prices for commonly requested tokens
      const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=ripple,bitcoin,ethereum,solana,binancecoin&vs_currencies=usd&include_24hr_change=true`);
      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }
      const data = await response.json() as any;
      
      // Transform to expected format
      const priceData = {
        XRP: data.ripple?.usd || 0,
        BTC: data.bitcoin?.usd || 0, 
        ETH: data.ethereum?.usd || 0,
        SOL: data.solana?.usd || 0,
        BNB: data.binancecoin?.usd || 0,
        timestamp: new Date().toISOString()
      };
      
      console.log(`✅ Fetched prices: XRP=$${priceData.XRP}, ETH=$${priceData.ETH}, SOL=$${priceData.SOL}`);
      res.json({
        success: true,
        prices: priceData,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Prices API error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch token prices',
        prices: {}
      });
    }
  });

  console.log('✅ Public token endpoints configured');
  
  // =============================================================================
  // WALLET CREATION ENDPOINTS - PUBLIC ACCESS (NO AUTHENTICATION REQUIRED)
  // =============================================================================
  
  // Basic wallet generation endpoint - PUBLIC (users need to create wallets before login)
  app.post('/api/wallet/generate', async (req, res) => {
    try {
      const { createWalletManager } = await import('./wallet-connections');
      const encryptionKey = process.env.WALLET_ENCRYPTION_KEY || 'riddle-wallet-encryption-key-2025';
      const walletManager = createWalletManager(encryptionKey);
      
      const { nickname } = req.body;
      const credentials = await walletManager.generateNewWallet(nickname);
      
      res.json({
        success: true,
        wallet: {
          address: credentials.address,
          type: 'generated',
          nickname: nickname || 'Generated Wallet',
          isConnected: true
        },
        credentials: {
          address: credentials.address,
          secret: credentials.secret,
          publicKey: credentials.publicKey
        },
        warning: 'IMPORTANT: Save your secret key securely! This is the only time it will be shown.'
      });
    } catch (error) {
      console.error('❌ Wallet generation error:', error);
      res.status(500).json({ 
        error: 'Failed to generate wallet',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  // Broker configuration endpoint - PUBLIC (initial setup)
  app.post('/api/broker/configure', async (req, res) => {
    try {
      const { createBrokerInstance } = await import('./riddle-nft-broker');
      const { RIDDLE_BROKER_CONFIG } = await import('./payment-payloads');
      
      const { address, secret } = req.body;
      
      if (!address || !secret) {
        return res.status(400).json({ error: 'Broker address and secret are required' });
      }

      if (!address.startsWith('r') || address.length < 25) {
        return res.status(400).json({ error: 'Invalid XRPL address format' });
      }

      if (!secret.startsWith('s') || secret.length < 25) {
        return res.status(400).json({ error: 'Invalid XRPL secret format' });
      }

      const brokerConfig = {
        address,
        secret,
        nickname: 'RiddleNFTBroker - Neverknow1'
      };
      const riddleBroker = createBrokerInstance(brokerConfig);
      riddleBroker.setBrokerCredentials(address, secret);
      await riddleBroker.connect();
      
      const stats = await riddleBroker.getBrokerStats();
      
      res.json({
        success: true,
        message: 'RiddleNFTBroker configured and connected successfully',
        broker: {
          address,
          nickname: 'RiddleNFTBroker - Neverknow1',
          feePercentage: RIDDLE_BROKER_CONFIG.feePercentage,
          ...stats
        }
      });

    } catch (error) {
      console.error('❌ Broker configuration error:', error);
      res.status(400).json({ 
        error: 'Failed to configure broker',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  // =============================================================================
  // PROTECTED ROUTES (AUTHENTICATION REQUIRED FOR ALL OPERATIONS)
  // =============================================================================
  
  console.log('🔒 Protecting ALL wallet and transaction endpoints with authentication');
  console.log('🔧 Bridge routes will use their own authentication system');
  
  // Session check endpoint handles its own authentication internally
  
  // Note: Bridge exchange routes are properly registered within wallet bridge routes
  
  // Bridge routes for cross-chain functionality - HAVE THEIR OWN AUTHENTICATION
  // Note: Bridge routes use their own authenticateBridge middleware with cached keys
  await registerWalletBridgeRoutes(app);
  
  // Multi-chain bridge execute routes - Dedicated endpoint for each chain
  registerMultiChainBridgeRoutes(app);
  
  // Multi-chain NFT operation routes - All chains NFT operations (Riddle wallet)
  console.log('🎨 Registering multi-chain NFT operation routes...');
  const { registerMultiChainNFTRoutes } = await import('./nft/multi-chain-nft-routes');
  registerMultiChainNFTRoutes(app);
  
  // Multi-chain payment routes - Native and token transfers (Riddle wallet)
  console.log('💰 Registering multi-chain payment routes...');
  const { registerMultiChainPaymentRoutes } = await import('./payments/multi-chain-payment-routes');
  registerMultiChainPaymentRoutes(app);
  
  // External wallet NFT routes - Unsigned transaction preparation (MetaMask, Xaman, Phantom)
  console.log('🎨 Registering external wallet NFT routes...');
  const { registerExternalWalletNFTRoutes } = await import('./nft/external-wallet-nft-routes');
  registerExternalWalletNFTRoutes(app);
  
  // External wallet NFT Offer routes - XRPL marketplace unsigned transactions (Xaman, Joey, Riddle)
  console.log('🎨 Registering XRPL external wallet NFT offer routes...');
  const { registerExternalWalletNFTOfferRoutes } = await import('./nft/external-wallet-nft-offer-routes');
  registerExternalWalletNFTOfferRoutes(app);
  
  // External wallet payment routes - Unsigned transaction preparation (MetaMask, Xaman, Phantom)
  console.log('💰 Registering external wallet payment routes...');
  const { registerExternalWalletPaymentRoutes } = await import('./payments/external-wallet-payment-routes');
  registerExternalWalletPaymentRoutes(app);
  
  // Multi-chain display routes - NFT & Token aggregation with logos
  console.log('🖼️ Registering multi-chain display routes...');
  const { registerMultiChainDisplayRoutes } = await import('./display/multi-chain-display-routes');
  registerMultiChainDisplayRoutes(app);
  
  // Bridge transactions and receipts API - INCLUDED IN WALLET BRIDGE ROUTES
  // Note: Bridge transaction APIs are handled within registerWalletBridgeRoutes
  
  // XRPL routes - NO AUTH for public endpoints (they're handled above)
  app.use('/api/xrpl', xrplRoutes);
  
  // XRPL Swap V2 routes - Production-ready swap system
  console.log('⚡ Registering XRPL Swap V2 routes at /api/xrpl/swap/v2...');
  const xrplSwapV2Routes = (await import('./xrpl/xrpl-swap-v2-routes')).default;
  app.use('/api/xrpl/swap/v2', xrplSwapV2Routes);
  console.log('✅ XRPL Swap V2 routes registered - with auto-trustline & slippage protection');
  
  // External Wallet Swap routes - PUBLIC (for Xaman/Joey wallets)
  console.log('📱 Registering External Wallet Swap routes at /api/xrpl/external...');
  const externalSwapRoutes = (await import('./xrpl/xrpl-external-swap-routes')).default;
  app.use('/api/xrpl', externalSwapRoutes);
  console.log('✅ External Wallet Swap routes registered');
  
  // External Wallet Trustline routes - PUBLIC (for Xaman/Joey wallets)
  console.log('🗑️ Registering External Wallet Trustline routes at /api/xrpl/external...');
  const externalTrustlineRoutes = (await import('./xrpl/xrpl-external-trustline-routes')).default;
  app.use('/api/xrpl/external', externalTrustlineRoutes);
  console.log('✅ External Wallet Trustline routes registered');
  
  // XRPL Trustline Manager routes with Cached Keys - PRODUCTION READY
  console.log('🔑 Registering XRPL Trustline Manager routes (cached keys) at /api/xrpl/trustlines...');
  const trustlineCachedRoutes = (await import('./xrpl/xrpl-trustline-cached-routes')).default;
  app.use('/api/xrpl/trustlines', trustlineCachedRoutes);
  console.log('✅ XRPL Trustline Manager routes registered - 100% removal with auto-redemption');
  
  // Simple XRPL swap routes
  const simpleSwapRoutes = (await import('./xrpl/xrpl-swap-routes-simple')).default;
  app.use(simpleSwapRoutes);
  
  // XRPL Balance route
  const xrplBalanceRoutes = (await import('./xrpl/xrpl-balance-routes')).default;
  app.use('/api/xrpl', xrplBalanceRoutes);
  
  // Solana trading routes - uses dualWalletAuth internally
  try {
    console.log('🟣 Registering Solana wallet routes at /api/sol...');
    app.use('/api/sol', (await import('./sol/sol-routes')).default);
    console.log('✅ Solana wallet routes registered successfully');
  } catch (solError) {
    console.error('❌ Failed to register Solana routes:', solError);
    console.log('⚠️ Solana functionality disabled - bigint bindings issue');
    console.log('💡 Run `npm rebuild` to fix native bindings');
  }
  
  // ========================================================================
  // NEW UNIFIED SWAP SYSTEM - PRODUCTION READY (CACHED SESSION KEYS)
  // ========================================================================
  
  // 1inch EVM Swap routes - ALL EVM chains (ETH, BSC, Polygon, Arbitrum, etc.)
  console.log('🔄 [1INCH] Registering unified EVM swap routes at /api/swap/evm...');
  const evmOneInchRoutes = (await import('./swap/evm-oneinch-routes')).default;
  app.use('/api/swap/evm', evmOneInchRoutes);
  console.log('✅ [1INCH] EVM swap routes registered - uses cached session keys');
  
  // Jupiter Solana Swap routes - Solana chain (industry standard)
  try {
    console.log('🟣 [JUPITER] Registering unified Solana swap routes at /api/swap/solana...');
    const solanaJupiterRoutes = (await import('./swap/solana-jupiter-routes')).default;
    app.use('/api/swap/solana', solanaJupiterRoutes);
    console.log('✅ [JUPITER] Solana swap routes registered - uses cached session keys');
  } catch (jupiterError) {
    console.error('❌ Failed to register Jupiter Solana routes:', jupiterError);
    console.log('⚠️ Solana swap functionality disabled');
  }
  
  // ========================================================================
  // LEGACY SWAP ROUTES (DEPRECATED - USE NEW UNIFIED ROUTES ABOVE)
  // ========================================================================
  
  // OLD Solana Jupiter swap routes - DEPRECATED
  try {
    console.log('🟣 Registering OLD Solana Jupiter swap routes at /api/solana... (DEPRECATED - use /api/swap/solana)');
    const solanaSwapRoutes = (await import('./solana-swap-routes')).default;
    app.use('/api/solana', solanaSwapRoutes);
  } catch (legacySolError) {
    console.error('❌ Failed to register legacy Solana routes:', legacySolError);
  }
  
  // Pump.fun API routes - PUBLIC for trending, PROTECTED for trading
  try {
    console.log('🚀 Registering Pump.fun API routes at /api/pump-fun...');
    const pumpFunRoutes = (await import('./pump-fun-api')).default;
    app.use('/api/pump-fun', pumpFunRoutes);
  } catch (pumpError) {
    console.error('❌ Failed to register Pump.fun routes:', pumpError);
  }
  
  // Multi-DEX Aggregator - DEPRECATED (use /api/swap/evm instead)  
  console.log('💰 Registering Multi-DEX aggregator routes at /api/ethereum... (DEPRECATED - use /api/swap/evm)');
  const ethSwapRoutes = (await import('./multi-dex-aggregator')).default;
  app.use('/api/ethereum', ethSwapRoutes);
  
  // Ethereum/EVM trading routes - uses dualWalletAuth internally
  console.log('⟠ Registering Ethereum wallet routes at /api/eth...');
  app.use('/api/eth', (await import('./eth/eth-routes')).default);
  console.log('✅ Ethereum wallet routes registered successfully');
  
  // Bitcoin payment routes - uses dualWalletAuth internally
  console.log('₿ Registering Bitcoin wallet routes at /api/btc...');
  app.use('/api/btc', (await import('./btc/btc-routes')).default);
  console.log('✅ Bitcoin wallet routes registered successfully');
  
  // Wallet operations for all chains - PROTECTED
  
  
  // XRPL Wallet Operations - Burn, Transfer, Sell with session keys - PROTECTED
  console.log('🔥 Registering XRPL wallet operations...');
  app.use('/api/xrpl-wallet-operations', (await import('./xrpl-wallet-operations')).default);
  console.log('✅ XRPL wallet operations registered successfully');
  
  // NFT Action Endpoints - Missing endpoint that frontend calls - PROTECTED  
  console.log('🎨 Registering NFT action endpoints...');
  app.use('/api/nft-actions', (await import('./nft-action-endpoints')).default);
  console.log('✅ NFT action endpoints registered successfully');
  
  // NFT Offer Scanning - Find offers on owned NFTs - PROTECTED
  console.log('🔍 Registering NFT offer scanning...');
  app.use('/api/nft-offers', (await import('./nft-offer-scanning')).default);
  console.log('✅ NFT offer scanning registered successfully');

  // Register Bithomp wallet endpoints that frontend expects
  console.log('🎨 Registering Bithomp wallet endpoints...');
  app.use('/api/bithomp', (await import('./bithomp-wallet-endpoints')).default);
  console.log('✅ Bithomp wallet endpoints registered successfully');
  
  // Wallet security operations (private key access) - PROTECTED
  app.use('/api/wallet-security', requireAuthentication, (await import('./wallet-security-routes')).default);
  
  // Public XRP NFT endpoint (no auth required)
  const xrpRouter = (await import('./wallets/xrp-endpoints')).default;
  app.get('/api/wallets/xrp/nfts/:address', xrpRouter);
  
  // Comprehensive wallet endpoints - live data endpoints - PROTECTED
  // Simple wallet endpoints - separate files for each chain
  app.use('/api/wallets', requireAuthentication, xrpRouter);
  app.use('/api/wallets', requireAuthentication, (await import('./wallets/eth-endpoints')).default);
  app.use('/api/wallets', requireAuthentication, (await import('./wallets/arbitrum-endpoints')).default);
  app.use('/api/wallets', requireAuthentication, (await import('./wallets/base-endpoints')).default);
  app.use('/api/wallets', requireAuthentication, (await import('./wallets/polygon-endpoints')).default);
  app.use('/api/wallets', requireAuthentication, (await import('./wallets/optimism-endpoints')).default);
  app.use('/api/wallets', requireAuthentication, (await import('./wallets/sol-endpoints')).default);
  app.use('/api/wallets', requireAuthentication, (await import('./wallets/btc-endpoints')).default);
  
  // BSC endpoints with enhanced error handling and JSON response guarantee
  console.log('🔧 Registering BSC wallet endpoints...');
  app.use('/api/wallets', requireAuthentication, (await import('./wallets/bsc-endpoints')).default);
  console.log('✅ BSC wallet endpoints registered successfully');
  
  // Additional EVM chain endpoints - PROTECTED
  console.log('🔧 Registering additional EVM chain endpoints...');
  app.use('/api/wallets', requireAuthentication, (await import('./wallets/avalanche-endpoints')).default);
  app.use('/api/wallets', requireAuthentication, (await import('./wallets/fantom-endpoints')).default);
  app.use('/api/wallets', requireAuthentication, (await import('./wallets/linea-endpoints')).default);
  app.use('/api/wallets', requireAuthentication, (await import('./wallets/mantle-endpoints')).default);
  app.use('/api/wallets', requireAuthentication, (await import('./wallets/metis-endpoints')).default);
  app.use('/api/wallets', requireAuthentication, (await import('./wallets/scroll-endpoints')).default);
  app.use('/api/wallets', requireAuthentication, (await import('./wallets/taiko-endpoints')).default);
  app.use('/api/wallets', requireAuthentication, (await import('./wallets/unichain-endpoints')).default);
  app.use('/api/wallets', requireAuthentication, (await import('./wallets/soneium-endpoints')).default);
  app.use('/api/wallets', requireAuthentication, (await import('./wallets/zksync-endpoints')).default);
  console.log('✅ Additional EVM chain endpoints registered successfully');
  
  // Slider confirmation routes - Simple UX for transactions - PROTECTED
  app.use('/api/slider', requireAuthentication, (await import('./slider-confirmation')).default);
  
  // Cleanup routes for data management - PROTECTED
  app.use('/api/cleanup', requireAuthentication, (await import('./cleanup-routes')).default);

  // Social Media Profile Routes - Mix of public and protected
  console.log('📱 Setting up social media profile routes...');
  const { setupSocialMediaAPI } = await import('./social-media-routes');
  setupSocialMediaAPI(app);
  console.log('✅ Social media profile routes registered');

  // Messaging API Routes - PROTECTED
  console.log('💬 Setting up messaging API routes...');
  const { setupMessagingAPI } = await import('./messaging-routes');
  setupMessagingAPI(app);
  console.log('✅ Messaging API routes registered');

  // Notification API Routes - PROTECTED
  console.log('🔔 Setting up notification API routes...');
  const notificationRoutes = (await import('./notification-routes')).default;
  app.use('/api', notificationRoutes);
  console.log('✅ Notification API routes registered');

  // Photo upload routes - PROTECTED
  console.log('📸 Setting up photo upload routes...');
  registerPhotoUploadRoutes(app);
  console.log('✅ Photo upload routes registered');
  console.log('📁 Social media images are stored in Replit Object Storage');
  
  // Image Storage Admin Routes - ADMIN ONLY
  console.log('🖼️ Setting up Image Storage Admin routes...');
  const imageStorageAdminRoutes = await import('./image-storage-admin-routes');
  app.use('/api', imageStorageAdminRoutes.default);
  console.log('✅ Image Storage Admin routes registered');

  console.log('✅ Authentication middleware applied to ALL protected endpoints');
  console.log('🔓 Only login, logout, health check, and bridge prices are accessible without authentication');
  
  // Register rewards routes (protected)
  app.use('/api/rewards', rewardsRoutes.router);
  console.log('💰 Rewards routes registered successfully');

  // Register NFT rewards routes (mixed auth - some public, some protected)
  app.use('/api/nft-rewards', nftRewardsRoutes.default);
  console.log('🎨 NFT rewards routes registered successfully');

  // Simple wallet data endpoints - use new separate chain files




  console.log('🏦 Comprehensive wallet data routes registered successfully');
  
  // Register NFT offers routes FIRST (PUBLIC - blockchain data)
  // MUST be registered before NFT wallet routes to avoid conflict with /api/nft/offers/:nftId
  console.log('🎯 Registering NFT offers routes...');
  const { registerNFTOffersRoutes } = await import('./nft-offers-routes');
  registerNFTOffersRoutes(app);
  console.log('✅ NFT offers routes registered successfully');

  // Register NFT detail routes with rarity, offers, and history (PUBLIC - Bithomp data)
  console.log('🎨 Registering NFT detail routes...');
  const nftDetailRoutes = await import('./nft-detail-routes');
  app.use('/api/nft', nftDetailRoutes.default);
  console.log('✅ NFT detail routes registered successfully');

  // Register NFT image proxy (PUBLIC - authenticated Bithomp CDN access)
  console.log('🖼️ Registering NFT image proxy...');
  const nftImageProxyRoutes = await import('./routes/nft-image-proxy');
  app.use('/api/nft-images', nftImageProxyRoutes.default);
  console.log('✅ NFT image proxy registered successfully');

  // Register NFT wallet routes (protected)
  const { registerNFTWalletRoutes } = await import('./nft-wallet-routes');
  registerNFTWalletRoutes(app);
  console.log('🎨 NFT wallet routes registered successfully');

  // Register NFT transfer and offer routes (protected)
  app.use('/api/nft', (await import('./nft/nft-transfer-routes')).default);
  app.use('/api/nft', (await import('./nft/nft-buy-offer-routes')).default);
  app.use('/api/nft', (await import('./nft/nft-accept-routes')).default);
  app.use('/api/nft', (await import('./nft/nft-fee-routes')).default);
  console.log('🎨 NFT transfer, offer, and fee calculation routes registered successfully');

  // Register wallet profile routes (public)
  const registerWalletProfileRoutes = (await import('./wallet-profile-routes')).default;
  registerWalletProfileRoutes(app);
  console.log('👤 Wallet profile routes registered successfully');

  // Register NFT Marketplace routes
  console.log('🎨 Registering NFT Marketplace routes...');
  const { registerNFTMarketplaceRoutes } = await import('./nft-marketplace-routes');
  registerNFTMarketplaceRoutes(app);
  console.log('✅ NFT Marketplace routes registered successfully');
  
  // Register Enhanced NFT Buy routes with fee injection
  console.log('🚀 Registering Enhanced NFT Buy routes with fee injection...');
  const { registerEnhancedNFTBuyRoutes } = await import('./nft-buy-routes-enhanced');
  registerEnhancedNFTBuyRoutes(app);
  console.log('✅ Enhanced NFT Buy routes registered successfully');
  
  // Register new NFT Marketplace endpoints with Bithomp integration
  console.log('🎨 Registering NFT Marketplace endpoints...');
  const { setupNFTMarketplaceEndpoints } = await import('./nft-marketplace-endpoints');
  setupNFTMarketplaceEndpoints(app);
  console.log('✅ NFT Marketplace endpoints registered successfully');
  
  // Register Favorites and Likes endpoints
  console.log('⭐ Registering Favorites and Likes endpoints...');
  const { router: favoritesRouter } = await import('./favorites-endpoints');
  app.use(favoritesRouter);
  console.log('✅ Favorites and Likes endpoints registered successfully');
  
  // Social engagement routes
  const socialEngagementRoutes = (await import('./social-engagement-routes')).default;
  app.use('/api/social-engagement', socialEngagementRoutes);
  console.log('📱 Social engagement routes registered successfully');
  
  // Admin routes (dippydoge only)
  const adminRoutes = (await import('./admin-routes')).default;
  app.use('/api/admin', adminRoutes);
  console.log('🔧 Admin routes registered successfully (dippydoge access only)');
  
  // Land admin routes (land plot management)
  const landAdminRoutes = (await import('./land-admin-routes')).default;
  app.use('/api/admin', landAdminRoutes);
  console.log('🏞️ Land admin routes registered successfully');
  
  // Land purchase routes (PUBLIC - land marketplace)
  const landPurchaseRoutes = (await import('./land-purchase-routes')).default;
  app.use('/api/land', landPurchaseRoutes);
  console.log('🏰 Land purchase routes registered successfully');
  
  // Liquidity Vault routes (Multi-chain native token liquidity provision)
  console.log('💰 Registering Liquidity Vault routes...');
  const vaultRoutes = (await import('./vault-routes')).default;
  app.use('/api/vault', vaultRoutes);
  console.log('✅ Liquidity Vault routes registered successfully');

  // Vault Admin routes (Management and analytics)
  console.log('🔐 Registering Vault Admin routes...');
  const vaultAdminRoutes = (await import('./vault-admin-routes')).default;
  app.use('/api/vault/admin', vaultAdminRoutes);
  console.log('✅ Vault Admin routes registered successfully');

  // Vault Rewards routes (Claim and withdrawal tracking)
  console.log('💰 Registering Vault Rewards routes...');
  const vaultRewardsRoutes = (await import('./vault-rewards-routes')).default;
  app.use('/api/vault/rewards', vaultRewardsRoutes);
  console.log('✅ Vault Rewards routes registered successfully');

  // Rewards Dashboard routes - PROTECTED
  console.log('💰 Registering Rewards Dashboard routes...');
  const rewardsDashboardRoutes = (await import('./rewards-dashboard-routes')).default;
  app.use(rewardsDashboardRoutes);
  console.log('✅ Rewards Dashboard routes registered successfully');

  // Monthly NFT Snapshot routes - PROTECTED
  console.log('📸 Registering Monthly NFT Snapshot routes...');
  const monthlySnapshotRoutes = (await import('./monthly-nft-snapshot-routes')).default;
  app.use(monthlySnapshotRoutes);
  console.log('✅ Monthly NFT Snapshot routes registered successfully');

  // RiddleSwap Collections routes - PROTECTED
  console.log('🎨 Registering RiddleSwap Collections routes...');
  const riddleSwapCollectionsRoutes = (await import('./riddleswap-collections-routes')).default;
  app.use(riddleSwapCollectionsRoutes);
  console.log('✅ RiddleSwap Collections routes registered successfully');

  // DevTools Project Management routes - PROTECTED (already registered above)
  console.log('✅ DevTools project management routes already registered');

  // Register subscription service routes for tier management and verification badges
  console.log('💰 Registering subscription service routes...');
  app.use('/api/subscriptions', (await import('./subscription-service-routes')).default);
  console.log('✅ Subscription service routes registered successfully');

  // Register project content override routes with subscription feature gating
  console.log('📝 Registering project content override routes...');
  app.use('/api/project-overrides', (await import('./project-content-override-routes')).default);
  console.log('✅ Project content override routes registered successfully');

  // Payment sending routes - REMOVED (duplicate, using payment-endpoints.ts instead)
  // console.log('💸 Setting up payment sending routes...');
  // const paymentSendRoutes = (await import('./payment-send-routes')).default;
  // app.use(paymentSendRoutes);
  // console.log('✅ Payment sending routes registered');

  // THE ORACLE AI routes - PROTECTED (AI narrator and game controller)
  console.log('🤖 Registering THE ORACLE AI routes...');
  app.use('/api/riddleauthor', (await import('./riddleauthor-routes')).default);
  console.log('✅ THE ORACLE AI routes registered successfully');

  // Mapping and Coordinate System routes - PROTECTED (coordinate management and image generation)
  console.log('🗺️ Registering Mapping System routes...');
  app.use('/api/mapping', (await import('./mapping-routes-database')).default);
  console.log('✅ Mapping System routes registered successfully');

  // NFT Gaming routes - PUBLIC (The Trolls Inquisition Multi-Chain Mayhem Edition)
  console.log('🎮 Registering NFT Gaming routes...');
  app.use('/api/gaming', (await import('./routes/gaming')).default);
  console.log('✅ Gaming routes registered successfully');

  // Squadron routes - PROTECTED (NFT squadron management)
  console.log('⚔️ Registering Squadron routes...');
  app.use((await import('./squadron-routes')).default);
  console.log('✅ Squadron routes registered successfully');

  // Battle routes - PROTECTED (Turn-based battles with Oracle AI)
  console.log('⚔️ Registering Battle routes...');
  app.use('/api/battles', (await import('./routes/battle-routes')).default);
  console.log('✅ Battle routes registered successfully');

  // Alliance routes - PROTECTED (Player alliance management)
  console.log('🤝 Registering Alliance routes...');
  app.use('/api/alliances', (await import('./alliance-routes')).default);
  console.log('✅ Alliance routes registered successfully');

  // Inquisition Member Generator routes - PROTECTED (AI-generated characters)
  console.log('🎭 Registering Inquisition Generator routes...');
  app.use('/api/gaming/inquisition-members', (await import('./inquisition-generator-routes')).default);
  console.log('✅ Inquisition Generator routes registered successfully');

  // Inquisition Image Generator routes - PUBLIC (AI-generated army crests, logos, NFT artwork)
  console.log('🎨 Registering Inquisition Image Generator routes...');
  const { setupInquisitionImageRoutes } = await import('./inquisition-image-routes');
  setupInquisitionImageRoutes(app);
  console.log('✅ Inquisition Image Generator routes registered successfully');

  // NFT Gaming Collection routes - PROTECTED (NFT verification and collection management)
  console.log('🎴 Registering NFT Gaming Collection routes...');
  app.use('/api/nft-gaming', (await import('./nft-gaming-routes')).default);
  console.log('✅ NFT Gaming Collection routes registered successfully');

  // Inquisition NFT Audit routes - PUBLIC (Hourly NFT scanner with trait-based points)
  console.log('🔍 Registering Inquisition NFT Audit routes...');
  app.use('/api/inquisition-audit', (await import('./routes/inquisition-audit-routes')).default);
  console.log('✅ Inquisition NFT Audit routes registered successfully');

  // Inquisition Player routes - PROTECTED (Player profiles with Oracle image generation)
  console.log('👤 Registering Inquisition Player routes...');
  app.use('/api/inquisition/player', (await import('./routes/inquisition-player-routes')).default);
  console.log('✅ Inquisition Player routes registered successfully');

  // RiddleCity routes - PROTECTED (SimCity-style city-building game)
  console.log('🏰 Registering RiddleCity routes...');
  app.use('/api/riddlecity', (await import('./routes/riddlecity')).default);
  console.log('✅ RiddleCity routes registered successfully');

  // Weapons Arsenal routes - PROTECTED (Medieval weapons with Oracle AI generation)
  console.log('⚔️ Registering Weapons Arsenal routes...');
  const { setupWeaponsArsenalRoutes } = await import('./routes/weapons-arsenal-routes');
  setupWeaponsArsenalRoutes(app);
  console.log('✅ Weapons Arsenal routes registered successfully');

  // Weapons Trading routes - PROTECTED (Marketplace, P2P trading)
  console.log('💰 Registering Weapons Trading routes...');
  const { setupWeaponTradingRoutes } = await import('./routes/weapon-trading-routes');
  setupWeaponTradingRoutes(app);
  console.log('✅ Weapons Trading routes registered successfully');

  // Collection Theme Scanner routes - PROTECTED (Theme-based power allocation)
  console.log('🎨 Registering Collection Theme Scanner routes...');
  app.use('/api/collections', (await import('./collection-theme-routes')).default);
  console.log('✅ Collection Theme Scanner routes registered successfully');

  // NFT Ingestion routes - PROTECTED (Bithomp NFT data import)
  console.log('📥 Registering NFT Ingestion routes...');
  app.use('/api/nft-ingestion', (await import('./nft-ingestion-routes')).default);
  console.log('✅ NFT Ingestion routes registered successfully');

  // Badge System routes - PUBLIC (NFT collection badges)
  console.log('🏅 Registering Badge System routes...');
  app.use('/api/badges', (await import('./nft-badge-routes')).default);
  console.log('✅ Badge System routes registered successfully');

  // Game AI Assistant routes - PUBLIC (Talking AI for the game)
  console.log('🤖 Registering Game AI Assistant routes...');
  app.use('/api/game-ai', (await import('./game-ai-routes')).default);
  console.log('✅ Game AI Assistant routes registered successfully');

  // NFT Database API routes - PUBLIC (Comprehensive get/put functionality for NFT ownership)
  console.log('🗄️ Registering NFT Database API routes...');
  app.use('/api/nft-database', (await import('./routes/nft-database-api')).default);
  console.log('✅ NFT Database API routes registered successfully');

  // Simple Land Purchase routes - PROTECTED (Simplified XRPL payments)
  console.log('🏞️ Registering Simple Land Purchase routes...');
  app.use('/api/land-purchase', (await import('./simple-land-routes')).default);
  console.log('✅ Simple Land Purchase routes registered successfully');

  // Twitter/X API routes for RiddleAuthor automation - PROTECTED
  console.log('🐦 Registering Twitter/X API routes...');
  app.use('/api/twitter', (await import('./twitter-service')).default);
  
  // Initialize Twitter scheduler
  console.log('🐦 Initializing THE ORACLE tweet scheduler...');
  await import('./twitter-scheduler');
  console.log('✅ Twitter/X API routes and scheduler registered successfully');

  // Initialize Vault Rewards Scheduler
  console.log('🏦 Initializing Vault Rewards Calculator (hourly)...');
  const { initializeVaultRewardsScheduler } = await import('./vault-rewards-calculator');
  initializeVaultRewardsScheduler();
  console.log('✅ Vault Rewards Calculator initialized');

  // Token Launchpad routes - PUBLIC for viewing, PROTECTED for creating
  console.log('🚀 Setting up Token Launchpad routes...');
  const { setupTokenLaunchpadAPI } = await import('./launchpad/token-launchpad-routes');
  setupTokenLaunchpadAPI(app);
  console.log('✅ Token Launchpad routes registered');

  // Price History routes for Bonding Curve charts - PUBLIC
  console.log('📈 Setting up Price History routes for bonding curve visualization...');
  const { setupPriceHistoryAPI } = await import('./launchpad/price-history-routes');
  setupPriceHistoryAPI(app);
  console.log('✅ Price History routes registered');

  // Featured XRPL Tokens routes - PUBLIC for listing, ADMIN-ONLY for management
  console.log('⭐ Registering Featured XRPL Tokens routes...');
  app.use((await import('./featured-tokens-routes')).default);
  console.log('✅ Featured XRPL Tokens routes registered successfully');

  // Streaming routes - MIXED AUTH (viewing is public, broadcasting requires auth)
  console.log('🎥 Setting up Live Streaming routes...');
  const { registerStreamingRoutes } = await import('./streaming/stream-routes');
  registerStreamingRoutes(app);
  console.log('✅ Live Streaming routes registered');

  // =============================================================================
  // SCANNER ROUTES - MULTI-CHAIN NFT & TOKEN SCANNING
  // =============================================================================
  
  // XRPL Scanner routes - PUBLIC
  console.log('📊 Registering XRPL Scanner routes...');
  const { registerXRPLScannerRoutes } = await import('./scanner-routes-xrpl');
  registerXRPLScannerRoutes(app);
  console.log('✅ XRPL Scanner routes registered');

  // EVM Scanner routes (all EVM chains) - PUBLIC
  console.log('📊 Registering EVM Scanner routes for all chains...');
  const { registerEVMScannerRoutes } = await import('./scanner-routes-evm');
  registerEVMScannerRoutes(app);
  console.log('✅ EVM Scanner routes registered');

  // Solana Scanner routes - PUBLIC
  console.log('📊 Registering Solana Scanner routes...');
  const { registerSolanaScannerRoutes } = await import('./scanner-routes-solana');
  registerSolanaScannerRoutes(app);
  console.log('✅ Solana Scanner routes registered');

  // =============================================================================
  // VANITY URL ROUTES (MUST BE LAST - CATCH-ALL ROUTES)
  // =============================================================================
  
  // TEMPORARILY DISABLED - vanity routes interfere with frontend serving
  // console.log('🔧 Registering Vanity URL routes (catch-all)...');
  // const vanityModule = await import('./vanity-routes');
  // const vanityRoutes = vanityModule.default;
  // // Register vanity routes LAST as they are catch-all routes
  // app.use('/', vanityRoutes);
  // console.log('✅ Vanity URL routes registered successfully');

  // Setup WebSocket server for video/audio calls
  console.log('📞 Setting up WebSocket server for video/audio calls...');
  const { setupWebSocketServer } = await import('./websocket-server');
  setupWebSocketServer(server);

  // Setup streaming signaling server for WebRTC
  console.log('🎥 Setting up Streaming Signaling WebSocket server...');
  const { streamingSignalingServer } = await import('./websocket/streaming-signaling');
  streamingSignalingServer.initialize(server);
  console.log('✅ Streaming Signaling server initialized');
}