import { Router } from 'express';
import { storage } from './storage';
import { z } from 'zod';
import { createInsertSchema } from 'drizzle-zod';
import { devtoolsProjects, chainConfigurations, devToolAirdrops, insertDevToolAirdropSchema, nftVerificationCache, insertNftVerificationCacheSchema, linkedWallets as linkedWalletsTable, externalWallets as externalWalletsTable, wallets, riddleWallets, inquisitionCollections, insertDevtoolsProjectSchema, insertChainConfigurationSchema } from '../shared/schema';
import { sessionAuth } from './middleware/session-auth';
import { readOnlyAuth } from './middleware/read-only-auth';
import crypto from 'crypto';
import { db } from './db';
import { eq, and, gte, lt, inArray } from 'drizzle-orm';

const router = Router();

// Chain templates endpoint - accessible without authentication
router.get('/chains/templates', async (req, res) => {
  try {
    const chainTemplates = [
      {
        chainId: 'xrp',
        name: 'XRP Ledger',
        networkType: 'mainnet',
        rpcEndpoints: ['wss://xrplcluster.com', 'wss://s1.ripple.com'],
        contractFields: ['Token Currency Code', 'Issuer Address']
      },
      {
        chainId: 'ethereum',
        name: 'Ethereum',
        networkType: 'mainnet',
        rpcEndpoints: ['https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY'],
        contractFields: ['ERC20 Token Address', 'NFT Contract Address', 'Custom Contract Address']
      },
      {
        chainId: 'polygon',
        name: 'Polygon',
        networkType: 'mainnet',
        rpcEndpoints: ['https://polygon-mainnet.g.alchemy.com/v2/YOUR_API_KEY'],
        contractFields: ['ERC20 Token Address', 'NFT Contract Address', 'Custom Contract Address']
      },
      {
        chainId: 'bsc',
        name: 'BNB Chain (BSC)',
        networkType: 'mainnet',
        rpcEndpoints: ['https://bsc-dataseed.binance.org'],
        contractFields: ['BEP20 Token Address', 'NFT Contract Address', 'Custom Contract Address']
      },
      {
        chainId: 'base',
        name: 'Base',
        networkType: 'mainnet',
        rpcEndpoints: ['https://mainnet.base.org'],
        contractFields: ['ERC20 Token Address', 'NFT Contract Address', 'Custom Contract Address']
      },
      {
        chainId: 'arbitrum',
        name: 'Arbitrum',
        networkType: 'layer2',
        rpcEndpoints: ['https://arb1.arbitrum.io/rpc'],
        contractFields: ['ERC20 Token Address', 'NFT Contract Address', 'Custom Contract Address']
      },
      {
        chainId: 'optimism',
        name: 'Optimism',
        networkType: 'layer2',
        rpcEndpoints: ['https://mainnet.optimism.io'],
        contractFields: ['ERC20 Token Address', 'NFT Contract Address', 'Custom Contract Address']
      },
      {
        chainId: 'solana',
        name: 'Solana',
        networkType: 'mainnet',
        rpcEndpoints: ['https://api.mainnet-beta.solana.com'],
        contractFields: ['SPL Token Address', 'NFT Collection Address', 'Program ID']
      },
      {
        chainId: 'bitcoin',
        name: 'Bitcoin',
        networkType: 'mainnet',
        rpcEndpoints: ['https://blockstream.info/api'],
        contractFields: ['Watch Address', 'Multisig Address']
      },
      {
        chainId: 'avalanche',
        name: 'Avalanche C-Chain',
        networkType: 'mainnet',
        rpcEndpoints: ['https://api.avax.network/ext/bc/C/rpc'],
        contractFields: ['ERC20 Token Address', 'NFT Contract Address', 'Custom Contract Address']
      },
      {
        chainId: 'zksync',
        name: 'zkSync Era',
        networkType: 'layer2',
        rpcEndpoints: ['https://mainnet.era.zksync.io'],
        contractFields: ['ERC20 Token Address', 'NFT Contract Address', 'Custom Contract Address']
      },
      {
        chainId: 'linea',
        name: 'Linea',
        networkType: 'layer2',
        rpcEndpoints: ['https://rpc.linea.build'],
        contractFields: ['ERC20 Token Address', 'NFT Contract Address', 'Custom Contract Address']
      },
      {
        chainId: 'taiko',
        name: 'Taiko',
        networkType: 'layer2',
        rpcEndpoints: ['https://rpc.taiko.xyz'],
        contractFields: ['ERC20 Token Address', 'NFT Contract Address', 'Custom Contract Address']
      },
      {
        chainId: 'scroll',
        name: 'Scroll',
        networkType: 'layer2',
        rpcEndpoints: ['https://rpc.scroll.io'],
        contractFields: ['ERC20 Token Address', 'NFT Contract Address', 'Custom Contract Address']
      },
      {
        chainId: 'mantle',
        name: 'Mantle',
        networkType: 'layer2',
        rpcEndpoints: ['https://rpc.mantle.xyz'],
        contractFields: ['ERC20 Token Address', 'NFT Contract Address', 'Custom Contract Address']
      },
      {
        chainId: 'metis',
        name: 'Metis',
        networkType: 'layer2',
        rpcEndpoints: ['https://andromeda.metis.io/?owner=1088'],
        contractFields: ['ERC20 Token Address', 'NFT Contract Address', 'Custom Contract Address']
      },
      {
        chainId: 'unichain',
        name: 'Unichain',
        networkType: 'testnet',
        rpcEndpoints: ['https://rpc.unichain.org'],
        contractFields: ['ERC20 Token Address', 'NFT Contract Address', 'Custom Contract Address']
      },
      {
        chainId: 'soneium',
        name: 'Soneium',
        networkType: 'testnet',
        rpcEndpoints: ['https://rpc.soneium.org'],
        contractFields: ['ERC20 Token Address', 'NFT Contract Address', 'Custom Contract Address']
      }
    ];

    res.json(chainTemplates);
  } catch (error) {
    console.error('❌ Error fetching chain templates:', error);
    res.status(500).json({ error: 'Failed to fetch chain templates' });
  }
});

