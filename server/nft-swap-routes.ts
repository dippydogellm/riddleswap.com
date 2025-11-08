import { Router } from 'express';
import { db } from './db';
import { 
  nftSwapOffers, nftSwapMatches, bankWallets, messagingLinks, riddleWallets, riddleWalletSessions,
  type NftSwapOffer, type NftSwapMatch, type InsertNftSwapOffer, type InsertNftSwapMatch
} from '../shared/schema';
import { eq, desc, and, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { validateSession } from './middleware/security';

const router = Router();

// Input validation schemas
const createSwapOfferSchema = z.object({
  offeredItems: z.array(z.object({
    chain: z.string().min(1),
    contract: z.string().min(1),
    tokenId: z.string().min(1),
    name: z.string().optional(),
    image: z.string().optional(),
    estimatedValue: z.number().optional()
  })).min(1),
  wantedItems: z.array(z.object({
    chain: z.string().optional(),
    contract: z.string().optional(),
    tokenId: z.string().optional(),
    description: z.string().min(1),
    minEstimatedValue: z.number().optional()
  })).min(1),
  description: z.string().optional(),
  expiresAt: z.string().optional(), // ISO date string
  isPrivateOffer: z.boolean().optional().default(false),
  privateOfferTarget: z.string().optional()
});

const acceptSwapOfferSchema = z.object({
  offerId: z.string().min(1),
  takerItems: z.array(z.object({
    chain: z.string().min(1),
    contract: z.string().min(1),
    tokenId: z.string().min(1),
    name: z.string().optional(),
    image: z.string().optional(),
    estimatedValue: z.number().optional()
  })).min(1),
  takerEscrowTransactionHash: z.string().min(1) // Hash of transaction depositing NFTs to escrow
});

// Utility function to verify NFT ownership
async function verifyNftOwnership(items: Array<{ chain: string; contract: string; tokenId: string }>, userHandle: string): Promise<boolean> {
  // This would integrate with blockchain APIs to verify ownership
  // For now, return true for demo purposes
  // TODO: Implement real ownership verification via XRPL, Ethereum APIs
  console.log(`🔍 [NFT SWAP] Verifying ownership for user ${userHandle} of ${items.length} NFTs`);
  return true;
}

// Utility function to get available bank wallet for escrow
async function getEscrowWallet(chain: string): Promise<{ address: string; id: string } | null> {
  const [bankWallet] = await db
    .select()
    .from(bankWallets)
    .where(and(
      eq(bankWallets.chain, chain),
      eq(bankWallets.isActive, true)
    ))
    .limit(1);
  
  if (!bankWallet) {
    console.warn(`⚠️ [NFT SWAP] No available escrow wallet for chain: ${chain}`);
    return null;
  }
  
  return {
    address: bankWallet.address,
    id: bankWallet.id
  };
}

// ============== NFT SWAP MARKETPLACE ==============

// GET /api/nft-swaps - Get swap offers with filtering
router.get('/', async (req, res) => {
  try {
    const { status, maker, taker, limit = 50, offset = 0 } = req.query;
    console.log(`🔍 [NFT SWAPS] Fetching swap offers with filters:`, { status, maker, taker });

    let query = db.select().from(nftSwapOffers);
    const conditions = [];
    
    // Apply filters
    if (status && typeof status === 'string') {
      conditions.push(eq(nftSwapOffers.status, status));
    }
    
    if (maker && typeof maker === 'string') {
      conditions.push(eq(nftSwapOffers.makerHandle, maker));
    }
    
    if (taker && typeof taker === 'string') {
      conditions.push(eq(nftSwapOffers.takerHandle, taker));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const swapLimit = Math.min(parseInt(limit as string) || 50, 100);
    const swapOffset = parseInt(offset as string) || 0;
    
    const offers = await query
      .orderBy(desc(nftSwapOffers.createdAt))
      .limit(swapLimit)
      .offset(swapOffset);

    // Enhance offers with additional data
    const enhancedOffers = offers.map(offer => {
      const now = new Date();
      const isExpired = offer.expiresAt && now > offer.expiresAt;
      
      return {
        ...offer,
        isExpired,
        offeredItemsCount: Array.isArray(offer.offeredItems) ? offer.offeredItems.length : 0,
        wantedItemsCount: Array.isArray(offer.wantedItems) ? offer.wantedItems.length : 0,
      };
    });

    console.log(`✅ [NFT SWAPS] Retrieved ${offers.length} swap offers`);
    res.json({
      success: true,
      offers: enhancedOffers,
      pagination: {
        limit: swapLimit,
        offset: swapOffset,
        total: offers.length
      }
    });

  } catch (error) {
    console.error('❌ [NFT SWAPS] Error fetching offers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch swap offers'
    });
  }
});

// GET /api/nft-swaps/:id - Get specific swap offer details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🔍 [NFT SWAP] Fetching offer details: ${id}`);

    const [offer] = await db
      .select()
      .from(nftSwapOffers)
      .where(eq(nftSwapOffers.id, id));

    if (!offer) {
      return res.status(404).json({
        success: false,
        error: 'Swap offer not found'
      });
    }

    // Get related matches
    const matches = await db
      .select()
      .from(nftSwapMatches)
      .where(eq(nftSwapMatches.offerId, id))
      .orderBy(desc(nftSwapMatches.createdAt));

    // Check if offer is expired
    const now = new Date();
    const isExpired = offer.expiresAt && now > offer.expiresAt;

    const enhancedOffer = {
      ...offer,
      isExpired,
      matchesCount: matches.length,
      matches: matches.map(match => ({
        ...match,
        createdAt: match.createdAt
      }))
    };

    console.log(`✅ [NFT SWAP] Retrieved offer details`);
    res.json({
      success: true,
      offer: enhancedOffer
    });

  } catch (error) {
    console.error('❌ [NFT SWAP] Error fetching offer details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch swap offer details'
    });
  }
});

