import { Express, Request, Response } from "express";
import { db } from "../db";
import { 
  tokenLaunches, 
  presaleContributions, 
  launchpadWhitelist,
  bondingCurvePriceHistory,
  launchpadAnalytics,
  launchpadMonitoringEvents,
  riddlepadFeeCollection,
  riddlepadConfig,
  riddlepadSettlementBatch,
  bankLedgerEntries,
  insertTokenLaunchSchema,
  insertPresaleContributionSchema,
  insertLaunchpadWhitelistSchema,
  insertBondingCurvePriceHistorySchema,
  insertLaunchpadAnalyticsSchema,
  insertLaunchpadMonitoringEventSchema,
  insertRiddlepadFeeCollectionSchema,
  insertRiddlepadConfigSchema,
  insertRiddlepadSettlementBatchSchema,
  insertBankLedgerEntrySchema,
  type TokenLaunch,
  type PresaleContribution,
  type RiddlepadFeeCollection,
  type RiddlepadSettlementBatch,
  type BankLedgerEntry
} from "@shared/schema";
import { eq, and, desc, gte, lte, sum, count } from "drizzle-orm";
import { z } from "zod";
import { sessionAuth, requireAuthentication } from "../middleware/session-auth";
import { getActiveSession } from '../riddle-wallet-auth';

// Helper function to extract session from request
const getSessionFromRequest = (req: Request) => {
  const authHeader = req.headers.authorization;
  const sessionToken = authHeader?.replace('Bearer ', '');
  return sessionToken ? getActiveSession(sessionToken) : null;
};
import { Client, Wallet, convertStringToHex, Payment } from 'xrpl';
import { Decimal } from 'decimal.js';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';

// ============== RIDDLEPAD API ENDPOINT REGISTRATION ==============

// ============== SECURITY & VALIDATION SCHEMAS ==============

// Supported chain types enum for strict validation
const SUPPORTED_CHAINS = z.enum([
  'ethereum', 'bitcoin', 'solana', 'xrpl', 'avalanche',
  'polygon', 'arbitrum', 'optimism', 'base', 'mantle', 
  'metis', 'scroll', 'zksync', 'linea', 'taiko',
  'bsc', 'fantom', 'unichain', 'soneium'
]);

// Rate limiting configuration for deployment endpoints
const deploymentRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 deployment requests per windowMs
  message: {
    error: 'Too many deployment requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const deploymentSlowDown = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 5, // Allow 5 requests per 15 minutes without delay
  delayMs: () => 1000, // Add 1 second delay per request after delayAfter
  maxDelayMs: 10000, // Maximum delay of 10 seconds
  validate: { delayMs: false }, // Disable warning message
});

// Audit logging function
function auditLog(action: string, userId: string | null, details: any) {
  console.log(`🔒 [AUDIT] ${new Date().toISOString()} - Action: ${action}, User: ${userId || 'Anonymous'}, Details:`, JSON.stringify(details, null, 2));
}

// Zod validation schemas for API endpoints
const feePreviewSchema = z.object({
  launchId: z.number().int().positive(),
  includeSettled: z.boolean().optional().default(false)
});

const settlementTransmitSchema = z.object({
  settlementBatchId: z.string().uuid()
  // NOTE: Private keys are handled server-side only for security
});

const adminActionSchema = z.object({
  action: z.enum(['preview', 'settle', 'transmit']),
  parameters: z.record(z.any())
});

const deploymentRequestSchema = z.object({
  launchId: z.number().int().positive()
});

const chainInfoRequestSchema = z.object({
  chainType: SUPPORTED_CHAINS
});

// ============== CHAIN-SPECIFIC TOKEN DEPLOYMENT SYSTEM ==============

// Chain configuration for all 19 supported wallet chains
const CHAIN_CONFIGS = {
  // Layer 1 Blockchains
  ethereum: { type: "evm", rpcUrl: process.env.ETHEREUM_RPC_URL, chainId: 1, nativeCurrency: "ETH", gasMultiplier: 1.2 },
  bitcoin: { type: "utxo", rpcUrl: process.env.BITCOIN_RPC_URL, network: "mainnet", nativeCurrency: "BTC", note: "Limited tokenization support" },
  solana: { type: "spl", rpcUrl: process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com", nativeCurrency: "SOL", tokenProgram: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
  xrpl: { type: "xrpl", rpcUrl: process.env.XRPL_RPC_URL || "wss://s1.ripple.com", nativeCurrency: "XRP", issuerRequired: true },
  avalanche: { type: "evm", rpcUrl: process.env.AVALANCHE_RPC_URL, chainId: 43114, nativeCurrency: "AVAX", gasMultiplier: 1.1 },
  
  // Layer 2 & Side Chains
  polygon: { type: "evm", rpcUrl: process.env.POLYGON_RPC_URL, chainId: 137, nativeCurrency: "MATIC", gasMultiplier: 1.1 },
  arbitrum: { type: "evm", rpcUrl: process.env.ARBITRUM_RPC_URL, chainId: 42161, nativeCurrency: "ETH", gasMultiplier: 1.0 },
  optimism: { type: "evm", rpcUrl: process.env.OPTIMISM_RPC_URL, chainId: 10, nativeCurrency: "ETH", gasMultiplier: 1.0 },
  base: { type: "evm", rpcUrl: process.env.BASE_RPC_URL, chainId: 8453, nativeCurrency: "ETH", gasMultiplier: 1.0 },
  mantle: { type: "evm", rpcUrl: process.env.MANTLE_RPC_URL, chainId: 5000, nativeCurrency: "MNT", gasMultiplier: 1.1 },
  metis: { type: "evm", rpcUrl: process.env.METIS_RPC_URL, chainId: 1088, nativeCurrency: "METIS", gasMultiplier: 1.2 },
  scroll: { type: "evm", rpcUrl: process.env.SCROLL_RPC_URL, chainId: 534352, nativeCurrency: "ETH", gasMultiplier: 1.1 },
  zksync: { type: "evm", rpcUrl: process.env.ZKSYNC_RPC_URL, chainId: 324, nativeCurrency: "ETH", gasMultiplier: 1.3 },
  linea: { type: "evm", rpcUrl: process.env.LINEA_RPC_URL, chainId: 59144, nativeCurrency: "ETH", gasMultiplier: 1.1 },
  taiko: { type: "evm", rpcUrl: process.env.TAIKO_RPC_URL, chainId: 167000, nativeCurrency: "ETH", gasMultiplier: 1.2 },
  
  // BSC & Alternative EVM
  bsc: { type: "evm", rpcUrl: process.env.BSC_RPC_URL, chainId: 56, nativeCurrency: "BNB", gasMultiplier: 1.1 },
  fantom: { type: "evm", rpcUrl: process.env.FANTOM_RPC_URL, chainId: 250, nativeCurrency: "FTM", gasMultiplier: 1.1 },
  unichain: { type: "evm", rpcUrl: process.env.UNICHAIN_RPC_URL, chainId: 1301, nativeCurrency: "ETH", gasMultiplier: 1.1 },
  soneium: { type: "evm", rpcUrl: process.env.SONEIUM_RPC_URL, chainId: 1946, nativeCurrency: "ETH", gasMultiplier: 1.1 }
} as const;

// Token deployment interfaces
interface TokenDeploymentParams {
  launch: TokenLaunch;
  totalSupply: string;
  name: string;
  symbol: string;
  decimals: number;
  creatorWallet: string;
}

interface DeploymentResult {
  success: boolean;
  contractAddress?: string;
  transactionHash?: string;
  error?: string;
  chainType: string;
  deploymentData?: any;
}

// ERC-20 Contract Template (simplified for demo)
const ERC20_CONTRACT_BYTECODE = "0x608060405234801561001057600080fd5b50..."; // Full bytecode would be here
const ERC20_CONTRACT_ABI = [
  "constructor(string name, string symbol, uint256 totalSupply, address owner)",
  "function transfer(address to, uint256 amount) public returns (bool)",
  "function balanceOf(address account) public view returns (uint256)",
  // ... other ERC-20 functions
];

// ============== CHAIN-SPECIFIC DEPLOYMENT FUNCTIONS ==============

// Deploy ERC-20 token on EVM-compatible chains
async function deployEVMToken(params: TokenDeploymentParams): Promise<DeploymentResult> {
  const { launch, totalSupply, name, symbol, decimals, creatorWallet } = params;
  const chainConfig = CHAIN_CONFIGS[launch.chainType as keyof typeof CHAIN_CONFIGS];
  
  if (chainConfig.type !== "evm") {
    return { success: false, error: "Chain is not EVM compatible", chainType: launch.chainType };
  }

  try {
    console.log(`🚀 [${launch.chainType.toUpperCase()}] Deploying ERC-20 token: ${name} (${symbol})`);
    console.log(`🚀 [${launch.chainType.toUpperCase()}] Total Supply: ${totalSupply}, Decimals: ${decimals}`);
    console.log(`🚀 [${launch.chainType.toUpperCase()}] Creator: ${creatorWallet}`);
    console.log(`🚀 [${launch.chainType.toUpperCase()}] Chain ID: ${chainConfig.chainId}`);
    
    // Simulate deployment for demo purposes
    // In production, this would use ethers.js or web3.js to deploy the contract
    const mockContractAddress = `0x${Math.random().toString(16).slice(2, 42).padStart(40, '0')}`;
    const mockTxHash = `0x${Math.random().toString(16).slice(2, 66).padStart(64, '0')}`;
    
    // Simulate deployment delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return {
      success: true,
      contractAddress: mockContractAddress,
      transactionHash: mockTxHash,
      chainType: launch.chainType,
      deploymentData: {
        chainId: chainConfig.chainId,
        gasEstimate: Math.floor(Math.random() * 500000) + 100000,
        deploymentFee: (Math.random() * 0.1).toFixed(6),
        blockNumber: Math.floor(Math.random() * 1000000) + 18000000
      }
    };
    
  } catch (error: any) {
    console.error(`❌ [${launch.chainType.toUpperCase()}] EVM deployment failed:`, error);
    return { 
      success: false, 
      error: error.message || "EVM deployment failed", 
      chainType: launch.chainType 
    };
  }
}

// Deploy SPL token on Solana
async function deploySolanaToken(params: TokenDeploymentParams): Promise<DeploymentResult> {
  const { launch, totalSupply, name, symbol, decimals, creatorWallet } = params;
  
  try {
    console.log(`🟢 [SOLANA] Deploying SPL token: ${name} (${symbol})`);
    console.log(`🟢 [SOLANA] Total Supply: ${totalSupply}, Decimals: ${decimals}`);
    console.log(`🟢 [SOLANA] Creator: ${creatorWallet}`);
    
    // Simulate SPL token creation
    // In production, this would use @solana/web3.js and @solana/spl-token
    const mockMintAddress = Array.from({length: 44}, () => 
      'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 58)]
    ).join('');
    const mockTxSignature = Array.from({length: 88}, () => 
      'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 58)]
    ).join('');
    
    // Simulate deployment delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    return {
      success: true,
      contractAddress: mockMintAddress,
      transactionHash: mockTxSignature,
      chainType: launch.chainType,
      deploymentData: {
        mintAuthority: creatorWallet,
        freezeAuthority: creatorWallet,
        tokenProgram: CHAIN_CONFIGS.solana.tokenProgram,
        rentExemption: (Math.random() * 0.01).toFixed(6),
        slot: Math.floor(Math.random() * 1000000) + 150000000
      }
    };
    
  } catch (error: any) {
    console.error(`❌ [SOLANA] SPL deployment failed:`, error);
    return { 
      success: false, 
      error: error.message || "Solana SPL deployment failed", 
      chainType: launch.chainType 
    };
  }
}

