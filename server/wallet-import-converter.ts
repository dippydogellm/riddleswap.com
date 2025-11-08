/**
 * Wallet Import Conversion Utilities
 * Converts various wallet input formats (mnemonic, seeds, secrets) to standard private keys
 */

import { ethers } from 'ethers';
import * as xrpl from 'xrpl';
import { Keypair } from '@solana/web3.js';
import * as bip39 from 'bip39';
import * as bitcoinjs from 'bitcoinjs-lib';
import { BIP32Factory } from 'bip32';
import * as ecc from 'tiny-secp256k1';
import { derivePath } from 'ed25519-hd-key';
import { ECPairFactory } from 'ecpair';
import bs58 from 'bs58';

const bip32 = BIP32Factory(ecc);
const ECPair = ECPairFactory(ecc);

// Standard BIP44 derivation paths
export const DERIVATION_PATHS = {
  ETH: "m/44'/60'/0'/0/0",
  SOL: "m/44'/501'/0'/0'",
  BTC: "m/44'/0'/0'/0/0",
  BSC: "m/44'/60'/0'/0/0",  // Same as ETH
  POLYGON: "m/44'/60'/0'/0/0",  // Same as ETH
  ARBITRUM: "m/44'/60'/0'/0/0",  // Same as ETH
  OPTIMISM: "m/44'/60'/0'/0/0",  // Same as ETH
  BASE: "m/44'/60'/0'/0/0",  // Same as ETH
};

export interface WalletImportResult {
  address: string;
  privateKey: string;
  derivationPath?: string;
  importMethod: 'mnemonic' | 'private_key' | 'xrpl_seed' | 'xrpl_secret';
  originalFormat: string;
}

/**
 * Import Ethereum wallet from mnemonic or private key
 */
export async function importEthereumWallet(
  input: string,
  chain: string = 'eth'
): Promise<WalletImportResult> {
  const trimmedInput = input.trim();

  // Check if it's a mnemonic (12 or 24 words)
  const wordCount = trimmedInput.split(/\s+/).length;
  if (wordCount === 12 || wordCount === 24) {
    // Validate mnemonic
    if (!bip39.validateMnemonic(trimmedInput)) {
      throw new Error('Invalid mnemonic phrase');
    }

    const derivationPath = DERIVATION_PATHS.ETH;
    const hdNode = ethers.HDNodeWallet.fromPhrase(trimmedInput);
    const wallet = hdNode.derivePath(derivationPath);

    return {
      address: wallet.address,
      privateKey: wallet.privateKey,
      derivationPath,
      importMethod: 'mnemonic',
      originalFormat: 'mnemonic'
    };
  } else {
    // Assume it's a private key
    try {
      // Ensure it has 0x prefix
      const privateKey = trimmedInput.startsWith('0x') ? trimmedInput : `0x${trimmedInput}`;
      const wallet = new ethers.Wallet(privateKey);

      return {
        address: wallet.address,
        privateKey: wallet.privateKey,
        importMethod: 'private_key',
        originalFormat: 'private_key'
      };
    } catch (error) {
      throw new Error('Invalid private key format');
    }
  }
}

/**
 * Import Solana wallet from mnemonic or private key
 */
