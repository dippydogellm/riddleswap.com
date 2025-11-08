// Bridge exchange rate API routes
import { Express } from 'express';
import { ExchangeRateService } from './exchange-rates';
import { BANK_WALLETS, TOKEN_CHAIN_MAP } from '../bridge-handlers/types';

export function registerBridgeExchangeRoutes(app: Express) {
  console.log('💱 Registering bridge exchange rate routes...');

  // Remove individual CORS middleware - rely on global configuration

  // Get live token prices (PUBLIC ENDPOINT)
  app.get('/api/bridge/prices', async (req, res) => {
    try {
      const { token } = req.query;
      
      if (token) {
        // Get specific token price
        const price = await ExchangeRateService.getBridgeTokenPrice(token as string);
        res.json({
          success: true,
          token: token,
          price: price.usd,
          source: price.source,
          confidence: price.confidence,
          timestamp: Date.now()
        });
      } else {
        // Get all supported token prices
        const tokens = ['XRP', 'RDL', 'ETH', 'SOL', 'BTC', 'SRDL'];
        const prices: any = {};
        
        await Promise.all(tokens.map(async (t) => {
          try {
            const price = await ExchangeRateService.getBridgeTokenPrice(t);
            prices[t] = {
              usd: price.usd,
              source: price.source,
              confidence: price.confidence
            };
          } catch (error) {
            console.log(`Price unavailable for ${t}:`, error);
          }
        }));
        
        res.json({
          success: true,
          prices,
          timestamp: Date.now(),
          note: 'Live prices from DexScreener and CoinGecko APIs'
        });
      }
    } catch (error) {
      console.error('Price fetch error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch live prices'
      });
    }
  });

  // Get exchange rate for a specific pair
  app.get('/api/bridge/exchange-rate', async (req, res) => {
    try {
      const { from, to, amount = '1' } = req.query;
      
      if (!from || !to) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters: from and to tokens'
        });
      }

      const numAmount = parseFloat(amount as string);
      const exchangeRate = await ExchangeRateService.getExchangeRate(
        from as string,
        to as string,
        numAmount
      );

      // Get bank wallet for the source token
      const fromChain = TOKEN_CHAIN_MAP[from as string] || 'ETH';
      const bankWallet = BANK_WALLETS[fromChain];

      res.json({
        success: true,
        ...exchangeRate,
        outputAmount: exchangeRate.rate * numAmount,
        feeAmount: exchangeRate.totalFee,
        bankWallet: bankWallet,
        bankAddress: bankWallet,
        fromChain: fromChain,
        message: `1% platform fee included (${exchangeRate.totalFee} ${to}) - Send to ${bankWallet}`
      });
    } catch (error) {
      console.error('Exchange rate error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get exchange rate'
      });
    }
  });

  // Get all supported exchange rates
  app.get('/api/bridge/exchange-rates/all', async (req, res) => {
    try {
      const rates = await ExchangeRateService.getAllExchangeRates();
      
      res.json({
        success: true,
        rates,
        platformFee: '1%',
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Exchange rates error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get exchange rates'
      });
    }
  });

  // Token price endpoint removed - using exchange rates only

  // Get comprehensive bridge quote (frontend-friendly format)
  app.get('/api/bridge/quote', async (req, res) => {
    try {
      const { fromToken, toToken, amount = '1' } = req.query;
      
      if (!fromToken || !toToken || !amount) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters: fromToken, toToken, amount'
        });
      }

      const numAmount = parseFloat(amount as string);
      if (numAmount <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Amount must be greater than 0'
        });
      }

      // Get exchange rate data
      const exchangeRate = await ExchangeRateService.getExchangeRate(
        fromToken as string,
        toToken as string,
        numAmount
      );

      // Get individual token prices
      const fromPrice = await ExchangeRateService.getBridgeTokenPrice(fromToken as string);
      const toPrice = await ExchangeRateService.getBridgeTokenPrice(toToken as string);
      
      // Get bank wallet for the source token
      const fromChain = TOKEN_CHAIN_MAP[fromToken as string] || 'ETH';
      const bankWallet = BANK_WALLETS[fromChain];

      // Calculate platform fee (1% of amount)
      const platformFeeAmount = numAmount * 0.01;
      const totalCost = numAmount + platformFeeAmount;

      // Calculate the output amount (rate * amount - fee)
      const outputAmount = (exchangeRate.rate * numAmount) - exchangeRate.totalFee;

      res.json({
        success: true,
        exchangeRate: `1 ${fromToken} = ${exchangeRate.rate.toFixed(8)} ${toToken}`,
        platformFee: `${platformFeeAmount.toFixed(8)} ${fromToken}`,
        estimatedOutput: outputAmount.toFixed(8),
        totalCost: totalCost.toFixed(8),
        fromTokenPrice: fromPrice.usd.toFixed(4),
        toTokenPrice: toPrice.usd.toFixed(6),
        rawData: {
          rate: exchangeRate.rate,
          outputAmount: outputAmount,
          feeAmount: exchangeRate.totalFee,
          fromPrice: fromPrice.usd,
          toPrice: toPrice.usd
        }
      });
    } catch (error) {
      console.error('Bridge quote error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get bridge quote'
      });
    }
  });

  // Cache monitoring endpoint (for debugging and monitoring)
  app.get('/api/bridge/cache-status', async (req, res) => {
    try {
      const cacheStatus = ExchangeRateService.getCacheStatus();
      res.json({
        success: true,
        ...cacheStatus,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Cache status error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get cache status'
      });
    }
  });

  console.log('✅ Bridge exchange rate routes registered');
}