// Routes for External Wallet XRPL Swaps (Xaman/Joey)
// Handles transaction preparation, signing payloads, and submission

import { Router, Request, Response } from 'express';
import { prepareExternalWalletSwap, checkExternalWalletTrustline } from './xrpl-external-wallet-swap';
import { Client as XRPLClient } from 'xrpl';
import { randomUUID } from 'crypto';

const router = Router();

// Store pending swap transactions (in production, use Redis)
const pendingSwaps = new Map<string, {
  swapId: string;
  userAddress: string;
  transaction: any;
  estimatedOutput: string;
  minimumReceived: string;
  fromToken: string;
  toToken: string;
  amount: string;
  status: 'pending' | 'signed' | 'submitted' | 'failed';
  signedTx?: string;
  result?: any;
  createdAt: number;
  expiresAt: number;
}>();

// Cleanup expired swaps every 5 minutes
setInterval(() => {
  const now = Date.now();
  const entries = Array.from(pendingSwaps.entries());
  for (const [swapId, swap] of entries) {
    if (now > swap.expiresAt) {
      console.log('🧹 [EXTERNAL SWAP] Cleaning expired swap:', swapId);
      pendingSwaps.delete(swapId);
    }
  }
}, 5 * 60 * 1000);

// Step 1: Prepare swap transaction - PUBLIC (no auth required)
router.post('/external/prepare', async (req: Request, res: Response) => {
  try {
    const { userAddress, fromToken, toToken, amount, fromIssuer, toIssuer, slippage = 5 } = req.body;
    
    console.log('🔄 [EXTERNAL SWAP] Preparing swap for external wallet:', userAddress);
    
    if (!userAddress || !fromToken || !toToken || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: userAddress, fromToken, toToken, amount'
      });
    }

    // Prepare the swap transaction
    const result = await prepareExternalWalletSwap(
      userAddress,
      fromToken,
      toToken,
      amount,
      fromIssuer,
      toIssuer,
      slippage
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Generate unique swap ID
    const swapId = randomUUID();

    // Store pending swap (expires in 10 minutes)
    pendingSwaps.set(swapId, {
      swapId,
      userAddress,
      transaction: result.transaction,
      estimatedOutput: result.estimatedOutput,
      minimumReceived: result.minimumReceived,
      fromToken,
      toToken,
      amount,
      status: 'pending',
      createdAt: Date.now(),
      expiresAt: Date.now() + (10 * 60 * 1000) // 10 minutes
    });

    console.log('✅ [EXTERNAL SWAP] Swap prepared with ID:', swapId);

    res.json({
      success: true,
      swapId,
      transaction: result.transaction,
      estimatedOutput: result.estimatedOutput,
      minimumReceived: result.minimumReceived,
      exchangeRate: result.exchangeRate,
      slippage: result.slippage
    });

  } catch (error) {
    console.error('❌ [EXTERNAL SWAP] Prepare error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to prepare swap'
    });
  }
});

// Step 2: Create Xumm signing payload for prepared swap - PUBLIC
router.post('/external/create-payload', async (req: Request, res: Response) => {
  try {
    const { swapId, walletType = 'xaman' } = req.body;
    
    console.log('📱 [EXTERNAL SWAP] Creating signing payload for swap:', swapId);
    
    if (!swapId) {
      return res.status(400).json({
        success: false,
        error: 'Missing swapId parameter'
      });
    }

    const swap = pendingSwaps.get(swapId);
    if (!swap) {
      return res.status(404).json({
        success: false,
        error: 'Swap not found or expired'
      });
    }

    // Import Xumm payload creation
    const { createXummPayload } = await import('../external-wallet-routes');
    
    // Build Xumm payload
    const xummPayload = {
      txjson: swap.transaction,
      options: {
        submit: true, // Auto-submit after signing
        multisign: false,
        expire: 10, // 10 minutes
        return_url: {
          web: `https://riddleswap.com/swap?swapId=${swapId}`,
          app: `https://riddleswap.com`
        }
      },
      custom_meta: {
        identifier: `riddle-swap-${swapId}`,
        blob: {
          purpose: 'swap',
          swap_id: swapId,
          from_token: swap.fromToken,
          to_token: swap.toToken,
          amount: swap.amount,
          created_at: new Date().toISOString()
        },
        instruction: `Swap ${swap.amount} ${swap.fromToken} to ${swap.toToken}`
      }
    };

    console.log('🌐 [EXTERNAL SWAP] Calling Xumm API...');
    const xummResponse = await createXummPayload(xummPayload);

    if (!xummResponse || !xummResponse.uuid) {
      throw new Error('Invalid response from Xumm API');
    }

    const { uuid, next, refs } = xummResponse;
    
    console.log('✅ [EXTERNAL SWAP] Xumm payload created:', uuid);

    res.json({
      success: true,
      payloadId: uuid,
      deepLink: next.always || `xumm://payload/${uuid}`,
      webLink: refs.qr_web || `https://xumm.app/sign/${uuid}`,
      qrUri: refs.qr_uri_quality_opts || refs.qr_uri,
      swapId
    });

  } catch (error) {
    console.error('❌ [EXTERNAL SWAP] Payload creation error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create signing payload'
    });
  }
});

