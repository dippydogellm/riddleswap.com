// Centralized wallet environment configuration for client-side code
// Ensures a single authoritative source for WalletConnect / Reown / Xaman related env values
// All client wallet modules should import from here instead of reading import.meta.env directly

interface WalletEnvConfig {
  walletConnectProjectId: string;
  fallbackProjectId?: string;
  xamanDeepLinkBase: string;
  features: {
    enableReown: boolean;
  };
  diagnostics(): void;
}

const rawProjectId = (import.meta as any).env?.VITE_WALLETCONNECT_PROJECT_ID || '';
// Provide a single hard-coded fallback ONLY for local dev; avoid leaking real IDs
const DEFAULT_FALLBACK = '00000000000000000000000000000000';

const walletConnectProjectId = rawProjectId.trim() || DEFAULT_FALLBACK;

const config: WalletEnvConfig = {
  walletConnectProjectId,
  fallbackProjectId: rawProjectId ? undefined : DEFAULT_FALLBACK,
  xamanDeepLinkBase: 'https://xumm.app/sign',
  features: {
    enableReown: true
  },
  diagnostics() {
    const msgs: string[] = [];
    if (!rawProjectId) {
      msgs.push('[wallet-env] VITE_WALLETCONNECT_PROJECT_ID missing – using fallback (limited functionality).');
    }
    if (walletConnectProjectId === DEFAULT_FALLBACK) {
      msgs.push('[wallet-env] Fallback WalletConnect ProjectId active. Configure a real one in .env.');
    }
    if (msgs.length) {
      // eslint-disable-next-line no-console
      console.warn(msgs.join('\n'));
    }
  }
};

export function getWalletConnectProjectId() {
  return config.walletConnectProjectId;
}

export function isReownEnabled() {
  return config.features.enableReown;
}

export function runWalletEnvDiagnostics() {
  config.diagnostics();
}

export default config;
