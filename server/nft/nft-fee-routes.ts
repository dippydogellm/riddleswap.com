import { Router, Request, Response } from 'express';
import { sessionAuth } from '../middleware/session-auth';
import NFTFeeCalculator from './nft-fee-calculator';

const router = Router();

// Get comprehensive fee breakdown for buy offers
router.post('/fees/buy-offer', sessionAuth, async (req: Request, res: Response) => {
  try {
    const { nftokenID, amount, isBrokered = true } = req.body;

    if (!nftokenID || !amount) {
      return res.status(400).json({
        success: false,
        error: 'NFT ID and amount are required'
      });
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be a valid positive number'
      });
    }

    // Convert XRP to drops (ensure integer precision)
    const amountInDrops = Math.round(numericAmount * 1000000).toString();

    const calculator = new NFTFeeCalculator();
    const feeBreakdown = await calculator.calculateBuyOfferFees(
      nftokenID,
      amountInDrops,
      isBrokered
    );
    await calculator.disconnect();

    res.json({
      success: true,
      feeBreakdown
    });

  } catch (error) {
    console.error('❌ [FEE CALC] Buy offer fee calculation failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to calculate fees'
    });
  }
});

// Get comprehensive fee breakdown for accepting offers
router.post('/fees/accept-offer', sessionAuth, async (req: Request, res: Response) => {
  try {
    const { nftokenID, amount, isBrokered = false, isSellerAccepting = true } = req.body;

    if (!nftokenID || !amount) {
      return res.status(400).json({
        success: false,
        error: 'NFT ID and amount are required'
      });
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be a valid positive number'
      });
    }

    // Convert XRP to drops (ensure integer precision)
    const amountInDrops = Math.round(numericAmount * 1000000).toString();

    const calculator = new NFTFeeCalculator();
    const feeBreakdown = await calculator.calculateAcceptOfferFees(
      nftokenID,
      amountInDrops,
      isBrokered,
      isSellerAccepting
    );
    await calculator.disconnect();

    res.json({
      success: true,
      feeBreakdown
    });

  } catch (error) {
    console.error('❌ [FEE CALC] Accept offer fee calculation failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to calculate fees'
    });
  }
});

// Get fee breakdown for NFT transfers
router.post('/fees/transfer', sessionAuth, async (req: Request, res: Response) => {
  try {
    const { nftokenID } = req.body;

    if (!nftokenID) {
      return res.status(400).json({
        success: false,
        error: 'NFT ID is required'
      });
    }

    const calculator = new NFTFeeCalculator();
    const feeBreakdown = await calculator.calculateTransferFees(nftokenID);
    await calculator.disconnect();

    res.json({
      success: true,
      feeBreakdown
    });

  } catch (error) {
    console.error('❌ [FEE CALC] Transfer fee calculation failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to calculate fees'
    });
  }
});

// Get current network reserves
router.get('/fees/network-info', async (req: Request, res: Response) => {
  try {
    const calculator = new NFTFeeCalculator();
    const reserves = await calculator.getNetworkReserves();
    await calculator.disconnect();

    res.json({
      success: true,
      reserves,
      networkFee: '12', // Standard XRPL network fee in drops
      brokerFeePercentage: 1 // 1%
    });

  } catch (error) {
    console.error('❌ [FEE CALC] Network info fetch failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch network info'
    });
  }
});

export default router;