/**
 * Liquidity Vault Routes - Multi-chain native token liquidity provision
 * Users can deposit native tokens (ETH, BNB, XRP, SOL, etc.) to provide liquidity
 * and earn rewards across all 17 supported chains
 */

import { Router } from 'express';
import { db } from './db';
import { vaultContributions, vaultRewards, vaultChainStats } from '../shared/schema';
import { eq, and, desc, sum, sql } from 'drizzle-orm';
import { requireAuthentication, sessionAuth } from './middleware/session-auth';
import { nanoid } from 'nanoid';
import { verifyVaultDeposit } from './vault-verification-service';

const router = Router();

/**
 * GET /api/vault/chains
 * Get all supported chains with vault stats (PUBLIC)
 */
router.get('/chains', async (req, res) => {
  try {
    const chains = await db
      .select()
      .from(vaultChainStats)
      .where(eq(vaultChainStats.is_active, true))
      .orderBy(vaultChainStats.chain);

    res.json({
      success: true,
      chains: chains.map(chain => ({
        chain: chain.chain,
        nativeToken: chain.native_token,
        totalLiquidity: chain.total_liquidity,
        totalLiquidityUsd: chain.total_liquidity_usd,
        activeContributors: chain.active_contributors,
        currentApy: chain.current_apy,
        minDeposit: chain.min_deposit,
        bankWalletAddress: chain.bank_wallet_address
      }))
    });
  } catch (error: any) {
    console.error('❌ [VAULT] Error fetching chains:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/vault/my-contributions
 * Get user's vault contributions across all chains (AUTHENTICATED)
 */
router.get('/my-contributions', requireAuthentication, async (req, res) => {
  try {
    const userHandle = (req as any).session?.userHandle;
    if (!userHandle) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const contributions = await db
      .select()
      .from(vaultContributions)
      .where(eq(vaultContributions.user_handle, userHandle))
      .orderBy(desc(vaultContributions.created_at));

    // Calculate total value across all chains
    const totals = contributions.reduce((acc, contrib) => {
      const amountUsd = parseFloat(contrib.amount_usd || '0');
      const rewardsUsd = parseFloat(contrib.rewards_earned_usd || '0');
      return {
        totalDeposited: acc.totalDeposited + amountUsd,
        totalRewards: acc.totalRewards + rewardsUsd
      };
    }, { totalDeposited: 0, totalRewards: 0 });

    res.json({
      success: true,
      contributions: contributions.map(c => ({
        id: c.id,
        chain: c.chain,
        nativeToken: c.native_token,
        amount: c.amount,
        amountUsd: c.amount_usd,
        rewardsEarned: c.rewards_earned,
        rewardsEarnedUsd: c.rewards_earned_usd,
        currentApy: c.current_apy,
        status: c.status,
        depositTxHash: c.deposit_tx_hash,
        createdAt: c.created_at
      })),
      summary: totals
    });
  } catch (error: any) {
    console.error('❌ [VAULT] Error fetching contributions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/vault/prepare-deposit
 * Prepare vault deposit transaction with memo (AUTHENTICATED)
 */
router.post('/prepare-deposit', requireAuthentication, async (req, res) => {
  try {
    const userHandle = (req as any).session?.userHandle;
    if (!userHandle) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const { chain, amount, walletAddress, walletType } = req.body;

    if (!chain || !amount || !walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: chain, amount, walletAddress'
      });
    }

    // Get chain stats
    const [chainStats] = await db
      .select()
      .from(vaultChainStats)
      .where(eq(vaultChainStats.chain, chain))
      .limit(1);

    if (!chainStats) {
      return res.status(400).json({
        success: false,
        error: `Chain ${chain} is not supported`
      });
    }

    // SECURITY: Check if bank wallet is configured
    if (!chainStats.bank_wallet_address) {
      return res.status(503).json({
        success: false,
        error: `Vault is not yet configured for ${chain}. Bank wallet address is pending admin configuration. Please try again later.`,
        errorCode: 'VAULT_NOT_CONFIGURED'
      });
    }

    // Check if chain is active
    if (!chainStats.is_active) {
      return res.status(503).json({
        success: false,
        error: `Vault deposits are temporarily disabled for ${chain}`,
        errorCode: 'VAULT_DISABLED'
      });
    }

    // Validate minimum deposit
    if (parseFloat(amount) < parseFloat(chainStats.min_deposit)) {
      return res.status(400).json({
        success: false,
        error: `Minimum deposit is ${chainStats.min_deposit} ${chainStats.native_token}`
      });
    }

    // Generate unique memo for verification
    const memo = `VAULT-${userHandle}-${nanoid(12)}`.toUpperCase();

    // Create pending contribution record
    const [contribution] = await db
      .insert(vaultContributions)
      .values({
        user_handle: userHandle,
        wallet_address: walletAddress,
        wallet_type: walletType || 'riddle', // Track which wallet type made the deposit
        chain: chain,
        native_token: chainStats.native_token,
        amount: amount,
        memo: memo,
        status: 'pending',
        current_apy: chainStats.current_apy
      } as any)
      .returning();

    console.log(`🏦 [VAULT] Prepared deposit for ${userHandle}: ${amount} ${chainStats.native_token} on ${chain}`);
    console.log(`🏦 [VAULT] Memo: ${memo}`);

    res.json({
      success: true,
      contribution: {
        id: contribution.id,
        memo: memo,
        chain: chain,
        nativeToken: chainStats.native_token,
        amount: amount,
        bankWalletAddress: chainStats.bank_wallet_address,
        currentApy: chainStats.current_apy
      },
      instructions: {
        step1: `Send ${amount} ${chainStats.native_token} to ${chainStats.bank_wallet_address}`,
        step2: chain === 'xrpl' 
          ? `Include memo: ${memo} in the transaction`
          : `Include this data in transaction: ${memo}`,
        step3: 'After sending, click "Verify Deposit" with your transaction hash'
      }
    });
  } catch (error: any) {
    console.error('❌ [VAULT] Error preparing deposit:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/vault/verify-deposit
 * Verify deposit transaction and activate contribution (AUTHENTICATED)
 */
router.post('/verify-deposit', requireAuthentication, async (req, res) => {
  try {
    const userHandle = (req as any).session?.userHandle;
    if (!userHandle) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const { contributionId, txHash } = req.body;

    if (!contributionId || !txHash) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: contributionId, txHash'
      });
    }

    // Get contribution
    const [contribution] = await db
      .select()
      .from(vaultContributions)
      .where(and(
        eq(vaultContributions.id, contributionId),
        eq(vaultContributions.user_handle, userHandle)
      ))
      .limit(1);

    if (!contribution) {
      return res.status(404).json({
        success: false,
        error: 'Contribution not found'
      });
    }

    if (contribution.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Contribution already verified'
      });
    }

    // Get chain stats to get bank wallet address
    const [chainStats] = await db
      .select()
      .from(vaultChainStats)
      .where(eq(vaultChainStats.chain, contribution.chain))
      .limit(1);

    if (!chainStats || !chainStats.bank_wallet_address) {
      return res.status(500).json({
        success: false,
        error: 'Chain configuration error. Please contact admin.'
      });
    }

    // BLOCKCHAIN VERIFICATION: Verify the transaction on the blockchain
    console.log(`🔍 [VAULT] Verifying deposit: ${contribution.amount} ${contribution.native_token} on ${contribution.chain}`);
    console.log(`🔍 [VAULT] Transaction: ${txHash}`);
    console.log(`🔍 [VAULT] Expected memo: ${contribution.memo}`);
    
    const verification = await verifyVaultDeposit(
      contribution.chain,
      txHash,
      contribution.memo,
      chainStats.bank_wallet_address,
      contribution.amount
    );

    if (!verification.success || !verification.verified) {
      console.error(`❌ [VAULT] Verification failed:`, verification.error);
      return res.status(400).json({
        success: false,
        error: verification.error || 'Transaction verification failed',
        errorCode: 'VERIFICATION_FAILED'
      });
    }

    console.log(`✅ [VAULT] Deposit verified successfully!`);

    // Update contribution
    await db
      .update(vaultContributions)
      .set({ 
        status: 'verified',
        deposit_tx_hash: txHash,
        verified_at: new Date(),
        updated_at: new Date()
       } as any)
      .where(eq(vaultContributions.id, contributionId));

    // Update chain stats
    await db
      .update(vaultChainStats)
      // Cast to any for computed SQL expressions not present in inferred update type
      .set({
        total_liquidity: sql`total_liquidity + ${contribution.amount}`,
        active_contributors: sql`active_contributors + 1`,
        updated_at: new Date()
      } as any)
      .where(eq(vaultChainStats.chain, contribution.chain));

    console.log(`✅ [VAULT] Verified deposit: ${contribution.amount} ${contribution.native_token} from ${userHandle}`);

    res.json({
      success: true,
      message: 'Deposit verified successfully! You are now earning rewards.',
      contribution: {
        id: contribution.id,
        status: 'verified',
        amount: contribution.amount,
        chain: contribution.chain,
        apy: contribution.current_apy
      }
    });
  } catch (error: any) {
    console.error('❌ [VAULT] Error verifying deposit:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/vault/stats
 * Get overall vault statistics (PUBLIC)
 */
router.get('/stats', async (req, res) => {
  try {
    // Get total liquidity across all chains
    const [totals] = await db
      .select({
        totalLiquidityUsd: sum(vaultChainStats.total_liquidity_usd),
        totalChains: sql<number>`count(*)`,
        totalContributors: sum(vaultChainStats.active_contributors)
      })
      .from(vaultChainStats)
      .where(eq(vaultChainStats.is_active, true));

    // Get contribution count
    const [{ count: totalContributions }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(vaultContributions)
      .where(eq(vaultContributions.status, 'verified'));

    res.json({
      success: true,
      stats: {
        totalLiquidityUsd: totals.totalLiquidityUsd || '0',
        totalChains: totals.totalChains || 0,
        totalContributors: totals.totalContributors || 0,
        totalContributions: totalContributions || 0
      }
    });
  } catch (error: any) {
    console.error('❌ [VAULT] Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/liquidity-vault/deposit-from-wallet
 * Deposit to vault directly from cached Riddle Wallet (AUTHENTICATED with cached keys)
 */
router.post('/deposit-from-wallet', sessionAuth, async (req, res) => {
  try {
    const { chain, amount } = req.body;
    const user = (req as any).user;
    const userHandle = user?.handle || user?.userHandle;

    console.log(`💰 [VAULT DEPOSIT] Processing cached wallet deposit:`, {
      handle: userHandle,
      chain,
      amount,
      hasUser: !!user,
      hasCachedKeys: !!user?.cachedKeys
    });

    if (!userHandle) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        errorCode: 'NOT_AUTHENTICATED'
      });
    }

    if (!chain || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: chain, amount'
      });
    }

    // Validate chain support
    if (chain !== 'xrpl' && chain !== 'solana') {
      return res.status(400).json({
        success: false,
        error: 'Only XRPL and Solana deposits are supported via cached wallet',
        errorCode: 'UNSUPPORTED_CHAIN'
      });
    }

    // Check if cached keys are available
    if (!user?.cachedKeys) {
      console.log('❌ [VAULT DEPOSIT] No cached keys - session renewal needed');
      return res.status(401).json({
        success: false,
        error: 'Session keys expired. Please renew your session to make deposits.',
        errorCode: 'SESSION_EXPIRED',
        needsRenewal: true
      });
    }

    // Get chain stats to validate and get bank wallet address
    const chainName = chain === 'xrpl' ? 'xrpl' : 'solana';
    const [chainStats] = await db
      .select()
      .from(vaultChainStats)
      .where(eq(vaultChainStats.chain, chainName))
      .limit(1);

    if (!chainStats) {
      return res.status(400).json({
        success: false,
        error: `Chain ${chainName} is not supported in vault`
      });
    }

    // Check if bank wallet is configured
    if (!chainStats.bank_wallet_address) {
      return res.status(503).json({
        success: false,
        error: `Vault is not yet configured for ${chainName}. Bank wallet address is pending admin configuration.`,
        errorCode: 'VAULT_NOT_CONFIGURED'
      });
    }

    // Check if chain is active
    if (!chainStats.is_active) {
      return res.status(503).json({
        success: false,
        error: `Vault deposits are temporarily disabled for ${chainName}`,
        errorCode: 'VAULT_DISABLED'
      });
    }

    // Validate minimum deposit
    if (parseFloat(amount) < parseFloat(chainStats.min_deposit)) {
      return res.status(400).json({
        success: false,
        error: `Minimum deposit is ${chainStats.min_deposit} ${chainStats.native_token}`
      });
    }

    // Process deposit based on chain
    let txHash: string;
    let fromAddress: string;

    if (chain === 'xrpl') {
      // Process XRP deposit
      const xrpPrivateKey = user.cachedKeys.xrpPrivateKey;
      if (!xrpPrivateKey) {
        console.log('❌ [VAULT DEPOSIT] No XRP private key in cached keys');
        return res.status(401).json({
          success: false,
          error: 'XRP wallet not found in session. Please renew your session.',
          errorCode: 'SESSION_EXPIRED',
          needsRenewal: true
        });
      }

      console.log(`🔐 [VAULT DEPOSIT] Processing XRP deposit with cached keys`);

      const { Client, Wallet } = await import('xrpl');
      const client = new Client('wss://xrplcluster.com/');
      
      try {
        await client.connect();
        const wallet = Wallet.fromSeed(xrpPrivateKey);
        fromAddress = wallet.address;

        console.log(`💰 [VAULT DEPOSIT] Sending ${amount} XRP from ${fromAddress} to ${chainStats.bank_wallet_address}`);

        // Check balance
        const accountInfo = await client.request({
          command: 'account_info',
          account: wallet.address
        });

        const balance = parseFloat(accountInfo.result.account_data.Balance) / 1000000;
        const requiredAmount = parseFloat(amount) + 0.000012; // Include fee

        if (balance < requiredAmount) {
          await client.disconnect();
          return res.status(400).json({
            success: false,
            error: `Insufficient balance. You have ${balance.toFixed(6)} XRP but need ${requiredAmount.toFixed(6)} XRP (including fees)`,
            errorCode: 'INSUFFICIENT_BALANCE'
          });
        }

        // Generate unique memo
        const memo = `VAULT-${userHandle}-${nanoid(12)}`.toUpperCase();

        // Create and submit payment
        const payment: any = {
          TransactionType: 'Payment',
          Account: wallet.address,
          Destination: chainStats.bank_wallet_address,
          Amount: Math.round(parseFloat(amount) * 1000000).toString(),
          Memos: [{
            Memo: {
              MemoData: Buffer.from(memo, 'utf8').toString('hex').toUpperCase()
            }
          }]
        };

        const prepared = await client.autofill(payment);
        const signed = wallet.sign(prepared);
        const result = await client.submitAndWait(signed.tx_blob);

        await client.disconnect();

        if (result.result.meta && typeof result.result.meta === 'object' && 'TransactionResult' in result.result.meta) {
          const txResult = result.result.meta.TransactionResult;
          if (txResult !== 'tesSUCCESS') {
            throw new Error(`Transaction failed with code: ${txResult}`);
          }
        }

        txHash = result.result.hash;
        console.log(`✅ [VAULT DEPOSIT] XRP deposit successful: ${txHash}`);

      } catch (error: any) {
        console.error('❌ [VAULT DEPOSIT] XRP deposit failed:', error);
        return res.status(500).json({
          success: false,
          error: `XRP deposit failed: ${error.message}`,
          errorCode: 'TRANSACTION_FAILED'
        });
      }

    } else if (chain === 'solana') {
      // Process SOL deposit
      const solPrivateKey = user.cachedKeys.solPrivateKey;
      if (!solPrivateKey) {
        console.log('❌ [VAULT DEPOSIT] No SOL private key in cached keys');
        return res.status(401).json({
          success: false,
          error: 'Solana wallet not found in session. Please renew your session.',
          errorCode: 'SESSION_EXPIRED',
          needsRenewal: true
        });
      }

      console.log(`🔐 [VAULT DEPOSIT] Processing Solana deposit with cached keys`);

      const { Connection, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL } = await import('@solana/web3.js');
      const bs58 = await import('bs58');

      try {
        // Create keypair from private key
        let secretKey: Uint8Array;
        if (solPrivateKey.includes(',')) {
          const keyBytes = solPrivateKey.split(',').map((b: string) => parseInt(b.trim()));
          secretKey = new Uint8Array(keyBytes);
        } else if (solPrivateKey.includes('[')) {
          const keyBytes = JSON.parse(solPrivateKey);
          secretKey = new Uint8Array(keyBytes);
        } else {
          secretKey = bs58.default.decode(solPrivateKey);
        }

        const keypair = Keypair.fromSecretKey(secretKey);
        fromAddress = keypair.publicKey.toString();

        console.log(`💰 [VAULT DEPOSIT] Sending ${amount} SOL from ${fromAddress} to ${chainStats.bank_wallet_address}`);

        // Connect to Solana
        const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');

        // Check balance
        const balance = await connection.getBalance(keypair.publicKey);
        const balanceSOL = balance / LAMPORTS_PER_SOL;
        const requiredAmount = parseFloat(amount) + 0.000005; // Include fee estimate

        if (balanceSOL < requiredAmount) {
          return res.status(400).json({
            success: false,
            error: `Insufficient balance. You have ${balanceSOL.toFixed(6)} SOL but need ${requiredAmount.toFixed(6)} SOL (including fees)`,
            errorCode: 'INSUFFICIENT_BALANCE'
          });
        }

        // Create transaction
        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: keypair.publicKey,
            toPubkey: new PublicKey(chainStats.bank_wallet_address),
            lamports: Math.floor(parseFloat(amount) * LAMPORTS_PER_SOL)
          })
        );

        // Send and confirm
        txHash = await sendAndConfirmTransaction(connection, transaction, [keypair]);
        console.log(`✅ [VAULT DEPOSIT] Solana deposit successful: ${txHash}`);

      } catch (error: any) {
        console.error('❌ [VAULT DEPOSIT] Solana deposit failed:', error);
        return res.status(500).json({
          success: false,
          error: `Solana deposit failed: ${error.message}`,
          errorCode: 'TRANSACTION_FAILED'
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        error: 'Unsupported chain'
      });
    }

    // Create contribution record in database
    const [contribution] = await db
      .insert(vaultContributions)
      // Cast values for fields (wallet_type, memo) if schema inference is stricter
      .values({
        user_handle: userHandle,
        wallet_address: fromAddress,
        wallet_type: 'riddle',
        chain: chainName,
        native_token: chainStats.native_token,
        amount: amount,
        deposit_tx_hash: txHash,
        status: 'verified',
        current_apy: chainStats.current_apy,
        memo: `AUTO-DEPOSIT-${txHash.substring(0, 10 as any)}`
      } as any)
      .returning();

    console.log(`✅ [VAULT DEPOSIT] Contribution recorded: ID ${contribution.id}`);

    // Update chain stats
    await db
      .update(vaultChainStats)
      // Cast update object with computed SQL expressions
      .set({
        total_liquidity: sql`${vaultChainStats.total_liquidity} + ${amount}::decimal`,
        active_contributors: sql`${vaultChainStats.active_contributors} + 1`
      } as any)
      .where(eq(vaultChainStats.chain, chainName));

    res.json({
      success: true,
      message: `Successfully deposited ${amount} ${chainStats.native_token} to vault`,
      contribution: {
        id: contribution.id,
        txHash: txHash,
        amount: amount,
        chain: chainName,
        nativeToken: chainStats.native_token,
        currentApy: chainStats.current_apy
      }
    });

  } catch (error: any) {
    console.error('❌ [VAULT DEPOSIT] Error processing deposit:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process vault deposit',
      errorCode: 'INTERNAL_ERROR'
    });
  }
});

export default router;