// Create native token on XRPL
async function deployXRPLToken(params: TokenDeploymentParams): Promise<DeploymentResult> {
  const { launch, totalSupply, name, symbol, decimals, creatorWallet } = params;
  
  try {
    console.log(`🏦 [XRPL] Creating native token: ${name} (${symbol})`);
    console.log(`🏦 [XRPL] Total Supply: ${totalSupply}, Decimals: ${decimals}`);
    console.log(`🏦 [XRPL] Issuer: ${creatorWallet}`);
    
    // Simulate XRPL token issuance
    // In production, this would create trustlines and issue tokens using xrpl.js
    const mockTxHash = Array.from({length: 64}, () => 
      '0123456789ABCDEF'[Math.floor(Math.random() * 16)]
    ).join('');
    
    // Simulate deployment delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      success: true,
      contractAddress: creatorWallet, // On XRPL, the issuer address IS the token identifier
      transactionHash: mockTxHash,
      chainType: launch.chainType,
      deploymentData: {
        issuer: creatorWallet,
        currencyCode: symbol,
        transferFee: Math.floor(Math.random() * 1000000000), // In drops
        requireDestinationTag: false,
        ledgerIndex: Math.floor(Math.random() * 1000000) + 70000000
      }
    };
    
  } catch (error: any) {
    console.error(`❌ [XRPL] Token issuance failed:`, error);
    return { 
      success: false, 
      error: error.message || "XRPL token issuance failed", 
      chainType: launch.chainType 
    };
  }
}

// Handle Bitcoin tokenization
async function deployBitcoinToken(params: TokenDeploymentParams): Promise<DeploymentResult> {
  const { launch, totalSupply, name, symbol, decimals, creatorWallet } = params;
  
  try {
    console.log(`🟠 [BITCOIN] Tokenization request: ${name} (${symbol})`);
    console.log(`🟠 [BITCOIN] Note: Bitcoin has limited native tokenization support`);
    
    // Bitcoin doesn't have native smart contracts like Ethereum
    // This would typically use protocols like Omni Layer, Counterparty, or RGB
    // For this demo, we'll simulate using a Bitcoin tokenization protocol
    
    const mockProtocolTx = Array.from({length: 64}, () => 
      '0123456789abcdef'[Math.floor(Math.random() * 16)]
    ).join('');
    
    // Simulate longer processing time for Bitcoin
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    return {
      success: true,
      contractAddress: `btc_token_${mockProtocolTx.slice(0, 16)}`, // Protocol-specific identifier
      transactionHash: mockProtocolTx,
      chainType: launch.chainType,
      deploymentData: {
        protocol: "Omni Layer", // Could be RGB, Counterparty, etc.
        propertyId: Math.floor(Math.random() * 1000000) + 1,
        confirmations: Math.floor(Math.random() * 6) + 1,
        blockHeight: Math.floor(Math.random() * 100000) + 750000,
        note: "Bitcoin tokenization uses layer-2 protocols"
      }
    };
    
  } catch (error: any) {
    console.error(`❌ [BITCOIN] Tokenization failed:`, error);
    return { 
      success: false, 
      error: error.message || "Bitcoin tokenization failed", 
      chainType: launch.chainType 
    };
  }
}

// Main deployment orchestrator
async function deployTokenOnChain(params: TokenDeploymentParams): Promise<DeploymentResult> {
  const { launch } = params;
  const chainConfig = CHAIN_CONFIGS[launch.chainType as keyof typeof CHAIN_CONFIGS];
  
  if (!chainConfig) {
    return { 
      success: false, 
      error: `Unsupported chain: ${launch.chainType}`, 
      chainType: launch.chainType 
    };
  }

  console.log(`🚀 [DEPLOYMENT] Starting token deployment on ${launch.chainType.toUpperCase()}`);
  console.log(`🚀 [DEPLOYMENT] Chain Type: ${chainConfig.type}`);
  
  // Route to appropriate deployment function based on chain type
  switch (chainConfig.type) {
    case "evm":
      return await deployEVMToken(params);
    case "spl":
      return await deploySolanaToken(params);
    case "xrpl":
      return await deployXRPLToken(params);
    case "utxo":
      return await deployBitcoinToken(params);
    default:
      return { 
        success: false, 
        error: `Unsupported chain type: ${chainConfig.type}`, 
        chainType: launch.chainType 
      };
  }
}

// ============== AUTOMATIC GRADUATION & DEPLOYMENT SYSTEM ==============

// Check if launch has reached graduation criteria
function shouldTriggerGraduation(launch: TokenLaunch): boolean {
  const totalRaised = parseFloat(launch.totalRaised || "0");
  const fundingGoal = parseFloat(launch.fundingGoal || "0");
  
  // Graduation criteria:
  // 1. Auto-launch is enabled
  // 2. Auto-launch hasn't been triggered yet
  // 3. Total raised >= funding goal
  // 4. Launch is still active
  return (
    launch.autoLaunchEnabled &&
    !launch.autoLaunchTriggered &&
    totalRaised >= fundingGoal &&
    launch.status === "active"
  );
}

// Execute automatic graduation and token deployment
async function executeGraduation(launchId: number): Promise<{ success: boolean; result?: any; error?: string }> {
  try {
    console.log(`🎓 [GRADUATION] Starting graduation process for launch ${launchId}`);
    
    // Get launch details
    const [launch] = await db
      .select()
      .from(tokenLaunches)
      .where(eq(tokenLaunches.id, launchId))
      .limit(1);
    
    if (!launch) {
      return { success: false, error: "Launch not found" };
    }
    
    if (!shouldTriggerGraduation(launch)) {
      return { success: false, error: "Graduation criteria not met" };
    }
    
    console.log(`🎓 [GRADUATION] Deploying token: ${launch.tokenName} (${launch.tokenSymbol})`);
    console.log(`🎓 [GRADUATION] Chain: ${launch.chainType}`);
    console.log(`🎓 [GRADUATION] Total Raised: ${launch.totalRaised}`);
    console.log(`🎓 [GRADUATION] Funding Goal: ${launch.fundingGoal}`);
    
    // Prepare deployment parameters
    const deploymentParams: TokenDeploymentParams = {
      launch,
      totalSupply: launch.totalSupply,
      name: launch.tokenName,
      symbol: launch.tokenSymbol,
      decimals: 18, // Standard decimals
      creatorWallet: launch.creatorWallet
    };
    
    // Deploy token on-chain
    const deploymentResult = await deployTokenOnChain(deploymentParams);
    
    if (deploymentResult.success) {
      // Update launch with deployment information
      await db
        .update(tokenLaunches)
        .set({ 
          autoLaunchTriggered: true,
          autoLaunchTransaction: deploymentResult.transactionHash,
          contractAddress: deploymentResult.contractAddress,
          status: "completed",
          updatedAt: new Date()
         } as any)
        .where(eq(tokenLaunches.id, launchId));
      
      console.log(`✅ [GRADUATION] Token deployed successfully!`);
      console.log(`✅ [GRADUATION] Contract: ${deploymentResult.contractAddress}`);
      console.log(`✅ [GRADUATION] Transaction: ${deploymentResult.transactionHash}`);
      
      return { success: true, result: deploymentResult };
    } else {
      console.error(`❌ [GRADUATION] Deployment failed: ${deploymentResult.error}`);
      return { success: false, error: deploymentResult.error };
    }
    
  } catch (error: any) {
    console.error(`❌ [GRADUATION] Graduation process failed:`, error);
    return { success: false, error: error.message };
  }
}

// Validate required environment variables for two-phase system
function validateRiddlePadConfig() {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Only require bank wallet if on-chain settlement is enabled
  const onchainEnabled = process.env.ONCHAIN_SETTLEMENT_ENABLED === 'true';
  
  if (onchainEnabled && !process.env.RIDDLEPAD_BANK_WALLET) {
    errors.push('RIDDLEPAD_BANK_WALLET environment variable is required when ONCHAIN_SETTLEMENT_ENABLED=true');
  }
  
  // SECURITY: Always require collection private key for on-chain operations
  if (onchainEnabled && !process.env.RIDDLEPAD_COLLECTION_PRIVATE_KEY) {
    errors.push('RIDDLEPAD_COLLECTION_PRIVATE_KEY environment variable is required when ONCHAIN_SETTLEMENT_ENABLED=true');
  }
  
  if (!onchainEnabled && !process.env.RIDDLEPAD_BANK_WALLET) {
    warnings.push('RIDDLEPAD_BANK_WALLET not configured - on-chain settlement will be disabled');
  }
  
  if (process.env.RIDDLEPAD_BANK_WALLET && !process.env.RIDDLEPAD_BANK_WALLET.startsWith('r')) {
    errors.push('RIDDLEPAD_BANK_WALLET must be a valid XRPL address starting with "r"');
  }
  
  // Log warnings but don't crash
  if (warnings.length > 0) {
    console.warn('⚠️ [RIDDLEPAD CONFIG] Configuration warnings:');
    warnings.forEach(warning => console.warn(`   - ${warning}`));
  }
  
  // Only crash on actual errors
  if (errors.length > 0) {
    console.error('❌ [RIDDLEPAD CONFIG] Critical validation errors:');
    errors.forEach(error => console.error(`   - ${error}`));
    throw new Error(`RiddlePad configuration errors: ${errors.join(', ')}`);
  }
}

// Validate configuration on startup
validateRiddlePadConfig();

// RiddlePad Two-Phase Fee Configuration
const RIDDLEPAD_FEES = {
  // Fee rates
  CURVE_COMPLETION_FEE: 10.0, // 10% of total raised when curve completes
  SWAP_FEE: 0.25, // 0.25% on all token swaps
  
  // Phase control flags
  FEE_ACCOUNTING_ENABLED: process.env.FEE_ACCOUNTING_ENABLED !== 'false', // Default: true
  ONCHAIN_SETTLEMENT_ENABLED: process.env.ONCHAIN_SETTLEMENT_ENABLED === 'true', // Default: false
  
  // Bank wallet (only required when on-chain settlement enabled)
  BANK_WALLET_ADDRESS: process.env.RIDDLEPAD_BANK_WALLET || '',
  
  // Legacy compatibility (deprecated)
  FEE_COLLECTION_ENABLED: process.env.RIDDLEPAD_FEE_COLLECTION === 'true' // Must be explicitly enabled
};

// Log configuration on startup
console.log('🔧 [RIDDLEPAD CONFIG] Two-Phase Fee System Configuration:');
console.log(`   📊 Fee Accounting: ${RIDDLEPAD_FEES.FEE_ACCOUNTING_ENABLED ? 'ENABLED' : 'DISABLED'}`);
console.log(`   🔗 On-Chain Settlement: ${RIDDLEPAD_FEES.ONCHAIN_SETTLEMENT_ENABLED ? 'ENABLED' : 'DISABLED'}`);
console.log(`   🏦 Bank Wallet: ${RIDDLEPAD_FEES.BANK_WALLET_ADDRESS ? 'CONFIGURED' : 'NOT SET'}`);
console.log(`   📈 Curve Completion Fee: ${RIDDLEPAD_FEES.CURVE_COMPLETION_FEE}%`);
console.log(`   💱 Swap Fee: ${RIDDLEPAD_FEES.SWAP_FEE}%`);

