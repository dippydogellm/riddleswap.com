// Client-side AES-256-GCM encryption utilities
// The server cannot decrypt this data - only the client with the password can

export interface EncryptedData {
  encryptedData: string;
  iv: string;
  salt: string;
  authTag: string;
}

export class ClientCrypto {
  // Derive key from password using PBKDF2
  private static async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);
    
    // Import password as key material
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      'PBKDF2',
      false,
      ['deriveKey']
    );
    
    // Derive AES-GCM key using PBKDF2
    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000, // High iteration count for security
        hash: 'SHA-256'
      },
      keyMaterial,
      {
        name: 'AES-GCM',
        length: 256
      },
      false,
      ['encrypt', 'decrypt']
    );
  }

  // Encrypt data with AES-256-GCM
  static async encryptData(data: string, password: string): Promise<EncryptedData> {
    try {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);
      
      // Generate random salt and IV
      const salt = crypto.getRandomValues(new Uint8Array(32));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      // Derive encryption key
      const key = await this.deriveKey(password, salt);
      
      // Encrypt the data - Web Crypto API handles auth tag automatically
      const encryptedBuffer = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        key,
        dataBuffer
      );
      
      // Web Crypto API returns the entire encrypted data including auth tag
      // We store the complete encrypted buffer - no manual auth tag extraction needed
      const encrypted = new Uint8Array(encryptedBuffer);
      
      return {
        encryptedData: this.arrayBufferToBase64(encrypted),
        iv: this.arrayBufferToBase64(iv),
        salt: this.arrayBufferToBase64(salt),
        authTag: '' // Not used with Web Crypto API - auth tag is embedded
      };
    } catch (error: any) {
      throw new Error('Encryption failed: ' + (error?.message || 'Unknown error'));
    }
  }

  // Decrypt data with AES-256-GCM
  static async decryptData(encryptedData: EncryptedData, password: string): Promise<string> {
    try {
      // Convert base64 back to arrays
      const salt = this.base64ToArrayBuffer(encryptedData.salt);
      const iv = this.base64ToArrayBuffer(encryptedData.iv);
      const encrypted = this.base64ToArrayBuffer(encryptedData.encryptedData);
      
      // Derive decryption key
      const key = await this.deriveKey(password, new Uint8Array(salt));
      
      // Decrypt the data - Web Crypto API handles auth tag verification automatically
      const decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: new Uint8Array(iv)
        },
        key,
        encrypted
      );
      
      const decoder = new TextDecoder();
      return decoder.decode(decryptedBuffer);
    } catch (error: any) {
      throw new Error('Decryption failed - invalid password or corrupted data');
    }
  }

  // Store encrypted data in localStorage
  static async storeEncrypted(key: string, data: EncryptedData): Promise<void> {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error: any) {
      throw new Error('Failed to store encrypted data: ' + (error?.message || 'Unknown error'));
    }
  }

  // Retrieve and parse encrypted data from localStorage
  static getEncrypted(key: string): EncryptedData | null {
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return null;
      
      const parsed = JSON.parse(stored);
      
      // Validate structure - authTag is optional for Web Crypto API format
      if (!parsed.encryptedData || !parsed.iv || !parsed.salt) {
        throw new Error('Invalid encrypted data structure');
      }
      
      return parsed as EncryptedData;
    } catch (error: any) {

      return null;
    }
  }

  // Remove encrypted data from localStorage
  static removeEncrypted(key: string): void {
    localStorage.removeItem(key);
  }

  // Utility: Convert ArrayBuffer to base64
  private static arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  // Utility: Convert base64 to ArrayBuffer
  private static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // Verify if encrypted data can be decrypted (password check)
  static async verifyPassword(encryptedData: EncryptedData, password: string): Promise<boolean> {
    try {
      await this.decryptData(encryptedData, password);
      return true;
    } catch {
      return false;
    }
  }

  // Generate secure random password
  static generateSecurePassword(length: number = 32): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(values, byte => charset[byte % charset.length]).join('');
  }

  // Hash data using SHA-256
  static async hashData(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    return this.arrayBufferToBase64(hashBuffer);
  }
}
