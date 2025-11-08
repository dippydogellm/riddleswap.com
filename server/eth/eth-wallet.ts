import { ethers } from 'ethers';
import { storage } from '../storage';

export const RPC_URLS: Record<string, string> = {
  ethereum: 'https://eth-mainnet.g.alchemy.com/v2/demo',
  base: 'https://mainnet.base.org',
  bsc: 'https://bsc-dataseed.binance.org/',
  polygon: 'https://polygon-rpc.com',
  arbitrum: 'https://arb1.arbitrum.io/rpc',
  optimism: 'https://mainnet.optimism.io'
};

export async function decryptEthWallet(handle: string, password: string): Promise<{
  wallet: ethers.Wallet;
  address: string;
  privateKey: string;
}> {
  try {
    const riddleWallet = await storage.getRiddleWalletByHandle(handle);
    
    if (!riddleWallet) {
      throw new Error('Wallet not found');
    }
    
    // TEMPORARY: Generate a test wallet while encryption is being fixed
    const wallet = ethers.Wallet.createRandom();
    
    return {
      wallet,
      address: wallet.address,
      privateKey: wallet.privateKey
    };
  } catch (error) {
    console.error('Failed to decrypt ETH wallet:', error);
    throw new Error('Failed to access wallet');
  }
}

export async function getEthProvider(network: string = 'ethereum'): Promise<ethers.JsonRpcProvider> {
  const rpcUrl = RPC_URLS[network] || RPC_URLS.ethereum;
  return new ethers.JsonRpcProvider(rpcUrl);
}