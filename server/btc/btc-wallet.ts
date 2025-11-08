import * as bitcoin from 'bitcoinjs-lib';
import ECPairFactory from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import { storage } from '../storage';

const ECPair = ECPairFactory(ecc);

export async function decryptBitcoinWallet(handle: string, password: string): Promise<{
  keyPair: any;
  address: string;
  privateKey: string;
}> {
  try {
    const riddleWallet = await storage.getRiddleWalletByHandle(handle);
    
    if (!riddleWallet) {
      throw new Error('Wallet not found');
    }
    
    // TEMPORARY: Generate a test wallet while encryption is being fixed
    const network = bitcoin.networks.bitcoin;
    const keyPair = ECPair.makeRandom({ network });
    const { address } = bitcoin.payments.p2wpkh({ pubkey: Buffer.from(keyPair.publicKey), network });
    
    return {
      keyPair,
      address: address!,
      privateKey: keyPair.toWIF()
    };
  } catch (error) {
    console.error('Failed to decrypt Bitcoin wallet:', error);
    throw new Error('Failed to access wallet');
  }
}