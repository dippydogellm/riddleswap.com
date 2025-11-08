/**
 * Vault Initialization - Populate all 17 chains WITHOUT hardcoded bank wallet addresses
 * Admin must configure bank wallet addresses through the admin panel before vault goes live
 */

import { db } from './db';
import { vaultChainStats } from '../shared/schema';
import { eq } from 'drizzle-orm';

// Chain configuration WITHOUT bank wallet addresses (SECURITY: Admin-only configuration)
const CHAIN_CONFIG = [
  {
    chain: 'ethereum',
    nativeToken: 'ETH',
    minDeposit: '0.01',
    currentApy: '2.76'
  },
  {
    chain: 'bsc',
    nativeToken: 'BNB',
    minDeposit: '0.01',
    currentApy: '2.76'
  },
  {
    chain: 'polygon',
    nativeToken: 'MATIC',
    minDeposit: '1',
    currentApy: '2.76'
  },
  {
    chain: 'arbitrum',
    nativeToken: 'ETH',
    minDeposit: '0.01',
    currentApy: '2.76'
  },
  {
    chain: 'optimism',
    nativeToken: 'ETH',
    minDeposit: '0.01',
    currentApy: '2.76'
  },
  {
    chain: 'base',
    nativeToken: 'ETH',
    minDeposit: '0.01',
    currentApy: '2.76'
  },
  {
    chain: 'avalanche',
    nativeToken: 'AVAX',
    minDeposit: '0.1',
    currentApy: '2.76'
  },
  {
    chain: 'fantom',
    nativeToken: 'FTM',
    minDeposit: '10',
    currentApy: '2.76'
  },
  {
    chain: 'cronos',
    nativeToken: 'CRO',
    minDeposit: '10',
    currentApy: '2.76'
  },
  {
    chain: 'gnosis',
    nativeToken: 'xDAI',
    minDeposit: '1',
    currentApy: '2.76'
  },
  {
    chain: 'celo',
    nativeToken: 'CELO',
    minDeposit: '1',
    currentApy: '2.76'
  },
  {
    chain: 'moonbeam',
    nativeToken: 'GLMR',
    minDeposit: '1',
    currentApy: '2.76'
  },
  {
    chain: 'zksync',
    nativeToken: 'ETH',
    minDeposit: '0.01',
    currentApy: '2.76'
  },
  {
    chain: 'linea',
    nativeToken: 'ETH',
    minDeposit: '0.01',
    currentApy: '2.76'
  },
  {
    chain: 'xrpl',
    nativeToken: 'XRP',
    minDeposit: '10',
    currentApy: '2.76'
  },
  {
    chain: 'solana',
    nativeToken: 'SOL',
    minDeposit: '0.1',
    currentApy: '2.76'
  },
  {
    chain: 'bitcoin',
    nativeToken: 'BTC',
    minDeposit: '0.001',
    currentApy: '2.76'
  }
];

export async function initializeVaultChains() {
  console.log('🏦 Initializing Vault Chains (without bank wallets)...');
  console.log('⚠️  Bank wallet addresses must be configured by admin before vault can accept deposits');
  
  for (const config of CHAIN_CONFIG) {
    try {
      // Check if chain already exists
      const existing = await db
        .select()
        .from(vaultChainStats)
        .where(eq(vaultChainStats.chain, config.chain))
        .limit(1);

      if (existing.length > 0) {
        // Update existing (preserve bank_wallet_address if already set)
        await db
          .update(vaultChainStats)
          .set({ 
            native_token: config.nativeToken,
            min_deposit: config.minDeposit,
            current_apy: config.currentApy,
            is_active: true,
            updated_at: new Date()
           } as any)
          .where(eq(vaultChainStats.chain, config.chain));
        
        const hasBankWallet = existing[0].bank_wallet_address;
        console.log(`✅ Updated ${config.chain} (${config.nativeToken}) - APY: ${config.currentApy}% | Bank Wallet: ${hasBankWallet ? 'CONFIGURED ✓' : 'MISSING ⚠️'}`);
      } else {
        // Insert new (bank_wallet_address will be NULL until admin sets it)
        await db
          .insert(vaultChainStats)
          .values({
            chain: config.chain,
            native_token: config.nativeToken,
            bank_wallet_address: null, // NULL until admin configures
            min_deposit: config.minDeposit,
            current_apy: config.currentApy,
            is_active: false // Inactive until bank wallet is set
          } as any);
        
        console.log(`✅ Created ${config.chain} (${config.nativeToken}) - APY: ${config.currentApy}% | Bank Wallet: MUST BE CONFIGURED`);
      }
    } catch (error: any) {
      console.error(`❌ Error initializing ${config.chain}:`, error.message);
    }
  }
  
  console.log('\n✅ Vault initialization complete!');
  console.log('🔐 IMPORTANT: Admin must configure bank wallet addresses for each chain');
  console.log('📍 Use POST /api/vault/admin/set-bank-wallet to configure addresses');
}

// Run initialization if called directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  initializeVaultChains()
    .then(() => {
      console.log('\nDone! Remember to configure bank wallets through admin panel.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
