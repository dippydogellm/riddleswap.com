import { Keypair, PublicKey } from '@solana/web3.js';
import * as bip39 from 'bip39';
import { derivePath } from 'ed25519-hd-key';
import bs58 from 'bs58';

export interface SolanaWallet {
  address: string;
  privateKey: string;
  publicKey: string;
}

export async function generateSolanaWallet(seedPhrase: string): Promise<SolanaWallet> {
  // Validate seed phrase
  if (!bip39.validateMnemonic(seedPhrase)) {
    throw new Error('Invalid seed phrase for Solana wallet generation');
  }

  // Convert seed phrase to seed
  const seed = await bip39.mnemonicToSeed(seedPhrase);
  
  // Derive Solana keypair at standard path m/44'/501'/0'/0'
  const derivedSeed = derivePath("m/44'/501'/0'/0'", seed.toString('hex')).key;
  const keypair = Keypair.fromSeed(derivedSeed);
  
  return {
    address: keypair.publicKey.toBase58(),
    privateKey: bs58.encode(keypair.secretKey),
    publicKey: keypair.publicKey.toBase58()
  };
}

export function generateSolanaFromPrivateKey(privateKey: string): SolanaWallet {
  const secretKey = bs58.decode(privateKey);
  const keypair = Keypair.fromSecretKey(secretKey);
  
  return {
    address: keypair.publicKey.toBase58(),
    privateKey: bs58.encode(keypair.secretKey),
    publicKey: keypair.publicKey.toBase58()
  };
}