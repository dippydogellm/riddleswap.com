import * as bitcoin from 'bitcoinjs-lib';
import { decryptBitcoinWallet } from './btc-wallet';
import fetch from 'node-fetch';

export async function sendBitcoinPayment(
  handle: string,
  password: string,
  destination: string,
  amount: string, // in BTC
  feeRate?: number // satoshis per byte
): Promise<{
  success: boolean;
  txHash?: string;
  error?: string;
}> {
  try {
    const { keyPair, address } = await decryptBitcoinWallet(handle, password);
    const network = bitcoin.networks.bitcoin;
    
    // Get UTXOs (would use a blockchain API in production)
    const utxos = await getUTXOs(address);
    
    if (utxos.length === 0) {
      throw new Error('No UTXOs available');
    }
    
    // Build transaction
    const psbt = new bitcoin.Psbt({ network });
    
    let totalInput = 0;
    for (const utxo of utxos) {
      psbt.addInput({
        hash: utxo.txid,
        index: utxo.vout,
        nonWitnessUtxo: Buffer.from(utxo.hex, 'hex')
      });
      totalInput += utxo.value;
    }
    
    const satoshiAmount = Math.floor(parseFloat(amount) * 100000000);
    const fee = feeRate ? feeRate * 250 : 10000; // Default 10000 satoshis
    
    if (totalInput < satoshiAmount + fee) {
      throw new Error('Insufficient funds');
    }
    
    // Add output
    psbt.addOutput({
      address: destination,
      value: satoshiAmount
    });
    
    // Add change output if needed
    const change = totalInput - satoshiAmount - fee;
    if (change > 546) { // Dust limit
      psbt.addOutput({
        address: address,
        value: change
      });
    }
    
    // Sign all inputs
    for (let i = 0; i < utxos.length; i++) {
      psbt.signInput(i, keyPair);
    }
    
    psbt.finalizeAllInputs();
    const tx = psbt.extractTransaction();
    const txHex = tx.toHex();
    
    // Broadcast transaction (would use a blockchain API)
    const txHash = await broadcastTransaction(txHex);
    
    return {
      success: true,
      txHash
    };
    
  } catch (error) {
    console.error('Bitcoin payment failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Payment failed'
    };
  }
}

async function getUTXOs(address: string): Promise<any[]> {
  try {
    const response = await fetch(`https://blockchain.info/unspent?active=${address}`);
    if (!response.ok) {
      return [];
    }
    const data = await response.json() as any;
    return data.unspent_outputs || [];
  } catch (error) {
    console.error('Failed to get UTXOs:', error);
    return [];
  }
}

async function broadcastTransaction(txHex: string): Promise<string> {
  // In production, would broadcast to Bitcoin network
  // For now, return simulated transaction hash
  return bitcoin.crypto.sha256(Buffer.from(txHex, 'hex')).toString('hex');
}