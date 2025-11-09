import express from 'express';
import swapRouter from './swap';
import liquidityRouter from './liquidity';
import limitRouter from './limit';
import bridgeRouter from './bridge';

const router = express.Router();

// Mount all tradecenter subroutes
router.use('/swap', swapRouter);
router.use('/liquidity', liquidityRouter);
router.use('/limit', limitRouter);
router.use('/bridge', bridgeRouter);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'tradecenter',
    routes: ['swap', 'liquidity', 'limit', 'bridge'],
    timestamp: Date.now()
  });
});

export default router;
