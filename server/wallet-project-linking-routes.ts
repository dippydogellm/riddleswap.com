import { Router } from 'express';
import { z } from 'zod';
import { storage } from './storage';
import { sessionAuth } from './middleware/session-auth';
import { insertWalletProjectLinkSchema, inquisitionCollections, InsertWalletProjectLink } from '../shared/schema';
import { db } from './db';
import { eq } from 'drizzle-orm';

const router = Router();

// Schema for wallet project linking requests
const createWalletProjectLinkSchema = insertWalletProjectLinkSchema.extend({
  // Add any additional validation if needed
});

// Local type to ensure strong typing of parsed link payload in this module
// Local narrowed interface aligns with schema insert type while ensuring required fields accessible.
// We rely on InsertWalletProjectLink but keep an explicit shape here for clarity and to avoid '{}' inference.
// NOTE: walletAddress/projectId/chain must be present; optional fields are carried through when provided.
interface WalletProjectLinkInput {
  walletAddress: string;
  projectId: string;
  chain: string;
  linkType?: 'issuer' | 'owner' | 'contributor' | 'developer';
  isActive?: boolean;
}

// Schema for project detection
const detectProjectsSchema = z.object({
  walletAddresses: z.array(z.string()).min(1).max(10), // Limit to 10 wallets max
  chains: z.array(z.string()).optional()
});

// Apply authentication to all routes
router.use(sessionAuth);

