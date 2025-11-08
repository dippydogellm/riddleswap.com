import { ethers } from 'ethers';
import * as bip39 from 'bip39';

export interface EthereumWallet {
  address: string;
  privateKey: string;
  publicKey: string;
}

export async function generateEthereumWallet(seedPhrase: string): Promise<EthereumWallet> {
  // Validate seed phrase
  if (!bip39.validateMnemonic(seedPhrase)) {
    throw new Error('Invalid seed phrase for Ethereum wallet generation');
  }

  // Create HD wallet from seed phrase
  const seed = await bip39.mnemonicToSeed(seedPhrase);
  const hdNode = ethers.HDNodeWallet.fromSeed(seed);
  
  // Derive Ethereum wallet at standard path m/44'/60'/0'/0/0
  const derivedWallet = hdNode.derivePath("m/44'/60'/0'/0/0");
  
  return {
    address: derivedWallet.address,
    privateKey: derivedWallet.privateKey,
    publicKey: derivedWallet.publicKey
  };
}

export function generateEthereumFromPrivateKey(privateKey: string): EthereumWallet {
  const wallet = new ethers.Wallet(privateKey);
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    publicKey: wallet.signingKey.publicKey
  };
}