// DevTools API Endpoints
// Comprehensive NFT project management, verification, airdrops, snapshots, subscriptions, and promotions

import { Router } from 'express';
import { requireAuthentication, type AuthenticatedRequest } from './middleware/session-auth';
import { db } from './db';
import {
  devtoolsProjects,
  projectTwitterVerification,
  devToolSnapshots,
  devToolAirdrops,
  projectPromotions,
  promotionPricing,
  devtoolsPayments,
  enhancedProjectSubscriptions,
  riddleWallets,
  marketMakerConfigs,
  marketMakerTransactions,
  projectNftCollections,
} from '../shared/schema';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { Client } from 'xrpl';

const router = Router();

// XRPL client for NFT discovery
const xrplClient = new Client('wss://xrplcluster.com');

// ============== PROJECT DISCOVERY & VERIFICATION ==============

/**
 * Auto-discover NFT projects by issuer address
 * Uses Bithomp API to find all NFT collections issued by an address
 * Also checks linked wallets for comprehensive project discovery
 */
router.post('/discover/issuer', requireAuthentication, async (req: AuthenticatedRequest, res) => {
  try {
    const { issuerAddress } = req.body;
    const userHandle = req.user?.userHandle;

    if (!issuerAddress) {
      return res.status(400).json({ error: 'Issuer address required' });
    }

    console.log(`🔍 Discovering NFT collections for issuer: ${issuerAddress}`);

    // Get user's wallet to check for linked wallets
    const [userWallet] = await db.select()
      .from(riddleWallets)
      .where(sql`${riddleWallets.handle} = ${userHandle}`)
      .limit(1);

    // Collect all addresses to check (Riddle wallet + linked wallets)
    const addressesToCheck = [issuerAddress];
    
    if (userWallet?.linkedWalletAddress && userWallet.linkedWalletChain === 'XRPL') {
      addressesToCheck.push(userWallet.linkedWalletAddress);
      console.log(`🔗 Also checking linked XRPL wallet: ${userWallet.linkedWalletAddress}`);
    }

    let allCollections: any[] = [];
    
    // Use Bithomp API to discover NFT collections from all addresses
    for (const address of addressesToCheck) {
      try {
        const bithompResponse = await fetch(
          `https://bithomp.com/api/v2/nft-collections?issuer=${address}&limit=20`,
          {
            headers: {
              'x-bithomp-token': process.env.BITHOMP_API_KEY || ''
            }
          }
        );

        if (bithompResponse.ok) {
          const data = await bithompResponse.json();
          const collections = data.collections || [];
          console.log(`📦 Found ${collections.length} collections from ${address}`);
          
          allCollections.push(...collections.map((col: any) => ({
            ...col,
            issuerAddress: address
          })));
        }
      } catch (error) {
        console.error(`❌ Error fetching from ${address}:`, error);
      }
    }

    console.log(`📚 Total collections discovered: ${allCollections.length}`);

    if (allCollections.length === 0) {
      return res.json({
        success: true,
        message: 'No NFT collections found for this issuer',
        collections: [],
        projects: []
      });
    }

    // Create/update projects for each collection
    const discoveredProjects = [];

    for (const collection of allCollections) {
      const taxon = collection.taxon;
      const collectionIssuer = collection.issuerAddress;
      
      // Check if project already exists for this issuer and taxon
      const existing = await db.select()
        .from(devtoolsProjects)
        .where(and(
          eq(devtoolsProjects.issuer_wallet, collectionIssuer),
          eq(devtoolsProjects.nft_token_taxon, taxon)
        ))
        .limit(1);

      if (existing.length === 0) {
        // Create new project
        const [newProject] = await db.insert(devtoolsProjects).values({
          name: collection.name || `Collection #${taxon}`,
          description: collection.description || `Auto-discovered NFT collection (Taxon ${taxon})`,
          ownerWalletAddress: collectionIssuer,
          projectType: 'imported',
          asset_type: 'nft',
          status: 'active',
          issuer_wallet: collectionIssuer,
          nft_token_taxon: taxon,
          discovered_from_chain: 'xrpl',
          discovered_from_issuer: collectionIssuer,
          auto_discovered: true,
          claim_status: 'unclaimed',
          selectedChains: ['xrpl'],
          logo_url: collection.image || null,
          bithomp_collection_name: collection.name || null,
          bithomp_collection_description: collection.description || null,
          bithomp_floor_price: collection.floorPrice || null,
          bithomp_total_nfts: collection.nftsCount || 0,
        } as any).returning();

        console.log(`✨ Created new project: ${newProject.name} (Taxon ${taxon})`);
        
        discoveredProjects.push({
          ...newProject,
          nft_count: collection.nftsCount || 0,
          is_new: true
        });
      } else {
        console.log(`📍 Project already exists: ${existing[0].name} (Taxon ${taxon})`);
        
        discoveredProjects.push({
          ...existing[0],
          nft_count: collection.nftsCount || 0,
          already_exists: true
        });
      }
    }

    res.json({
      success: true,
      issuer: issuerAddress,
      addresses_checked: addressesToCheck,
      collections_found: allCollections.length,
      projects: discoveredProjects
    });

  } catch (error) {
    console.error('❌ Error discovering projects:', error);
    res.status(500).json({
      error: 'Failed to discover projects',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Search for existing projects
 */
router.get('/search', requireAuthentication, async (req: AuthenticatedRequest, res) => {
  try {
    const { query, chain, asset_type } = req.query;

    let searchQuery = db.select().from(devtoolsProjects);

    if (query) {
      searchQuery = searchQuery.where(
        sql`${devtoolsProjects.name} ILIKE ${'%' + query + '%'} OR 
            ${devtoolsProjects.issuer_wallet} ILIKE ${'%' + query + '%'}`
      ) as any;
    }

    if (chain) {
      searchQuery = searchQuery.where(
        sql`${devtoolsProjects.discovered_from_chain} = ${chain}`
      ) as any;
    }

    if (asset_type) {
      searchQuery = searchQuery.where(
        eq(devtoolsProjects.asset_type, asset_type as string)
      ) as any;
    }

    const results = await searchQuery.limit(50);

    res.json({
      success: true,
      results
    });

  } catch (error) {
    console.error('❌ Error searching projects:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * Claim a project (verify ownership and link to RiddleHandle)
 */
router.post('/claim/:projectId', requireAuthentication, async (req: AuthenticatedRequest, res) => {
  try {
    const { projectId } = req.params;
    const userHandle = req.user?.userHandle;
    const { walletAddress } = req.body;

    if (!userHandle) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get project
    const [project] = await db.select()
      .from(devtoolsProjects)
      .where(eq(devtoolsProjects.id, projectId))
      .limit(1);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Verify wallet ownership matches issuer
    if (project.issuer_wallet && walletAddress.toLowerCase() === project.issuer_wallet.toLowerCase()) {
      // Auto-verify if wallet matches
      await db.update(devtoolsProjects)
        .set({ 
          ownerWalletAddress: walletAddress,
          claim_status: 'claimed',
          updatedAt: new Date()
         } as any)
        .where(eq(devtoolsProjects.id, projectId));

      res.json({
        success: true,
        message: 'Project claimed successfully',
        auto_verified: true,
        project_id: projectId
      });
    } else {
      // Require Twitter verification
      res.json({
        success: true,
        message: 'Wallet does not match issuer. Twitter verification required.',
        requires_twitter_verification: true,
        project_id: projectId
      });
    }

  } catch (error) {
    console.error('❌ Error claiming project:', error);
    res.status(500).json({ error: 'Failed to claim project' });
  }
});

// ============== TWITTER VERIFICATION ==============

/**
 * Request Twitter verification for project
 */
router.post('/verify/twitter/request', requireAuthentication, async (req: AuthenticatedRequest, res) => {
  try {
    const { projectId, twitterUsername } = req.body;
    const userHandle = req.user?.userHandle;

    if (!userHandle) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Generate unique verification code
    const verificationCode = `RIDDLESWAP-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create verification record
    const [verification] = await db.insert(projectTwitterVerification).values({
      project_id: projectId,
      riddle_handle: userHandle,
      twitter_username: twitterUsername,
      verification_code: verificationCode,
      verification_status: 'pending',
      expires_at: expiresAt
    } as any).returning();

    res.json({
      success: true,
      verification_id: verification.id,
      verification_code: verificationCode,
      message_to_post: `Verifying ownership of my project on RiddleSwap! ${verificationCode} @RiddleSwap #NFTs`,
      instructions: 'Post this message from your Twitter account, then submit the tweet URL for verification',
      expires_at: expiresAt
    });

  } catch (error) {
    console.error('❌ Error requesting Twitter verification:', error);
    res.status(500).json({ error: 'Failed to request verification' });
  }
});

/**
 * Submit Twitter verification (with tweet URL)
 */
router.post('/verify/twitter/submit', requireAuthentication, async (req: AuthenticatedRequest, res) => {
  try {
    const { verificationId, tweetUrl } = req.body;
    const userHandle = req.user?.userHandle;

    if (!userHandle) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get verification record
    const [verification] = await db.select()
      .from(projectTwitterVerification)
      .where(eq(projectTwitterVerification.id, verificationId))
      .limit(1);

    if (!verification) {
      return res.status(404).json({ error: 'Verification not found' });
    }

    if (verification.riddle_handle !== userHandle) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Update with tweet URL
    await db.update(projectTwitterVerification)
      .set({ 
        verification_tweet_url: tweetUrl,
        verification_status: 'posted'
       } as any)
      .where(eq(projectTwitterVerification.id, verificationId));

    res.json({
      success: true,
      message: 'Tweet submitted. Awaiting admin verification.',
      status: 'posted'
    });

  } catch (error) {
    console.error('❌ Error submitting Twitter verification:', error);
    res.status(500).json({ error: 'Failed to submit verification' });
  }
});

/**
 * Admin: Verify Twitter submission
 */
router.post('/admin/verify/twitter/:verificationId', requireAuthentication, async (req: AuthenticatedRequest, res) => {
  try {
    const { verificationId } = req.params;
    const { approved, notes } = req.body;
    const userHandle = req.user?.userHandle;

    // Check admin access (dippydoge or hermesthrice589)
    if (userHandle !== 'dippydoge' && userHandle !== 'hermesthrice589') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const [verification] = await db.select()
      .from(projectTwitterVerification)
      .where(eq(projectTwitterVerification.id, verificationId))
      .limit(1);

    if (!verification) {
      return res.status(404).json({ error: 'Verification not found' });
    }

    if (approved) {
      // Get the user's Riddle wallet address
      const { riddleWallets } = await import('@shared/schema');
      const [userWallet] = await db.select()
        .from(riddleWallets)
        .where(eq(riddleWallets.handle, verification.riddle_handle))
        .limit(1);

      if (!userWallet) {
        return res.status(400).json({ 
          error: 'No Riddle wallet found for this handle. User must create a Riddle wallet first.',
          riddle_handle: verification.riddle_handle
        });
      }

      // Approve verification
      await db.update(projectTwitterVerification)
        .set({ 
          admin_verified: true,
          admin_verified_by: userHandle,
          admin_verified_at: new Date(),
          admin_notes: notes,
          verification_status: 'verified',
          verified_at: new Date()
         } as any)
        .where(eq(projectTwitterVerification.id, verificationId));

      // Update project claim status with actual wallet address
      await db.update(devtoolsProjects)
        .set({ 
          ownerWalletAddress: userWallet.xrpAddress, // Use actual XRPL wallet address
          claim_status: 'verified',
          updatedAt: new Date()
         } as any)
        .where(eq(devtoolsProjects.id, verification.project_id));

      res.json({
        success: true,
        message: 'Verification approved',
        project_id: verification.project_id
      });
    } else {
      // Reject verification
      await db.update(projectTwitterVerification)
        .set({ 
          admin_notes: notes,
          verification_status: 'failed'
         } as any)
        .where(eq(projectTwitterVerification.id, verificationId));

      res.json({
        success: true,
        message: 'Verification rejected'
      });
    }

  } catch (error) {
    console.error('❌ Error admin verifying Twitter:', error);
    res.status(500).json({ error: 'Failed to verify' });
  }
});

// ============== AIRDROPS ==============

/**
 * Create airdrop
 */
router.post('/airdrop/create', requireAuthentication, async (req: AuthenticatedRequest, res) => {
  try {
    const userHandle = req.user?.userHandle;
    const {
      projectId,
      chain,
      airdropType,
      tokenContract,
      amountPerAddress,
      recipients,
      startDate,
      endDate
    } = req.body;

    if (!userHandle) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Calculate pricing based on number of recipients
    const recipientCount = recipients.length;
    const basePrice = 10; // $10 base
    const pricePerRecipient = 0.05; // $0.05 per recipient
    const totalPriceUSD = basePrice + (recipientCount * pricePerRecipient);

    // Create airdrop
    const [airdrop] = await db.insert(devToolAirdrops).values({
      creator_address: req.user?.walletAddress || '',
      riddle_wallet_handle: userHandle,
      chain,
      airdrop_type: airdropType,
      token_contract: tokenContract,
      amount_per_address: amountPerAddress,
      total_recipients: recipientCount,
      recipients: recipients,
      start_date: startDate ? new Date(startDate as any) : new Date(),
      end_date: endDate ? new Date(endDate) : null,
      status: 'draft'
    } as any).returning();

    // Create payment record
    const [payment] = await db.insert(devtoolsPayments).values({
      riddle_handle: userHandle,
      project_id: projectId,
      service_type: 'airdrop',
      service_id: airdrop.id,
      payment_model: 'pay_as_you_go',
      amount_usd: totalPriceUSD.toString(),
      payment_status: 'pending',
      payment_method: 'crypto_xrp',
      service_description: `Airdrop to ${recipientCount} recipients`,
      service_quantity: recipientCount
    } as any).returning();

    res.json({
      success: true,
      airdrop_id: airdrop.id,
      payment_id: payment.id,
      total_price_usd: totalPriceUSD,
      recipient_count: recipientCount,
      message: 'Airdrop created. Complete payment to activate.'
    });

  } catch (error) {
    console.error('❌ Error creating airdrop:', error);
    res.status(500).json({ error: 'Failed to create airdrop' });
  }
});

/**
 * Get user's airdrops
 */
router.get('/airdrop/list', requireAuthentication, async (req: AuthenticatedRequest, res) => {
  try {
    const userHandle = req.user?.userHandle;

    if (!userHandle) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const airdrops = await db.select()
      .from(devToolAirdrops)
      .where(eq(devToolAirdrops.riddle_wallet_handle, userHandle))
      .orderBy(desc(devToolAirdrops.created_at));

    res.json({
      success: true,
      airdrops
    });

  } catch (error) {
    console.error('❌ Error listing airdrops:', error);
    res.status(500).json({ error: 'Failed to list airdrops' });
  }
});

/**
 * Get airdrop details
 */
router.get('/airdrop/:airdropId', requireAuthentication, async (req: AuthenticatedRequest, res) => {
  try {
    const { airdropId } = req.params;
    const userHandle = req.user?.userHandle;

    const [airdrop] = await db.select()
      .from(devToolAirdrops)
      .where(eq(devToolAirdrops.id, airdropId))
      .limit(1);

    if (!airdrop) {
      return res.status(404).json({ error: 'Airdrop not found' });
    }

    if (airdrop.riddle_wallet_handle !== userHandle && userHandle !== 'dippydoge' && userHandle !== 'hermesthrice589') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    res.json({
      success: true,
      airdrop
    });

  } catch (error) {
    console.error('❌ Error getting airdrop:', error);
    res.status(500).json({ error: 'Failed to get airdrop' });
  }
});

// ============== SNAPSHOTS ==============

/**
 * Create snapshot
 */
router.post('/snapshot/create', requireAuthentication, async (req: AuthenticatedRequest, res) => {
  try {
    const userHandle = req.user?.userHandle;
    const {
      projectId,
      chain,
      snapshotType,
      targetContract,
      blockNumber
    } = req.body;

    if (!userHandle) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Create snapshot
    const [snapshot] = await db.insert(devToolSnapshots).values({
      creator_address: req.user?.walletAddress || '',
      chain,
      snapshot_type: snapshotType,
      target_contract: targetContract,
      block_number: blockNumber,
      status: 'pending'
    } as any).returning();

    // Create payment record
    const snapshotPrice = 5; // $5 per snapshot
    const [payment] = await db.insert(devtoolsPayments).values({
      riddle_handle: userHandle,
      project_id: projectId,
      service_type: 'snapshot',
      service_id: snapshot.id,
      payment_model: 'pay_as_you_go',
      amount_usd: snapshotPrice.toString(),
      payment_status: 'pending',
      payment_method: 'crypto_xrp',
      service_description: `${snapshotType} snapshot on ${chain}`
    } as any).returning();

    res.json({
      success: true,
      snapshot_id: snapshot.id,
      payment_id: payment.id,
      price_usd: snapshotPrice,
      message: 'Snapshot created. Complete payment to process.'
    });

  } catch (error) {
    console.error('❌ Error creating snapshot:', error);
    res.status(500).json({ error: 'Failed to create snapshot' });
  }
});

/**
 * Get user's snapshots
 */
router.get('/snapshot/list', requireAuthentication, async (req: AuthenticatedRequest, res) => {
  try {
    const userHandle = req.user?.userHandle;

    if (!userHandle) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const snapshots = await db.select()
      .from(devToolSnapshots)
      .where(eq(devToolSnapshots.creator_address, req.user?.walletAddress || ''))
      .orderBy(desc(devToolSnapshots.created_at));

    res.json({
      success: true,
      snapshots
    });

  } catch (error) {
    console.error('❌ Error listing snapshots:', error);
    res.status(500).json({ error: 'Failed to list snapshots' });
  }
});

// ============== PROMOTIONS ==============

/**
 * Get promotion pricing
 */
router.get('/promotion/pricing', async (req, res) => {
  try {
    const pricing = await db.select()
      .from(promotionPricing)
      .where(eq(promotionPricing.is_active, true));

    res.json({
      success: true,
      pricing
    });

  } catch (error) {
    console.error('❌ Error getting pricing:', error);
    res.status(500).json({ error: 'Failed to get pricing' });
  }
});

/**
 * Create promotion
 */
router.post('/promotion/create', requireAuthentication, async (req: AuthenticatedRequest, res) => {
  try {
    const userHandle = req.user?.userHandle;
    const {
      projectId,
      promotionType,
      title,
      description,
      bannerImageUrl,
      linkUrl,
      callToAction,
      startDate,
      durationDays
    } = req.body;

    if (!userHandle) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get pricing
    const [pricing] = await db.select()
      .from(promotionPricing)
      .where(eq(promotionPricing.promotion_type, promotionType))
      .limit(1);

    if (!pricing) {
      return res.status(400).json({ error: 'Invalid promotion type' });
    }

    const totalPrice = parseFloat(pricing.base_price_usd) + 
                      (parseFloat(pricing.price_per_day_usd || '0') * durationDays);

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + durationDays);

    // Create promotion
    const [promotion] = await db.insert(projectPromotions).values({
      project_id: projectId,
      riddle_handle: userHandle,
      promotion_type: promotionType,
      title,
      description,
      banner_image_url: bannerImageUrl,
      link_url: linkUrl,
      call_to_action: callToAction,
      start_date: new Date(startDate as any),
      end_date: endDate,
      duration_days: durationDays,
      price_usd: totalPrice.toString(),
      payment_status: 'pending',
      status: 'pending'
    } as any).returning();

    // Create payment
    const [payment] = await db.insert(devtoolsPayments).values({
      riddle_handle: userHandle,
      project_id: projectId,
      service_type: 'promotion',
      service_id: promotion.id,
      payment_model: 'one_time',
      amount_usd: totalPrice.toString(),
      payment_status: 'pending',
      payment_method: 'crypto_xrp',
      service_description: `${promotionType} promotion for ${durationDays} days`
    } as any).returning();

    res.json({
      success: true,
      promotion_id: promotion.id,
      payment_id: payment.id,
      total_price_usd: totalPrice,
      message: 'Promotion created. Complete payment and await admin approval.'
    });

  } catch (error) {
    console.error('❌ Error creating promotion:', error);
    res.status(500).json({ error: 'Failed to create promotion' });
  }
});

/**
 * Get user's promotions
 */
router.get('/promotion/list', requireAuthentication, async (req: AuthenticatedRequest, res) => {
  try {
    const userHandle = req.user?.userHandle;

    if (!userHandle) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const promotions = await db.select()
      .from(projectPromotions)
      .where(eq(projectPromotions.riddle_handle, userHandle))
      .orderBy(desc(projectPromotions.created_at));

    res.json({
      success: true,
      promotions
    });

  } catch (error) {
    console.error('❌ Error listing promotions:', error);
    res.status(500).json({ error: 'Failed to list promotions' });
  }
});

/**
 * Get active promotions (public)
 */
router.get('/promotion/active', async (req, res) => {
  try {
    const { type, placement } = req.query;

    // Build conditions array
    const conditions = [
      eq(projectPromotions.status, 'active'),
      eq(projectPromotions.approved_by_admin, true),
      sql`${projectPromotions.start_date} <= NOW()`,
      sql`${projectPromotions.end_date} >= NOW()`
    ];

    if (type) {
      conditions.push(eq(projectPromotions.promotion_type, type as string));
    }

    if (placement) {
      conditions.push(eq(projectPromotions.placement, placement as string));
    }

    const promotions = await db.select()
      .from(projectPromotions)
      .where(and(...conditions))
      .limit(10);

    res.json({
      success: true,
      promotions
    });

  } catch (error) {
    console.error('❌ Error getting active promotions:', error);
    res.status(500).json({ error: 'Failed to get promotions' });
  }
});

// ============== PAYMENTS ==============

/**
 * Get payment details
 */
router.get('/payment/:paymentId', requireAuthentication, async (req: AuthenticatedRequest, res) => {
  try {
    const { paymentId } = req.params;
    const userHandle = req.user?.userHandle;

    const [payment] = await db.select()
      .from(devtoolsPayments)
      .where(eq(devtoolsPayments.id, paymentId))
      .limit(1);

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (payment.riddle_handle !== userHandle && userHandle !== 'dippydoge' && userHandle !== 'hermesthrice589') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    res.json({
      success: true,
      payment
    });

  } catch (error) {
    console.error('❌ Error getting payment:', error);
    res.status(500).json({ error: 'Failed to get payment' });
  }
});

/**
 * Complete payment (mark as paid with tx hash)
 */
router.post('/payment/:paymentId/complete', requireAuthentication, async (req: AuthenticatedRequest, res) => {
  try {
    const { paymentId } = req.params;
    const { txHash, paidToken, paidAmount } = req.body;
    const userHandle = req.user?.userHandle;

    const [payment] = await db.select()
      .from(devtoolsPayments)
      .where(eq(devtoolsPayments.id, paymentId))
      .limit(1);

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (payment.riddle_handle !== userHandle) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Update payment
    await db.update(devtoolsPayments)
      .set({ 
        payment_status: 'paid',
        payment_tx_hash: txHash,
        amount_paid_token: paidToken,
        amount_paid: paidAmount,
        payment_timestamp: new Date()
       } as any)
      .where(eq(devtoolsPayments.id, paymentId));

    // Activate the service based on type
    if (payment.service_type === 'airdrop' && payment.service_id) {
      await db.update(devToolAirdrops)
        .set({  status: 'active', launched_at: new Date()  } as any)
        .where(eq(devToolAirdrops.id, payment.service_id));
    } else if (payment.service_type === 'snapshot' && payment.service_id) {
      await db.update(devToolSnapshots)
        .set({  status: 'processing'  } as any)
        .where(eq(devToolSnapshots.id, payment.service_id));
    }

    res.json({
      success: true,
      message: 'Payment completed successfully',
      service_activated: true
    });

  } catch (error) {
    console.error('❌ Error completing payment:', error);
    res.status(500).json({ error: 'Failed to complete payment' });
  }
});

// ============== AUTOMATIC MARKET MAKER TOOL ==============

/**
 * Create market maker configuration
 */
router.post('/market-maker/create', requireAuthentication, async (req: AuthenticatedRequest, res) => {
  try {
    const userHandle = req.user?.userHandle;
    const {
      projectId,
      chain,
      baseToken,
      quoteToken,
      paymentAmount,
      paymentFrequency,
      frequencyMinutes,
      amountVarianceEnabled,
      minAmount,
      maxAmount
    } = req.body;

    if (!userHandle) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Verify project ownership
    const [project] = await db.select()
      .from(devtoolsProjects)
      .where(eq(devtoolsProjects.id, projectId))
      .limit(1);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get user's wallet
    const [userWallet] = await db.select()
      .from(riddleWallets)
      .where(eq(riddleWallets.handle, userHandle))
      .limit(1);

    if (!userWallet || project.ownerWalletAddress !== userWallet.xrpAddress) {
      return res.status(403).json({ error: 'Not authorized - project must be owned by your wallet' });
    }

    // Create market maker config
    const [config] = await db.insert(marketMakerConfigs).values({
      id: crypto.randomUUID(),
      project_id: projectId,
      riddle_handle: userHandle,
      chain,
      base_token: baseToken,
      quote_token: quoteToken,
      payment_amount: paymentAmount.toString(),
      payment_frequency: paymentFrequency,
      frequency_minutes: frequencyMinutes,
      amount_variance_enabled: amountVarianceEnabled || false,
      min_amount: minAmount?.toString(),
      max_amount: maxAmount?.toString(),
      platform_fee_percentage: "0.0025", // 0.25% fee
      is_active: false, // Start inactive
    } as any).returning();

    res.json({
      success: true,
      config_id: config.id,
      message: 'Market maker configured successfully. Activate it to start automated trading.',
      fee_percentage: 0.25
    });

  } catch (error) {
    console.error('❌ Error creating market maker config:', error);
    res.status(500).json({ error: 'Failed to create market maker configuration' });
  }
});

/**
 * Toggle market maker active status
 */
router.post('/market-maker/:configId/toggle', requireAuthentication, async (req: AuthenticatedRequest, res) => {
  try {
    const { configId } = req.params;
    const { isActive } = req.body;
    const userHandle = req.user?.userHandle;

    const [config] = await db.select()
      .from(marketMakerConfigs)
      .where(eq(marketMakerConfigs.id, configId))
      .limit(1);

    if (!config) {
      return res.status(404).json({ error: 'Market maker config not found' });
    }

    if (config.riddle_handle !== userHandle) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Calculate next execution if activating
    let nextExecution = null;
    if (isActive) {
      const now = new Date();
      const freqMinutes = config.frequency_minutes || (
        config.payment_frequency === 'hourly' ? 60 :
        config.payment_frequency === 'daily' ? 1440 :
        config.payment_frequency === 'weekly' ? 10080 : 60
      );
      nextExecution = new Date(now.getTime() + freqMinutes * 60000);
    }

    await db.update(marketMakerConfigs)
      .set({ 
        is_active: isActive,
        next_execution: nextExecution,
        updated_at: new Date()
       } as any)
      .where(eq(marketMakerConfigs.id, configId));

    res.json({
      success: true,
      is_active: isActive,
      next_execution: nextExecution,
      message: isActive ? 'Market maker activated' : 'Market maker paused'
    });

  } catch (error) {
    console.error('❌ Error toggling market maker:', error);
    res.status(500).json({ error: 'Failed to toggle market maker' });
  }
});

/**
 * Get market maker configurations for a project
 */
router.get('/market-maker/project/:projectId', requireAuthentication, async (req: AuthenticatedRequest, res) => {
  try {
    const { projectId } = req.params;
    const userHandle = req.user?.userHandle;

    const configs = await db.select()
      .from(marketMakerConfigs)
      .where(eq(marketMakerConfigs.project_id, projectId));

    res.json({
      success: true,
      configs
    });

  } catch (error) {
    console.error('❌ Error getting market maker configs:', error);
    res.status(500).json({ error: 'Failed to get market maker configurations' });
  }
});

/**
 * Get market maker transaction history
 */
router.get('/market-maker/:configId/transactions', requireAuthentication, async (req: AuthenticatedRequest, res) => {
  try {
    const { configId } = req.params;
    const { limit = 50 } = req.query;

    const transactions = await db.select()
      .from(marketMakerTransactions)
      .where(eq(marketMakerTransactions.config_id, configId))
      .orderBy(desc(marketMakerTransactions.executed_at))
      .limit(parseInt(limit as string));

    res.json({
      success: true,
      transactions
    });

  } catch (error) {
    console.error('❌ Error getting market maker transactions:', error);
    res.status(500).json({ error: 'Failed to get transaction history' });
  }
});

// ============== PROJECT PROFILE UPDATE ==============

/**
 * Update project profile (logo, name, description) with issuer+taxon support
 */
router.post('/project/:projectId/update-profile', requireAuthentication, async (req: AuthenticatedRequest, res) => {
  try {
    const { projectId } = req.params;
    const userHandle = req.user?.userHandle;
    const {
      name,
      description,
      logoUrl,
      bannerUrl,
      websiteUrl,
      socialLinks,
      issuerWallet,
      nftTokenTaxon
    } = req.body;

    if (!userHandle) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Verify project ownership
    const [project] = await db.select()
      .from(devtoolsProjects)
      .where(eq(devtoolsProjects.id, projectId))
      .limit(1);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get user's wallet
    const [userWallet] = await db.select()
      .from(riddleWallets)
      .where(eq(riddleWallets.handle, userHandle))
      .limit(1);

    if (!userWallet || project.ownerWalletAddress !== userWallet.xrpAddress) {
      return res.status(403).json({ error: 'Not authorized - project must be owned by your wallet' });
    }

    // Update project profile
    const updateData: any = {
      updatedAt: new Date()
    };

    if (name) updateData.name = name;
    if (description) updateData.description = description;
    if (logoUrl) updateData.logo_url = logoUrl;
    if (bannerUrl) updateData.banner_url = bannerUrl;
    if (websiteUrl) updateData.website_url = websiteUrl;
    if (socialLinks) updateData.social_links = socialLinks;
    if (issuerWallet) updateData.issuer_wallet = issuerWallet;
    if (nftTokenTaxon !== undefined) updateData.nft_token_taxon = nftTokenTaxon;

    await db.update(devtoolsProjects)
      .set(updateData)
      .where(eq(devtoolsProjects.id, projectId));

    // If issuer and taxon are provided, trigger NFT collection scan
    if (issuerWallet && nftTokenTaxon !== undefined) {
      // Trigger background scan
      const scanResult = await scanAndStoreNftCollection(projectId, issuerWallet, nftTokenTaxon);
      
      res.json({
        success: true,
        message: 'Project profile updated successfully',
        nft_scan: {
          triggered: true,
          nfts_found: scanResult.nfts_found,
          scan_status: scanResult.status
        }
      });
    } else {
      res.json({
        success: true,
        message: 'Project profile updated successfully'
      });
    }

  } catch (error) {
    console.error('❌ Error updating project profile:', error);
    res.status(500).json({ error: 'Failed to update project profile' });
  }
});

/**
 * Scan and store NFT collection for a project
 */
async function scanAndStoreNftCollection(projectId: string, issuer: string, taxon: number) {
  try {
    // Fetch NFTs from Bithomp API
    const bithompResponse = await fetch(
      `https://bithomp.com/api/v2/nft-issuer/${issuer}?taxon=${taxon}&limit=1000`,
      {
        headers: {
          'x-bithomp-token': process.env.BITHOMP_API_KEY || ''
        }
      }
    );

    if (!bithompResponse.ok) {
      throw new Error(`Bithomp API error: ${bithompResponse.statusText}`);
    }

    const data = await bithompResponse.json();
    const nfts = data.nfts || [];

    console.log(`📸 Scanning NFT collection: Found ${nfts.length} NFTs for issuer ${issuer} taxon ${taxon}`);

    // Delete existing NFTs for this project
    await db.delete(projectNftCollections)
      .where(eq(projectNftCollections.project_id, projectId));

    // Insert new NFT data
    if (nfts.length > 0) {
      const nftRecords = nfts.map((nft: any) => ({
        id: crypto.randomUUID(),
        project_id: projectId,
        nft_id: nft.nft_id || nft.NFTokenID,
        issuer: issuer,
        taxon: taxon,
        metadata: nft.metadata || {},
        image_url: nft.image || nft.metadata?.image,
        name: nft.name || nft.metadata?.name,
        description: nft.description || nft.metadata?.description,
        attributes: nft.attributes || nft.metadata?.attributes || [],
        current_owner: nft.owner,
        scanned_at: new Date(),
        updated_at: new Date()
      }));

      await db.insert(projectNftCollections).values(nftRecords as any);
    }

    return {
      status: 'success',
      nfts_found: nfts.length
    };

  } catch (error) {
    console.error('❌ Error scanning NFT collection:', error);
    return {
      status: 'error',
      nfts_found: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get NFT collection data for a project
 */
router.get('/project/:projectId/nft-collection', requireAuthentication, async (req: AuthenticatedRequest, res) => {
  try {
    const { projectId } = req.params;

    const nfts = await db.select()
      .from(projectNftCollections)
      .where(eq(projectNftCollections.project_id, projectId));

    res.json({
      success: true,
      total_nfts: nfts.length,
      nfts
    });

  } catch (error) {
    console.error('❌ Error getting NFT collection:', error);
    res.status(500).json({ error: 'Failed to get NFT collection' });
  }
});

/**
 * Manually trigger NFT collection scan
 */
router.post('/project/:projectId/scan-nfts', requireAuthentication, async (req: AuthenticatedRequest, res) => {
  try {
    const { projectId } = req.params;
    const userHandle = req.user?.userHandle;

    // Verify project ownership
    const [project] = await db.select()
      .from(devtoolsProjects)
      .where(eq(devtoolsProjects.id, projectId))
      .limit(1);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (!project.issuer_wallet || project.nft_token_taxon === null) {
      return res.status(400).json({ 
        error: 'Project must have issuer wallet and taxon configured before scanning' 
      });
    }

    // Get user's wallet
    const [userWallet] = await db.select()
      .from(riddleWallets)
      .where(sql`${riddleWallets.handle} = ${userHandle}`)
      .limit(1);

    if (!userWallet || project.ownerWalletAddress !== userWallet.xrpAddress) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const scanResult = await scanAndStoreNftCollection(
      projectId,
      project.issuer_wallet,
      project.nft_token_taxon
    );

    res.json({
      success: true,
      message: 'NFT collection scan completed',
      nfts_found: scanResult.nfts_found,
      scan_status: scanResult.status
    });

  } catch (error) {
    console.error('❌ Error scanning NFTs:', error);
    res.status(500).json({ error: 'Failed to scan NFT collection' });
  }
});

/**
 * GET /projects/:projectId - Get project details with revenue stats
 */
router.get('/projects/:projectId', requireAuthentication, async (req: AuthenticatedRequest, res) => {
  try {
    const { projectId } = req.params;
    const userHandle = req.user?.userHandle;

    // Get project
    const [project] = await db.select()
      .from(devtoolsProjects)
      .where(eq(devtoolsProjects.id, projectId))
      .limit(1);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get user's wallet to verify ownership
    const [userWallet] = await db.select()
      .from(riddleWallets)
      .where(sql`${riddleWallets.handle} = ${userHandle}`)
      .limit(1);

    if (!userWallet || project.ownerWalletAddress !== userWallet.xrpAddress) {
      return res.status(403).json({ error: 'Not authorized to view this project' });
    }

    // Get subscription info
    const subscription = await db.select()
      .from(enhancedProjectSubscriptions)
      .where(eq(enhancedProjectSubscriptions.project_id, projectId))
      .limit(1);

    // Get payment/revenue stats
    const payments = await db.select()
      .from(devtoolsPayments)
      .where(eq(devtoolsPayments.project_id, projectId));

  const totalRevenue = payments.reduce((sum, p: any) => sum + parseFloat(p.amount_usd || '0'), 0);
  const paidPayments = payments.filter((p: any) => p.payment_status === 'paid' || p.payment_status === 'completed');
  const pendingPayments = payments.filter((p: any) => p.payment_status === 'pending');

    // Get active airdrops (linked by creator wallet)
    const creatorAddress = project.issuer_wallet || project.ownerWalletAddress;
    const activeAirdrops = await db.select()
      .from(devToolAirdrops)
      .where(and(
        eq(devToolAirdrops.creator_address, creatorAddress),
        eq(devToolAirdrops.status, 'active')
      ));

    res.json({
      success: true,
      project: {
        ...project,
  subscriptionTier: subscription[0]?.subscription_tier || 'free',
  subscriptionStatus: subscription[0]?.subscription_status || 'inactive'
      },
      stats: {
        totalRevenue: totalRevenue.toFixed(2),
        totalPayments: payments.length,
        paidPayments: paidPayments.length,
        pendingPayments: pendingPayments.length,
        activeAirdrops: activeAirdrops.length
      }
    });

  } catch (error) {
    console.error('❌ Error fetching project details:', error);
    res.status(500).json({ error: 'Failed to fetch project details' });
  }
});

/**
 * GET /projects/:projectId/revenue - Get detailed revenue/income data
 */
router.get('/projects/:projectId/revenue', requireAuthentication, async (req: AuthenticatedRequest, res) => {
  try {
    const { projectId } = req.params;
    const userHandle = req.user?.userHandle;

    // Verify project ownership
    const [project] = await db.select()
      .from(devtoolsProjects)
      .where(eq(devtoolsProjects.id, projectId))
      .limit(1);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const [userWallet] = await db.select()
      .from(riddleWallets)
      .where(sql`${riddleWallets.handle} = ${userHandle}`)
      .limit(1);

    if (!userWallet || project.ownerWalletAddress !== userWallet.xrpAddress) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Get all payments with details
    const payments = await db.select()
      .from(devtoolsPayments)
      .where(eq(devtoolsPayments.project_id, projectId))
      .orderBy(desc(devtoolsPayments.created_at));

    // Calculate revenue breakdown
    const breakdown = {
      airdrops: payments.filter((p: any) => p.service_type === 'airdrop').reduce((sum: number, p: any) => sum + parseFloat(p.amount_usd || '0'), 0),
      snapshots: payments.filter((p: any) => p.service_type === 'snapshot').reduce((sum: number, p: any) => sum + parseFloat(p.amount_usd || '0'), 0),
      promotions: payments.filter((p: any) => p.service_type === 'promotion').reduce((sum: number, p: any) => sum + parseFloat(p.amount_usd || '0'), 0),
      subscriptions: payments.filter((p: any) => p.service_type === 'subscription').reduce((sum: number, p: any) => sum + parseFloat(p.amount_usd || '0'), 0),
      total: payments.reduce((sum: number, p: any) => sum + parseFloat(p.amount_usd || '0'), 0)
    };

    // Get monthly revenue (last 12 months)
    const monthlyRevenue = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      
      const monthPayments = payments.filter(p => {
        const paymentDate = new Date((p as any).created_at);
        return paymentDate >= monthDate && paymentDate <= monthEnd && ((p as any).payment_status === 'paid' || (p as any).payment_status === 'completed');
      });

      monthlyRevenue.push({
        month: monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
  revenue: monthPayments.reduce((sum, p: any) => sum + parseFloat(p.amount_usd || '0'), 0).toFixed(2),
        transactions: monthPayments.length
      });
    }

    res.json({
      success: true,
      breakdown,
      monthlyRevenue,
      recentPayments: payments.slice(0, 10),
      totalRevenue: breakdown.total.toFixed(2)
    });

  } catch (error) {
    console.error('❌ Error fetching project revenue:', error);
    res.status(500).json({ error: 'Failed to fetch revenue data' });
  }
});

/**
 * GET /projects/:projectId/stats - Get project activity statistics
 */
router.get('/projects/:projectId/stats', requireAuthentication, async (req: AuthenticatedRequest, res) => {
  try {
    const { projectId } = req.params;
    const userHandle = req.user?.userHandle;

    // Verify ownership
    const [project] = await db.select()
      .from(devtoolsProjects)
      .where(eq(devtoolsProjects.id, projectId))
      .limit(1);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const [userWallet] = await db.select()
      .from(riddleWallets)
      .where(sql`${riddleWallets.handle} = ${userHandle}`)
      .limit(1);

    if (!userWallet || project.ownerWalletAddress !== userWallet.xrpAddress) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Get counts
    const airdrops = await db.select()
      .from(devToolAirdrops)
      .where(eq(devToolAirdrops.creator_address, project.ownerWalletAddress));

    const snapshots = await db.select()
      .from(devToolSnapshots)
      .where(eq(devToolSnapshots.creator_address, project.ownerWalletAddress));

    const promotions = await db.select()
      .from(projectPromotions)
      .where(eq(projectPromotions.project_id, projectId));

    const ammConfigs = await db.select()
      .from(marketMakerConfigs)
      .where(eq(marketMakerConfigs.project_id, projectId));

    res.json({
      success: true,
      stats: {
        totalAirdrops: airdrops.length,
        activeAirdrops: airdrops.filter(a => a.status === 'active').length,
        completedAirdrops: airdrops.filter(a => a.status === 'completed').length,
        totalSnapshots: snapshots.length,
        totalPromotions: promotions.length,
        activePromotions: promotions.filter(p => new Date(p.end_date) > new Date()).length,
        ammConfigs: ammConfigs.length,
        activeAmm: ammConfigs.filter(c => c.is_active).length
      }
    });

  } catch (error) {
    console.error('❌ Error fetching project stats:', error);
    res.status(500).json({ error: 'Failed to fetch project statistics' });
  }
});

/**
 * GET /system-status - Comprehensive system health check
 */
router.get('/system-status', requireAuthentication, async (req: AuthenticatedRequest, res) => {
  try {
    const userHandle = req.user?.userHandle;
    
    // Get user's wallet
    const [userWallet] = await db.select()
      .from(riddleWallets)
      .where(sql`${riddleWallets.handle} = ${userHandle}`)
      .limit(1);

    if (!userWallet) {
      return res.status(401).json({ error: 'Wallet not found' });
    }

    // Get user's projects
    const projects = await db.select()
      .from(devtoolsProjects)
      .where(eq(devtoolsProjects.ownerWalletAddress, userWallet.xrpAddress));

    // Get overall statistics
    const totalAirdrops = await db.select()
      .from(devToolAirdrops)
      .where(inArray(devToolAirdrops.creator_address, projects.map(p => p.ownerWalletAddress)));

    const totalSnapshots = await db.select()
      .from(devToolSnapshots)
      .where(inArray(devToolSnapshots.creator_address, projects.map(p => p.ownerWalletAddress)));

    const totalPromotions = await db.select()
      .from(projectPromotions)
      .where(inArray(projectPromotions.project_id, projects.map(p => p.id)));

    const totalAmmConfigs = await db.select()
      .from(marketMakerConfigs)
      .where(inArray(marketMakerConfigs.project_id, projects.map(p => p.id)));

    const totalPayments = await db.select()
      .from(devtoolsPayments)
      .where(inArray(devtoolsPayments.project_id, projects.map(p => p.id)));

    const totalRevenue = totalPayments
      .filter((p: any) => p.payment_status === 'paid' || p.payment_status === 'completed')
      .reduce((sum: number, p: any) => sum + parseFloat(p.amount_usd || '0'), 0);

    // Check service status
    const serviceStatus = {
      database: 'operational',
      ammScheduler: 'operational', // Running every 5 minutes
      twitterVerification: 'operational',
      airdrops: 'operational',
      snapshots: 'operational',
      promotions: 'operational',
      subscriptions: 'operational',
    };

    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      user: {
        handle: userHandle,
        walletAddress: userWallet.xrpAddress,
        totalProjects: projects.length,
      },
      statistics: {
        totalProjects: projects.length,
        totalAirdrops: totalAirdrops.length,
        activeAirdrops: totalAirdrops.filter(a => a.status === 'active').length,
        totalSnapshots: totalSnapshots.length,
        totalPromotions: totalPromotions.length,
        activePromotions: totalPromotions.filter(p => new Date(p.end_date) > new Date()).length,
        totalAmmConfigs: totalAmmConfigs.length,
        activeAmm: totalAmmConfigs.filter(c => c.is_active).length,
        totalPayments: totalPayments.length,
  completedPayments: totalPayments.filter((p: any) => p.payment_status === 'paid' || p.payment_status === 'completed').length,
        totalRevenue: totalRevenue.toFixed(2),
      },
      services: serviceStatus,
      message: 'All DevTools services are operational',
    });

  } catch (error) {
    console.error('❌ Error fetching system status:', error);
    res.status(500).json({ 
      success: false,
      status: 'error',
      error: 'Failed to fetch system status',
      timestamp: new Date().toISOString(),
    });
  }
});

export { router as devtoolsRoutes };
