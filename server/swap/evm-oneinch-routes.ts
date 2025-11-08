// EVM Swap Routes - 1inch API ONLY (Production Ready)
// Uses cached session keys - NO PASSWORD NEEDED
import { Router } from 'express';
import { ethers } from 'ethers';
import { sessionAuth } from '../middleware/session-auth';
import {
  SUPPORTED_CHAINS,
  getOneInchQuote,
  getOneInchSwap,
  getOneInchSpender,
  getOneInchAllowance,
  getOneInchTokens,
  type SupportedChain
} from './oneinch-unified-service';

const router = Router();

// RPC endpoints for transaction submission
const RPC_ENDPOINTS: Record<number, string> = {
  1: process.env.ETH_RPC_URL || 'https://eth.llamarpc.com',
  56: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org',
  137: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
  42161: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
  10: process.env.OPTIMISM_RPC_URL || 'https://mainnet.optimism.io',
  8453: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
  43114: process.env.AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc',
  100: process.env.GNOSIS_RPC_URL || 'https://rpc.gnosischain.com',
  250: process.env.FANTOM_RPC_URL || 'https://rpc.ftm.tools',
  324: process.env.ZKSYNC_RPC_URL || 'https://mainnet.era.zksync.io'
};

// Platform fee wallet - collects 0.25% on all swaps (OPTIONAL - only if env var set)
const PLATFORM_FEE_WALLET = process.env.PLATFORM_FEE_WALLET || '';
const PLATFORM_FEE_BPS = 25; // 0.25% in basis points

/**
 * GET /api/swap/evm/quote
 * Get swap quote from 1inch aggregator
 * Uses session authentication with cached keys
 */
router.get('/quote', sessionAuth, async (req, res) => {
  try {
    const {
      chainId,
      fromToken,
      toToken,
      amount,
      slippage = '1'
    } = req.query;

    // Validate required parameters
    if (!chainId || !fromToken || !toToken || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: chainId, fromToken, toToken, amount'
      });
    }

    // Get wallet address from session
    const session = (req as any).session;
    if (!session?.walletData?.walletAddresses?.eth) {
      return res.status(401).json({
        success: false,
        error: 'No Ethereum wallet found in session'
      });
    }

    const walletAddress = session.walletData.walletAddresses.eth;
    const chainIdNum = parseInt(chainId as string);

    console.log(`📊 [1INCH QUOTE] Chain: ${chainIdNum}, ${fromToken} → ${toToken}, Amount: ${amount}`);

    // Get quote from 1inch
    const quote = await getOneInchQuote(
      chainIdNum as SupportedChain,
      fromToken as string,
      toToken as string,
      amount as string,
      walletAddress,
      parseFloat(slippage as string)
    );

    res.json({
      success: true,
      quote: {
        fromToken: quote.srcToken,
        toToken: quote.dstToken,
        fromAmount: quote.srcAmount,
        toAmount: quote.dstAmount,
        estimatedGas: quote.gas,
        protocols: quote.protocols,
        chainId: chainIdNum
      }
    });

  } catch (error) {
    console.error('❌ [1INCH QUOTE] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get quote'
    });
  }
});

/**
 * POST /api/swap/evm/execute
 * Execute EVM swap using 1inch + cached session keys
 * NO PASSWORD NEEDED - uses cached private key from session
 */