// Generate RiddlePad memo for fee tracking
function generateRiddlePadMemo(launchId: number, feeType: string): string {
  const timestamp = Date.now();
  return `RPAD-${launchId}-${feeType}-${timestamp}`;
}

// ============== DEPLOYMENT API ENDPOINTS ==============

// Manual deployment trigger endpoint  
function setupDeploymentEndpoints(app: Express) {
  // Simple rate limiting middleware (fallback if express-rate-limit not available)
  const requestCounts = new Map<string, { count: number; resetTime: number }>();
  const simpleRateLimit = (req: any, res: any, next: any) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutes
    const maxRequests = 10;
    
    if (!requestCounts.has(ip)) {
      requestCounts.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }
    
    const record = requestCounts.get(ip)!;
    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + windowMs;
      return next();
    }
    
    if (record.count >= maxRequests) {
      return res.status(429).json({
        error: 'Too many deployment requests from this IP, please try again later.',
        retryAfter: '15 minutes'
      });
    }
    
    record.count++;
    next();
  };

  // Trigger manual token deployment for a launch (SECURED)
  app.post("/api/launchpad/deploy/:id", sessionAuth, simpleRateLimit, async (req: Request, res: Response) => {
    try {
      // Validate request parameters
      const validation = deploymentRequestSchema.safeParse({
        launchId: parseInt(req.params.id)
      });
      
      if (!validation.success) {
        auditLog('DEPLOYMENT_REQUEST_INVALID', getSessionFromRequest(req)?.handle || null, {
          params: req.params,
          errors: validation.error.errors
        });
        return res.status(400).json({
          success: false,
          error: "Invalid request parameters",
          details: validation.error.errors
        });
      }
      
      const { launchId } = validation.data;
      const session = getSessionFromRequest(req);
      const userId = session?.handle;
      
      auditLog('DEPLOYMENT_REQUEST', userId, {
        launchId,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
      
      console.log(`🚀 [API] Manual deployment requested for launch ${launchId} by user ${userId}`);
      
      const graduationResult = await executeGraduation(launchId);
      
      if (graduationResult.success) {
        auditLog('DEPLOYMENT_SUCCESS', userId, {
          launchId,
          result: graduationResult.result
        });
        
        res.json({
          success: true,
          deployment: graduationResult.result,
          message: "Token deployed successfully"
        });
      } else {
        auditLog('DEPLOYMENT_FAILED', userId, {
          launchId,
          error: graduationResult.error
        });
        
        res.status(400).json({
          success: false,
          error: graduationResult.error
        });
      }
      
    } catch (error: any) {
      console.error("Error in manual deployment:", error);
      auditLog('DEPLOYMENT_ERROR', getSessionFromRequest(req)?.handle || null, {
        launchId: req.params.id,
        error: error.message,
        stack: error.stack
      });
      res.status(500).json({ error: "Failed to deploy token" });
    }
  });

  // Get deployment status for a launch (SECURED)
  app.get("/api/launchpad/deployment-status/:id", sessionAuth, async (req: Request, res: Response) => {
    try {
      // Validate request parameters
      const validation = deploymentRequestSchema.safeParse({
        launchId: parseInt(req.params.id)
      });
      
      if (!validation.success) {
        auditLog('DEPLOYMENT_STATUS_INVALID', getSessionFromRequest(req)?.handle || null, {
          params: req.params,
          errors: validation.error.errors
        });
        return res.status(400).json({
          success: false,
          error: "Invalid request parameters",
          details: validation.error.errors
        });
      }
      
      const { launchId } = validation.data;
      const session = getSessionFromRequest(req);
      const userId = session?.handle;
      
      auditLog('DEPLOYMENT_STATUS_REQUEST', userId, {
        launchId,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
      
      const [launch] = await db
        .select()
        .from(tokenLaunches)
        .where(eq(tokenLaunches.id, launchId))
        .limit(1);
      
      if (!launch) {
        auditLog('DEPLOYMENT_STATUS_NOT_FOUND', userId, { launchId });
        return res.status(404).json({ error: "Launch not found" });
      }

      const chainConfig = CHAIN_CONFIGS[launch.chainType as keyof typeof CHAIN_CONFIGS];
      const graduationEligible = shouldTriggerGraduation(launch);
      
      const statusData = {
        launchId: launch.id,
        chainType: launch.chainType,
        chainConfig: chainConfig || null,
        autoLaunchEnabled: launch.autoLaunchEnabled,
        autoLaunchTriggered: launch.autoLaunchTriggered,
        contractAddress: launch.contractAddress,
        deploymentTransaction: launch.autoLaunchTransaction,
        status: launch.status,
        totalRaised: launch.totalRaised,
        fundingGoal: launch.fundingGoal,
        graduationEligible,
        canDeploy: graduationEligible && !launch.autoLaunchTriggered
      };
      
      auditLog('DEPLOYMENT_STATUS_SUCCESS', userId, { launchId, status: launch.status });
      res.json(statusData);
      
    } catch (error: any) {
      console.error("Error getting deployment status:", error);
      auditLog('DEPLOYMENT_STATUS_ERROR', getSessionFromRequest(req)?.handle || null, {
        launchId: req.params.id,
        error: error.message
      });
      res.status(500).json({ error: "Failed to get deployment status" });
    }
  });

  // Get chain information for UI display (SECURED)  
  app.get("/api/launchpad/chain-info/:chainType", sessionAuth, async (req: Request, res: Response) => {
    try {
      // Validate chain type parameter
      const validation = chainInfoRequestSchema.safeParse({
        chainType: req.params.chainType
      });
      
      if (!validation.success) {
        auditLog('CHAIN_INFO_INVALID', getSessionFromRequest(req)?.handle || null, {
          params: req.params,
          errors: validation.error.errors
        });
        return res.status(400).json({
          success: false,
          error: "Invalid chain type",
          supportedChains: SUPPORTED_CHAINS.options,
          details: validation.error.errors
        });
      }
      
      const { chainType } = validation.data;
      const session = getSessionFromRequest(req);
      const userId = session?.handle;
      
      auditLog('CHAIN_INFO_REQUEST', userId, {
        chainType,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
      const chainConfig = CHAIN_CONFIGS[chainType as keyof typeof CHAIN_CONFIGS];
      
      if (!chainConfig) {
        auditLog('CHAIN_INFO_NOT_FOUND', userId, { chainType });
        return res.status(404).json({ error: "Unsupported chain" });
      }

      // Calculate estimated deployment costs and times
      const deploymentInfo = {
        chainType,
        chainConfig,
        estimatedCosts: {
          evm: chainConfig.type === "evm" ? {
            gasEstimate: "100,000 - 500,000 gas",
            estimatedFee: `${(Math.random() * 0.1).toFixed(4)} ${chainConfig.nativeCurrency}`,
            timeEstimate: "2-5 minutes"
          } : null,
          solana: chainConfig.type === "spl" ? {
            rentExemption: "0.002-0.005 SOL",
            transactionFee: "0.00025 SOL",
            timeEstimate: "30-60 seconds"
          } : null,
          xrpl: chainConfig.type === "xrpl" ? {
            reserveRequirement: "10 XRP",
            transactionFee: "0.00001 XRP",
            timeEstimate: "3-6 seconds"
          } : null,
          bitcoin: chainConfig.type === "utxo" ? {
            protocolFee: "Variable by protocol",
            transactionFee: "0.0001-0.001 BTC",
            timeEstimate: "10-60 minutes",
            note: "Uses layer-2 tokenization protocols"
          } : null
        },
        features: {
          supportsSmartContracts: chainConfig.type === "evm",
          nativeTokenSupport: chainConfig.type === "xrpl" || chainConfig.type === "spl",
          layer2Solution: chainConfig.type === "evm" && [
            "polygon", "arbitrum", "optimism", "base", "mantle", 
            "metis", "scroll", "zksync", "linea", "taiko"
          ].includes(chainType),
          fastFinality: ["solana", "xrpl", "polygon", "bsc"].includes(chainType)
        }
      };

      auditLog('CHAIN_INFO_SUCCESS', userId, { chainType, configType: chainConfig.type });
      res.json(deploymentInfo);
      
    } catch (error: any) {
      console.error("Error getting chain info:", error);
      auditLog('CHAIN_INFO_ERROR', getSessionFromRequest(req)?.handle || null, {
        chainType: req.params.chainType,
        error: error.message
      });
      res.status(500).json({ error: "Failed to get chain information" });
    }
  });

  console.log("🚀 [API] Deployment endpoints registered:");
  console.log("   📤 POST /api/launchpad/deploy/:id - Manual deployment trigger");
  console.log("   📊 GET /api/launchpad/deployment-status/:id - Get deployment status");
  console.log("   ⛓️ GET /api/launchpad/chain-info/:chainType - Get chain information");
}

// ============== TWO-PHASE RIDDLEPAD FEE COLLECTION SYSTEM ==============

// Get current running balance for bank wallet ledger
async function getCurrentBankBalance(bankWalletAddress: string): Promise<string> {
  try {
    const [latestEntry] = await db
      .select({ runningBalance: bankLedgerEntries.runningBalance })
      .from(bankLedgerEntries)
      .where(eq(bankLedgerEntries.bankWalletAddress, bankWalletAddress))
      .orderBy(desc(bankLedgerEntries.createdAt))
      .limit(1);
    
    return latestEntry?.runningBalance || "0.00000000";
  } catch (error) {
    console.error('❌ [BANK LEDGER] Error getting current balance:', error);
    return "0.00000000";
  }
}

// PHASE 1: Off-chain fee accrual (no XRPL transfers)
async function collectRiddlePadFee({
  launchId,
  feeType,
  feeAmount,
  feeToken = 'XRP',
  feeUsdValue,
  feePercentage,
  sourceTransactionHash,
  sourceWallet,
  sourceAmount,
  curveCompletionData = null
}: {
  launchId: number;
  feeType: 'curve_completion' | 'swap_fee';
  feeAmount: string;
  feeToken?: string;
  feeUsdValue: string;
  feePercentage: number;
  sourceTransactionHash: string;
  sourceWallet: string;
  sourceAmount: string;
  curveCompletionData?: any;
}): Promise<{ success: boolean; feeRecord?: any; error?: string }> {
  
  // Check if fee accounting is enabled
  if (!RIDDLEPAD_FEES.FEE_ACCOUNTING_ENABLED) {
    console.log(`⚠️ [RIDDLEPAD PHASE-1] Fee accounting disabled - skipping ${feeType} fee of ${feeAmount} ${feeToken}`);
    return { success: true };
  }

  try {
    const riddlepadId = generateRiddlePadMemo(launchId, feeType);
    const bankWalletAddress = RIDDLEPAD_FEES.BANK_WALLET_ADDRESS || 'UNKNOWN_BANK';
    
    console.log(`📊 [RIDDLEPAD PHASE-1] Accruing ${feeType} fee: ${feeAmount} ${feeToken} (${feePercentage}%)`);
    console.log(`📊 [RIDDLEPAD PHASE-1] Memo: ${riddlepadId}`);
    console.log(`📊 [RIDDLEPAD PHASE-1] Source: ${sourceWallet} | Tx: ${sourceTransactionHash}`);
    
    // Idempotency check: prevent double fee accrual
    let existingFeeCondition;
    if (feeType === 'curve_completion') {
      // Curve completion: unique per launch
      existingFeeCondition = and(
        eq(riddlepadFeeCollection.launchId, launchId),
        eq(riddlepadFeeCollection.feeType, 'curve_completion')
      );
    } else {
      // Swap fees: unique per source transaction hash
      existingFeeCondition = eq(riddlepadFeeCollection.sourceTransactionHash, sourceTransactionHash);
    }
    
    const existingFee = await db
      .select()
      .from(riddlepadFeeCollection)
      .where(existingFeeCondition)
      .limit(1);
        
    if (existingFee.length > 0) {
      console.log(`⚠️ [RIDDLEPAD PHASE-1] Fee already accrued: ${feeType} for ${existingFee[0].sourceTransactionHash}`);
      return { success: true, feeRecord: existingFee[0] };
    }
    
    // Decimal precision math conversion - prevents rounding errors
    const feeAmountFixed = new Decimal(feeAmount).toFixed(8);
    const feeUsdValueFixed = new Decimal(feeUsdValue).toFixed(8);
    const sourceAmountFixed = new Decimal(sourceAmount).toFixed(8);
    const feePercentageFixed = new Decimal(feePercentage.toString()).toFixed(2);
    
    // Database transaction for atomic fee accrual
    const result = await db.transaction(async (tx) => {
      // 1. Create fee record with 'accrued' status (never 'collected' in Phase 1)
      const [feeRecord] = await tx.insert(riddlepadFeeCollection).values({
        launchId,
        feeType,
        riddlepadId,
        feeAmount: feeAmountFixed,
        feeToken,
        feeUsdValue: feeUsdValueFixed,
        feePercentage: feePercentageFixed,
        sourceTransactionHash,
        bankWalletAddress,
        sourceWallet,
        sourceAmount: sourceAmountFixed,
        status: 'accrued', // PHASE 1: Only accrued, never immediate collection
        curveCompletionData,
      } as any).returning();

      // 2. Get current bank balance for ledger entry with decimal precision
      const currentBalance = await getCurrentBankBalance(bankWalletAddress);
      const newBalance = new Decimal(currentBalance).plus(feeAmountFixed).toFixed(8);
      
      // 3. Create bank ledger entry for accrual
      const [ledgerEntry] = await tx.insert(bankLedgerEntries).values({
        entryType: 'fee_accrual',
        referenceId: feeRecord.id,
        amount: feeAmountFixed,
        currency: feeToken,
        usdValue: feeUsdValueFixed,
        sourceWallet,
        sourceTransactionHash,
        launchId,
        bankWalletAddress,
        runningBalance: newBalance,
        isSettled: false,
        memo: riddlepadId,
        description: `${feeType} fee accrued from ${sourceWallet} (${feePercentageFixed}% as any)`,
      }).returning();

      return { feeRecord, ledgerEntry };
    });

    console.log(`✅ [RIDDLEPAD PHASE-1] Fee accrued successfully:`);
    console.log(`   📊 Fee Record ID: ${result.feeRecord.id}`);
    console.log(`   📊 Ledger Entry ID: ${result.ledgerEntry.id}`);
    console.log(`   📊 Status: ${result.feeRecord.status}`);
    console.log(`   📊 Bank Balance: ${result.ledgerEntry.runningBalance} ${feeToken}`);
    
    return { 
      success: true, 
      feeRecord: result.feeRecord
    };
    
  } catch (error: any) {
    console.error(`❌ [RIDDLEPAD PHASE-1] Error accruing ${feeType} fee:`, error);
    
    // Attempt to log failure (best effort)
    try {
      await db.insert(riddlepadFeeCollection).values({
        launchId,
        feeType,
        riddlepadId: generateRiddlePadMemo(launchId, `${feeType}_FAILED` as any),
        feeAmount: new Decimal(feeAmount).toFixed(8),
        feeToken,
        feeUsdValue: new Decimal(feeUsdValue).toFixed(8),
        feePercentage: new Decimal(feePercentage.toString()).toFixed(2),
        sourceTransactionHash,
        bankWalletAddress: RIDDLEPAD_FEES.BANK_WALLET_ADDRESS || 'UNKNOWN_BANK',
        sourceWallet,
        sourceAmount: new Decimal(sourceAmount).toFixed(8),
        status: 'failed',
        failureReason: error.message,
        retryCount: 0,
        curveCompletionData,
      });
    } catch (logError) {
      console.error(`❌ [RIDDLEPAD PHASE-1] Failed to log error:`, logError);
    }
    
    return { success: false, error: error.message };
  }
}

// ============== PHASE 2: GRADUATION SETTLEMENT SYSTEM ==============

// Execute XRPL settlement payment (only used when ONCHAIN_SETTLEMENT_ENABLED=true)
async function executeSettlementXrplPayment({
  fromPrivateKey,
  toAddress,
  amount,
  memo
}: {
  fromPrivateKey: string;
  toAddress: string;
  amount: string;
  memo: string;
}): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
  if (!RIDDLEPAD_FEES.ONCHAIN_SETTLEMENT_ENABLED) {
    return { success: false, error: 'On-chain settlement is disabled' };
  }

  const client = new Client('wss://s1.ripple.com');
  
  try {
    await client.connect();
    
    // Create wallet from private key
    const wallet = Wallet.fromSeed(fromPrivateKey);
    
    // Prepare payment transaction
    const paymentTransaction: Payment = {
      TransactionType: 'Payment' as const,
      Account: wallet.address,
      Destination: toAddress,
      Amount: new Decimal(amount).mul(1000000).toFixed(0), // XRP in drops with decimal precision
      Fee: '12', // Standard fee in drops
      Memos: [{
        Memo: {
          MemoData: convertStringToHex(memo)
        }
      }]
    };
    
    console.log(`🔗 [XRPL SETTLEMENT] Sending ${amount} XRP from ${wallet.address} to ${toAddress}`);
    console.log(`🔗 [XRPL SETTLEMENT] Memo: ${memo}`);
    
    // Submit and wait for validation
    const response = await client.submitAndWait(paymentTransaction, { wallet });
    
    if (response.result.meta && typeof response.result.meta === 'object' && 'TransactionResult' in response.result.meta) {
      if (response.result.meta.TransactionResult === 'tesSUCCESS') {
        console.log(`✅ [XRPL SETTLEMENT] Transaction successful: ${response.result.hash}`);
        return { success: true, transactionHash: response.result.hash };
      } else {
        console.error(`❌ [XRPL SETTLEMENT] Transaction failed: ${response.result.meta.TransactionResult}`);
        return { success: false, error: `Transaction failed: ${response.result.meta.TransactionResult}` };
      }
    } else {
      console.error('❌ [XRPL SETTLEMENT] Unexpected response format');
      return { success: false, error: 'Unexpected response format' };
    }
    
  } catch (error: any) {
    console.error('❌ [XRPL SETTLEMENT] Error executing settlement payment:', error);
    return { success: false, error: error.message };
  } finally {
    await client.disconnect();
  }
}

// Create graduation settlement batch - triggered when bonding curve completes
async function createGraduationSettlement({
  launchId,
  triggerWallet,
  triggerTransactionHash
}: {
  launchId: number;
  triggerWallet: string;
  triggerTransactionHash: string;
}): Promise<{ success: boolean; settlementBatch?: any; error?: string }> {
  
  if (!RIDDLEPAD_FEES.FEE_ACCOUNTING_ENABLED) {
    console.log(`⚠️ [GRADUATION] Fee accounting disabled - skipping settlement for launch ${launchId}`);
    return { success: true };
  }

  try {
    console.log(`🎓 [GRADUATION] Creating settlement batch for launch ${launchId}`);
    console.log(`🎓 [GRADUATION] Trigger: ${triggerWallet} | Tx: ${triggerTransactionHash}`);
    
    // Check if graduation settlement already exists
    const existingSettlement = await db
      .select()
      .from(riddlepadSettlementBatch)
      .where(and(
        eq(riddlepadSettlementBatch.launchId, launchId),
        eq(riddlepadSettlementBatch.batchType, 'graduation')
      ))
      .limit(1);
    
    if (existingSettlement.length > 0) {
      console.log(`⚠️ [GRADUATION] Settlement batch already exists for launch ${launchId}`);
      return { success: true, settlementBatch: existingSettlement[0] };
    }

    // Get all accrued fees for this launch
    const accruedFees = await db
      .select()
      .from(riddlepadFeeCollection)
      .where(and(
        eq(riddlepadFeeCollection.launchId, launchId),
        eq(riddlepadFeeCollection.status, 'accrued')
      ));
    
    if (accruedFees.length === 0) {
      console.log(`⚠️ [GRADUATION] No accrued fees found for launch ${launchId}`);
      return { success: true, settlementBatch: null };
    }

    // Calculate total fee amounts using Decimal for precision
    const totalFeeAmount = accruedFees.reduce((sum, fee) => 
      sum.plus(new Decimal(fee.feeAmount)), new Decimal(0)
    ).toFixed(8);
    
    const totalFeeUsdValue = accruedFees.reduce((sum, fee) => 
      sum.plus(new Decimal(fee.feeUsdValue)), new Decimal(0)
    ).toFixed(8);

    const bankWalletAddress = RIDDLEPAD_FEES.BANK_WALLET_ADDRESS || 'UNKNOWN_BANK';

    // Database transaction for atomic settlement creation
    const result = await db.transaction(async (tx) => {
      // 1. Create settlement batch
      const [settlementBatch] = await tx.insert(riddlepadSettlementBatch).values({
        launchId,
        batchType: 'graduation',
        totalFeeAmount,
        totalFeeUsdValue,
        feeCount: accruedFees.length,
        status: 'created',
        triggerWallet,
        triggerTransactionHash,
        bankWalletAddress,
        settlementMemo: `RPAD-${launchId}-GRAD-${Date.now().toString(36).toUpperCase()}`,
      }).returning();

      // 2. Update all accrued fees to settlement_pending
      await tx.update(riddlepadFeeCollection)
        .set({  
          status: 'settlement_pending',
          updatedAt: new Date()
         } as any)
        .where(and(
          eq(riddlepadFeeCollection.launchId, launchId),
          eq(riddlepadFeeCollection.status, 'accrued')
        ));

      // 3. Create settlement pending ledger entry
      const currentBalance = await getCurrentBankBalance(bankWalletAddress);
      await tx.insert(bankLedgerEntries).values({
        entryType: 'settlement_pending',
        referenceId: settlementBatch.id,
        amount: totalFeeAmount,
        currency: 'XRP',
        usdValue: totalFeeUsdValue,
        sourceWallet: triggerWallet,
        sourceTransactionHash: triggerTransactionHash,
        launchId,
        bankWalletAddress,
        runningBalance: currentBalance, // No balance change yet
        settlementBatchId: settlementBatch.id,
        isSettled: false,
        memo: settlementBatch.settlementMemo,
        description: `Graduation settlement batch created for launch ${launchId} (${accruedFees.length} fees as any)`,
      });

      return settlementBatch;
    });

    console.log(`✅ [GRADUATION] Settlement batch created successfully:`);
    console.log(`   🎓 Batch ID: ${result.id}`);
    console.log(`   🎓 Total Amount: ${totalFeeAmount} XRP`);
    console.log(`   🎓 Total USD: $${totalFeeUsdValue}`);
    console.log(`   🎓 Fee Count: ${accruedFees.length}`);
    console.log(`   🎓 Memo: ${result.settlementMemo}`);
    
    return { success: true, settlementBatch: result };
    
  } catch (error: any) {
    console.error(`❌ [GRADUATION] Error creating settlement batch:`, error);
    return { success: false, error: error.message };
  }
}

// Transmit settlement batch on-chain (only if ONCHAIN_SETTLEMENT_ENABLED=true)
async function transmitSettlementOnChain(settlementBatchId: string): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
  
  if (!RIDDLEPAD_FEES.ONCHAIN_SETTLEMENT_ENABLED) {
    console.log(`⚠️ [SETTLEMENT] On-chain settlement disabled - batch ${settlementBatchId} remains pending`);
    return { success: true, error: 'On-chain settlement disabled' };
  }

  if (!RIDDLEPAD_FEES.BANK_WALLET_ADDRESS) {
    return { success: false, error: 'Bank wallet address not configured' };
  }

  try {
    // Get settlement batch
    const [settlementBatch] = await db
      .select()
      .from(riddlepadSettlementBatch)
      .where(eq(riddlepadSettlementBatch.id, settlementBatchId));
    
    if (!settlementBatch) {
      return { success: false, error: 'Settlement batch not found' };
    }

    if (settlementBatch.status !== 'created') {
      console.log(`⚠️ [SETTLEMENT] Batch ${settlementBatchId} already processed (${settlementBatch.status})`);
      return { success: true, transactionHash: settlementBatch.onchainTransactionHash };
    }

    // Check for collection private key
    const collectionPrivateKey = process.env.RIDDLEPAD_COLLECTION_PRIVATE_KEY;
    if (!collectionPrivateKey) {
      return { success: false, error: 'RIDDLEPAD_COLLECTION_PRIVATE_KEY not configured' };
    }

    console.log(`🔗 [SETTLEMENT] Transmitting batch ${settlementBatchId} on-chain`);
    console.log(`🔗 [SETTLEMENT] Amount: ${settlementBatch.totalFeeAmount} XRP`);
    console.log(`🔗 [SETTLEMENT] Destination: ${RIDDLEPAD_FEES.BANK_WALLET_ADDRESS}`);

    // Update batch status to pending_onchain
    await db.update(riddlepadSettlementBatch)
      .set({  
        status: 'pending_onchain',
        transmittedAt: new Date(),
        updatedAt: new Date()
       } as any)
      .where(eq(riddlepadSettlementBatch.id, settlementBatchId));

    // Execute XRPL settlement payment
    const paymentResult = await executeSettlementXrplPayment({
      fromPrivateKey: collectionPrivateKey,
      toAddress: RIDDLEPAD_FEES.BANK_WALLET_ADDRESS,
      amount: settlementBatch.totalFeeAmount,
      memo: settlementBatch.settlementMemo
    });

    if (paymentResult.success) {
      // Transaction successful - update everything to completed
      await db.transaction(async (tx) => {
        // Update settlement batch
        await tx.update(riddlepadSettlementBatch)
          .set({  
            status: 'completed',
            onchainTransactionHash: paymentResult.transactionHash,
            completedAt: new Date(),
            updatedAt: new Date()
           } as any)
          .where(eq(riddlepadSettlementBatch.id, settlementBatchId));

        // Update all related fee records
        await tx.update(riddlepadFeeCollection)
          .set({  
            status: 'settled_onchain',
            feeTransactionHash: paymentResult.transactionHash,
            collectedAt: new Date(),
            updatedAt: new Date()
           } as any)
          .where(and(
            eq(riddlepadFeeCollection.launchId, settlementBatch.launchId),
            eq(riddlepadFeeCollection.status, 'settlement_pending')
          ));

        // Update ledger entries
        await tx.update(bankLedgerEntries)
          .set({  
            isSettled: true,
            settledAt: new Date()
           } as any)
          .where(eq(bankLedgerEntries.settlementBatchId, settlementBatchId));

        // Create final settlement completion ledger entry with decimal precision
        const currentBalance = await getCurrentBankBalance(settlementBatch.bankWalletAddress!);
        const newBalance = new Decimal(currentBalance).plus(settlementBatch.totalFeeAmount).toFixed(8);
        
        await tx.insert(bankLedgerEntries).values({
          entryType: 'settlement_completed',
          referenceId: settlementBatchId,
          amount: settlementBatch.totalFeeAmount,
          currency: 'XRP',
          usdValue: settlementBatch.totalFeeUsdValue,
          sourceWallet: settlementBatch.triggerWallet,
          sourceTransactionHash: paymentResult.transactionHash!,
          launchId: settlementBatch.launchId,
          bankWalletAddress: settlementBatch.bankWalletAddress!,
          runningBalance: newBalance,
          settlementBatchId: settlementBatchId,
          isSettled: true,
          settledAt: new Date(),
          memo: settlementBatch.settlementMemo,
          description: `On-chain settlement completed for launch ${settlementBatch.launchId}`,
        });
      });

      console.log(`✅ [SETTLEMENT] Batch ${settlementBatchId} completed successfully`);
      console.log(`   🔗 Transaction Hash: ${paymentResult.transactionHash}`);
      
      return { success: true, transactionHash: paymentResult.transactionHash };
      
    } else {
      // Transaction failed - update status
      await db.update(riddlepadSettlementBatch)
        .set({  
          status: 'failed',
          failureReason: paymentResult.error,
          retryCount: 1,
          updatedAt: new Date()
         } as any)
        .where(eq(riddlepadSettlementBatch.id, settlementBatchId));

      console.error(`❌ [SETTLEMENT] Batch ${settlementBatchId} failed: ${paymentResult.error}`);
      return { success: false, error: paymentResult.error };
    }
    
  } catch (error: any) {
    console.error(`❌ [SETTLEMENT] Error transmitting batch ${settlementBatchId}:`, error);
    
    // Update batch with failure status
    try {
      await db.update(riddlepadSettlementBatch)
        .set({  
          status: 'failed',
          failureReason: error.message,
          retryCount: 1,
          updatedAt: new Date()
         } as any)
        .where(eq(riddlepadSettlementBatch.id, settlementBatchId));
    } catch (updateError) {
      console.error(`❌ [SETTLEMENT] Failed to update batch status:`, updateError);
    }
    
    return { success: false, error: error.message };
  }
}

// Helper function to verify NFT holdings
async function verifyNftHoldings(walletAddress: string): Promise<{ isNftHolder: boolean; verifiedCollections: string[] }> {
  try {
    const response = await fetch('http://localhost:5000/api/devtools/nft/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        walletAddress, 
        collections: ['riddle_nfts'] // Placeholder
      })
    });
    
    if (response.ok) {
      const data = await response.json() as any;
      return {
        isNftHolder: data.isNftHolder,
        verifiedCollections: data.verifiedCollections
      };
    }
  } catch (error) {
    console.error('Error verifying NFT holdings:', error);
  }
  
  return { isNftHolder: false, verifiedCollections: [] };
}

