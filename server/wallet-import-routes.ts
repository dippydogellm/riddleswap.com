/**
 * Wallet Import API Routes
 * Handles secure wallet import from mnemonic phrases, private keys, and XRPL seeds
 */

import { Response, Router } from 'express';
import { requireAuthentication, AuthenticatedRequest } from './middleware/session-auth';
import { db } from './db';
import { importedWallets } from '../shared/schema';
import { 
  importEthereumWallet, 
  importSolanaWallet, 
  importBitcoinWallet, 
  importXRPLWallet 
} from './wallet-import-converter';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';

const router = Router();

// Type guard for wallet encryption functions
function encryptPrivateKey(privateKey: string, password: string): any {
  const algorithm = 'aes-256-gcm';
  const salt = crypto.randomBytes(16);
  const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
  const iv = crypto.randomBytes(12); // GCM uses 12-byte IV
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(privateKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex'); // Get authentication tag
  
  return {
    encrypted,
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    authTag // Include auth tag for authenticated encryption
  };
}

function decryptPrivateKey(encryptedData: any, password: string): string {
  // Support legacy CBC format for migration
  if (!encryptedData.authTag) {
    const algorithm = 'aes-256-cbc';
    const salt = Buffer.from(encryptedData.salt, 'hex');
    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
  
  // Use GCM with authentication
  const algorithm = 'aes-256-gcm';
  const salt = Buffer.from(encryptedData.salt, 'hex');
  const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
  const iv = Buffer.from(encryptedData.iv, 'hex');
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex')); // Verify auth tag
  let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Import a wallet from mnemonic, private key, or XRPL seed/secret
 */
router.post('/import', requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { chain, input, password, importType } = req.body;
    
    // Validation
    if (!chain || !input || !password) {
      return res.status(400).json({ error: 'Chain, input, and password are required' });
    }

    const userHandle = req.session?.handle;
    if (!userHandle) {
      return res.status(401).json({ error: 'No user handle found in session' });
    }

    // Convert input to private key based on chain
    let importResult;
    
    try {
      switch (chain.toLowerCase()) {
        case 'ethereum':
        case 'eth':
        case 'evm':
          importResult = await importEthereumWallet(input);
          break;
          
        case 'solana':
        case 'sol':
          importResult = await importSolanaWallet(input);
          break;
          
        case 'bitcoin':
        case 'btc':
          importResult = await importBitcoinWallet(input);
          break;
          
        case 'xrpl':
        case 'xrp':
          importResult = await importXRPLWallet(input);
          break;
          
        default:
          return res.status(400).json({ error: `Unsupported chain: ${chain}` });
      }
    } catch (conversionError: any) {
      console.error('Wallet conversion error:', conversionError);
      return res.status(400).json({ 
        error: `Failed to import wallet: ${conversionError.message}` 
      });
    }

    // Check if wallet already imported
    const existing = await db.select()
      .from(importedWallets)
      .where(
        and(
          eq(importedWallets.user_handle, userHandle),
          eq(importedWallets.address, importResult.address),
          eq(importedWallets.chain, chain.toLowerCase())
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return res.status(400).json({ 
        error: 'This wallet has already been imported' 
      });
    }

    // Encrypt the private key
    const encryptedPrivateKey = encryptPrivateKey(importResult.privateKey, password);

    // Save to database
    // @ts-ignore - Type inference issue with Drizzle ORM
    const [savedWallet] = await db.insert(importedWallets).values({
      user_handle: userHandle,
      chain: chain.toLowerCase(),
      address: importResult.address,
      encrypted_private_key: encryptedPrivateKey,
      import_method: importResult.importMethod,
      derivation_path: importResult.derivationPath || null,
      original_format: importResult.originalFormat || null
    }).returning();

    // Cache the decrypted key in session (like Riddle wallet)
    if (!req.session) {
      req.session = {} as any;
    }
    if (!req.session.importedWalletKeys) {
      req.session.importedWalletKeys = {};
    }
    
    req.session.importedWalletKeys[`${chain.toLowerCase()}_${importResult.address}`] = importResult.privateKey;

    res.json({
      success: true,
      wallet: {
        id: savedWallet.id,
        chain: savedWallet.chain,
        address: savedWallet.address,
        importMethod: savedWallet.import_method,
        importedAt: savedWallet.created_at
      }
    });

  } catch (error: any) {
    console.error('Wallet import error:', error);
    res.status(500).json({ error: 'Failed to import wallet' });
  }
});

/**
 * Get all imported wallets for the authenticated user
 */
router.get('/imported', requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userHandle = req.session?.handle;
    if (!userHandle) {
      return res.status(401).json({ error: 'No user handle found in session' });
    }

    const wallets = await db.select({
      id: importedWallets.id,
      chain: importedWallets.chain,
      address: importedWallets.address,
      importMethod: importedWallets.import_method,
      derivationPath: importedWallets.derivation_path,
      importedAt: importedWallets.created_at
    })
      .from(importedWallets)
      .where(eq(importedWallets.user_handle, userHandle))
      .orderBy(importedWallets.created_at);

    res.json({ wallets });

  } catch (error: any) {
    console.error('Error fetching imported wallets:', error);
    res.status(500).json({ error: 'Failed to fetch imported wallets' });
  }
});

/**
 * Decrypt and cache an imported wallet key
 */
router.post('/decrypt/:walletId', requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { walletId } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password required' });
    }

    const userHandle = req.session?.handle;
    if (!userHandle) {
      return res.status(401).json({ error: 'No user handle found in session' });
    }

    // Fetch the wallet
    const [wallet] = await db.select()
      .from(importedWallets)
      .where(
        and(
          eq(importedWallets.id, walletId),
          eq(importedWallets.user_handle, userHandle)
        )
      )
      .limit(1);

    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    // Decrypt the private key
    try {
      const privateKey = decryptPrivateKey(wallet.encrypted_private_key, password);

      // Cache in session
      if (!req.session) {
        req.session = {} as any;
      }
      if (!req.session.importedWalletKeys) {
        req.session.importedWalletKeys = {};
      }
      
      req.session.importedWalletKeys[`${wallet.chain}_${wallet.address}`] = privateKey;

      res.json({ 
        success: true,
        message: 'Wallet decrypted and cached successfully' 
      });

    } catch (decryptError) {
      return res.status(401).json({ error: 'Invalid password' });
    }

  } catch (error: any) {
    console.error('Error decrypting wallet:', error);
    res.status(500).json({ error: 'Failed to decrypt wallet' });
  }
});

/**
 * Delete an imported wallet
 */
router.delete('/:walletId', requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { walletId } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password required for deletion' });
    }

    const userHandle = req.session?.handle;
    if (!userHandle) {
      return res.status(401).json({ error: 'No user handle found in session' });
    }

    // Fetch the wallet
    const [wallet] = await db.select()
      .from(importedWallets)
      .where(
        and(
          eq(importedWallets.id, walletId),
          eq(importedWallets.user_handle, userHandle)
        )
      )
      .limit(1);

    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    // Verify password
    try {
      decryptPrivateKey(wallet.encrypted_private_key, password);
    } catch {
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Delete from database
    await db.delete(importedWallets)
      .where(eq(importedWallets.id, walletId));

    // Remove from session cache
    if (req.session?.importedWalletKeys) {
      delete req.session.importedWalletKeys[`${wallet.chain}_${wallet.address}`];
    }

    res.json({ 
      success: true,
      message: 'Wallet deleted successfully' 
    });

  } catch (error: any) {
    console.error('Error deleting wallet:', error);
    res.status(500).json({ error: 'Failed to delete wallet' });
  }
});

export default router;
