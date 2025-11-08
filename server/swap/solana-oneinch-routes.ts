// Solana Swap Routes - 1inch API ONLY (Production Ready)
// Uses cached session keys - NO PASSWORD NEEDED
import { Router } from 'express';
import { Connection, PublicKey, Transaction, sendAndConfirmTransaction, Keypair } from '@solana/web3.js';
import { sessionAuth } from '../middleware/session-auth';
// Note: 1inch v6.0 does not support Solana. Use Jupiter for Solana swaps.
import bs58 from 'bs58';

const router = Router();

// Solana RPC endpoint
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

// Platform fee wallet for Solana
const PLATFORM_FEE_WALLET = process.env.PLATFORM_FEE_WALLET_SOL || 'YourSolanaFeeWalletHere';
const PLATFORM_FEE_BPS = 25; // 0.25% in basis points

/**
 * GET /api/swap/solana/quote
 * Get Solana swap quote from 1inch aggregator
 * Uses session authentication
 */
router.get('/quote', sessionAuth, async (req, res) => {
  try {
    const {
      fromToken,
      toToken,
      amount,
      slippage = '1'
    } = req.query;

    // Validate required parameters
    if (!fromToken || !toToken || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: fromToken, toToken, amount'
      });
    }

    // Get wallet address from session
    const session = (req as any).session;
    if (!session?.walletData?.walletAddresses?.sol) {
      return res.status(401).json({
        success: false,
        error: 'No Solana wallet found in session'
      });
    }

    const walletAddress = session.walletData.walletAddresses.sol;

    console.log(`📊 [1INCH SOLANA QUOTE] ${fromToken} → ${toToken}, Amount: ${amount}`);

    // 1inch API does not support Solana; instruct client to use Jupiter endpoint instead
    return res.status(501).json({
      success: false,
      error: 'Solana swaps via 1inch are not supported. Use the Jupiter swap endpoint instead.',
      code: 'SOLANA_NOT_SUPPORTED_BY_1INCH'
    });

  } catch (error) {
    console.error('❌ [1INCH SOLANA QUOTE] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get quote'
    });
  }
});

/**
 * POST /api/swap/solana/execute
 * Execute Solana swap using 1inch + cached session keys
 * NO PASSWORD NEEDED - uses cached private key from session
 */
router.post('/execute', sessionAuth, async (req, res) => {
  try {
    const {
      fromToken,
      toToken,
      amount,
      slippage = 1
    } = req.body;

    // Validate parameters
    if (!fromToken || !toToken || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: fromToken, toToken, amount'
      });
    }

    // Get cached private key from session
    const session = (req as any).session;
    const cachedPrivateKey = session?.solPrivateKey;
    
    if (!cachedPrivateKey) {
      return res.status(401).json({
        success: false,
        error: 'No cached Solana private key in session. Please login again.'
      });
    }

    console.log(`🔐 [1INCH SOLANA SWAP] Using cached SOL private key from session`);

    // Setup Solana connection and wallet
    const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
    
    // Decode private key from base58
    let keypair: Keypair;
    try {
      const secretKey = bs58.decode(cachedPrivateKey);
      keypair = Keypair.fromSecretKey(secretKey);
    } catch (error) {
      // If not base58, try direct Uint8Array
      const secretKey = Buffer.from(cachedPrivateKey, 'hex');
      keypair = Keypair.fromSecretKey(secretKey);
    }

    const walletAddress = keypair.publicKey.toString();

    console.log(`💱 [1INCH SOLANA SWAP] Executing swap for ${walletAddress}`);
    console.log(`📊 [1INCH SOLANA SWAP] ${fromToken} → ${toToken}, Amount: ${amount}`);

    // 1inch does not support Solana. Return instructional error.
    return res.status(501).json({
      success: false,
      error: 'Solana swaps via 1inch are not supported. Use the Jupiter swap endpoint instead.',
      code: 'SOLANA_NOT_SUPPORTED_BY_1INCH'
    });

  } catch (error) {
    console.error('❌ [1INCH SOLANA SWAP] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Swap execution failed'
    });
  }
});

/**
 * GET /api/swap/solana/tokens
 * Get available tokens for Solana from 1inch
 */
router.get('/tokens', async (req, res) => {
  try {
    return res.status(501).json({
      success: false,
      error: 'Solana tokens via 1inch are not supported. Use Jupiter tokens endpoint instead.',
      code: 'SOLANA_NOT_SUPPORTED_BY_1INCH'
    });

  } catch (error) {
    console.error('❌ [1INCH SOLANA TOKENS] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch tokens'
    });
  }
});

/**
 * GET /api/swap/solana/balance/:tokenAddress
 * Get token balance for connected wallet
 */
router.get('/balance/:tokenAddress', sessionAuth, async (req, res) => {
  try {
    const { tokenAddress } = req.params;

    // Get wallet from session
    const session = (req as any).session;
    if (!session?.walletData?.walletAddresses?.sol) {
      return res.status(401).json({
        success: false,
        error: 'No Solana wallet in session'
      });
    }

    const walletAddress = session.walletData.walletAddresses.sol;
    const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
    const publicKey = new PublicKey(walletAddress);

    let balance: string;

    if (tokenAddress === 'native' || tokenAddress === 'So11111111111111111111111111111111111111112') {
      // Get native SOL balance
      const lamports = await connection.getBalance(publicKey);
      balance = (lamports / 1e9).toString();
    } else {
      // Get SPL token balance
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        publicKey,
        { mint: new PublicKey(tokenAddress) }
      );

      if (tokenAccounts.value.length === 0) {
        balance = '0';
      } else {
        const accountInfo = tokenAccounts.value[0].account.data.parsed.info;
        balance = (accountInfo.tokenAmount.uiAmount || 0).toString();
      }
    }

    res.json({
      success: true,
      balance,
      tokenAddress,
      walletAddress
    });

  } catch (error) {
    console.error('❌ [SOLANA BALANCE] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get balance'
    });
  }
});

export default router;