// POST /api/nft-swaps - Create new swap offer
router.post('/', validateSession, async (req, res) => {
  try {
    const sessionToken = req.headers.authorization?.replace('Bearer ', '');
    if (!sessionToken) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    console.log('🆕 [NFT SWAP] Creating new swap offer');

    const validation = createSwapOfferSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid swap offer data',
        details: validation.error.errors
      });
    }

    const {
      offeredItems, wantedItems, description, expiresAt,
      isPrivateOffer, privateOfferTarget
    } = validation.data;

    // Get user from session - find session first, then wallet
    const sessionResult = await db.query.riddleWalletSessions.findFirst({
      where: eq(riddleWalletSessions.sessionToken, sessionToken),
      with: {
        wallet: true
      }
    });

    if (!sessionResult || !sessionResult.wallet) {
      return res.status(401).json({ success: false, error: 'Invalid session' });
    }

    const walletData = sessionResult.wallet;

    const userHandle = walletData.handle;
    // Determine primary chain from offered items
    const primaryChain = offeredItems[0].chain;
    const userAddress = walletData[primaryChain + 'Address'] || walletData.xrpAddress;

    if (!userAddress) {
      return res.status(400).json({
        success: false,
        error: `No ${primaryChain} address found for user`
      });
    }

    // Verify user owns the NFTs they're offering
    const ownsOfferedNfts = await verifyNftOwnership(offeredItems, userHandle);
    if (!ownsOfferedNfts) {
      return res.status(400).json({
        success: false,
        error: 'You do not own all the NFTs you are trying to offer'
      });
    }

    // Get escrow wallet for this chain
    const escrowWallet = await getEscrowWallet(primaryChain);
    if (!escrowWallet) {
      return res.status(503).json({
        success: false,
        error: 'No escrow service available for this chain'
      });
    }

    // Create the swap offer
    const offerData: InsertNftSwapOffer = {
      makerHandle: userHandle,
      makerWallet: userAddress,
      offeredItems: offeredItems,
      wantedItems: wantedItems,
      description,
      status: 'open',
      escrowRef: escrowWallet.id,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      isPrivateOffer: isPrivateOffer || false,
      privateOfferTarget
    };

    const [newOffer] = await db
      .insert(nftSwapOffers)
      .values(offerData as any)
      .returning();

    console.log(`✅ [NFT SWAP] Created swap offer: ${newOffer.id}`);
    res.json({
      success: true,
      offer: newOffer,
      escrowInstructions: {
        address: escrowWallet.address,
        message: `Send your NFTs to this escrow address. Reference: ${newOffer.id}`,
        requiredConfirmations: 1
      }
    });

  } catch (error) {
    console.error('❌ [NFT SWAP] Error creating offer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create swap offer'
    });
  }
});

