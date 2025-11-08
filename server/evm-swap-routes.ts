// EVM Swap Routes - Uniswap V3 Integration with Atomic Fee Collection
import { Router } from 'express';
import { ethers, JsonRpcProvider, formatUnits, parseUnits, MaxUint256, getAddress } from 'ethers';
import fetch from 'node-fetch';
import { generateRTN } from './utils/rtn-generator';
import { storage } from './storage';
import type { InsertRiddleTransaction } from '../shared/schema';
import { sessionAuth } from './middleware/session-auth';

// Interface for fee collection response
interface FeeCollectionResponse {
  swapFeeAmount: string;
  swapFeeUsd: string;
  success?: boolean;
  [key: string]: any;
}

// Cross-chain fee collection for EVM swaps
async function collectEvmSwapFee({
  swapAmount,
  swapToken,
  chainId,
  sourceTransactionHash,
  sourceWallet,
  swapUsdValue
}: {
  swapAmount: string;
  swapToken: string;
  chainId: number;
  sourceTransactionHash: string;
  sourceWallet: string;
  swapUsdValue?: string;
}) {
  try {
    // Determine fee token based on chain
    const chainNames = {
      1: 'ETH',
      56: 'BNB', 
      137: 'MATIC',
      42161: 'ETH',
      10: 'ETH',
      8453: 'ETH'
    };
    
    const feeToken = chainNames[chainId as keyof typeof chainNames] || 'ETH';
    
    console.log(`💰 [EVM FEE] Collecting fee for ${swapAmount} ${swapToken} on chain ${chainId}`);
    
    // Call the swap fee collection endpoint with chain-specific token
    const response = await fetch('http://localhost:5000/api/launchpad/collect-swap-fee', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        launchId: 1, // Default launch ID for EVM swap fees
        swapAmount,
        swapToken: feeToken, // Use chain native token for fees
        sourceTransactionHash,
        sourceWallet,
        swapUsdValue
      })
    });
    
    if (response.ok) {
      const result = await response.json() as FeeCollectionResponse;
      console.log(`✅ [EVM FEE] Collected ${result.swapFeeAmount} ${feeToken} (${result.swapFeeUsd} USD)`);
      return result;
    } else {
      console.error('❌ [EVM FEE] Failed to collect swap fee:', await response.text());
    }
  } catch (error) {
    console.error('❌ [EVM FEE] Error collecting swap fee:', error);
  }
  return null;
}

const router = Router();

// Test endpoint to fetch all available tokens for EVM testing
router.get('/all-test-tokens', async (req, res) => {
  try {
    const { chainId, allChains } = req.query;
    
    // If allChains is requested, fetch from all supported chains
    if (allChains === 'true') {
      console.log(`🧪 [TEST] Fetching ALL tokens from ALL CHAINS for comprehensive testing`);
      
      const allChainsTokens: any = {};
      const chainIds = Object.keys(SUPPORTED_CHAINS).map(name => SUPPORTED_CHAINS[name as keyof typeof SUPPORTED_CHAINS]);
      
      // PRODUCTION: Use ONLY verified COMMON_TOKENS for each chain
      for (const chain of chainIds) {
        try {
          console.log(`🚀 [PRODUCTION] Loading verified tokens for chain ${chain}`);
          
          const tokens: any[] = [];
          const commonTokens = COMMON_TOKENS[chain as keyof typeof COMMON_TOKENS] || {};
          
          // Use ONLY production-ready common tokens with verified addresses and decimals
          Object.entries(commonTokens).forEach(([symbol, tokenData]: [string, any]) => {
            tokens.push({
              symbol,
              name: symbol,
              address: tokenData.address,
              decimals: tokenData.decimals,
              price: '0',
              liquidity: 0,
              volume24h: 0,
              logo: null,
              chainId: chain
            });
          });
          
          allChainsTokens[chain] = tokens;
          console.log(`✅ [PRODUCTION] Loaded ${tokens.length} verified tokens for chain ${chain}`);
        } catch (error) {
          console.error(`❌ [PRODUCTION] Error loading tokens for chain ${chain}:`, error);
          allChainsTokens[chain] = [];
        }
      }
      
      // Calculate total
      const totalTokens = Object.values(allChainsTokens as any).reduce((sum: number, tokens: any) => sum + (tokens as any[]).length, 0);
      
      res.json({
        success: true,
        message: `ALL ${totalTokens} tokens from ALL chains fetched for testing - NO LIMITS`,
        totalTokens,
        chainCount: Object.keys(allChainsTokens).length,
        tokensByChain: allChainsTokens,
        supportedChains: SUPPORTED_CHAINS
      });
      
    } else {
      // PRODUCTION: Use ONLY verified tokens for specific chain
      const targetChain = Number(chainId) || 1;
      console.log(`🚀 [PRODUCTION] Loading verified tokens for chain ${targetChain}`);
      
      const tokens: any[] = [];
      const commonTokens = COMMON_TOKENS[targetChain as keyof typeof COMMON_TOKENS] || {};
      
      // Use ONLY production-ready common tokens with verified addresses and decimals
      Object.entries(commonTokens).forEach(([symbol, tokenData]: [string, any]) => {
        tokens.push({
          symbol,
          name: symbol,
          address: tokenData.address,
          decimals: tokenData.decimals,
          price: '0',
          liquidity: 0,
          volume24h: 0,
          priceChange24h: 0,
          logo: null,
          chainId: targetChain
        });
      });
      
      console.log(`✅ [PRODUCTION] Loaded ${tokens.length} verified tokens for chain ${targetChain}`);
      
      res.json({
        success: true,
        chainId: targetChain,
        tokenCount: tokens.length,
        tokens,
        message: `${tokens.length} verified production tokens loaded for chain ${targetChain}`
      });
    }
    
  } catch (error) {
    console.error('❌ [TEST] Error fetching test tokens:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch test tokens'
    });
  }
});

