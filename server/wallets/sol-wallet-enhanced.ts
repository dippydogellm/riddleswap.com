import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { decryptWalletForChain } from './wallet-decrypt';
import fetch from 'node-fetch';

const SOLANA_RPC = 'https://api.mainnet-beta.solana.com';

export async function getSolBalance(handle: string, password: string): Promise<{
  success: boolean;
  balance?: string;
  address?: string;
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
      balance: solBalance.toString(),
      address: wallet.address
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
    symbol?: string;
    name?: string;
    account: string;
    balance: string;
    decimals: number;
    usdValue?: string;
  }>;
  error?: string;
}> {
  try {
    const wallet = await decryptWalletForChain(handle, password, 'sol');
    const connection = new Connection(SOLANA_RPC);
    
    const publicKey = new PublicKey(wallet.address);
    
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      publicKey,
      { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
    );
    
    const tokens = await Promise.all(tokenAccounts.value.map(async account => {
      const parsedInfo = account.account.data.parsed.info;
      
      // Try to get token metadata from Jupiter API
      let tokenInfo: any = {};
      try {
        const response = await fetch(`https://price.jup.ag/v4/price?ids=${parsedInfo.mint}`);
        if (response.ok) {
          const data = await response.json() as any;
          tokenInfo = data.data[parsedInfo.mint] || {};
        }
      } catch (e) {
        // Ignore metadata fetch errors
      }
      
      return {
        mint: parsedInfo.mint,
        symbol: tokenInfo.symbol,
        name: tokenInfo.name,
        account: account.pubkey.toString(),
        balance: parsedInfo.tokenAmount.uiAmountString || '0',
        decimals: parsedInfo.tokenAmount.decimals,
        usdValue: tokenInfo.price && parsedInfo.tokenAmount.uiAmount 
          ? (tokenInfo.price * parsedInfo.tokenAmount.uiAmount).toString() 
          : undefined
      };
    }));
    
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
    description?: string;
    image?: string;
    uri?: string;
    collection?: string;
    attributes?: Array<{
      trait_type: string;
      value: string;
    }>;
  }>;
  error?: string;
}> {
  try {
    const wallet = await decryptWalletForChain(handle, password, 'sol');
    const connection = new Connection(SOLANA_RPC);
    
    const publicKey = new PublicKey(wallet.address);
    
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      publicKey,
      { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
    );
    
    const nftAccounts = tokenAccounts.value.filter(account => {
      const info = account.account.data.parsed.info;
      return info.tokenAmount.decimals === 0 && info.tokenAmount.uiAmount === 1;
    });
    
    const nfts = await Promise.all(nftAccounts.map(async account => {
      const mint = account.account.data.parsed.info.mint;
      
      // Try to get metadata from Metaplex or other NFT APIs
      let metadata: any = {};
      try {
        // This would need actual Metaplex integration
        // For now, return basic info
        metadata = {
          name: `NFT ${mint.slice(0, 8)}...`,
          symbol: 'NFT',
          description: 'Solana NFT',
        };
      } catch (e) {
        // Ignore metadata errors
      }
      
      return {
        mint,
        name: metadata.name,
        symbol: metadata.symbol,
        description: metadata.description,
        image: metadata.image,
        uri: metadata.uri,
        collection: metadata.collection?.name,
        attributes: metadata.attributes
      };
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

export async function getSolOffers(handle: string, password: string): Promise<{
  success: boolean;
  offers?: Array<{
    marketplace: string;
    offerId: string;
    type: 'buy' | 'sell';
    price: string;
    token: string;
    status: string;
  }>;
  error?: string;
}> {
  try {
    const wallet = await decryptWalletForChain(handle, password, 'sol');
    
    // Would integrate with Serum, OpenBook, or other order book protocols
    // For now, return empty array
    return {
      success: true,
      offers: []
    };
  } catch (error) {
    console.error('Failed to get SOL offers:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get offers'
    };
  }
}

export async function getSolTransactionHistory(handle: string, password: string, limit: number = 10): Promise<{
  success: boolean;
  transactions?: Array<{
    signature: string;
    blockTime: number;
    status: string;
    type: string;
    amount?: string;
    fee?: string;
  }>;
  error?: string;
}> {
  try {
    const wallet = await decryptWalletForChain(handle, password, 'sol');
    const connection = new Connection(SOLANA_RPC);
    
    const publicKey = new PublicKey(wallet.address);
    const signatures = await connection.getSignaturesForAddress(publicKey, { limit });
    
    const transactions = await Promise.all(signatures.map(async sig => {
      const tx = await connection.getParsedTransaction(sig.signature);
      
      return {
        signature: sig.signature,
        blockTime: sig.blockTime || 0,
        status: sig.err ? 'failed' : 'success',
        type: 'transfer', // Would parse transaction type
        fee: tx?.meta?.fee?.toString()
      };
    }));
    
    return {
      success: true,
      transactions
    };
  } catch (error) {
    console.error('Failed to get SOL transaction history:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get transaction history'
    };
  }
}