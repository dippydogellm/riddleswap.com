import { ethers } from 'ethers';
import { decryptWalletForChain } from './wallet-decrypt';
import fetch from 'node-fetch';

const RPC_URLS: Record<string, string> = {
  ethereum: 'https://eth-mainnet.g.alchemy.com/v2/demo',
  bsc: 'https://bsc-dataseed.binance.org/',
  polygon: 'https://polygon-rpc.com',
  base: 'https://mainnet.base.org',
  arbitrum: 'https://arb1.arbitrum.io/rpc',
  optimism: 'https://mainnet.optimism.io'
};

const CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  bsc: 56,
  polygon: 137,
  base: 8453,
  arbitrum: 42161,
  optimism: 10
};

export async function getEthBalance(
  handle: string, 
  password: string, 
  network: string = 'ethereum'
): Promise<{
  success: boolean;
  balance?: string;
  address?: string;
  network?: string;
  error?: string;
}> {
  try {
    const wallet = await decryptWalletForChain(handle, password, 'eth');
    const provider = new ethers.JsonRpcProvider(RPC_URLS[network]);
    
    const balance = await provider.getBalance(wallet.address);
    const ethBalance = ethers.formatEther(balance);
    
    return {
      success: true,
      balance: ethBalance,
      address: wallet.address,
      network
    };
  } catch (error) {
    console.error('Failed to get balance:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get balance'
    };
  }
}

export async function getEthTokens(
  handle: string, 
  password: string, 
  network: string = 'ethereum'
): Promise<{
  success: boolean;
  tokens?: Array<{
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    balance: string;
    logo?: string;
    usdValue?: string;
  }>;
  error?: string;
}> {
  try {
    const wallet = await decryptWalletForChain(handle, password, 'eth');
    const provider = new ethers.JsonRpcProvider(RPC_URLS[network]);
    
    // Get token list from 1inch API
    const chainId = CHAIN_IDS[network];
    let tokenList: any[] = [];
    
    try {
      const response = await fetch(`https://api.1inch.io/v5.0/${chainId}/tokens`);
      if (response.ok) {
        const data = await response.json() as any;
        tokenList = Object.values(data.tokens || {} as any);
      }
    } catch (e) {
      // Use fallback token list
      tokenList = [
        { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', name: 'USD Coin', decimals: 6 },
        { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', name: 'Tether', decimals: 6 },
        { address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', symbol: 'DAI', name: 'Dai', decimals: 18 }
      ];
    }
    
    const erc20ABI = [
      'function balanceOf(address owner) view returns (uint256)',
      'function symbol() view returns (string)',
      'function name() view returns (string)',
      'function decimals() view returns (uint8)'
    ];
    
    const tokens = [];
    
    // Check top tokens for balances
    for (const token of tokenList.slice(0, 50)) {
      try {
        const contract = new ethers.Contract(token.address, erc20ABI, provider);
        const balance = await contract.balanceOf(wallet.address);
        
        if (balance > BigInt(0)) {
          const formattedBalance = ethers.formatUnits(balance, token.decimals);
          
          tokens.push({
            address: token.address,
            symbol: token.symbol,
            name: token.name,
            decimals: token.decimals,
            balance: formattedBalance,
            logo: token.logoURI,
            usdValue: token.price ? (parseFloat(formattedBalance) * token.price).toString() : undefined
          });
        }
      } catch (err) {
        // Skip tokens that fail
      }
    }
    
    return {
      success: true,
      tokens
    };
  } catch (error) {
    console.error('Failed to get tokens:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get tokens'
    };
  }
}

export async function getEthNFTs(
  handle: string, 
  password: string, 
  network: string = 'ethereum'
): Promise<{
  success: boolean;
  nfts?: Array<{
    contractAddress: string;
    tokenId: string;
    name?: string;
    description?: string;
    image?: string;
    collection?: string;
    attributes?: Array<{
      trait_type: string;
      value: string;
    }>;
  }>;
  error?: string;
}> {
  try {
    const wallet = await decryptWalletForChain(handle, password, 'eth');
    
    // Would use Alchemy or Moralis NFT API
    // For now, return empty array
    return {
      success: true,
      nfts: []
    };
  } catch (error) {
    console.error('Failed to get NFTs:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get NFTs'
    };
  }
}

export async function getEthOffers(
  handle: string, 
  password: string, 
  network: string = 'ethereum'
): Promise<{
  success: boolean;
  offers?: Array<{
    protocol: string;
    orderId: string;
    type: 'buy' | 'sell';
    fromToken: string;
    toToken: string;
    fromAmount: string;
    toAmount: string;
    status: string;
    expiry?: number;
  }>;
  error?: string;
}> {
  try {
    const wallet = await decryptWalletForChain(handle, password, 'eth');
    
    // Would integrate with 0x Protocol or 1inch Limit Orders
    // For now, return empty array
    return {
      success: true,
      offers: []
    };
  } catch (error) {
    console.error('Failed to get offers:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get offers'
    };
  }
}

export async function getEthTransactionHistory(
  handle: string, 
  password: string, 
  network: string = 'ethereum',
  limit: number = 10
): Promise<{
  success: boolean;
  transactions?: Array<{
    hash: string;
    blockNumber: number;
    timestamp: number;
    from: string;
    to: string;
    value: string;
    gasUsed?: string;
    status: 'success' | 'failed';
  }>;
  error?: string;
}> {
  try {
    const wallet = await decryptWalletForChain(handle, password, 'eth');
    const provider = new ethers.JsonRpcProvider(RPC_URLS[network]);
    
    // Get latest block
    const currentBlock = await provider.getBlockNumber();
    
    // Would use Etherscan API for full history
    // For now, return empty array
    return {
      success: true,
      transactions: []
    };
  } catch (error) {
    console.error('Failed to get transaction history:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get transaction history'
    };
  }
}