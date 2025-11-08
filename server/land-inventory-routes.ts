/**
 * Land Inventory Routes - Manage NFTs, buildings, weapons on land plots
 */

import { Router } from 'express';
import { db } from './db';
import { landInventory, medievalLandPlots } from '../shared/schema';
import { eq, and } from 'drizzle-orm';
import { requireAuthentication } from './middleware/session-auth';

const router = Router();

/**
 * GET /api/land-inventory/plot/:plotId
 * Get all items on a specific land plot
 */
router.get('/plot/:plotId', async (req, res) => {
  try {
    const { plotId } = req.params;
    
    const items = await db
      .select()
      .from(landInventory)
      .where(eq(landInventory.plotId, plotId));
    
    res.json({
      success: true,
      items,
      total: items.length
    });
    
  } catch (error: any) {
    console.error('❌ [LAND INVENTORY] Error fetching items:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/land-inventory/add
 * Add an item to a land plot
 * AUTHENTICATED - Requires ownership of the plot
 */
router.post('/add', requireAuthentication, async (req, res) => {
  try {
    const sessionUserHandle = (req as any).session?.userHandle;
    if (!sessionUserHandle) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }
    
    const { 
      plotId, 
      itemType, 
      itemId, 
      itemName, 
      itemImage, 
      itemMetadata,
      positionX,
      positionY,
      rotation,
      powerBonus,
      defenseBonus,
      productionRate
    } = req.body;
    
    // Validation
    if (!plotId || !itemType || !itemId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: plotId, itemType, itemId'
      });
    }
    
    // Verify plot ownership
    const [plot] = await db
      .select()
      .from(medievalLandPlots)
      .where(eq(medievalLandPlots.id, plotId))
      .limit(1);
    
    if (!plot) {
      return res.status(404).json({
        success: false,
        error: 'Land plot not found'
      });
    }
    
    if (plot.ownerHandle !== sessionUserHandle) {
      return res.status(403).json({
        success: false,
        error: 'You do not own this land plot'
      });
    }
    
    // Add item to inventory
    const [newItem] = await db.insert(landInventory).values({
      plotId,
      ownerHandle: sessionUserHandle,
      itemType,
      itemId,
      itemName: itemName || null,
      itemImage: itemImage || null,
      itemMetadata: itemMetadata || {},
      positionX: positionX || null,
      positionY: positionY || null,
      rotation: rotation || 0,
      powerBonus: powerBonus || '0',
      defenseBonus: defenseBonus || '0',
      productionRate: productionRate || '0',
      isActive: true,
      isEquipped: true
    } as any).returning();
    
    console.log(`✅ [LAND INVENTORY] Added ${itemType} ${itemId} to plot ${plot.plotNumber}`);
    
    res.json({
      success: true,
      item: newItem
    });
    
  } catch (error: any) {
    console.error('❌ [LAND INVENTORY] Error adding item:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/land-inventory/:itemId
 * Remove an item from a land plot
 * AUTHENTICATED - Requires ownership of the plot
 */
router.delete('/:itemId', requireAuthentication, async (req, res) => {
  try {
    const sessionUserHandle = (req as any).session?.userHandle;
    if (!sessionUserHandle) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }
    
    const { itemId } = req.params;
    
    // Get item
    const [item] = await db
      .select()
      .from(landInventory)
      .where(eq(landInventory.id, itemId))
      .limit(1);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Item not found'
      });
    }
    
    if (item.ownerHandle !== sessionUserHandle) {
      return res.status(403).json({
        success: false,
        error: 'You do not own this item'
      });
    }
    
    // Delete item
    await db.delete(landInventory).where(eq(landInventory.id, itemId));
    
    console.log(`✅ [LAND INVENTORY] Removed item ${itemId} from inventory`);
    
    res.json({
      success: true,
      message: 'Item removed from land inventory'
    });
    
  } catch (error: any) {
    console.error('❌ [LAND INVENTORY] Error removing item:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/land-inventory/:itemId/position
 * Update item position on land plot
 * AUTHENTICATED - Requires ownership of the plot
 */
router.put('/:itemId/position', requireAuthentication, async (req, res) => {
  try {
    const sessionUserHandle = (req as any).session?.userHandle;
    if (!sessionUserHandle) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }
    
    const { itemId } = req.params;
    const { positionX, positionY, rotation } = req.body;
    
    // Get item
    const [item] = await db
      .select()
      .from(landInventory)
      .where(eq(landInventory.id, itemId))
      .limit(1);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Item not found'
      });
    }
    
    if (item.ownerHandle !== sessionUserHandle) {
      return res.status(403).json({
        success: false,
        error: 'You do not own this item'
      });
    }
    
    // Update position
    const [updatedItem] = await db
      .update(landInventory)
      .set({ 
        positionX: positionX !== undefined ? positionX : item.positionX,
        positionY: positionY !== undefined ? positionY : item.positionY,
        rotation: rotation !== undefined ? rotation : item.rotation,
        updatedAt: new Date()
       } as any)
      .where(eq(landInventory.id, itemId))
      .returning();
    
    console.log(`✅ [LAND INVENTORY] Updated position for item ${itemId}`);
    
    res.json({
      success: true,
      item: updatedItem
    });
    
  } catch (error: any) {
    console.error('❌ [LAND INVENTORY] Error updating position:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/land-inventory/user/:userHandle
 * Get all items for a specific user across all their plots
 */
router.get('/user/:userHandle', async (req, res) => {
  try {
    const { userHandle } = req.params;
    
    const items = await db
      .select()
      .from(landInventory)
      .where(eq(landInventory.ownerHandle, userHandle));
    
    res.json({
      success: true,
      items,
      total: items.length
    });
    
  } catch (error: any) {
    console.error('❌ [LAND INVENTORY] Error fetching user items:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
