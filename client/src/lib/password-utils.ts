import * as CryptoJS from 'crypto-js';

// Client-side password hashing to match server-side implementation
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  // Generate salt if not provided - match server format exactly
  const finalSalt = salt || CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Hex);
  
  // Hash password with PBKDF2 (same as server: 100000 iterations, 32 bytes, SHA-256)
  const hash = CryptoJS.PBKDF2(password, finalSalt, {
    keySize: 32/4, // 32 bytes = 8 words (CryptoJS uses 4-byte words)
    iterations: 100000,
    hasher: CryptoJS.algo.SHA256
  }).toString(CryptoJS.enc.Hex);
  
  return { hash, salt: finalSalt };
}

// Verify password against hash
export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const testHash = CryptoJS.PBKDF2(password, salt, {
    keySize: 32/4, // 32 bytes = 8 words (CryptoJS uses 4-byte words)
    iterations: 100000,
    hasher: CryptoJS.algo.SHA256
  }).toString(CryptoJS.enc.Hex);
  
  return testHash === hash;
}

// FIXED: Encrypt data with password using consistent AES-256-CTR with HMAC
export function encryptWithPassword(data: string, password: string): string {
  // Generate random salt and IV
  const salt = CryptoJS.lib.WordArray.random(32); // 32 bytes
  const iv = CryptoJS.lib.WordArray.random(16); // 16 bytes for CTR mode
  
  // Derive key using PBKDF2
  const key = CryptoJS.PBKDF2(password, salt, {
    keySize: 256/32, // 32 bytes = 8 words
    iterations: 100000,
    hasher: CryptoJS.algo.SHA256
  });
  
  // Encrypt using AES-CTR mode
  const encrypted = CryptoJS.AES.encrypt(data, key, {
    iv: iv,
    mode: CryptoJS.mode.CTR,
    padding: CryptoJS.pad.NoPadding
  });
  
  // Create HMAC for authentication
  const hmac = CryptoJS.HmacSHA256(encrypted.toString(), key);
  
  // Combine all components
  const result = {
    encrypted: encrypted.toString(),
    salt: salt.toString(CryptoJS.enc.Hex),
    iv: iv.toString(CryptoJS.enc.Hex),
    hmac: hmac.toString(CryptoJS.enc.Hex)
  };
  
  return JSON.stringify(result);
}

// FIXED: Decrypt data with password using consistent method
export function decryptWithPassword(encryptedData: string, password: string): string {
  try {
    const parsed = JSON.parse(encryptedData);
    
    const salt = CryptoJS.enc.Hex.parse(parsed.salt);
    const iv = CryptoJS.enc.Hex.parse(parsed.iv);
    
    // Derive same key
    const key = CryptoJS.PBKDF2(password, salt, {
      keySize: 256/32,
      iterations: 100000,
      hasher: CryptoJS.algo.SHA256
    });
    
    // Verify HMAC for data integrity
    const expectedHmac = CryptoJS.HmacSHA256(parsed.encrypted, key);
    if (expectedHmac.toString(CryptoJS.enc.Hex) !== parsed.hmac) {
      throw new Error('Data integrity check failed - possible tampering detected');
    }
    
    // Decrypt using AES-CTR mode
    const decrypted = CryptoJS.AES.decrypt(parsed.encrypted, key, {
      iv: iv,
      mode: CryptoJS.mode.CTR,
      padding: CryptoJS.pad.NoPadding
    });
    
    const result = decrypted.toString(CryptoJS.enc.Utf8);
    if (!result) {
      throw new Error('Decryption failed - invalid password or corrupted data');
    }
    
    return result;
  } catch (error) {

    throw new Error('Failed to decrypt data');
  }
}
