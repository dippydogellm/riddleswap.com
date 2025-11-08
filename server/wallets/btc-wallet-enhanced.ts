import { decryptWalletForChain } from './wallet-decrypt';
import fetch from 'node-fetch';

export async function getBtcBalance(handle: string, password: string): Promise<{
  success: boolean;
  balance?: string;
  address?: string;
  unconfirmedBalance?: string;
  error?: string;
}> {
  try {
    const wallet = await decryptWalletForChain(handle, password, 'btc');
    
    // Use blockchain.info API for balance
    const response = await fetch(
      `https://blockchain.info/balance?active=${wallet.address}`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch balance');
    }
    
    const data = await response.json() as any;
    const addressData = data[wallet.address];
    
    const btcBalance = (addressData.final_balance / 100000000).toString();
    const unconfirmedBalance = (addressData.unconfirmed_balance / 100000000).toString();
    
    return {
      success: true,
      balance: btcBalance,
      address: wallet.address,
      unconfirmedBalance
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
    ticker: string;
    balance: string;
    protocol: string;
  }>;
  error?: string;
}> {
  try {
    const wallet = await decryptWalletForChain(handle, password, 'btc');
    
    // BRC-20 tokens, Runes, etc would need specialized indexer
    // For now return empty
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
    inscriptionNumber: number;
    contentType?: string;
    contentLength?: number;
    timestamp?: number;
    genesisHeight?: number;
    genesisFee?: number;
    outputValue?: number;
    location?: string;
  }>;
  error?: string;
}> {
  try {
    const wallet = await decryptWalletForChain(handle, password, 'btc');
    
    // Would use Ordinals API like ord.io or ordapi.xyz
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

export async function getBtcOffers(handle: string, password: string): Promise<{
  success: boolean;
  offers?: Array<{
    marketplace: string;
    inscriptionId?: string;
    price: string;
    offerType: 'buy' | 'sell';
    status: string;
    expiresAt?: number;
  }>;
  error?: string;
}> {
  try {
    const wallet = await decryptWalletForChain(handle, password, 'btc');
    
    // Would integrate with Ordinals marketplaces
    // For now return empty
    return {
      success: true,
      offers: []
    };
  } catch (error) {
    console.error('Failed to get BTC offers:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get offers'
    };
  }
}

export async function getBtcUTXOs(handle: string, password: string): Promise<{
  success: boolean;
  utxos?: Array<{
    txid: string;
    vout: number;
    value: number;
    confirmations: number;
    scriptPubKey?: string;
  }>;
  error?: string;
}> {
  try {
    const wallet = await decryptWalletForChain(handle, password, 'btc');
    
    const response = await fetch(
      `https://blockchain.info/unspent?active=${wallet.address}`
    );
    
    if (response.status === 500) {
      // No unspent outputs
      return {
        success: true,
        utxos: []
      };
    }
    
    if (!response.ok) {
      throw new Error('Failed to fetch UTXOs');
    }
    
    const data = await response.json() as any;
    const utxos = data.unspent_outputs?.map((utxo: any) => ({
      txid: utxo.tx_hash_big_endian,
      vout: utxo.tx_output_n,
      value: utxo.value,
      confirmations: utxo.confirmations,
      scriptPubKey: utxo.script
    })) || [];
    
    return {
      success: true,
      utxos
    };
  } catch (error) {
    console.error('Failed to get BTC UTXOs:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get UTXOs'
    };
  }
}

export async function getBtcTransactionHistory(handle: string, password: string, limit: number = 10): Promise<{
  success: boolean;
  transactions?: Array<{
    hash: string;
    time: number;
    blockHeight?: number;
    fee?: number;
    size?: number;
    inputs: Array<{
      address: string;
      value: number;
    }>;
    outputs: Array<{
      address: string;
      value: number;
    }>;
  }>;
  error?: string;
}> {
  try {
    const wallet = await decryptWalletForChain(handle, password, 'btc');
    
    const response = await fetch(
      `https://blockchain.info/rawaddr/${wallet.address}?limit=${limit}`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch transactions');
    }
    
    const data = await response.json() as any;
    
    const transactions = data.txs?.map((tx: any) => ({
      hash: tx.hash,
      time: tx.time,
      blockHeight: tx.block_height,
      fee: tx.fee,
      size: tx.size,
      inputs: tx.inputs?.map((input: any) => ({
        address: input.prev_out?.addr || 'unknown',
        value: input.prev_out?.value || 0
      })) || [],
      outputs: tx.out?.map((output: any) => ({
        address: output.addr || 'unknown',
        value: output.value
      })) || []
    })) || [];
    
    return {
      success: true,
      transactions
    };
  } catch (error) {
    console.error('Failed to get BTC transaction history:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get transaction history'
    };
  }
}