// Helper function to calculate bonding curve price
async function calculateBondingCurvePrice(launch: TokenLaunch, newInvestment: string) {
  try {
    const response = await fetch('http://localhost:5000/api/devtools/bonding-curve/calculate-price', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        basePrice: launch.basePrice,
        curveCoefficient: launch.curveCoefficient,
        totalInvested: launch.totalRaised,
        fundingGoal: launch.fundingGoal,
        newInvestment
      })
    });
    
    if (response.ok) {
      return await response.json() as any;
    }
  } catch (error) {
    console.error('Error calculating bonding curve price:', error);
  }
  
  return null;
}

// Helper function to check access permissions
function checkLaunchAccess(launch: TokenLaunch, isNftHolder: boolean): { canAccess: boolean; reason?: string } {
  const now = new Date();
  
  // Check if launch is active
  if (launch.status !== 'active') {
    return { canAccess: false, reason: 'Launch is not active' };
  }
  
  // NFT holders get 2-hour priority access
  if (launch.enableNftGating && launch.nftHoldersStartTime && launch.nftHoldersEndTime) {
    const nftStart = new Date(launch.nftHoldersStartTime);
    const nftEnd = new Date(launch.nftHoldersEndTime);
    
    // During NFT-only window
    if (now >= nftStart && now <= nftEnd) {
      if (!isNftHolder) {
        return { canAccess: false, reason: 'NFT holders only during this period' };
      }
      return { canAccess: true };
    }
  }
  
  // After NFT window, check if public sale has started
  if (launch.openSaleStartTime) {
    const publicStart = new Date(launch.openSaleStartTime);
    if (now >= publicStart) {
      return { canAccess: true };
    }
  }
  
  return { canAccess: false, reason: 'Launch not yet open to public' };
}

