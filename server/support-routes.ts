import { Router } from 'express';
import { sessionAuth } from './middleware/session-auth';
import { db } from './db';
import { supportTickets, insertSupportTicketSchema } from '../shared/schema';
import { eq, and, desc } from 'drizzle-orm';

const router = Router();

// Apply authentication middleware to ALL support routes
router.use(sessionAuth);

/**
 * POST /api/support/tickets
 * Create a new support ticket
 */
router.post('/tickets', async (req, res) => {
  try {
    console.log('🎫 [SUPPORT] Creating support ticket...');
    
    // Get authenticated user handle from session
    const customerHandle = req.session?.handle;
    if (!customerHandle) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const validatedData = insertSupportTicketSchema.parse({
      ...req.body,
      customer_handle: customerHandle, // Use authenticated handle only
      status: 'open',
      priority: req.body.priority || 'medium'
    });

    const [ticket] = await db.insert(supportTickets).values(validatedData as any).returning();
    
    console.log(`✅ [SUPPORT] Created ticket ${ticket.id} for ${ticket.customer_handle}`);
    
    res.json({ 
      success: true, 
      ticket_id: ticket.id,
      message: 'Support ticket created successfully. Our team will respond within 24 hours.'
    });
  } catch (error) {
    console.error('❌ [SUPPORT] Failed to create ticket:', error);
    res.status(400).json({ 
      success: false, 
      error: 'Failed to create support ticket' 
    });
  }
});

/**
 * GET /api/support/tickets
 * Get user's support tickets (only their own)
 */
router.get('/tickets', async (req, res) => {
  try {
    // Get authenticated user handle from session (SECURITY: Never trust client input)
    const customerHandle = req.session?.handle;
    if (!customerHandle) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }
    
    console.log(`🔍 [SUPPORT] Getting tickets for authenticated user: ${customerHandle}`);
    
    const tickets = await db.select()
      .from(supportTickets)
      .where(eq(supportTickets.customer_handle, customerHandle))
      .orderBy(desc(supportTickets.created_at));

    res.json({ success: true, tickets });
  } catch (error) {
    console.error('❌ [SUPPORT] Failed to get tickets:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to retrieve support tickets' 
    });
  }
});

/**
 * GET /api/support/tickets/:id
 * Get specific ticket details (only if user owns it)
 */
router.get('/tickets/:id', async (req, res) => {
  try {
    const ticketId = req.params.id;
    
    // Get authenticated user handle from session (SECURITY: Never trust client input)
    const customerHandle = req.session?.handle;
    if (!customerHandle) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }
    
    const [ticket] = await db.select()
      .from(supportTickets)
      .where(and(
        eq(supportTickets.id, ticketId),
        eq(supportTickets.customer_handle, customerHandle) // Enforce ownership
      ));

    if (!ticket) {
      return res.status(404).json({ 
        success: false, 
        error: 'Ticket not found or access denied' 
      });
    }

    res.json({ success: true, ticket });
  } catch (error) {
    console.error('❌ [SUPPORT] Failed to get ticket:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to retrieve ticket' 
    });
  }
});

export default router;