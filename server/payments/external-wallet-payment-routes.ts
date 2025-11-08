// External Wallet Payment Routes - Unsigned Transaction Preparation for All Chains
// Works with Xaman, Joey, MetaMask, Phantom - client-side signing

import { Express } from 'express';
import { ethers } from 'ethers';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Client as XRPLClient, Payment, xrpToDrops, convertStringToHex } from 'xrpl';
import { CHAIN_CONFIGS, type ChainKey } from '../bridge/multi-chain-bridge-routes';
import { dualWalletAuth } from '../middleware/dual-wallet-auth';

const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)'
];

function getEVMProvider(chainKey: ChainKey) {
  const chainConfig = CHAIN_CONFIGS[chainKey];
  if (!('chainId' in chainConfig)) {
    throw new Error(`${chainKey} is not an EVM chain`);
  }
  return new ethers.JsonRpcProvider(chainConfig.rpcUrl);
}

export function registerExternalWalletPaymentRoutes(app: Express) {
  console.log('💰 Registering external wallet payment routes...');

  // ==================================================
  // EVM CHAINS - PREPARE NATIVE TOKEN SEND (unsigned)
  // ==================================================
  app.post("/api/external/payment/:chain/prepare-native", dualWalletAuth, async (req, res) => {
    const { chain } = req.params;
    const { walletAddress, toAddress, amount } = req.body;

    try {
      const chainKey = chain as ChainKey;
      const chainConfig = CHAIN_CONFIGS[chainKey];
      
      if (!chainConfig || !('chainId' in chainConfig)) {
        return res.status(400).json({
          success: false,
          error: `Invalid or unsupported chain: ${chain}`
        });
      }

      const provider = getEVMProvider(chainKey);
      const nonce = await provider.getTransactionCount(walletAddress);
      const gasPrice = await provider.getFeeData();

      const unsignedTx = {
        to: toAddress,
        value: ethers.parseEther(amount.toString()).toString(),
        nonce,
        gasLimit: 21000,
        chainId: chainConfig.chainId,
        maxFeePerGas: gasPrice.maxFeePerGas?.toString(),
        maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas?.toString(),
        type: 2
      };

      console.log(`✅ [${chainKey.toUpperCase()}] Prepared native send for external wallet`);

      return res.json({
        success: true,
        transaction: unsignedTx,
        chain: chainConfig.name,
        amount,
        token: chainConfig.nativeToken,
        message: `Transaction prepared - sign with ${walletAddress.slice(0, 8)}...`
      });

    } catch (error) {
      console.error(`❌ [${chain.toUpperCase()}] Prepare native error:`, error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to prepare transaction'
      });
    }
  });

  // ==================================================
  // EVM CHAINS - PREPARE TOKEN SEND (unsigned ERC-20)
  // ==================================================
  app.post("/api/external/payment/:chain/prepare-token", dualWalletAuth, async (req, res) => {
    const { chain } = req.params;
    const { walletAddress, toAddress, amount, tokenAddress } = req.body;

    try {
      const chainKey = chain as ChainKey;
      const chainConfig = CHAIN_CONFIGS[chainKey];
      
      if (!chainConfig || !('chainId' in chainConfig)) {
        return res.status(400).json({
          success: false,
          error: `Invalid or unsupported chain: ${chain}`
        });
      }

      const provider = getEVMProvider(chainKey);
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

      const [decimals, nonce, gasPrice] = await Promise.all([
        tokenContract.decimals(),
        provider.getTransactionCount(walletAddress),
        provider.getFeeData()
      ]);

      const tokenAmount = ethers.parseUnits(amount.toString(), decimals);
      const iface = new ethers.Interface(ERC20_ABI);
      const data = iface.encodeFunctionData('transfer', [toAddress, tokenAmount]);

      const unsignedTx = {
        to: tokenAddress,
        data,
        nonce,
        chainId: chainConfig.chainId,
        maxFeePerGas: gasPrice.maxFeePerGas?.toString(),
        maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas?.toString(),
        gasLimit: 100000,
        type: 2
      };

      console.log(`✅ [${chainKey.toUpperCase()}] Prepared token send for external wallet`);

      return res.json({
        success: true,
        transaction: unsignedTx,
        chain: chainConfig.name,
        amount,
        tokenAddress,
        message: `Token transfer prepared - sign with ${walletAddress.slice(0, 8)}...`
      });

    } catch (error) {
      console.error(`❌ [${chain.toUpperCase()}] Prepare token error:`, error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to prepare token transfer'
      });
    }
  });

  // ==================================================
  // XRPL - PREPARE PAYMENT (unsigned)
  // ==================================================
  app.post("/api/external/payment/xrpl/prepare", dualWalletAuth, async (req, res) => {
    const { walletAddress, toAddress, amount, currency, issuer, destinationTag, memo } = req.body;

    let client: XRPLClient | null = null;
    
    try {
      client = new XRPLClient(CHAIN_CONFIGS.xrpl.rpcUrl);
      await client.connect();

      let txJson: any = {
        TransactionType: 'Payment',
        Account: walletAddress,
        Destination: toAddress
      };

      if (!currency || currency === 'XRP') {
        txJson.Amount = xrpToDrops(amount);
      } else {
        if (!issuer) throw new Error('Issuer required for token payments');
        txJson.Amount = {
          currency,
          value: amount,
          issuer
        };
      }

      if (destinationTag !== undefined) txJson.DestinationTag = destinationTag;
      
      if (memo) {
        txJson.Memos = [{
          Memo: {
            MemoType: convertStringToHex('text'),
            MemoData: convertStringToHex(memo)
          }
        }];
      }

      const preparedTx = await client.autofill(txJson);
      await client.disconnect();

      console.log('✅ [XRPL] Prepared payment for external wallet');

      return res.json({
        success: true,
        transaction: preparedTx,
        amount,
        currency: currency || 'XRP',
        message: 'XRPL payment prepared - sign with your wallet'
      });

    } catch (error) {
      console.error('❌ [XRPL] Prepare payment error:', error);
      if (client) await client.disconnect();
      
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to prepare XRPL payment'
      });
    }
  });

  // ==================================================
  // SOLANA - PREPARE PAYMENT (unsigned)
  // ==================================================
  app.post("/api/external/payment/solana/prepare", dualWalletAuth, async (req, res) => {
    const { walletAddress, toAddress, amount } = req.body;

    try {
      const connection = new Connection(CHAIN_CONFIGS.solana.rpcUrl);
      const fromPubkey = new PublicKey(walletAddress);
      const toPubkey = new PublicKey(toAddress);

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports: Math.floor(parseFloat(amount) * LAMPORTS_PER_SOL)
        })
      );

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromPubkey;

      console.log('✅ [SOLANA] Prepared payment for external wallet');

      return res.json({
        success: true,
        transaction: {
          serialized: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
          blockhash,
          lastValidBlockHeight
        },
        amount,
        message: 'Solana payment prepared - sign with Phantom/Solflare'
      });

    } catch (error) {
      console.error('❌ [SOLANA] Prepare payment error:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to prepare Solana payment'
      });
    }
  });

  console.log('✅ External wallet payment routes registered successfully');
  console.log('   📊 Supported: Native + Token sends for all chains');
  console.log('   🔐 Mode: Unsigned transaction preparation (client-side signing)');
}