export function setupTokenLaunchpadAPI(app: Express) {
  // Register deployment endpoints
  setupDeploymentEndpoints(app);
  
  // Get all active token launches
  app.get("/api/launchpad/launches", async (req: Request, res: Response) => {
    try {
      const launches = await db
        .select()
        .from(tokenLaunches)
        .where(eq(tokenLaunches.status, "active"))
        .orderBy(desc(tokenLaunches.createdAt));
        
      res.json(launches);
    } catch (error) {
      console.error("Error fetching launches:", error);
      res.status(500).json({ error: "Failed to fetch launches" });
    }
  });

  // Get launch by ID with detailed information including bonding curve data
  app.get("/api/launchpad/launch/:id", async (req: Request, res: Response) => {
    try {
      const launchId = parseInt(req.params.id);
      
      const [launch] = await db
        .select()
        .from(tokenLaunches)
        .where(eq(tokenLaunches.id, launchId));
        
      if (!launch) {
        return res.status(404).json({ error: "Launch not found" });
      }

      // Get contribution stats
      const [stats] = await db
        .select({
          totalContributions: sum(presaleContributions.amount),
          contributorCount: count(),
        })
        .from(presaleContributions)
        .where(eq(presaleContributions.launchId, launchId));

      // Get recent contributions
      const recentContributions = await db
        .select()
        .from(presaleContributions)
        .where(eq(presaleContributions.launchId, launchId))
        .orderBy(desc(presaleContributions.createdAt))
        .limit(10);

      // Get price history for bonding curve chart
      const priceHistory = await db
        .select()
        .from(bondingCurvePriceHistory)
        .where(eq(bondingCurvePriceHistory.launchId, launchId))
        .orderBy(desc(bondingCurvePriceHistory.createdAt))
        .limit(100);

      // Get latest analytics
      const [analytics] = await db
        .select()
        .from(launchpadAnalytics)
        .where(eq(launchpadAnalytics.launchId, launchId))
        .orderBy(desc(launchpadAnalytics.timestamp))
        .limit(1);

      // Calculate current bonding curve pricing if enabled
      let currentPricing = null;
      if (launch.useBondingCurve) {
        const totalInvested = stats?.totalContributions || '0';
        const progressPercentage = new Decimal(totalInvested).div(new Decimal(launch.fundingGoal)).mul(100).toNumber();
        
        currentPricing = {
          currentPrice: launch.currentTokenPrice,
          marketCap: launch.currentMarketCap,
          progressPercentage: new Decimal(progressPercentage).toFixed(2),
          fundingGoal: launch.fundingGoal,
          totalRaised: totalInvested
        };
      }

      res.json({
        launch,
        stats,
        recentContributions,
        priceHistory,
        analytics,
        currentPricing
      });
    } catch (error) {
      console.error("Error fetching launch details:", error);
      res.status(500).json({ error: "Failed to fetch launch details" });
    }
  });

  // Enhanced contribution endpoint with bonding curve pricing and NFT verification
  app.post("/api/launchpad/contribute/:id", sessionAuth, async (req: Request, res: Response) => {
    try {
      const launchId = parseInt(req.params.id);
      const { amount, transactionHash } = req.body;
      const contributorWallet = req.session?.user_handle || req.body.contributorWallet;

      if (!contributorWallet || !amount || !transactionHash) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Get launch details
      const [launch] = await db
        .select()
        .from(tokenLaunches)
        .where(eq(tokenLaunches.id, launchId));

      if (!launch) {
        return res.status(404).json({ error: "Launch not found" });
      }

      // Verify NFT holdings for access control
      const nftVerification = await verifyNftHoldings(contributorWallet);
      const accessCheck = checkLaunchAccess(launch, nftVerification.isNftHolder);

      if (!accessCheck.canAccess) {
        return res.status(403).json({ error: accessCheck.reason });
      }

      // Calculate bonding curve pricing if enabled
      let pricingData = null;
      let tokenAmount = '0';
      let nftHolderDiscount = '0';

      if (launch.useBondingCurve) {
        pricingData = await calculateBondingCurvePrice(launch, amount);
        if (!pricingData) {
          return res.status(500).json({ error: "Failed to calculate bonding curve price" });
        }
        
        tokenAmount = pricingData.tokensReceived;
        
        // Apply NFT holder discount with decimal precision
        if (nftVerification.isNftHolder && new Decimal(launch.nftHolderDiscount).gt(0)) {
          nftHolderDiscount = launch.nftHolderDiscount;
          const discountMultiplier = new Decimal(1).plus(new Decimal(nftHolderDiscount).div(100));
          tokenAmount = new Decimal(tokenAmount).mul(discountMultiplier).toFixed(8);
        }
      } else {
        // Static pricing fallback with decimal precision
        tokenAmount = new Decimal(amount).div(launch.presalePrice).toFixed(8);
      }

      // Create contribution record
      const [contribution] = await db.insert(presaleContributions).values({
        launchId,
        contributorWallet,
        amount,
        stage: nftVerification.isNftHolder ? 'nft_holders' : 'open_sale',
        transactionHash,
        tokenAmount,
        tokenPriceAtPurchase: pricingData?.averagePrice || launch.presalePrice,
        marketCapAtPurchase: pricingData?.newMarketCap || '0',
        isNftHolder: nftVerification.isNftHolder,
        nftHolderDiscount,
        verifiedNftCollections: nftVerification.verifiedCollections
      } as any).returning();

      // Update launch totals with decimal precision
      const newTotalRaised = new Decimal(launch.totalRaised).plus(amount).toFixed(8);
      const newParticipantCount = launch.participantCount + 1;
      
      // Update current token price and market cap for bonding curve
      let updateData: any = {
        totalRaised: newTotalRaised,
        participantCount: newParticipantCount
      };

      if (launch.useBondingCurve && pricingData) {
        updateData.currentTokenPrice = pricingData.newPrice;
        updateData.currentMarketCap = pricingData.newMarketCap;
      }

      await db.update(tokenLaunches)
        .set(updateData)
        .where(eq(tokenLaunches.id, launchId));

      // Record price history
      if (launch.useBondingCurve && pricingData) {
        await db.insert(bondingCurvePriceHistory).values({
          launchId,
          tokenPrice: pricingData.newPrice,
          marketCap: pricingData.newMarketCap,
          totalInvested: newTotalRaised,
          tokensCirculating: tokenAmount,
          contributionId: contribution.id
        } as any);
      }

      // Create monitoring event
      await db.insert(launchpadMonitoringEvents).values({
        launchId,
        eventType: 'contribution_received',
        eventData: {
          contributorWallet,
          amount,
          tokenAmount,
          isNftHolder: nftVerification.isNftHolder,
          currentMarketCap: pricingData?.newMarketCap || '0',
          progress: pricingData?.progressPercentage || '0'
        },
        severity: 'info'
      } as any);

      // Check if funding goal reached for auto-launch
      let curveCompletionFeeResult = null;
      if (new Decimal(newTotalRaised).gte(new Decimal(launch.fundingGoal)) && launch.autoLaunchEnabled && !launch.autoLaunchTriggered) {
        await db.update(tokenLaunches)
          .set({  autoLaunchTriggered: true  } as any)
          .where(eq(tokenLaunches.id, launchId));

        // Calculate and collect 10% curve completion fee
        const curveCompletionFeeAmount = new Decimal(newTotalRaised).mul(RIDDLEPAD_FEES.CURVE_COMPLETION_FEE).div(100).toFixed(8);
        // Calculate USD value using live XRP price from price service
        let curveCompletionFeeUsd = '0.0000';
        try {
          const { getTokenPrice } = await import('../price-service.js');
          const xrpTokenPrice = await getTokenPrice('XRP');
          
          if (xrpTokenPrice && xrpTokenPrice.price_usd > 0) {
            curveCompletionFeeUsd = new Decimal(curveCompletionFeeAmount).mul(xrpTokenPrice.price_usd).toFixed(4);
            console.log(`💰 [LAUNCHPAD] Using live XRP price $${xrpTokenPrice.price_usd} for fee calculation`);
          } else {
            console.log('⚠️ [LAUNCHPAD] Live XRP price unavailable, fee USD value set to 0');
          }
        } catch (error) {
          console.log('⚠️ [LAUNCHPAD] Price service failed for fee calculation:', error);
        }
        
        const curveCompletionData = {
          totalRaised: newTotalRaised,
          fundingGoal: launch.fundingGoal,
          participantCount: newParticipantCount,
          finalMarketCap: pricingData?.newMarketCap || '0',
          completionTimestamp: new Date().toISOString()
        };

        // Collect 10% curve completion fee
        curveCompletionFeeResult = await collectRiddlePadFee({
          launchId,
          feeType: 'curve_completion',
          feeAmount: curveCompletionFeeAmount,
          feeToken: 'XRP',
          feeUsdValue: curveCompletionFeeUsd,
          feePercentage: RIDDLEPAD_FEES.CURVE_COMPLETION_FEE,
          sourceTransactionHash: transactionHash,
          sourceWallet: contributorWallet,
          sourceAmount: newTotalRaised,
          curveCompletionData
        });

        console.log(`🎉 [RIDDLEPAD] Curve completion fee collected: ${curveCompletionFeeAmount} XRP (${RIDDLEPAD_FEES.CURVE_COMPLETION_FEE}% of ${newTotalRaised} XRP)`);

        // 🎓 TRIGGER GRADUATION SETTLEMENT (PHASE 2)
        let graduationSettlementResult = null;
        if (curveCompletionFeeResult?.success) {
          console.log(`🎓 [GRADUATION] Triggering settlement for completed launch ${launchId}`);
          
          graduationSettlementResult = await createGraduationSettlement({
            launchId,
            triggerWallet: contributorWallet,
            triggerTransactionHash: transactionHash
          });

          if (graduationSettlementResult.success && graduationSettlementResult.settlementBatch) {
            console.log(`✅ [GRADUATION] Settlement batch created: ${graduationSettlementResult.settlementBatch.id}`);
            console.log(`   📊 Total Settlement: ${graduationSettlementResult.settlementBatch.totalFeeAmount} XRP`);
            console.log(`   📊 Fee Count: ${graduationSettlementResult.settlementBatch.feeCount}`);
            
            // If on-chain settlement is enabled, automatically transmit
            if (RIDDLEPAD_FEES.ONCHAIN_SETTLEMENT_ENABLED) {
              console.log(`🔗 [GRADUATION] Auto-transmitting settlement to blockchain...`);
              
              const transmissionResult = await transmitSettlementOnChain(graduationSettlementResult.settlementBatch.id);
              
              if (transmissionResult.success) {
                console.log(`✅ [GRADUATION] On-chain settlement completed: ${transmissionResult.transactionHash}`);
              } else {
                console.error(`❌ [GRADUATION] On-chain settlement failed: ${transmissionResult.error}`);
              }
            } else {
              console.log(`📊 [GRADUATION] Settlement batch created (on-chain settlement disabled)`);
            }
          } else {
            console.error(`❌ [GRADUATION] Failed to create settlement batch: ${graduationSettlementResult.error}`);
          }
        }

        // Create auto-launch monitoring event
        await db.insert(launchpadMonitoringEvents).values({
          launchId,
          eventType: 'goal_reached',
          eventData: {
            finalAmount: newTotalRaised,
            fundingGoal: launch.fundingGoal,
            triggerTime: new Date().toISOString(),
            curveCompletionFee: curveCompletionFeeAmount,
            feeCollectionStatus: curveCompletionFeeResult?.success ? 'success' : 'failed',
            graduationSettlement: graduationSettlementResult ? {
              batchId: graduationSettlementResult.settlementBatch?.id,
              status: graduationSettlementResult.success ? 'success' : 'failed',
              totalAmount: graduationSettlementResult.settlementBatch?.totalFeeAmount,
              onchainSettlementEnabled: RIDDLEPAD_FEES.ONCHAIN_SETTLEMENT_ENABLED
            } : null
          },
          severity: 'critical',
          adminNotified: false
        });
      }

      console.log(`✅ [LAUNCHPAD] Contribution recorded: ${amount} from ${contributorWallet} (NFT: ${nftVerification.isNftHolder})`);

      res.json({
        success: true,
        contribution,
        pricingData,
        nftVerification,
        curveCompletionFee: curveCompletionFeeResult,
        launchStatus: {
          totalRaised: newTotalRaised,
          progressPercentage: pricingData?.progressPercentage || new Decimal(newTotalRaised).div(new Decimal(launch.fundingGoal)).mul(100).toFixed(2),
          autoLaunchTriggered: new Decimal(newTotalRaised).gte(new Decimal(launch.fundingGoal)),
          feeStructure: {
            curveCompletionFee: `${RIDDLEPAD_FEES.CURVE_COMPLETION_FEE}%`,
            swapFee: `${RIDDLEPAD_FEES.SWAP_FEE}%`,
            bankWallet: RIDDLEPAD_FEES.BANK_WALLET_ADDRESS
          }
        }
      });

    } catch (error) {
      console.error("❌ Error processing contribution:", error);
      res.status(500).json({ error: "Failed to process contribution" });
    }
  });

  // Check launch access for a wallet
  app.post("/api/launchpad/check-access/:id", async (req: Request, res: Response) => {
    try {
      const launchId = parseInt(req.params.id);
      const { walletAddress } = req.body;

      if (!walletAddress) {
        return res.status(400).json({ error: "Wallet address required" });
      }

      const [launch] = await db
        .select()
        .from(tokenLaunches)
        .where(eq(tokenLaunches.id, launchId));

      if (!launch) {
        return res.status(404).json({ error: "Launch not found" });
      }

      const nftVerification = await verifyNftHoldings(walletAddress);
      const accessCheck = checkLaunchAccess(launch, nftVerification.isNftHolder);

      // Calculate time remaining for NFT window
      let timeRemaining = null;
      if (launch.enableNftGating && launch.nftHoldersEndTime) {
        const now = new Date();
        const endTime = new Date(launch.nftHoldersEndTime);
        if (now < endTime) {
          timeRemaining = Math.max(0, endTime.getTime() - now.getTime());
        }
      }

      res.json({
        canAccess: accessCheck.canAccess,
        reason: accessCheck.reason,
        isNftHolder: nftVerification.isNftHolder,
        verifiedCollections: nftVerification.verifiedCollections,
        nftWindowTimeRemaining: timeRemaining,
        currentStage: launch.currentStage,
        nftHolderDiscount: launch.nftHolderDiscount
      });

    } catch (error) {
      console.error("Error checking launch access:", error);
      res.status(500).json({ error: "Failed to check access" });
    }
  });

  // Create new token launch
  app.post("/api/launchpad/create", async (req: Request, res: Response) => {
    try {
      const validatedData = insertTokenLaunchSchema.parse(req.body);
      
      // Create active launch directly (no fee required)
      const [newLaunch] = await db
        .insert(tokenLaunches)
        .values({
          ...validatedData,
          status: "active",
          currentStage: "nft_holders",
          setupFeePaid: true, // Mark as paid since no fee is required
        } as any)
        .returning();

      res.json({
        launch: newLaunch,
        message: "Token launch created successfully - no fees required!"
      });
    } catch (error) {
      console.error("Error creating launch:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create launch" });
    }
  });

  // Payment confirmation endpoint removed - no fees required anymore

  // Update launch stage and timings
  app.put("/api/launchpad/launch/:id/stage", async (req: Request, res: Response) => {
    try {
      const launchId = parseInt(req.params.id);
      const { stage, timings } = req.body;

      const updates: any = {
        currentStage: stage,
        updatedAt: new Date(),
      };

      // Update stage-specific timings
      if (timings) {
        if (timings.whitelistStart) updates.whitelistStartTime = new Date(timings.whitelistStart);
        if (timings.whitelistEnd) updates.whitelistEndTime = new Date(timings.whitelistEnd);
        if (timings.nftHoldersStart) updates.nftHoldersStartTime = new Date(timings.nftHoldersStart);
        if (timings.nftHoldersEnd) updates.nftHoldersEndTime = new Date(timings.nftHoldersEnd);
        if (timings.openWlStart) updates.openWlStartTime = new Date(timings.openWlStart);
        if (timings.openWlEnd) updates.openWlEndTime = new Date(timings.openWlEnd);
        if (timings.openSaleStart) updates.openSaleStartTime = new Date(timings.openSaleStart);
        if (timings.openSaleEnd) updates.openSaleEndTime = new Date(timings.openSaleEnd);
      }

      const [updatedLaunch] = await db
        .update(tokenLaunches)
        .set(updates)
        .where(eq(tokenLaunches.id, launchId))
        .returning();

      res.json({ launch: updatedLaunch });
    } catch (error) {
      console.error("Error updating launch stage:", error);
      res.status(500).json({ error: "Failed to update launch stage" });
    }
  });

  // Add to whitelist
  app.post("/api/launchpad/whitelist/:id", async (req: Request, res: Response) => {
    try {
      const launchId = parseInt(req.params.id);
      const { walletAddress, stage, maxAllocation, addedBy } = req.body;

      const [whitelistEntry] = await db
        .insert(launchpadWhitelist)
        .values({
          launchId,
          walletAddress,
          stage,
          maxAllocation,
          addedBy,
        } as any)
        .returning();

      res.json({ whitelistEntry });
    } catch (error) {
      console.error("Error adding to whitelist:", error);
      res.status(500).json({ error: "Failed to add to whitelist" });
    }
  });

  // Get whitelist for a launch
  app.get("/api/launchpad/whitelist/:id", async (req: Request, res: Response) => {
    try {
      const launchId = parseInt(req.params.id);
      const stage = req.query.stage as string;

      let query = db
        .select()
        .from(launchpadWhitelist)
        .where(eq(launchpadWhitelist.launchId, launchId));

      if (stage) {
        query = query.where(eq(launchpadWhitelist.stage, stage));
      }

      const whitelist = await query.orderBy(desc(launchpadWhitelist.createdAt));
      
      res.json(whitelist);
    } catch (error) {
      console.error("Error fetching whitelist:", error);
      res.status(500).json({ error: "Failed to fetch whitelist" });
    }
  });

  // Contribute to presale
  app.post("/api/launchpad/contribute/:id", async (req: Request, res: Response) => {
    try {
      const launchId = parseInt(req.params.id);
      const { contributorWallet, amount, transactionHash, stage } = req.body;

      // Get launch details
      const [launch] = await db
        .select()
        .from(tokenLaunches)
        .where(eq(tokenLaunches.id, launchId));

      if (!launch || launch.status !== "active") {
        return res.status(400).json({ error: "Launch not active" });
      }

      // Calculate token amount based on presale price
      const tokenAmount = new Decimal(amount).div(new Decimal(launch.presalePrice)).toNumber();

      // Record contribution
      const [contribution] = await db
        .insert(presaleContributions)
        .values({
          launchId,
          contributorWallet,
          amount,
          stage,
          transactionHash,
          tokenAmount: tokenAmount.toString(),
        })
        .returning();

      // Update launch totals
      const currentRaised = new Decimal(launch.totalRaised).plus(new Decimal(amount)).toNumber();
      const currentParticipants = launch.participantCount + 1;

      await db
        .update(tokenLaunches)
        .set({ 
          totalRaised: currentRaised.toString(),
          participantCount: currentParticipants,
          updatedAt: new Date(),
         } as any)
        .where(eq(tokenLaunches.id, launchId));

      // Check if liquidity threshold reached
      if (new Decimal(currentRaised).gte(new Decimal(launch.liquidityThreshold)) && !launch.liquidityCreated) {
        // TODO: Trigger liquidity creation
        console.log(`🚀 Liquidity threshold reached for launch ${launchId}`);
      }

      res.json({ contribution });
    } catch (error) {
      console.error("Error processing contribution:", error);
      res.status(500).json({ error: "Failed to process contribution" });
    }
  });

  // Get user's contributions
  app.get("/api/launchpad/contributions/:wallet", async (req: Request, res: Response) => {
    try {
      const walletAddress = req.params.wallet;
      
      const contributions = await db
        .select({
          contribution: presaleContributions,
          launch: tokenLaunches,
        })
        .from(presaleContributions)
        .innerJoin(tokenLaunches, eq(presaleContributions.launchId, tokenLaunches.id))
        .where(eq(presaleContributions.contributorWallet, walletAddress))
        .orderBy(desc(presaleContributions.createdAt));

      res.json(contributions);
    } catch (error) {
      console.error("Error fetching user contributions:", error);
      res.status(500).json({ error: "Failed to fetch contributions" });
    }
  });

  // Get launches created by user
  app.get("/api/launchpad/my-launches/:wallet", async (req: Request, res: Response) => {
    try {
      const walletAddress = req.params.wallet;
      
      const launches = await db
        .select()
        .from(tokenLaunches)
        .where(eq(tokenLaunches.creatorWallet, walletAddress))
        .orderBy(desc(tokenLaunches.createdAt));

      res.json(launches);
    } catch (error) {
      console.error("Error fetching user launches:", error);
      res.status(500).json({ error: "Failed to fetch user launches" });
    }
  });

  // Check if wallet is whitelisted for specific stage
  app.get("/api/launchpad/check-whitelist/:launchId/:wallet", async (req: Request, res: Response) => {
    try {
      const { launchId, wallet } = req.params;
      const stage = req.query.stage as string;

      const [whitelistEntry] = await db
        .select()
        .from(launchpadWhitelist)
        .where(and(
          eq(launchpadWhitelist.launchId, parseInt(launchId)),
          eq(launchpadWhitelist.walletAddress, wallet),
          stage ? eq(launchpadWhitelist.stage, stage) : undefined
        ));

      res.json({ 
        isWhitelisted: !!whitelistEntry,
        entry: whitelistEntry || null
      });
    } catch (error) {
      console.error("Error checking whitelist:", error);
      res.status(500).json({ error: "Failed to check whitelist" });
    }
  });

  // RiddlePad Fee Management Endpoints
  
  // Get fee collection history for a launch
  app.get("/api/launchpad/fees/:launchId", async (req: Request, res: Response) => {
    try {
      const launchId = parseInt(req.params.launchId);
      
      const fees = await db
        .select()
        .from(riddlepadFeeCollection)
        .where(eq(riddlepadFeeCollection.launchId, launchId))
        .orderBy(desc(riddlepadFeeCollection.createdAt));
      
      res.json({ fees });
    } catch (error) {
      console.error("Error fetching fees:", error);
      res.status(500).json({ error: "Failed to fetch fees" });
    }
  });
  
  // Get RiddlePad fee configuration
  app.get("/api/launchpad/fee-config", async (req: Request, res: Response) => {
    try {
      res.json({
        curveCompletionFee: RIDDLEPAD_FEES.CURVE_COMPLETION_FEE,
        swapFee: RIDDLEPAD_FEES.SWAP_FEE,
        bankWalletAddress: RIDDLEPAD_FEES.BANK_WALLET_ADDRESS,
        feeCollectionEnabled: RIDDLEPAD_FEES.FEE_COLLECTION_ENABLED,
        description: {
          curveCompletionFee: "Collected when bonding curve reaches funding goal",
          swapFee: "Collected on every token swap/trade transaction",
          bankWallet: "All fees are sent to this designated wallet"
        }
      });
    } catch (error) {
      console.error("Error fetching fee config:", error);
      res.status(500).json({ error: "Failed to fetch fee config" });
    }
  });
  
  // Get total fees collected across all launches
  app.get("/api/launchpad/fees-summary", async (req: Request, res: Response) => {
    try {
      const summary = await db
        .select({
          totalFeesCollected: sum(riddlepadFeeCollection.feeAmount),
          totalFeesUsd: sum(riddlepadFeeCollection.feeUsdValue),
          curveCompletionFees: count(riddlepadFeeCollection.id).where(eq(riddlepadFeeCollection.feeType, 'curve_completion')),
          swapFees: count(riddlepadFeeCollection.id).where(eq(riddlepadFeeCollection.feeType, 'swap_fee')),
        })
        .from(riddlepadFeeCollection)
        .where(eq(riddlepadFeeCollection.status, 'collected'));
      
      res.json({ summary: summary[0] });
    } catch (error) {
      console.error("Error fetching fees summary:", error);
      res.status(500).json({ error: "Failed to fetch fees summary" });
    }
  });
  
  // Simulate 1% swap fee collection (for existing swap integrations)
  app.post("/api/launchpad/collect-swap-fee", async (req: Request, res: Response) => {
    try {
      const { 
        launchId, 
        swapAmount, 
        swapToken = 'XRP',
        sourceTransactionHash, 
        sourceWallet,
        swapUsdValue 
      } = req.body;
      
      if (!launchId || !swapAmount || !sourceTransactionHash || !sourceWallet) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      // Calculate 1% swap fee
      const swapFeeAmount = new Decimal(swapAmount).mul(RIDDLEPAD_FEES.SWAP_FEE).div(100).toFixed(8);
      const swapFeeUsd = swapUsdValue ? 
        new Decimal(swapUsdValue).mul(RIDDLEPAD_FEES.SWAP_FEE).div(100).toFixed(4) :
        new Decimal(swapFeeAmount).mul(3.06).toFixed(4); // Fallback to estimated XRP price
      
      const feeResult = await collectRiddlePadFee({
        launchId,
        feeType: 'swap_fee',
        feeAmount: swapFeeAmount,
        feeToken: swapToken,
        feeUsdValue: swapFeeUsd,
        feePercentage: RIDDLEPAD_FEES.SWAP_FEE,
        sourceTransactionHash,
        sourceWallet,
        sourceAmount: swapAmount
      });
      
      res.json({
        success: feeResult.success,
        swapFeeAmount,
        swapFeeUsd,
        feeRecord: feeResult.feeRecord,
        error: feeResult.error
      });
      
    } catch (error) {
      console.error("Error collecting swap fee:", error);
      res.status(500).json({ error: "Failed to collect swap fee" });
    }
  });

  // ============== TWO-PHASE FEE SYSTEM API ENDPOINTS ==============
  
  // GET /api/fees/preview/:launchId - comprehensive fee summary for launch
  app.get("/api/fees/preview/:launchId", async (req: Request, res: Response) => {
    try {
      const launchId = parseInt(req.params.launchId);
      
      if (isNaN(launchId)) {
        return res.status(400).json({ error: "Invalid launch ID" });
      }

      // Get all fee records for this launch
      const feeRecords = await db
        .select()
        .from(riddlepadFeeCollection)
        .where(eq(riddlepadFeeCollection.launchId, launchId))
        .orderBy(desc(riddlepadFeeCollection.createdAt));

      // Get settlement batch if exists
      const [settlementBatch] = await db
        .select()
        .from(riddlepadSettlementBatch)
        .where(eq(riddlepadSettlementBatch.launchId, launchId))
        .limit(1);

      // Get bank ledger entries for this launch
      const ledgerEntries = await db
        .select()
        .from(bankLedgerEntries)
        .where(eq(bankLedgerEntries.launchId, launchId))
        .orderBy(desc(bankLedgerEntries.createdAt));

      // Calculate summary statistics
      const accruedFees = feeRecords.filter(f => f.status === 'accrued');
      const settledFees = feeRecords.filter(f => f.status === 'settled_onchain');
      
      const totalAccrued = accruedFees.reduce((sum, fee) => sum.plus(new Decimal(fee.feeAmount)), new Decimal(0)).toNumber();
      const totalAccruedUsd = accruedFees.reduce((sum, fee) => sum.plus(new Decimal(fee.feeUsdValue)), new Decimal(0)).toNumber();
      const totalSettled = settledFees.reduce((sum, fee) => sum.plus(new Decimal(fee.feeAmount)), new Decimal(0)).toNumber();
      const totalSettledUsd = settledFees.reduce((sum, fee) => sum.plus(new Decimal(fee.feeUsdValue)), new Decimal(0)).toNumber();

      // Fee breakdown by type
      const curveCompletionFees = feeRecords.filter(f => f.feeType === 'curve_completion');
      const swapFees = feeRecords.filter(f => f.feeType === 'swap_fee');

      const feePreview = {
        launchId,
        summary: {
          totalFeesAccrued: new Decimal(totalAccrued).toFixed(8),
          totalFeesAccruedUsd: new Decimal(totalAccruedUsd).toFixed(2),
          totalFeesSettled: new Decimal(totalSettled).toFixed(8),
          totalFeesSettledUsd: new Decimal(totalSettledUsd).toFixed(2),
          feeCount: feeRecords.length,
          accruedCount: accruedFees.length,
          settledCount: settledFees.length,
        },
        breakdown: {
          curveCompletionFees: {
            count: curveCompletionFees.length,
            totalAmount: curveCompletionFees.reduce((sum, f) => sum.plus(new Decimal(f.feeAmount)), new Decimal(0)).toFixed(8),
            totalUsd: curveCompletionFees.reduce((sum, f) => sum.plus(new Decimal(f.feeUsdValue)), new Decimal(0)).toFixed(2),
          },
          swapFees: {
            count: swapFees.length,
            totalAmount: swapFees.reduce((sum, f) => sum.plus(new Decimal(f.feeAmount)), new Decimal(0)).toFixed(8),
            totalUsd: swapFees.reduce((sum, f) => sum.plus(new Decimal(f.feeUsdValue)), new Decimal(0)).toFixed(2),
          }
        },
        settlement: settlementBatch ? {
          batchId: settlementBatch.id,
          status: settlementBatch.status,
          totalAmount: settlementBatch.totalFeeAmount,
          totalUsd: settlementBatch.totalFeeUsdValue,
          settlementMemo: settlementBatch.settlementMemo,
          createdAt: settlementBatch.createdAt,
          transmittedAt: settlementBatch.transmittedAt,
          completedAt: settlementBatch.completedAt,
          onchainTransactionHash: settlementBatch.onchainTransactionHash,
        } : null,
        configuration: {
          feeAccountingEnabled: RIDDLEPAD_FEES.FEE_ACCOUNTING_ENABLED,
          onchainSettlementEnabled: RIDDLEPAD_FEES.ONCHAIN_SETTLEMENT_ENABLED,
          bankWalletConfigured: !!RIDDLEPAD_FEES.BANK_WALLET_ADDRESS,
          curveCompletionFeeRate: RIDDLEPAD_FEES.CURVE_COMPLETION_FEE,
          swapFeeRate: RIDDLEPAD_FEES.SWAP_FEE,
        },
        feeRecords: feeRecords.slice(0, 20), // Last 20 fee records
        ledgerEntries: ledgerEntries.slice(0, 10), // Last 10 ledger entries
      };

      res.json(feePreview);
      
    } catch (error) {
      console.error("Error generating fee preview:", error);
      res.status(500).json({ error: "Failed to generate fee preview" });
    }
  });

  // POST /api/fees/settlements/:launchId/create - trigger graduation settlement
  app.post("/api/fees/settlements/:launchId/create", sessionAuth, async (req: Request, res: Response) => {
    try {
      const launchId = parseInt(req.params.launchId);
      const { triggerWallet, triggerTransactionHash } = req.body;
      
      if (isNaN(launchId)) {
        return res.status(400).json({ error: "Invalid launch ID" });
      }

      if (!triggerWallet || !triggerTransactionHash) {
        return res.status(400).json({ 
          error: "Missing required fields: triggerWallet, triggerTransactionHash" 
        });
      }

      console.log(`🎓 [API] Creating graduation settlement for launch ${launchId}`);
      console.log(`🎓 [API] Trigger: ${triggerWallet} | Tx: ${triggerTransactionHash}`);

      // Create graduation settlement batch
      const settlementResult = await createGraduationSettlement({
        launchId,
        triggerWallet,
        triggerTransactionHash
      });

      if (!settlementResult.success) {
        return res.status(500).json({ 
          error: settlementResult.error || 'Failed to create settlement batch' 
        });
      }

      // If on-chain settlement is enabled, automatically transmit
      let transmissionResult = null;
      if (RIDDLEPAD_FEES.ONCHAIN_SETTLEMENT_ENABLED && settlementResult.settlementBatch) {
        console.log(`🔗 [API] Auto-transmitting settlement batch: ${settlementResult.settlementBatch.id}`);
        
        transmissionResult = await transmitSettlementOnChain(settlementResult.settlementBatch.id);
        
        if (!transmissionResult.success) {
          console.error(`❌ [API] Auto-transmission failed: ${transmissionResult.error}`);
        }
      }

      res.json({
        success: true,
        settlementBatch: settlementResult.settlementBatch,
        autoTransmitted: !!transmissionResult,
        transmissionResult: transmissionResult,
        message: settlementResult.settlementBatch ? 
          `Settlement batch created with ${settlementResult.settlementBatch.feeCount} fees totaling ${settlementResult.settlementBatch.totalFeeAmount} XRP` :
          'No accrued fees found for graduation settlement'
      });
      
    } catch (error) {
      console.error("Error creating graduation settlement:", error);
      res.status(500).json({ error: "Failed to create graduation settlement" });
    }
  });

  // POST /api/fees/settlements/:id/transmit-onchain - manually transmit settlement on-chain
  app.post("/api/fees/settlements/:id/transmit-onchain", sessionAuth, async (req: Request, res: Response) => {
    try {
      const settlementBatchId = req.params.id;
      
      if (!settlementBatchId) {
        return res.status(400).json({ error: "Invalid settlement batch ID" });
      }

      console.log(`🔗 [API] Manual transmission request for batch: ${settlementBatchId}`);

      // Transmit settlement batch on-chain
      const transmissionResult = await transmitSettlementOnChain(settlementBatchId);

      if (transmissionResult.success) {
        res.json({
          success: true,
          transactionHash: transmissionResult.transactionHash,
          message: transmissionResult.transactionHash ? 
            `Settlement transmitted successfully. Transaction: ${transmissionResult.transactionHash}` :
            'Settlement batch processed (on-chain settlement disabled)'
        });
      } else {
        res.status(500).json({
          success: false,
          error: transmissionResult.error || 'Transmission failed'
        });
      }
      
    } catch (error) {
      console.error("Error transmitting settlement:", error);
      res.status(500).json({ error: "Failed to transmit settlement" });
    }
  });

  console.log("🚀 Token Launchpad API routes registered successfully");
  console.log("💰 RiddlePad Two-Phase Fee Collection System:");
  console.log(`   📊 Fee Accounting: ${RIDDLEPAD_FEES.FEE_ACCOUNTING_ENABLED ? 'ENABLED' : 'DISABLED'}`);
  console.log(`   🔗 On-Chain Settlement: ${RIDDLEPAD_FEES.ONCHAIN_SETTLEMENT_ENABLED ? 'ENABLED' : 'DISABLED'}`);
  console.log(`   🏦 Bank Wallet: ${RIDDLEPAD_FEES.BANK_WALLET_ADDRESS || 'NOT CONFIGURED'}`);
  console.log(`   📈 Curve Completion Fee: ${RIDDLEPAD_FEES.CURVE_COMPLETION_FEE}%`);
  console.log(`   💱 Swap Fee: ${RIDDLEPAD_FEES.SWAP_FEE}%`);
  console.log("🎯 API Endpoints:");
  console.log("   📊 GET /api/fees/preview/:launchId");
  console.log("   🎓 POST /api/fees/settlements/:launchId/create");
  console.log("   🔗 POST /api/fees/settlements/:id/transmit-onchain");
}

// Export registration function for use in main routes.ts
export function registerTokenLaunchpadRoutes(app: Express) {
  setupTokenLaunchpadRoutes(app);
}