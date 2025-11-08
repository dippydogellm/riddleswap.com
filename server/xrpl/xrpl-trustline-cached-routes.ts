// Production-Ready XRPL Trustline Routes with Cached Private Keys
// Uses session-cached keys - NO PASSWORD NEEDED for most operations

import express from 'express';
import {
  getAllTrustlines,
  removeCompleteTrustline,
  removeAllTrustlines,
  verifyTrustlineRemoved
} from './xrpl-trustline-manager';

const router = express.Router();

/**
 * GET /api/xrpl/trustlines/list-cached
 * List all trustlines using cached session keys
 */
router.get('/list-cached', async (req, res) => {
  try {
    console.log('📋 [TRUSTLINES] List all trustlines (cached keys)');
    
    // Get session token from Authorization header
    const authHeader = req.headers.authorization;
    const sessionToken = authHeader?.replace('Bearer ', '');
    
    if (!sessionToken) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required - missing session token'
      });
    }
    
    // Get active session with cached keys
    const { activeSessions } = await import('../riddle-wallet-auth');
    const session = activeSessions.get(sessionToken);
    
    if (!session || !session.cachedKeys) {
      return res.status(401).json({
        success: false,
        error: 'Invalid session or no cached keys available'
      });
    }
    
    // Get XRP address from cached keys
    const xrpAddress = session.cachedKeys.xrpAddress;
    
    if (!xrpAddress) {
      return res.status(400).json({
        success: false,
        error: 'XRP address not found in cached session'
      });
    }
    
    console.log(`🔍 [TRUSTLINES] Fetching trustlines for ${xrpAddress}`);
    
    // Get all trustlines
    const trustlines = await getAllTrustlines(xrpAddress);
    
    // Filter for non-zero balances
    const withBalance = trustlines.filter(t => parseFloat(t.balance) !== 0);
    const zeroBalance = trustlines.filter(t => parseFloat(t.balance) === 0);
    
    console.log(`✅ [TRUSTLINES] Found ${trustlines.length} trustlines (${withBalance.length} with balance, ${zeroBalance.length} empty)`);
    
    res.json({
      success: true,
      trustlines: trustlines,
      summary: {
        total: trustlines.length,
        withBalance: withBalance.length,
        zeroBalance: zeroBalance.length
      }
    });
    
  } catch (error) {
    console.error('❌ [TRUSTLINES] List error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list trustlines',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/xrpl/trustlines/remove-cached
 * Remove a single trustline (redeems tokens if needed)
 * Uses cached session keys - NO PASSWORD NEEDED
 */
router.post('/remove-cached', async (req, res) => {
  try {
    const { currency, issuer } = req.body;
    
    if (!currency || !issuer) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: currency, issuer'
      });
    }
    
    console.log(`🗑️ [TRUSTLINES] Removing trustline: ${currency} (${issuer})`);
    
    // Get session token
    const authHeader = req.headers.authorization;
    const sessionToken = authHeader?.replace('Bearer ', '');
    
    if (!sessionToken) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }
    
    // Get active session with cached keys
    const { activeSessions } = await import('../riddle-wallet-auth');
    const session = activeSessions.get(sessionToken);
    
    if (!session?.cachedKeys?.xrpPrivateKey) {
      return res.status(401).json({
        success: false,
        error: 'Invalid session or no cached XRP private key available'
      });
    }
    
    console.log(`🔑 [TRUSTLINES] Using cached XRP private key for ${session.handle}`);
    
    // Complete removal (redeem + remove)
    const result = await removeCompleteTrustline(
      session.cachedKeys.xrpPrivateKey,
      issuer,
      currency
    );
    
    if (result.success) {
      console.log(`✅ [TRUSTLINES] Trustline removed: ${currency} (${issuer})`);
      console.log(`📋 [TRUSTLINES] Details:`, result.details);
    } else {
      console.error(`❌ [TRUSTLINES] Removal failed:`, result.error);
    }
    
    res.json(result);
    
  } catch (error) {
    console.error('❌ [TRUSTLINES] Remove error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove trustline',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/xrpl/trustlines/remove-all-cached
 * Remove ALL trustlines (redeems all balances automatically)
 * Uses cached session keys - NO PASSWORD NEEDED
 */
router.post('/remove-all-cached', async (req, res) => {
  try {
    console.log(`🚀 [TRUSTLINES] Removing ALL trustlines (cached keys)`);
    
    // Get session token
    const authHeader = req.headers.authorization;
    const sessionToken = authHeader?.replace('Bearer ', '');
    
    if (!sessionToken) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }
    
    // Get active session with cached keys
    const { activeSessions } = await import('../riddle-wallet-auth');
    const session = activeSessions.get(sessionToken);
    
    if (!session?.cachedKeys?.xrpPrivateKey) {
      return res.status(401).json({
        success: false,
        error: 'Invalid session or no cached XRP private key available'
      });
    }
    
    console.log(`🔑 [TRUSTLINES] Using cached XRP private key for ${session.handle}`);
    
    // Remove all trustlines
    const result = await removeAllTrustlines(session.cachedKeys.xrpPrivateKey);
    
    if (result.success) {
      console.log(`✅ [TRUSTLINES] All trustlines removed: ${result.totalRemoved} successful`);
    } else {
      console.error(`⚠️ [TRUSTLINES] Partial success: ${result.totalRemoved} removed, ${result.failed.length} failed`);
    }
    
    res.json(result);
    
  } catch (error) {
    console.error('❌ [TRUSTLINES] Remove all error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove all trustlines',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/xrpl/trustlines/verify-removed
 * Verify a trustline has been completely removed
 */
router.post('/verify-removed', async (req, res) => {
  try {
    const { currency, issuer } = req.body;
    
    if (!currency || !issuer) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: currency, issuer'
      });
    }
    
    console.log(`🔍 [TRUSTLINES] Verifying removal: ${currency} (${issuer})`);
    
    // Get session token
    const authHeader = req.headers.authorization;
    const sessionToken = authHeader?.replace('Bearer ', '');
    
    if (!sessionToken) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }
    
    // Get active session with cached keys
    const { activeSessions } = await import('../riddle-wallet-auth');
    const session = activeSessions.get(sessionToken);
    
    if (!session?.cachedKeys?.xrpAddress) {
      return res.status(401).json({
        success: false,
        error: 'Invalid session or no XRP address available'
      });
    }
    
    // Verify removal
    const verification = await verifyTrustlineRemoved(
      session.cachedKeys.xrpAddress,
      issuer,
      currency
    );
    
    if (verification.removed) {
      console.log(`✅ [TRUSTLINES] Verified: Trustline completely removed`);
    } else {
      console.log(`⚠️ [TRUSTLINES] Trustline still exists - balance: ${verification.balance}`);
    }
    
    res.json({
      success: true,
      ...verification
    });
    
  } catch (error) {
    console.error('❌ [TRUSTLINES] Verify error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify removal',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