// Discover NFT projects ON-CHAIN by scanning blockchain for issuer addresses
router.get('/discover-onchain-projects', async (req: any, res) => {
  try {
    const userHandle = req.user?.handle || req.user?.username;
    const userWallet = req.user?.walletAddress;
    
    if (!userHandle && !userWallet) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    console.log(`🔍 [ON-CHAIN-DISCOVER] Starting blockchain scan for user: ${userHandle || userWallet}`);

    // STEP 1: Collect ALL wallet addresses
    const allWalletAddresses = new Set<string>();
    
    if (req.user?.allWallets) {
      req.user.allWallets.forEach((addr: string) => allWalletAddresses.add(addr));
    }
    if (userWallet) {
      allWalletAddresses.add(userWallet);
    }

    // Get Riddle wallet addresses
    if (userHandle) {
      try {
        const riddleWallet = await storage.getRiddleWalletByHandle(userHandle);
        if (riddleWallet) {
          if (riddleWallet.xrpAddress) allWalletAddresses.add(riddleWallet.xrpAddress);
          if (riddleWallet.ethAddress) allWalletAddresses.add(riddleWallet.ethAddress);
          if (riddleWallet.solAddress) allWalletAddresses.add(riddleWallet.solAddress);
          if (riddleWallet.btcAddress) allWalletAddresses.add(riddleWallet.btcAddress);
          console.log(`✅ [ON-CHAIN-DISCOVER] Added Riddle wallet addresses for ${userHandle}:`, {
            xrp: riddleWallet.xrpAddress,
            eth: riddleWallet.ethAddress,
            sol: riddleWallet.solAddress,
            btc: riddleWallet.btcAddress
          });
        } else {
          console.log(`⚠️ [ON-CHAIN-DISCOVER] No Riddle wallet found for ${userHandle}`);
        }
      } catch (error) {
        console.log(`⚠️ [ON-CHAIN-DISCOVER] Could not fetch Riddle wallet:`, error);
      }
    }

    // Get external linked wallets
    if (userHandle) {
      try {
        const linkedWallets = await storage.listLinkedWallets(userHandle);
        linkedWallets.forEach((wallet: any) => {
          if (wallet.address) allWalletAddresses.add(wallet.address);
        });
        console.log(`✅ [ON-CHAIN-DISCOVER] Found ${linkedWallets.length} linked external wallets for ${userHandle}`);
      } catch (error) {
        console.log(`⚠️ [ON-CHAIN-DISCOVER] Could not fetch linked wallets:`, error);
      }
    }

    const walletArray = Array.from(allWalletAddresses);
    console.log(`📋 [ON-CHAIN-DISCOVER] Scanning ${walletArray.length} wallet addresses on blockchain`);
    console.log(`📋 [ON-CHAIN-DISCOVER] Addresses:`, walletArray);

    // STEP 2: Scan blockchain for NFT collections by issuer
    const discoveredProjects: any[] = [];
    
    // Scan XRPL for NFT collections
    for (const address of walletArray) {
      try {
        // Check if this looks like an XRPL address
        if (address.startsWith('r') && address.length >= 25 && address.length <= 35) {
          console.log(`🔍 [XRPL] Scanning for NFTs issued by: ${address}`);
          
          // Fetch NFTs from this issuer using the XRPL scanner endpoint
          const scannerResponse = await fetch(`${req.protocol}://${req.get('host')}/api/scanner/xrpl/nfts/${address}?limit=100`);
          if (scannerResponse.ok) {
            const data = await scannerResponse.json();
            const nfts = data.nfts || [];
            
            // Group NFTs by taxon (collection)
            const collections = new Map();
            nfts.forEach((nft: any) => {
              const taxon = nft.NFTokenTaxon || 0;
              if (!collections.has(taxon)) {
                collections.set(taxon, {
                  taxon,
                  nfts: [],
                  sampleNFT: nft
                });
              }
              collections.get(taxon).nfts.push(nft);
            });

            // Create project entries for each collection
            for (const [taxon, collection] of Array.from(collections.entries())) {
              const sampleNFT = collection.sampleNFT;
              const nftCount = collection.nfts.length;
              
              discoveredProjects.push({
                id: `xrpl-${address}-${taxon}`,
                chain: 'xrpl',
                issuerAddress: address,
                taxon,
                assetType: 'nft',
                name: `XRPL Collection #${taxon}`,
                description: `NFT Collection with ${nftCount} items`,
                logoUrl: sampleNFT.image || sampleNFT.thumbnail || null,
                nftCount,
                sampleNFTs: collection.nfts.slice(0, 3),
                discoverySource: 'onchain',
                claimedInDatabase: false
              });
            }
            
            console.log(`✅ [XRPL] Found ${collections.size} collections for ${address}`);
          }
        }
      } catch (error) {
        console.log(`⚠️ [XRPL] Error scanning ${address}:`, error);
      }
    }

    console.log(`✅ [ON-CHAIN-DISCOVER] Discovered ${discoveredProjects.length} projects on blockchain`);

    // STEP 3: Check which discovered projects are already in database
    for (const project of discoveredProjects) {
      try {
        // Check if this project is already linked
        const existingLinks = await storage.getWalletProjectLinks(project.issuerAddress);
        project.claimedInDatabase = existingLinks.length > 0;
        if (project.claimedInDatabase) {
          project.existingProjectId = existingLinks[0]?.projectId;
        }
      } catch (error) {
        // Not critical if check fails
      }
    }

    res.json({
      success: true,
      discoveredProjects,
      searchedWallets: walletArray,
      stats: {
        totalWalletsScanned: walletArray.length,
        projectsDiscovered: discoveredProjects.length,
        unclaimed: discoveredProjects.filter(p => !p.claimedInDatabase).length,
        claimed: discoveredProjects.filter(p => p.claimedInDatabase).length
      }
    });

  } catch (error) {
    console.error('❌ [ON-CHAIN-DISCOVER] Error:', error);
    res.status(500).json({ error: 'Failed to discover on-chain projects', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Search for NFT projects by issuer address (manual search)
router.post('/search-by-issuer', async (req: any, res) => {
  try {
    const { issuerAddress, chain } = req.body;
    
    if (!issuerAddress) {
      return res.status(400).json({ error: 'Issuer address is required' });
    }

    console.log(`🔍 [ISSUER-SEARCH] Searching for projects by issuer: ${issuerAddress} on chain: ${chain || 'all'}`);

    const discoveredProjects: any[] = [];

    // FIRST: Check database for existing NFT collections
    if (!chain || chain === 'xrpl') {
      try {
        console.log(`🔍 [ISSUER-SEARCH] Checking inquisition_collections table for issuer: ${issuerAddress}`);
        const dbCollections = await db.select().from(inquisitionCollections).where(eq(inquisitionCollections.issuer_address, issuerAddress));
        
        if (dbCollections && dbCollections.length > 0) {
          console.log(`✅ [ISSUER-SEARCH] Found ${dbCollections.length} collections in database`);
          
          for (const collection of dbCollections) {
            discoveredProjects.push({
              id: `xrpl-${issuerAddress}-${collection.taxon}`,
              chain: 'xrpl',
              issuerAddress,
              taxon: collection.taxon,
              assetType: 'nft',
              name: collection.collection_name,
              description: `NFT Collection with ${collection.actual_supply || 0} items`,
              logoUrl: null,
              nftCount: collection.actual_supply || 0,
              sampleNFTs: [],
              discoverySource: 'database',
              gameRole: collection.game_role
            });
          }
        } else {
          console.log(`ℹ️ [ISSUER-SEARCH] No collections found in database for ${issuerAddress}`);
        }
      } catch (dbError) {
        console.log(`⚠️ [ISSUER-SEARCH] Database check failed:`, dbError);
      }
    }

    // THEN: Try blockchain scan as fallback (only if no results from database)
    if (discoveredProjects.length === 0 && (!chain || chain === 'xrpl')) {
      try {
        console.log(`🔍 [ISSUER-SEARCH] No database results, trying blockchain scan...`);
        const scannerResponse = await fetch(`${req.protocol}://${req.get('host')}/api/scanner/xrpl/nfts/${issuerAddress}?limit=100`);
        if (scannerResponse.ok) {
          const data = await scannerResponse.json();
          const nfts = data.nfts || [];
          
          const collections = new Map();
          nfts.forEach((nft: any) => {
            const taxon = nft.NFTokenTaxon || 0;
            if (!collections.has(taxon)) {
              collections.set(taxon, {
                taxon,
                nfts: [],
                sampleNFT: nft
              });
            }
            collections.get(taxon).nfts.push(nft);
          });

          for (const [taxon, collection] of Array.from(collections.entries())) {
            const sampleNFT = collection.sampleNFT;
            discoveredProjects.push({
              id: `xrpl-${issuerAddress}-${taxon}`,
              chain: 'xrpl',
              issuerAddress,
              taxon,
              assetType: 'nft',
              name: `XRPL Collection #${taxon}`,
              description: `NFT Collection with ${collection.nfts.length} items`,
              logoUrl: sampleNFT.image || sampleNFT.thumbnail || null,
              nftCount: collection.nfts.length,
              sampleNFTs: collection.nfts.slice(0, 3),
              discoverySource: 'blockchain'
            });
          }
        }
      } catch (error) {
        console.log(`⚠️ [ISSUER-SEARCH] Error scanning XRPL blockchain:`, error);
      }
    }

    console.log(`✅ [ISSUER-SEARCH] Returning ${discoveredProjects.length} discovered projects`);

    res.json({
      success: true,
      issuerAddress,
      chain: chain || 'all',
      discoveredProjects,
      count: discoveredProjects.length
    });

  } catch (error) {
    console.error('❌ [ISSUER-SEARCH] Error:', error);
    res.status(500).json({ error: 'Failed to search by issuer', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Claim a discovered project and link it to user's account
router.post('/claim-project', async (req: any, res) => {
  try {
    const userHandle = req.user?.handle || req.user?.username;
    
    if (!userHandle) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { issuerAddress, taxon, chain, projectName, projectDescription } = req.body;

    if (!issuerAddress || !chain) {
      return res.status(400).json({ error: 'Issuer address and chain are required' });
    }

    console.log(`🎯 [CLAIM-PROJECT] User ${userHandle} claiming project: ${issuerAddress} (taxon: ${taxon})`);

    // Create or update project in database
    const projectData = {
      creatorWallet: issuerAddress,
      creatorUserId: userHandle,
      projectName: projectName || `NFT Collection #${taxon || 0}`,
      projectDescription: projectDescription || `Claimed NFT collection`,
      chainType: chain,
      taxon: taxon ? parseInt(taxon) : 0,
      totalSupply: 0, // Will be updated
      collectionName: projectName || `Collection #${taxon || 0}`,
      collectionSymbol: 'NFT',
      status: 'claimed' as any,
      isPublic: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // TODO: Create project in nft_projects table
    // const project = await storage.createNftProject(projectData);

    // Create wallet project link
    const link = await storage.createWalletProjectLink({
      walletAddress: issuerAddress,
      projectId: `nft-${issuerAddress}-${taxon || 0}`,
      chain: chain,
      linkType: 'owner',
      isActive: true
    });

    console.log(`✅ [CLAIM-PROJECT] Project claimed successfully`);

    res.json({
      success: true,
      message: 'Project claimed successfully',
      link
    });

  } catch (error) {
    console.error('❌ [CLAIM-PROJECT] Error:', error);
    res.status(500).json({ error: 'Failed to claim project', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Get projects linked to connected wallets (comprehensive search across ALL chains)
router.get('/auto-detect-projects', async (req: any, res) => {
  try {
    const userHandle = req.user?.handle || req.user?.username;
    const userWallet = req.user?.walletAddress;
    
    if (!userHandle && !userWallet) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    console.log(`🔍 [AUTO-DETECT] Starting comprehensive project search for user: ${userHandle || userWallet}`);

    // STEP 1: Collect ALL wallet addresses from ALL sources
    const allWalletAddresses = new Set<string>();
    
    // Add session wallet addresses
    if (req.user?.allWallets) {
      req.user.allWallets.forEach((addr: string) => allWalletAddresses.add(addr.toLowerCase()));
    }
    if (userWallet) {
      allWalletAddresses.add(userWallet.toLowerCase());
    }

    // Get Riddle wallet addresses from database (XRP, ETH, SOL, BTC)
    if (userHandle) {
      try {
        const riddleWallet = await storage.getRiddleWalletByHandle(userHandle);
        if (riddleWallet) {
          if (riddleWallet.xrpAddress) allWalletAddresses.add(riddleWallet.xrpAddress.toLowerCase());
          if (riddleWallet.ethAddress) allWalletAddresses.add(riddleWallet.ethAddress.toLowerCase());
          if (riddleWallet.solAddress) allWalletAddresses.add(riddleWallet.solAddress.toLowerCase());
          if (riddleWallet.btcAddress) allWalletAddresses.add(riddleWallet.btcAddress.toLowerCase());
          
          console.log(`🏦 [AUTO-DETECT] Added Riddle wallet addresses:`, {
            xrp: riddleWallet.xrpAddress,
            eth: riddleWallet.ethAddress,
            sol: riddleWallet.solAddress,
            btc: riddleWallet.btcAddress
          });
        }
      } catch (error) {
        console.log(`⚠️ [AUTO-DETECT] Could not fetch Riddle wallet for ${userHandle}`);
      }
    }

    // Get external linked wallets from database
    if (userHandle) {
      try {
        const linkedWallets = await storage.listLinkedWallets(userHandle);
        linkedWallets.forEach((wallet: any) => {
          if (wallet.address) {
            allWalletAddresses.add(wallet.address.toLowerCase());
          }
        });
        console.log(`🔗 [AUTO-DETECT] Added ${linkedWallets.length} external linked wallets`);
      } catch (error) {
        console.log(`⚠️ [AUTO-DETECT] Could not fetch linked wallets for ${userHandle}:`, error);
      }
    }

    const walletArray = Array.from(allWalletAddresses);
    console.log(`📋 [AUTO-DETECT] Total unique wallet addresses to search: ${walletArray.length}`);
    console.log(`📋 [AUTO-DETECT] Wallets:`, walletArray);

    // STEP 2: Search for projects linked to ANY of these wallets across ALL chains
    const allLinks: any[] = [];
    const chainCounts: Record<string, number> = {};
    
    for (const walletAddress of walletArray) {
      try {
        const links = await storage.getWalletProjectLinks(walletAddress);
        allLinks.push(...links);
        
        // Count links per chain for stats
        links.forEach((link: any) => {
          const chain = link.chain || 'unknown';
          chainCounts[chain] = (chainCounts[chain] || 0) + 1;
        });
      } catch (error) {
        console.log(`⚠️ [AUTO-DETECT] Error searching wallet ${walletAddress}:`, error);
      }
    }

    console.log(`🔗 [AUTO-DETECT] Found ${allLinks.length} total wallet-project links`);
    console.log(`📊 [AUTO-DETECT] Links by chain:`, chainCounts);

    // STEP 3: Get unique project IDs and fetch full details
    const projectIds = Array.from(new Set(allLinks.map(link => link.projectId)));
    console.log(`🎯 [AUTO-DETECT] Unique projects found: ${projectIds.length}`);
    
    // Fetch full project details with wallet links
    const projects: any[] = [];
    for (const projectId of projectIds) {
      try {
        const project = await storage.getDevtoolsProject(projectId);
        if (project) {
          // Get all wallet links for this project
          const projectLinks = await storage.getProjectWalletLinks(projectId);
          
          // Find which of the user's wallets are linked to this project
          const userLinkedWallets = allLinks
            .filter(link => link.projectId === projectId)
            .map(link => ({
              address: link.walletAddress,
              chain: link.chain,
              role: link.linkType || 'member',
              isRiddleWallet: link.walletAddress.toLowerCase() !== userWallet?.toLowerCase()
            }));
          
          projects.push({
            ...project,
            walletLinks: projectLinks,
            userRole: allLinks.find(link => link.projectId === projectId)?.linkType || 'member',
            userLinkedWallets,
            matchedWalletCount: userLinkedWallets.length
          });
        }
      } catch (error) {
        console.log(`⚠️ [AUTO-DETECT] Error fetching project ${projectId}:`, error);
      }
    }

    console.log(`✅ [AUTO-DETECT] Successfully retrieved ${projects.length} projects`);

    res.json({
      success: true,
      projects,
      linkedWallets: walletArray,
      totalLinks: allLinks.length,
      chainDistribution: chainCounts,
      searchStats: {
        totalWalletsSearched: walletArray.length,
        totalLinksFound: allLinks.length,
        uniqueProjects: projects.length,
        chainsCovered: Object.keys(chainCounts).length
      }
    });

  } catch (error) {
    console.error('❌ [AUTO-DETECT] Error auto-detecting projects:', error);
    res.status(500).json({ error: 'Failed to auto-detect projects', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Get projects for specific wallet addresses (for manual detection)
router.post('/detect-projects', async (req: any, res) => {
  try {
    const userWallet = req.user?.walletAddress;
    if (!userWallet) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const validatedData = detectProjectsSchema.parse(req.body);
    const { walletAddresses, chains } = validatedData;

    console.log(`🔍 Detecting projects for wallets: ${walletAddresses.join(', ')}`);

    // Find all projects linked to the specified wallets
    const allLinks: any[] = [];
    for (const walletAddress of walletAddresses) {
      const links = await storage.getWalletProjectLinks(walletAddress);
      // Filter by chains if specified
      const filteredLinks = chains 
        ? links.filter(link => chains.includes(link.chain))
        : links;
      allLinks.push(...filteredLinks);
    }

    // Get unique project IDs
    const projectIds = Array.from(new Set(allLinks.map(link => link.projectId)));
    
    // Fetch full project details
    const projects: any[] = [];
    for (const projectId of projectIds) {
      const project = await storage.getDevtoolsProject(projectId);
      if (project) {
        // Get all wallet links for this project
        const projectLinks = await storage.getProjectWalletLinks(projectId);
        projects.push({
          ...project,
          walletLinks: projectLinks,
          matchingWallets: allLinks
            .filter(link => link.projectId === projectId)
            .map(link => ({
              address: link.walletAddress,
              chain: link.chain,
              role: link.linkType
            }))
        });
      }
    }

    console.log(`✅ Found ${projects.length} projects for specified wallets`);

    res.json({
      success: true,
      projects,
      searchedWallets: walletAddresses,
      totalLinks: allLinks.length
    });

  } catch (error) {
    console.error('❌ Error detecting projects:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to detect projects' });
  }
});

// Link wallet to project (requires authentication and project ownership)
router.post('/link-wallet', async (req: any, res) => {
  try {
    const userWallet = req.user?.walletAddress;
    if (!userWallet) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

  // Strongly type the parsed data to avoid '{}' inference causing property errors
  // Parse and explicitly assert the narrowed type; this prevents losing property typing to '{}'
  const parsed = createWalletProjectLinkSchema.parse(req.body) as any as WalletProjectLinkInput;
  const validatedData: WalletProjectLinkInput = parsed;
    
    // Check if user owns the project (only project owners can link wallets)
    const project = await storage.getDevtoolsProject(validatedData.projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.ownerWalletAddress !== userWallet) {
      return res.status(403).json({ error: 'Only project owners can link wallets' });
    }

    // Check if link already exists
    const existingLinks = await storage.getWalletProjectLinks(validatedData.walletAddress);
    const existingLink = existingLinks.find(link => 
      link.projectId === validatedData.projectId && 
      link.chain === validatedData.chain
    );

    if (existingLink) {
      return res.status(409).json({ 
        error: 'Wallet already linked to this project',
        existingLink 
      });
    }

    // Create the wallet-project link
    const link = await storage.createWalletProjectLink(validatedData);

    console.log(`✅ Linked wallet ${validatedData.walletAddress} to project ${validatedData.projectId}`);

    res.status(201).json({
      success: true,
      link,
      message: 'Wallet successfully linked to project'
    });

  } catch (error) {
    console.error('❌ Error linking wallet to project:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to link wallet to project' });
  }
});

// Remove wallet link from project
router.delete('/links/:linkId', async (req: any, res) => {
  try {
    const userWallet = req.user?.walletAddress;
    if (!userWallet) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { linkId } = req.params;

    // Find the link first to check ownership
    const allProjects = await storage.getDevtoolsProjectsByOwner(userWallet);
    let canDelete = false;

    for (const project of allProjects) {
      const projectLinks = await storage.getProjectWalletLinks(project.id);
      if (projectLinks.some(link => link.id === linkId)) {
        canDelete = true;
        break;
      }
    }

    if (!canDelete) {
      return res.status(403).json({ error: 'You can only remove links from your own projects' });
    }

    // Remove the link
    await storage.deleteWalletProjectLink(linkId);

    console.log(`✅ Removed wallet link ${linkId}`);

    res.json({
      success: true,
      message: 'Wallet link removed successfully'
    });

  } catch (error) {
    console.error('❌ Error removing wallet link:', error);
    res.status(500).json({ error: 'Failed to remove wallet link' });
  }
});

// Get all links for a specific project (project owners only)
router.get('/projects/:projectId/links', async (req: any, res) => {
  try {
    const userWallet = req.user?.walletAddress;
    if (!userWallet) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { projectId } = req.params;

    // Check if user owns the project
    const project = await storage.getDevtoolsProject(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.ownerWalletAddress !== userWallet) {
      return res.status(403).json({ error: 'Only project owners can view project links' });
    }

    // Get all wallet links for this project
    const links = await storage.getProjectWalletLinks(projectId);

    res.json({
      success: true,
      project: {
        id: project.id,
        name: project.name,
        ownerWalletAddress: project.ownerWalletAddress
      },
      links,
      count: links.length
    });

  } catch (error) {
    console.error('❌ Error fetching project links:', error);
    res.status(500).json({ error: 'Failed to fetch project links' });
  }
});

// Update wallet link (change role/type)
router.patch('/links/:linkId', async (req: any, res) => {
  try {
    const userWallet = req.user?.walletAddress;
    if (!userWallet) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { linkId } = req.params;
    const updates = req.body;

    // Validate updates
    const updateSchema = z.object({
      linkType: z.enum(['issuer', 'owner', 'contributor', 'developer']).optional(),
      isActive: z.boolean().optional()
    });

    const validatedUpdates = updateSchema.parse(updates);

    // Check ownership (same logic as delete)
    const allProjects = await storage.getDevtoolsProjectsByOwner(userWallet);
    let canUpdate = false;

    for (const project of allProjects) {
      const projectLinks = await storage.getProjectWalletLinks(project.id);
      if (projectLinks.some(link => link.id === linkId)) {
        canUpdate = true;
        break;
      }
    }

    if (!canUpdate) {
      return res.status(403).json({ error: 'You can only update links for your own projects' });
    }

    // Update the link
    const updatedLink = await storage.updateWalletProjectLink(linkId, validatedUpdates);

    if (!updatedLink) {
      return res.status(404).json({ error: 'Link not found' });
    }

    console.log(`✅ Updated wallet link ${linkId}`);

    res.json({
      success: true,
      link: updatedLink,
      message: 'Wallet link updated successfully'
    });

  } catch (error) {
    console.error('❌ Error updating wallet link:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid update data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to update wallet link' });
  }
});

export default router;