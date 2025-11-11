import { Router } from 'express';
import fetch from 'node-fetch';

const router = Router();

// 1inch token search endpoint - /api/1inch/tokens
router.get('/1inch/tokens', async (req, res) => {
  try {
    const { chainId, query, limit = 20 } = req.query;
    
    if (!chainId) {
      return res.status(400).json({ success: false, error: 'chainId parameter is required' });
    }

    // Fetch tokens from 1inch API
    const response = await fetch(`https://api.1inch.dev/token/v1.2/${chainId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.ONE_INCH_API_KEY || ''}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`1inch API error: ${response.status}`);
    }

    const data = await response.json();

    // Filter tokens based on query
    let tokens = Object.entries(data).map(([address, info]: [string, any]) => ({
      symbol: info.symbol,
      name: info.name,
      address: address,
      decimals: info.decimals,
      logoURI: info.logoURI
    }));

    if (query) {
      const lowerQuery = (query as string).toLowerCase();
      tokens = tokens.filter(t => 
        t.symbol.toLowerCase().includes(lowerQuery) ||
        t.name.toLowerCase().includes(lowerQuery) ||
        t.address.toLowerCase().includes(lowerQuery)
      );
    }

    tokens = tokens.slice(0, parseInt(limit as string));

    res.json({ success: true, tokens });
  } catch (error: any) {
    console.error('1inch token search error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;