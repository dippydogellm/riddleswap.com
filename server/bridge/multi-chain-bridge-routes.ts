// Multi-Chain Bridge Execute Routes - Dedicated endpoint for each chain
import { Express } from 'express';
import { authenticateBridge } from './wallet-bridge-routes';
import { EVMBridgeHandler } from './evm-bridge';
import { XRPLBridgeHandler } from './xrpl-bridge';
import { SolanaBridgeHandler } from './solana-bridge';
import { BTCBridgeHandler } from './btc-bridge';
import { db } from '../db';
import { bridge_payloads } from '../../shared/schema';
import { eq } from 'drizzle-orm';

// Chain configurations
export const CHAIN_CONFIGS = {
  // Layer 1 Chains
  ethereum: {
    chainId: 1,
    name: 'Ethereum',
    nativeToken: 'ETH',
    rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com',
    explorerUrl: 'https://etherscan.io',
    icon: '⟠'
  },
  bsc: {
    chainId: 56,
    name: 'BNB Smart Chain',
    nativeToken: 'BNB',
    rpcUrl: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org',
    explorerUrl: 'https://bscscan.com',
    icon: '🔶'
  },
  polygon: {
    chainId: 137,
    name: 'Polygon',
    nativeToken: 'MATIC',
    rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
    explorerUrl: 'https://polygonscan.com',
    icon: '🟣'
  },
  avalanche: {
    chainId: 43114,
    name: 'Avalanche',
    nativeToken: 'AVAX',
    rpcUrl: process.env.AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc',
    explorerUrl: 'https://snowtrace.io',
    icon: '🔺'
  },
  
  // Layer 2 Chains
  arbitrum: {
    chainId: 42161,
    name: 'Arbitrum One',
    nativeToken: 'ETH',
    rpcUrl: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
    explorerUrl: 'https://arbiscan.io',
    icon: '🔵'
  },
  optimism: {
    chainId: 10,
    name: 'Optimism',
    nativeToken: 'ETH',
    rpcUrl: process.env.OPTIMISM_RPC_URL || 'https://mainnet.optimism.io',
    explorerUrl: 'https://optimistic.etherscan.io',
    icon: '🔴'
  },
  base: {
    chainId: 8453,
    name: 'Base',
    nativeToken: 'ETH',
    rpcUrl: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
    explorerUrl: 'https://basescan.org',
    icon: '🔷'
  },
  fantom: {
    chainId: 250,
    name: 'Fantom',
    nativeToken: 'FTM',
    rpcUrl: process.env.FANTOM_RPC_URL || 'https://rpc.ftm.tools',
    explorerUrl: 'https://ftmscan.com',
    icon: '👻'
  },
  cronos: {
    chainId: 25,
    name: 'Cronos',
    nativeToken: 'CRO',
    rpcUrl: process.env.CRONOS_RPC_URL || 'https://evm.cronos.org',
    explorerUrl: 'https://cronoscan.com',
    icon: '🦁'
  },
  gnosis: {
    chainId: 100,
    name: 'Gnosis',
    nativeToken: 'xDAI',
    rpcUrl: process.env.GNOSIS_RPC_URL || 'https://rpc.gnosischain.com',
    explorerUrl: 'https://gnosisscan.io',
    icon: '🦉'
  },
  celo: {
    chainId: 42220,
    name: 'Celo',
    nativeToken: 'CELO',
    rpcUrl: process.env.CELO_RPC_URL || 'https://forno.celo.org',
    explorerUrl: 'https://celoscan.io',
    icon: '🌱'
  },
  moonbeam: {
    chainId: 1284,
    name: 'Moonbeam',
    nativeToken: 'GLMR',
    rpcUrl: process.env.MOONBEAM_RPC_URL || 'https://rpc.api.moonbeam.network',
    explorerUrl: 'https://moonscan.io',
    icon: '🌙'
  },
  zksync: {
    chainId: 324,
    name: 'zkSync Era',
    nativeToken: 'ETH',
    rpcUrl: process.env.ZKSYNC_RPC_URL || 'https://mainnet.era.zksync.io',
    explorerUrl: 'https://explorer.zksync.io',
    icon: '⚡'
  },
  linea: {
    chainId: 59144,
    name: 'Linea',
    nativeToken: 'ETH',
    rpcUrl: process.env.LINEA_RPC_URL || 'https://rpc.linea.build',
    explorerUrl: 'https://lineascan.build',
    icon: '📐'
  },
  
  // Non-EVM Chains
  xrpl: {
    name: 'XRP Ledger',
    nativeToken: 'XRP',
    rpcUrl: process.env.XRPL_RPC_URL || 'wss://s1.ripple.com',
    explorerUrl: 'https://livenet.xrpl.org',
    icon: '✨'
  },
  solana: {
    name: 'Solana',
    nativeToken: 'SOL',
    rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    explorerUrl: 'https://explorer.solana.com',
    icon: '🟣'
  },
  bitcoin: {
    name: 'Bitcoin',
    nativeToken: 'BTC',
    rpcUrl: process.env.BITCOIN_RPC_URL || 'https://blockstream.info/api',
    explorerUrl: 'https://blockstream.info',
    icon: '₿'
  }
} as const;

