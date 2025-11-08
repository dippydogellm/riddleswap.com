import { ethers } from 'ethers';
import { decryptWalletForChain } from './wallet-decrypt';

const RPC_URLS: Record<string, string> = {
  ethereum: 'https://eth-mainnet.g.alchemy.com/v2/demo',
  bsc: 'https://bsc-dataseed.binance.org/',
  polygon: 'https://polygon-rpc.com',
  base: 'https://mainnet.base.org',
  arbitrum: 'https://arb1.arbitrum.io/rpc',
  optimism: 'https://mainnet.optimism.io'
};

export async function getEthBalance(
  handle: string, 
  password: string, 
  network: string = 'ethereum'
): Promise<{
  success: boolean;
  balance?: string;
  error?: string;
}> {
  try {
    const wallet = await decryptWalletForChain(handle, password, 'eth');
    const provider = new ethers.JsonRpcProvider(RPC_URLS[network]);
    
    const balance = await provider.getBalance(wallet.address);
    const ethBalance = ethers.formatEther(balance);
    
    return {
      success: true,
      balance: ethBalance
    };
  } catch (error) {
    console.error('Failed to get ETH balance:', error);
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
  }>;
  error?: string;
}> {
  try {
    const wallet = await decryptWalletForChain(handle, password, 'eth');
    const provider = new ethers.JsonRpcProvider(RPC_URLS[network]);
    
    // Common ERC20 tokens - in production, fetch from a token list API
    const commonTokens = [
      { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', name: 'USD Coin', decimals: 6 },
      { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', name: 'Tether', decimals: 6 },
      { address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', symbol: 'DAI', name: 'Dai', decimals: 18 }
    ];
    
    const tokens = [];
    const erc20ABI = [
      'function balanceOf(address owner) view returns (uint256)',
      'function symbol() view returns (string)',
      'function name() view returns (string)',
      'function decimals() view returns (uint8)'
    ];
    
    for (const token of commonTokens) {
      try {
        const contract = new ethers.Contract(token.address, erc20ABI, provider);
        const balance = await contract.balanceOf(wallet.address);
        
        if (balance > BigInt(0)) {
          tokens.push({
            address: token.address,
            symbol: token.symbol,
            name: token.name,
            decimals: token.decimals,
            balance: ethers.formatUnits(balance, token.decimals)
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
    console.error('Failed to get ETH tokens:', error);
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
  }>;
  error?: string;
}> {
  try {
    const wallet = await decryptWalletForChain(handle, password, 'eth');
    
    // In production, use an NFT API like Alchemy or Moralis
    // For now, return empty array as we can't query without API keys
    return {
      success: true,
      nfts: []
    };
  } catch (error) {
    console.error('Failed to get ETH NFTs:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get NFTs'
    };
  }
}

export async function getEthNFTOffers(
  handle: string, 
  password: string, 
  network: string = 'ethereum'
): Promise<{
  success: boolean;
  offers?: Array<{
    marketplace: string;
    contractAddress: string;
    tokenId: string;
    price: string;
    currency: string;
    offerType: 'buy' | 'sell';
  }>;
  error?: string;
}> {
  try {
    const wallet = await decryptWalletForChain(handle, password, 'eth');
    
    // NFT offers would come from marketplace APIs
    // OpenSea, Blur, etc require API keys
    return {
      success: true,
      offers: []
    };
  } catch (error) {
    console.error('Failed to get ETH NFT offers:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get NFT offers'
    };
  }
}