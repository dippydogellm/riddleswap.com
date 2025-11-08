// Wallet Bridge Routes - Separated by chain with wallet integration
import type { Express, Request } from "express";
import { XRPLBridgeHandler } from './xrpl-bridge';
import { EVMBridgeHandler } from './evm-bridge';
import { SolanaBridgeHandler } from './solana-bridge';
import { BTCBridgeHandler } from './btc-bridge';
import { registerBridgeExchangeRoutes } from './bridge-exchange-routes';
import { db } from '../db';
import { bridge_payloads } from '../../shared/schema';
import { eq, sql } from 'drizzle-orm';
import { Client, Wallet, Payment } from 'xrpl';

// Authentication middleware for bridge routes
export async function authenticateBridge(req: any, res: any, next: any) {
  console.log('\n🔐 === BRIDGE AUTH MIDDLEWARE START ===');
  console.log('🔍 Bridge auth called for:', req.method, req.url);
  // Get session token from Authorization header or try fallback methods
  let sessionToken = req.headers.authorization?.replace('Bearer ', '');
  
  // If no auth header, try to get from cookies or body
  if (!sessionToken) {
    // Try from cookies
    const cookies = req.headers.cookie;
    if (cookies) {
      const sessionCookie = cookies.split(';').find((c: string) => c.trim().startsWith('sessionToken='));
      if (sessionCookie) {
        sessionToken = sessionCookie.split('=')[1];
      }
    }
    
    // Try from request body as fallback
    if (!sessionToken && req.body?.sessionToken) {
      sessionToken = req.body.sessionToken;
    }
  }
  
  if (!sessionToken) {
    console.log(`🚫 Bridge access denied: No session token provided via header, cookie, or body`);
    console.log(`🔍 Available headers:`, Object.keys(req.headers));
    console.log(`🔍 Available body keys:`, req.body ? Object.keys(req.body) : 'No body');
    return res.status(401).json({
      success: false,
      error: 'Authentication required for bridge access. Session token missing.',
      code: 'NO_SESSION_TOKEN'
    });
  }
  
  console.log(`🔐 Bridge auth: Found session token via ${req.headers.authorization ? 'header' : req.headers.cookie ? 'cookie' : 'body'}`);
  console.log(`🔍 Bridge auth: Session token preview: ${sessionToken?.slice(0, 12)}...`);
  
  // Get active session from server memory WITH CACHED KEYS
  const authModule = await import('../riddle-wallet-auth');
  const session = authModule.getActiveSession(sessionToken);
  
  // DEBUG: Print ALL active sessions to see what's really there
  console.log(`🔍 DEBUG: Checking if session exists in memory...`);
  console.log(`🔍 DEBUG: Looking for token: ${sessionToken}`);
  console.log(`🔍 DEBUG: Total active sessions in memory: ${authModule.getActiveSessionsCount()}`);
  
  // Check what sessions actually exist
  try {
    // Skip this debug check for now - just log session count
    console.log(`🔍 DEBUG: Session lookup attempting authentication`);
  } catch (e) {
    console.log(`🔍 DEBUG: Could not get active sessions:`, e);
  }
  
  // Debug session lookup
  console.log(`🔍 Bridge auth: Session lookup for token: ${sessionToken}`);
  console.log(`🔍 Bridge auth: Total active sessions: ${authModule.getActiveSessionsCount()}`);
  console.log(`🔍 Bridge auth: Session lookup result:`, {
    found: !!session,
    handle: session?.handle,
    hasCachedKeys: !!session?.cachedKeys,
    cachedKeyTypes: session?.cachedKeys ? Object.keys(session.cachedKeys) : []
  });
  
  if (!session) {
    console.log(`🚫 Bridge access denied: Invalid session token: ${sessionToken?.slice(0, 8)}...`);
    console.log(`🔍 Bridge auth: Session not found in memory - checking database for session restore`);
    
    // Try to restore session from database
    try {
      const { storage } = await import('../storage');
      const dbSession = await storage.getRiddleWalletSession(sessionToken);
      
      if (!dbSession || new Date() > dbSession.expiresAt) {
        console.log(`🔍 Bridge auth: No valid session in database either`);
        return res.status(401).json({
          success: false,
          error: 'Session expired. Please log in again.',
          code: 'SESSION_EXPIRED'
        });
      }
      
      console.log(`⚠️ Bridge auth: Session found in database but no cached keys - fresh login required for security`);
      return res.status(401).json({
        success: false,
        error: 'Session restored but private keys missing. Please log in again for security.',
        code: 'MISSING_CACHED_KEYS',
        requiresReLogin: true
      });
      
    } catch (error) {
      console.log(`❌ Bridge auth: Database session lookup failed:`, error);
      return res.status(401).json({
        success: false,
        error: 'Invalid session. Please log in again.',
        code: 'INVALID_SESSION'
      });
    }
  }
  
  console.log(`✅ Bridge auth successful for user: ${session.handle}`);
  console.log(`🔑 Cached keys available: ${!!session.cachedKeys}`);
  
  // Attach FULL session to request for downstream use (including cachedKeys)
  req.session = session;
  req.userHandle = session.handle;
  req.sessionID = sessionToken; // Add sessionID for EVM bridge compatibility
  
  // Add session.id for compatibility with EVM bridge routes
  if (!(session as any).id) {
    (session as any).id = sessionToken;
  }
  
  // Check if cached keys are available - required for all bridge operations
  if (!session.cachedKeys) {
    console.log(`⚠️ Bridge auth: No cached keys in session - fresh login required`);
    
    // For security, private keys are only cached during login, never stored
    return res.status(401).json({
      success: false,
      error: 'Please login again to enable bridge transactions',
      code: 'MISSING_CACHED_KEYS',
      requiresReLogin: true
    });
  }
  
  console.log(`🔐 Bridge auth: Cached keys verified for ${session.handle}`);
  next();
}

