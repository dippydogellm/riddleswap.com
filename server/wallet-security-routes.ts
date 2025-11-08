import { Router } from 'express';
import { storage } from './storage';
import { requireAuthentication } from './middleware/session-auth';
import { decryptWalletData } from './wallet-encryption';

const router = Router();

/**
 * Get private keys for all chains in the user's wallet
 * Requires session authentication and password verification
 */
router.post('/private-keys', async (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Password is required to access private keys' 
      });
    }

    const handle = (req as any).user?.userHandle;
    if (!handle) {
      return res.status(401).json({ 
        success: false, 
        error: 'User not authenticated' 
      });
    }

    console.log(`🔐 [SECURITY] Private key access requested for handle: ${handle}`);

    // Get the encrypted wallet data from storage
    const walletData = await storage.getRiddleWalletByHandle(handle);
    if (!walletData) {
      return res.status(404).json({ 
        success: false, 
        error: 'Wallet not found' 
      });
    }

    // Decrypt the wallet data using the provided password
    try {
      // The encryptedPrivateKeys field contains the entire encrypted wallet data
      const encryptedData = walletData.encryptedPrivateKeys;
      
      // SECURITY: NEVER LOG PRIVATE KEY DATA
      console.log(`🔍 [SECURITY] Encrypted data structure found`);
      
      // Decrypt the entire wallet data - cast as EncryptedData since it has the blob structure
      const decryptedWalletJson = decryptWalletData(encryptedData as any, password);
      const walletInfo = JSON.parse(decryptedWalletJson);
      
      console.log(`🔍 [SECURITY] Decrypted wallet contains chains:`, Object.keys(walletInfo));
      // CRITICAL SECURITY: NEVER LOG DECRYPTED WALLET DATA - REMOVED

      // Extract private keys for each chain from the decrypted data
      // The keys are stored directly as string values in the root level
      const privateKeys = {
        xrp: {
          seed: walletInfo.xrp || null, // XRP uses seed phrase
          address: walletData.xrpAddress || null,
        },
        eth: {
          privateKey: walletInfo.eth || null, // ETH uses private key
          address: walletData.ethAddress || null,
        },
        sol: {
          privateKey: walletInfo.sol || null, // SOL uses private key  
          address: walletData.solAddress || null,
        },
        btc: {
          privateKey: walletInfo.btc || null, // BTC uses private key (may be comma-separated array format)
          address: walletData.btcAddress || null,
        }
      };
      
      // SECURITY: Log only non-sensitive info
      console.log(`🔍 [SECURITY] Private key extraction status:`, {
        xrp: { hasKey: !!privateKeys.xrp.seed, hasAddress: !!privateKeys.xrp.address },
        eth: { hasKey: !!privateKeys.eth.privateKey, hasAddress: !!privateKeys.eth.address },
        sol: { hasKey: !!privateKeys.sol.privateKey, hasAddress: !!privateKeys.sol.address },
        btc: { hasKey: !!privateKeys.btc.privateKey, hasAddress: !!privateKeys.btc.address }
      });

      console.log(`✅ [SECURITY] Private keys successfully extracted (NOT LOGGED)`);
      
      // SECURITY AUDIT: Log access without exposing data
      console.log(`🔍 [AUDIT] User ${handle} accessed private keys at ${new Date().toISOString()}`);

      return res.json({
        success: true,
        privateKeys
      });

    } catch (decryptError) {
      console.error(`❌ [SECURITY] Failed to decrypt wallet for handle: ${handle}`, decryptError);
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid password' 
      });
    }

  } catch (error) {
    console.error('❌ [SECURITY] Error retrieving private keys:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

export default router;