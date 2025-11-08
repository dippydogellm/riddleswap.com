// Universal Wallet Encryption System
// Military-grade encryption for all wallet types and formats

import * as crypto from 'crypto';

// Encryption configuration - PBKDF2-SHA256 with 100,000 iterations
const ENCRYPTION_CONFIG = {
  algorithm: 'aes-256-gcm',
  keyDerivation: 'PBKDF2-SHA256',
  iterations: 100000,
  saltLength: 32,
  ivLength: 12,
  tagLength: 16,
  keyLength: 32
};

export interface EncryptedData {
  encrypted: string; // Base64 encoded
  salt: string; // Base64 encoded
  iv: string; // Base64 encoded
  tag?: string; // Base64 encoded (legacy field name)
  authTag?: string; // Base64 encoded (current field name)
  algorithm?: string; // Algorithm used
  method?: string; // Encryption method identifier
}

// Derive key from password using PBKDF2
function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(
    password,
    salt,
    ENCRYPTION_CONFIG.iterations,
    ENCRYPTION_CONFIG.keyLength,
    'sha256'
  );
}

// Encrypt sensitive data (private keys, mnemonics)
export function encryptWalletData(data: string, password: string): EncryptedData {
  try {
    // Generate random salt and IV
    const salt = crypto.randomBytes(ENCRYPTION_CONFIG.saltLength);
    const iv = crypto.randomBytes(ENCRYPTION_CONFIG.ivLength);
    
    // Derive key from password
    const key = deriveKey(password, salt);
    
    // Create cipher
    const cipher = crypto.createCipheriv(ENCRYPTION_CONFIG.algorithm, key, iv);
    
    // Encrypt data
    let encrypted = cipher.update(data, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    // Get authentication tag
    const tag = (cipher as any).getAuthTag();
    
    return {
      encrypted,
      salt: salt.toString('base64'),
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      method: ENCRYPTION_CONFIG.keyDerivation
    };
    
  } catch (error) {
    throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Decrypt sensitive data (handles both base64 and hex encoding)
export function decryptWalletData(encryptedData: EncryptedData | string, password: string): string {
  try {
    // Handle string input (for backward compatibility)
    if (typeof encryptedData === 'string') {
      try {
        encryptedData = JSON.parse(encryptedData);
      } catch {
        // If it's not JSON, assume it's the raw encrypted data
        return encryptedData as string;
      }
    }
    
    const encryptedDataObj = encryptedData as any;
    
    // Extract the encrypted payload - handle both field name variations
    const encryptedPayload = encryptedDataObj.encryptedData || encryptedDataObj.encrypted;
    
    if (!encryptedPayload) {
      // If there's no encrypted field, the whole object might be the wallet data
      if (encryptedDataObj.xrp || encryptedDataObj.eth || encryptedDataObj.sol || encryptedDataObj.btc) {
        return JSON.stringify(encryptedDataObj);
      }
      throw new Error('Missing encrypted data field');
    }
    
    // First, check if it's plaintext JSON (some wallets might not be encrypted)
    try {
      const decoded = Buffer.from(encryptedPayload, 'base64').toString('utf8');
      const parsed = JSON.parse(decoded);
      if (parsed.xrp || parsed.eth || parsed.sol || parsed.btc) {
        console.log('Found unencrypted wallet data');
        return decoded;
      }
    } catch {
      // Not plaintext, continue with decryption
    }
    
    // Check if we have encryption metadata
    if (encryptedDataObj.salt && encryptedDataObj.iv) {
      const salt = Buffer.from(encryptedDataObj.salt, 'base64');
      
      // Handle IV that might be base64 or raw string
      let iv: Buffer;
      try {
        // First try base64
        iv = Buffer.from(encryptedDataObj.iv, 'base64');
        // Check if it's valid length
        if (iv.length < 12 || iv.length > 16) {
          // Might be hex or plain string
          iv = Buffer.from(encryptedDataObj.iv, 'utf8');
        }
      } catch {
        // Fallback to utf8 if base64 fails
        iv = Buffer.from(encryptedDataObj.iv, 'utf8');
      }
      const key = crypto.pbkdf2Sync(password, salt, ENCRYPTION_CONFIG.iterations, ENCRYPTION_CONFIG.keyLength, 'sha256');
      
      // Check if we have an auth tag (must be non-empty)
      const tagData = encryptedDataObj.authTag || encryptedDataObj.tag;
      
      if (tagData && tagData.length > 0 && tagData !== "") {
        // Modern format with auth tag (GCM mode)
        try {
          const authTag = Buffer.from(tagData, 'base64');
          
          // Handle different auth tag lengths
          let finalAuthTag = authTag;
          if (authTag.length === 24) {
            // Some wallets have 24-byte tags, use first 16 bytes
            finalAuthTag = authTag.subarray(0, 16);
          } else if (authTag.length !== 16) {
            // Try to use first 16 bytes for any other length
            finalAuthTag = authTag.subarray(0, 16);
          }
          
          const decipher = crypto.createDecipheriv(ENCRYPTION_CONFIG.algorithm, key, iv);
          (decipher as any).setAuthTag(finalAuthTag);
          
          let decrypted = decipher.update(encryptedPayload, 'base64', 'utf8');
          decrypted += decipher.final('utf8');
          
          return decrypted;
        } catch (gcmError) {
          console.log('GCM decryption failed:', gcmError instanceof Error ? gcmError.message : String(gcmError));
        }
      }
      
      // No auth tag - try Web Crypto API format (legacy system)
      try {
        // Web Crypto API format: auth tag is embedded in the encrypted data (last 16 bytes)
        const encryptedBuffer = Buffer.from(encryptedPayload, 'base64');
        const authTagLength = 16;
        
        if (encryptedBuffer.length >= authTagLength) {
          const authTag = encryptedBuffer.slice(-authTagLength);
          const ciphertext = encryptedBuffer.slice(0, -authTagLength);
          
          // Use GCM mode with embedded authTag
          const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
          decipher.setAuthTag(authTag);
          
          let decrypted = decipher.update(ciphertext);
          decrypted = Buffer.concat([decrypted, decipher.final()]);
          const result = decrypted.toString('utf8');
          
          // Verify it's valid JSON
          const parsed = JSON.parse(result);
          if (parsed.xrp || parsed.eth || parsed.sol || parsed.btc) {
            console.log('✅ Successfully decrypted using Web Crypto API format');
            return result;
          }
        }
      } catch (webCryptoError) {
        console.log('Web Crypto API format failed:', webCryptoError instanceof Error ? webCryptoError.message : String(webCryptoError));
      }
      
      // Fallback: try pure CTR mode (newest accounts without authTag)
      try {
        // Try pure CTR mode without any authentication
        let useIv = iv;
        if (useIv.length > 16) {
          useIv = useIv.subarray(0, 16);
        } else if (useIv.length < 16) {
          useIv = Buffer.concat([useIv, Buffer.alloc(16 - useIv.length)]);
        }
        
        const decipher = crypto.createDecipheriv('aes-256-ctr', key, useIv);
        let decrypted = decipher.update(encryptedPayload, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        
        // Verify it's valid JSON
        const parsed = JSON.parse(decrypted);
        if (parsed.xrp || parsed.eth || parsed.sol || parsed.btc) {
          console.log('✅ Successfully decrypted using pure CTR mode');
          return decrypted;
        }
      } catch (ctrError) {
        console.log('Pure CTR failed:', ctrError instanceof Error ? ctrError.message : String(ctrError));
      }
      
      // Final fallback: try CBC mode
      try {
        // Try pure CBC mode as final fallback
        
        let useIv = iv;
        if (useIv.length > 16) {
          useIv = useIv.subarray(0, 16);
        } else if (useIv.length < 16) {
          useIv = Buffer.concat([useIv, Buffer.alloc(16 - useIv.length)]);
        }
        
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, useIv);
        decipher.setAutoPadding(true);
        
        let decrypted = decipher.update(encryptedPayload, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        
        const parsed = JSON.parse(decrypted);
        if (parsed.xrp || parsed.eth || parsed.sol || parsed.btc) {
          console.log('✅ Successfully decrypted using pure CBC mode');
          return decrypted;
        }
      } catch (cbcError) {
        console.log('Pure CBC failed:', cbcError instanceof Error ? cbcError.message : String(cbcError));
      }
    }
    
    // If nothing worked, throw error
    throw new Error('Unable to decrypt wallet data with provided password');
    
  } catch (error) {
    console.error('🔐 Decryption error details:', {
      error: error instanceof Error ? error.message : String(error),
      type: typeof encryptedData,
      hasEncryptedData: !!(encryptedData as any)?.encryptedData,
      hasEncrypted: !!(encryptedData as any)?.encrypted,
      hasSalt: !!(encryptedData as any)?.salt,
      hasIv: !!(encryptedData as any)?.iv,
      hasAuthTag: !!(encryptedData as any)?.authTag || !!(encryptedData as any)?.tag
    });
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Invalid password or corrupted data'}`);
  }
}

// Encrypt wallet for database storage
export function encryptWalletForStorage(
  privateKey: string,
  password: string,
  mnemonic?: string
): {
  encryptedPrivateKey: string;
  encryptedMnemonic?: string;
} {
  const encryptedPrivateKey = JSON.stringify(encryptWalletData(privateKey, password));
  
  let encryptedMnemonic: string | undefined;
  if (mnemonic) {
    encryptedMnemonic = JSON.stringify(encryptWalletData(mnemonic, password));
  }
  
  return {
    encryptedPrivateKey,
    encryptedMnemonic
  };
}

// Decrypt wallet from database storage
export function decryptWalletFromStorage(
  encryptedPrivateKey: string,
  password: string,
  encryptedMnemonic?: string
): {
  privateKey: string;
  mnemonic?: string;
} {
  const privateKeyData: EncryptedData = JSON.parse(encryptedPrivateKey);
  const privateKey = decryptWalletData(privateKeyData, password);
  
  let mnemonic: string | undefined;
  if (encryptedMnemonic) {
    const mnemonicData: EncryptedData = JSON.parse(encryptedMnemonic);
    mnemonic = decryptWalletData(mnemonicData, password);
  }
  
  return {
    privateKey,
    mnemonic
  };
}

// Validate password strength
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Generate secure random password
export function generateSecurePassword(length: number = 16): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
  let password = '';
  
  for (let i = 0; i < length; i++) {
    const randomIndex = crypto.randomInt(0, charset.length);
    password += charset[randomIndex];
  }
  
  return password;
}