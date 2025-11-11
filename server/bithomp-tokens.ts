import { Router } from 'express';
import fetch from 'node-fetch';

const router = Router();

// Token search endpoint - /api/bithomp/tokens/search
router.get('/bithomp/tokens/search', async (req, res) => {
  try {
    const { query, limit = 20 } = req.query;
    
    if (!query) {
      return res.status(400).json({ success: false, error: 'Query parameter is required' });
    }

    // Fetch from Bithomp API - assuming Bithomp has a token search endpoint
    // Adjust URL based on actual Bithomp API
    const response = await fetch(`https://bithomp.com/api/v2/tokens/search?q=${encodeURIComponent(query as string)}&limit=${limit}`, {
      headers: {
        'x-bithomp-token': process.env.BITHOMP_API_KEY || '',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Bithomp API error: ${response.status}`);
    }

    const data = await response.json() as any;

    // Format response to match expected Token type
    const tokens = (data.tokens || []).map((t: any) => ({
      symbol: t.currency,
      name: t.name || t.currency,
      address: t.currency,
      issuer: t.issuer,
      decimals: 6, // XRPL default
      logoURI: t.icon || t.logo || `https://cdn.bithomp.com/token/${t.currency}.${t.issuer}.png`
    }));

    res.json({ success: true, tokens });
  } catch (error: any) {
    console.error('Bithomp token search error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;