import express from 'express';
import { z } from 'zod';
import { db } from '../../db';
import { eq, and, or } from 'drizzle-orm';
import { Client } from 'xrpl';

const router = express.Router();

// XRPL Client for order book
const XRPL_SERVER = 'wss://s1.ripple.com';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const CreateLimitOrderSchema = z.object({
  type: z.enum(['buy', 'sell']),
  fromToken: z.string().min(1),
  toToken: z.string().min(1),
  fromAmount: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0),
  limitPrice: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0),
  chain: z.enum(['xrp', 'eth', 'sol']),
  walletAddress: z.string().min(1),
  expiresIn: z.number().min(3600).max(2592000).default(86400) // 1 hour to 30 days, default 24h
});

const CancelOrderSchema = z.object({
  orderId: z.string().min(1),
  chain: z.enum(['xrp', 'eth', 'sol'])
});

// ============================================================================
// MIDDLEWARE
// ============================================================================

const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!req.session?.handle) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }
  next();
};

// ============================================================================
// GET /api/tradecenter/limit/orders
// Get user's limit orders
// ============================================================================

router.get('/orders', requireAuth, async (req, res) => {
  try {
    const session = (req as any).userSession;
    const { status, chain } = req.query;
    
    console.log(`📋 [Limit Orders] ${session.handle} requesting orders - status: ${status || 'all'}, chain: ${chain || 'all'}`);
    
    // TODO: Fetch from database
    // const orders = await db.select()
    //   .from(limitOrders)
    //   .where(eq(limitOrders.userHandle, session.handle));
    
    const orders = [];
    
    res.json({
      success: true,
      orders,
      timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('❌ [Get Limit Orders Error]:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch orders'
    });
  }
});

// ============================================================================
// POST /api/tradecenter/limit/create
// Create a new limit order
// ============================================================================

router.post('/create', requireAuth, async (req, res) => {
  try {
    const validation = CreateLimitOrderSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid order parameters',
        details: validation.error.errors
      });
    }
    
    const orderData = validation.data;
    const session = (req as any).userSession;
    
    // Verify wallet ownership
    const chainKey = `${orderData.chain}Address`;
    if (session.walletData?.[chainKey] !== orderData.walletAddress) {
      return res.status(403).json({
        success: false,
        error: 'Wallet address mismatch'
      });
    }
    
    console.log(`📝 [Create Limit Order] ${session.handle}: ${orderData.type} ${orderData.fromAmount} ${orderData.fromToken} @ ${orderData.limitPrice}`);
    
    const expiresAt = new Date(Date.now() + orderData.expiresIn * 1000);
    
    // TODO: Save to database
    // const orderId = await db.insert(limitOrders).values({
    //   userHandle: session.handle,
    //   walletAddress: orderData.walletAddress,
    //   type: orderData.type,
    //   fromToken: orderData.fromToken,
    //   toToken: orderData.toToken,
    //   fromAmount: orderData.fromAmount,
    //   limitPrice: orderData.limitPrice,
    //   chain: orderData.chain,
    //   status: 'active',
    //   expiresAt
    // });
    
    res.json({
      success: true,
      message: 'Limit order created',
      orderId: 'temp-order-id',
      expiresAt: expiresAt.toISOString(),
      timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('❌ [Create Limit Order Error]:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create order'
    });
  }
});

// ============================================================================
// POST /api/tradecenter/limit/cancel
// Cancel a limit order
// ============================================================================

router.post('/cancel', requireAuth, async (req, res) => {
  try {
    const validation = CancelOrderSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: validation.error.errors
      });
    }
    
    const { orderId, chain } = validation.data;
    const session = (req as any).userSession;
    
    console.log(`❌ [Cancel Limit Order] ${session.handle}: Order ${orderId} on ${chain}`);
    
    // TODO: Verify ownership and cancel in database
    // await db.update(limitOrders)
    //   .set({ status: 'cancelled', cancelledAt: new Date() })
    //   .where(and(
    //     eq(limitOrders.id, orderId),
    //     eq(limitOrders.userHandle, session.handle)
    //   ));
    
    res.json({
      success: true,
      message: 'Order cancelled',
      orderId,
      timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('❌ [Cancel Limit Order Error]:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel order'
    });
  }
});

// ============================================================================
// GET /api/tradecenter/limit/orderbook
// Get order book for a token pair (XRPL DEX order book)
// ============================================================================

