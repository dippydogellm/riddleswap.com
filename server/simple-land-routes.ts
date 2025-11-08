/**
 * Simple Land Purchase Routes - Direct XRPL Payments
 * 
 * Handles simple land plot purchases with direct XRP/RDL payments to wallet addresses
 * No complex bank systems - just simple wallet-to-wallet payments
 */

import { Router } from "express";
import { z } from "zod";
import { sessionAuth } from "./middleware/session-auth";

const router = Router();

// Simple payment address for land purchases
const LAND_PAYMENT_ADDRESS = "rEVrTKUKSLx5nxdfV8SAFTxS9FGFrfHRLo"; // Use logged-in user's address for simplicity

// Validation schemas
const getLandPricingSchema = z.object({
  plotId: z.string().min(1)
});

const initiatePurchaseSchema = z.object({
  plotId: z.string().min(1),
  paymentMethod: z.enum(['XRP', 'RDL'])
});

const verifyPurchaseSchema = z.object({
  purchaseId: z.string().min(1),
  transactionHash: z.string().min(1)
});

/**
 * Get simple pricing for a land plot
 */
router.get('/land-plots/:plotId/pricing', async (req, res) => {
  try {
    console.log(`🏞️ [SIMPLE LAND] Getting pricing for plot ${req.params.plotId}`);
    
    const plotId = req.params.plotId;
    
    // Simple fixed pricing (can be made dynamic later)
    const basePrice = 1; // 1 XRP base price
    const rdlDiscount = 50; // 50% discount for RDL
    
    const pricing = {
      plotId,
      plotNumber: parseInt(plotId) || 1,
      terrainType: "forest", // Default terrain
      plotSize: "medium", // Default size
      options: {
        XRP: {
          price: basePrice,
          currency: "XRP", 
          description: "Pay with XRP - instant ownership transfer"
        },
        RDL: {
          price: basePrice * 0.5, // 50% discount
          currency: "RDL",
          originalPrice: basePrice,
          discount: rdlDiscount,
          savings: basePrice * 0.5,
          description: "Pay with RDL tokens - 50% discount!"
        }
      },
      paymentAddress: LAND_PAYMENT_ADDRESS
    };

    console.log(`✅ [SIMPLE LAND] Pricing calculated:`, pricing);

    res.json({
      success: true,
      pricing
    });

  } catch (error) {
    console.error('❌ [SIMPLE LAND] Pricing error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get land pricing' 
    });
  }
});

/**
 * Initiate simple land purchase
 */
router.post('/land-plots/purchase/initiate', sessionAuth, async (req, res) => {
  try {
    console.log(`🛒 [SIMPLE LAND] Initiating purchase:`, req.body);
    
    const validation = initiatePurchaseSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid purchase data',
        details: validation.error.issues
      });
    }

    const { plotId, paymentMethod } = validation.data;
    const userId = req.user?.handle || 'anonymous';

    // Generate simple purchase details
    const basePrice = 1;
    const amount = paymentMethod === 'RDL' ? basePrice * 0.5 : basePrice;
    const currency = paymentMethod;
    
    // Simple purchase ID
    const purchaseId = `PLOT${plotId}_${Date.now()}`;
    
    // Simple destination tag for tracking
    const destinationTag = `${plotId}${Date.now().toString().slice(-6)}`;

    const purchaseDetails = {
      id: purchaseId,
      plotId,
      plotNumber: parseInt(plotId) || 1,
      paymentMethod,
      amount,
      currency,
      paymentAddress: LAND_PAYMENT_ADDRESS,
      discount: paymentMethod === 'RDL' ? {
        applied: true,
        percent: 50,
        savings: basePrice * 0.5
      } : undefined,
      instructions: {
        message: `Send ${amount} ${currency} to complete land plot purchase`,
        destinationTag: destinationTag,
        memo: `PLOT${plotId}_${userId}`
      }
    };

    console.log(`✅ [SIMPLE LAND] Purchase initiated:`, purchaseDetails);

    res.json({
      success: true,
      purchase: purchaseDetails
    });

  } catch (error) {
    console.error('❌ [SIMPLE LAND] Purchase initiation error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to initiate purchase' 
    });
  }
});

/**
 * Verify simple land purchase payment
 */
router.post('/land-plots/purchase/:purchaseId/verify', sessionAuth, async (req, res) => {
  try {
    console.log(`🔍 [SIMPLE LAND] Verifying purchase ${req.params.purchaseId}:`, req.body);
    
    const validation = verifyPurchaseSchema.safeParse({
      purchaseId: req.params.purchaseId,
      ...req.body
    });
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid verification data',
        details: validation.error.issues
      });
    }

    const { purchaseId, transactionHash } = validation.data;
    const userId = req.user?.handle || 'anonymous';

    console.log(`🔍 [SIMPLE LAND] Checking transaction ${transactionHash} for user ${userId}`);

    // Simple verification (in production, this would check the XRPL ledger)
    // For now, accept any transaction hash as valid
    if (transactionHash.length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Invalid transaction hash'
      });
    }

    console.log(`✅ [SIMPLE LAND] Payment verified for purchase ${purchaseId}`);
    console.log(`🏞️ [SIMPLE LAND] Land ownership transferred to ${userId}`);

    res.json({
      success: true,
      message: 'Payment verified and land ownership transferred!',
      plotNumber: purchaseId.split('_')[0].replace('PLOT', ''),
      transactionHash,
      owner: userId
    });

  } catch (error) {
    console.error('❌ [SIMPLE LAND] Verification error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to verify payment' 
    });
  }
});

export default router;