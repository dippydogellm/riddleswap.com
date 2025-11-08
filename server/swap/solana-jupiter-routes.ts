// Solana Swap Routes - Jupiter API (Industry Standard)
// Uses cached session keys - NO PASSWORD NEEDED
import { Router } from 'express';
import { Connection, PublicKey, Transaction, VersionedTransaction, Keypair } from '@solana/web3.js';
import { sessionAuth } from '../middleware/session-auth';
import bs58 from 'bs58';
import fetch from 'node-fetch';

const router = Router();

// Solana RPC endpoint
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

// Jupiter API v6 endpoint
const JUPITER_API = 'https://quote-api.jup.ag/v6';

// Platform fee wallet for Solana
const PLATFORM_FEE_WALLET = process.env.PLATFORM_FEE_WALLET_SOL || '';
const PLATFORM_FEE_BPS = 25; // 0.25% in basis points

/**
 * GET /api/swap/solana/quote
 * Get Solana swap quote from Jupiter aggregator
 * Uses session authentication
 */
router.get('/quote', sessionAuth, async (req, res) => {
  try {
    const {
      inputMint,
      outputMint,
      amount,
      slippageBps = '50' // 0.5% default slippage
    } = req.query;

    // Validate required parameters
    if (!inputMint || !outputMint || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: inputMint, outputMint, amount'
      });
    }

    console.log(`📊 [JUPITER QUOTE] ${inputMint} → ${outputMint}, Amount: ${amount}`);

    // Get quote from Jupiter
    const params = new URLSearchParams({
      inputMint: inputMint as string,
      outputMint: outputMint as string,
      amount: amount as string,
      slippageBps: slippageBps as string,
      onlyDirectRoutes: 'false',
      asLegacyTransaction: 'false'
    });

    // Add platform fee if configured
    if (PLATFORM_FEE_WALLET) {
      params.append('platformFeeBps', PLATFORM_FEE_BPS.toString());
    }

    const quoteUrl = `${JUPITER_API}/quote?${params}`;
    const response = await fetch(quoteUrl);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Jupiter quote failed: ${errorText}`);
    }

    const quote = await response.json() as any;

    console.log(`✅ [JUPITER QUOTE] Expected output: ${quote.outAmount} (${quote.otherAmountThreshold} min)`);

    res.json({
      success: true,
      quote,
      chain: 'solana'
    });

  } catch (error) {
    console.error('❌ [JUPITER QUOTE] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get quote'
    });
  }
});

/**
 * POST /api/swap/solana/execute
 * Execute Solana swap using Jupiter + cached session keys
 * NO PASSWORD NEEDED - uses cached private key from session
 */
router.post('/execute', sessionAuth, async (req, res) => {
  try {
    const {
      quoteResponse,
      userPublicKey,
      wrapAndUnwrapSol = true,
      prioritizationFeeLamports
    } = req.body;

    // Validate parameters
    if (!quoteResponse || !userPublicKey) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: quoteResponse, userPublicKey'
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

    console.log(`🔐 [JUPITER SWAP] Using cached SOL private key from session`);

    // Setup Solana connection and wallet
    const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
    
    // Decode private key from base58
    let keypair: Keypair;
    try {
      const secretKey = bs58.decode(cachedPrivateKey);
      keypair = Keypair.fromSecretKey(secretKey);
    } catch (error) {
      // If not base58, try direct Uint8Array or Buffer
      try {
        // Try as hex string
        const secretKey = Buffer.from(cachedPrivateKey.replace('0x', ''), 'hex');
        keypair = Keypair.fromSecretKey(secretKey);
      } catch {
        // Try as array
        const secretKey = new Uint8Array(JSON.parse(cachedPrivateKey));
        keypair = Keypair.fromSecretKey(secretKey);
      }
    }

    const walletAddress = keypair.publicKey.toString();

    console.log(`💱 [JUPITER SWAP] Executing swap for ${walletAddress}`);
    console.log(`📊 [JUPITER SWAP] Route: ${quoteResponse.inputMint.slice(0, 8)}... → ${quoteResponse.outputMint.slice(0, 8)}...`);

    // Get swap transaction from Jupiter
    const swapBody = {
      quoteResponse,
      userPublicKey: walletAddress,
      wrapAndUnwrapSol,
      computeUnitPriceMicroLamports: prioritizationFeeLamports || 'auto'
    };

    // Add platform fee if configured
    if (PLATFORM_FEE_WALLET) {
      (swapBody as any).feeAccount = PLATFORM_FEE_WALLET;
    }

    const swapResponse = await fetch(`${JUPITER_API}/swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(swapBody)
    });

    if (!swapResponse.ok) {
      const errorText = await swapResponse.text();
      throw new Error(`Jupiter swap request failed: ${errorText}`);
    }

    const { swapTransaction } = await swapResponse.json() as { swapTransaction: string };

    console.log(`📝 [JUPITER SWAP] Got swap transaction from Jupiter`);

    // Deserialize transaction
    const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
    let transaction: VersionedTransaction | Transaction;
    
    try {
      transaction = VersionedTransaction.deserialize(swapTransactionBuf);
    } catch {
      transaction = Transaction.from(swapTransactionBuf);
    }

    console.log(`🚀 [JUPITER SWAP] Signing and submitting transaction...`);

    // Sign transaction
    if (transaction instanceof VersionedTransaction) {
      transaction.sign([keypair]);
    } else {
      transaction.sign(keypair);
    }

    // Send transaction
    const rawTransaction = transaction instanceof VersionedTransaction 
      ? transaction.serialize()
      : transaction.serialize();
      
    const signature = await connection.sendRawTransaction(rawTransaction, {
      skipPreflight: false,
      maxRetries: 3
    });
    
    console.log(`⏳ [JUPITER SWAP] TX submitted: ${signature}`);
    console.log(`⏳ [JUPITER SWAP] Waiting for confirmation...`);

    // Confirm transaction
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');

    if (!confirmation.value.err) {
      console.log(`✅ [JUPITER SWAP] Swap successful! TX: ${signature}`);
      
      res.json({
        success: true,
        signature,
        inputMint: quoteResponse.inputMint,
        outputMint: quoteResponse.outputMint,
        inputAmount: quoteResponse.inAmount,
        outputAmount: quoteResponse.outAmount,
        chain: 'solana',
        explorerUrl: `https://solscan.io/tx/${signature}`
      });
    } else {
      console.error(`❌ [JUPITER SWAP] Transaction failed:`, confirmation.value.err);
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }

  } catch (error) {
    console.error('❌ [JUPITER SWAP] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Swap execution failed'
    });
  }
});

/**
 * GET /api/swap/solana/tokens
 * Get available tokens for Solana from Jupiter
 */
router.get('/tokens', async (req, res) => {
  try {
    console.log(`📋 [JUPITER TOKENS] Fetching available tokens`);

    const response = await fetch(`${JUPITER_API}/tokens`);

    if (!response.ok) {
      throw new Error(`Failed to fetch tokens: ${response.statusText}`);
    }

    const tokens = await response.json() as any[];
    
    res.json({
      success: true,
      chain: 'solana',
      tokens,
      count: tokens.length
    });

  } catch (error) {
    console.error('❌ [JUPITER TOKENS] Error:', error);
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
