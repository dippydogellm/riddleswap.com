// Multi-Chain Payment Routes - Native and Token Transfers for All Chains
import { Express } from 'express';
import { sessionAuth } from '../middleware/session-auth';
import { ethers } from 'ethers';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, sendAndConfirmTransaction, Keypair } from '@solana/web3.js';
import { Client, Wallet, Payment, xrpToDrops } from 'xrpl';
import { CHAIN_CONFIGS, type ChainKey } from '../bridge/multi-chain-bridge-routes';

// ERC-20 Standard ABI for token transfers
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)'
];

// Helper functions
function getEVMProvider(chainKey: ChainKey) {
  const chainConfig = CHAIN_CONFIGS[chainKey];
  if (!('chainId' in chainConfig)) {
    throw new Error(`${chainKey} is not an EVM chain`);
  }
  return new ethers.JsonRpcProvider(chainConfig.rpcUrl);
}

function getEVMWallet(privateKey: string, chainKey: ChainKey) {
  const provider = getEVMProvider(chainKey);
  return new ethers.Wallet(privateKey, provider);
}

export function registerMultiChainPaymentRoutes(app: Express) {
  console.log('💰 Registering multi-chain payment routes...');

  // ==================================================
  // EVM CHAINS - NATIVE TOKEN SEND (ETH, BNB, MATIC, etc.)
  // ==================================================
  app.post("/api/payment/:chain/send-native", sessionAuth, async (req, res) => {
    const { chain } = req.params;
    const { toAddress, amount } = req.body;

    try {
      const chainKey = chain as ChainKey;
      const chainConfig = CHAIN_CONFIGS[chainKey];
      
      if (!chainConfig || !('chainId' in chainConfig)) {
        return res.status(400).json({
          success: false,
          error: `Invalid or unsupported chain: ${chain}`
        });
      }

      const ethPrivateKey = req.user?.cachedKeys?.ethPrivateKey;
      if (!ethPrivateKey) {
        return res.status(401).json({
          success: false,
          error: 'Wallet not found in session'
        });
      }

      const wallet = getEVMWallet(ethPrivateKey, chainKey);

      console.log(`💸 [${chainKey.toUpperCase()}] Sending native ${chainConfig.nativeToken}`);
      console.log(`   Amount: ${amount} ${chainConfig.nativeToken}`);
      console.log(`   To: ${toAddress}`);

      // Send native token
      const tx = await wallet.sendTransaction({
        to: toAddress,
        value: ethers.parseEther(amount.toString())
      });

      const receipt = await tx.wait();

      return res.json({
        success: true,
        txHash: receipt?.hash,
        chain: chainConfig.name,
        amount,
        token: chainConfig.nativeToken,
        explorerUrl: `${chainConfig.explorerUrl}/tx/${receipt?.hash}`,
        message: `${amount} ${chainConfig.nativeToken} sent successfully on ${chainConfig.name}`
      });

    } catch (error) {
      console.error(`❌ [${chain.toUpperCase()}] Native send error:`, error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Payment failed'
      });
    }
  });

  // ==================================================
  // EVM CHAINS - TOKEN SEND (ERC-20)
  // ==================================================
  app.post("/api/payment/:chain/send-token", sessionAuth, async (req, res) => {
    const { chain } = req.params;
    const { toAddress, amount, tokenAddress } = req.body;

    try {
      const chainKey = chain as ChainKey;
      const chainConfig = CHAIN_CONFIGS[chainKey];
      
      if (!chainConfig || !('chainId' in chainConfig)) {
        return res.status(400).json({
          success: false,
          error: `Invalid or unsupported chain: ${chain}`
        });
      }

      const ethPrivateKey = req.user?.cachedKeys?.ethPrivateKey;
      if (!ethPrivateKey) {
        return res.status(401).json({
          success: false,
          error: 'Wallet not found in session'
        });
      }

      const wallet = getEVMWallet(ethPrivateKey, chainKey);
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);

      // Get token details
      const [symbol, decimals] = await Promise.all([
        tokenContract.symbol(),
        tokenContract.decimals()
      ]);

      console.log(`💸 [${chainKey.toUpperCase()}] Sending ERC-20 token`);
      console.log(`   Token: ${symbol}`);
      console.log(`   Amount: ${amount}`);
      console.log(`   To: ${toAddress}`);

      // Transfer tokens
      const amountInWei = ethers.parseUnits(amount.toString(), decimals);
      const tx = await tokenContract.transfer(toAddress, amountInWei);
      const receipt = await tx.wait();

      return res.json({
        success: true,
        txHash: receipt.hash,
        chain: chainConfig.name,
        amount,
        token: symbol,
        tokenAddress,
        explorerUrl: `${chainConfig.explorerUrl}/tx/${receipt.hash}`,
        message: `${amount} ${symbol} sent successfully on ${chainConfig.name}`
      });

    } catch (error) {
      console.error(`❌ [${chain.toUpperCase()}] Token send error:`, error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Token transfer failed'
      });
    }
  });

  // ==================================================
  // XRPL - XRP PAYMENT
  // ==================================================
  app.post("/api/payment/xrpl/send", sessionAuth, async (req, res) => {
    const { toAddress, amount, memo, destinationTag } = req.body;

    try {
      const xrpPrivateKey = req.user?.cachedKeys?.xrpPrivateKey;
      if (!xrpPrivateKey) {
        return res.status(401).json({
          success: false,
          error: 'XRP wallet not found in session'
        });
      }

      console.log('💸 [XRPL] Sending XRP payment');
      console.log(`   Amount: ${amount} XRP`);
      console.log(`   To: ${toAddress}`);

      const client = new Client(CHAIN_CONFIGS.xrpl.rpcUrl);
      await client.connect();

      const wallet = Wallet.fromSeed(xrpPrivateKey);

      const payment: Payment = {
        TransactionType: 'Payment',
        Account: wallet.address,
        Destination: toAddress,
        Amount: xrpToDrops(amount),
        ...(memo && { Memos: [{ Memo: { MemoData: Buffer.from(memo).toString('hex') } }] }),
        ...(destinationTag && { DestinationTag: parseInt(destinationTag) })
      };

      const prepared = await client.autofill(payment);
      const signed = wallet.sign(prepared);
      const result = await client.submitAndWait(signed.tx_blob);

      await client.disconnect();

      return res.json({
        success: true,
        txHash: result.result.hash,
        chain: 'XRP Ledger',
        amount,
        token: 'XRP',
        explorerUrl: `${CHAIN_CONFIGS.xrpl.explorerUrl}/transactions/${result.result.hash}`,
        message: `${amount} XRP sent successfully`
      });

    } catch (error) {
      console.error('❌ [XRPL] Payment error:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'XRP payment failed'
      });
    }
  });

  // ==================================================
  // SOLANA - SOL PAYMENT
  // ==================================================
  app.post("/api/payment/solana/send", sessionAuth, async (req, res) => {
    const { toAddress, amount } = req.body;

    try {
      const solPrivateKey = req.user?.cachedKeys?.solPrivateKey;
      if (!solPrivateKey) {
        return res.status(401).json({
          success: false,
          error: 'Solana wallet not found in session'
        });
      }

      console.log('💸 [SOLANA] Sending SOL payment');
      console.log(`   Amount: ${amount} SOL`);
      console.log(`   To: ${toAddress}`);

      const connection = new Connection(CHAIN_CONFIGS.solana.rpcUrl);
      
      // Convert base58 private key to Keypair
      const fromKeypair = Keypair.fromSecretKey(
        Buffer.from(solPrivateKey, 'base64')
      );

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: fromKeypair.publicKey,
          toPubkey: new PublicKey(toAddress),
          lamports: Math.floor(parseFloat(amount) * LAMPORTS_PER_SOL)
        })
      );

      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [fromKeypair]
      );

      return res.json({
        success: true,
        txHash: signature,
        chain: 'Solana',
        amount,
        token: 'SOL',
        explorerUrl: `${CHAIN_CONFIGS.solana.explorerUrl}/tx/${signature}`,
        message: `${amount} SOL sent successfully`
      });

    } catch (error) {
      console.error('❌ [SOLANA] Payment error:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'SOL payment failed'
      });
    }
  });

  // ==================================================
  // GET BALANCE - All EVM Chains (Native + Token)
  // ==================================================
  app.get("/api/payment/:chain/balance", sessionAuth, async (req, res) => {
    const { chain } = req.params;
    const { tokenAddress } = req.query;

    try {
      const chainKey = chain as ChainKey;
      const chainConfig = CHAIN_CONFIGS[chainKey];
      
      if (!chainConfig || !('chainId' in chainConfig)) {
        return res.status(400).json({
          success: false,
          error: `Invalid or unsupported chain: ${chain}`
        });
      }

      const ethPrivateKey = req.user?.cachedKeys?.ethPrivateKey;
      if (!ethPrivateKey) {
        return res.status(401).json({
          success: false,
          error: 'Wallet not found in session'
        });
      }

      const wallet = getEVMWallet(ethPrivateKey, chainKey);

      if (tokenAddress) {
        // Get token balance
        const tokenContract = new ethers.Contract(tokenAddress as string, ERC20_ABI, wallet);
        const [balance, symbol, decimals] = await Promise.all([
          tokenContract.balanceOf(wallet.address),
          tokenContract.symbol(),
          tokenContract.decimals()
        ]);

        const formattedBalance = ethers.formatUnits(balance, decimals);

        return res.json({
          success: true,
          chain: chainConfig.name,
          address: wallet.address,
          balance: formattedBalance,
          symbol,
          tokenAddress
        });
      } else {
        // Get native balance
        const provider = wallet.provider;
        if (!provider) {
          return res.status(500).json({
            success: false,
            error: 'Provider not available'
          });
        }
        
        const balance = await provider.getBalance(wallet.address);
        const formattedBalance = ethers.formatEther(balance);

        return res.json({
          success: true,
          chain: chainConfig.name,
          address: wallet.address,
          balance: formattedBalance,
          symbol: chainConfig.nativeToken
        });
      }

    } catch (error) {
      console.error(`❌ [${chain.toUpperCase()}] Balance error:`, error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch balance'
      });
    }
  });

  console.log('✅ Multi-chain payment routes registered successfully');
  console.log('   💸 Operations: send-native, send-token, balance');
  console.log('   ⟠ EVM chains: All 14 chains supported');
  console.log('   ✨ XRPL: Native XRP payments');
  console.log('   🟣 Solana: Native SOL payments');
}
