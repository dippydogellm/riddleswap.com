// Token price API endpoint for authentic live prices
import { Router } from "express";
import { getAuthenticTokenPrice } from "../price-service";
// Token price router (server-side). Removed extraneous default export placeholder.

const router = Router();

// Get live price for any XRPL token
router.get('/token-price', async (req, res) => {
  try {
    const { symbol, issuer } = req.query;
    
    if (!symbol || typeof symbol !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Symbol parameter is required'
      });
    }

    console.log(`💰 Fetching live price for ${symbol}${issuer ? ` (${issuer})` : ''}`);

    const priceData = await getAuthenticTokenPrice(symbol, issuer as string);

    if (!priceData || !priceData.price_usd || priceData.price_usd <= 0) {
      return res.status(404).json({
        success: false,
        error: `Live price data unavailable for ${symbol}`,
        price_usd: 0
      });
    }

    console.log(`✅ Live price found: ${symbol} = $${priceData.price_usd}`);

    res.json({
      success: true,
      symbol: priceData.symbol,
      issuer: priceData.issuer,
      price_usd: priceData.price_usd,
      volume_24h: priceData.volume_24h,
      change_24h: priceData.change_24h,
      source: 'live_api'
    });

  } catch (error) {
    console.error('Token price API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch token price',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;