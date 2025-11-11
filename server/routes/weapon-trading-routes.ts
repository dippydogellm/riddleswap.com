import type { Express } from 'express';
import { db } from '../db';
import { 
  weaponMarketplace, 
  playerNftWeapons, 
  weaponDefinitions, 
  gamingPlayers,
  transactions 
} from '../../shared/schema';
import { eq, and, or, desc, sql } from 'drizzle-orm';
import { requireAuthentication, AuthenticatedRequest } from '../middleware/session-auth';
import crypto from 'crypto';

// RDL Token Configuration
const RDL_ISSUER = 'r9xvnzUWZJpDu3NA6MKHmKhKJQTRqCRgu9';
const RDL_CURRENCY = 'RDL';
const BANK_WALLET_ADDRESS = process.env.BANK_WALLET_ADDRESS || 'rUF9RdcyZ4xMrqEyiqNNjmE28WJkbJvUMf';

// 30 days expiration for listings
const LISTING_EXPIRATION_DAYS = 30;

export function setupWeaponTradingRoutes(app: Express) {
  console.log('⚔️ Registering Weapon Trading routes...');

  // POST /api/weapons/marketplace/list - List a weapon for sale
  app.post('/api/weapons/marketplace/list', requireAuthentication, async (req: AuthenticatedRequest, res) => {
    try {
      const userHandle = req.user?.userHandle;
      if (!userHandle) {
        return res.status(401).json({
          success: false,
          error: 'Not authenticated'
        });
      }

      const { weaponId, priceXrp, description } = req.body;

      if (!weaponId) {
        return res.status(400).json({
          success: false,
          error: 'weaponId is required'
        });
      }

      if (!priceXrp || priceXrp <= 0) {
        return res.status(400).json({
          success: false,
          error: 'priceXrp is required and must be greater than 0'
        });
      }

      // Find the gaming player
      const [player] = await db
        .select()
        .from(gamingPlayers)
        .where(eq(gamingPlayers.user_handle, userHandle))
        .limit(1);

      if (!player) {
        return res.status(404).json({
          success: false,
          error: 'Gaming profile not found'
        });
      }

      // Verify weapon ownership
      const [weapon] = await db
        .select()
        .from(playerNftWeapons)
        .where(and(
          eq(playerNftWeapons.id, weaponId),
          eq(playerNftWeapons.playerId, player.id)
        ))
        .limit(1);

      if (!weapon) {
        return res.status(404).json({
          success: false,
          error: 'Weapon not found or not owned by you'
        });
      }

      // Check if weapon is already listed
      const [existingListing] = await db
        .select()
        .from(weaponMarketplace)
        .where(and(
          eq(weaponMarketplace.weaponId, weaponId),
          eq(weaponMarketplace.status, 'active')
        ))
        .limit(1);

      if (existingListing) {
        return res.status(400).json({
          success: false,
          error: 'Weapon is already listed on the marketplace'
        });
      }

      // Convert price to drops (1 XRP = 1,000,000 drops)
      const priceDropsNumber = Math.floor(priceXrp * 1_000_000);

      // Calculate expiration date (30 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + LISTING_EXPIRATION_DAYS);

      // Create marketplace listing
      const [listing] = await db.insert(weaponMarketplace).values({
        weaponId: weaponId,
        sellerId: player.id,
        sellerXrplAddress: player.wallet_address,
        priceDrops: priceDropsNumber,
        expiresAt: expiresAt
      } as any).returning();

      console.log('✅ [WEAPON TRADING] Listed weapon:', weaponId, 'by', userHandle);

      res.json({
        success: true,
        listing,
        message: 'Weapon listed successfully'
      });

    } catch (error) {
      console.error('❌ [WEAPON TRADING] Error listing weapon:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list weapon',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // POST /api/weapons/marketplace/buy - Buy a weapon with RDL or XRP
  app.post('/api/weapons/marketplace/buy', requireAuthentication, async (req: AuthenticatedRequest, res) => {
    try {
      const userHandle = req.user?.userHandle;
      if (!userHandle) {
        return res.status(401).json({
          success: false,
          error: 'Not authenticated'
        });
      }

      const { listingId, buyerXrplAddress } = req.body;

      if (!listingId || !buyerXrplAddress) {
        return res.status(400).json({
          success: false,
          error: 'listingId and buyerXrplAddress are required'
        });
      }

      // Find the buyer
      const [buyer] = await db
        .select()
        .from(gamingPlayers)
        .where(eq(gamingPlayers.user_handle, userHandle))
        .limit(1);

      if (!buyer) {
        return res.status(404).json({
          success: false,
          error: 'Gaming profile not found'
        });
      }

      // Get the listing with weapon details
      const [listing] = await db
        .select({
          listingId: weaponMarketplace.id,
          weaponId: weaponMarketplace.weaponId,
          sellerId: weaponMarketplace.sellerId,
          sellerXrplAddress: weaponMarketplace.sellerXrplAddress,
          priceDrops: weaponMarketplace.priceDrops,
          status: weaponMarketplace.status,
          // Weapon details
          nftTokenId: playerNftWeapons.nftTokenId,
          weaponName: weaponDefinitions.name,
        })
        .from(weaponMarketplace)
        .innerJoin(playerNftWeapons, eq(weaponMarketplace.weaponId, playerNftWeapons.id))
        .innerJoin(weaponDefinitions, eq(playerNftWeapons.weaponDefinitionId, weaponDefinitions.id))
        .where(eq(weaponMarketplace.id, listingId))
        .limit(1);

      if (!listing) {
        return res.status(404).json({
          success: false,
          error: 'Listing not found'
        });
      }

      if (listing.status !== 'active') {
        return res.status(400).json({
          success: false,
          error: 'Listing is no longer active'
        });
      }

      if (listing.sellerId === buyer.id) {
        return res.status(400).json({
          success: false,
          error: 'Cannot buy your own weapon'
        });
      }

      // Return payment instruction
      const priceInXrp = Number(listing.priceDrops) / 1_000_000;
      
      res.json({
        success: true,
        message: 'Ready to process payment',
        paymentRequired: true,
        paymentDetails: {
          amount: priceInXrp,
          currency: 'XRP',
          recipient: listing.sellerXrplAddress,
          listingId: listing.listingId,
          weaponId: listing.weaponId,
          weaponName: listing.weaponName
        },
        instruction: `Please send ${priceInXrp} XRP to ${listing.sellerXrplAddress} to complete the purchase`
      });

    } catch (error) {
      console.error('❌ [WEAPON TRADING] Error buying weapon:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process purchase',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // POST /api/weapons/marketplace/delist - Remove a weapon from marketplace
  app.post('/api/weapons/marketplace/delist', requireAuthentication, async (req: AuthenticatedRequest, res) => {
    try {
      const userHandle = req.user?.userHandle;
      if (!userHandle) {
        return res.status(401).json({
          success: false,
          error: 'Not authenticated'
        });
      }

      const { listingId } = req.body;

      if (!listingId) {
        return res.status(400).json({
          success: false,
          error: 'listingId is required'
        });
      }

      // Find the gaming player
      const [player] = await db
        .select()
        .from(gamingPlayers)
        .where(eq(gamingPlayers.user_handle, userHandle))
        .limit(1);

      if (!player) {
        return res.status(404).json({
          success: false,
          error: 'Gaming profile not found'
        });
      }

      // Verify ownership and update status
      const [updatedListing] = await db
        .update(weaponMarketplace)
        .set({ 
          status: 'cancelled',
          updatedAt: new Date()
         } as any)
        .where(and(
          eq(weaponMarketplace.id, listingId),
          eq(weaponMarketplace.sellerId, player.id),
          eq(weaponMarketplace.status, 'active')
        ))
        .returning();

      if (!updatedListing) {
        return res.status(404).json({
          success: false,
          error: 'Listing not found or already cancelled'
        });
      }

      console.log('✅ [WEAPON TRADING] Delisted weapon by:', userHandle);

      res.json({
        success: true,
        message: 'Weapon delisted successfully'
      });

    } catch (error) {
      console.error('❌ [WEAPON TRADING] Error delisting weapon:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delist weapon',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /api/weapons/marketplace/detail/:nftTokenId - Get weapon details (PUBLIC for listings, AUTHENTICATED for owned weapons)
  app.get('/api/weapons/marketplace/detail/:nftTokenId', async (req: any, res) => {
    try {
      const { nftTokenId } = req.params;

      if (!nftTokenId) {
        return res.status(400).json({
          success: false,
          error: 'nftTokenId is required'
        });
      }

      // Check if user is authenticated (optional - for owner verification)
      const authHeader = req.headers.authorization;
      let authenticatedHandle: string | null = null;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const { getActiveSession } = await import('../riddle-wallet-auth');
          const sessionToken = authHeader.replace('Bearer ', '');
          const session = getActiveSession(sessionToken);
          if (session && Date.now() <= session.expiresAt) {
            authenticatedHandle = session.handle;
          }
        } catch (e) {
          // Authentication optional, continue without
        }
      }

      // First try to find it in active marketplace listings (PUBLIC DATA)
      const [marketplaceListing] = await db
        .select({
          listingId: weaponMarketplace.id,
          priceDrops: weaponMarketplace.priceDrops,
          listingDescription: weaponMarketplace.description,
          status: weaponMarketplace.status,
          expiresAt: weaponMarketplace.expiresAt,
          listedAt: weaponMarketplace.createdAt,
          sellerHandle: gamingPlayers.user_handle,
          sellerId: weaponMarketplace.sellerId,
          // Weapon details
          weaponId: playerNftWeapons.id,
          nftTokenId: playerNftWeapons.nftTokenId,
          customName: playerNftWeapons.customName,
          imageUrl: playerNftWeapons.imageUrl,
          techLevel: playerNftWeapons.techLevel,
          color: playerNftWeapons.color,
          finalAttack: playerNftWeapons.finalAttack,
          finalDefense: playerNftWeapons.finalDefense,
          createdAt: playerNftWeapons.createdAt,
          playerId: playerNftWeapons.playerId,
          // Definition
          definitionId: weaponDefinitions.id,
          weaponName: weaponDefinitions.name,
          weaponType: weaponDefinitions.weaponType,
          weaponCategory: weaponDefinitions.category,
          rarity: weaponDefinitions.rarity,
          description: weaponDefinitions.description,
          baseAttack: weaponDefinitions.baseAttack,
          baseDefense: weaponDefinitions.baseDefense,
        })
        .from(weaponMarketplace)
        .innerJoin(playerNftWeapons, eq(weaponMarketplace.weaponId, playerNftWeapons.id))
        .innerJoin(weaponDefinitions, eq(playerNftWeapons.weaponDefinitionId, weaponDefinitions.id))
        .innerJoin(gamingPlayers, eq(weaponMarketplace.sellerId, gamingPlayers.id))
        .where(and(
          eq(playerNftWeapons.nftTokenId, nftTokenId),
          eq(weaponMarketplace.status, 'active')
        ))
        .limit(1);

      if (marketplaceListing) {
        // Check if the authenticated user is the owner
        let isOwner = false;
        if (authenticatedHandle) {
          const [ownerPlayer] = await db
            .select()
            .from(gamingPlayers)
            .where(and(
              eq(gamingPlayers.user_handle, authenticatedHandle),
              eq(gamingPlayers.id, marketplaceListing.playerId)
            ))
            .limit(1);
          isOwner = !!ownerPlayer;
        }

        return res.json({
          success: true,
          weapon: marketplaceListing,
          isListed: true,
          isOwner: isOwner
        });
      }

      // If not in marketplace, check if user is authenticated and owns the weapon
      if (authenticatedHandle) {
        const [player] = await db
          .select()
          .from(gamingPlayers)
          .where(eq(gamingPlayers.user_handle, authenticatedHandle))
          .limit(1);

        if (player) {
          const [ownedWeapon] = await db
            .select({
              weaponId: playerNftWeapons.id,
              nftTokenId: playerNftWeapons.nftTokenId,
              customName: playerNftWeapons.customName,
              imageUrl: playerNftWeapons.imageUrl,
              techLevel: playerNftWeapons.techLevel,
              color: playerNftWeapons.color,
              finalAttack: playerNftWeapons.finalAttack,
              finalDefense: playerNftWeapons.finalDefense,
              isEquipped: playerNftWeapons.isEquipped,
              createdAt: playerNftWeapons.createdAt,
              playerId: playerNftWeapons.playerId,
              // Definition
              definitionId: weaponDefinitions.id,
              weaponName: weaponDefinitions.name,
              weaponType: weaponDefinitions.weaponType,
              weaponCategory: weaponDefinitions.category,
              rarity: weaponDefinitions.rarity,
              description: weaponDefinitions.description,
              baseAttack: weaponDefinitions.baseAttack,
              baseDefense: weaponDefinitions.baseDefense,
            })
            .from(playerNftWeapons)
            .innerJoin(weaponDefinitions, eq(playerNftWeapons.weaponDefinitionId, weaponDefinitions.id))
            .where(and(
              eq(playerNftWeapons.nftTokenId, nftTokenId),
              eq(playerNftWeapons.playerId, player.id)
            ))
            .limit(1);

          if (ownedWeapon) {
            return res.json({
              success: true,
              weapon: ownedWeapon,
              isListed: false,
              isOwner: true
            });
          }
        }
      }

      // Not found in marketplace and not owned by authenticated user
      return res.status(404).json({
        success: false,
        error: 'Weapon not found',
        message: 'This weapon is not available on the marketplace'
      });

    } catch (error) {
      console.error('❌ [WEAPON TRADING] Error fetching weapon detail:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch weapon details',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /api/weapons/marketplace/my-listings - Get user's active listings
  app.get('/api/weapons/marketplace/my-listings', requireAuthentication, async (req: AuthenticatedRequest, res) => {
    try {
      const userHandle = req.user?.userHandle;
      if (!userHandle) {
        return res.status(401).json({
          success: false,
          error: 'Not authenticated'
        });
      }

      // Find the gaming player
      const [player] = await db
        .select()
        .from(gamingPlayers)
        .where(eq(gamingPlayers.user_handle, userHandle))
        .limit(1);

      if (!player) {
        return res.json({
          success: true,
          listings: []
        });
      }

      // Get all listings for this player
      const listings = await db
        .select({
          listingId: weaponMarketplace.id,
          priceDrops: weaponMarketplace.priceDrops,
          description: weaponMarketplace.description,
          status: weaponMarketplace.status,
          expiresAt: weaponMarketplace.expiresAt,
          createdAt: weaponMarketplace.createdAt,
          // Weapon details
          weaponId: playerNftWeapons.id,
          nftTokenId: playerNftWeapons.nftTokenId,
          customName: playerNftWeapons.customName,
          imageUrl: playerNftWeapons.imageUrl,
          techLevel: playerNftWeapons.techLevel,
          color: playerNftWeapons.color,
          finalAttack: playerNftWeapons.finalAttack,
          finalDefense: playerNftWeapons.finalDefense,
          // Definition
          weaponName: weaponDefinitions.name,
          weaponType: weaponDefinitions.weaponType,
          rarity: weaponDefinitions.rarity,
        })
        .from(weaponMarketplace)
        .innerJoin(playerNftWeapons, eq(weaponMarketplace.weaponId, playerNftWeapons.id))
        .innerJoin(weaponDefinitions, eq(playerNftWeapons.weaponDefinitionId, weaponDefinitions.id))
        .where(eq(weaponMarketplace.sellerId, player.id))
        .orderBy(desc(weaponMarketplace.createdAt));

      res.json({
        success: true,
        listings
      });

    } catch (error) {
      console.error('❌ [WEAPON TRADING] Error fetching listings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch listings',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  console.log('✅ Weapon Trading routes registered successfully');
}
