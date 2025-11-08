import { Router, Request, Response } from 'express';
import { executeSolanaSwap } from './sol-swap';
import { sendSolanaPayment } from './sol-payment';
import { createSolanaBuyOffer, createSolanaSellOffer, acceptSolanaOffer, cancelSolanaOffer } from './sol-offers';
import { decryptSolanaWallet } from './sol-wallet';
import { dualWalletAuth } from '../middleware/dual-wallet-auth';

const router = Router();

// Test wallet decryption endpoint
router.post('/decrypt-wallet', dualWalletAuth, async (req: Request, res: Response) => {
  try {
    const { handle, password } = req.body;
    
    if (!handle || !password) {
      return res.status(400).json({
        success: false,
        error: 'Handle and password required'
      });
    }
    
    const wallet = await decryptSolanaWallet(handle, password);
    
    res.json({
      success: true,
      address: wallet.address
    });
    
  } catch (error) {
    console.error('Wallet decryption error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to decrypt wallet'
    });
  }
});

// Swap endpoint - uses cached keys (Riddle wallet) or external wallet
router.post('/swap', dualWalletAuth, async (req: Request, res: Response) => {
  try {
    // Check if using Riddle wallet with cached keys
    if ((req as any).walletMode === 'riddle' && (req as any).user?.cachedKeys?.solPrivateKey) {
      return res.status(501).json({
        success: false,
        error: 'SOL swap with cached keys not yet implemented. Use multi-chain swap endpoints.'
      });
    }
    
    // For external wallets, use multi-chain endpoints
    if ((req as any).walletMode === 'external') {
      return res.status(400).json({
        success: false,
        error: 'External wallets should use /api/solana/swap endpoint'
      });
    }
    
    // Legacy password-based (fallback)
    const { handle, password, fromToken, toToken, amount } = req.body;
    
    if (!handle || !password || !fromToken || !toToken || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }
    
    const result = await executeSolanaSwap(handle, password, fromToken, toToken, amount);
    res.json(result);
    
  } catch (error) {
    console.error('Swap error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Swap failed'
    });
  }
});

// Payment endpoint - uses cached keys (Riddle wallet) or external wallet
router.post('/payment', dualWalletAuth, async (req: Request, res: Response) => {
  try {
    // Check if using Riddle wallet with cached keys
    if ((req as any).walletMode === 'riddle' && (req as any).user?.cachedKeys?.solPrivateKey) {
      return res.status(501).json({
        success: false,
        error: 'SOL payment with cached keys not yet implemented. Use multi-chain payment endpoints.'
      });
    }
    
    // For external wallets, use multi-chain endpoints
    if ((req as any).walletMode === 'external') {
      return res.status(400).json({
        success: false,
        error: 'External wallets should use /api/payments/solana endpoint'
      });
    }
    
    // Legacy password-based (fallback)
    const { handle, password, destination, amount, tokenMint } = req.body;
    
    if (!handle || !password || !destination || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }
    
    const result = await sendSolanaPayment(handle, password, destination, amount, tokenMint);
    res.json(result);
    
  } catch (error) {
    console.error('Payment error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Payment failed'
    });
  }
});

// Buy offer endpoint - uses cached keys (Riddle wallet) or external wallet
router.post('/offer/buy', dualWalletAuth, async (req: Request, res: Response) => {
  try {
    // Check if using Riddle wallet with cached keys
    if ((req as any).walletMode === 'riddle' && (req as any).user?.cachedKeys?.solPrivateKey) {
      return res.status(501).json({
        success: false,
        error: 'SOL offer with cached keys not yet implemented. Use multi-chain endpoints.'
      });
    }
    
    // For external wallets, use multi-chain endpoints
    if ((req as any).walletMode === 'external') {
      return res.status(400).json({
        success: false,
        error: 'External wallets should use multi-chain offer endpoints'
      });
    }
    
    // Legacy password-based (fallback)
    const { handle, password, payAmount, payToken, getAmount, getToken } = req.body;
    
    if (!handle || !password || !payAmount || !payToken || !getAmount || !getToken) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }
    
    const result = await createSolanaBuyOffer(handle, password, payAmount, payToken, getAmount, getToken);
    res.json(result);
    
  } catch (error) {
    console.error('Buy offer error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Buy offer failed'
    });
  }
});

// Sell offer endpoint - uses cached keys (Riddle wallet) or external wallet
router.post('/offer/sell', dualWalletAuth, async (req: Request, res: Response) => {
  try {
    // Check if using Riddle wallet with cached keys
    if ((req as any).walletMode === 'riddle' && (req as any).user?.cachedKeys?.solPrivateKey) {
      return res.status(501).json({
        success: false,
        error: 'SOL offer with cached keys not yet implemented. Use multi-chain endpoints.'
      });
    }
    
    // For external wallets, use multi-chain endpoints
    if ((req as any).walletMode === 'external') {
      return res.status(400).json({
        success: false,
        error: 'External wallets should use multi-chain offer endpoints'
      });
    }
    
    // Legacy password-based (fallback)
    const { handle, password, sellAmount, sellToken, forAmount, forToken } = req.body;
    
    if (!handle || !password || !sellAmount || !sellToken || !forAmount || !forToken) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }
    
    const result = await createSolanaSellOffer(handle, password, sellAmount, sellToken, forAmount, forToken);
    res.json(result);
    
  } catch (error) {
    console.error('Sell offer error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Sell offer failed'
    });
  }
});

// Accept offer endpoint - uses cached keys (Riddle wallet) or external wallet
router.post('/offer/accept', dualWalletAuth, async (req: Request, res: Response) => {
  try {
    // Check if using Riddle wallet with cached keys
    if ((req as any).walletMode === 'riddle' && (req as any).user?.cachedKeys?.solPrivateKey) {
      return res.status(501).json({
        success: false,
        error: 'SOL offer with cached keys not yet implemented. Use multi-chain endpoints.'
      });
    }
    
    // For external wallets, use multi-chain endpoints
    if ((req as any).walletMode === 'external') {
      return res.status(400).json({
        success: false,
        error: 'External wallets should use multi-chain offer endpoints'
      });
    }
    
    // Legacy password-based (fallback)
    const { handle, password, offerId } = req.body;
    
    if (!handle || !password || !offerId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }
    
    const result = await acceptSolanaOffer(handle, password, offerId);
    res.json(result);
    
  } catch (error) {
    console.error('Accept offer error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Accept offer failed'
    });
  }
});

// Cancel offer endpoint - uses cached keys (Riddle wallet) or external wallet
router.post('/offer/cancel', dualWalletAuth, async (req: Request, res: Response) => {
  try {
    // Check if using Riddle wallet with cached keys
    if ((req as any).walletMode === 'riddle' && (req as any).user?.cachedKeys?.solPrivateKey) {
      return res.status(501).json({
        success: false,
        error: 'SOL offer with cached keys not yet implemented. Use multi-chain endpoints.'
      });
    }
    
    // For external wallets, use multi-chain endpoints
    if ((req as any).walletMode === 'external') {
      return res.status(400).json({
        success: false,
        error: 'External wallets should use multi-chain offer endpoints'
      });
    }
    
    // Legacy password-based (fallback)
    const { handle, password, offerId } = req.body;
    
    if (!handle || !password || !offerId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }
    
    const result = await cancelSolanaOffer(handle, password, offerId);
    res.json(result);
    
  } catch (error) {
    console.error('Cancel offer error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Cancel offer failed'
    });
  }
});

export default router;