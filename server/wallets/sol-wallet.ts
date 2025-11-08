import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { decryptWalletForChain } from './wallet-decrypt';

const SOLANA_RPC = 'https://api.mainnet-beta.solana.com';

export async function getSolBalance(handle: string, password: string): Promise<{
  success: boolean;
  balance?: string;
  error?: string;
}> {
  try {
    const wallet = await decryptWalletForChain(handle, password, 'sol');
    const connection = new Connection(SOLANA_RPC);
    
    const publicKey = new PublicKey(wallet.address);
    const balance = await connection.getBalance(publicKey);
    const solBalance = balance / LAMPORTS_PER_SOL;
    
    return {
      success: true,
      balance: solBalance.toString()
    };
  } catch (error) {
    console.error('Failed to get SOL balance:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get balance'
    };
  }
}

export async function getSolTokens(handle: string, password: string): Promise<{
  success: boolean;
  tokens?: Array<{
    mint: string;
    account: string;
    balance: string;
    decimals: number;
  }>;
  error?: string;
}> {
  try {
    const wallet = await decryptWalletForChain(handle, password, 'sol');
    const connection = new Connection(SOLANA_RPC);
    
    const publicKey = new PublicKey(wallet.address);
    
    // Get token accounts
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      publicKey,
      { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
    );
    
    const tokens = tokenAccounts.value.map(account => {
      const parsedInfo = account.account.data.parsed.info;
      return {
        mint: parsedInfo.mint,
        account: account.pubkey.toString(),
        balance: parsedInfo.tokenAmount.uiAmountString || '0',
        decimals: parsedInfo.tokenAmount.decimals
      };
    });
    
    return {
      success: true,
      tokens
    };
  } catch (error) {
    console.error('Failed to get SOL tokens:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get tokens'
    };
  }
}

export async function getSolNFTs(handle: string, password: string): Promise<{
  success: boolean;
  nfts?: Array<{
    mint: string;
    name?: string;
    symbol?: string;
    uri?: string;
    collection?: string;
  }>;
  error?: string;
}> {
  try {
    const wallet = await decryptWalletForChain(handle, password, 'sol');
    const connection = new Connection(SOLANA_RPC);
    
    const publicKey = new PublicKey(wallet.address);
    
    // Get NFTs (tokens with amount = 1 and decimals = 0)
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      publicKey,
      { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
    );
    
    const nfts = tokenAccounts.value
      .filter(account => {
        const info = account.account.data.parsed.info;
        return info.tokenAmount.decimals === 0 && info.tokenAmount.uiAmount === 1;
      })
      .map(account => ({
        mint: account.account.data.parsed.info.mint,
        // Metadata would need to be fetched from Metaplex
      }));
    
    return {
      success: true,
      nfts
    };
  } catch (error) {
    console.error('Failed to get SOL NFTs:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get NFTs'
    };
  }
}

export async function getSolNFTOffers(handle: string, password: string): Promise<{
  success: boolean;
  offers?: Array<{
    marketplace: string;
    mint: string;
    price: string;
    offerType: 'buy' | 'sell';
  }>;
  error?: string;
}> {
  try {
    const wallet = await decryptWalletForChain(handle, password, 'sol');
    
    // NFT offers would come from marketplace APIs
    // Magic Eden, Tensor, etc require API keys
    return {
      success: true,
      offers: []
    };
  } catch (error) {
    console.error('Failed to get SOL NFT offers:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get NFT offers'
    };
  }
}