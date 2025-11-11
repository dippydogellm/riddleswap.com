import { Router } from 'express';
import { Client } from 'xrpl';

const router = Router();

// RDL Token Configuration
const RDL_CURRENCY = 'RDL';
const RDL_ISSUER = 'r9xvnzUWZJpDu3NA6MKHmKhKJQTRqCRgu9';
const XRPL_SERVER = 'wss://s1.ripple.com';

// GET /api/exchange-rate/xrp-rdl
// Get live exchange rate for 1 XRP to RDL
router.get('/exchange-rate/xrp-rdl', async (req, res) => {
  const client = new Client(XRPL_SERVER);
  
  try {
    await client.connect();
    
    // Get order book for XRP/RDL pair
    const orderBook = await client.request({
      command: 'book_offers',
      taker_pays: {
        currency: RDL_CURRENCY,
        issuer: RDL_ISSUER
      },
      taker_gets: {
        currency: 'XRP'
      },
      limit: 10
    });

    // Calculate rate from best offer
    if (orderBook.result.offers && orderBook.result.offers.length > 0) {
      const bestOffer = orderBook.result.offers[0];
      
      // Parse amounts
      const takerGets = typeof bestOffer.TakerGets === 'string' 
        ? parseFloat(bestOffer.TakerGets) / 1000000 // XRP drops to XRP
        : parseFloat(bestOffer.TakerGets.value);
        
      const takerPays = typeof bestOffer.TakerPays === 'string'
        ? parseFloat(bestOffer.TakerPays) / 1000000
        : parseFloat(bestOffer.TakerPays.value);
      
      // Rate: how much RDL for 1 XRP
      const rate = takerPays / takerGets;
      
      res.json({
        success: true,
        rate: rate,
        formatted: `1 XRP = ${rate.toFixed(6)} RDL`,
        inverse: `1 RDL = ${(1 / rate).toFixed(6)} XRP`,
        source: 'XRPL DEX Order Book',
        timestamp: Date.now(),
        orderBookDepth: orderBook.result.offers.length
      });
    } else {
      // No offers in order book, try AMM
      try {
        const ammInfo = await client.request({
          command: 'amm_info',
          asset: {
            currency: 'XRP'
          },
          asset2: {
            currency: RDL_CURRENCY,
            issuer: RDL_ISSUER
          }
        });

        if (ammInfo.result.amm) {
          const amm = ammInfo.result.amm;
          const amount = amm.amount;
          const amount2 = amm.amount2;
          
          const xrpAmount = typeof amount === 'string' 
            ? parseFloat(amount) / 1000000 
            : parseFloat(amount.value);
            
          const rdlAmount = typeof amount2 === 'string'
            ? parseFloat(amount2) / 1000000
            : parseFloat(amount2.value);
          
          const rate = rdlAmount / xrpAmount;
          
          res.json({
            success: true,
            rate: rate,
            formatted: `1 XRP = ${rate.toFixed(6)} RDL`,
            inverse: `1 RDL = ${(1 / rate).toFixed(6)} XRP`,
            source: 'XRPL AMM Pool',
            timestamp: Date.now(),
            poolLiquidity: {
              xrp: xrpAmount.toFixed(2),
              rdl: rdlAmount.toFixed(2)
            }
          });
        } else {
          res.json({
            success: false,
            error: 'No liquidity found for XRP/RDL pair',
            message: 'No active order book or AMM pool for this pair'
          });
        }
      } catch (ammError) {
        res.json({
          success: false,
          error: 'No liquidity found for XRP/RDL pair',
          message: 'No active order book or AMM pool for this pair'
        });
      }
    }
  } catch (error: any) {
    console.error('Error fetching XRP/RDL rate:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch exchange rate'
    });
  } finally {
    await client.disconnect();
  }
});

// GET /api/exchange-rate/calculate
// Calculate exchange for specific amount
router.get('/exchange-rate/calculate', async (req, res) => {
  const { amount, from, to } = req.query;
  
  if (!amount || !from || !to) {
    return res.status(400).json({
      success: false,
      error: 'Missing parameters: amount, from, to required'
    });
  }

  const client = new Client(XRPL_SERVER);
  
  try {
    await client.connect();
    
    const amountNum = parseFloat(amount as string);
    
    if (from === 'XRP' && to === 'RDL') {
      // Get XRP to RDL rate
      const orderBook = await client.request({
        command: 'book_offers',
        taker_pays: {
          currency: RDL_CURRENCY,
          issuer: RDL_ISSUER
        },
        taker_gets: {
          currency: 'XRP'
        },
        limit: 10
      });

      if (orderBook.result.offers && orderBook.result.offers.length > 0) {
        const bestOffer = orderBook.result.offers[0];
        
        const takerGets = typeof bestOffer.TakerGets === 'string' 
          ? parseFloat(bestOffer.TakerGets) / 1000000
          : parseFloat(bestOffer.TakerGets.value);
          
        const takerPays = typeof bestOffer.TakerPays === 'string'
          ? parseFloat(bestOffer.TakerPays) / 1000000
          : parseFloat(bestOffer.TakerPays.value);
        
        const rate = takerPays / takerGets;
        const result = amountNum * rate;
        
        res.json({
          success: true,
          input: `${amountNum} XRP`,
          output: `${result.toFixed(6)} RDL`,
          rate: rate,
          formatted: `${amountNum} XRP = ${result.toFixed(6)} RDL`,
          source: 'XRPL DEX Order Book'
        });
      } else {
        res.json({
          success: false,
          error: 'No liquidity available'
        });
      }
    } else if (from === 'RDL' && to === 'XRP') {
      // Get RDL to XRP rate
      const orderBook = await client.request({
        command: 'book_offers',
        taker_pays: {
          currency: 'XRP'
        },
        taker_gets: {
          currency: RDL_CURRENCY,
          issuer: RDL_ISSUER
        },
        limit: 10
      });

      if (orderBook.result.offers && orderBook.result.offers.length > 0) {
        const bestOffer = orderBook.result.offers[0];
        
        const takerGets = typeof bestOffer.TakerGets === 'string' 
          ? parseFloat(bestOffer.TakerGets) / 1000000
          : parseFloat(bestOffer.TakerGets.value);
          
        const takerPays = typeof bestOffer.TakerPays === 'string'
          ? parseFloat(bestOffer.TakerPays) / 1000000
          : parseFloat(bestOffer.TakerPays.value);
        
        const rate = takerPays / takerGets;
        const result = amountNum * rate;
        
        res.json({
          success: true,
          input: `${amountNum} RDL`,
          output: `${result.toFixed(6)} XRP`,
          rate: rate,
          formatted: `${amountNum} RDL = ${result.toFixed(6)} XRP`,
          source: 'XRPL DEX Order Book'
        });
      } else {
        res.json({
          success: false,
          error: 'No liquidity available'
        });
      }
    } else {
      res.status(400).json({
        success: false,
        error: 'Invalid currency pair. Supported: XRP/RDL, RDL/XRP'
      });
    }
  } catch (error: any) {
    console.error('Error calculating exchange:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to calculate exchange'
    });
  } finally {
    await client.disconnect();
  }
});

export default router;
