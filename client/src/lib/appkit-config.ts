// DISABLED: Reown AppKit integration - replaced with separate wallet plugins
// import { createAppKit } from '@reown/appkit'
// import { EthersAdapter } from '@reown/appkit-adapter-ethers'
// import { SolanaAdapter } from '@reown/appkit-adapter-solana'
// import { mainnet, polygon, arbitrum, bsc, optimism, base, solana } from '@reown/appkit/networks'
// import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom'
// import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare'
// import JoeyWalletConfig from './joey-wallet-config'

// Project ID still kept for potential future use
import { getWalletConnectProjectId } from '@/lib/wallet-env'
const projectId = getWalletConnectProjectId()

// AppKit DISABLED - Using separate external wallet plugins now
console.log('🔌 Using separate wallet plugins instead of AppKit UI');

// Ensure DOM is ready
if (typeof window === 'undefined') {
  console.warn('External Wallets: Window not available, skipping initialization');
}

// DISABLED: AppKit instance creation - using separate wallet plugins now
let appKitInstance: any = null;

// AppKit completely disabled for separate wallet popup approach
console.log('🔌 External wallet plugins enabled - AppKit UI disabled');

// DISABLED: Joey Wallet for XRPL - using separate XRPL wallet plugin
// JoeyWalletConfig.getClient().then(() => {
//   console.log('🟡 Joey Wallet not detected - will use WalletConnect fallback');
// }).catch(() => {
//   console.log('🟡 Joey Wallet not detected - will use WalletConnect fallback');
// });

export const appKit = appKitInstance
export default appKit
