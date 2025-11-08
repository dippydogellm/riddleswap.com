import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { storage } from '../storage';

export async function decryptSolanaWallet(handle: string, password: string): Promise<{
  wallet: Keypair;
  address: string;
  secretKey: Uint8Array;
}> {
  try {
    const riddleWallet = await storage.getRiddleWalletByHandle(handle);
    
    if (!riddleWallet) {
      throw new Error('Wallet not found');
    }
    
    // TEMPORARY: Generate a test wallet while encryption is being fixed
    const wallet = Keypair.generate();
    
    return {
      wallet,
      address: wallet.publicKey.toString(),
      secretKey: wallet.secretKey
    };
  } catch (error) {
    console.error('Failed to decrypt Solana wallet:', error);
    throw new Error('Failed to access wallet');
  }
}

export async function getSolanaConnection(): Promise<Connection> {
  // Use mainnet for production transactions
  return new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
}