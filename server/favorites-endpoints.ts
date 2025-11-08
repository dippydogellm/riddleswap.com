// Favorites and Likes Endpoints - Session-based user favorites for NFT collections
import { Router } from 'express';
import { db } from './db';
import { userFavorites, collectionLikes } from '../shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getActiveSession } from './riddle-wallet-auth';

export const router = Router();

// ==============================================================================
// COLLECTION LIKES - Anonymous like counter for collections
// ==============================================================================

// Get like count for a collection
router.get('/api/collection-likes/:issuer/:taxon', async (req, res) => {
  try {
    const { issuer, taxon } = req.params;
    
    // Find existing like record
    const [likeRecord] = await db
      .select()
      .from(collectionLikes)
      .where(and(
        eq(collectionLikes.collection_issuer, issuer),
        eq(collectionLikes.collection_taxon, parseInt(taxon))
      ));
    
    const likeCount = likeRecord?.like_count || 0;
    
    res.json({
      success: true,
      likes: likeCount,
      collection: `${issuer}:${taxon}`
    });
  } catch (error) {
    console.error('❌ [LIKES] Error getting like count:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get like count'
    });
  }
});

// Increment like count for a collection (public endpoint)
router.post('/api/collection-likes/:issuer/:taxon/like', async (req, res) => {
  try {
    const { issuer, taxon } = req.params;
    
    // Check if like record exists, create or update
    const [existingRecord] = await db
      .select()
      .from(collectionLikes)
      .where(and(
        eq(collectionLikes.collection_issuer, issuer),
        eq(collectionLikes.collection_taxon, parseInt(taxon))
      ));
    
    if (existingRecord) {
      // Update existing record
      await db
        .update(collectionLikes)
        .set({ 
          like_count: existingRecord.like_count + 1,
          updated_at: new Date()
         } as any)
        .where(eq(collectionLikes.id, existingRecord.id));
      
      res.json({
        success: true,
        likes: existingRecord.like_count + 1,
        action: 'liked'
      });
    } else {
      // Create new record
      const [newRecord] = await db
        .insert(collectionLikes)
        .values({
          collection_issuer: issuer,
          collection_taxon: parseInt(taxon as any),
          like_count: 1
        })
        .returning();
      
      res.json({
        success: true,
        likes: 1,
        action: 'liked'
      });
    }
    
    console.log(`👍 [LIKES] Collection ${issuer}:${taxon} liked`);
  } catch (error) {
    console.error('❌ [LIKES] Error liking collection:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to like collection'
    });
  }
});

// ==============================================================================
// USER FAVORITES - Session-based favorites management
// ==============================================================================

// Get user's favorites (requires session)
router.get('/api/user-favorites', async (req, res) => {
  try {
    const sessionToken = req.headers['x-session-token'] as string;
    
    if (!sessionToken) {
      return res.status(401).json({
        success: false,
        error: 'No session token provided'
      });
    }
    
    const session = getActiveSession(sessionToken);
    if (!session) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired session'
      });
    }
    
    // Get user's favorites
    const favorites = await db
      .select()
      .from(userFavorites)
      .where(eq(userFavorites.session_token, sessionToken))
      .orderBy(desc(userFavorites.created_at));
    
    console.log(`📋 [FAVORITES] Retrieved ${favorites.length} favorites for session`);
    
    res.json({
      success: true,
      favorites: favorites.map(fav => ({
        issuer: fav.collection_issuer,
        taxon: fav.collection_taxon,
        name: fav.collection_name,
        image: fav.collection_image,
        created_at: fav.created_at
      }))
    });
  } catch (error) {
    console.error('❌ [FAVORITES] Error getting favorites:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get favorites'
    });
  }
});

// Add collection to favorites (requires session)
router.post('/api/user-favorites/:issuer/:taxon', async (req, res) => {
  try {
    const { issuer, taxon } = req.params;
    const { name, image } = req.body;
    const sessionToken = req.headers['x-session-token'] as string;
    
    if (!sessionToken) {
      return res.status(401).json({
        success: false,
        error: 'No session token provided'
      });
    }
    
    const session = getActiveSession(sessionToken);
    if (!session) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired session'
      });
    }
    
    // Check if already favorited
    const [existing] = await db
      .select()
      .from(userFavorites)
      .where(and(
        eq(userFavorites.session_token, sessionToken),
        eq(userFavorites.collection_issuer, issuer),
        eq(userFavorites.collection_taxon, parseInt(taxon))
      ));
    
    if (existing) {
      return res.json({
        success: true,
        action: 'already_favorited',
        message: 'Collection already in favorites'
      });
    }
    
    // Add to favorites
    await db
      .insert(userFavorites)
      .values({
        session_token: sessionToken,
        collection_issuer: issuer,
        collection_taxon: parseInt(taxon as any),
        collection_name: name,
        collection_image: image
      });
    
    console.log(`⭐ [FAVORITES] Added ${issuer}:${taxon} to favorites`);
    
    res.json({
      success: true,
      action: 'added',
      message: 'Collection added to favorites'
    });
  } catch (error) {
    console.error('❌ [FAVORITES] Error adding favorite:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add to favorites'
    });
  }
});

// Remove collection from favorites (requires session)
router.delete('/api/user-favorites/:issuer/:taxon', async (req, res) => {
  try {
    const { issuer, taxon } = req.params;
    const sessionToken = req.headers['x-session-token'] as string;
    
    if (!sessionToken) {
      return res.status(401).json({
        success: false,
        error: 'No session token provided'
      });
    }
    
    const session = getActiveSession(sessionToken);
    if (!session) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired session'
      });
    }
    
    // Remove from favorites
    const result = await db
      .delete(userFavorites)
      .where(and(
        eq(userFavorites.session_token, sessionToken),
        eq(userFavorites.collection_issuer, issuer),
        eq(userFavorites.collection_taxon, parseInt(taxon))
      ));
    
    console.log(`💔 [FAVORITES] Removed ${issuer}:${taxon} from favorites`);
    
    res.json({
      success: true,
      action: 'removed',
      message: 'Collection removed from favorites'
    });
  } catch (error) {
    console.error('❌ [FAVORITES] Error removing favorite:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove from favorites'
    });
  }
});

// Check if collection is favorited (requires session)
router.get('/api/user-favorites/:issuer/:taxon/check', async (req, res) => {
  try {
    const { issuer, taxon } = req.params;
    const sessionToken = req.headers['x-session-token'] as string;
    
    if (!sessionToken) {
      return res.json({
        success: true,
        is_favorited: false,
        message: 'No session'
      });
    }
    
    const session = getActiveSession(sessionToken);
    if (!session) {
      return res.json({
        success: true,
        is_favorited: false,
        message: 'Invalid session'
      });
    }
    
    // Check if favorited
    const [existing] = await db
      .select()
      .from(userFavorites)
      .where(and(
        eq(userFavorites.session_token, sessionToken),
        eq(userFavorites.collection_issuer, issuer),
        eq(userFavorites.collection_taxon, parseInt(taxon))
      ));
    
    res.json({
      success: true,
      is_favorited: !!existing
    });
  } catch (error) {
    console.error('❌ [FAVORITES] Error checking favorite status:', error);
    res.json({
      success: true,
      is_favorited: false,
      error: 'Failed to check status'
    });
  }
});