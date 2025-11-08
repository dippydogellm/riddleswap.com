// Universal Wallet Import API Routes
// Supports all chains with secure encryption

import { Router } from 'express';
import { db } from './db';
import { importedWallets, type InsertImportedWallet } from '../shared/schema';
import { eq, and } from 'drizzle-orm';
import { encryptWalletForStorage, decryptWalletFromStorage } from './wallet-encryption';

const router = Router();

// Server-side wallet generation endpoints

// Generate wallet from mnemonic 
router.post('/generate-from-mnemonic', async (req, res) => {
  try {
    const { mnemonic, chain, derivationPath } = req.body;
    
    if (!mnemonic || !chain) {
      return res.status(400).json({ success: false, error: 'Mnemonic and chain are required' });
    }

    // Basic validation
    const words = mnemonic.trim().split(/\s+/);
    if (words.length !== 12 && words.length !== 24) {
      return res.status(400).json({ success: false, error: 'Invalid mnemonic length' });
    }

    // Deprecated - Use /api/riddle-wallet endpoints for real wallet operations
    res.status(410).json({ 
      success: false, 
      error: 'Use /api/riddle-wallet endpoints for real wallet operations. No demo wallets.' 
    });

  } catch (error) {
    console.error('Mnemonic generation error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate wallet from mnemonic' 
    });
  }
});

// Generate wallet from private key
router.post('/generate-from-private-key', async (req, res) => {
  try {
    const { privateKey, chain } = req.body;
    
    if (!privateKey || !chain) {
      return res.status(400).json({ success: false, error: 'Private key and chain are required' });
    }

    // Deprecated - Use /api/riddle-wallet endpoints for real wallet operations
    res.status(410).json({ 
      success: false, 
      error: 'Use /api/riddle-wallet endpoints for real wallet operations. No demo wallets.' 
    });

  } catch (error) {
    console.error('Private key generation error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate wallet from private key' 
    });
  }
});