// RiddleSwap fee wallet address (receives 1% fee automatically)
const FEE_RECIPIENT = '0x742d35Cc6634C0532925a3b8D33DD96e11811fb2'; // RiddleSwap treasury (bank wallet)
const FEE_BASIS_POINTS = 100; // 1% PLATFORM FEE

// Uniswap V3 configuration
const UNISWAP_V3_ROUTER = '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45'; // SwapRouter02
const UNISWAP_QUOTER = '0x61fFE014bA17989E743c5F6cB21bF9697530B21e';

const SUPPORTED_CHAINS = {
  ethereum: 1,
  bsc: 56,
  polygon: 137,
  arbitrum: 42161,
  optimism: 10,
  base: 8453
};

// Production-ready token metadata for ALL supported EVM chains with CORRECT decimals
const COMMON_TOKENS = {
  1: { // Ethereum Mainnet
    ETH: { address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', decimals: 18 },
    WETH: { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 },
    USDC: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
    USDT: { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
    DAI: { address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18 },
    WBTC: { address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8 }
  },
  56: { // BSC (Binance Smart Chain)
    BNB: { address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', decimals: 18 },
    WBNB: { address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', decimals: 18 },
    USDT: { address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18 },
    BUSD: { address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', decimals: 18 },
    USDC: { address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18 },
    BTCB: { address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', decimals: 18 }
  },
  137: { // Polygon
    MATIC: { address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', decimals: 18 },
    WMATIC: { address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', decimals: 18 },
    USDC: { address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', decimals: 6 },
    USDT: { address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6 },
    DAI: { address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', decimals: 18 },
    WETH: { address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', decimals: 18 }
  },
  42161: { // Arbitrum
    ETH: { address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', decimals: 18 },
    WETH: { address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', decimals: 18 },
    USDC: { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6 },
    USDT: { address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', decimals: 6 },
    DAI: { address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', decimals: 18 },
    ARB: { address: '0x912CE59144191C1204E64559FE8253a0e49E6548', decimals: 18 }
  },
  10: { // Optimism
    ETH: { address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', decimals: 18 },
    WETH: { address: '0x4200000000000000000000000000000000000006', decimals: 18 },
    USDC: { address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', decimals: 6 },
    USDT: { address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', decimals: 6 },
    DAI: { address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', decimals: 18 },
    OP: { address: '0x4200000000000000000000000000000000000042', decimals: 18 }
  },
  8453: { // Base
    ETH: { address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', decimals: 18 },
    WETH: { address: '0x4200000000000000000000000000000000000006', decimals: 18 },
    USDC: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
    USDbC: { address: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA', decimals: 6 },
    DAI: { address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', decimals: 18 }
  }
};

interface UniswapQuoteResponse {
  amountOut: string;
  gasEstimate: string;
  sqrtPriceX96After: string;
  initializedTicksCrossed: number;
  route: any[];
}

interface SwapParams {
  tokenIn: string;
  tokenOut: string;
  fee: number;
  recipient: string;
  deadline: number;
  amountIn: string;
  amountOutMinimum: string;
  sqrtPriceLimitX96: string;
}

// Get price information for token pair - CRITICAL MISSING ENDPOINT
router.get('/swap/price', async (req, res) => {
  try {
    const { fromToken, toToken, chainId = 1 } = req.query;
    
    console.log(`💰 Getting price for ${fromToken} -> ${toToken} on chain ${chainId}`);
    
    if (!fromToken || !toToken) {
      return res.status(400).json({
        success: false,
        error: 'fromToken and toToken are required'
      });
    }
    
    // Mock price response - replace with actual price API in production
    const mockPrice = {
      fromToken: fromToken as string,
      toToken: toToken as string,
      price: "0.001", // Example conversion rate
      priceUsd: "2.50", // Example USD price
      chainId: parseInt(chainId as string),
      lastUpdated: new Date().toISOString()
    };
    
    res.json({
      success: true,
      price: mockPrice
    });
    
  } catch (error) {
    console.error('❌ [SWAP PRICE] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Price fetch failed'
    });
  }
});

// Get available tokens for swapping - CRITICAL MISSING ENDPOINT
router.get('/swap/tokens', async (req, res) => {
  try {
    const { chainId = 1 } = req.query;
    
    console.log(`🪙 Getting available tokens for chain ${chainId}`);
    
    // Return common tokens for the specified chain
    const chainTokens = COMMON_TOKENS[parseInt(chainId as string) as keyof typeof COMMON_TOKENS] || COMMON_TOKENS[1];
    
    const tokens = Object.entries(chainTokens).map(([symbol, address]) => ({
      symbol,
      address,
      name: symbol === 'WETH' ? 'Wrapped Ether' : symbol,
      decimals: 18,
      chainId: parseInt(chainId as string)
    }));
    
    res.json({
      success: true,
      tokens: tokens,
      chainId: parseInt(chainId as string)
    });
    
  } catch (error) {
    console.error('❌ [SWAP TOKENS] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch available tokens'
    });
  }
});

// Get swap quote from Uniswap V3 with fee calculation
router.post('/swap/quote', async (req, res) => {
  try {
    const {
      fromTokenAddress,
      toTokenAddress,
      amount,
      fromAddress,
      slippage = 1,
      chainId = 1
    } = req.body;

    console.log(`🦄 Getting Uniswap V3 quote for ${amount} tokens on chain ${chainId}`);

    if (!fromTokenAddress || !toTokenAddress || !amount || !fromAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }

    // Get quote from Uniswap V3 Quoter
    const provider = getProviderForChain(chainId);
    const quoterContract = new ethers.Contract(
      UNISWAP_QUOTER,
      [
        'function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)'
      ],
      provider
    );

    try {
      // Try different fee tiers (0.3%, 0.05%, 1%)
      const feeTiers = [3000, 500, 10000];
      let bestQuote = null;
      let bestFee = 3000;

      for (const fee of feeTiers) {
        try {
          const [amountOut, sqrtPriceX96After, initializedTicksCrossed, gasEstimate] = 
            await quoterContract.quoteExactInputSingle(
              fromTokenAddress,
              toTokenAddress,
              fee,
              amount,
              0 // No price limit
            );

          if (!bestQuote || amountOut.gt(bestQuote.amountOut)) {
            bestQuote = {
              amountOut,
              sqrtPriceX96After,
              initializedTicksCrossed,
              gasEstimate
            };
            bestFee = fee;
          }
        } catch (e) {
          // Pool doesn't exist for this fee tier, continue
          continue;
        }
      }

      if (!bestQuote) {
        return res.status(400).json({
          success: false,
          error: 'No liquidity pool found for this token pair'
        });
      }

      // Calculate fee (1% of output amount)
      const outputAmount = bestQuote.amountOut.toString();
      const feeAmount = (BigInt(outputAmount) * BigInt(FEE_BASIS_POINTS)) / BigInt(10000);
      const amountAfterFee = BigInt(outputAmount) - feeAmount;

      // Calculate price impact
      const inputValue = parseFloat(formatUnits(amount, 18));
      const outputValue = parseFloat(formatUnits(outputAmount, 18));
      const priceImpact = Math.abs((inputValue - outputValue) / inputValue) * 100;

      // Format quote response
      const quote = {
        fromToken: { address: fromTokenAddress },
        toToken: { address: toTokenAddress },
        fromAmount: amount,
        toAmount: outputAmount,
        toAmountAfterFee: amountAfterFee.toString(),
        feeAmount: feeAmount.toString(),
        feeRecipient: FEE_RECIPIENT,
        feeBasisPoints: FEE_BASIS_POINTS,
        estimatedGas: bestQuote.gasEstimate.toString(),
        priceImpact: priceImpact,
        slippage: slippage,
        poolFee: bestFee,
        route: [fromTokenAddress, toTokenAddress],
        dex: 'Uniswap V3',
        minimumReceived: (amountAfterFee * BigInt(10000 - slippage * 100) / BigInt(10000)).toString()
      };

      console.log(`✅ Uniswap V3 quote success: ${outputAmount} output, ${feeAmount.toString()} fee`);

      res.json({
        success: true,
        quote: quote,
        swapParams: {
          tokenIn: fromTokenAddress,
          tokenOut: toTokenAddress,
          fee: bestFee,
          recipient: fromAddress,
          amountIn: amount,
          amountOutMinimum: quote.minimumReceived,
          sqrtPriceLimitX96: 0
        }
      });

    } catch (contractError) {
      console.error('Uniswap contract error:', contractError);
      return res.status(400).json({
        success: false,
        error: 'Failed to get Uniswap quote - pool may not exist'
      });
    }

  } catch (error) {
    console.error('EVM swap quote error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get swap quote'
    });
  }
});

// Execute swap using 1inch API with built-in fee injection
router.post('/swap/execute', sessionAuth, async (req, res) => {
  // Generate RTN outside try block for error handling access
  const rtn = generateRTN();
  
  try {
    const {
      fromTokenAddress,
      toTokenAddress,
      amount,
      slippage = 1,
      chainId = 1,
      userHandle, // Required for transaction tracking
      fromTokenSymbol,
      toTokenSymbol
    } = req.body;

    const user = (req as any).user;

    console.log(`🔄 [RTN:${rtn}] Executing swap via 1inch API with atomic 0.25% fee collection`);

    if (!fromTokenAddress || !toTokenAddress || !amount || !userHandle) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters (including userHandle for transaction tracking)',
        rtn
      });
    }

    // Get ETH private key from sessionAuth cached keys
    const ethPrivateKey = user?.cachedKeys?.ethPrivateKey;
    if (!ethPrivateKey) {
      console.error('❌ [EVM SWAP] No ETH private key in cached keys');
      console.error('📝 [EVM SWAP] Available cached keys:', Object.keys(user?.cachedKeys || {}));
      console.error('📝 [EVM SWAP] User session:', { handle: userHandle, hasUser: !!user });
      return res.status(401).json({
        success: false,
        error: 'ETH wallet not found in session. Please login.',
        rtn
      });
    }
    console.log(`✅ [EVM SWAP] Private key retrieved from cachedKeys for user: ${userHandle}`);
    console.log(`✅ [EVM SWAP] ETH wallet ready for chain ${chainId}`);

    const provider = getProviderForChain(chainId);
    const wallet = new ethers.Wallet(ethPrivateKey, provider);
    console.log(`✅ [EVM SWAP] Wallet address: ${wallet.address}`);

    // 1inch API key
    const ONEINCH_API_KEY = process.env.ONEINCH_API_KEY;
    if (!ONEINCH_API_KEY) {
      return res.status(500).json({
        success: false,
        error: '1inch API key not configured',
        rtn
      });
    }

    // Create initial RTN transaction record
    const initialTransaction: InsertRiddleTransaction = {
      rtn,
      user_handle: userHandle,
      source_wallet: wallet.address,
      type: '1inch_swap',
      chain: `evm_${chainId}`,
      status: 'pending',
      broker_wallet: FEE_RECIPIENT // RiddleSwap treasury wallet
    };

    try {
      await storage.createRiddleTransaction(initialTransaction);
      console.log(`✅ [RTN:${rtn}] Initial transaction record created (1inch swap with fee injection)`);
    } catch (error) {
      console.error(`❌ [RTN:${rtn}] Failed to create transaction record:`, error);
      // Continue anyway - transaction tracking is secondary to swap execution
    }

    // Get swap data from 1inch API with fee injection
    const oneInchSwapUrl = `https://api.1inch.dev/swap/v6.0/${chainId}/swap`;
    const swapParams = new URLSearchParams({
      src: fromTokenAddress,
      dst: toTokenAddress,
      amount: amount.toString(),
      from: wallet.address,
      slippage: slippage.toString(),
      referrer: FEE_RECIPIENT, // RiddleSwap treasury wallet
      fee: FEE_BASIS_POINTS.toString(), // 1% PLATFORM FEE = 100 basis points
      disableEstimate: 'true', // Skip gas estimation
      allowPartialFill: 'false'
    });

    console.log(`🔗 [RTN:${rtn}] Calling 1inch API: ${oneInchSwapUrl}?${swapParams.toString()}`);

    const swapResponse = await fetch(`${oneInchSwapUrl}?${swapParams.toString()}`, {
      headers: {
        'Authorization': `Bearer ${ONEINCH_API_KEY}`,
        'accept': 'application/json'
      }
    });

    if (!swapResponse.ok) {
      const errorText = await swapResponse.text();
      console.error(`❌ [RTN:${rtn}] 1inch API error:`, errorText);
      
      await storage.updateRiddleTransactionStatus(rtn, 'failed', undefined, `1inch API error: ${errorText}`);
      
      return res.status(400).json({
        success: false,
        error: `1inch swap failed: ${errorText}`,
        rtn
      });
    }

    const swapData: any = await swapResponse.json();
    console.log(`✅ [RTN:${rtn}] 1inch swap data received. Destination amount: ${swapData.dstAmount}`);

    // Update RTN with calculated amounts and broker status
    await storage.updateRiddleTransactionBrokerStatus(rtn, 'calculating', FEE_RECIPIENT);
    await storage.updateRiddleTransactionStatus(rtn, 'processing', undefined, undefined);
    console.log(`✅ [RTN:${rtn}] Updated with calculated amounts - executing 1inch swap with fee`);

    // Send the transaction (1inch API returns ready-to-sign transaction)
    const tx = await wallet.sendTransaction({
      to: swapData.tx.to,
      data: swapData.tx.data,
      value: swapData.tx.value,
      gasLimit: swapData.tx.gas || 300000,
      gasPrice: swapData.tx.gasPrice
    });

    // Update RTN with transaction hash and broker status
    await storage.updateRiddleTransactionStatus(rtn, 'processing', tx.hash, undefined);
    await storage.updateRiddleTransactionBrokerStatus(rtn, 'processing', FEE_RECIPIENT);
    console.log(`✅ [RTN:${rtn}] 1inch swap + fee transaction submitted: ${tx.hash}`);

    // Wait for confirmation
    const receipt = await tx.wait();
    if (!receipt) {
      throw new Error('Transaction receipt is null');
    }
    console.log(`✅ [RTN:${rtn}] Swap confirmed in block ${receipt.blockNumber}`);

    // 1inch handles fee collection automatically via referrer parameter
    const dstAmountBN = ethers.getBigInt(swapData.dstAmount);
    const feeAmount = (dstAmountBN * BigInt(FEE_BASIS_POINTS)) / BigInt(10000);

    // Update RTN with successful completion
    await storage.updateRiddleTransactionStatus(rtn, 'completed', tx.hash, undefined);
    await storage.updateRiddleTransactionBrokerStatus(rtn, 'completed', FEE_RECIPIENT);
    console.log(`✅ [RTN:${rtn}] 1inch swap completed with automatic fee injection to ${FEE_RECIPIENT}`);

    res.json({
      success: true,
      rtn,
      transactionHash: tx.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      outputAmount: swapData.dstAmount,
      feeAmount: feeAmount.toString(),
      amountAfterFee: (dstAmountBN - feeAmount).toString(),
      explorerUrl: getExplorerUrl(chainId, tx.hash),
      message: 'Swap executed successfully via 1inch with automatic 0.25% fee collection'
    });

  } catch (error) {
    // Update RTN with failure
    try {
      await storage.updateRiddleTransactionStatus(rtn, 'failed', undefined, error instanceof Error ? error.message : 'Failed to execute swap');
      await storage.updateRiddleTransactionBrokerStatus(rtn, 'failed', FEE_RECIPIENT);
      console.error(`❌ [RTN:${rtn}] Swap execution error:`, error);
    } catch (rtnError) {
      console.error(`❌ [RTN:${rtn}] Failed to update RTN with error status:`, rtnError);
    }
    
    res.status(500).json({
      success: false,
      rtn,
      error: error instanceof Error ? error.message : 'Failed to execute swap'
    });
  }
});

// Get supported tokens for a chain (common tokens) - Returns ARRAY format for token selectors
router.get('/tokens/:chainId', async (req, res) => {
  try {
    const { chainId } = req.params;
    const chainIdNum = parseInt(chainId);
    
    console.log(`📋 Fetching EVM tokens for chain ${chainId}`);

    // Return common tokens for the chain
    const tokensObj = COMMON_TOKENS[chainIdNum as keyof typeof COMMON_TOKENS] || COMMON_TOKENS[1];
    
    // Convert to array format with full token details (frontend expects array)
    const tokensArray = Object.entries(tokensObj).map(([symbol, data]) => ({
      symbol,
      name: symbol, // Use symbol as name for common tokens
      address: data.address,
      decimals: data.decimals,
      chainId: chainIdNum,
      verified: true, // All common tokens are verified
      logoURI: getTokenLogoUrl(symbol, chainIdNum), // Get standard token logo
      price_usd: 0, // Price will be fetched dynamically if needed
      balance: '0' // Balance will be fetched by frontend
    }));

    console.log(`✅ Loaded ${tokensArray.length} common EVM tokens (including native token)`);

    res.json({
      success: true,
      tokens: tokensArray, // ARRAY format for frontend compatibility
      count: tokensArray.length,
      chainId: chainIdNum
    });

  } catch (error) {
    console.error('EVM tokens fetch error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch tokens'
    });
  }
});

// Helper to get standard token logo URLs
function getTokenLogoUrl(symbol: string, chainId: number): string {
  // TrustWallet asset URLs for common tokens
  const trustWalletBase = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains';
  
  const chainMap: { [key: number]: string } = {
    1: 'ethereum',
    56: 'smartchain',
    137: 'polygon',
    42161: 'arbitrum',
    10: 'optimism',
    8453: 'base'
  };
  
  const chainName = chainMap[chainId] || 'ethereum';
  
  // Special cases for native tokens
  if (symbol === 'ETH' && chainId === 1) {
    return `${trustWalletBase}/ethereum/info/logo.png`;
  }
  if (symbol === 'BNB' && chainId === 56) {
    return `${trustWalletBase}/smartchain/info/logo.png`;
  }
  if (symbol === 'MATIC' && chainId === 137) {
    return `${trustWalletBase}/polygon/info/logo.png`;
  }
  
  // For other tokens, try to find by address
  const tokenData = COMMON_TOKENS[chainId as keyof typeof COMMON_TOKENS];
  if (tokenData && tokenData[symbol as keyof typeof tokenData]) {
    const address = tokenData[symbol as keyof typeof tokenData].address;
    // Skip native token address (0xEeee...)
    if (!address.toLowerCase().includes('eeeeee')) {
      return `${trustWalletBase}/${chainName}/assets/${address}/logo.png`;
    }
  }
  
  return `${trustWalletBase}/${chainName}/info/logo.png`;
}

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    // Test Ethereum mainnet connectivity
    const provider = getProviderForChain(1);
    const blockNumber = await provider.getBlockNumber();
    const isHealthy = blockNumber > 0;

    res.json({
      success: true,
      healthy: isHealthy,
      status: isHealthy ? 'operational' : 'degraded',
      currentBlock: blockNumber,
      dex: 'Uniswap V3',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      healthy: false,
      error: 'Uniswap health check failed'
    });
  }
});

// Helper functions
function getProviderForChain(chainId: number): JsonRpcProvider {
  const rpcUrls: { [key: number]: string } = {
    1: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com',
    8453: process.env.BASE_RPC_URL || 'https://base.llamarpc.com',
    137: process.env.POLYGON_RPC_URL || 'https://polygon.llamarpc.com',
    42161: process.env.ARBITRUM_RPC_URL || 'https://arbitrum.llamarpc.com',
    10: process.env.OPTIMISM_RPC_URL || 'https://optimism.llamarpc.com',
    56: process.env.BSC_RPC_URL || 'https://bsc.llamarpc.com'
  };

  return new JsonRpcProvider(rpcUrls[chainId]);
}

function getExplorerUrl(chainId: number, txHash: string): string {
  const explorers: { [key: number]: string } = {
    1: 'https://etherscan.io/tx/',
    8453: 'https://basescan.org/tx/',
    137: 'https://polygonscan.com/tx/',
    42161: 'https://arbiscan.io/tx/',
    10: 'https://optimistic.etherscan.io/tx/',
    56: 'https://bscscan.com/tx/'
  };

  return `${explorers[chainId] || explorers[1]}${txHash}`;
}

export default router;