router.get('/orderbook', async (req, res) => {
  try {
    const { fromToken, toToken, fromIssuer, toIssuer, chain = 'xrp', limit = '20' } = req.query;
    
    if (!fromToken || !toToken) {
      return res.status(400).json({
        success: false,
        error: 'fromToken and toToken are required'
      });
    }
    
    console.log(`📖 [Order Book] ${fromToken} → ${toToken} on ${chain}`);
    
    if (chain === 'xrp') {
      const client = new Client(XRPL_SERVER);
      
      try {
        await client.connect();
        
        // Format currencies for XRPL
        const takerGets = fromToken === 'XRP' 
          ? { currency: 'XRP' }
          : { currency: fromToken as string, issuer: fromIssuer as string };
          
        const takerPays = toToken === 'XRP'
          ? { currency: 'XRP' }
          : { currency: toToken as string, issuer: toIssuer as string };
        
        // Get order book
        const orderBook = await client.request({
          command: 'book_offers',
          taker_gets: takerGets,
          taker_pays: takerPays,
          limit: parseInt(limit as string)
        });
        
        // Parse offers
        const bids = orderBook.result.offers?.map((offer: any) => {
          const getsAmount = typeof offer.TakerGets === 'string' 
            ? parseFloat(offer.TakerGets) / 1e6
            : parseFloat(offer.TakerGets.value);
          const paysAmount = typeof offer.TakerPays === 'string'
            ? parseFloat(offer.TakerPays) / 1e6
            : parseFloat(offer.TakerPays.value);
          const price = paysAmount / getsAmount;
          
          return {
            price: price.toFixed(8),
            amount: getsAmount.toFixed(6),
            total: paysAmount.toFixed(6),
            account: offer.Account,
            sequence: offer.Sequence
          };
        }) || [];
        
        // Get reverse order book for asks
        const reverseOrderBook = await client.request({
          command: 'book_offers',
          taker_gets: takerPays,
          taker_pays: takerGets,
          limit: parseInt(limit as string)
        });
        
        const asks = reverseOrderBook.result.offers?.map((offer: any) => {
          const getsAmount = typeof offer.TakerGets === 'string'
            ? parseFloat(offer.TakerGets) / 1e6
            : parseFloat(offer.TakerGets.value);
          const paysAmount = typeof offer.TakerPays === 'string'
            ? parseFloat(offer.TakerPays) / 1e6
            : parseFloat(offer.TakerPays.value);
          const price = getsAmount / paysAmount;
          
          return {
            price: price.toFixed(8),
            amount: paysAmount.toFixed(6),
            total: getsAmount.toFixed(6),
            account: offer.Account,
            sequence: offer.Sequence
          };
        }) || [];
        
        await client.disconnect();
        
        // Calculate spread
        const bestBid = bids.length > 0 ? parseFloat(bids[0].price) : 0;
        const bestAsk = asks.length > 0 ? parseFloat(asks[0].price) : 0;
        const spread = bestAsk > 0 && bestBid > 0 
          ? ((bestAsk - bestBid) / bestBid * 100).toFixed(4)
          : '0';
        
        res.json({
          success: true,
          orderBook: {
            bids: bids.slice(0, parseInt(limit as string)),
            asks: asks.slice(0, parseInt(limit as string)),
            spread: `${spread}%`,
            bestBid: bestBid.toFixed(8),
            bestAsk: bestAsk.toFixed(8),
            pair: `${fromToken}/${toToken}`,
            chain: 'xrp'
          },
          timestamp: Date.now()
        });
        
      } catch (error) {
        await client.disconnect();
        throw error;
      }
    } else {
      // For EVM and SOL, return placeholder for now
      res.json({
        success: true,
        orderBook: {
          bids: [],
          asks: [],
          spread: '0%',
          bestBid: '0',
          bestAsk: '0',
          pair: `${fromToken}/${toToken}`,
          chain,
          message: 'Order book currently only available for XRPL'
        },
        timestamp: Date.now()
      });
    }
    
  } catch (error) {
    console.error('❌ [Order Book Error]:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch order book'
    });
  }
});

// ============================================================================
// GET /api/tradecenter/limit/history
// Get order history
// ============================================================================

router.get('/history', requireAuth, async (req, res) => {
  try {
    const session = (req as any).userSession;
    const { limit = '50', offset = '0' } = req.query;
    
    console.log(`📜 [Order History] ${session.handle}`);
    
    // TODO: Fetch from database with pagination
    const history = [];
    
    res.json({
      success: true,
      history,
      pagination: {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        total: 0
      },
      timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('❌ [Order History Error]:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch history'
    });
  }
});

export default router;