// Helper functions for mock data (replace with real crypto in production)
function generateMockAddress(chain: string): string {
  switch (chain) {
    case 'ethereum':
    case 'base':
    case 'bsc':
    case 'polygon':
      return '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    case 'bitcoin':
      return '1' + Array.from({ length: 33 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789'[Math.floor(Math.random() * 58)]).join('');
    case 'solana':
      return Array.from({ length: 44 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789'[Math.floor(Math.random() * 58)]).join('');
    case 'xrpl':
      return 'r' + Array.from({ length: 33 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789'[Math.floor(Math.random() * 58)]).join('');
    default:
      return '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  }
}

function generateMockPrivateKey(chain: string): string {
  return Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

function generateMockPublicKey(chain: string): string {
  return Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

function getDefaultDerivationPath(chain: string): string {
  const paths: Record<string, string> = {
    ethereum: "m/44'/60'/0'/0/0",
    bitcoin: "m/44'/0'/0'/0/0",
    solana: "m/44'/501'/0'/0'",
    xrpl: "m/44'/144'/0'/0/0",
    base: "m/44'/60'/0'/0/0",
    bsc: "m/44'/60'/0'/0/0",
    polygon: "m/44'/60'/0'/0/0"
  };
  return paths[chain] || "m/44'/60'/0'/0/0";
}

// Import wallet endpoint
router.post('/import', async (req, res) => {
  try {
    const {
      address,
      chain,
      privateKey,
      mnemonic,
      derivationPath,
      publicKey,
      import_method,
      wallet_name,
      password,
      user_id
    } = req.body;

    // Validate required fields
    if (!address || !chain || !privateKey || !password || !import_method) {
      return res.status(400).json({ 
        error: 'Missing required fields: address, chain, privateKey, password, import_method' 
      });
    }

    // Validate chain
    const supportedChains = ['ethereum', 'bitcoin', 'solana', 'xrpl', 'base', 'bsc', 'polygon'];
    if (!supportedChains.includes(chain)) {
      return res.status(400).json({ 
        error: `Unsupported chain: ${chain}. Supported chains: ${supportedChains.join(', ')}` 
      });
    }

    // Check if wallet already exists for this user
    const existingWallet = await db
      .select()
      .from(importedWallets)
      .where(
        and(
          eq(importedWallets.address, address),
          eq(importedWallets.chain, chain),
          user_id ? eq(importedWallets.user_handle, user_id) : undefined
        )
      )
      .limit(1);

    if (existingWallet.length > 0) {
      return res.status(400).json({ 
        error: 'Wallet already exists for this chain and user' 
      });
    }

    // Encrypt wallet data
    const { encryptedPrivateKey, encryptedMnemonic } = encryptWalletForStorage(
      privateKey,
      password,
      mnemonic
    );

    // Insert wallet into database
    const walletData: InsertImportedWallet = {
      user_handle: user_id || 'unknown',
      address,
      chain,
      wallet_label: wallet_name || `${chain} Wallet`,
      encrypted_private_key: encryptedPrivateKey,
      derivation_path: derivationPath,
      import_method,
      is_active: true,
      original_format: import_method,
      notes: null
    };

    const [insertedWallet] = await db
      .insert(importedWallets)
      .values(walletData as any as any)
      .returning();

    // Return success without sensitive data
    res.json({
      success: true,
      wallet: {
        id: insertedWallet.id,
        address: insertedWallet.address,
        chain: insertedWallet.chain,
        wallet_name: insertedWallet.wallet_label || insertedWallet.address,
        import_method: insertedWallet.import_method,
        created_at: insertedWallet.created_at
      }
    });

  } catch (error) {
    console.error('Wallet import error:', error);
    res.status(500).json({ 
      error: 'Failed to import wallet',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get imported wallets for a user
router.get('/imported', async (req, res) => {
  try {
    const { user_id, chain } = req.query;

    // Build query with conditions directly
    const conditions = [];
    if (user_id) {
      conditions.push(eq(importedWallets.user_handle, user_id as string));
    }
    if (chain) {
      conditions.push(eq(importedWallets.chain, chain as string));
    }
    conditions.push(eq(importedWallets.is_active, true));

    const wallets = await db.select({
      id: importedWallets.id,
      address: importedWallets.address,
      chain: importedWallets.chain,
      wallet_name: importedWallets.wallet_label,
      import_method: importedWallets.import_method,
      is_active: importedWallets.is_active,
      created_at: importedWallets.created_at
    }).from(importedWallets).where(and(...conditions));

    res.json({ success: true, wallets });

  } catch (error) {
    console.error('Get wallets error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch wallets',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get decrypted wallet data (requires password)
router.post('/decrypt/:walletId', async (req, res) => {
  try {
    const { walletId } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    // Get wallet from database
    const [wallet] = await db
      .select()
      .from(importedWallets)
      .where(eq(importedWallets.id, walletId))
      .limit(1);

    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    // Decrypt wallet data
    const { privateKey, mnemonic } = decryptWalletFromStorage(
      wallet.encrypted_private_key as any,
      password as string,
      undefined // No encrypted_mnemonic in schema
    );

    res.json({
      success: true,
      wallet: {
        id: wallet.id,
        address: wallet.address,
        chain: wallet.chain,
        privateKey,
        mnemonic,
        publicKey: undefined, // No public_key in schema
        derivationPath: wallet.derivation_path
      }
    });

  } catch (error) {
    console.error('Wallet decryption error:', error);
    res.status(400).json({ 
      error: 'Failed to decrypt wallet',
      details: error instanceof Error ? error.message : 'Invalid password or corrupted data'
    });
  }
});

// Update wallet (name, default status, etc.)
router.patch('/:walletId', async (req, res) => {
  try {
    const { walletId } = req.params;
    const { wallet_name, is_active } = req.body;

    const updates: any = {};
    
    if (wallet_name !== undefined) updates.wallet_label = wallet_name;
    if (is_active !== undefined) updates.is_active = is_active;

    // Update wallet
    const [updatedWallet] = await db
      .update(importedWallets)
      .set(updates)
      .where(eq(importedWallets.id, walletId))
      .returning();

    if (!updatedWallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    res.json({
      success: true,
      wallet: {
        id: updatedWallet.id,
        address: updatedWallet.address,
        chain: updatedWallet.chain,
        wallet_name: updatedWallet.wallet_label || updatedWallet.address,
        is_active: updatedWallet.is_active
      }
    });

  } catch (error) {
    console.error('Wallet update error:', error);
    res.status(500).json({ 
      error: 'Failed to update wallet',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Delete wallet
router.delete('/:walletId', async (req, res) => {
  try {
    const { walletId } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password confirmation required to delete wallet' });
    }

    // Verify password by attempting to decrypt
    const [wallet] = await db
      .select()
      .from(importedWallets)
      .where(eq(importedWallets.id, walletId))
      .limit(1);

    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    try {
      // Verify password
      decryptWalletFromStorage(
        wallet.encrypted_private_key as any,
        password as string,
        undefined // No encrypted_mnemonic in schema
      );
    } catch {
      return res.status(400).json({ error: 'Invalid password' });
    }

    // Delete wallet
    await db
      .delete(importedWallets)
      .where(eq(importedWallets.id, walletId));

    res.json({ success: true, message: 'Wallet deleted successfully' });

  } catch (error) {
    console.error('Wallet deletion error:', error);
    res.status(500).json({ 
      error: 'Failed to delete wallet',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Export wallet data (encrypted backup)
router.post('/export/:walletId', async (req, res) => {
  try {
    const { walletId } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    // Get and decrypt wallet
    const [wallet] = await db
      .select()
      .from(importedWallets)
      .where(eq(importedWallets.id, walletId))
      .limit(1);

    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    const { privateKey, mnemonic } = decryptWalletFromStorage(
      wallet.encrypted_private_key as any,
      password as string,
      undefined // No encrypted_mnemonic in schema
    );

    // Create exportable wallet data
    const exportData = {
      wallet_name: wallet.wallet_label || wallet.address,
      address: wallet.address,
      chain: wallet.chain,
      private_key: privateKey,
      mnemonic,
      derivation_path: wallet.derivation_path,
      public_key: undefined, // No public_key in schema
      import_method: wallet.import_method,
      exported_at: new Date().toISOString(),
      export_version: '1.0'
    };

    res.json({
      success: true,
      export_data: exportData
    });

  } catch (error) {
    console.error('Wallet export error:', error);
    res.status(400).json({ 
      error: 'Failed to export wallet',
      details: error instanceof Error ? error.message : 'Invalid password or corrupted data'
    });
  }
});

export default router;