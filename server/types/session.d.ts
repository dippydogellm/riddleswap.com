/**
 * Session Type Extensions
 * Adds imported wallet keys caching to session
 */

import 'express-session';

declare module 'express-session' {
  interface SessionData {
    handle?: string;
    riddleHandle?: string;
    cachedKeys?: any;
    walletData?: any;
    importedWalletKeys?: {
      [key: string]: string; // Format: "{chain}_{address}": "private_key"
    };
  }
}
