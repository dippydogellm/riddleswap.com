/**
 * Land Purchase Routes - Handle land plot purchasing with XRP/RDL payments
 */

import { Router } from 'express';
import { db } from './db';
import { medievalLandPlots, landPlotPurchases, gamePlayers } from '../shared/schema';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
import { Client, Wallet, xrpToDrops } from 'xrpl';
import { requireAuthentication } from './middleware/session-auth';
import { csrfProtection, getCsrfToken } from './middleware/csrf-protection';
import { getAuthenticTokenPrice } from './price-service';
import OpenAI from 'openai';
import { randomUUID } from 'crypto';

const router = Router();

// CSRF protection applied individually to state-changing routes (POST/PUT/DELETE)
// GET requests skip CSRF automatically in middleware

// Get CSRF token endpoint
router.get('/csrf-token', requireAuthentication, getCsrfToken);

// Bank wallet for receiving land payments
const BANK_WALLET_ADDRESS = 'rsFbZ33Zr3BCVyiVPw8pFvbtnrG1i8FwA3';
const RDL_ISSUER = 'r9xvnzUWZJpDu3NA6MKHmKhKJQTRqCRgu9';
const RDL_DISCOUNT_PERCENT = 25; // 25% discount when paying with RDL

// Initialize OpenAI for DALL-E image generation
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

/**
 * GET /api/land/plots
 * Get all available land plots with full traits - PUBLIC
 */
