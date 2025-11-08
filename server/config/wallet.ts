// Centralized server-side wallet configuration
// Ensures consistent environment variable usage and diagnostics

export interface ServerWalletConfig {
  walletConnectProjectId: string | undefined;
  xummApiKey: string | undefined;
  xummApiSecret: string | undefined;
}

export const serverWalletConfig: ServerWalletConfig = {
  walletConnectProjectId: process.env.WALLETCONNECT_PROJECT_ID,
  xummApiKey: process.env.XUMM_API_KEY,
  xummApiSecret: process.env.XUMM_API_SECRET
};

export function logServerWalletDiagnostics() {
  const msgs: string[] = [];
  if (!serverWalletConfig.walletConnectProjectId) {
    msgs.push('[server-wallet] WALLETCONNECT_PROJECT_ID is missing. Joey WalletConnect will be disabled.');
  }
  if (!serverWalletConfig.xummApiKey || !serverWalletConfig.xummApiSecret) {
    msgs.push('[server-wallet] XUMM_API_KEY/XUMM_API_SECRET missing. Xaman payload routes will fail.');
  }
  if (msgs.length) {
    // eslint-disable-next-line no-console
    console.warn(msgs.join('\n'));
  }
}