export async function registerWalletBridgeRoutes(app: Express) {
  console.log('🌉 Registering wallet bridge routes...');
  
  // Remove individual CORS middleware - rely on global configuration

  // Test endpoint to verify authentication middleware works
  app.post("/api/bridge/test-auth", authenticateBridge, (req, res) => {
    console.log('✅ Bridge auth test passed!');
    res.json({ success: true, message: 'Authentication works!' });
  });
  
  // Register exchange rate routes
  registerBridgeExchangeRoutes(app);

  // ==================================================
  // XRPL BRIDGE ROUTES (Riddle + Xaman)
  // ==================================================
  
  // Auto-execute XRPL bridge transaction using cached keys
  app.post("/api/bridge/xrpl/auto-execute", authenticateBridge, async (req, res) => {
    // Auto-execute XRPL bridge transaction
    
    try {
      const { transactionId } = req.body;
      
      // Processing transaction
      
      if (!transactionId) {
        // No transaction ID provided
        return res.status(400).json({
          success: false,
          error: 'Transaction ID is required'
        });
      }

      // Get session data
      const userHandle = (req as any).session?.handle;
      const cachedKeys = (req as any).session?.cachedKeys;
      
      // User authentication verified
      // Cached keys verified
      console.log('🔐 [AUTO-EXECUTE] XRP private key available:', !!cachedKeys?.xrpPrivateKey);
      
      if (!userHandle || !cachedKeys || !cachedKeys.xrpPrivateKey) {
        console.log('❌ [AUTO-EXECUTE] ERROR: Missing authentication data');
        console.log('❌ [AUTO-EXECUTE] - User handle:', !!userHandle);
        console.log('❌ [AUTO-EXECUTE] - Cached keys:', !!cachedKeys);
        console.log('❌ [AUTO-EXECUTE] - XRP key:', !!cachedKeys?.xrpPrivateKey);
        return res.status(401).json({
          success: false,
          error: 'Session not found or no cached keys available'
        });
      }

      console.log('🚀 Auto-executing bridge transaction:', transactionId);

      // Get bridge payload from database
      console.log('🔍 [AUTO-EXECUTE] Searching database for transaction:', transactionId);
      const bridgePayload = await db.select().from(bridge_payloads)
        .where(eq(bridge_payloads.transaction_id, transactionId))
        .limit(1);
      console.log('📋 [AUTO-EXECUTE] Bridge payloads found:', bridgePayload.length);
      console.log('📋 [AUTO-EXECUTE] First payload:', bridgePayload[0]);

      if (!bridgePayload.length) {
        console.log('❌ [AUTO-EXECUTE] ERROR: Bridge transaction not found in database');
        console.log('❌ [AUTO-EXECUTE] - Searched for transaction_id:', transactionId);
        return res.status(404).json({
          success: false,
          error: 'Bridge transaction not found'
        });
      }

      const payload = bridgePayload[0];
      
      // Check if payload exists
      if (!payload.payload) {
        return res.status(400).json({
          success: false,
          error: 'Bridge payload data not found'
        });
      }
      
      const payloadData = JSON.parse(payload.payload);

      // Connect to XRPL and execute transaction
      const client = await XRPLBridgeHandler.connectToXRPL();

      try {
        // Create wallet from cached private key
        const wallet = Wallet.fromSeed(cachedKeys.xrpPrivateKey);
        console.log('✅ Wallet created from cached key:', wallet.address);

        // Prepare the payment transaction
        const payment: Payment = {
          TransactionType: 'Payment',
          Account: wallet.address,
          Destination: payloadData.Destination,
          Amount: payloadData.Amount,
          Memos: payloadData.Memos || []
        };

        console.log('💰 Executing automatic payment:', {
          from: wallet.address,
          to: payloadData.Destination,
          amount: payloadData.Amount,
          memos: payloadData.Memos?.length || 0
        });

        // Submit the transaction
        const response = await client.submitAndWait(payment, { wallet });
        
        console.log('✅ Auto-transaction executed successfully:', response.result.hash);

        // Update bridge payload status
        await db.update(bridge_payloads)
          .set({  
            status: 'paid',
            txHash: response.result.hash,
            updatedAt: new Date()
           } as any)
          .where(eq(bridge_payloads.transaction_id, transactionId));

        return res.json({
          success: true,
          txHash: response.result.hash,
          message: 'Bridge transaction executed automatically',
          details: {
            from: wallet.address,
            to: payloadData.Destination,
            amount: payloadData.Amount,
            ledgerIndex: response.result.ledger_index
          }
        });

      } finally {
        await client.disconnect();
      }

    } catch (error) {
      console.error('❌ Auto-execute error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to auto-execute bridge transaction',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Create XRPL bridge payload
  app.post("/api/bridge/xrpl/create", authenticateBridge, async (req, res) => {
    console.log('\n🔗 === XRPL BRIDGE CREATE START ===');
    console.log('📦 XRPL bridge request:', JSON.stringify(req.body, null, 2));
    
    try {
      const { fromToken, toToken, amount, fromAddress, toAddress } = req.body;
      
      // Extract session data for wallet authentication (correct structure)
      const userHandle = (req as any).session?.handle;
      const cachedKeys = (req as any).session?.cachedKeys;
      
      console.log('🔍 Session data for bridge creation:', {
        handle: userHandle,
        hasSession: !!(req as any).session,
        hasCachedKeys: !!cachedKeys,
        cachedKeyTypes: cachedKeys ? Object.keys(cachedKeys) : [],
        sessionKeys: (req as any).session ? Object.keys((req as any).session) : []
      });
      
      // Verify we have the required cached keys for XRPL
      if (!cachedKeys?.xrpPrivateKey) {
        console.log('❌ [XRPL BRIDGE] Missing XRP private key in cached keys');
        return res.status(401).json({
          success: false,
          error: 'XRP private key not available in session. Please re-login.',
          code: 'MISSING_XRP_KEY',
          needsReauth: true
        });
      }
      
      console.log('✅ [XRPL BRIDGE] XRP private key available in session');
      
      const result = await XRPLBridgeHandler.createXRPLBridge({
        fromToken: fromToken || 'XRP',
        toToken: toToken || 'RDL', // Default to RDL for bridge
        amount,
        destinationAddress: toAddress,
        walletType: 'riddle', // Default for authenticated sessions
        riddleWalletId: userHandle,
        walletHandle: userHandle,
        password: 'session-cached', // Use cached keys - no password needed
        cachedKeys: cachedKeys // Pass cached keys from session
      });
      
      console.log('✅ XRPL bridge create completed');
      console.log('🔗 === XRPL BRIDGE CREATE END ===\n');
      
      res.json(result);
    } catch (error) {
      console.error('❌ XRPL bridge creation error:', error);
      console.log('🔗 === XRPL BRIDGE CREATE END (ERROR) ===\n');
      
      const errorMessage = error instanceof Error ? error.message : 'XRPL bridge creation failed';
      
      // Check if this is a missing cached keys error - return 401 for frontend to redirect
      if (errorMessage.includes('cached keys') || errorMessage.includes('Authentication required') || errorMessage.includes('private key')) {
        console.log('🔓 Returning 401 for missing cached keys - frontend should redirect');
        return res.status(401).json({ 
          success: false, 
          error: errorMessage,
          code: 'MISSING_CACHED_KEYS',
          needsReauth: true
        });
      }
      
      res.status(500).json({
        success: false,
        error: 'XRPL bridge creation failed',
        message: errorMessage
      });
    }
  });

  // Execute XRPL transaction with Riddle wallet - NO PASSWORD NEEDED
  app.post("/api/bridge/xrpl/execute", async (req, res) => {
    console.log('\n🔗 === XRPL BRIDGE EXECUTE START (NO PASSWORD) ===');
    console.log('📦 XRPL execute request with cached keys');
    
    try {
      const { transactionId } = req.body;
      
      // Get session token from Authorization header
      const authHeader = req.headers.authorization;
      const sessionToken = authHeader?.replace('Bearer ', '');
      
      if (!transactionId || !sessionToken) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters for XRPL execution'
        });
      }

      console.log('🔑 Using cached private keys (NO PASSWORD REQUIRED)');
      
      // Use live XRPL execution with cached keys
      const { executeLiveXRPLTransaction } = await import('./live-xrpl-execution');
      const result = await executeLiveXRPLTransaction(transactionId, sessionToken);
      
      console.log('🔗 XRPL execute result:', result);
      console.log('🔗 === XRPL BRIDGE EXECUTE END ===\n');
      
      res.json(result);
    } catch (error) {
      console.error('❌ XRPL execute error:', error);
      console.log('🔗 === XRPL BRIDGE EXECUTE END (ERROR) ===\n');
      
      res.status(500).json({
        success: false,
        error: 'XRPL execution failed'
      });
    }
  });

  // Complete XRPL bridge dynamically
  app.post("/api/bridge/xrpl/complete", authenticateBridge, async (req, res) => {
    console.log('\n🔗 === BRIDGE COMPLETE START ===');
    console.log('📦 Bridge complete request:', JSON.stringify(req.body, null, 2));
    
    try {
      const { transactionId, destinationAddress } = req.body;
      
      if (!transactionId || !destinationAddress) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters for bridge completion'
        });
      }

      const { DynamicBridgeCompletion } = await import('./dynamic-bridge-completion');
      const result = await DynamicBridgeCompletion.completeBridge(
        transactionId,
        destinationAddress,
        req as any
      );
      
      console.log('✅ Bridge complete result:', result);
      console.log('🔗 === BRIDGE COMPLETE END ===\n');
      
      res.json(result);
    } catch (error) {
      console.error('❌ Bridge complete error:', error);
      console.log('🔗 === BRIDGE COMPLETE END (ERROR) ===\n');
      
      res.status(500).json({
        success: false,
        error: 'Bridge completion failed'
      });
    }
  });

  // ==================================================
  // EVM BRIDGE ROUTES (Riddle + WalletConnect)
  // ==================================================
  
  // Create EVM bridge payload
  app.post("/api/bridge/evm/create", authenticateBridge, async (req, res) => {
    console.log('\n⚡ === EVM BRIDGE CREATE START ===');
    console.log('📦 EVM bridge request:', JSON.stringify(req.body, null, 2));
    
    try {
      // Get session token and user handle from authentication
      const authHeader = req.headers.authorization;
      const sessionToken = authHeader?.replace('Bearer ', '');
      const userHandle = (req as any).userHandle; // From requireAuthentication middleware
      
      // Pass session token and user handle to bridge handler
      const bridgeParams = {
        ...req.body,
        sessionToken,
        walletHandle: userHandle
      };
      
      console.log('🔑 EVM bridge with auth data:', { sessionToken: sessionToken ? 'present' : 'missing', walletHandle: userHandle });
      
      const result = await EVMBridgeHandler.createEVMBridge(bridgeParams);
      
      console.log('✅ EVM bridge create completed');
      console.log('⚡ === EVM BRIDGE CREATE END ===\n');
      
      res.json(result);
    } catch (error) {
      console.error('❌ EVM bridge create error:', error);
      console.log('⚡ === EVM BRIDGE CREATE END (ERROR) ===\n');
      
      res.status(500).json({
        success: false,
        error: 'EVM bridge creation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Execute EVM transaction with Riddle wallet - NO PASSWORD NEEDED
  app.post("/api/bridge/evm/execute", async (req, res) => {
    console.log('\n⚡ === EVM BRIDGE EXECUTE START (NO PASSWORD) ===');
    console.log('📦 EVM execute request with cached keys');
    
    try {
      const { transactionId } = req.body;
      
      // Get session token from Authorization header
      const authHeader = req.headers.authorization;
      const sessionToken = authHeader?.replace('Bearer ', '');
      
      if (!transactionId || !sessionToken) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters for EVM execution'
        });
      }

      // Get bridge payload to determine the chain
      const { db } = await import('../db');
      const { bridge_payloads } = await import('../../shared/schema');
      const { eq } = await import('drizzle-orm');
      
      const [bridgePayload] = await db
        .select()
        .from(bridge_payloads)
        .where(eq(bridge_payloads.transaction_id, transactionId))
        .limit(1);
        
      if (!bridgePayload) {
        return res.status(400).json({
          success: false,
          error: 'Bridge transaction not found'
        });
      }
      
      const chain = bridgePayload.fromCurrency; // Get chain from payload
      console.log(`🔗 EVM execution for chain: ${chain}`);
      
      if (!chain) {
        return res.status(400).json({
          success: false,
          error: 'Unable to determine chain from bridge payload'
        });
      }
      
      console.log('🔑 Using cached private keys (NO PASSWORD REQUIRED)');

      const result = await EVMBridgeHandler.executeEVMWithCachedKeys(
        transactionId,
        sessionToken,
        chain
      );
      
      console.log('⚡ EVM execute result:', result);
      console.log('⚡ === EVM BRIDGE EXECUTE END ===\n');
      
      res.json(result);
    } catch (error) {
      console.error('❌ EVM execute error:', error);
      console.log('⚡ === EVM BRIDGE EXECUTE END (ERROR) ===\n');
      
      res.status(500).json({
        success: false,
        error: 'EVM execution failed'
      });
    }
  });

  // Complete EVM bridge dynamically
  app.post("/api/bridge/evm/complete", authenticateBridge, async (req, res) => {
    console.log('\n⚡ === BRIDGE COMPLETE START ===');
    console.log('📦 Bridge complete request:', JSON.stringify(req.body, null, 2));
    
    try {
      const { transactionId, destinationAddress } = req.body;
      
      if (!transactionId || !destinationAddress) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters for bridge completion'
        });
      }

      const { DynamicBridgeCompletion } = await import('./dynamic-bridge-completion');
      const result = await DynamicBridgeCompletion.completeBridge(
        transactionId,
        destinationAddress,
        req as any
      );
      
      console.log('✅ Bridge complete result:', result);
      console.log('⚡ === BRIDGE COMPLETE END ===\n');
      
      res.json(result);
    } catch (error) {
      console.error('❌ Bridge complete error:', error);
      console.log('⚡ === BRIDGE COMPLETE END (ERROR) ===\n');
      
      res.status(500).json({
        success: false,
        error: 'Bridge completion failed'
      });
    }
  });

  // ==================================================
  // SOLANA BRIDGE ROUTES (Riddle + WalletConnect)
  // ==================================================
  
  // Create Solana bridge payload
  app.post("/api/bridge/solana/create", authenticateBridge, async (req, res) => {
    console.log('\n🟣 === SOLANA BRIDGE CREATE START ===');
    console.log('📦 Solana bridge request:', JSON.stringify(req.body, null, 2));
    
    try {
      // Get session token and user handle from authentication
      const authHeader = req.headers.authorization;
      const sessionToken = authHeader?.replace('Bearer ', '');
      const userHandle = (req as any).userHandle; // From requireAuthentication middleware
      
      // Pass session token and user handle to bridge handler
      const bridgeParams = {
        ...req.body,
        sessionToken,
        walletHandle: userHandle
      };
      
      console.log('🔑 SOL bridge with auth data:', { sessionToken: sessionToken ? 'present' : 'missing', walletHandle: userHandle });
      
      const result = await SolanaBridgeHandler.createSolanaBridge(bridgeParams);
      
      console.log('✅ Solana bridge create completed');
      console.log('🟣 === SOLANA BRIDGE CREATE END ===\n');
      
      res.json(result);
    } catch (error) {
      console.error('❌ Solana bridge create error:', error);
      console.log('🟣 === SOLANA BRIDGE CREATE END (ERROR) ===\n');
      
      res.status(500).json({
        success: false,
        error: 'Solana bridge creation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Execute Solana transaction with Riddle wallet - NO PASSWORD NEEDED
  app.post("/api/bridge/solana/execute", async (req, res) => {
    console.log('\n🟣 === SOLANA BRIDGE EXECUTE START (NO PASSWORD) ===');
    console.log('📦 Solana execute request with cached keys');
    
    try {
      const { transactionId } = req.body;
      
      // Get session token from Authorization header
      const authHeader = req.headers.authorization;
      const sessionToken = authHeader?.replace('Bearer ', '');
      
      if (!transactionId || !sessionToken) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters for Solana execution'
        });
      }

      console.log('🔑 Using cached private keys (NO PASSWORD REQUIRED)');

      const result = await SolanaBridgeHandler.executeSolanaWithCachedKeys(
        transactionId,
        sessionToken
      );
      
      console.log('🟣 Solana execute result:', result);
      
      // Update bridge payload with Step 2 transaction hash (already done in handler if successful)
      if (result.success && result.txHash && !result.message?.includes('already')) {
        const { db } = await import('../db');
        const { bridge_payloads } = await import('../../shared/schema');
        const { eq } = await import('drizzle-orm');
        
        await db.update(bridge_payloads)
          .set({ 
            txHash: result.txHash,
            step: 2,
            status: 'executed',
            updatedAt: new Date()
           } as any)
          .where(eq(bridge_payloads.transaction_id, transactionId));
        
        console.log(`✅ Step 2 SOL transaction recorded: ${result.txHash}`);
      }
      
      console.log('🟣 === SOLANA BRIDGE EXECUTE END ===\n');
      
      res.json(result);
    } catch (error) {
      console.error('❌ Solana execute error:', error);
      console.log('🟣 === SOLANA BRIDGE EXECUTE END (ERROR) ===\n');
      
      res.status(500).json({
        success: false,
        error: 'Solana execution failed'
      });
    }
  });

  // Complete Solana bridge dynamically  
  app.post("/api/bridge/solana/complete", authenticateBridge, async (req, res) => {
    console.log('\n🟣 === BRIDGE COMPLETE START ===');
    console.log('📦 Bridge complete request:', JSON.stringify(req.body, null, 2));
    
    try {
      const { transactionId, destinationAddress } = req.body;
      
      if (!transactionId || !destinationAddress) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters for bridge completion'
        });
      }

      const { DynamicBridgeCompletion } = await import('./dynamic-bridge-completion');
      const result = await DynamicBridgeCompletion.completeBridge(
        transactionId,
        destinationAddress,
        req as any
      );
      
      console.log('✅ Bridge complete result:', result);
      console.log('🟣 === BRIDGE COMPLETE END ===\n');
      
      res.json(result);
    } catch (error) {
      console.error('❌ Bridge complete error:', error);
      console.log('🟣 === BRIDGE COMPLETE END (ERROR) ===\n');
      
      res.status(500).json({
        success: false,
        error: 'Bridge completion failed'
      });
    }
  });

  // ==================================================
  // BITCOIN BRIDGE ROUTES (Riddle Wallet ONLY)
  // ==================================================
  
  // Create Bitcoin bridge payload - RIDDLE WALLET ONLY
  app.post("/api/bridge/btc/create", authenticateBridge, async (req, res) => {
    console.log('\n₿ === BITCOIN BRIDGE CREATE START ===');
    console.log('📦 Bitcoin bridge request:', JSON.stringify(req.body, null, 2));
    
    try {
      // Bitcoin bridge ONLY supports Riddle wallet
      if (req.body.walletType !== 'riddle') {
        return res.status(400).json({
          success: false,
          error: 'Bitcoin bridge only supports Riddle wallet. WalletConnect is not available for Bitcoin.'
        });
      }

      // Get session token and user handle from authentication
      const authHeader = req.headers.authorization;
      const sessionToken = authHeader?.replace('Bearer ', '');
      const userHandle = (req as any).userHandle; // From requireAuthentication middleware
      
      // Pass session token and user handle to bridge handler
      const bridgeParams = {
        ...req.body,
        sessionToken,
        walletHandle: userHandle
      };
      
      console.log('🔑 BTC bridge with auth data:', { sessionToken: sessionToken ? 'present' : 'missing', walletHandle: userHandle });
      
      const result = await BTCBridgeHandler.createBTCBridge(bridgeParams);
      
      console.log('✅ Bitcoin bridge create completed');
      console.log('₿ === BITCOIN BRIDGE CREATE END ===\n');
      
      res.json(result);
    } catch (error) {
      console.error('❌ Bitcoin bridge create error:', error);
      console.log('₿ === BITCOIN BRIDGE CREATE END (ERROR) ===\n');
      
      res.status(500).json({
        success: false,
        error: 'Bitcoin bridge creation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Check Bitcoin transaction readiness (UTXO preflight)
  app.post("/api/bridge/btc/check-readiness", authenticateBridge, async (req, res) => {
    console.log('\n🔍 === BITCOIN READINESS CHECK START ===');
    console.log('📦 Bitcoin readiness check request:', JSON.stringify(req.body, null, 2));
    
    try {
      const { transactionId } = req.body;
      const userHandle = (req as any).session?.handle;
      const cachedKeys = (req as any).session?.cachedKeys;
      
      if (!transactionId) {
        return res.status(400).json({
          success: false,
          error: 'Transaction ID is required for readiness check'
        });
      }
      
      if (!cachedKeys?.btcAddress) {
        return res.status(400).json({
          success: false,
          error: 'BTC address not available in session'
        });
      }
      
      // Get bridge data to get amount
      const [bridgeData] = await db
        .select()
        .from(bridge_payloads)
        .where(eq(bridge_payloads.transaction_id, transactionId))
        .limit(1);
      
      if (!bridgeData) {
        return res.status(404).json({
          success: false,
          error: 'Bridge transaction not found'
        });
      }
      
      // Check transaction readiness with UTXO preflight
      const readinessResult = await BTCBridgeHandler.checkTransactionReadiness(
        transactionId,
        cachedKeys.btcAddress,
        parseFloat(bridgeData.amount as string)
      );
      
      console.log('✅ Bitcoin readiness check completed:', readinessResult.status);
      console.log('🔍 === BITCOIN READINESS CHECK END ===\n');
      
      res.json({
        success: true,
        ...readinessResult,
        transactionId,
        btcAddress: cachedKeys.btcAddress
      });
      
    } catch (error) {
      console.error('❌ Bitcoin readiness check error:', error);
      console.log('🔍 === BITCOIN READINESS CHECK END (ERROR) ===\n');
      
      res.status(500).json({
        success: false,
        error: 'Bitcoin readiness check failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Execute Bitcoin transaction with Riddle wallet - Enhanced with UTXO preflight
  app.post("/api/bridge/btc/execute", authenticateBridge, async (req, res) => {
    console.log('\n₿ === BITCOIN BRIDGE EXECUTE START (ENHANCED) ===');
    console.log('📦 Bitcoin execute request with UTXO preflight');
    
    try {
      const { transactionId, forceExecute = false } = req.body;
      
      // Get session data from authentication middleware (instead of manual auth)
      const userHandle = (req as any).session?.handle;
      const cachedKeys = (req as any).session?.cachedKeys;
      const sessionToken = req.headers.authorization?.replace('Bearer ', '');
      
      console.log('🔍 Execute params:', { transactionId, userHandle, hasSession: !!sessionToken });
      
      // Restrict forceExecute to admin users only for security
      if (forceExecute && userHandle !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Force execution is restricted to admin users only'
        });
      }
      
      if (!transactionId) {
        return res.status(400).json({
          success: false,
          error: 'Transaction ID is required for Bitcoin execution'
        });
      }

      console.log('🔑 Using cached private keys with enhanced UTXO preflight');

      const result = await BTCBridgeHandler.executeBTCTransactionWithCachedKeys(
        transactionId,
        sessionToken,
        forceExecute
      );
      
      console.log('₿ Bitcoin execute result:', result);
      console.log('₿ === BITCOIN BRIDGE EXECUTE END ===\n');
      
      res.json(result);
    } catch (error) {
      console.error('❌ Bitcoin execute error:', error);
      console.log('₿ === BITCOIN BRIDGE EXECUTE END (ERROR) ===\n');
      
      res.status(500).json({
        success: false,
        error: 'Bitcoin execution failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get Bitcoin bridge status with funding instructions
  app.post("/api/bridge/btc/status", authenticateBridge, async (req, res) => {
    console.log('\n📊 === BITCOIN BRIDGE STATUS START ===');
    console.log('📦 Bitcoin status request:', JSON.stringify(req.body, null, 2));
    
    try {
      const { transactionId } = req.body;
      
      if (!transactionId) {
        return res.status(400).json({
          success: false,
          error: 'Transaction ID is required for status check'
        });
      }
      
      // Get bridge payload from database
      const [bridgeData] = await db
        .select()
        .from(bridge_payloads)
        .where(eq(bridge_payloads.transaction_id, transactionId))
        .limit(1);
      
      if (!bridgeData) {
        return res.status(404).json({
          success: false,
          error: 'Bridge transaction not found'
        });
      }
      
      const userHandle = (req as any).session?.handle;
      const cachedKeys = (req as any).session?.cachedKeys;
      
      let fundingInstructions = null;
      let utxoCheck = null;
      
      // If awaiting funding and we have BTC address, get fresh UTXO check
      if (bridgeData.status === 'awaiting_funding' && cachedKeys?.btcAddress) {
        try {
          utxoCheck = await BTCBridgeHandler.performUTXOPreflightCheck({
            btcAddress: cachedKeys.btcAddress,
            amount: parseFloat(bridgeData.amount as string),
            transactionId
          });
          
          if (!utxoCheck.success) {
            fundingInstructions = BTCBridgeHandler.generateFundingInstructions(
              utxoCheck,
              cachedKeys.btcAddress
            );
          }
        } catch (error) {
          console.warn('Failed to check UTXOs for status:', error);
        }
      }
      
      const response = {
        success: true,
        transactionId,
        status: bridgeData.status,
        step: bridgeData.step,
        amount: bridgeData.amount,
        fromCurrency: bridgeData.fromCurrency,
        toCurrency: bridgeData.toCurrency,
        txHash: bridgeData.txHash || bridgeData.tx_hash,
        createdAt: bridgeData.createdAt,
        updatedAt: bridgeData.updatedAt,
        errorMessage: bridgeData.errorMessage,
        btcAddress: cachedKeys?.btcAddress,
        fundingInstructions,
        utxoCheck,
        readyToExecute: bridgeData.status === 'ready' || (utxoCheck?.success === true)
      };
      
      console.log('✅ Bitcoin status check completed:', bridgeData.status);
      console.log('📊 === BITCOIN BRIDGE STATUS END ===\n');
      
      res.json(response);
      
    } catch (error) {
      console.error('❌ Bitcoin status check error:', error);
      console.log('📊 === BITCOIN BRIDGE STATUS END (ERROR) ===\n');
      
      res.status(500).json({
        success: false,
        error: 'Bitcoin status check failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Complete Bitcoin bridge dynamically
  app.post("/api/bridge/btc/complete", authenticateBridge, async (req, res) => {
    console.log('\n₿ === BRIDGE COMPLETE START ===');
    console.log('📦 Bridge complete request:', JSON.stringify(req.body, null, 2));
    
    try {
      const { transactionId, destinationAddress } = req.body;
      
      if (!transactionId || !destinationAddress) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters for bridge completion'
        });
      }

      const { DynamicBridgeCompletion } = await import('./dynamic-bridge-completion');
      const result = await DynamicBridgeCompletion.completeBridge(
        transactionId,
        destinationAddress,
        req as any
      );
      
      console.log('✅ Bridge complete result:', result);
      console.log('₿ === BRIDGE COMPLETE END ===\n');
      
      res.json(result);
    } catch (error) {
      console.error('❌ Bridge complete error:', error);
      console.log('₿ === BRIDGE COMPLETE END (ERROR) ===\n');
      
      res.status(500).json({
        success: false,
        error: 'Bridge completion failed'
      });
    }
  });

  // Bridge status/verification route  
  app.get('/api/bridge/status/:transactionId', async (req, res) => {
    try {
      const { transactionId } = req.params;
      
      const [bridgeData] = await db
        .select()
        .from(bridge_payloads)
        .where(eq(bridge_payloads.transaction_id, transactionId))
        .limit(1);
      
      if (bridgeData) {
        res.json({
          id: bridgeData.id,
          transactionId: bridgeData.transaction_id,
          fromToken: bridgeData.fromCurrency,
          toToken: bridgeData.toCurrency,
          amount: bridgeData.amount,
          status: bridgeData.status,
          txHash: bridgeData.txHash,
          createdAt: bridgeData.createdAt,
          platformFee: bridgeData.platform_fee
        });
      } else {
        res.status(404).json({ error: 'Transaction not found' });
      }
    } catch (error) {
      console.error('Bridge status check error:', error);
      res.status(500).json({ error: 'Failed to check transaction status' });
    }
  });

  // Get bridge transactions for authenticated user
  app.get("/api/bridge/transactions", authenticateBridge, async (req, res) => {
    console.log('\n📋 === BRIDGE TRANSACTIONS LIST START ===');
    
    try {
      const authReq = req as any;
      const userHandle = authReq.userHandle;
      
      console.log('📋 Fetching bridge transactions for user:', userHandle);
      
      // Get all bridge transactions for this user
      const transactions = await db
        .select()
        .from(bridge_payloads)
        .where(eq(bridge_payloads.riddleWalletId, userHandle))
        .orderBy(sql`${bridge_payloads.createdAt} DESC`)
        .limit(50);
      
      console.log(`📋 Found ${transactions.length} bridge transactions for user: ${userHandle}`);
      
      // Transform to frontend format with proper receive amounts
      const formattedTransactions = transactions.map(tx => {
        // Parse the JSON payload to get actual transaction details
        let parsedPayload = null;
        try {
          if (tx.payload) {
            parsedPayload = JSON.parse(tx.payload);
          }
        } catch (e) {
          console.log('Failed to parse payload for transaction:', tx.transaction_id);
        }

        // Get the actual receive amount from outputAmount or calculated amount
        const actualReceiveAmount = tx.outputAmount || parsedPayload?.outputAmount || '0';
        const actualReceiveToken = tx.toCurrency?.toUpperCase() || 'RDL';
        
        return {
          transactionId: tx.transaction_id,
          sentAmount: tx.amount || '0',
          sentChain: tx.fromCurrency?.toUpperCase() || 'UNKNOWN',
          sentToken: tx.fromCurrency?.toUpperCase() || 'UNKNOWN',
          feeAmount: tx.fee_amount || '0', // Use actual fee amount in source currency
          feeToken: tx.fromCurrency?.toUpperCase() || 'XRP', // Fee is in source currency
          receiveAmount: actualReceiveAmount,
          receiveChain: tx.toCurrency === 'RDL' ? 'XRPL' : (tx.toCurrency?.toUpperCase() || 'XRPL'),
          receiveToken: actualReceiveToken,
          status: tx.status as 'pending' | 'completed' | 'failed' | 'executing',
          timestamp: tx.createdAt?.toISOString() || new Date().toISOString(),
          txHash: tx.txHash || undefined, // Initial transaction hash
          outputTxHash: tx.step3TxHash || undefined, // Final RDL distribution hash
          errorMessage: tx.errorMessage || undefined,
          usdValue: undefined // Could calculate this if needed
        };
      });
      
      console.log('📋 Formatted transactions sample:', JSON.stringify(formattedTransactions.slice(0, 2), null, 2));
      console.log('📋 === BRIDGE TRANSACTIONS LIST END ===\n');
      
      res.json({
        success: true,
        transactions: formattedTransactions,
        count: formattedTransactions.length
      });
      
    } catch (error) {
      console.error('❌ Bridge transactions fetch error:', error);
      console.log('📋 === BRIDGE TRANSACTIONS LIST END (ERROR) ===\n');
      
      res.status(500).json({
        success: false,
        error: 'Failed to fetch bridge transactions',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Register verification routes
  console.log('🔍 Registering block verification routes...');
  const { verificationRoutes } = await import('./verification-routes');
  app.use('/api/bridge', verificationRoutes);

  console.log('✅ Wallet bridge routes registered successfully (XRPL, EVM, Solana, Bitcoin)');
  console.log('✅ Block verification routes registered successfully');
}