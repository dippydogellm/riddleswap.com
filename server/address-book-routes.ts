// Address Book & RiddleHandle Search API
import { Router, Request, Response } from 'express';
import { eq, and, or, like, ilike, desc } from 'drizzle-orm';
import { z } from 'zod';
import { db } from './db';
import { addressBook, gamingPlayers } from '../shared/schema';
import { sessionAuth, type AuthenticatedRequest } from './middleware/session-auth';

const router = Router();

// Search RiddleHandles - returns wallet addresses for a given handle
router.get('/api/riddlehandle/search', sessionAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { query, chain } = req.query;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: 'Search query is required' 
      });
    }

    // Search in gamingPlayers table for user_handle (case-insensitive)
    const searchPattern = `%${query}%`;
    const players = await db
      .select({
        handle: gamingPlayers.user_handle,
        wallet: gamingPlayers.wallet_address,
        chain: gamingPlayers.chain,
        playerName: gamingPlayers.player_name,
        rank: gamingPlayers.gaming_rank,
        totalPower: gamingPlayers.total_power_level,
      })
      .from(gamingPlayers)
      .where(
        and(
          or(
            ilike(gamingPlayers.user_handle, searchPattern),
            ilike(gamingPlayers.player_name, searchPattern)
          ),
          chain ? eq(gamingPlayers.chain, chain as string) : undefined
        )
      )
      .limit(10);

    return res.json({
      success: true,
      results: players.map((p: any) => ({
        riddleHandle: p.handle,
        walletAddress: p.wallet,
        chain: p.chain || 'xrpl',
        displayName: p.playerName || p.handle,
        rank: p.rank,
        powerLevel: p.totalPower,
      }))
    });
  } catch (error) {
    console.error('❌ RiddleHandle search error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to search RiddleHandles' 
    });
  }
});

// Get address book entries for the current user
router.get('/api/address-book', sessionAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userHandle = req.session.userHandle;
    if (!userHandle) {
      return res.status(401).json({ 
        success: false, 
        error: 'User handle not found in session' 
      });
    }

    const { chain } = req.query;

    const entries = await db
      .select()
      .from(addressBook)
      .where(
        and(
          eq(addressBook.user_handle, userHandle),
          chain ? eq(addressBook.chain, chain as string) : undefined
        )
      )
      .orderBy(desc(addressBook.is_favorite), desc(addressBook.updated_at));

    return res.json({
      success: true,
      entries: entries.map((entry: any) => ({
        id: entry.id,
        contactName: entry.contact_name,
        contactHandle: entry.contact_handle,
        address: entry.address,
        chain: entry.chain,
        notes: entry.notes,
        isFavorite: entry.is_favorite,
        createdAt: entry.created_at,
        updatedAt: entry.updated_at,
      }))
    });
  } catch (error) {
    console.error('❌ Get address book error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch address book' 
    });
  }
});

// Add new address book entry
const addEntrySchema = z.object({
  contactName: z.string().min(1).max(100),
  contactHandle: z.string().optional(),
  address: z.string().min(1),
  chain: z.string().min(1),
  notes: z.string().max(500).optional(),
  isFavorite: z.boolean().optional(),
});

router.post('/api/address-book', sessionAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userHandle = req.session.userHandle;
    if (!userHandle) {
      return res.status(401).json({ 
        success: false, 
        error: 'User handle not found in session' 
      });
    }

    const validated = addEntrySchema.parse(req.body);

    // Check if entry already exists
    const existing = await db
      .select()
      .from(addressBook)
      .where(
        and(
          eq(addressBook.user_handle, userHandle),
          eq(addressBook.address, validated.address),
          eq(addressBook.chain, validated.chain)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return res.status(409).json({ 
        success: false, 
        error: 'This address is already in your address book' 
      });
    }

    const [newEntry] = await db
      .insert(addressBook)
      .values({
        user_handle: userHandle,
        contact_name: validated.contactName,
        contact_handle: validated.contactHandle || null,
        address: validated.address,
        chain: validated.chain,
        notes: validated.notes || null,
        is_favorite: validated.isFavorite || false,
      } as any)
      .returning();

    return res.status(201).json({
      success: true,
      entry: {
        id: newEntry.id,
        contactName: newEntry.contact_name,
        contactHandle: newEntry.contact_handle,
        address: newEntry.address,
        chain: newEntry.chain,
        notes: newEntry.notes,
        isFavorite: newEntry.is_favorite,
        createdAt: newEntry.created_at,
        updatedAt: newEntry.updated_at,
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        success: false, 
        error: error.errors[0]?.message || 'Invalid input' 
      });
    }
    console.error('❌ Add address book entry error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to add address book entry' 
    });
  }
});

// Update address book entry
const updateEntrySchema = z.object({
  contactName: z.string().min(1).max(100).optional(),
  contactHandle: z.string().optional(),
  notes: z.string().max(500).optional(),
  isFavorite: z.boolean().optional(),
});

router.patch('/api/address-book/:id', sessionAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userHandle = req.session.userHandle;
    if (!userHandle) {
      return res.status(401).json({ 
        success: false, 
        error: 'User handle not found in session' 
      });
    }

    const entryId = parseInt(req.params.id);
    if (isNaN(entryId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid entry ID' 
      });
    }

    const validated = updateEntrySchema.parse(req.body);

    // Verify ownership
    const [existing] = await db
      .select()
      .from(addressBook)
      .where(
        and(
          eq(addressBook.id, entryId),
          eq(addressBook.user_handle, userHandle)
        )
      )
      .limit(1);

    if (!existing) {
      return res.status(404).json({ 
        success: false, 
        error: 'Address book entry not found' 
      });
    }

    const updateData: any = { updated_at: new Date() };
    if (validated.contactName !== undefined) updateData.contact_name = validated.contactName;
    if (validated.contactHandle !== undefined) updateData.contact_handle = validated.contactHandle;
    if (validated.notes !== undefined) updateData.notes = validated.notes;
    if (validated.isFavorite !== undefined) updateData.is_favorite = validated.isFavorite;

    const [updated] = await db
      .update(addressBook)
      .set(updateData)
      .where(eq(addressBook.id, entryId))
      .returning();

    return res.json({
      success: true,
      entry: {
        id: updated.id,
        contactName: updated.contact_name,
        contactHandle: updated.contact_handle,
        address: updated.address,
        chain: updated.chain,
        notes: updated.notes,
        isFavorite: updated.is_favorite,
        createdAt: updated.created_at,
        updatedAt: updated.updated_at,
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        success: false, 
        error: error.errors[0]?.message || 'Invalid input' 
      });
    }
    console.error('❌ Update address book entry error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to update address book entry' 
    });
  }
});

// Delete address book entry
router.delete('/api/address-book/:id', sessionAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userHandle = req.session.userHandle;
    if (!userHandle) {
      return res.status(401).json({ 
        success: false, 
        error: 'User handle not found in session' 
      });
    }

    const entryId = parseInt(req.params.id);
    if (isNaN(entryId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid entry ID' 
      });
    }

    // Verify ownership and delete
    const result = await db
      .delete(addressBook)
      .where(
        and(
          eq(addressBook.id, entryId),
          eq(addressBook.user_handle, userHandle)
        )
      )
      .returning();

    if (result.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Address book entry not found' 
      });
    }

    return res.json({
      success: true,
      message: 'Address book entry deleted successfully'
    });
  } catch (error) {
    console.error('❌ Delete address book entry error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to delete address book entry' 
    });
  }
});

export default router;
