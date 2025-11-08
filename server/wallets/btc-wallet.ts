import { decryptWalletForChain } from './wallet-decrypt';
import fetch from 'node-fetch';

export async function getBtcBalance(handle: string, password: string): Promise<{
  success: boolean;
  balance?: string;
  error?: string;
}> {
  try {
    const wallet = await decryptWalletForChain(handle, password, 'btc');
    
    // Use blockchain.info API for balance
    const response = await fetch(
      `https://blockchain.info/q/addressbalance/${wallet.address}`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch balance');
    }
    
    const satoshis = await response.text();
    const btcBalance = (parseInt(satoshis) / 100000000).toString();
    
    return {
      success: true,
      balance: btcBalance
    };
  } catch (error) {
    console.error('Failed to get BTC balance:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get balance'
    };
  }
}

export async function getBtcTokens(handle: string, password: string): Promise<{
  success: boolean;
  tokens?: Array<{
    type: string;
    balance: string;
  }>;
  error?: string;
}> {
  try {
    // Bitcoin doesn't have tokens like other chains
    // Could track Ordinals, BRC-20, etc in the future
    return {
      success: true,
      tokens: []
    };
  } catch (error) {
    console.error('Failed to get BTC tokens:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get tokens'
    };
  }
}

export async function getBtcNFTs(handle: string, password: string): Promise<{
  success: boolean;
  nfts?: Array<{
    inscriptionId: string;
    contentType?: string;
    contentLength?: number;
    timestamp?: number;
  }>;
  error?: string;
}> {
  try {
    const wallet = await decryptWalletForChain(handle, password, 'btc');
    
    // Ordinals/inscriptions would require specialized indexer API
    // For now return empty
    return {
      success: true,
      nfts: []
    };
  } catch (error) {
    console.error('Failed to get BTC NFTs:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get NFTs'
    };
  }
}

export async function getBtcNFTOffers(handle: string, password: string): Promise<{
  success: boolean;
  offers?: Array<{
    marketplace: string;
    inscriptionId: string;
    price: string;
    offerType: 'buy' | 'sell';
  }>;
  error?: string;
}> {
  try {
    // Ordinals marketplace offers would require API access
    return {
      success: true,
      offers: []
    };
  } catch (error) {
    console.error('Failed to get BTC NFT offers:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get NFT offers'
    };
  }
}