router.post('/execute', sessionAuth, async (req, res) => {
  try {
    const {
      chainId,
      fromToken,
      toToken,
      amount,
      slippage = 1
    } = req.body;

    // Validate parameters
    if (!chainId || !fromToken || !toToken || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }

    // Get cached private key from session
    const session = (req as any).session;
    const cachedPrivateKey = session?.ethPrivateKey;
    
    if (!cachedPrivateKey) {
      return res.status(401).json({
        success: false,
        error: 'No cached Ethereum private key in session. Please login again.'
      });
    }

    console.log(`🔐 [1INCH SWAP] Using cached ETH private key from session`);

    // Setup provider and wallet
    const rpcUrl = RPC_ENDPOINTS[chainId];
    if (!rpcUrl) {
      return res.status(400).json({
        success: false,
        error: `Unsupported chain ID: ${chainId}`
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(cachedPrivateKey, provider);
    const walletAddress = wallet.address;

    console.log(`💱 [1INCH SWAP] Executing swap on chain ${chainId} for ${walletAddress}`);
    console.log(`📊 [1INCH SWAP] ${fromToken} → ${toToken}, Amount: ${amount}`);

    // Step 1: Check if token needs approval (skip for native token)
    const isNativeToken = fromToken.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    
    if (!isNativeToken) {
      console.log(`🔍 [1INCH SWAP] Checking token allowance...`);
      
      const allowance = await getOneInchAllowance(
        chainId as SupportedChain,
        fromToken,
        walletAddress
      );

      if (BigInt(allowance) < BigInt(amount)) {
        console.log(`⚠️ [1INCH SWAP] Insufficient allowance. Please approve token first.`);
        
        // Get spender address
        const spender = await getOneInchSpender(chainId as SupportedChain);
        
        return res.status(400).json({
          success: false,
          error: 'Token approval required',
          needsApproval: true,
          spender,
          currentAllowance: allowance,
          requiredAmount: amount
        });
      }

      console.log(`✅ [1INCH SWAP] Token allowance sufficient`);
    }

    // Step 2: Get swap transaction data from 1inch (with optional platform fee)
    const swapData = await getOneInchSwap(
      chainId as SupportedChain,
      fromToken,
      toToken,
      amount,
      walletAddress,
      slippage,
      PLATFORM_FEE_WALLET || undefined, // Only pass if configured
      PLATFORM_FEE_WALLET ? PLATFORM_FEE_BPS : undefined // Only pass if wallet is set
    );

    console.log(`📝 [1INCH SWAP] Got swap transaction data`);
    console.log(`💰 [1INCH SWAP] Expected output: ${swapData.dstAmount} ${swapData.dstToken.symbol}`);

    // Step 3: Execute swap transaction
    const tx = {
      to: swapData.tx.to,
      data: swapData.tx.data,
      value: swapData.tx.value,
      gasLimit: swapData.tx.gas,
      gasPrice: swapData.tx.gasPrice
    };

    console.log(`🚀 [1INCH SWAP] Submitting transaction...`);
    const txResponse = await wallet.sendTransaction(tx);
    
    console.log(`⏳ [1INCH SWAP] TX submitted: ${txResponse.hash}`);
    console.log(`⏳ [1INCH SWAP] Waiting for confirmation...`);

    // Wait for confirmation
    const receipt = await txResponse.wait();

    if (receipt?.status === 1) {
      console.log(`✅ [1INCH SWAP] Swap successful! TX: ${receipt.hash}`);
      
      res.json({
        success: true,
        txHash: receipt.hash,
        fromToken: swapData.srcToken,
        toToken: swapData.dstToken,
        fromAmount: swapData.srcAmount,
        toAmount: swapData.dstAmount,
        chainId,
        explorerUrl: getExplorerUrl(chainId, receipt.hash)
      });
    } else {
      console.error(`❌ [1INCH SWAP] Transaction failed`);
      throw new Error('Transaction failed');
    }

  } catch (error) {
    console.error('❌ [1INCH SWAP] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Swap execution failed'
    });
  }
});

/**
 * POST /api/swap/evm/approve
 * Approve token for 1inch router
 * Uses cached session keys
 */
router.post('/approve', sessionAuth, async (req, res) => {
  try {
    const { chainId, tokenAddress, amount } = req.body;

    if (!chainId || !tokenAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: chainId, tokenAddress'
      });
    }

    // Get cached private key
    const session = (req as any).session;
    const cachedPrivateKey = session?.ethPrivateKey;
    
    if (!cachedPrivateKey) {
      return res.status(401).json({
        success: false,
        error: 'No cached private key. Please login again.'
      });
    }

    const rpcUrl = RPC_ENDPOINTS[chainId];
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(cachedPrivateKey, provider);

    // Get spender address
    const spender = await getOneInchSpender(chainId as SupportedChain);

    // Create ERC20 contract
    const tokenContract = new ethers.Contract(
      tokenAddress,
      ['function approve(address spender, uint256 amount) returns (bool)'],
      wallet
    );

    console.log(`✍️ [1INCH APPROVE] Approving ${tokenAddress} for ${spender}`);

    // Approve max amount if not specified
    const approveAmount = amount || ethers.MaxUint256;
    const tx = await tokenContract.approve(spender, approveAmount);
    
    console.log(`⏳ [1INCH APPROVE] TX submitted: ${tx.hash}`);
    const receipt = await tx.wait();

    if (receipt?.status === 1) {
      console.log(`✅ [1INCH APPROVE] Approval successful!`);
      
      res.json({
        success: true,
        txHash: receipt.hash,
        spender,
        amount: approveAmount.toString()
      });
    } else {
      throw new Error('Approval failed');
    }

  } catch (error) {
    console.error('❌ [1INCH APPROVE] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Approval failed'
    });
  }
});

/**
 * GET /api/swap/evm/tokens/:chainId
 * Get available tokens for a chain from 1inch
 */
router.get('/tokens/:chainId', async (req, res) => {
  try {
    const { chainId } = req.params;
    const chainIdNum = parseInt(chainId);

    console.log(`📋 [1INCH TOKENS] Fetching tokens for chain ${chainIdNum}`);

    const tokens = await getOneInchTokens(chainIdNum as SupportedChain);
    
    res.json({
      success: true,
      chainId: chainIdNum,
      tokens,
      count: Object.keys(tokens).length
    });

  } catch (error) {
    console.error('❌ [1INCH TOKENS] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch tokens'
    });
  }
});

/**
 * GET /api/swap/evm/supported-chains
 * Get list of supported EVM chains
 */
router.get('/supported-chains', (req, res) => {
  const evmChains = Object.entries(SUPPORTED_CHAINS)
    .filter(([_, id]) => typeof id === 'number')
    .map(([name, id]) => ({ name, chainId: id }));

  res.json({
    success: true,
    chains: evmChains,
    count: evmChains.length
  });
});

/**
 * Helper: Get blockchain explorer URL
 */
function getExplorerUrl(chainId: number, txHash: string): string {
  const explorers: Record<number, string> = {
    1: 'https://etherscan.io/tx/',
    56: 'https://bscscan.com/tx/',
    137: 'https://polygonscan.com/tx/',
    42161: 'https://arbiscan.io/tx/',
    10: 'https://optimistic.etherscan.io/tx/',
    8453: 'https://basescan.org/tx/',
    43114: 'https://snowtrace.io/tx/',
    100: 'https://gnosisscan.io/tx/',
    250: 'https://ftmscan.com/tx/',
    324: 'https://explorer.zksync.io/tx/'
  };

  return (explorers[chainId] || 'https://etherscan.io/tx/') + txHash;
}

export default router;
