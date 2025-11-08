// Server-side decryption for Web Crypto API format (matches client encryption)
import * as crypto from 'crypto';

interface WebCryptoEncryptedData {
  encryptedData: string;
  iv: string;
  salt: string;
  authTag: string;
}

// Decrypt data encrypted with client-side Web Crypto API
export async function decryptWebCryptoData(encryptedBlob: WebCryptoEncryptedData, password: string): Promise<string> {
  try {
    // Convert base64 back to buffers
    const salt = Buffer.from(encryptedBlob.salt, 'base64');
    const iv = Buffer.from(encryptedBlob.iv, 'base64');
    const encryptedData = Buffer.from(encryptedBlob.encryptedData, 'base64');
    
    // Derive key using PBKDF2 (same as client: 100,000 iterations, SHA-256)
    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
    
    // Create decipher for AES-256-GCM
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    
    // Web Crypto API embeds auth tag in the encrypted data (last 16 bytes)
    const authTagLength = 16;
    const ciphertext = encryptedData.slice(0, -authTagLength);
    const authTag = encryptedData.slice(-authTagLength);
    
    // Set the auth tag for GCM verification
    decipher.setAuthTag(authTag);
    
    // Decrypt the data
    let decrypted = decipher.update(ciphertext, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error('Web Crypto decryption failed: ' + (error as Error).message);
  }
}

// Decrypt wallet private keys from encrypted blob
export async function decryptWalletKeys(encryptedBlob: WebCryptoEncryptedData, password: string): Promise<{
  eth: string;
  xrp: string;
  sol: string;
  btc: string;
}> {
  try {
    const decryptedString = await decryptWebCryptoData(encryptedBlob, password);
    const parsedKeys = JSON.parse(decryptedString);
    
    return {
      eth: parsedKeys.eth || '',
      xrp: parsedKeys.xrp || '',
      sol: parsedKeys.sol || '',
      btc: parsedKeys.btc || ''
    };
  } catch (error) {
    throw new Error('Failed to decrypt wallet keys: ' + (error as Error).message);
  }
}