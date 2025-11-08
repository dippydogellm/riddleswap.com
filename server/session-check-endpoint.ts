// Session Check Endpoint
import { Router } from 'express';
import { getActiveSession } from './riddle-wallet-auth';

const router = Router();

// Session check endpoint
router.get('/session-check', (req: any, res) => {
  try {
    const authHeader = req.headers.authorization;
    const sessionToken = authHeader?.replace('Bearer ', '');
    
    if (!sessionToken) {
      return res.status(401).json({ 
        success: false, 
        error: 'No session token provided' 
      });
    }
    
    const session = getActiveSession(sessionToken);
    
    if (!session || session.expiresAt < Date.now()) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid or expired session' 
      });
    }
    
    res.json({
      success: true,
      handle: session.handle,
      expiresAt: session.expiresAt,
      walletType: 'Multi-chain',
      ipAddress: session.ipAddress,
      isValid: true
    });
    
  } catch (error) {
    console.error('Session check error:', error);
    res.status(500).json({
      success: false,
      error: 'Session check failed'
    });
  }
});

export default router;