export type ChainKey = keyof typeof CHAIN_CONFIGS;

// Helper to execute EVM bridge transaction - only for EVM chains with chainId
async function executeEVMBridge(req: any, res: any, chainKey: string) {
  const chainConfig = CHAIN_CONFIGS[chainKey as keyof typeof CHAIN_CONFIGS];
  
  // Type guard: ensure this is an EVM chain with chainId
  if (!chainConfig || !('chainId' in chainConfig)) {
    return res.status(400).json({
      success: false,
      error: `Invalid EVM chain: ${chainKey}`
    });
  }
  
  try {
    const { transactionId } = req.body;
    
    if (!transactionId) {
      return res.status(400).json({
        success: false,
        error: 'Transaction ID is required'
      });
    }

    const sessionId = (req as any).sessionID || (req.session as any)?.id;
    const ethPrivateKey = req.session?.cachedKeys?.ethPrivateKey;
    
    if (!sessionId || !ethPrivateKey) {
      console.error(`❌ [${chainKey.toUpperCase()} BRIDGE] No session ID or ETH private key`);
      return res.status(401).json({
        success: false,
        error: `Session not found. Please login.`
      });
    }

    console.log(`🌉 [${chainKey.toUpperCase()} BRIDGE] Executing bridge transaction on ${chainConfig.name}`);
    console.log(`   Chain ID: ${chainConfig.chainId}`);
    console.log(`   Native Token: ${chainConfig.nativeToken}`);
    console.log(`   Transaction ID: ${transactionId}`);

    // Execute bridge transaction using cached keys
    const result = await EVMBridgeHandler.executeEVMWithCachedKeys(
      transactionId,
      sessionId,
      chainKey.toUpperCase()
    );

    if (result.success) {
      return res.json({
        success: true,
        txHash: result.txHash,
        chain: chainConfig.name,
        chainId: chainConfig.chainId,
        explorerUrl: `${chainConfig.explorerUrl}/tx/${result.txHash}`,
        message: `Bridge transaction completed on ${chainConfig.name}`
      });
    } else {
      return res.status(400).json({
        success: false,
        error: result.error || 'Bridge execution failed'
      });
    }

  } catch (error) {
    console.error(`❌ [${chainKey.toUpperCase()} BRIDGE] Error:`, error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Bridge execution failed'
    });
  }
}