// POST /api/nft-swaps/:id/accept - Accept swap offer
router.post('/:id/accept', validateSession, async (req, res) => {
  try {
    const sessionToken = req.headers.authorization?.replace('Bearer ', '');
    if (!sessionToken) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const { id } = req.params;
    console.log(`🤝 [NFT SWAP] Accepting swap offer: ${id}`);

    const validation = acceptSwapOfferSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid acceptance data',
        details: validation.error.errors
      });
    }

    const { takerItems, takerEscrowTransactionHash } = validation.data;

    // Get the swap offer
    const [offer] = await db
      .select()
      .from(nftSwapOffers)
      .where(eq(nftSwapOffers.id, id));

    if (!offer) {
      return res.status(404).json({
        success: false,
        error: 'Swap offer not found'
      });
    }

    if (offer.status !== 'open') {
      return res.status(400).json({
        success: false,
        error: 'Swap offer is no longer available'
      });
    }

    // Check if offer is expired
    if (offer.expiresAt && new Date() > offer.expiresAt) {
      await db
        .update(nftSwapOffers)
        .set({  status: 'expired', updatedAt: new Date()  } as any)
        .where(eq(nftSwapOffers.id, id));

      return res.status(400).json({
        success: false,
        error: 'Swap offer has expired'
      });
    }

    // Get user from session - find session first, then wallet
    const sessionResult = await db.query.riddleWalletSessions.findFirst({
      where: eq(riddleWalletSessions.sessionToken, sessionToken),
      with: {
        wallet: true
      }
    });

    if (!sessionResult || !sessionResult.wallet) {
      return res.status(401).json({ success: false, error: 'Invalid session' });
    }

    const walletData = sessionResult.wallet;
    const userHandle = walletData.handle;
    const primaryChain = takerItems[0].chain;
    const userAddress = walletData[primaryChain + 'Address'] || walletData.xrpAddress;

    if (!userAddress) {
      return res.status(400).json({
        success: false,
        error: `No ${primaryChain} address found for user`
      });
    }

    // Can't accept your own offer
    if (offer.makerHandle === userHandle) {
      return res.status(400).json({
        success: false,
        error: 'Cannot accept your own swap offer'
      });
    }

    // Verify user owns the NFTs they're offering in return
    const ownsOfferedNfts = await verifyNftOwnership(takerItems, userHandle);
    if (!ownsOfferedNfts) {
      return res.status(400).json({
        success: false,
        error: 'You do not own all the NFTs you are offering'
      });
    }

    // Create the match record
    const matchData: InsertNftSwapMatch = {
      offerId: id,
      takerHandle: userHandle,
      takerWallet: userAddress,
      takerItems: takerItems,
      status: 'pending',
      takerEscrowTransactionHash,
      escrowRef: offer.escrowRef
    };

    const [newMatch] = await db
      .insert(nftSwapMatches)
      .values(matchData as any)
      .returning();

    // Update offer status to matched
    await db
      .update(nftSwapOffers)
      .set({  
        status: 'matched',
        takerHandle: userHandle,
        takerWallet: userAddress,
        matchedAt: new Date(),
        updatedAt: new Date()
       } as any)
      .where(eq(nftSwapOffers.id, id));

    // Create messaging link for communication between parties
    const messagingLinkData = {
      targetType: 'nft_swap',
      targetId: id,
      ownerHandle: offer.makerHandle,
      ownerWallet: offer.makerWallet,
      title: `NFT Swap: ${offer.description || 'Untitled'}`,
      description: `Swap between ${offer.makerHandle} and ${userHandle}`
    };

    await db
      .insert(messagingLinks)
      .values(messagingLinkData as any);

    console.log(`✅ [NFT SWAP] Accepted swap offer: ${id}, created match: ${newMatch.id}`);
    res.json({
      success: true,
      match: newMatch,
      message: 'Swap offer accepted! Both parties must now deposit their NFTs to complete the trade.',
      nextSteps: {
        maker: 'The original offer maker must deposit their NFTs to escrow',
        taker: 'Wait for maker to deposit, then the swap will be completed automatically',
        messagingEnabled: true
      }
    });

  } catch (error) {
    console.error('❌ [NFT SWAP] Error accepting offer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to accept swap offer'
    });
  }
});

