// Minimal headless WalletConnect v2 (Reown) helper
// Tries @reown/appkit first (if a direct headless path is available in your env)
// Falls back to @walletconnect/universal-provider for a pure headless connect

export type EvmConnectResult = {
  address: string;
  chainId: number;
  provider: any;
};

import { getWalletConnectProjectId } from './wallet-env';
const PROJECT_ID = getWalletConnectProjectId();

export async function connectEvmHeadless(chainId = 1): Promise<EvmConnectResult> {
  // Attempt Reown AppKit initialization (no-UI usage may vary by version)
  try {
    const appkitMod: any = await import('@reown/appkit');
    const ethersAdapterMod: any = await import('@reown/appkit-adapter-ethers');
    const networksMod: any = await import('@reown/appkit/networks');

    if (appkitMod?.createAppKit && ethersAdapterMod?.EthersAdapter && networksMod?.mainnet) {
      // Create AppKit instance; some environments still open a modal – this is a best-effort headless init
      const appKit = appkitMod.createAppKit({
        projectId: PROJECT_ID,
        adapters: [new ethersAdapterMod.EthersAdapter()],
        networks: [networksMod.mainnet],
        metadata: {
          name: 'Riddle.app',
          description: 'Riddle Trade Center',
          url: typeof window !== 'undefined' ? window.location.origin : 'https://riddle.app',
          icons: ['https://riddle.app/images/logos/rdl-logo-official.png']
        }
      });

      // If your version supports programmatic connect without UI, wire it here.
      // As a compatibility fallback, proceed to Universal Provider for a guaranteed headless path.
      console.info('Reown AppKit initialized (compatibility mode). Falling back to universal provider for headless connect.');
    }
  } catch (e) {
    // Ignore – we will fall back to universal provider
  }

  // Headless WC v2 via Universal Provider
  const { default: UniversalProvider } = await import('@walletconnect/universal-provider');
  const provider: any = await (UniversalProvider as any).init({ projectId: PROJECT_ID });

  const ns = {
    eip155: {
      methods: [
        'eth_sendTransaction',
        'eth_signTransaction',
        'eth_sign',
        'personal_sign',
        'eth_signTypedData'
      ],
      chains: [`eip155:${chainId}`],
      events: ['chainChanged', 'accountsChanged']
    }
  };

  await provider.connect({ namespaces: ns });
  const accounts: string[] = provider?.accounts || [];
  const address = accounts[0];
  if (!address) {
    throw new Error('EVM wallet connection failed');
  }

  return { address, chainId, provider };
}
// Minimal headless Reown (AppKit) initializer and connect helper
// Uses dynamic imports to avoid SSR issues and keeps UI Material-only

let appKitInstance: any = null;

export async function initReownAppKit() {
  if (appKitInstance) return appKitInstance;
  if (typeof window === 'undefined') return null;

  try {
    const [{ createAppKit }, { EthersAdapter }, networks] = await Promise.all([
      import('@reown/appkit' as any),
      import('@reown/appkit-adapter-ethers' as any),
      import('@reown/appkit/networks' as any)
    ]).then((mods: any[]) => [mods[0], mods[1], mods[2]]);

    const {
      mainnet, polygon, arbitrum, bsc, optimism, base
    } = networks as any;

  const projectId = getWalletConnectProjectId();

    // Create with ethers adapter; don't render their UI (we'll call methods programmatically)
    const appKit = (createAppKit as any)({
      projectId,
      adapter: new (EthersAdapter as any)(),
      networks: [mainnet, polygon, arbitrum, bsc, optimism, base]
    });

    // Save globally for optional debug access
    (window as any).appkit = appKit;
    appKitInstance = appKit;
    return appKitInstance;
  } catch (e) {
    console.warn('Reown AppKit init failed:', e);
    return null;
  }
}

// Single unified helper used by the modal: try AppKit first, then headless Universal Provider
export async function connectEvmWithReown(chainId = 1): Promise<string | null> {
  // 1) Try Reown AppKit (UI or headless provider) when available
  try {
    const kit = await initReownAppKit();
    if (kit) {
      try {
        const provider = await (kit as any).getWalletProvider?.();
        if (provider?.request) {
          const accounts = await provider.request({ method: 'eth_requestAccounts' });
          if (accounts && accounts[0]) return accounts[0];
        }

        // If AppKit exposes an open modal, try that as a fallback
        if ((kit as any).open) {
          await (kit as any).open();
          const prov2 = await (kit as any).getWalletProvider?.();
          if (prov2?.request) {
            const accounts = await prov2.request({ method: 'eth_requestAccounts' });
            if (accounts && accounts[0]) return accounts[0];
          }
        }
      } catch (e) {
        console.warn('Reown AppKit connect attempt failed, falling back to headless provider:', e);
      }
    }
  } catch (e) {
    // Continue to fallback
  }

  // 2) Fallback: headless WalletConnect v2 (Universal Provider)
  try {
    const result = await connectEvmHeadless(chainId);
    return result.address || null;
  } catch (e) {
    console.warn('Headless EVM connect failed:', e);
    return null;
  }
}

export default { initReownAppKit, connectEvmWithReown };
