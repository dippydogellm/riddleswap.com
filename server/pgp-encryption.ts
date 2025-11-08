import * as openpgp from 'openpgp';
import crypto from 'crypto';
import db from './db';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';

interface KeyPair {
  publicKey: string;
  privateKey: string;
  passphrase: string;
}

export class PGPEncryptionService {
  private userKeys: Map<string, KeyPair> = new Map();

  async generateUserKeys(userHandle: string): Promise<KeyPair> {
    // Check if keys already exist
    const existing = this.userKeys.get(userHandle);
    if (existing) return existing;

    // Generate a secure passphrase
    const passphrase = crypto.randomBytes(32).toString('base64');

    // Generate key pair
    const { privateKey, publicKey } = await openpgp.generateKey({
      type: 'ecc',
      curve: 'curve25519',
      userIDs: [{ 
        name: userHandle,
        email: `${userHandle}@riddleswap.com`
      }],
      passphrase,
      format: 'armored'
    });

    const keyPair: KeyPair = { publicKey, privateKey, passphrase };
    
    // Store in memory cache (in production, store encrypted in database)
    this.userKeys.set(userHandle, keyPair);

    // Store public key in database for other users to encrypt messages
    await this.storePublicKey(userHandle, publicKey);

    return keyPair;
  }

  async storePublicKey(userHandle: string, publicKey: string): Promise<void> {
    try {
      // Store public key in users table (you might want a separate table)
      // For now, we'll use a JSON field or separate table
      console.log(`📝 Storing public key for ${userHandle}`);
      // This would be stored in database in production
    } catch (error) {
      console.error('Error storing public key:', error);
    }
  }

  async getUserPublicKey(userHandle: string): Promise<string | null> {
    // First check cache
    const cached = this.userKeys.get(userHandle);
    if (cached) return cached.publicKey;

    // In production, fetch from database
    // For now, generate if not exists
    const keyPair = await this.generateUserKeys(userHandle);
    return keyPair.publicKey;
  }

  async encryptMessage(
    senderHandle: string,
    recipientHandle: string,
    message: string
  ): Promise<string> {
    try {
      // Get recipient's public key
      const recipientPublicKey = await this.getUserPublicKey(recipientHandle);
      if (!recipientPublicKey) {
        throw new Error(`No public key found for ${recipientHandle}`);
      }

      // Get sender's keys for signing
      let senderKeys = this.userKeys.get(senderHandle);
      if (!senderKeys) {
        senderKeys = await this.generateUserKeys(senderHandle);
      }

      // Read keys
      const publicKey = await openpgp.readKey({ armoredKey: recipientPublicKey });
      const privateKey = await openpgp.decryptKey({
        privateKey: await openpgp.readPrivateKey({ armoredKey: senderKeys.privateKey }),
        passphrase: senderKeys.passphrase
      });

      // Encrypt and sign the message
      const encrypted = await openpgp.encrypt({
        message: await openpgp.createMessage({ text: message }),
        encryptionKeys: publicKey,
        signingKeys: privateKey
      });

      return encrypted;
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt message');
    }
  }

  async decryptMessage(
    recipientHandle: string,
    senderHandle: string,
    encryptedMessage: string
  ): Promise<string> {
    try {
      // Get recipient's private key
      let recipientKeys = this.userKeys.get(recipientHandle);
      if (!recipientKeys) {
        recipientKeys = await this.generateUserKeys(recipientHandle);
      }

      // Get sender's public key for verification
      const senderPublicKey = await this.getUserPublicKey(senderHandle);
      if (!senderPublicKey) {
        throw new Error(`No public key found for ${senderHandle}`);
      }

      // Read keys
      const privateKey = await openpgp.decryptKey({
        privateKey: await openpgp.readPrivateKey({ armoredKey: recipientKeys.privateKey }),
        passphrase: recipientKeys.passphrase
      });
      const publicKey = await openpgp.readKey({ armoredKey: senderPublicKey });

      // Read encrypted message
      const message = await openpgp.readMessage({
        armoredMessage: encryptedMessage
      });

      // Decrypt and verify
      const { data: decrypted, signatures } = await openpgp.decrypt({
        message,
        decryptionKeys: privateKey,
        verificationKeys: publicKey,
        expectSigned: true
      });

      // Verify signature
      try {
        await signatures[0].verified;
        console.log('✅ Message signature verified');
      } catch (e) {
        console.warn('⚠️ Message signature verification failed:', e);
      }

      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt message');
    }
  }

  // Encrypt for storage (server-side encryption)
  async encryptForStorage(data: string): Promise<string> {
    try {
      // Use a server key for storage encryption
      const serverHandle = 'riddleswap-server';
      let serverKeys = this.userKeys.get(serverHandle);
      
      if (!serverKeys) {
        serverKeys = await this.generateUserKeys(serverHandle);
      }

      const publicKey = await openpgp.readKey({ armoredKey: serverKeys.publicKey });

      const encrypted = await openpgp.encrypt({
        message: await openpgp.createMessage({ text: data }),
        encryptionKeys: publicKey
      });

      return encrypted;
    } catch (error) {
      console.error('Storage encryption error:', error);
      throw new Error('Failed to encrypt for storage');
    }
  }

  // Decrypt from storage
  async decryptFromStorage(encryptedData: string): Promise<string> {
    try {
      const serverHandle = 'riddleswap-server';
      let serverKeys = this.userKeys.get(serverHandle);
      
      if (!serverKeys) {
        throw new Error('Server keys not initialized');
      }

      const privateKey = await openpgp.decryptKey({
        privateKey: await openpgp.readPrivateKey({ armoredKey: serverKeys.privateKey }),
        passphrase: serverKeys.passphrase
      });

      const message = await openpgp.readMessage({
        armoredMessage: encryptedData
      });

      const { data: decrypted } = await openpgp.decrypt({
        message,
        decryptionKeys: privateKey
      });

      return decrypted;
    } catch (error) {
      console.error('Storage decryption error:', error);
      throw new Error('Failed to decrypt from storage');
    }
  }

  // Initialize server keys on startup
  async initialize(): Promise<void> {
    console.log('🔐 Initializing PGP encryption service...');
    await this.generateUserKeys('riddleswap-server');
    console.log('✅ PGP encryption service initialized');
  }
}

// Export singleton instance
export const pgpEncryption = new PGPEncryptionService();