// Step 3: Check swap status - PUBLIC (polling endpoint)
router.get('/external/status/:swapId', async (req: Request, res: Response) => {
  try {
    const { swapId } = req.params;
    
    const swap = pendingSwaps.get(swapId);
    if (!swap) {
      return res.status(404).json({
        success: false,
        error: 'Swap not found or expired'
      });
    }

    res.json({
      success: true,
      status: swap.status,
      result: swap.result,
      estimatedOutput: swap.estimatedOutput,
      minimumReceived: swap.minimumReceived
    });

  } catch (error) {
    console.error('❌ [EXTERNAL SWAP] Status check error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check status'
    });
  }
});

// Step 4: Verify and finalize signed transaction from Xumm - PUBLIC
router.post('/external/verify-signature', async (req: Request, res: Response) => {
  try {
    const { swapId, payloadId } = req.body;
    
    console.log('✍️ [EXTERNAL SWAP] Verifying signature for swap:', swapId);
    
    if (!swapId || !payloadId) {
      return res.status(400).json({
        success: false,
        error: 'Missing swapId or payloadId'
      });
    }

    const swap = pendingSwaps.get(swapId);
    if (!swap) {
      return res.status(404).json({
        success: false,
        error: 'Swap not found or expired'
      });
    }

    // Import Xumm status checker
    const { getXummPayloadStatus } = await import('../external-wallet-routes');
    
    // Check if payload was signed
    const statusResponse = await getXummPayloadStatus(payloadId);
    
    if (!statusResponse?.meta?.signed) {
      return res.json({
        success: false,
        status: 'not_signed',
        message: 'Transaction not signed yet'
      });
    }

    // Transaction was signed and submitted by Xumm
    const txHash = statusResponse.response?.txid;
    
    if (!txHash) {
      throw new Error('Transaction hash not found in response');
    }

    console.log('✅ [EXTERNAL SWAP] Transaction signed and submitted:', txHash);

    // Update swap status
    swap.status = 'submitted';
    swap.result = {
      hash: txHash,
      signedAt: new Date().toISOString()
    };

    // Wait a moment for transaction to be validated
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify transaction on XRPL
    const client = new XRPLClient('wss://s1.ripple.com');
    await client.connect();

    try {
      const txResponse = await client.request({
        command: 'tx',
        transaction: txHash
      });

      const validated = txResponse.result.validated;
      const meta = txResponse.result.meta;

      if (validated && typeof meta === 'object' && 'TransactionResult' in meta) {
        const success = meta.TransactionResult === 'tesSUCCESS';
        
        swap.status = success ? 'signed' : 'failed';
        swap.result = {
          hash: txHash,
          validated: true,
          success,
          result: meta.TransactionResult
        };

        console.log(`✅ [EXTERNAL SWAP] Transaction validated: ${success ? 'SUCCESS' : 'FAILED'}`);
      }

    } catch (txError) {
      console.log('⏳ [EXTERNAL SWAP] Transaction not yet validated, still pending...');
    } finally {
      await client.disconnect();
    }

    res.json({
      success: true,
      status: swap.status,
      txHash,
      result: swap.result
    });

  } catch (error) {
    console.error('❌ [EXTERNAL SWAP] Verification error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to verify signature'
    });
  }
});

// Check trustline for external wallet - PUBLIC
router.post('/external/check-trustline', async (req: Request, res: Response) => {
  try {
    const { userAddress, token, issuer } = req.body;
    
    console.log('🔗 [EXTERNAL SWAP] Checking trustline:', { userAddress, token, issuer });
    
    if (!userAddress || !token || !issuer) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: userAddress, token, issuer'
      });
    }

    const result = await checkExternalWalletTrustline(userAddress, token, issuer);

    res.json({
      success: true,
      hasTrustline: result.hasTrustline,
      trustlineTransaction: result.transaction
    });

  } catch (error) {
    console.error('❌ [EXTERNAL SWAP] Trustline check error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check trustline'
    });
  }
});

export default router;
