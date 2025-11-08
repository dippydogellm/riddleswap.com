import { z } from 'zod';

// Wallet password validation
export const walletPasswordSchema = z.object({
  handle: z.string()
    .min(3, 'Handle must be at least 3 characters')
    .max(20, 'Handle must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Handle can only contain letters, numbers, and underscores')
    .refine(
      val => !['admin', 'administrator', 'root', 'system', 'test'].includes(val.toLowerCase()), 
      'Reserved handle name'
    ),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password must be at most 100 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    )
});

// Enhanced wallet creation validation
export const walletCreationSchema = z.object({
  handle: z.string()
    .min(3, 'Handle must be at least 3 characters')
    .max(20, 'Handle must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Handle can only contain letters, numbers, and underscores')
    .refine(
      val => !['admin', 'administrator', 'root', 'system', 'test'].includes(val.toLowerCase()), 
      'Reserved handle name'
    ),
  masterPassword: z.string()
    .min(12, 'Master password must be at least 12 characters')
    .max(100, 'Master password must be at most 100 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/, 
      'Master password must contain uppercase, lowercase, number, and special character'
    ),
  linkedWalletAddress: z.string().optional(),
  linkedWalletChain: z.enum(['ETH', 'SOL', 'XRP', 'BTC']).optional(),
  autoLogoutEnabled: z.boolean().default(true),
  autoLogoutMinutes: z.number().min(5).max(1440).default(30)
});

// Seed phrase validation
export const seedPhraseSchema = z.object({
  seedPhrase: z.string()
    .regex(/^(\w+\s){11,23}\w+$/, 'Invalid seed phrase format')
    .refine(val => {
      const words = val.trim().split(/\s+/);
      return [12, 15, 18, 21, 24].includes(words.length);
    }, 'Seed phrase must be 12, 15, 18, 21, or 24 words')
    .refine(val => {
      // Basic check for common words - in production, validate against BIP39 wordlist
      const words = val.trim().split(/\s+/);
      return words.every(word => /^[a-z]+$/.test(word) && word.length >= 3 && word.length <= 8);
    }, 'Seed phrase contains invalid words')
});

// Transaction validation
export const transactionSchema = z.object({
  toAddress: z.string()
    .min(10, 'Address too short')
    .max(100, 'Address too long')
    .regex(/^[a-zA-Z0-9]+$/, 'Invalid address format'),
  amount: z.string()
    .regex(/^\d+(\.\d{1,18})?$/, 'Invalid amount format')
    .refine(val => parseFloat(val) > 0, 'Amount must be greater than 0')
    .refine(val => parseFloat(val) < 1000000, 'Amount too large'),
  chain: z.enum(['ETH', 'XRP', 'SOL', 'BTC']),
  gasPrice: z.string().optional(),
  gasLimit: z.string().optional()
});

// Password change validation
export const passwordChangeSchema = z.object({
  handle: z.string()
    .min(3, 'Handle must be at least 3 characters')
    .max(20, 'Handle must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Handle can only contain letters, numbers, and underscores'),
  currentPassword: z.string()
    .min(8, 'Current password must be at least 8 characters')
    .max(100, 'Current password must be at most 100 characters'),
  newPassword: z.string()
    .min(12, 'New password must be at least 12 characters')
    .max(100, 'New password must be at most 100 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/, 
      'New password must contain uppercase, lowercase, number, and special character'
    )
}).refine(
  data => data.currentPassword !== data.newPassword,
  {
    message: "New password must be different from current password",
    path: ["newPassword"]
  }
);

// Session validation
export const sessionSchema = z.object({
  sessionToken: z.string()
    .min(10, 'Invalid session token')
    .max(200, 'Session token too long')
    .regex(/^[a-zA-Z0-9-_]+$/, 'Invalid session token format')
});