router.get('/plots', async (req, res) => {
  try {
    const { status, terrainType, minPrice, maxPrice, plotSize, page = '1', limit = '50' } = req.query;
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;
    
    // Build SQL query with proper where clauses
    let query = db.select().from(medievalLandPlots);
    
    const conditions: any[] = [];
    
    if (status && status !== 'all') {
      conditions.push(eq(medievalLandPlots.status, status as string));
    }
    
    if (terrainType && terrainType !== 'all') {
      conditions.push(eq(medievalLandPlots.terrainType, terrainType as string));
    }
    
    if (plotSize && plotSize !== 'all') {
      conditions.push(eq(medievalLandPlots.plotSize, plotSize as string));
    }
    
    if (minPrice) {
      conditions.push(gte(medievalLandPlots.currentPrice, minPrice as string));
    }
    
    if (maxPrice) {
      conditions.push(lte(medievalLandPlots.currentPrice, maxPrice as string));
    }
    
    // Apply conditions
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    // Add pagination
    const plots = await query.limit(limitNum).offset(offset);
    
    // Get total count for pagination
    const totalQuery = db.select({ count: sql<number>`count(*)` }).from(medievalLandPlots);
    const [{ count: total }] = conditions.length > 0 
      ? await totalQuery.where(and(...conditions)) as any
      : await totalQuery;
    
    // Fetch live prices using centralized price service (with caching)
    console.log('💰 [LAND] Fetching live prices from centralized service...');
    const rdlPriceData = await getAuthenticTokenPrice('RDL', RDL_ISSUER);
    const xrpPriceData = await getAuthenticTokenPrice('XRP');
    
    const rdlPrice = rdlPriceData?.price_usd || 0;
    const xrpPrice = xrpPriceData?.price_usd || 0;
    
    console.log(`💰 [LAND] XRP Price (USD): $${xrpPrice.toFixed(4)}`);
    console.log(`💰 [LAND] RDL Price (USD): $${rdlPrice.toFixed(6)}`);
    
    // Calculate RDL/XRP exchange rate
    const rdlPerXrp = xrpPrice > 0 && rdlPrice > 0 ? xrpPrice / rdlPrice : 0;
    console.log(`💰 [LAND] RDL per XRP: ${rdlPerXrp.toFixed(2)} RDL`);
    
    // Get total supply and available count for display
    const [{ count: totalSupply }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(medievalLandPlots);
      
    const [{ count: availableCount }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(medievalLandPlots)
      .where(eq(medievalLandPlots.status, 'available'));

    res.json({
      success: true,
      plots: plots.map(plot => {
        // Calculate RDL price dynamically with discount
        const xrpAmount = parseFloat(plot.currentPrice);
        const rdlAmount = rdlPerXrp > 0 ? (xrpAmount * rdlPerXrp * (1 - RDL_DISCOUNT_PERCENT / 100)) : 0;
        
        return {
          id: plot.id,
          plotNumber: plot.plotNumber,
          gridSection: plot.gridSection,
          mapX: plot.mapX,
          mapY: plot.mapY,
          latitude: plot.latitude,
          longitude: plot.longitude,
          terrainType: plot.terrainType,
          terrainSubtype: plot.terrainSubtype,
          plotSize: plot.plotSize,
          sizeMultiplier: plot.sizeMultiplier,
          currentPrice: plot.currentPrice,
          rdlPrice: rdlAmount.toFixed(2), // Live calculated RDL price
          rdlDiscountPercent: RDL_DISCOUNT_PERCENT,
          status: plot.status,
          specialFeatures: plot.specialFeatures,
          resourceNodes: plot.resourceNodes,
          plotResources: plot.plotResources, // Inquisition materials
          description: plot.description,
          lore: plot.lore,
          ownerHandle: plot.ownerHandle,
          generatedImageUrl: plot.generatedImageUrl
        };
      }),
      total,
      totalSupply,
      availableCount,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      rdlPriceUsd: rdlPrice,
      xrpPriceUsd: xrpPrice,
      rdlPerXrp: rdlPerXrp.toFixed(2)
    });
    
  } catch (error: any) {
    console.error('❌ [LAND] Error fetching plots:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/land/plot/:plotNumber
 * Get specific land plot details
 */
router.get('/plot/:plotNumber', async (req, res) => {
  try {
    const plotNumber = parseInt(req.params.plotNumber);
    
    const [plot] = await db
      .select()
      .from(medievalLandPlots)
      .where(eq(medievalLandPlots.plotNumber, plotNumber))
      .limit(1);
    
    if (!plot) {
      return res.status(404).json({
        success: false,
        error: 'Plot not found'
      });
    }
    
    // Calculate live RDL price using centralized price service
    let rdlAmount = 0;
    let xrpPriceUsd = 0;
    let rdlPriceUsd = 0;
    try {
      const rdlPriceData = await getAuthenticTokenPrice('RDL', RDL_ISSUER);
      const xrpPriceData = await getAuthenticTokenPrice('XRP');
      
      rdlPriceUsd = rdlPriceData?.price_usd || 0;
      xrpPriceUsd = xrpPriceData?.price_usd || 0;
      const rdlPerXrp = xrpPriceUsd > 0 && rdlPriceUsd > 0 ? xrpPriceUsd / rdlPriceUsd : 0;
      
      const xrpAmount = parseFloat(plot.currentPrice);
      rdlAmount = rdlPerXrp > 0 ? (xrpAmount * rdlPerXrp * (1 - RDL_DISCOUNT_PERCENT / 100)) : 0;
    } catch (error) {
      console.error('❌ [LAND] Error calculating live RDL price:', error);
    }
    
    res.json({
      success: true,
      plot: {
        id: plot.id,
        plotNumber: plot.plotNumber,
        gridSection: plot.gridSection,
        mapX: plot.mapX,
        mapY: plot.mapY,
        latitude: plot.latitude,
        longitude: plot.longitude,
        terrainType: plot.terrainType,
        terrainSubtype: plot.terrainSubtype,
        plotSize: plot.plotSize,
        sizeMultiplier: plot.sizeMultiplier,
        currentPrice: plot.currentPrice,
        rdlPrice: rdlAmount.toFixed(2), // Live calculated RDL price with 25% discount
        rdlDiscountPercent: RDL_DISCOUNT_PERCENT,
        status: plot.status,
        specialFeatures: plot.specialFeatures,
        resourceNodes: plot.resourceNodes,
        plotResources: plot.plotResources, // Inquisition materials from placed NFTs
        description: plot.description,
        lore: plot.lore,
        ownerHandle: plot.ownerHandle,
        ownerId: plot.ownerId,
        generatedImageUrl: plot.generatedImageUrl
      }
    });
    
  } catch (error: any) {
    console.error('❌ [LAND] Error fetching plot:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/land/prepare-payment
 * Prepare payment transaction for land purchase (returns unsigned tx for external wallets)
 * AUTHENTICATED - Requires logged-in user
 */
router.post('/prepare-payment', requireAuthentication, async (req, res) => {
  try {
    const { plotNumber, paymentMethod, buyerAddress } = req.body;
    
    // SERVER-SIDE BUYER VALIDATION - Don't trust client
    const sessionUserHandle = (req as any).session?.userHandle;
    if (!sessionUserHandle) {
      return res.status(401).json({
        success: false,
        error: 'Session expired. Please renew your session.',
        errorCode: 'SESSION_EXPIRED'
      });
    }
    
    // Validation
    if (!plotNumber || !paymentMethod || !buyerAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: plotNumber, paymentMethod, buyerAddress'
      });
    }
    
    // Use server-validated user handle, not client-provided
    const buyerHandle = sessionUserHandle;
    
    // Get plot
    const [plot] = await db
      .select()
      .from(medievalLandPlots)
      .where(eq(medievalLandPlots.plotNumber, plotNumber))
      .limit(1);
    
    if (!plot) {
      return res.status(404).json({
        success: false,
        error: 'Plot not found'
      });
    }
    
    if (plot.status !== 'available') {
      return res.status(400).json({
        success: false,
        error: 'Plot is not available for purchase'
      });
    }
    
    // Calculate amount with live prices for RDL
    let amount: string;
    let currency: string;
    
    if (paymentMethod === 'XRP') {
      amount = plot.currentPrice;
      currency = 'XRP';
    } else if (paymentMethod === 'RDL') {
      // Fetch live RDL/XRP exchange rate using centralized price service
      console.log('💰 [LAND] Fetching live RDL price for payment preparation...');
      const rdlPriceData = await getAuthenticTokenPrice('RDL', RDL_ISSUER);
      const xrpPriceData = await getAuthenticTokenPrice('XRP');
      
      const rdlPrice = rdlPriceData?.price_usd || 0;
      const xrpPrice = xrpPriceData?.price_usd || 0;
      const rdlPerXrp = xrpPrice > 0 && rdlPrice > 0 ? xrpPrice / rdlPrice : 0;
      
      // Calculate RDL amount with 25% discount
      const xrpAmount = parseFloat(plot.currentPrice);
      amount = rdlPerXrp > 0 
        ? (xrpAmount * rdlPerXrp * (1 - RDL_DISCOUNT_PERCENT / 100)).toFixed(2)
        : plot.currentPrice; // Fallback to XRP price if rates unavailable
      
      console.log(`💰 [LAND] RDL payment amount: ${amount} RDL (${RDL_DISCOUNT_PERCENT}% discount applied)`);
      console.log(`💰 [LAND] USD values - XRP: $${xrpPrice.toFixed(4)}, RDL: $${rdlPrice.toFixed(6)}`);
      currency = 'RDL';
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid payment method. Use XRP or RDL'
      });
    }
    
    // Create memos with plot information - multiple memos for clarity
    const memos = [
      {
        Memo: {
          MemoType: Buffer.from('LAND_PURCHASE', 'utf8').toString('hex').toUpperCase(),
          MemoData: Buffer.from(`Plot #${plotNumber}`, 'utf8').toString('hex').toUpperCase()
        }
      },
      {
        Memo: {
          MemoType: Buffer.from('BUYER', 'utf8').toString('hex').toUpperCase(),
          MemoData: Buffer.from(buyerHandle, 'utf8').toString('hex').toUpperCase()
        }
      },
      {
        Memo: {
          MemoType: Buffer.from('PAYMENT', 'utf8').toString('hex').toUpperCase(),
          MemoData: Buffer.from(paymentMethod, 'utf8').toString('hex').toUpperCase()
        }
      }
    ];
    
    // For XRP payments
    if (paymentMethod === 'XRP') {
      const payment = {
        TransactionType: 'Payment',
        Account: buyerAddress,
        Destination: BANK_WALLET_ADDRESS,
        Amount: xrpToDrops(amount),
        Memos: memos
      };
      
      return res.json({
        success: true,
        payment: {
          transaction: payment,
          amount,
          currency: 'XRP',
          destination: BANK_WALLET_ADDRESS,
          plotNumber,
          memo: JSON.stringify(memos)
        }
      });
    }
    
    // For RDL token payments
    if (paymentMethod === 'RDL') {
      const payment = {
        TransactionType: 'Payment',
        Account: buyerAddress,
        Destination: BANK_WALLET_ADDRESS,
        Amount: {
          currency: 'RDL',
          value: amount,
          issuer: RDL_ISSUER // FIX: Use correct RDL issuer, not bank wallet
        },
        Memos: memos
      };
      
      return res.json({
        success: true,
        payment: {
          transaction: payment,
          amount,
          currency: 'RDL',
          destination: BANK_WALLET_ADDRESS,
          plotNumber,
          memos: memos
        }
      });
    }
    
  } catch (error: any) {
    console.error('❌ [LAND] Error preparing payment:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/land/verify-payment
 * DEPRECATED AND DISABLED FOR SECURITY REASONS
 * 
 * This endpoint is vulnerable to underpayment attacks because it does not validate:
 * - Exact payment amount matches plot price
 * - Currency and issuer match expected values
 * - Atomic conditional ownership update
 * 
 * Use /api/land/purchase-with-cached-keys instead (secure, validated, atomic)
 */
router.post('/verify-payment', requireAuthentication, async (req, res) => {
  console.warn('⚠️ [LAND] SECURITY: Deprecated verify-payment endpoint called - rejecting');
  return res.status(410).json({
    success: false,
    error: 'This endpoint is deprecated for security reasons. Use the purchase interface instead.',
    code: 'ENDPOINT_DEPRECATED'
  });
  
  /* DISABLED - VULNERABLE CODE PRESERVED FOR REFERENCE
  try {
    const { txHash, plotNumber } = req.body;
    
    // SERVER-SIDE BUYER VALIDATION - Don't trust client
    const sessionUserHandle = (req as any).session?.userHandle;
    if (!sessionUserHandle) {
      return res.status(401).json({
        success: false,
        error: 'Session expired. Please renew your session.',
        errorCode: 'SESSION_EXPIRED'
      });
    }
    
    // Use server-validated user handle, not client-provided
    const buyerHandle = sessionUserHandle;
    
    // VULNERABLE CODE - DOES NOT VALIDATE AMOUNT/CURRENCY/ISSUER
    if (!txHash || !plotNumber) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: txHash, plotNumber'
      });
    }
    
    console.log(`🔍 [LAND] Verifying payment for plot #${plotNumber}...`);
    
    // Connect to XRPL
    const client = new Client('wss://xrplcluster.com');
    await client.connect();
    
    try {
      // Get transaction details
      const tx = await client.request({
        command: 'tx',
        transaction: txHash
      });
      
      // Cast to any for proper access
      const txData: any = tx.result;
      
      // Verify transaction
      if (txData.meta && typeof txData.meta === 'object' && 'TransactionResult' in txData.meta) {
        if (txData.meta.TransactionResult !== 'tesSUCCESS') {
          await client.disconnect();
          return res.status(400).json({
            success: false,
            error: 'Transaction failed on XRPL'
          });
        }
      }
      
      // Verify destination
      if (txData.Destination !== BANK_WALLET_ADDRESS) {
        await client.disconnect();
        return res.status(400).json({
          success: false,
          error: 'Payment was not sent to the correct address'
        });
      }
      
      // Get plot
      const [plot] = await db
        .select()
        .from(medievalLandPlots)
        .where(eq(medievalLandPlots.plotNumber, plotNumber))
        .limit(1);
      
      if (!plot) {
        await client.disconnect();
        return res.status(404).json({
          success: false,
          error: 'Plot not found'
        });
      }
      
      if (plot.status !== 'available') {
        await client.disconnect();
        return res.status(400).json({
          success: false,
          error: 'Plot is no longer available'
        });
      }
      
      // Get or create player
      let [player] = await db
        .select()
        .from(gamePlayers)
        .where(eq(gamePlayers.userHandle, buyerHandle))
        .limit(1);
      
      // Update plot ownership
      await db
        .update(medievalLandPlots)
        .set({ 
          status: 'owned',
          ownerId: player?.id || null,
          ownerHandle: buyerHandle,
          ownerAddress: txData.Account,
          purchaseDate: new Date(),
          purchaseTransaction: txHash,
          purchaseCurrency: txData.Amount && typeof txData.Amount === 'object' ? 'RDL' : 'XRP',
          purchasePrice: txData.Amount && typeof txData.Amount === 'object' 
            ? txData.Amount.value 
            : (parseInt(txData.Amount) / 1000000).toString()
         } as any)
        .where(eq(medievalLandPlots.id, plot.id));
      
      // Record purchase transaction
      await db.insert(landPlotPurchases).values({
        plotId: plot.id,
        buyerHandle,
        buyerAddress: txData.Account,
        paymentMethod: txData.Amount && typeof txData.Amount === 'object' ? 'RDL' : 'XRP',
        paidAmount: txData.Amount && typeof txData.Amount === 'object' 
          ? txData.Amount.value 
          : (parseInt(txData.Amount as any) / 1000000).toString(),
        originalXrpPrice: plot.currentPrice,
        rdlDiscountApplied: txData.Amount && typeof txData.Amount === 'object',
        discountPercent: txData.Amount && typeof txData.Amount === 'object' ? (plot.rdlDiscountPercent || 50) : 0,
        bankWalletAddress: BANK_WALLET_ADDRESS,
        treasuryTransactionHash: txHash,
        status: 'completed',
        paymentVerified: true,
        ownershipTransferred: true
      });
      
      await client.disconnect();
      
      console.log(`✅ [LAND] Plot #${plotNumber} purchased by ${buyerHandle}`);
      
      res.json({
        success: true,
        message: 'Land purchase verified and ownership transferred',
        plot: {
          plotNumber,
          newOwner: buyerHandle,
          txHash
        }
      });
      
    } catch (error) {
      await client.disconnect();
      throw error;
    }
    
  } catch (error: any) {
    console.error('❌ [LAND] Error verifying payment:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
  END DISABLED CODE */
});

/**
 * POST /api/land/purchase
 * Execute land purchase with cached XRPL wallet keys
 * AUTHENTICATED - Uses session-stored encrypted private keys
 * 
 * Note: /purchase-with-cached-keys is kept as an alias for backward compatibility
 */
router.post('/purchase', requireAuthentication, async (req, res) => {
  try {
    console.log('🛒 [LAND PURCHASE] Starting purchase with cached keys...');
    
    const { plotNumber, paymentMethod } = req.body;
    
    console.log('📋 [LAND PURCHASE] Request body:', {
      plotNumber,
      paymentMethod
    });
    
    // Validate user authentication from middleware
    const sessionUserHandle = (req as any).user?.handle || (req as any).user?.userHandle;
    if (!sessionUserHandle) {
      console.error('❌ [LAND PURCHASE] No user handle in request');
      return res.status(401).json({
        success: false,
        error: 'Session expired. Please renew your session.',
        errorCode: 'SESSION_EXPIRED'
      });
    }
    
    console.log('✅ [LAND PURCHASE] Session validated for user:', sessionUserHandle);
    
    // Validation
    if (!plotNumber || !paymentMethod) {
      console.error('❌ [LAND PURCHASE] Missing required fields');
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: plotNumber, paymentMethod'
      });
    }
    
    // Get cached private key from session OR user object
    const cachedKey = (req as any).session?.xrpPrivateKey || (req as any).user?.cachedKeys?.xrpPrivateKey;
    if (!cachedKey) {
      console.error('❌ [LAND PURCHASE] No cached XRPL private key');
      console.error('🔍 [LAND PURCHASE DEBUG] req.session exists:', !!req.session);
      console.error('🔍 [LAND PURCHASE DEBUG] req.user.cachedKeys exists:', !!(req as any).user?.cachedKeys);
      return res.status(401).json({
        success: false,
        error: 'Session expired. Please renew your session to make purchases.',
        errorCode: 'SESSION_EXPIRED'
      });
    }
    
    console.log('🔐 [LAND PURCHASE] Found cached private key (not logging for security)');
    
    // Get plot
    console.log(`🔍 [LAND PURCHASE] Fetching plot #${plotNumber} from database...`);
    const [plot] = await db
      .select()
      .from(medievalLandPlots)
      .where(eq(medievalLandPlots.plotNumber, plotNumber))
      .limit(1);
    
    if (!plot) {
      console.error(`❌ [LAND PURCHASE] Plot #${plotNumber} not found`);
      return res.status(404).json({
        success: false,
        error: 'Plot not found'
      });
    }
    
    if (plot.status !== 'available') {
      console.error(`❌ [LAND PURCHASE] Plot #${plotNumber} not available (status: ${plot.status})`);
      return res.status(400).json({
        success: false,
        error: 'Plot is not available for purchase'
      });
    }
    
    // Calculate amount with live RDL pricing
    let amount: string;
    let currency: string;
    
    if (paymentMethod === 'XRP') {
      amount = plot.currentPrice;
      currency = 'XRP';
      console.log('✅ [LAND PURCHASE] XRP payment:', { amount, currentPrice: plot.currentPrice });
    } else if (paymentMethod === 'RDL') {
      // Calculate live RDL price using centralized price service
      console.log('💰 [LAND PURCHASE] Fetching live RDL price...');
      const rdlPriceData = await getAuthenticTokenPrice('RDL', RDL_ISSUER);
      const xrpPriceData = await getAuthenticTokenPrice('XRP');
      
      const rdlPrice = rdlPriceData?.price_usd || 0;
      const xrpPrice = xrpPriceData?.price_usd || 0;
      const rdlPerXrp = xrpPrice > 0 && rdlPrice > 0 ? xrpPrice / rdlPrice : 0;
      
      const xrpAmount = parseFloat(plot.currentPrice);
      amount = rdlPerXrp > 0 
        ? (xrpAmount * rdlPerXrp * (1 - RDL_DISCOUNT_PERCENT / 100)).toFixed(2)
        : plot.currentPrice; // Fallback to XRP price if rates unavailable
      
      currency = 'RDL';
      console.log('✅ [LAND PURCHASE] RDL payment calculated:', { 
        amount, 
        xrpPrice: plot.currentPrice,
        rdlPriceUsd: rdlPrice.toFixed(6),
        xrpPriceUsd: xrpPrice.toFixed(4),
        rdlPerXrp: rdlPerXrp.toFixed(2),
        discount: `${RDL_DISCOUNT_PERCENT}%`
      });
    } else {
      console.error('❌ [LAND PURCHASE] Invalid payment method:', paymentMethod);
      return res.status(400).json({
        success: false,
        error: 'Invalid payment method. Use XRP or RDL'
      });
    }
    
    console.log('💰 [LAND PURCHASE] Payment details:', {
      amount,
      currency,
      method: paymentMethod
    });
    
    // Connect to XRPL
    console.log('🔌 [LAND PURCHASE] Connecting to XRPL...');
    const client = new Client('wss://s1.ripple.com');
    await client.connect();
    console.log('✅ [LAND PURCHASE] Connected to XRPL');
    
    try {
      // Create wallet from cached key (never log the private key itself)
      console.log('🔑 [LAND PURCHASE] Creating wallet from cached private key...');
      const wallet = Wallet.fromSeed(cachedKey);
      console.log('✅ [LAND PURCHASE] Wallet created for address:', wallet.address.slice(0, 10) + '...');
      
      // Create memos with plot information - multiple memos for clarity
      const memos = [
        {
          Memo: {
            MemoType: Buffer.from('LAND_PURCHASE', 'utf8').toString('hex').toUpperCase(),
            MemoData: Buffer.from(`Plot #${plotNumber}`, 'utf8').toString('hex').toUpperCase()
          }
        },
        {
          Memo: {
            MemoType: Buffer.from('BUYER', 'utf8').toString('hex').toUpperCase(),
            MemoData: Buffer.from(sessionUserHandle, 'utf8').toString('hex').toUpperCase()
          }
        },
        {
          Memo: {
            MemoType: Buffer.from('PAYMENT', 'utf8').toString('hex').toUpperCase(),
            MemoData: Buffer.from(paymentMethod, 'utf8').toString('hex').toUpperCase()
          }
        }
      ];
      
      console.log('📝 [LAND PURCHASE] Created memos:', memos);
      
      // Check balance for RDL payments to avoid tecPATH_PARTIAL
      if (paymentMethod === 'RDL') {
        console.log('💰 [LAND PURCHASE] Checking RDL balance before payment...');
        try {
          const accountLines = await client.request({
            command: 'account_lines',
            account: wallet.address,
            ledger_index: 'validated'
          });
          
          const rdlLine = accountLines.result.lines.find((line: any) => 
            line.currency === 'RDL' && line.account === RDL_ISSUER
          );
          
          if (!rdlLine) {
            console.error('❌ [LAND PURCHASE] No RDL trustline found');
            await client.disconnect();
            return res.status(400).json({
              success: false,
              error: 'You need to set up an RDL trustline first. Please hold RDL tokens before purchasing.'
            });
          }
          
          const balance = parseFloat(rdlLine.balance);
          const required = parseFloat(amount);
          
          console.log('💰 [LAND PURCHASE] RDL Balance check:', {
            balance,
            required,
            sufficient: balance >= required
          });
          
          if (balance < required) {
            console.error('❌ [LAND PURCHASE] Insufficient RDL balance');
            await client.disconnect();
            return res.status(400).json({
              success: false,
              error: `Insufficient RDL balance. You have ${balance.toFixed(2)} RDL but need ${required} RDL`
            });
          }
          
          console.log('✅ [LAND PURCHASE] Sufficient RDL balance confirmed');
        } catch (balanceError: any) {
          console.error('❌ [LAND PURCHASE] Error checking balance:', balanceError.message);
          // Continue anyway - let XRPL handle it
        }
      }
      
      // Prepare and sign transaction
      let tx: any;
      
      if (paymentMethod === 'XRP') {
        console.log('💎 [LAND PURCHASE] Preparing XRP payment transaction...');
        tx = {
          TransactionType: 'Payment',
          Account: wallet.address,
          Destination: BANK_WALLET_ADDRESS,
          Amount: xrpToDrops(amount),
          Memos: memos
        };
      } else {
        console.log('🪙 [LAND PURCHASE] Preparing RDL token payment transaction...');
        tx = {
          TransactionType: 'Payment',
          Account: wallet.address,
          Destination: BANK_WALLET_ADDRESS,
          Amount: {
            currency: 'RDL',
            value: amount,
            issuer: RDL_ISSUER
          },
          Memos: memos
        };
      }
      
      console.log('📤 [LAND PURCHASE] Submitting transaction to XRPL...');
      console.log('🔍 [LAND PURCHASE] Transaction details:', tx);
      
      const response = await client.submitAndWait(tx, { wallet });
      
      console.log('📨 [LAND PURCHASE] Transaction response:', {
        result: response.result.meta,
        hash: response.result.hash,
        validated: response.result.validated
      });
      
      if (response.result.meta && typeof response.result.meta === 'object' && 'TransactionResult' in response.result.meta) {
        const txResult = response.result.meta.TransactionResult;
        
        console.log('🔍 [LAND PURCHASE] Transaction result:', txResult);
        
        if (txResult !== 'tesSUCCESS') {
          console.error('❌ [LAND PURCHASE] Transaction failed:', txResult);
          throw new Error(`Transaction failed: ${txResult}`);
        }
      }
      
      const txHash = response.result.hash;
      console.log('✅ [LAND PURCHASE] Transaction successful! Hash:', txHash);
      
      // Check for duplicate purchase (idempotency)
      console.log('🔍 [LAND PURCHASE] Checking for duplicate transaction...');
      const [existingPurchase] = await db
        .select()
        .from(landPlotPurchases)
        .where(eq(landPlotPurchases.treasuryTransactionHash, txHash))
        .limit(1);
      
      if (existingPurchase) {
        console.warn('⚠️ [LAND PURCHASE] Transaction already processed (idempotent check)');
        await client.disconnect();
        return res.json({
          success: true,
          message: 'Purchase already processed',
          transactionHash: txHash,
          plot: {
            plotNumber,
            owner: sessionUserHandle,
            paymentMethod,
            amount,
            currency
          }
        });
      }
      
      // Validate transaction results BEFORE database update
      console.log('🔍 [LAND PURCHASE] Validating transaction results...');
      
      // Get authoritative transaction data from validated ledger
      const validatedTx = response.result.tx_json || response.result;
      
      console.log('🔍 [LAND PURCHASE] Validated transaction data:', validatedTx);
      
      // Check sender account
      if (validatedTx.Account !== wallet.address) {
        console.error('❌ [LAND PURCHASE] Account mismatch:', validatedTx.Account, 'vs', wallet.address);
        throw new Error('Transaction account does not match wallet');
      }
      
      // Check destination
      if (validatedTx.Destination !== BANK_WALLET_ADDRESS) {
        console.error('❌ [LAND PURCHASE] Destination mismatch:', validatedTx.Destination, 'vs', BANK_WALLET_ADDRESS);
        throw new Error('Transaction destination does not match bank wallet');
      }
      
      // Check amount based on payment method
      if (paymentMethod === 'XRP') {
        const expectedDrops = xrpToDrops(amount);
        if (validatedTx.Amount !== expectedDrops) {
          console.error('❌ [LAND PURCHASE] Amount mismatch:', validatedTx.Amount, 'vs', expectedDrops);
          throw new Error('Transaction amount does not match expected price');
        }
      } else {
        // RDL token payment - check DeliverMax field (XRPL uses this for IOU payments)
        const paymentAmount = validatedTx.DeliverMax || validatedTx.Amount;
        
        if (typeof paymentAmount !== 'object') {
          console.error('❌ [LAND PURCHASE] Expected IOU payment object, got:', typeof paymentAmount);
          throw new Error('Expected IOU payment for RDL');
        }
        if (paymentAmount.currency !== 'RDL') {
          console.error('❌ [LAND PURCHASE] Currency mismatch:', paymentAmount.currency, 'vs RDL');
          throw new Error('Payment currency is not RDL');
        }
        if (paymentAmount.issuer !== RDL_ISSUER) {
          console.error('❌ [LAND PURCHASE] Issuer mismatch:', paymentAmount.issuer, 'vs', RDL_ISSUER);
          throw new Error('RDL issuer does not match');
        }
        
        const receivedAmount = parseFloat(paymentAmount.value);
        const expectedAmount = parseFloat(amount);
        
        // Allow small rounding differences (0.01%)
        const tolerance = expectedAmount * 0.0001;
        if (Math.abs(receivedAmount - expectedAmount) > tolerance) {
          console.error('❌ [LAND PURCHASE] Amount mismatch:', receivedAmount, 'vs', expectedAmount);
          throw new Error(`RDL amount mismatch: received ${receivedAmount}, expected ${expectedAmount}`);
        }
        
        console.log('✅ [LAND PURCHASE] RDL payment validated:', {
          received: receivedAmount,
          expected: expectedAmount,
          currency: paymentAmount.currency,
          issuer: paymentAmount.issuer
        });
      }
      
      console.log('✅ [LAND PURCHASE] Transaction validation passed (Account, Destination, Amount all verified)');
      
      // Atomic database update with race condition protection
      console.log(`📝 [LAND PURCHASE] Executing atomic database update with status check...`);
      
      // Update plot ownership ONLY if status is 'available' (prevents race conditions)
      const updateResult = await db
        .update(medievalLandPlots)
        .set({
          status: 'owned',
          owner_handle: sessionUserHandle,
          updated_at: new Date()
        } as any)
        .where(
          and(
            eq(medievalLandPlots.plotNumber, plotNumber),
            eq(medievalLandPlots.status, 'available')
          )
        )
        .returning({ id: medievalLandPlots.id });
      
      // Check if update succeeded (if plot was available)
      if (!updateResult || updateResult.length === 0) {
        console.error('❌ [LAND PURCHASE] Plot is no longer available (race condition or already owned)');
        await client.disconnect();
        return res.status(409).json({
          success: false,
          error: 'Plot is no longer available. It may have been purchased by another user.',
          transactionHash: txHash
        });
      }
      
      console.log(`✅ [LAND PURCHASE] Database updated - Plot #${plotNumber} now owned by ${sessionUserHandle}`);
      
      // Get USD prices for proof of purchase
      const rdlPriceData = await getAuthenticTokenPrice('RDL', RDL_ISSUER);
      const xrpPriceData = await getAuthenticTokenPrice('XRP');
      const xrpPriceUsd = xrpPriceData?.price_usd || 0;
      const rdlPriceUsd = rdlPriceData?.price_usd || 0;
      
      // Calculate total USD value
      const totalUsdValue = paymentMethod === 'XRP' 
        ? parseFloat(amount) * xrpPriceUsd
        : parseFloat(amount) * rdlPriceUsd;
      
      // Create purchase record with UUID proof and dollar values
      console.log('📝 [LAND PURCHASE] Creating purchase record with UUID and USD proof...');
      const purchaseRecord = await db.insert(landPlotPurchases).values({
        plotId: updateResult[0].id, // Use the returned plot ID
        buyerHandle: sessionUserHandle,
        buyerAddress: wallet.address,
        paymentMethod,
        paidAmount: amount,
        originalXrpPrice: plot.currentPrice,
        rdlDiscountApplied: paymentMethod === 'RDL',
        discountPercent: paymentMethod === 'RDL' ? RDL_DISCOUNT_PERCENT : 0,
        xrpPriceUsd: xrpPriceUsd.toString(),
        rdlPriceUsd: rdlPriceUsd.toString(),
        totalUsdValue: totalUsdValue.toString(),
        treasuryTransactionHash: txHash,
        bankWalletAddress: BANK_WALLET_ADDRESS,
        paymentVerified: true,
        ownershipTransferred: true,
        status: 'completed'
      } as any).returning({ 
        id: landPlotPurchases.id,
        xrpPriceUsd: landPlotPurchases.xrpPriceUsd,
        rdlPriceUsd: landPlotPurchases.rdlPriceUsd,
        totalUsdValue: landPlotPurchases.totalUsdValue
      });
      
      const purchaseId = purchaseRecord[0]?.id;
      console.log('✅ [LAND PURCHASE] Purchase record created');
      console.log('🎫 [LAND PURCHASE] Proof of Purchase UUID:', purchaseId);
      console.log('💵 [LAND PURCHASE] USD Values:', {
        xrpPriceUsd: `$${xrpPriceUsd.toFixed(4)}`,
        rdlPriceUsd: `$${rdlPriceUsd.toFixed(6)}`,
        totalUsdValue: `$${totalUsdValue.toFixed(2)}`
      });
      
      console.log('✅ [LAND PURCHASE] Purchase record created');
      
      await client.disconnect();
      console.log('🔌 [LAND PURCHASE] Disconnected from XRPL');
      
      // Generate DALL-E image for the purchased plot (only if not already generated)
      let generatedImageUrl: string | null = null;
      if (openai && !plot.generatedImageUrl) {
        try {
          console.log('🎨 [LAND PURCHASE] Generating DALL-E image for plot...');
          
          // Use landImageGenerator for consistent image generation
          const { landImageGenerator } = await import('./land-image-generator');
          generatedImageUrl = await landImageGenerator.generatePlotImage({
            plotNumber: plot.plotNumber,
            terrainType: plot.terrainType,
            terrainSubtype: plot.terrainSubtype || '',
            specialFeatures: plot.specialFeatures || [],
            description: plot.description || ''
          });
          
          if (generatedImageUrl) {
            console.log('✅ [LAND PURCHASE] DALL-E image generated:', generatedImageUrl);
            
            // Update plot with generated image
            await db.update(medievalLandPlots)
              .set({
                generated_image_url: generatedImageUrl,
                image_generated_at: new Date()
              } as any)
              .where(eq(medievalLandPlots.plotNumber, plotNumber));
            
            console.log('✅ [LAND PURCHASE] Plot updated with generated image');
          }
        } catch (imageError: any) {
          console.error('❌ [LAND PURCHASE] Error generating DALL-E image:', imageError.message);
          // Continue with purchase completion even if image generation fails
        }
      } else if (plot.generatedImageUrl) {
        console.log('ℹ️ [LAND PURCHASE] Plot already has generated image, skipping');
        generatedImageUrl = plot.generatedImageUrl;
      } else {
        console.log('⚠️ [LAND PURCHASE] OpenAI not configured, skipping image generation');
      }
      
      console.log('🎉 [LAND PURCHASE] PURCHASE COMPLETE!');
      
      res.json({
        success: true,
        message: `Land plot #${plotNumber} purchased successfully!`,
        transactionHash: txHash,
        purchaseId: purchaseId, // UUID proof of purchase
        generatedImage: generatedImageUrl,
        plot: {
          plotNumber,
          owner: sessionUserHandle,
          paymentMethod,
          amount,
          currency: paymentMethod
        },
        usdProof: {
          xrpPriceUsd: xrpPriceUsd.toFixed(4),
          rdlPriceUsd: rdlPriceUsd.toFixed(6),
          totalUsdValue: totalUsdValue.toFixed(2),
          timestamp: new Date().toISOString()
        }
      });
      
    } catch (error) {
      console.error('❌ [LAND PURCHASE] XRPL transaction error:', error);
      await client.disconnect();
      throw error;
    }
    
  } catch (error: any) {
    console.error('❌ [LAND PURCHASE] Critical error:', error);
    console.error('📋 [LAND PURCHASE] Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process purchase'
    });
  }
});

/**
 * GET /api/land/my-plots/:userHandle
 * Get all land plots owned by a user
 */
router.get('/my-plots/:userHandle', async (req, res) => {
  try {
    const { userHandle } = req.params;
    
    const plots = await db
      .select()
      .from(medievalLandPlots)
      .where(eq(medievalLandPlots.ownerHandle, userHandle));
    
    res.json({
      success: true,
      plots,
      total: plots.length
    });
    
  } catch (error: any) {
    console.error('❌ [LAND] Error fetching user plots:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/land/plot/:plotNumber/generate-image
 * Generate AI image for land plot using DALL-E
 * REQUIRES AUTHENTICATION - Protected with session renewal support
 */
router.post('/plot/:plotNumber/generate-image', requireAuthentication, async (req, res) => {
  try {
    const plotNumber = parseInt(req.params.plotNumber);
    
    console.log(`🎨 [LAND] Generating image for plot #${plotNumber}...`);
    
    // Get plot
    const [plot] = await db
      .select()
      .from(medievalLandPlots)
      .where(eq(medievalLandPlots.plotNumber, plotNumber))
      .limit(1);
    
    if (!plot) {
      return res.status(404).json({
        success: false,
        error: 'Plot not found'
      });
    }
    
    // Check if image already generated
    if (plot.generatedImageUrl) {
      return res.json({
        success: true,
        imageUrl: plot.generatedImageUrl,
        cached: true
      });
    }
    
    // Generate image using OpenAI
    if (!openai) {
      return res.status(503).json({
        success: false,
        error: 'Image generation not available - OpenAI API key not configured'
      });
    }
    
    // Build prompt based on plot metadata
    const { terrainType, terrainSubtype, specialFeatures } = plot;
    
    let prompt = `A medieval fantasy land plot showing ${(terrainSubtype || terrainType).replace('_', ' ')} terrain. `;
    
    const terrainDetails: Record<string, string> = {
      plains: 'rolling grasslands, open fields, scattered wildflowers',
      forest: 'dense trees, woodland atmosphere, dappled sunlight',
      mountain: 'rocky peaks, mountain ranges, dramatic elevation',
      water: 'coastal waters, rocky shores, ocean views',
      swamp: 'marshlands, misty atmosphere, wetland vegetation',
      desert: 'sand dunes, arid landscape, desert plants',
      tundra: 'frozen landscape, snow-covered ground, icy terrain'
    };
    
    prompt += terrainDetails[terrainType] || 'natural landscape';
    prompt += '. ';
    
    // Add special features to prompt
    if (specialFeatures && Array.isArray(specialFeatures) && specialFeatures.length > 0) {
      const featureDescriptions: Record<string, string> = {
        river_access: 'with a flowing river',
        mountain_view: 'with mountains in the background',
        ancient_ruins: 'with ancient stone ruins',
        sacred_site: 'with mystical standing stones',
        trade_route: 'with a visible merchant path',
        defensive_walls: 'with old defensive fortifications',
        natural_harbor: 'with a protected harbor',
        hot_springs: 'with steaming geothermal springs',
        fertile_soil: 'with rich, dark soil',
        hidden_cave: 'with a mysterious cave entrance',
        old_fortress: 'with weathered fortress walls',
        crystal_deposit: 'with glowing crystal formations'
      };
      
      const featureTexts = specialFeatures
        .map(f => featureDescriptions[f])
        .filter(Boolean);
      
      if (featureTexts.length > 0) {
        prompt += featureTexts.join(', ') + '. ';
      }
    }
    
    prompt += 'Medieval fantasy RPG game art style, top-down isometric view, detailed and colorful, strategic map aesthetic, game asset quality.';
    
    console.log(`🎨 [LAND] Prompt: ${prompt.slice(0, 100)}...`);
    
    // Generate image
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard"
    });

    const imageUrl = response.data?.[0]?.url;
    
    if (!imageUrl) {
      throw new Error('No image URL returned from OpenAI');
    }
    
    // Update plot with generated image URL (snake_case field name)
    await db
      .update(medievalLandPlots)
      .set({ generated_image_url: imageUrl } as any)
      .where(eq(medievalLandPlots.id, plot.id));
    
    console.log(`✅ [LAND] Image generated for plot #${plotNumber}`);
    
    res.json({
      success: true,
      imageUrl,
      cached: false
    });
    
  } catch (error: any) {
    console.error('❌ [LAND] Error generating image:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Keep the old endpoint for backward compatibility - it uses the same logic as /purchase

/**
 * GET /api/land/my-plots/:handle
 * Get land plots owned by specific player
 */
router.get('/my-plots/:handle', async (req, res) => {
  try {
    const { handle } = req.params;
    const { page = '1', limit = '50' } = req.query;
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;
    
    console.log(`🏞️ [LAND] Fetching plots owned by ${handle}...`);
    
    // Get plots owned by this player
    const plots = await db
      .select()
      .from(medievalLandPlots)
      .where(eq(medievalLandPlots.ownerHandle, handle))
      .limit(limitNum)
      .offset(offset);
    
    // Get total count
    const [{ count: total }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(medievalLandPlots)
      .where(eq(medievalLandPlots.ownerHandle, handle));
    
    // Get live RDL price for display purposes
    let rdlPerXrp = 0;
    try {
      const rdlPriceData = await getAuthenticTokenPrice('RDL', RDL_ISSUER);
      const xrpPriceData = await getAuthenticTokenPrice('XRP');
      const rdlPrice = rdlPriceData?.price_usd || 0;
      const xrpPrice = xrpPriceData?.price_usd || 0;
      rdlPerXrp = xrpPrice > 0 && rdlPrice > 0 ? xrpPrice / rdlPrice : 0;
    } catch (error) {
      console.error('❌ [LAND] Error fetching prices:', error);
    }
    
    // Get total supply and available count
    const [{ count: totalSupply }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(medievalLandPlots);
      
    const [{ count: availableCount }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(medievalLandPlots)
      .where(eq(medievalLandPlots.status, 'available'));
    
    res.json({
      success: true,
      plots: plots.map(plot => {
        const xrpAmount = parseFloat(plot.currentPrice);
        const rdlAmount = rdlPerXrp > 0 ? (xrpAmount * rdlPerXrp * (1 - RDL_DISCOUNT_PERCENT / 100)) : 0;
        
        return {
          id: plot.id,
          plotNumber: plot.plotNumber,
          gridSection: plot.gridSection,
          mapX: plot.mapX,
          mapY: plot.mapY,
          latitude: plot.latitude,
          longitude: plot.longitude,
          terrainType: plot.terrainType,
          terrainSubtype: plot.terrainSubtype,
          plotSize: plot.plotSize,
          sizeMultiplier: plot.sizeMultiplier,
          currentPrice: plot.currentPrice,
          rdlPrice: rdlAmount.toFixed(2),
          rdlDiscountPercent: RDL_DISCOUNT_PERCENT,
          status: plot.status,
          specialFeatures: plot.specialFeatures,
          resourceNodes: plot.resourceNodes,
          plotResources: plot.plotResources, // Inquisition materials from placed NFTs
          description: plot.description,
          lore: plot.lore,
          ownerHandle: plot.ownerHandle,
          generatedImageUrl: plot.generatedImageUrl
        };
      }),
      total,
      totalSupply,
      availableCount,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    });
    
  } catch (error: any) {
    console.error('❌ [LAND] Error fetching player plots:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/land/batch-generate-images
 * Batch generate images for land plots without images - ADMIN ONLY
 */
router.post('/batch-generate-images', requireAuthentication, async (req, res) => {
  try {
    // Check if user is admin (handle must be 'dippydoge' for now)
    const userHandle = (req.user as any)?.handle;
    if (userHandle !== 'dippydoge') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required for batch image generation'
      });
    }
    
    if (!openai) {
      return res.status(503).json({
        success: false,
        error: 'OpenAI API not configured'
      });
    }

    const { batchSize = 10 } = req.body;
    
    console.log(`🎨 [LAND-BATCH] Starting batch image generation...`);
    console.log(`   Batch size: ${batchSize}`);
    console.log(`   Requested by: ${userHandle}`);
    
    // Get plots without images - ORDER BY plotNumber for deterministic results
    // No OFFSET needed - we always get the NEXT N plots without images
    const plotsNeedingImages = await db
      .select()
      .from(medievalLandPlots)
      .where(sql`${medievalLandPlots.generatedImageUrl} IS NULL`)
      .orderBy(medievalLandPlots.plotNumber)
      .limit(batchSize);
    
    if (plotsNeedingImages.length === 0) {
      return res.json({
        success: true,
        message: 'No plots need images',
        generated: 0,
        total: 0
      });
    }
    
    console.log(`📋 [LAND-BATCH] Found ${plotsNeedingImages.length} plots needing images`);
    
    // Import the land image generator
    const { landImageGenerator } = await import('./land-image-generator');
    
    // Convert to format expected by generator
    const plotsToGenerate = plotsNeedingImages.map(plot => ({
      plotNumber: plot.plotNumber,
      terrainType: plot.terrainType,
      terrainSubtype: plot.terrainSubtype || '',
      specialFeatures: plot.specialFeatures || [],
      description: plot.description || ''
    }));
    
    // Generate images (with 2 second delay between each to avoid rate limits)
    const imageResults = await landImageGenerator.generateBatchImages(plotsToGenerate, 2000);
    
    // Update database with generated images
    let updated = 0;
    for (const [plotNumber, imageUrl] of Array.from(imageResults.entries())) {
      try {
        await db
          .update(medievalLandPlots)
          .set({
            generated_image_url: imageUrl,
            image_generated_at: new Date()
          } as any)
          .where(eq(medievalLandPlots.plotNumber, plotNumber));
        updated++;
      } catch (updateError) {
        console.error(`❌ [LAND-BATCH] Failed to update plot #${plotNumber}:`, updateError);
      }
    }
    
    console.log(`✅ [LAND-BATCH] Batch complete: ${updated}/${plotsNeedingImages.length} images saved`);
    
    // Get remaining count
    const [{ count: remaining }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(medievalLandPlots)
      .where(sql`${medievalLandPlots.generatedImageUrl} IS NULL`);
    
    res.json({
      success: true,
      message: `Generated ${updated} images`,
      generated: updated,
      total: plotsNeedingImages.length,
      remaining
    });
    
  } catch (error: any) {
    console.error('❌ [LAND-BATCH] Batch generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/land/admin/regenerate-images
 * Admin endpoint to regenerate images for land plots
 * ADMIN ONLY (dippydoge)
 */
router.post('/admin/regenerate-images', requireAuthentication, async (req, res) => {
  try {
    // Admin check - only dippydoge can regenerate images
    const sessionUserHandle = (req as any).session?.userHandle;
    if (sessionUserHandle !== 'dippydoge') {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized. Admin access required.'
      });
    }
    
    const { plotNumbers, all } = req.body;
    
    console.log('🎨 [LAND-ADMIN] Admin image regeneration requested by:', sessionUserHandle);
    console.log('🎨 [LAND-ADMIN] Parameters:', { plotNumbers, all });
    
    // Import the land image generator
    const { landImageGenerator } = await import('./land-image-generator');
    
    // Call the regenerateImages method
    const results = await landImageGenerator.regenerateImages(plotNumbers, all);
    
    console.log('✅ [LAND-ADMIN] Image regeneration complete:', {
      success: results.success,
      failed: results.failed
    });
    
    res.json({
      success: true,
      message: `Regenerated ${results.success} images successfully`,
      results: results.results,
      summary: {
        successCount: results.success,
        failedCount: results.failed,
        totalProcessed: results.results.length
      }
    });
    
  } catch (error: any) {
    console.error('❌ [LAND-ADMIN] Error regenerating images:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to regenerate images'
    });
  }
});

/**
 * DELETE /api/land/plot/:plotNumber
 * Cancel/release a plot (admin only or if not yet finalized)
 */
router.delete('/plot/:plotNumber', requireAuthentication, async (req, res) => {
  try {
    const { plotNumber } = req.params;
    const userHandle = (req as any).user?.handle || (req as any).user?.userHandle;

    if (!userHandle) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    console.log(`🗑️ [LAND DELETE] Attempting to delete plot #${plotNumber} by ${userHandle}`);

    // Get plot
    const [plot] = await db
      .select()
      .from(medievalLandPlots)
      .where(eq(medievalLandPlots.plotNumber, parseInt(plotNumber)));

    if (!plot) {
      return res.status(404).json({ error: 'Plot not found' });
    }

    // Check ownership
    if (plot.ownerHandle !== userHandle) {
      return res.status(403).json({ error: 'You do not own this plot' });
    }

    // Only allow deletion if plot is in owned status (not in battle, not contested, etc.)
    if (plot.status !== 'owned') {
      return res.status(400).json({ 
        error: `Cannot delete plot with status: ${plot.status}`,
        message: 'Plot must be in owned status to be released'
      });
    }

    // Release the plot back to available
    await db.update(medievalLandPlots)
      .set({
        ownerId: null,
        ownerHandle: null,
        ownerAddress: null,
        status: 'available',
        purchasePrice: null,
        purchaseCurrency: null,
        purchaseDate: null,
        purchaseTransaction: null,
        updated_at: new Date()
      } as any)
      .where(eq(medievalLandPlots.plotNumber, parseInt(plotNumber)));

    console.log(`✅ [LAND DELETE] Plot #${plotNumber} released back to available`);

    res.json({
      success: true,
      message: 'Plot released successfully',
      plotNumber: parseInt(plotNumber)
    });

  } catch (error: any) {
    console.error('❌ [LAND DELETE] Error:', error);
    res.status(500).json({
      error: 'Failed to delete plot',
      details: error.message
    });
  }
});

/**
 * GET /api/land/purchases/:userHandle
 * Get purchase history for a user
 */
router.get('/purchases/:userHandle', async (req, res) => {
  try {
    const { userHandle } = req.params;

    console.log(`📜 [LAND HISTORY] Fetching purchase history for ${userHandle}`);

    const purchases = await db
      .select()
      .from(landPlotPurchases)
      .where(eq(landPlotPurchases.buyerHandle, userHandle))
      .orderBy(desc(landPlotPurchases.createdAt))
      .limit(100);

    res.json({
      success: true,
      purchases,
      count: purchases.length
    });

  } catch (error: any) {
    console.error('❌ [LAND HISTORY] Error:', error);
    res.status(500).json({
      error: 'Failed to fetch purchase history',
      details: error.message
    });
  }
});

export default router;
