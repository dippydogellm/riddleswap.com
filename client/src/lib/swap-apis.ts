// Multi-chain swap API integrations: 1inch Protocol (EVM) and Jupiter (Solana)

// 1inch Protocol API for EVM chains
export class OneInchSwapAPI {
  private getBaseUrl(chainId: number) {
    return `https://api.1inch.dev/swap/v6.0/${chainId}`
  }

  async getQuote(params: {
    chainId: number
    sellToken: string
    buyToken: string
    sellAmount: string
    takerAddress?: string
  }) {
    const searchParams = new URLSearchParams({
      src: params.sellToken,
      dst: params.buyToken,
      amount: params.sellAmount,
      ...(params.takerAddress && { from: params.takerAddress }),
      disableEstimate: 'true'
    })

    const response = await fetch(
      `${this.getBaseUrl(params.chainId)}/quote?${searchParams}`,
      {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_ONEINCH_API_KEY || ''}`,
          'Accept': 'application/json'
        }
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      if (response.status === 400) {
        if (errorText.includes('insufficient liquidity')) {
          throw new Error('Insufficient liquidity - try a smaller amount or increase slippage')
        }
        if (errorText.includes('cannot estimate')) {
          throw new Error('Transaction would fail - try increasing slippage or use a smaller amount')
        }
      }
      if (response.status === 500 && errorText.includes('execution reverted')) {
        throw new Error('Dry path failed - try increasing slippage tolerance or reduce swap amount')
      }
      throw new Error(`Swap failed: ${errorText || response.statusText}`)
    }

    return response.json()
  }

  async getPrice(params: {
    chainId: number
    sellToken: string
    buyToken: string
    sellAmount: string
  }) {
    const searchParams = new URLSearchParams({
      src: params.sellToken,
      dst: params.buyToken,
      amount: params.sellAmount
    })

    const response = await fetch(
      `${this.getBaseUrl(params.chainId)}/quote?${searchParams}`,
      {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_ONEINCH_API_KEY || ''}`,
          'Accept': 'application/json'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`1inch API error: ${response.statusText}`)
    }

    return response.json()
  }
}

// Jupiter API for Solana swaps
export class JupiterSwapAPI {
  private baseUrl = 'https://quote-api.jup.ag/v6'

  async getQuote(params: {
    inputMint: string
    outputMint: string
    amount: string
    slippageBps?: number
  }) {
    const searchParams = new URLSearchParams({
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      amount: params.amount,
      slippageBps: (params.slippageBps || 50).toString()
    })

    const response = await fetch(`${this.baseUrl}/quote?${searchParams}`)

    if (!response.ok) {
      throw new Error(`Jupiter API error: ${response.statusText}`)
    }

    return response.json()
  }

  async getSwapTransaction(params: {
    quoteResponse: any
    userPublicKey: string
  }) {
    const response = await fetch(`${this.baseUrl}/swap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        quoteResponse: params.quoteResponse,
        userPublicKey: params.userPublicKey,
        wrapAndUnwrapSol: true
      })
    })

    if (!response.ok) {
      throw new Error(`Jupiter swap API error: ${response.statusText}`)
    }

    return response.json()
  }
}

// Multi-chain swap coordinator
export class MultiChainSwapAPI {
  private oneInch = new OneInchSwapAPI()
  private jupiter = new JupiterSwapAPI()

  async getSwapQuote(params: {
    chainType: 'evm' | 'solana' | 'xrpl'
    chainId?: number
    fromToken: string
    toToken: string
    amount: string
    userAddress?: string
  }) {
    switch (params.chainType) {
      case 'evm':
        return this.oneInch.getQuote({
          chainId: params.chainId!,
          sellToken: params.fromToken,
          buyToken: params.toToken,
          sellAmount: params.amount,
          takerAddress: params.userAddress
        })

      case 'solana':
        return this.jupiter.getQuote({
          inputMint: params.fromToken,
          outputMint: params.toToken,
          amount: params.amount
        })

      case 'xrpl':
        // ➡️ Use NEW EXCHANGE SYSTEM for XRPL quotes
        const toIssuer = params.toToken === 'RDL' ? 'r9xvnzUWZJpDu3NA6MKHmKhKJQTRqCRgu9' : '';
        const queryParams = new URLSearchParams({
          fromToken: params.fromToken,
          toToken: params.toToken,
          amount: params.amount,
          ...(toIssuer && { toIssuer })
        });
        
        const response = await fetch(`/api/exchange/quote?${queryParams}`);
        return await response.json() as any;

      default:
        throw new Error(`Unsupported chain type: ${params.chainType}`)
    }
  }

  async executeSwap(params: {
    chainType: 'evm' | 'solana' | 'xrpl'
    quote: any
    userAddress: string
  }) {
    switch (params.chainType) {
      case 'evm':
        // Return transaction data for wallet to execute
        return {
          to: params.quote.to,
          data: params.quote.data,
          value: params.quote.value,
          gasPrice: params.quote.gasPrice,
          gas: params.quote.gas
        }

      case 'solana':
        // Get swap transaction from Jupiter
        return this.jupiter.getSwapTransaction({
          quoteResponse: params.quote,
          userPublicKey: params.userAddress
        })

      case 'xrpl':
        // ➡️ XRPL swaps handled by NEW EXCHANGE SYSTEM  
        return {
          success: true,
          message: 'XRPL swap handled by dedicated exchange system',
          requiresPassword: true
        }

      default:
        throw new Error(`Unsupported chain type: ${params.chainType}`)
    }
  }
}

export const multiChainSwap = new MultiChainSwapAPI()
