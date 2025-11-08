import { Router } from 'express';
import { z } from 'zod';
import { getQuoteV2, executeSwapV2, prepareSwapTxV2, SwapInputSchema } from './xrpl-swap-v2';
import { storage } from '../storage';
import { decryptWalletData } from '../wallet-encryption';
import { logger } from '../utils/logger';

const router = Router();

const QuoteSchema = SwapInputSchema.extend({});

router.post('/xrpl/swap/v2/quote', async (req, res) => {
  try {
    const input = QuoteSchema.parse(req.body);
    const q = await getQuoteV2(input);
    res.json({ success: true, ...q });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error?.message || 'Invalid request' });
  }
});

// For execute: allow either cached session key OR (handle + password)
const ExecuteSchema = SwapInputSchema.extend({
  riddleWalletHandle: z.string().min(1).optional(),
  password: z.string().min(1).optional()
});

router.post('/xrpl/swap/v2/execute', async (req: any, res) => {
  try {
    const { riddleWalletHandle, password, ...rest } = ExecuteSchema.parse(req.body);

    // 1) Prefer cached keys from user/session (no password required)
    const user = (req as any).user || {};
    const session = (req as any).session || {};
    let privateKey: string | undefined = user?.cachedKeys?.xrpPrivateKey || session?.xrpPrivateKey;

    // 2) Fallback: decrypt from storage using handle + password
    if (!privateKey) {
      if (!riddleWalletHandle || !password) {
        return res.status(400).json({ success: false, error: 'Missing credentials: provide cached session key or riddleWalletHandle + password' });
      }

      const walletData = await storage.getRiddleWalletByHandle(riddleWalletHandle);
      if (!walletData) return res.status(404).json({ success: false, error: 'Wallet not found' });

      try {
        const encrypted = walletData.encryptedPrivateKeys;
        if (!encrypted) {
          logger.error('[XRPL Swap v2] Missing encryptedPrivateKeys for handle', { handle: riddleWalletHandle });
          return res.status(500).json({ success: false, error: 'Wallet does not contain encrypted private keys' });
        }

        // Attempt decryption. decryptWalletData should return a string (JSON or raw seed)
        const decrypted = decryptWalletData(encrypted as any, password);

        let keys: any = null;

        // If decrypted is JSON, parse it, otherwise treat it as raw seed/privateKey
        if (typeof decrypted === 'string') {
          const trimmed = decrypted.trim();
          if (trimmed.startsWith('{')) {
            try {
              keys = JSON.parse(trimmed);
            } catch (parseErr) {
              logger.warn('[XRPL Swap v2] Decryption returned JSON-like string but parse failed', { handle: riddleWalletHandle });
              // fall through; we'll try other heuristics below
            }
          } else {
            // Could be a raw seed/private key (e.g., starts with 's' for xrpl seeds)
            keys = trimmed;
          }
        } else if (typeof decrypted === 'object' && decrypted !== null) {
          keys = decrypted;
        }

        // Resolve privateKey from multiple possible shapes
        if (typeof keys === 'string') {
          // direct seed/privateKey string
          privateKey = keys;
        } else if (keys) {
          privateKey = typeof keys.xrp === 'string' ? keys.xrp :
            (keys.xrp?.privateKey || keys.xrp?.seed || keys.xrpPrivateKey || keys.private_key || keys.privateKey || null);
        }

        // Final validation
        if (!privateKey) {
          logger.error('[XRPL Swap v2] Unable to extract XRP private key from decrypted data', { handle: riddleWalletHandle });
          return res.status(400).json({ success: false, error: 'Unable to extract XRP private key from wallet data' });
        }
      } catch (e: any) {
        logger.error('[XRPL Swap v2] Decrypt error', { handle: riddleWalletHandle, error: e?.message || String(e) });
        return res.status(400).json({ success: false, error: 'Invalid password or wallet data' });
      }
    }

    if (!privateKey) return res.status(400).json({ success: false, error: 'XRP private key not available' });

    try {
      logger.info('[XRPL Swap v2] Executing swap', {
        fromToken: (rest as any)?.fromToken,
        toToken: (rest as any)?.toToken,
        fromIssuer: (rest as any)?.fromIssuer ? 'present' : undefined,
        toIssuer: (rest as any)?.toIssuer ? 'present' : undefined,
        slippagePercent: (rest as any)?.slippagePercent
      });
    } catch {}

    const result = await executeSwapV2(privateKey, rest as any);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Swap failed' });
  }
});

const PrepareSchema = SwapInputSchema.extend({
  account: z.string().regex(/^r[0-9a-zA-Z]{24,35}$/),
});

router.post('/xrpl/swap/v2/prepare', async (req, res) => {
  try {
    const { account, ...input } = PrepareSchema.parse(req.body);
    const prepared = await prepareSwapTxV2(account, input as any);
    res.json({ success: true, ...prepared });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error?.message || 'Prepare failed' });
  }
});

export default router;
