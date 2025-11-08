import UniversalProvider from '@walletconnect/universal-provider'

// XRPL chain configuration
export const xrplChain = {
  namespace: 'xrpl',
  chainId: '0', // XRPL mainnet
  rpcUrl: 'wss://xrplcluster.com',
  name: 'XRP Ledger',
  caipChainId: 'xrpl:0' // CAIP-2 format
}

// Initialize Universal Provider for XRPL
export const initXRPLProvider = async (projectId: string) => {
  try {
    const provider = await UniversalProvider.init({
      projectId,
      metadata: {
        name: 'Riddle.Finance',
        description: 'Multi-chain token trading and DeFi platform',
        url: window.location.origin,
        icons: [`${window.location.origin}/logo.jpg`]
      }
    })
    
    return provider
  } catch (error) {
    // Removed console statement for production
    return null
  }
}

// Connect to XRPL wallet
export const connectXRPLWallet = async (provider: UniversalProvider) => {
  try {
    const session = await provider.connect({
      optionalNamespaces: {
        xrpl: {
          methods: [
            'xrpl_signTransaction',
            'xrpl_signTransactionFor'
          ],
          chains: ['xrpl:0'],
          events: ['chainChanged', 'accountsChanged'],
          rpcMap: {
            '0': 'wss://xrplcluster.com'
          }
        }
      }
    })
    
    // Get XRPL accounts
    const accounts = provider.session?.namespaces?.xrpl?.accounts
    if (accounts && accounts.length > 0) {
      // Extract address from CAIP-10 format (xrpl:0:address)
      const address = accounts[0].split(':')[2]
      return { address, session }
    }
    
    return null
  } catch (error) {
    // Removed console statement for production
    return null
  }
}

// Sign XRPL transaction
export const signXRPLTransaction = async (
  provider: UniversalProvider, 
  transaction: any
) => {
  try {
    const result = await provider.request({
      method: 'xrpl_signTransaction',
      params: {
        tx_json: transaction,
        autofill: true,
        submit: true
      }
    }, 'xrpl:0')
    
    return result
  } catch (error) {
    // Removed console statement for production
    throw error
  }
}

// Disconnect XRPL wallet
export const disconnectXRPLWallet = async (provider: UniversalProvider) => {
  try {
    await provider.disconnect()
  } catch (error) {
    // Removed console statement for production
  }
}