// POST /api/nft-swaps/:id/cancel - Cancel swap offer
router.post('/:id/cancel', validateSession, async (req, res) => {
  try {
    const sessionToken = req.headers.authorization?.replace('Bearer ', '');
    if (!sessionToken) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const { id } = req.params;
    console.log(`❌ [NFT SWAP] Cancelling swap offer: ${id}`);

    // Get user from session - find session first, then wallet
    const sessionResult = await db.query.riddleWalletSessions.findFirst({
      where: eq(riddleWalletSessions.sessionToken, sessionToken),
      with: {
        wallet: true
      }
    });

    if (!sessionResult || !sessionResult.wallet) {
      return res.status(401).json({ success: false, error: 'Invalid session' });
    }

    const walletData = sessionResult.wallet;
    const userHandle = walletData.handle;

    // Get the swap offer
    const [offer] = await db
      .select()
      .from(nftSwapOffers)
      .where(eq(nftSwapOffers.id, id));

    if (!offer) {
      return res.status(404).json({
        success: false,
        error: 'Swap offer not found'
      });
    }

    // Only the maker can cancel their own offer
    if (offer.makerHandle !== userHandle) {
      return res.status(403).json({
        success: false,
        error: 'Only the offer creator can cancel this swap'
      });
    }

    // Can only cancel open offers
    if (offer.status !== 'open') {
      return res.status(400).json({
        success: false,
        error: 'Swap offer cannot be cancelled in its current state'
      });
    }

    // Update offer status to cancelled
    await db
      .update(nftSwapOffers)
      .set({  
        status: 'cancelled',
        updatedAt: new Date()
       } as any)
      .where(eq(nftSwapOffers.id, id));

    console.log(`✅ [NFT SWAP] Cancelled swap offer: ${id}`);
    res.json({
      success: true,
      message: 'Swap offer cancelled successfully'
    });

  } catch (error) {
    console.error('❌ [NFT SWAP] Error cancelling offer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel swap offer'
    });
  }
});