// NFT Verification Service - Public endpoint for launchpad access
router.post('/nft/verify', async (req, res) => {
  try {
    const { walletAddress, collections } = req.body;
    
    if (!walletAddress || !collections || !Array.isArray(collections)) {
      return res.status(400).json({ error: 'Invalid request: wallet address and collections array required' });
    }

    // Check cache first
    const now = new Date();
    const cached = await db
      .select()
      .from(nftVerificationCache)
      .where(
        and(
          eq(nftVerificationCache.walletAddress, walletAddress),
          gte(nftVerificationCache.expiresAt, now)
        )
      )
      .limit(1);

    if (cached.length > 0) {
      console.log('🎯 [NFT VERIFY] Using cached verification for:', walletAddress);
      return res.json({
        isNftHolder: cached[0].isValid,
        verifiedCollections: cached[0].collectionAddress ? [cached[0].collectionAddress] : [],
        nftIds: cached[0].nftIds,
        cached: true
      });
    }

    // Riddle NFT Collections to check (XRPL format with taxon support)
    const riddleCollections = [
      { issuer: 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH', taxon: 0, name: 'The Inquiry' },
      { issuer: 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH', taxon: 2, name: 'The Inquisition' },
      { issuer: 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH', taxon: 4, name: 'Dantes Aurum' },
      { issuer: 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH', taxon: 9, name: 'Under the Bridge' },
      { issuer: 'rBeistBLWtUskF2YzzSwMSM2tgsK7ZD7ME', taxon: 0, name: 'Lost Emporium' },
      { issuer: 'rEVrTKUKSLx5nxdfV8SAFTxS9FGFrfHRLo', taxon: 0, name: 'Inquisition & Riddle Drop' }
    ];

    let isNftHolder = false;
    let verifiedCollections: string[] = [];
    let allNftIds: string[] = [];

    // Check each collection via XRPL API (using Bithomp)
    for (const collection of riddleCollections) {
      try {
        const response = await fetch(`https://bithomp.com/api/v2/nfts/owner/${walletAddress}?assets=true&currency=xrp&convertCurrencies=usd&sellOffers=true&buyOffers=true&offersValidate=true`);
        
        if (response.ok) {
          const data = await response.json() as any;
          
          if (data.nfts && Array.isArray(data.nfts)) {
            const collectionNfts = data.nfts.filter((nft: any) => 
              nft.issuer === collection.issuer && nft.nftokenTaxon === collection.taxon
            );
            
            if (collectionNfts.length > 0) {
              isNftHolder = true;
              verifiedCollections.push(`${collection.issuer}:${collection.taxon}`);
              allNftIds.push(...collectionNfts.map((nft: any) => nft.nftokenID || nft.tokenID));
              console.log(`✅ [NFT VERIFY] Found ${collectionNfts.length} NFTs in collection ${collection.name} (${collection.issuer}:${collection.taxon}) for ${walletAddress}`);
            }
          }
        }
      } catch (error) {
        console.error(`❌ [NFT VERIFY] Error checking collection ${collection.name}:`, error);
      }
    }

    // Cache the result for 30 minutes
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const verificationHash = crypto.createHash('sha256')
      .update(`${walletAddress}-${verifiedCollections.join(',')}-${Date.now()}`)
      .digest('hex');

    if (verifiedCollections.length > 0) {
      await db.insert(nftVerificationCache).values({
        walletAddress,
        collectionAddress: verifiedCollections[0], // Store primary collection
        nftIds: allNftIds,
        verificationHash,
        isValid: isNftHolder,
        expiresAt
      } as any);
    }

    console.log(`🎯 [NFT VERIFY] Verification complete for ${walletAddress}: ${isNftHolder ? 'VALID' : 'INVALID'}`);
    
    res.json({
      isNftHolder,
      verifiedCollections,
      nftIds: allNftIds,
      cached: false
    });

  } catch (error) {
    console.error('❌ Error in NFT verification:', error);
    res.status(500).json({ error: 'Failed to verify NFT holdings' });
  }
});

// Bonding Curve Price Calculator - Public endpoint
router.post('/bonding-curve/calculate-price', async (req, res) => {
  try {
    const { basePrice, curveCoefficient, totalInvested, fundingGoal, newInvestment } = req.body;
    
    if (!basePrice || !curveCoefficient || typeof totalInvested === 'undefined' || !fundingGoal || !newInvestment) {
      return res.status(400).json({ error: 'Missing required parameters for price calculation' });
    }

    // Bonding curve formula: price = basePrice * (1 + totalInvested/fundingGoal)^curveCoefficient
    const currentProgress = parseFloat(totalInvested) / parseFloat(fundingGoal);
    const newProgress = (parseFloat(totalInvested) + parseFloat(newInvestment)) / parseFloat(fundingGoal);
    
    const currentPrice = parseFloat(basePrice) * Math.pow(1 + currentProgress, parseFloat(curveCoefficient));
    const newPrice = parseFloat(basePrice) * Math.pow(1 + newProgress, parseFloat(curveCoefficient));
    
    // Calculate average price for the investment (area under curve)
    const priceIncrement = (newPrice - currentPrice) / 2;
    const averagePrice = currentPrice + priceIncrement;
    
    // Calculate tokens received
    const tokensReceived = parseFloat(newInvestment) / averagePrice;
    
    // Calculate market cap
    const totalSupply = parseFloat(fundingGoal) / parseFloat(basePrice); // Rough estimate
    const currentMarketCap = currentPrice * totalSupply;
    const newMarketCap = newPrice * totalSupply;

    res.json({
      currentPrice: currentPrice.toFixed(8),
      newPrice: newPrice.toFixed(8),
      averagePrice: averagePrice.toFixed(8),
      tokensReceived: tokensReceived.toFixed(8),
      currentMarketCap: currentMarketCap.toFixed(2),
      newMarketCap: newMarketCap.toFixed(2),
      progressPercentage: (newProgress * 100).toFixed(2)
    });

  } catch (error) {
    console.error('❌ Error calculating bonding curve price:', error);
    res.status(500).json({ error: 'Failed to calculate price' });
  }
});

// Clear expired NFT verification cache - Admin endpoint
router.delete('/nft/clear-cache', async (req, res) => {
  try {
    const now = new Date();
    const result = await db
      .delete(nftVerificationCache)
      .where(lt(nftVerificationCache.expiresAt, now));
    
    res.json({ 
      message: 'Expired cache entries cleared',
      cleared: result.rowCount || 0
    });
  } catch (error) {
    console.error('❌ Error clearing NFT cache:', error);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

// GET /api/devtools/all-wallets - Comprehensive wallet overview
router.get('/all-wallets', readOnlyAuth, async (req: any, res) => {
  try {
    const userHandle = req.user?.handle || req.user?.walletAddress;
    if (!userHandle) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // 1. Get Riddle wallet (main wallet)
    const riddleWallet = await storage.getRiddleWalletByHandle(userHandle);

    // 2. Get all linked wallets (permanently linked external wallets)
    const linkedWallets = await db
      .select()
      .from(linkedWalletsTable)
      .where(eq(linkedWalletsTable.user_id, userHandle));

    // 3. Get all external wallets (session-only)
    const sessionId = req.session?.user?.sessionToken || req.headers.authorization?.replace('Bearer ', '');
    const externalWallets = sessionId ? await db
      .select()
      .from(externalWalletsTable)
      .where(eq(externalWalletsTable.user_id, sessionId)) : [];

    // 4. Get all wallet addresses to search for projects
    const allAddresses: string[] = [];
    
    if (riddleWallet) {
      if (riddleWallet.xrpAddress) allAddresses.push(riddleWallet.xrpAddress);
      if (riddleWallet.ethAddress) allAddresses.push(riddleWallet.ethAddress);
      if (riddleWallet.solAddress) allAddresses.push(riddleWallet.solAddress);
      if (riddleWallet.btcAddress) allAddresses.push(riddleWallet.btcAddress);
    }
    
    linkedWallets.forEach(w => allAddresses.push(w.address));
    externalWallets.forEach(w => allAddresses.push(w.address));

    // 5. Get projects owned by any of these addresses
    const projects = allAddresses.length > 0 ? await db
      .select()
      .from(devtoolsProjects)
      .where(inArray(devtoolsProjects.ownerWalletAddress, allAddresses)) : [];

    // 6. Get wallet-project links (if table exists, handle gracefully)
    let walletProjectLinks: any[] = [];
    try {
      const { walletProjectLinks: wplTable } = await import('@shared/schema');
      walletProjectLinks = allAddresses.length > 0 ? await db
        .select()
        .from(wplTable)
        .where(inArray(wplTable.walletAddress, allAddresses)) : [];
    } catch (error) {
      console.log('Wallet project links table not available');
    }

    res.json({
      riddleWallet: riddleWallet ? {
        handle: riddleWallet.handle,
        xrpAddress: riddleWallet.xrpAddress,
        ethAddress: riddleWallet.ethAddress,
        solAddress: riddleWallet.solAddress,
        btcAddress: riddleWallet.btcAddress,
        createdAt: riddleWallet.createdAt
      } : null,
      linkedWallets: linkedWallets.map(w => ({
        id: w.id,
        address: w.address,
        chain: w.chain,
        wallet_type: w.wallet_type,
        verified: w.verified,
        source: w.source,
        created_at: w.created_at,
        wallet_label: w.wallet_label
      })),
      externalWallets: externalWallets.map(w => ({
        id: w.id,
        address: w.address,
        chain: w.chain,
        wallet_type: w.wallet_type,
        verified: w.verified,
        connected_at: w.connected_at
      })),
      projects: projects || [],
      walletProjectLinks: walletProjectLinks || [],
      summary: {
        total_wallets: 1 + linkedWallets.length + externalWallets.length,
        riddle_wallet: riddleWallet ? 1 : 0,
        linked_wallets: linkedWallets.length,
        external_wallets: externalWallets.length,
        total_projects: projects?.length || 0,
        linked_projects: walletProjectLinks?.length || 0
      }
    });
  } catch (error) {
    console.error('❌ Error fetching all wallets:', error);
    res.status(500).json({ error: 'Failed to fetch wallets data' });
  }
});

// Project creation/management schemas (reuse shared insert schemas to avoid duplicate omit typing issues)
const createProjectSchema = insertDevtoolsProjectSchema;
const createChainConfigSchema = insertChainConfigurationSchema;

// Get user's DevTools projects
router.get('/projects', readOnlyAuth, async (req: any, res) => {
  try {
    // Get user from authenticated session
    const userHandle = req.session?.userHandle;
    if (!userHandle) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Get all wallet addresses for this user (Riddle + connected external wallets)
    const walletAddresses: string[] = [];
    
    // 1. Get Riddle wallet address for this user - query database directly
    try {
      const [riddleWallet] = await db.select().from(riddleWallets).where(eq(riddleWallets.handle, userHandle)).limit(1);
      if (riddleWallet?.xrpAddress) {
        walletAddresses.push(riddleWallet.xrpAddress);
      }
      if (riddleWallet?.ethAddress) {
        walletAddresses.push(riddleWallet.ethAddress);
      }
      if (riddleWallet?.solAddress) {
        walletAddresses.push(riddleWallet.solAddress);
      }
      if (riddleWallet?.btcAddress) {
        walletAddresses.push(riddleWallet.btcAddress);
      }
    } catch (e) {
      console.log('No Riddle wallet for user:', userHandle);
    }
    
    // 2. Get all linked/connected external wallets for this user
    try {
      const linkedWallets = await storage.listLinkedWallets(userHandle);
      if (linkedWallets && linkedWallets.length > 0) {
        linkedWallets.forEach((wallet: any) => {
          if (wallet.address && !walletAddresses.includes(wallet.address)) {
            walletAddresses.push(wallet.address);
          }
        });
      }
    } catch (e) {
      console.log('No linked wallets for user:', userHandle);
    }

    if (walletAddresses.length === 0) {
      return res.json([]);
    }

    // 3. Fetch projects from ALL wallet addresses
    const allProjects = [];
    for (const address of walletAddresses) {
      const projects = await storage.getDevtoolsProjectsByOwner(address);
      if (projects && projects.length > 0) {
        allProjects.push(...projects);
      }
    }

    // 4. Also fetch NFT collections from inquisition_collections table
    let nftCollectionsCount = 0;
    try {
      const nftCollections = await db.select().from(inquisitionCollections).where(inArray(inquisitionCollections.issuer_address, walletAddresses));
      
      // Transform NFT collections to project format
      if (nftCollections && nftCollections.length > 0) {
        nftCollectionsCount = nftCollections.length;
        const collectionsAsProjects = nftCollections.map(collection => ({
          id: `inquisition-${collection.id}`,
          name: collection.collection_name,
          description: `NFT Collection - ${collection.collection_name} (Taxon: ${collection.taxon})`,
          ownerWalletAddress: collection.issuer_address,
          projectType: 'nft_collection' as const,
          status: 'active' as const,
          createdAt: collection.created_at,
          updatedAt: collection.updated_at,
          logoUrl: null,
          bannerUrl: null,
          websiteUrl: null,
          socialLinks: {},
          supportedChains: ['xrpl'],
          subscriptionTier: 'free' as const,
          subscriptionStatus: 'active' as const,
          vanitySlug: null,
          claimStatus: 'claimed' as const,
          isPublic: true,
          // Add collection-specific metadata
          metadata: {
            source: 'inquisition_collections',
            taxon: collection.taxon,
            expected_supply: collection.expected_supply,
            actual_supply: collection.actual_supply,
            game_role: collection.game_role
          }
        }));
        allProjects.push(...collectionsAsProjects);
      }
    } catch (e) {
      console.log('Error fetching inquisition collections:', e);
    }

    // Remove duplicates and apply priority sorting:
    // 1. Claimed projects (claim_status === 'claimed' OR claimStatus === 'claimed')
    // 2. Override enabled projects (override_bithomp_responses === true)
    // 3. Newest first (createdAt descending)
    // 4. Fallback to name alphabetical
    const uniqueProjects = Array.from(new Map(allProjects.map(p => [p.id, p])).values())
      .sort((a: any, b: any) => {
        const aClaimed = (a.claim_status === 'claimed' || a.claimStatus === 'claimed') ? 1 : 0;
        const bClaimed = (b.claim_status === 'claimed' || b.claimStatus === 'claimed') ? 1 : 0;
        if (bClaimed !== aClaimed) return bClaimed - aClaimed;

        const aOverride = a.override_bithomp_responses === true ? 1 : 0;
        const bOverride = b.override_bithomp_responses === true ? 1 : 0;
        if (bOverride !== aOverride) return bOverride - aOverride;

        const aCreated = a.createdAt || a.created_at;
        const bCreated = b.createdAt || b.created_at;
        const aTime = aCreated ? new Date(aCreated).getTime() : 0;
        const bTime = bCreated ? new Date(bCreated).getTime() : 0;
        if (bTime !== aTime) return bTime - aTime; // newer first

        const aName = (a.name || '').toLowerCase();
        const bName = (b.name || '').toLowerCase();
        if (aName < bName) return -1;
        if (aName > bName) return 1;
        return 0;
      });

    console.log(`✅ Found ${uniqueProjects.length} projects for user ${userHandle} across ${walletAddresses.length} wallets (including ${nftCollectionsCount} NFT collections)`);
    res.json(uniqueProjects);
  } catch (error) {
    console.error('❌ Error fetching DevTools projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Create new DevTools project
router.post('/projects', sessionAuth, async (req: any, res) => {
  try {
    const userHandle = req.session?.userHandle;
    if (!userHandle) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Get user's primary wallet address (Riddle wallet XRPL address) - query database directly
    const [riddleWallet] = await db.select().from(riddleWallets).where(eq(riddleWallets.handle, userHandle)).limit(1);
    const userWallet = riddleWallet?.xrpAddress;
    
    if (!userWallet) {
      return res.status(400).json({ error: 'No wallet address found. Please create a Riddle wallet first.' });
    }

    // Validate request body
    const validatedData = createProjectSchema.parse({
      ...req.body,
      ownerWalletAddress: userWallet,
      // Set status based on project type
      status: req.body.projectType === 'launchpad' ? 'pending_verification' : 'active'
    });

    const project = await storage.createDevtoolsProject(validatedData);
    
    // If chain configurations are provided, create them
    if (req.body.chainConfigurations && Array.isArray(req.body.chainConfigurations)) {
      for (const chainConfig of req.body.chainConfigurations) {
        await storage.createChainConfiguration({
          ...chainConfig,
          projectId: project.id
        });
      }
    }

    // If launchpad project, create verification queue entry
    if (req.body.projectType === 'launchpad' && req.body.paymentCompleted) {
      await storage.createLaunchpadVerification({
        projectId: project.id,
        status: 'pending',
        submittedAt: new Date(),
        paymentTxHash: req.body.paymentTxHash || '',
        paymentChain: req.body.paymentChain || '',
        paymentAmount: req.body.paymentAmount || '50'
      });
    }
    
    res.status(201).json(project);
  } catch (error) {
    console.error('❌ Error creating DevTools project:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid project data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Get specific project details
router.get('/projects/:id', readOnlyAuth, async (req, res) => {
  try {
    const project = await storage.getDevtoolsProject(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get chain configurations for this project
    const chainConfigs = await storage.getChainConfigurationsByProject(project.id);
    
    res.json({
      ...project,
      chainConfigurations: chainConfigs
    });
  } catch (error) {
    console.error('❌ Error fetching project details:', error);
    res.status(500).json({ error: 'Failed to fetch project details' });
  }
});

// Get project by vanity URL (public endpoint - no auth required)
router.get('/projects/vanity/:vanityUrl', async (req, res) => {
  try {
    const { vanityUrl } = req.params;
    
    // Get project by vanity_slug
    const project = await storage.getProjectByVanitySlug(vanityUrl);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if project is verified/claimed
    const verified = project.claim_status === 'claimed';
    
    res.json({
      id: project.id,
      name: project.name,
      description: project.description,
      logo_url: project.logo_url,
      banner_url: project.banner_url,
      website_url: project.website_url,
      social_links: project.social_links || {},
      issuer_wallet: project.issuer_wallet,
      nft_token_taxon: project.nft_token_taxon,
      asset_type: project.asset_type,
      claim_status: project.claim_status,
      verified,
      vanity_slug: project.vanity_slug,
    });
  } catch (error) {
    console.error('❌ Error fetching project by vanity URL:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// Update project
router.patch('/projects/:id', sessionAuth, async (req: any, res) => {
  try {
    const userWallet = req.user?.walletAddress;
    if (!userWallet) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Check if user owns this project
    const project = await storage.getDevtoolsProject(req.params.id);
    if (!project || project.ownerWalletAddress !== userWallet) {
      return res.status(404).json({ error: 'Project not found or access denied' });
    }

    const updatedProject = await storage.updateDevtoolsProject(req.params.id, req.body);
    res.json(updatedProject);
  } catch (error) {
    console.error('❌ Error updating project:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// Delete project
router.delete('/projects/:id', sessionAuth, async (req: any, res) => {
  try {
    const userWallet = req.user?.walletAddress;
    if (!userWallet) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Check if user owns this project
    const project = await storage.getDevtoolsProject(req.params.id);
    if (!project || project.ownerWalletAddress !== userWallet) {
      return res.status(404).json({ error: 'Project not found or access denied' });
    }

    await storage.deleteDevtoolsProject(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// Chain configuration endpoints
router.post('/projects/:id/chains', sessionAuth, async (req: any, res) => {
  try {
    const userWallet = req.user?.walletAddress;
    if (!userWallet) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Check if user owns this project
    const project = await storage.getDevtoolsProject(req.params.id);
    if (!project || project.ownerWalletAddress !== userWallet) {
      return res.status(404).json({ error: 'Project not found or access denied' });
    }

    const validatedData = createChainConfigSchema.parse({
      ...req.body,
      projectId: req.params.id
    });

    const chainConfig = await storage.createChainConfiguration(validatedData);
    res.status(201).json(chainConfig);
  } catch (error) {
    console.error('❌ Error creating chain configuration:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid chain configuration data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create chain configuration' });
  }
});

router.get('/projects/:id/chains', readOnlyAuth, async (req: any, res) => {
  try {
    const userWallet = req.user?.walletAddress;
    if (!userWallet) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Check if user owns this project
    const project = await storage.getDevtoolsProject(req.params.id);
    if (!project || project.ownerWalletAddress !== userWallet) {
      return res.status(404).json({ error: 'Project not found or access denied' });
    }

    const chainConfigs = await storage.getChainConfigurationsByProject(req.params.id);
    res.json(chainConfigs);
  } catch (error) {
    console.error('❌ Error fetching chain configurations:', error);
    res.status(500).json({ error: 'Failed to fetch chain configurations' });
  }
});

// Project subscription management
router.get('/projects/:id/subscription', readOnlyAuth, async (req: any, res) => {
  try {
    const userWallet = req.user?.walletAddress;
    if (!userWallet) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Check if user owns this project
    const project = await storage.getDevtoolsProject(req.params.id);
    if (!project || project.ownerWalletAddress !== userWallet) {
      return res.status(404).json({ error: 'Project not found or access denied' });
    }

    const subscription = await storage.getProjectSubscription(req.params.id);
    res.json(subscription);
  } catch (error) {
    console.error('❌ Error fetching project subscription:', error);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

// Get launchpad projects pending verification (admin only)
router.get('/launchpad/verification-queue', sessionAuth, async (req: any, res) => {
  try {
    const userWallet = req.user?.walletAddress;
    // Check if user is admin (you can customize this check)
    if (userWallet !== 'admin-wallet-address') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const pendingProjects = await storage.getLaunchpadVerificationQueue();
    res.json(pendingProjects);
  } catch (error) {
    console.error('❌ Error fetching verification queue:', error);
    res.status(500).json({ error: 'Failed to fetch verification queue' });
  }
});

// Approve launchpad project (admin only)
router.post('/launchpad/:projectId/approve', sessionAuth, async (req: any, res) => {
  try {
    const userWallet = req.user?.walletAddress;
    if (userWallet !== 'admin-wallet-address') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { projectId } = req.params;
    const { fundingTarget, tokenAllocationPercentage } = req.body;
    
    // Update project status to active
    await storage.updateDevtoolsProject(projectId, {
      status: 'active'
    });
    
    // Update verification queue
    await storage.updateLaunchpadVerification(projectId, {
      status: 'approved',
      reviewedAt: new Date(),
      reviewedBy: userWallet
    });
    
    res.json({ success: true, message: 'Project approved for launchpad' });
  } catch (error) {
    console.error('❌ Error approving project:', error);
    res.status(500).json({ error: 'Failed to approve project' });
  }
});

// Graduate launchpad project to full project
router.post('/launchpad/:projectId/graduate', sessionAuth, async (req: any, res) => {
  try {
    const { projectId } = req.params;
    const { holdingWalletAddress, totalFunding } = req.body;
    
    // Check if project has met funding target
    const project = await storage.getDevtoolsProject(projectId);
    if (!project || project.projectType !== 'launchpad') {
      return res.status(404).json({ error: 'Launchpad project not found' });
    }
    
    // Update project to graduated status
    await storage.updateDevtoolsProject(projectId, {
      status: 'graduated'
    });
    
    res.json({ 
      success: true, 
      message: 'Project graduated to full project',
      holdingWallet: holdingWalletAddress 
    });
  } catch (error) {
    console.error('❌ Error graduating project:', error);
    res.status(500).json({ error: 'Failed to graduate project' });
  }
});

// Get active launchpad projects (public endpoint)
router.get('/launchpad/active', async (req, res) => {
  try {
    // Fetch active launchpad projects from storage
    const projects = await storage.getActiveLaunchpadProjects();
    
    // Transform projects for frontend
    const activeProjects = projects.map(project => ({
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      fundingTarget: 100000,
      currentFunding: Math.random() * 80000,
      tokenAllocationPercentage: 20,
      deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      participantCount: Math.floor(Math.random() * 500),
      minimumContribution: 50,
      maximumContribution: 5000,
      tokenSymbol: 'TOKEN',
      tokenSupply: 1000000
    }));
    
    res.json(activeProjects);
  } catch (error) {
    console.error('❌ Error fetching active launchpad projects:', error);
    res.status(500).json({ error: 'Failed to fetch active projects' });
  }
});

// Contribute to launchpad project
router.post('/launchpad/:projectId/contribute', sessionAuth, async (req: any, res) => {
  try {
    const { projectId } = req.params;
    const { amount, paymentChain } = req.body;
    const userWallet = req.user?.walletAddress;
    
    if (!userWallet) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    // Record contribution
    const contribution = await storage.createLaunchpadContribution({
      projectId,
      contributorWallet: userWallet,
      amount,
      paymentChain,
      transactionHash: req.body.transactionHash,
      status: 'pending'
    });
    
    // Update project funding
    await storage.updateLaunchpadFunding(projectId, amount);
    
    res.json({ success: true, contribution });
  } catch (error) {
    console.error('❌ Error processing contribution:', error);
    res.status(500).json({ error: 'Failed to process contribution' });
  }
});

// Chains/templates route is now defined at the top before authentication

// Subscription management with crypto payments
router.post('/subscriptions', sessionAuth, async (req: any, res) => {
  try {
    const userWallet = req.user?.walletAddress;
    if (!userWallet) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { planId, paymentMethod, cryptoAmount } = req.body;
    
    // Validate plan
    const validPlans = ['bronze', 'gold'];
    if (!validPlans.includes(planId)) {
      return res.status(400).json({ error: 'Invalid subscription plan' });
    }

    const planDetails = {
      bronze: { price: 199.99, name: 'Bronze Plan' },
      gold: { price: 499.99, name: 'Gold Plan' }
    };

    // Create subscription record
    const subscription = await storage.createProjectSubscription({
      projectId: req.body.projectId || `default-${userWallet}`,
      planType: planId,
      planPrice: planDetails[planId as keyof typeof planDetails].price.toFixed(2),
      billingCycle: 'monthly',
      status: 'pending_payment',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    });

    // Create billing record for crypto payment
    await storage.createProjectBilling({
      projectId: subscription.projectId,
      subscriptionId: subscription.id,
      amount: planDetails[planId as keyof typeof planDetails].price.toFixed(2),
      currency: 'USD',
      paymentMethod: `crypto_${paymentMethod}`,
      paymentStatus: 'pending',
      billingPeriodStart: new Date(),
      billingPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    res.status(201).json({
      subscription,
      paymentInstructions: {
        method: paymentMethod,
        amount: cryptoAmount,
        walletAddress: getPaymentWalletAddress(paymentMethod),
        message: `DevTools ${planDetails[planId as keyof typeof planDetails].name} - ${userWallet}`
      }
    });
  } catch (error) {
    console.error('❌ Error creating subscription:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

// Get subscription status
router.get('/subscriptions/status', readOnlyAuth, async (req: any, res) => {
  try {
    const userWallet = req.user?.walletAddress;
    if (!userWallet) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Find user's active subscriptions
    const projects = await storage.getDevtoolsProjectsByOwner(userWallet);
    const subscriptions = [];
    
    for (const project of projects) {
      const subscription = await storage.getProjectSubscription(project.id);
      if (subscription) {
        subscriptions.push({
          project,
          subscription
        });
      }
    }

    res.json(subscriptions);
  } catch (error) {
    console.error('❌ Error fetching subscription status:', error);
    res.status(500).json({ error: 'Failed to fetch subscription status' });
  }
});

// Confirm payment and activate subscription
router.post('/subscriptions/:id/confirm-payment', sessionAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { transactionHash } = req.body;

    if (!transactionHash) {
      return res.status(400).json({ error: 'Transaction hash is required' });
    }

    // Update subscription status to active
    const updatedSubscription = await storage.updateProjectSubscription(id, {
      status: 'active',
      lastPaymentDate: new Date(),
      nextPaymentDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    });

    // Create billing record with transaction hash
    await storage.createProjectBilling({
      projectId: id,
      amount: '50.00',
      currency: 'USD',
      paymentMethod: 'crypto',
      billingPeriodStart: new Date(),
      billingPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      transactionHash,
      paymentStatus: 'completed',
    });

    res.json({
      success: true,
      subscription: updatedSubscription,
      message: 'Subscription activated successfully'
    });
  } catch (error) {
    console.error('❌ Error confirming payment:', error);
    res.status(500).json({ error: 'Failed to confirm payment' });
  }
});

// Cancel subscription
router.post('/subscriptions/:id/cancel', sessionAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    
    const updatedSubscription = await storage.updateProjectSubscription(id, {
      status: 'cancelled',
      cancelAt: new Date(),
    });

    res.json({
      success: true,
      subscription: updatedSubscription,
      message: 'Subscription cancelled successfully'
    });
  } catch (error) {
    console.error('❌ Error cancelling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// Helper function to get payment wallet addresses
function getPaymentWalletAddress(cryptoType: string): string {
  const paymentWallets = {
    XRP: 'rRiddlePayment1234567890ABCDEFGHIJK',
    ETH: '0x742d35Cc6634C0532925a3b8D33DD96e11811fb2',
    BTC: 'bc1qriddlepayment1234567890abcdefghijk',
    SOL: 'RiddlePayment1234567890ABCDEFGHIJKLMNOP'
  };
  
  return paymentWallets[cryptoType as keyof typeof paymentWallets] || '';
}

// ==============================================
// COMPREHENSIVE MULTI-CHAIN AIRDROP ENDPOINTS
// ==============================================

// Enhanced airdrop schema for comprehensive functionality
// Extended comprehensive airdrop schema adds runtime-only fields; keep original DB column names intact.
const comprehensiveAirdropSchema = insertDevToolAirdropSchema.extend({
  distribution_method: z.enum(['immediate', 'claimable', 'scheduled']).optional(),
  gas_optimization: z.boolean().default(true).optional(),
  merkle_tree: z.boolean().default(false).optional(),
  recipients: z.array(z.object({
    address: z.string(),
    amount: z.string(),
    claimed: z.boolean().optional(),
    txHash: z.string().optional()
  })).optional(),
  chain_id: z.union([z.number(), z.string()]).optional(),
  total_amount: z.string().optional(),
  recipient_count: z.number().optional(),
  estimated_gas: z.string().optional()
});

// Chain configurations for gas estimation and validation
const chainConfigs = {
  ethereum: { chainId: 1, gasPrice: 20, symbol: 'ETH', decimals: 18 },
  bsc: { chainId: 56, gasPrice: 5, symbol: 'BNB', decimals: 18 },
  polygon: { chainId: 137, gasPrice: 30, symbol: 'MATIC', decimals: 18 },
  base: { chainId: 8453, gasPrice: 0.1, symbol: 'ETH', decimals: 18 },
  arbitrum: { chainId: 42161, gasPrice: 0.1, symbol: 'ETH', decimals: 18 },
  optimism: { chainId: 10, gasPrice: 0.1, symbol: 'ETH', decimals: 18 },
  solana: { chainId: 'solana-mainnet', gasPrice: 0.000005, symbol: 'SOL', decimals: 9 },
  xrpl: { chainId: 'xrpl-mainnet', gasPrice: 0.00001, symbol: 'XRP', decimals: 6 },
  bitcoin: { chainId: 'bitcoin-mainnet', gasPrice: 50, symbol: 'BTC', decimals: 8 }
};

// Create comprehensive airdrop
router.post('/airdrops/comprehensive', sessionAuth, async (req: any, res) => {
  try {
    const userWallet = req.user?.walletAddress;
    if (!userWallet) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Validate and parse request data
    const validatedData: any = comprehensiveAirdropSchema.parse(req.body) as any;
    
  // Access chain from validated data; fall back to provided chain_id or request body
  const chainValue: any = (validatedData as any).chain || (validatedData as any).chain_id || req.body.chain;
  const chainConfig = chainConfigs[chainValue as keyof typeof chainConfigs];
    if (!chainConfig) {
      return res.status(400).json({ error: 'Unsupported blockchain' });
    }

    // Generate merkle tree if requested
    let merkleRoot = null;
    if (validatedData.merkle_tree && validatedData.distribution_method === 'claimable') {
      merkleRoot = generateMerkleRoot(validatedData.recipients);
    }

    // Prepare airdrop data for storage
    const airdropData: any = {
      creator_address: userWallet,
      riddle_wallet_handle: req.user?.handle,
      chain: chainValue,
      airdrop_type: (validatedData as any).airdrop_type,
      token_contract: (validatedData as any).token_contract,
      amount_per_address: (validatedData as any).amount_per_address,
      total_recipients: (validatedData as any).recipient_count,
      recipients: (validatedData as any).recipients,
      claim_enabled: (validatedData as any).claim_enabled,
      merkle_root: merkleRoot,
  start_date: (validatedData as any).start_date ? new Date((validatedData as any).start_date) : null,
  end_date: (validatedData as any).end_date ? new Date((validatedData as any).end_date) : null,
      total_claimed: 0,
      status: (validatedData as any).distribution_method === 'immediate' ? 'active' : 'draft'
    };

    // Create airdrop in database
    const createdAirdrop = await storage.createDevToolAirdrop(airdropData);

    // Calculate estimated costs
  const gasEstimate = calculateGasCosts(chainValue, ((validatedData as any).recipients || []).length, (validatedData as any).airdrop_type);
    
    res.status(201).json({
      success: true,
      airdrop_id: createdAirdrop.id,
      airdrop: createdAirdrop,
      gas_estimate: gasEstimate,
      merkle_root: merkleRoot,
      distribution_method: validatedData.distribution_method,
      message: `Successfully created ${(validatedData as any).distribution_method} airdrop for ${(validatedData as any).recipient_count} recipients on ${String(chainValue).toUpperCase()}`
    });
  } catch (error) {
    console.error('❌ Error creating comprehensive airdrop:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid airdrop data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create comprehensive airdrop' });
  }
});

// Get user's airdrops
router.get('/airdrops', readOnlyAuth, async (req: any, res) => {
  try {
    const userWallet = req.user?.walletAddress;
    if (!userWallet) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const airdrops = await storage.getDevToolAirdropsByCreator(userWallet);
    
    // Transform airdrops for frontend with additional stats
    const enrichedAirdrops = airdrops.map(airdrop => ({
      ...airdrop,
      progress: (airdrop.total_recipients || 0) > 0 ? ((airdrop.total_claimed || 0) / (airdrop.total_recipients || 0)) * 100 : 0,
      remaining_claims: (airdrop.total_recipients || 0) - (airdrop.total_claimed || 0),
      chain_info: chainConfigs[airdrop.chain as keyof typeof chainConfigs],
      estimated_value: calculateAirdropValue(airdrop)
    }));

    res.json({
      success: true,
      airdrops: enrichedAirdrops,
      total_count: airdrops.length,
      active_count: airdrops.filter(a => a.status === 'active').length,
      completed_count: airdrops.filter(a => a.status === 'completed').length
    });
  } catch (error) {
    console.error('❌ Error fetching user airdrops:', error);
    res.status(500).json({ error: 'Failed to fetch airdrops' });
  }
});

// Get specific airdrop details
router.get('/airdrops/:id', readOnlyAuth, async (req: any, res) => {
  try {
    const userWallet = req.user?.walletAddress;
    if (!userWallet) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const airdrop = await storage.getDevToolAirdrop(req.params.id);
    if (!airdrop) {
      return res.status(404).json({ error: 'Airdrop not found' });
    }

    // Check if user owns this airdrop
    if (airdrop.creator_address !== userWallet) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Add detailed analytics
    const recipients = Array.isArray(airdrop.recipients) ? airdrop.recipients : [];
    const claimedCount = recipients.filter((r: any) => r.claimed).length;
    const unclaimedCount = recipients.length - claimedCount;
    
    const detailedAirdrop = {
      ...airdrop,
      analytics: {
        total_recipients: recipients.length,
        claimed_count: claimedCount,
        unclaimed_count: unclaimedCount,
        claim_rate: recipients.length > 0 ? (claimedCount / recipients.length) * 100 : 0,
        estimated_value: calculateAirdropValue(airdrop),
        chain_info: chainConfigs[airdrop.chain as keyof typeof chainConfigs]
      },
      recipients_sample: recipients.slice(0, 20) // First 20 for preview
    };

    res.json({
      success: true,
      airdrop: detailedAirdrop
    });
  } catch (error) {
    console.error('❌ Error fetching airdrop details:', error);
    res.status(500).json({ error: 'Failed to fetch airdrop details' });
  }
});

// Gas estimation endpoint
router.post('/airdrops/gas-estimate', sessionAuth, async (req: any, res) => {
  try {
    const { chain, airdrop_type, recipient_count, amount_per_address } = req.body;
    
    if (!chain || !airdrop_type || !recipient_count) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const chainConfig = chainConfigs[chain as keyof typeof chainConfigs];
    if (!chainConfig) {
      return res.status(400).json({ error: 'Unsupported blockchain' });
    }

    const gasEstimate = calculateGasCosts(chain, recipient_count, airdrop_type);
    
    res.json({
      success: true,
      chain,
      airdrop_type,
      recipient_count,
      gas_estimate: gasEstimate,
      estimated_cost_usd: gasEstimate.total_cost_usd,
      recommendations: getGasOptimizationRecommendations(chain, recipient_count, airdrop_type)
    });
  } catch (error) {
    console.error('❌ Error calculating gas estimate:', error);
    res.status(500).json({ error: 'Failed to calculate gas estimate' });
  }
});

// Generate merkle tree for claimable airdrops
router.post('/airdrops/merkle-tree', sessionAuth, async (req: any, res) => {
  try {
    const { recipients } = req.body;
    
    if (!recipients || !Array.isArray(recipients)) {
      return res.status(400).json({ error: 'Recipients array is required' });
    }

    const merkleRoot = generateMerkleRoot(recipients);
    const merkleProofs = generateMerkleProofs(recipients);
    
    res.json({
      success: true,
      merkle_root: merkleRoot,
      merkle_proofs: merkleProofs,
      recipient_count: recipients.length,
      message: 'Merkle tree generated successfully'
    });
  } catch (error) {
    console.error('❌ Error generating merkle tree:', error);
    res.status(500).json({ error: 'Failed to generate merkle tree' });
  }
});

// Update airdrop status
router.patch('/airdrops/:id', sessionAuth, async (req: any, res) => {
  try {
    const userWallet = req.user?.walletAddress;
    if (!userWallet) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const airdrop = await storage.getDevToolAirdrop(req.params.id);
    if (!airdrop) {
      return res.status(404).json({ error: 'Airdrop not found' });
    }

    if (airdrop.creator_address !== userWallet) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updatedAirdrop = await storage.updateDevToolAirdrop(req.params.id, req.body);
    
    res.json({
      success: true,
      airdrop: updatedAirdrop,
      message: 'Airdrop updated successfully'
    });
  } catch (error) {
    console.error('❌ Error updating airdrop:', error);
    res.status(500).json({ error: 'Failed to update airdrop' });
  }
});

// Claim from airdrop (for claimable airdrops)
router.post('/airdrops/:id/claim', sessionAuth, async (req: any, res) => {
  try {
    const { address, proof } = req.body;
    
    if (!address) {
      return res.status(400).json({ error: 'Wallet address is required' });
    }

    const airdrop = await storage.getDevToolAirdrop(req.params.id);
    if (!airdrop) {
      return res.status(404).json({ error: 'Airdrop not found' });
    }

    if (!airdrop.claim_enabled) {
      return res.status(400).json({ error: 'Claiming is not enabled for this airdrop' });
    }

    // Verify merkle proof if applicable
    if (airdrop.merkle_root && proof) {
      const isValidProof = verifyMerkleProof(address, proof, airdrop.merkle_root);
      if (!isValidProof) {
        return res.status(400).json({ error: 'Invalid merkle proof' });
      }
    }

    // Update claim status
    const updatedAirdrop = await storage.updateAirdropClaims(req.params.id, [address]);
    
    res.json({
      success: true,
      message: 'Successfully claimed airdrop',
      airdrop: updatedAirdrop,
      claimed_address: address
    });
  } catch (error) {
    console.error('❌ Error claiming airdrop:', error);
    res.status(500).json({ error: 'Failed to claim airdrop' });
  }
});

// Get active airdrops (public endpoint for discovery)
router.get('/airdrops/public/active', async (req, res) => {
  try {
    const activeAirdrops = await storage.getActiveDevToolAirdrops();
    
    // Filter and transform for public display
    const publicAirdrops = activeAirdrops.map(airdrop => ({
      id: airdrop.id,
      chain: airdrop.chain,
      airdrop_type: airdrop.airdrop_type,
      total_recipients: airdrop.total_recipients,
      total_claimed: airdrop.total_claimed,
      claim_enabled: airdrop.claim_enabled,
      start_date: airdrop.start_date,
      end_date: airdrop.end_date,
      created_at: airdrop.created_at,
      progress: (airdrop.total_recipients || 0) > 0 ? ((airdrop.total_claimed || 0) / (airdrop.total_recipients || 0)) * 100 : 0
    }));

    res.json({
      success: true,
      airdrops: publicAirdrops,
      total_count: publicAirdrops.length
    });
  } catch (error) {
    console.error('❌ Error fetching active airdrops:', error);
    res.status(500).json({ error: 'Failed to fetch active airdrops' });
  }
});

// Helper functions for airdrop functionality

function calculateGasCosts(chain: string, recipientCount: number, airdropType: string) {
  const chainConfig = chainConfigs[chain as keyof typeof chainConfigs];
  if (!chainConfig) return { error: 'Unsupported chain' };

  // Gas estimates per operation type
  const gasPerRecipient = {
    token: 65000,
    nft: 85000,
    native: 21000
  };

  const baseGas = 21000;
  const totalGas = baseGas + (recipientCount * gasPerRecipient[airdropType as keyof typeof gasPerRecipient]);
  const gasCostInNative = (totalGas * chainConfig.gasPrice) / Math.pow(10, chainConfig.decimals);
  
  // Rough USD estimate (simplified)
  const usdRates: { [key: string]: number } = {
    ETH: 2000, BNB: 300, MATIC: 0.8, SOL: 50, XRP: 0.5, BTC: 35000
  };
  
  const usdRate = usdRates[chainConfig.symbol] || 1;
  const totalCostUSD = gasCostInNative * usdRate;

  return {
    chain,
    total_gas: totalGas,
    gas_per_recipient: gasPerRecipient[airdropType as keyof typeof gasPerRecipient],
    gas_cost_native: gasCostInNative,
    native_symbol: chainConfig.symbol,
    total_cost_usd: totalCostUSD,
    recipient_count: recipientCount,
    optimization_savings: recipientCount > 100 ? totalCostUSD * 0.15 : 0 // 15% savings for batch operations
  };
}

function calculateAirdropValue(airdrop: any): number {
  // Simplified value calculation
  const recipients = Array.isArray(airdrop.recipients) ? airdrop.recipients : [];
  const totalAmount = recipients.reduce((sum: number, r: any) => sum + parseFloat(r.amount || '0'), 0);
  return totalAmount * 1.5; // Rough USD estimate
}

function getGasOptimizationRecommendations(chain: string, recipientCount: number, airdropType: string): string[] {
  const recommendations = [];
  
  if (recipientCount > 100) {
    recommendations.push("Consider using batch transactions to reduce gas costs");
  }
  
  if (chain === 'ethereum' && recipientCount > 50) {
    recommendations.push("Consider using Layer 2 solutions like Arbitrum or Polygon for lower fees");
  }
  
  if (airdropType === 'token' && recipientCount > 200) {
    recommendations.push("Implement merkle tree claims to reduce upfront gas costs");
  }
  
  if (['base', 'arbitrum', 'optimism'].includes(chain)) {
    recommendations.push("This L2 chain offers low gas fees - good choice for large airdrops");
  }
  
  return recommendations;
}

function generateMerkleRoot(recipients: any[]): string {
  // Simplified merkle root generation
  const leaves = recipients.map(r => 
    crypto.createHash('sha256')
      .update(`${r.address}:${r.amount}`)
      .digest('hex')
  );
  
  if (leaves.length === 0) return '';
  if (leaves.length === 1) return leaves[0];
  
  // Build tree bottom-up
  let level = leaves;
  while (level.length > 1) {
    const nextLevel = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = level[i + 1] || left; // Handle odd number of leaves
      const combined = crypto.createHash('sha256')
        .update(left + right)
        .digest('hex');
      nextLevel.push(combined);
    }
    level = nextLevel;
  }
  
  return level[0];
}

function generateMerkleProofs(recipients: any[]): { [address: string]: string[] } {
  // Simplified proof generation - in production, use a proper merkle tree library
  const proofs: { [address: string]: string[] } = {};
  
  recipients.forEach(recipient => {
    // Generate a sample proof (in production, calculate actual merkle path)
    proofs[recipient.address] = [
      crypto.createHash('sha256').update(`proof1:${recipient.address}`).digest('hex'),
      crypto.createHash('sha256').update(`proof2:${recipient.address}`).digest('hex')
    ];
  });
  
  return proofs;
}

function verifyMerkleProof(address: string, proof: string[], merkleRoot: string): boolean {
  // Simplified verification - in production, implement proper merkle proof verification
  try {
    return proof.length > 0 && merkleRoot.length > 0;
  } catch {
    return false;
  }
}

// Multi-chain token creation endpoint
router.post('/token/create', sessionAuth, async (req: any, res) => {
  try {
    const {
      name,
      symbol,
      totalSupply,
      decimals,
      description,
      website,
      twitter,
      telegram,
      chain,
      mintable,
      burnable,
      pausable,
      launchpadEnabled,
      fundingTarget,
      tokenAllocation,
      minContribution,
      maxContribution,
      launchpadDuration
    } = req.body;

    // Validate required fields
    if (!name || !symbol || !totalSupply || !chain) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, symbol, totalSupply, chain'
      });
    }

    // For now, simulate token creation and store in database
    const tokenData = {
      name,
      symbol,
      totalSupply: parseInt(totalSupply),
      decimals: parseInt(decimals) || 18,
      description: description || '',
      website: website || '',
      twitter: twitter || '',
      telegram: telegram || '',
      chain,
      features: {
        mintable: mintable || false,
        burnable: burnable || false,
        pausable: pausable || false
      },
      launchpad: launchpadEnabled ? {
        enabled: true,
        fundingTarget: fundingTarget ? parseInt(fundingTarget) : 0,
        tokenAllocation: tokenAllocation ? parseInt(tokenAllocation) : 0,
        minContribution: minContribution ? parseInt(minContribution) : 0,
        maxContribution: maxContribution ? parseInt(maxContribution) : 0,
        duration: launchpadDuration ? parseInt(launchpadDuration) : 30
      } : { enabled: false },
      createdBy: req.user?.walletAddress || 'unknown',
      status: 'pending_deployment',
      createdAt: new Date().toISOString()
    };

    // Log the token creation attempt
    console.log(`🪙 [TOKEN CREATION] User ${req.user?.walletAddress} creating token:`, {
      name,
      symbol,
      chain,
      totalSupply,
      launchpadEnabled
    });

    // In a real implementation, here you would:
    // 1. Connect to the appropriate blockchain RPC
    // 2. Deploy the token contract using the user's wallet
    // 3. Store the contract address and transaction hash
    // 4. If launchpadEnabled, create the launchpad entry

    // For now, simulate contract deployment
    const mockContractAddress = generateMockAddress(chain);
    const mockTxHash = crypto.randomBytes(32).toString('hex');

    const response = {
      success: true,
      message: 'Token creation initiated successfully',
      token: {
        ...tokenData,
        contractAddress: mockContractAddress,
        transactionHash: mockTxHash,
        networkExplorerUrl: getExplorerUrl(chain, mockTxHash)
      }
    };

    // If launchpad is enabled, add it to active launchpad projects
    if (launchpadEnabled) {
      console.log(`🚀 [LAUNCHPAD] Token ${symbol} added to active launchpad projects`);
    }

    res.json(response);

  } catch (error) {
    console.error('❌ [TOKEN CREATION] Error creating token:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create token'
    });
  }
});

// Helper function to generate mock contract addresses for different chains
function generateMockAddress(chain: string): string {
  const randomBytes = crypto.randomBytes(20).toString('hex');
  
  switch (chain) {
    case 'ethereum':
    case 'polygon':
    case 'bsc':
    case 'arbitrum':
    case 'optimism':
    case 'base':
    case 'avalanche':
    case 'fantom':
      return `0x${randomBytes}`;
    case 'solana':
      return crypto.randomBytes(32).toString('hex').substring(0, 44);
    case 'xrpl':
      return `r${crypto.randomBytes(20).toString('hex').toUpperCase()}`;
    default:
      return `0x${randomBytes}`;
  }
}

// Helper function to get explorer URLs for different chains
function getExplorerUrl(chain: string, txHash: string): string {
  const explorers = {
    ethereum: `https://etherscan.io/tx/${txHash}`,
    polygon: `https://polygonscan.com/tx/${txHash}`,
    bsc: `https://bscscan.com/tx/${txHash}`,
    arbitrum: `https://arbiscan.io/tx/${txHash}`,
    optimism: `https://optimistic.etherscan.io/tx/${txHash}`,
    base: `https://basescan.org/tx/${txHash}`,
    avalanche: `https://snowtrace.io/tx/${txHash}`,
    fantom: `https://ftmscan.com/tx/${txHash}`,
    solana: `https://explorer.solana.com/tx/${txHash}`,
    xrpl: `https://livenet.xrpl.org/transactions/${txHash}`
  };
  
  return explorers[chain as keyof typeof explorers] || `https://explorer.com/tx/${txHash}`;
}

export default router;