// XRPL Swap V2 Routes - Production-ready swap system
import { Router, Request, Response } from 'express';
import { prepareSwapTxV2, executeSwapV2, SwapInputSchema } from './xrpl-swap-v2.js';
import { sessionAuth } from '../middleware/session-auth.js';

const router = Router();

// POST /api/xrpl/swap/v2/quote - Get swap quote
router.post('/quote', async (req: Request, res: Response) => {
  try {
    const input = SwapInputSchema.parse(req.body);
    
    console.log('📊 [XRPL SWAP V2] Quote request:', input);

    // Prepare the swap transaction to get quote details
    const account = 'rDummyAddressForQuote1234567890'; // Dummy address for quote
    const quoteData = await prepareSwapTxV2(account, input);

    res.json({
      success: true,
      estimatedOutput: quoteData.expectedOutput,
      minimumOutput: quoteData.minOutput,
      rate: quoteData.rate,
      slippage: input.slippagePercent,
      platformFee: quoteData.feeXrp,
      fromToken: input.fromToken,
      toToken: input.toToken,
      fromAmount: input.amount
    });

  } catch (error: any) {
    console.error('❌ [XRPL SWAP V2] Quote error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to get swap quote'
    });
  }
});

// POST /api/xrpl/swap/v2/execute - Execute swap with authentication
router.post('/execute', sessionAuth, async (req: any, res: Response) => {
  try {
    const input = SwapInputSchema.parse(req.body);
    
    console.log('⚡ [XRPL SWAP V2] Execute request:', {
      handle: req.session?.handle,
      ...input
    });

    // Get cached private keys from session
    const authHeader = req.headers.authorization;
    const sessionToken = authHeader?.replace('Bearer ', '');
    
    if (!sessionToken) {
      return res.status(401).json({
        success: false,
        error: 'No session token provided'
      });
    }

    // Get session with cached private keys
    const authModule = await import('../riddle-wallet-auth.js');
    const session = authModule.getActiveSession(sessionToken);
    
    if (!session || !session.cachedKeys) {
      return res.status(401).json({
        success: false,
        error: 'Invalid session or no cached keys available'
      });
    }

    if (Date.now() > session.expiresAt) {
      return res.status(401).json({
        success: false,
        error: 'Session expired'
      });
    }

    const { cachedKeys } = session;
    
    if (!cachedKeys.xrpl?.privateKey) {
      return res.status(400).json({
        success: false,
        error: 'XRPL private key not available in session'
      });
    }

    console.log('🔐 [XRPL SWAP V2] Using cached XRPL private key');

    // Execute the swap
    const result = await executeSwapV2(cachedKeys.xrpl.privateKey, input);

    console.log('✅ [XRPL SWAP V2] Swap executed successfully:', {
      txHash: result.txHash,
      delivered: result.deliveredAmount,
      fee: result.feeTxHash
    });

    res.json({
      success: true,
      swapTxHash: result.txHash,
      feeTxHash: result.feeTxHash,
      delivered: result.deliveredAmount,
      minimumOutput: result.minOutput,
      expectedOutput: result.expectedOutput,
      platformFee: result.platformFeeXrp,
      fromToken: input.fromToken,
      toToken: input.toToken,
      fromAmount: input.amount
    });

  } catch (error: any) {
    console.error('❌ [XRPL SWAP V2] Execute error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Swap execution failed'
    });
  }
});

// POST /api/xrpl/swap/v2/prepare - Prepare unsigned transaction for external wallets
router.post('/prepare', async (req: Request, res: Response) => {
  try {
    const { account, ...input } = req.body;
    
    if (!account) {
      return res.status(400).json({
        success: false,
        error: 'Account address required'
      });
    }

    const swapInput = SwapInputSchema.parse(input);
    
    console.log('📝 [XRPL SWAP V2] Prepare transaction:', { account, ...swapInput });

    const preparedTx = await prepareSwapTxV2(account, swapInput);

    res.json({
      success: true,
      transaction: preparedTx.payment,
      estimatedOutput: preparedTx.expectedOutput,
      minimumOutput: preparedTx.minOutput,
      rate: preparedTx.rate,
      platformFee: preparedTx.feeXrp
    });

  } catch (error: any) {
    console.error('❌ [XRPL SWAP V2] Prepare error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to prepare swap transaction'
    });
  }
});

export default router;
