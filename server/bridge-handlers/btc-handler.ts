// Bitcoin Bridge Handler - Handles BTC transactions

import * as bitcoin from 'bitcoinjs-lib';
import * as ECPair from 'ecpair';
import * as tinySecp from 'tiny-secp256k1';
import { ChainHandler, ChainPaymentParams, BridgePaymentResponse, BANK_WALLETS } from './types';

export class BTCHandler implements ChainHandler {
  private network: bitcoin.Network;

  constructor() {
    this.network = bitcoin.networks.bitcoin;
  }

  getBankWallet(): string {
    return BANK_WALLETS.BTC;
  }

  validateAddress(address: string): boolean {
    try {
      bitcoin.address.toOutputScript(address, this.network);
      return true;
    } catch {
      return false;
    }
  }

  async execute(params: ChainPaymentParams): Promise<BridgePaymentResponse> {
    console.log('🔗 === BITCOIN TRANSFER START ===');
    console.log('📊 Transfer Parameters:', {
      from: params.fromAddress,
      to: params.toAddress,
      amount: params.amount
    });

    try {
      // Parse private key
      let privateKeyBuffer: Buffer;
      
      if (params.privateKey.includes(',')) {
        // Handle comma-separated format
        const keyArray = params.privateKey.split(',').map(num => parseInt(num.trim()));
        privateKeyBuffer = Buffer.from(keyArray);
      } else {
        // Handle hex format
        privateKeyBuffer = Buffer.from(params.privateKey, 'hex');
      }

      // Create keypair
  const ECPairFactory = ECPair.ECPairFactory(tinySecp as any);
      const keyPair = ECPairFactory.fromPrivateKey(privateKeyBuffer);
      
      // Verify address
      const { address } = bitcoin.payments.p2pkh({ 
        pubkey: Buffer.from(keyPair.publicKey),
        network: this.network 
      });
      
      if (address !== params.fromAddress) {
        throw new Error(`Address mismatch: expected ${params.fromAddress}, got ${address}`);
      }

      console.log('🔑 Wallet verified:', address);

      // Get UTXOs
      console.log('📡 Fetching UTXOs...');
      const utxoResponse = await fetch(`https://blockstream.info/api/address/${params.fromAddress}/utxo`);
      const utxos = await utxoResponse.json();
      
      if (!utxos.length) {
        throw new Error('No UTXOs available');
      }

      console.log(`📊 Found ${utxos.length} UTXOs`);

      // Build transaction
      const satoshiAmount = Math.round(parseFloat(params.amount) * 100000000);
      const fee = 1000; // 0.00001 BTC fee
      
      const psbt = new bitcoin.Psbt({ network: this.network });
      let totalInput = 0;
      
      // Add inputs
      for (const utxo of utxos) {
        if (totalInput >= satoshiAmount + fee) break;
        
        const txHex = await fetch(`https://blockstream.info/api/tx/${utxo.txid}/hex`).then(r => r.text());
        psbt.addInput({
          hash: utxo.txid,
          index: utxo.vout,
          nonWitnessUtxo: Buffer.from(txHex, 'hex')
        });
        totalInput += utxo.value;
      }
      
      if (totalInput < satoshiAmount + fee) {
        throw new Error(`Insufficient funds. Need: ${satoshiAmount + fee}, Have: ${totalInput}`);
      }

      // Add output to bank wallet
      psbt.addOutput({
        address: params.toAddress,
        value: satoshiAmount
      });
      
      // Add change output if needed
      const change = totalInput - satoshiAmount - fee;
      if (change > 546) { // Dust threshold
        psbt.addOutput({
          address: params.fromAddress,
          value: change
        });
      }

      // Sign transaction
      console.log('✍️ Signing transaction...');
      const signer = {
        publicKey: Buffer.from(keyPair.publicKey),
        sign: (hash: Buffer): Buffer => {
          const sig = keyPair.sign(hash);
          return Buffer.from(sig);
        }
      };
      
      for (let i = 0; i < psbt.inputCount; i++) {
        psbt.signInput(i, signer);
      }
      
      psbt.finalizeAllInputs();
      const tx = psbt.extractTransaction();
      const txHex = tx.toHex();
      
      // Broadcast transaction
      console.log('📡 Broadcasting transaction...');
      const broadcastResponse = await fetch('https://blockstream.info/api/tx', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: txHex
      });
      
      if (!broadcastResponse.ok) {
        const error = await broadcastResponse.text();
        throw new Error(`Broadcast failed: ${error}`);
      }
      
      const txHash = await broadcastResponse.text();
      console.log('✅ Bitcoin transaction broadcast:', txHash);

      return {
        success: true,
        txHash: txHash,
        bankWalletAddress: params.toAddress,
        memo: params.memo,
        message: `Successfully sent ${params.amount} BTC`
      };

    } catch (error) {
      console.error('💥 Bitcoin transaction error:', error);
      return {
        success: false,
        error: 'Transaction failed',
        message: error instanceof Error ? error.message : 'Bitcoin transaction failed'
      };
    } finally {
      console.log('🔗 === BITCOIN TRANSFER END ===');
    }
  }
}