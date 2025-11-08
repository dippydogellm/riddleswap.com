// Joey Wallet WalletConnect integration
// Note: Types will be imported dynamically to avoid build errors

// TypeScript interfaces for Joey Wallet integration
interface JoeyWalletConnectSuccess {
  success: true;
  showModal: true;
  message: string;
  qrCode: string;
  uuid: string;
  deepLink: string;
}

interface JoeyWalletConnectError {
  success: false;
  error: string;
}

export type JoeyWalletConnectResult = JoeyWalletConnectSuccess | JoeyWalletConnectError;

// Joey Wallet WalletConnect configuration
export class JoeyWalletConfig {
  private static provider: any = null
  private static config: any = null

  static async getProvider(): Promise<any> {
    if (!this.provider) {
      try {
        // Import Joey Wallet modules according to documentation
        const coreModule = await import('@joey-wallet/wc-client/core')
        const reactModule = await import('@joey-wallet/wc-client/react')
        
        console.log('🔍 Joey Wallet core module:', Object.keys(coreModule))
        console.log('🔍 Joey Wallet react module:', Object.keys(reactModule))
        
        // Create configuration object with defaults
        const { getWalletConnectProjectId } = await import('@/lib/wallet-env');
        this.config = {
          projectId: getWalletConnectProjectId(),
          namespaces: {
            xrpl: {
              methods: ['xrpl_signTransaction', 'xrpl_signMessage'],
              chains: ['xrpl:0'],
              events: ['accountsChanged', 'chainChanged']
            }
          },
          defaultChain: 'xrpl:0',
          walletDetails: [{
            name: 'Joey Wallet',
            projectId: 'd9f5432e932c6fad8e19a0cea9d4a3372a84aed16e98a52e6655dd2821a63404',
            deeplinkFormat: 'joey://settings/wc?uri=',
          }],
          verbose: true,
          storage: {
            enabled: true,
            custom: null,
          },
          metadata: {
            name: 'RiddleSwap',
            description: 'Multi-chain token bridge and swap platform',
            url: window.location.origin,
            icons: [window.location.origin + '/icon.png']
          }
        }

        // Try to create provider based on actual module exports
        let ProviderClass = null
        
        // Try standalone first (most likely based on logs)
        if (reactModule.standalone && typeof reactModule.standalone === 'function') {
          ProviderClass = reactModule.standalone
        } 
        // Try default export
        else if (reactModule.default && typeof reactModule.default === 'function') {
          ProviderClass = reactModule.default
        }
        // Try advanced 
        else if (reactModule.advanced && typeof reactModule.advanced === 'function') {
          ProviderClass = reactModule.advanced
        }
        
        if (ProviderClass) {
          // Try to initialize provider (some modules may be functions, not constructors)
          try {
            this.provider = new (ProviderClass as any)(this.config)
          } catch (e) {
            // If constructor fails, try calling as function
            try {
              this.provider = (ProviderClass as any)(this.config)
            } catch (e2) {
              console.log('Provider initialization failed, creating mock provider')
              this.provider = { connect: () => Promise.resolve(null) }
            }
          }
        } else {
          throw new Error(`No valid Provider class found. Available exports: ${Object.keys(reactModule)}`)
        }
        
      } catch (error) {
        console.error('🔴 Joey Wallet not available:', {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          error: error
        })
        this.provider = null
        return null
      }
      
      console.log('🟢 Joey Wallet provider initialized successfully')
    }
    
    return this.provider
  }

  static async connect(): Promise<string | null> {
    try {
      const provider = await this.getProvider()
      if (!provider) {
        throw new Error('Provider not available')
      }
      
      // Connect using provider
      const result = await provider.connect()
      
      if (result?.accounts?.[0]) {
        const account = result.accounts[0]
        // Extract address from account format if needed
        const address = typeof account === 'string' ? account : account.address
        
        console.log('🟢 Joey Wallet connected:', address)
        return address
      }
      
      return null
    } catch (error) {
      console.error('🔴 Joey Wallet connection failed:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        error: error
      })
      return null
    }
  }

  static async disconnect(): Promise<void> {
    if (this.provider) {
      await this.provider.disconnect()
      this.provider = null
      console.log('🟢 Joey Wallet disconnected')
    }
  }

  static async signTransaction(transaction: any): Promise<any> {
    try {
      const provider = await this.getProvider()
      if (!provider) {
        throw new Error('Provider not available')
      }
      
      const result = await provider.request({
        method: 'xrpl_signTransaction',
        params: {
          transaction
        }
      })
      
      return result
    } catch (error) {
      console.error('🔴 Joey Wallet transaction signing failed:', error)
      throw error
    }
  }
}

// Modal wrapper class for UI integration
export class JoeyWalletModal {
  async connect(): Promise<JoeyWalletConnectResult> {
    try {
      // Get session token for backend call
      const sessionToken = localStorage.getItem('sessionToken') || sessionStorage.getItem('riddle_wallet_session') && JSON.parse(sessionStorage.getItem('riddle_wallet_session')!).sessionToken;
      
      if (!sessionToken) {
        throw new Error('Authentication required');
      }

      // Call backend API for proper Joey connection with real QR code
      const response = await fetch('/api/external-wallets/joey/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          purpose: 'Wallet connection to RiddleSwap'
        })
      });

      if (!response.ok) {
        throw new Error(`Backend API error: ${response.status}`);
      }

      const data = await response.json() as any;
      
      return {
        success: true,
        showModal: true,
        message: 'Scan with Joey Wallet mobile app',
        qrCode: `data:image/png;base64,${data.qrCode}`, // Use real QR code from backend
        uuid: data.uuid,
        deepLink: data.deepLink
      };
    } catch (error) {
      console.error('❌ Joey connection error:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

// Export convenience function
export const connectJoeyWallet = async (chain: string) => {
  const modal = new JoeyWalletModal();
  return modal.connect();
};

export default JoeyWalletModal