// GET /api/nft-swaps/:id/status - Check swap status with detailed information
router.get('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📊 [NFT SWAP] Checking swap status: ${id}`);

    const [offer] = await db
      .select()
      .from(nftSwapOffers)
      .where(eq(nftSwapOffers.id, id));

    if (!offer) {
      return res.status(404).json({
        success: false,
        error: 'Swap offer not found'
      });
    }

    // Get related matches
    const matches = await db
      .select()
      .from(nftSwapMatches)
      .where(eq(nftSwapMatches.offerId, id))
      .orderBy(desc(nftSwapMatches.createdAt));

    // Determine detailed status
    let detailedStatus = offer.status;
    let nextAction = '';

    switch (offer.status) {
      case 'open':
        detailedStatus = 'Waiting for taker';
        nextAction = 'Someone needs to accept this swap offer';
        break;
      case 'matched':
        const activeMatch = matches.find(m => m.status === 'pending');
        if (activeMatch) {
          detailedStatus = 'Awaiting escrow deposits';
          nextAction = 'Both parties must deposit NFTs to escrow';
        }
        break;
      case 'completed':
        detailedStatus = 'Swap completed successfully';
        nextAction = 'Trade completed';
        break;
      case 'cancelled':
        detailedStatus = 'Swap cancelled by creator';
        nextAction = 'No further action needed';
        break;
      case 'expired':
        detailedStatus = 'Swap offer expired';
        nextAction = 'No further action needed';
        break;
    }

    // Check if offer is expired but not marked as such
    if (offer.status === 'open' && offer.expiresAt && new Date() > offer.expiresAt) {
      await db
        .update(nftSwapOffers)
        .set({  status: 'expired', updatedAt: new Date()  } as any)
        .where(eq(nftSwapOffers.id, id));
      
      detailedStatus = 'Swap offer expired';
      nextAction = 'No further action needed';
    }

    const statusInfo = {
      offerId: id,
      status: offer.status,
      detailedStatus,
      nextAction,
      createdAt: offer.createdAt,
      updatedAt: offer.updatedAt,
      expiresAt: offer.expiresAt,
      isExpired: offer.expiresAt && new Date() > offer.expiresAt,
      maker: {
        handle: offer.makerHandle,
        wallet: offer.makerWallet
      },
      taker: offer.takerHandle ? {
        handle: offer.takerHandle,
        wallet: offer.takerWallet
      } : null,
      escrow: {
        ref: offer.escrowRef
      },
      matches: matches.map(match => ({
        id: match.id,
        status: match.status,
        takerHandle: match.takerHandle,
        createdAt: match.createdAt,
        takerEscrowTxHash: match.takerEscrowTransactionHash,
        completionTxHash: match.completionTransactionHash
      }))
    };

    console.log(`✅ [NFT SWAP] Retrieved status for offer: ${id}`);
    res.json({
      success: true,
      statusInfo
    });

  } catch (error) {
    console.error('❌ [NFT SWAP] Error checking status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check swap status'
    });
  }
});

// GET /api/nft-swaps/user/:handle - Get user's swap offers and matches
router.get('/user/:handle', async (req, res) => {
  try {
    const { handle } = req.params;
    const { type = 'all' } = req.query; // 'made', 'taken', 'all'
    
    console.log(`👤 [NFT SWAP] Fetching swaps for user: ${handle}`);

    let madeOffers: any[] = [];
    let takenOffers: any[] = [];

    if (type === 'made' || type === 'all') {
      madeOffers = await db
        .select()
        .from(nftSwapOffers)
        .where(eq(nftSwapOffers.makerHandle, handle))
        .orderBy(desc(nftSwapOffers.createdAt));
    }

    if (type === 'taken' || type === 'all') {
      takenOffers = await db
        .select()
        .from(nftSwapOffers)
        .where(eq(nftSwapOffers.takerHandle, handle))
        .orderBy(desc(nftSwapOffers.createdAt));
    }

    // Get user's matches as well
    const matches = await db
      .select()
      .from(nftSwapMatches)
      .where(eq(nftSwapMatches.takerHandle, handle))
      .orderBy(desc(nftSwapMatches.createdAt));

    const userSwaps = {
      madeOffers: madeOffers.map(offer => ({
        ...offer,
        role: 'maker',
        isExpired: offer.expiresAt && new Date() > offer.expiresAt
      })),
      takenOffers: takenOffers.map(offer => ({
        ...offer,
        role: 'taker',
        isExpired: offer.expiresAt && new Date() > offer.expiresAt
      })),
      matches: matches.map(match => ({
        ...match,
        role: 'taker'
      })),
      summary: {
        totalMade: madeOffers.length,
        totalTaken: takenOffers.length,
        totalMatches: matches.length,
        activeOffers: [...madeOffers, ...takenOffers].filter(o => o.status === 'open').length,
        completedSwaps: [...madeOffers, ...takenOffers].filter(o => o.status === 'completed').length
      }
    };

    console.log(`✅ [NFT SWAP] Retrieved swaps for user: ${handle}`);
    res.json({
      success: true,
      userSwaps
    });

  } catch (error) {
    console.error('❌ [NFT SWAP] Error fetching user swaps:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user swap data'
    });
  }
});

export default router;