export async function importSolanaWallet(input: string): Promise<WalletImportResult> {
  const trimmedInput = input.trim();

  // Check if it's a mnemonic
  const wordCount = trimmedInput.split(/\s+/).length;
  if (wordCount === 12 || wordCount === 24) {
    // Validate mnemonic
    if (!bip39.validateMnemonic(trimmedInput)) {
      throw new Error('Invalid mnemonic phrase');
    }

    const seed = await bip39.mnemonicToSeed(trimmedInput);
    const derivationPath = DERIVATION_PATHS.SOL;
    
    // Derive Solana keypair from seed
    const derivedSeed = derivePath(derivationPath, seed.toString('hex')).key;
    const keypair = Keypair.fromSeed(derivedSeed);

    // Store as base64 (internal storage format)
    const privateKeyBase64 = Buffer.from(keypair.secretKey).toString('base64');

    return {
      address: keypair.publicKey.toBase58(),
      privateKey: privateKeyBase64,
      derivationPath,
      importMethod: 'mnemonic',
      originalFormat: 'mnemonic'
    };
  } else {
    // Assume it's a private key (base58, base64, or JSON array)
    try {
      let keypair: Keypair;
      let detectedFormat = 'unknown';

      // Try parsing as JSON array first
      if (trimmedInput.startsWith('[')) {
        const secretArray = JSON.parse(trimmedInput);
        keypair = Keypair.fromSecretKey(Uint8Array.from(secretArray));
        detectedFormat = 'json_array';
      } else {
        // Try as base58 first (most common Solana format)
        try {
          const secretKey = bs58.decode(trimmedInput);
          if (secretKey.length === 64) {
            keypair = Keypair.fromSecretKey(secretKey);
            detectedFormat = 'base58';
          } else {
            throw new Error('Invalid key length from base58');
          }
        } catch (base58Error) {
          // If base58 fails, try as base64
          try {
            const secretKey = Buffer.from(trimmedInput, 'base64');
            if (secretKey.length === 64) {
              keypair = Keypair.fromSecretKey(new Uint8Array(secretKey));
              detectedFormat = 'base64';
            } else {
              throw new Error('Invalid key length from base64');
            }
          } catch (base64Error) {
            throw new Error('Invalid private key format. Solana keys should be base58, base64, or a JSON array of 64 bytes.');
          }
        }
      }

      // Store as base64 (internal storage format)
      const privateKeyBase64 = Buffer.from(keypair.secretKey).toString('base64');

      return {
        address: keypair.publicKey.toBase58(),
        privateKey: privateKeyBase64,
        importMethod: 'private_key',
        originalFormat: detectedFormat
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Invalid Solana private key format');
    }
  }
}

/**
 * Import Bitcoin wallet from mnemonic or private key
 */
export async function importBitcoinWallet(input: string): Promise<WalletImportResult> {
  const trimmedInput = input.trim();

  // Check if it's a mnemonic
  const wordCount = trimmedInput.split(/\s+/).length;
  if (wordCount === 12 || wordCount === 24) {
    // Validate mnemonic
    if (!bip39.validateMnemonic(trimmedInput)) {
      throw new Error('Invalid mnemonic phrase');
    }

    const seed = await bip39.mnemonicToSeed(trimmedInput);
    const derivationPath = DERIVATION_PATHS.BTC;
    
    const root = bip32.fromSeed(seed);
    const child = root.derivePath(derivationPath);

    if (!child.privateKey) {
      throw new Error('Failed to derive Bitcoin private key');
    }

  // child.privateKey may be a Uint8Array; ensure Buffer for hex conversion
  const privateKeyHex = Buffer.isBuffer(child.privateKey) ? child.privateKey.toString('hex') : Buffer.from(child.privateKey).toString('hex');
    const { address } = bitcoinjs.payments.p2pkh({
  // Ensure pubkey is a Buffer for downstream Payment template expectations
  pubkey: Buffer.isBuffer(child.publicKey) ? child.publicKey : Buffer.from(child.publicKey),
      network: bitcoinjs.networks.bitcoin
    });

    if (!address) {
      throw new Error('Failed to generate Bitcoin address');
    }

    return {
      address,
      privateKey: privateKeyHex,
      derivationPath,
      importMethod: 'mnemonic',
      originalFormat: 'mnemonic'
    };
  } else {
    // Assume it's a WIF (Wallet Import Format) or hex private key
    try {
      let keyPair;
      
      // Try WIF format first
      try {
        keyPair = ECPair.fromWIF(trimmedInput, bitcoinjs.networks.bitcoin);
      } catch {
        // Try hex format
        const privateKeyBuffer = Buffer.from(trimmedInput, 'hex');
        keyPair = ECPair.fromPrivateKey(privateKeyBuffer, { network: bitcoinjs.networks.bitcoin });
      }

      const { address } = bitcoinjs.payments.p2pkh({
        pubkey: keyPair.publicKey,
        network: bitcoinjs.networks.bitcoin
      });

      if (!address) {
        throw new Error('Failed to generate Bitcoin address');
      }

      const privateKeyHex = keyPair.privateKey?.toString('hex');
      if (!privateKeyHex) {
        throw new Error('Failed to extract private key');
      }

      return {
        address,
        privateKey: privateKeyHex,
        importMethod: 'private_key',
        originalFormat: 'private_key'
      };
    } catch (error) {
      throw new Error('Invalid Bitcoin private key format');
    }
  }
}

/**
 * Import XRPL wallet from seed, secret, or mnemonic
 */
export async function importXRPLWallet(input: string): Promise<WalletImportResult> {
  const trimmedInput = input.trim();

  // Check if it's a mnemonic
  const wordCount = trimmedInput.split(/\s+/).length;
  if (wordCount === 12 || wordCount === 24) {
    // XRPL supports mnemonic → seed conversion
    if (!bip39.validateMnemonic(trimmedInput)) {
      throw new Error('Invalid mnemonic phrase');
    }

    const seed = await bip39.mnemonicToSeed(trimmedInput);
    const seedHex = seed.toString('hex').slice(0, 32); // Take first 16 bytes (32 hex chars)
    const wallet = xrpl.Wallet.fromSeed(seedHex);

    return {
      address: wallet.address,
      privateKey: wallet.privateKey,
      importMethod: 'mnemonic',
      originalFormat: 'mnemonic'
    };
  } 
  // Check if it's a family seed (starts with 's')
  else if (trimmedInput.startsWith('s')) {
    try {
      const wallet = xrpl.Wallet.fromSeed(trimmedInput);

      return {
        address: wallet.address,
        privateKey: wallet.privateKey,
        importMethod: 'xrpl_seed',
        originalFormat: 'xrpl_family_seed'
      };
    } catch (error) {
      throw new Error('Invalid XRPL family seed format');
    }
  }
  // Otherwise, assume it's a private key or secret
  else {
    try {
      // Try as secret (hex format)
      const wallet = xrpl.Wallet.fromSecret(trimmedInput);

      return {
        address: wallet.address,
        privateKey: wallet.privateKey,
        importMethod: 'xrpl_secret',
        originalFormat: 'xrpl_secret'
      };
    } catch (error) {
      throw new Error('Invalid XRPL secret or private key format');
    }
  }
}

/**
 * Universal wallet import - detects chain and imports accordingly
 */
export async function importWallet(
  input: string,
  chain: string
): Promise<WalletImportResult> {
  const normalizedChain = chain.toLowerCase();

  switch (normalizedChain) {
    case 'eth':
    case 'ethereum':
    case 'bsc':
    case 'polygon':
    case 'arbitrum':
    case 'optimism':
    case 'base':
    case 'avalanche':
    case 'fantom':
    case 'cronos':
    case 'gnosis':
    case 'celo':
    case 'moonbeam':
    case 'zksync':
    case 'linea':
      return importEthereumWallet(input, normalizedChain);

    case 'sol':
    case 'solana':
      return importSolanaWallet(input);

    case 'btc':
    case 'bitcoin':
      return importBitcoinWallet(input);

    case 'xrp':
    case 'xrpl':
      return importXRPLWallet(input);

    default:
      throw new Error(`Unsupported chain: ${chain}`);
  }
}

/**
 * Validate wallet input before import
 */
export function validateWalletInput(input: string, chain: string): {
  valid: boolean;
  error?: string;
  detectedFormat?: 'mnemonic' | 'private_key' | 'xrpl_seed' | 'xrpl_secret';
} {
  const trimmedInput = input.trim();

  // Check for empty input
  if (!trimmedInput) {
    return { valid: false, error: 'Input cannot be empty' };
  }

  // Detect mnemonic (12 or 24 words)
  const wordCount = trimmedInput.split(/\s+/).length;
  if (wordCount === 12 || wordCount === 24) {
    if (!bip39.validateMnemonic(trimmedInput)) {
      return { valid: false, error: 'Invalid mnemonic phrase' };
    }
    return { valid: true, detectedFormat: 'mnemonic' };
  }

  // XRPL family seed
  if (trimmedInput.startsWith('s') && chain.toLowerCase() === 'xrp') {
    return { valid: true, detectedFormat: 'xrpl_seed' };
  }

  // Private key (hex, base64, or array for Solana)
  if (chain.toLowerCase() === 'sol' || chain.toLowerCase() === 'solana') {
    if (trimmedInput.startsWith('[')) {
      try {
        JSON.parse(trimmedInput);
        return { valid: true, detectedFormat: 'private_key' };
      } catch {
        return { valid: false, error: 'Invalid JSON array format' };
      }
    }
  }

  // Default to private key
  return { valid: true, detectedFormat: 'private_key' };
}
