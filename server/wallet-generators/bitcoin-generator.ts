import * as bip39 from 'bip39';
import { BIP32Factory } from 'bip32';
import * as ecc from 'tiny-secp256k1';
import * as crypto from 'crypto';
import bs58 from 'bs58';

const bip32 = BIP32Factory(ecc);

export interface BitcoinWallet {
  address: string;
  privateKey: string;
  publicKey: string;
}

export async function generateBitcoinWallet(seedPhrase: string): Promise<BitcoinWallet> {
  // Validate seed phrase
  if (!bip39.validateMnemonic(seedPhrase)) {
    throw new Error('Invalid seed phrase for Bitcoin wallet generation');
  }

  // Convert seed phrase to seed
  const seed = await bip39.mnemonicToSeed(seedPhrase);
  
  // Create master key from seed
  const root = bip32.fromSeed(seed);
  
  // Derive Bitcoin wallet at standard path m/44'/0'/0'/0/0
  const child = root.derivePath("m/44'/0'/0'/0/0");
  
  if (!child.privateKey) {
    throw new Error('Failed to derive Bitcoin private key');
  }

  // Generate P2PKH address (1...)
  const address = generateP2PKHAddress(Buffer.from(child.publicKey));
  
  return {
    address,
    privateKey: Buffer.from(child.privateKey).toString('hex'),
    publicKey: Buffer.from(child.publicKey).toString('hex')
  };
}

function generateP2PKHAddress(publicKey: Buffer): string {
  // Step 1: SHA256 hash of public key
  const sha256Hash = crypto.createHash('sha256').update(publicKey).digest();
  
  // Step 2: RIPEMD160 hash of SHA256 hash
  const ripemd160Hash = crypto.createHash('ripemd160').update(sha256Hash).digest();
  
  // Step 3: Add version byte (0x00 for mainnet P2PKH)
  const versionByte = Buffer.from([0x00]);
  const payload = Buffer.concat([versionByte, ripemd160Hash]);
  
  // Step 4: Double SHA256 for checksum
  const checksum = crypto.createHash('sha256')
    .update(crypto.createHash('sha256').update(payload).digest())
    .digest()
    .slice(0, 4);
  
  // Step 5: Concatenate payload and checksum
  const fullPayload = Buffer.concat([payload, checksum]);
  
  // Step 6: Base58 encode
  return bs58.encode(fullPayload);
}

export function generateBitcoinFromPrivateKey(privateKey: string): BitcoinWallet {
  const privateKeyBuffer = Buffer.from(privateKey, 'hex');
  const publicKey = ecc.pointFromScalar(privateKeyBuffer, true);
  
  if (!publicKey) {
    throw new Error('Invalid Bitcoin private key');
  }
  
  const address = generateP2PKHAddress(Buffer.from(publicKey));
  
  return {
    address,
    privateKey,
    publicKey: Buffer.from(publicKey).toString('hex')
  };
}