export function registerMultiChainBridgeRoutes(app: Express) {
  console.log('🌉 Registering multi-chain bridge execute routes...');

  // ==================================================
  // ETHEREUM MAINNET BRIDGE
  // ==================================================
  app.post("/api/bridge/ethereum/execute", authenticateBridge, async (req, res) => {
    await executeEVMBridge(req, res, 'ethereum');
  });

  // ==================================================
  // BSC (BNB SMART CHAIN) BRIDGE
  // ==================================================
  app.post("/api/bridge/bsc/execute", authenticateBridge, async (req, res) => {
    await executeEVMBridge(req, res, 'bsc');
  });

  // ==================================================
  // POLYGON BRIDGE
  // ==================================================
  app.post("/api/bridge/polygon/execute", authenticateBridge, async (req, res) => {
    await executeEVMBridge(req, res, 'polygon');
  });

  // ==================================================
  // ARBITRUM (LAYER 2) BRIDGE
  // ==================================================
  app.post("/api/bridge/arbitrum/execute", authenticateBridge, async (req, res) => {
    await executeEVMBridge(req, res, 'arbitrum');
  });

  // ==================================================
  // OPTIMISM (LAYER 2) BRIDGE
  // ==================================================
  app.post("/api/bridge/optimism/execute", authenticateBridge, async (req, res) => {
    await executeEVMBridge(req, res, 'optimism');
  });

  // ==================================================
  // BASE (LAYER 2) BRIDGE
  // ==================================================
  app.post("/api/bridge/base/execute", authenticateBridge, async (req, res) => {
    await executeEVMBridge(req, res, 'base');
  });

  // ==================================================
  // AVALANCHE BRIDGE
  // ==================================================
  app.post("/api/bridge/avalanche/execute", authenticateBridge, async (req, res) => {
    await executeEVMBridge(req, res, 'avalanche');
  });

  // ==================================================
  // FANTOM BRIDGE
  // ==================================================
  app.post("/api/bridge/fantom/execute", authenticateBridge, async (req, res) => {
    await executeEVMBridge(req, res, 'fantom');
  });

  // ==================================================
  // CRONOS BRIDGE
  // ==================================================
  app.post("/api/bridge/cronos/execute", authenticateBridge, async (req, res) => {
    await executeEVMBridge(req, res, 'cronos');
  });

  // ==================================================
  // GNOSIS BRIDGE
  // ==================================================
  app.post("/api/bridge/gnosis/execute", authenticateBridge, async (req, res) => {
    await executeEVMBridge(req, res, 'gnosis');
  });

  // ==================================================
  // CELO BRIDGE
  // ==================================================
  app.post("/api/bridge/celo/execute", authenticateBridge, async (req, res) => {
    await executeEVMBridge(req, res, 'celo');
  });

  // ==================================================
  // MOONBEAM BRIDGE
  // ==================================================
  app.post("/api/bridge/moonbeam/execute", authenticateBridge, async (req, res) => {
    await executeEVMBridge(req, res, 'moonbeam');
  });

  // ==================================================
  // ZKSYNC ERA BRIDGE
  // ==================================================
  app.post("/api/bridge/zksync/execute", authenticateBridge, async (req, res) => {
    await executeEVMBridge(req, res, 'zksync');
  });

  // ==================================================
  // LINEA BRIDGE
  // ==================================================
  app.post("/api/bridge/linea/execute", authenticateBridge, async (req, res) => {
    await executeEVMBridge(req, res, 'linea');
  });

  // ==================================================
  // XRPL BRIDGE
  // ==================================================
  app.post("/api/bridge/xrpl/execute", authenticateBridge, async (req, res) => {
    try {
      const { transactionId, amount, destinationAddress } = req.body;
      
      if (!transactionId) {
        return res.status(400).json({
          success: false,
          error: 'Transaction ID is required'
        });
      }

      const session = req.session;
      const xrpPrivateKey = session?.cachedKeys?.xrpPrivateKey;
      
      if (!xrpPrivateKey) {
        console.error('❌ [XRPL BRIDGE] No XRP private key in cached keys');
        return res.status(401).json({
          success: false,
          error: 'XRP wallet not found in session. Please login.'
        });
      }

      console.log('🌉 [XRPL BRIDGE] Executing bridge transaction on XRP Ledger');
      console.log('   Transaction ID:', transactionId);

      // Get bridge payload
      const bridgePayload = await db.select().from(bridge_payloads)
        .where(eq(bridge_payloads.transaction_id, transactionId))
        .limit(1);

      if (!bridgePayload.length) {
        return res.status(404).json({
          success: false,
          error: 'Bridge transaction not found'
        });
      }

      const sessionId = (req as any).sessionID || (req.session as any)?.id;
      
      if (!sessionId || !xrpPrivateKey) {
        console.error('❌ [XRPL BRIDGE] No session ID or XRP private key');
        return res.status(401).json({
          success: false,
          error: 'Session not found. Please login.'
        });
      }

      // Execute XRPL bridge with cached keys
      const result = await XRPLBridgeHandler.executeXRPLWithCachedKeys(
        transactionId,
        sessionId
      );

      if (result.success) {
        return res.json({
          success: true,
          txHash: result.txHash,
          chain: 'XRP Ledger',
          explorerUrl: `https://livenet.xrpl.org/transactions/${result.txHash}`,
          message: 'Bridge transaction completed on XRP Ledger'
        });
      } else {
        return res.status(400).json({
          success: false,
          error: result.error || 'Bridge execution failed'
        });
      }

    } catch (error) {
      console.error('❌ [XRPL BRIDGE] Error:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Bridge execution failed'
      });
    }
  });

  // ==================================================
  // SOLANA BRIDGE
  // ==================================================
  app.post("/api/bridge/solana/execute", authenticateBridge, async (req, res) => {
    try {
      const { transactionId, amount, destinationAddress } = req.body;
      
      if (!transactionId) {
        return res.status(400).json({
          success: false,
          error: 'Transaction ID is required'
        });
      }

      const session = req.session;
      const solPrivateKey = session?.cachedKeys?.solPrivateKey;
      
      if (!solPrivateKey) {
        console.error('❌ [SOLANA BRIDGE] No SOL private key in cached keys');
        return res.status(401).json({
          success: false,
          error: 'Solana wallet not found in session. Please login.'
        });
      }

      console.log('🌉 [SOLANA BRIDGE] Executing bridge transaction on Solana');
      console.log('   Transaction ID:', transactionId);

      // Get bridge payload
      const bridgePayload = await db.select().from(bridge_payloads)
        .where(eq(bridge_payloads.transaction_id, transactionId))
        .limit(1);

      if (!bridgePayload.length) {
        return res.status(404).json({
          success: false,
          error: 'Bridge transaction not found'
        });
      }

      const sessionId = (req as any).sessionID || (req.session as any)?.id;
      
      if (!sessionId || !solPrivateKey) {
        console.error('❌ [SOLANA BRIDGE] No session ID or SOL private key');
        return res.status(401).json({
          success: false,
          error: 'Session not found. Please login.'
        });
      }

      // Execute Solana bridge with cached keys
      const result = await SolanaBridgeHandler.executeSolanaWithCachedKeys(
        transactionId,
        sessionId
      );

      if (result.success) {
        return res.json({
          success: true,
          txHash: result.txHash,
          chain: 'Solana',
          explorerUrl: `https://explorer.solana.com/tx/${result.txHash}`,
          message: 'Bridge transaction completed on Solana'
        });
      } else {
        return res.status(400).json({
          success: false,
          error: result.error || 'Bridge execution failed'
        });
      }

    } catch (error) {
      console.error('❌ [SOLANA BRIDGE] Error:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Bridge execution failed'
      });
    }
  });

  // ==================================================
  // BITCOIN BRIDGE
  // ==================================================
  app.post("/api/bridge/bitcoin/execute", authenticateBridge, async (req, res) => {
    try {
      const { transactionId, amount, destinationAddress } = req.body;
      
      if (!transactionId) {
        return res.status(400).json({
          success: false,
          error: 'Transaction ID is required'
        });
      }

      const session = req.session;
      const btcPrivateKey = session?.cachedKeys?.btcPrivateKey;
      
      if (!btcPrivateKey) {
        console.error('❌ [BITCOIN BRIDGE] No BTC private key in cached keys');
        return res.status(401).json({
          success: false,
          error: 'Bitcoin wallet not found in session. Please login.'
        });
      }

      console.log('🌉 [BITCOIN BRIDGE] Executing bridge transaction on Bitcoin');
      console.log('   Transaction ID:', transactionId);

      // Get bridge payload
      const bridgePayload = await db.select().from(bridge_payloads)
        .where(eq(bridge_payloads.transaction_id, transactionId))
        .limit(1);

      if (!bridgePayload.length) {
        return res.status(404).json({
          success: false,
          error: 'Bridge transaction not found'
        });
      }

      const sessionId = (req as any).sessionID || (req.session as any)?.id;
      
      if (!sessionId || !btcPrivateKey) {
        console.error('❌ [BITCOIN BRIDGE] No session ID or BTC private key');
        return res.status(401).json({
          success: false,
          error: 'Session not found. Please login.'
        });
      }

      // Execute Bitcoin bridge with cached keys
      const result = await BTCBridgeHandler.executeBTCTransactionWithCachedKeys(
        transactionId,
        sessionId
      );

      if (result.success) {
        return res.json({
          success: true,
          txHash: result.txHash,
          chain: 'Bitcoin',
          explorerUrl: `https://blockstream.info/tx/${result.txHash}`,
          message: 'Bridge transaction completed on Bitcoin'
        });
      } else {
        return res.status(400).json({
          success: false,
          error: result.error || 'Bridge execution failed'
        });
      }

    } catch (error) {
      console.error('❌ [BITCOIN BRIDGE] Error:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Bridge execution failed'
      });
    }
  });

  // ==================================================
  // CHAIN INFO ENDPOINT - Get all supported chains
  // ==================================================
  app.get("/api/bridge/chains", async (req, res) => {
    const chains = Object.entries(CHAIN_CONFIGS).map(([key, config]) => ({
      key,
      name: config.name,
      nativeToken: config.nativeToken,
      chainId: 'chainId' in config ? config.chainId : null,
      explorerUrl: config.explorerUrl,
      icon: config.icon,
      executeEndpoint: `/api/bridge/${key}/execute`
    }));

    res.json({
      success: true,
      chains,
      totalChains: chains.length,
      evmChains: chains.filter(c => c.chainId !== null).length,
      nonEvmChains: chains.filter(c => c.chainId === null).length
    });
  });

  console.log('✅ Multi-chain bridge execute routes registered successfully');
  console.log(`   📊 Total chains: ${Object.keys(CHAIN_CONFIGS).length}`);
  console.log(`   ⟠ EVM chains: 14 (Ethereum, BSC, Polygon, Arbitrum, Optimism, Base, Avalanche, Fantom, Cronos, Gnosis, Celo, Moonbeam, zkSync, Linea)`);
  console.log(`   ✨ Non-EVM: 3 (XRPL, Solana, Bitcoin)`);
}
