import { Router, Request, Response } from 'express';
import { sendBitcoinPayment } from './btc-payment';
import { decryptBitcoinWallet } from './btc-wallet';
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
    
    const wallet = await decryptBitcoinWallet(handle, password);
    
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

// Payment endpoint - uses cached keys (Riddle wallet) or external wallet
router.post('/payment', dualWalletAuth, async (req: Request, res: Response) => {
  try {
    // Check if using Riddle wallet with cached keys
    if ((req as any).walletMode === 'riddle' && (req as any).user?.cachedKeys?.btcPrivateKey) {
      return res.status(501).json({
        success: false,
        error: 'BTC payment with cached keys not yet implemented. Use multi-chain payment endpoints.'
      });
    }
    
    // For external wallets, use multi-chain endpoints
    if ((req as any).walletMode === 'external') {
      return res.status(400).json({
        success: false,
        error: 'External wallets should use /api/payments/bitcoin endpoint'
      });
    }
    
    // Legacy password-based (fallback)
    const { handle, password, destination, amount, feeRate } = req.body;
    
    if (!handle || !password || !destination || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }
    
    const result = await sendBitcoinPayment(handle, password, destination, amount, feeRate);
    res.json(result);
    
  } catch (error) {
    console.error('Payment error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Payment failed'
    });
  }
});

export default router;