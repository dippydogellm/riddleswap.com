import { Wallet as XRPLWallet } from 'xrpl';
import * as bip39 from 'bip39';

export interface XRPLWalletData {
  address: string;
  seed: string;
  publicKey: string;
  privateKey: string;
}

export async function generateXRPLWallet(seedPhrase: string): Promise<XRPLWalletData> {
  // Validate seed phrase
  if (!bip39.validateMnemonic(seedPhrase)) {
    throw new Error('Invalid seed phrase for XRPL wallet generation');
  }

  // Convert seed phrase to seed
  const seed = await bip39.mnemonicToSeed(seedPhrase);
  
  // Use the first 16 bytes of the seed to generate a deterministic XRPL wallet
  const seedHex = seed.toString('hex').substring(0, 32); // First 16 bytes as hex
  const wallet = XRPLWallet.fromSeed(seedHex);
  
  return {
    address: wallet.address,
    seed: wallet.seed || '',
    publicKey: wallet.publicKey,
    privateKey: wallet.privateKey
  };
}

export function generateXRPLFromSeed(seed: string): XRPLWalletData {
  // Use the provided seed to generate a deterministic XRPL wallet
  const wallet = XRPLWallet.fromSeed(seed);
  return {
    address: wallet.address,
    seed: wallet.seed || '',
    publicKey: wallet.publicKey,
    privateKey: wallet.privateKey
  };
}