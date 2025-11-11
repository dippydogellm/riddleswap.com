/**
 * Session validation utilities for payment and transaction operations
 * Ensures users have valid sessions with private keys before performing sensitive operations
 */

import { sessionManager } from './sessionManager';

export interface SessionCheckResult {
  valid: boolean;
  needsRenewal: boolean;
  message?: string;
}

/**
 * Check if user has valid session with private keys for transactions
 * Use this before any payment, swap, or transaction operation
 */
export function checkSessionForPayment(): SessionCheckResult {
  const session = sessionManager.getSession();
  
  // Not logged in at all
  if (!session.isLoggedIn || !session.sessionToken) {
    return {
      valid: false,
      needsRenewal: false,
      message: 'Please login to perform this transaction'
    };
  }
  
  // Session exists but needs renewal (private keys expired)
  if ((session as any).needsRenewal) {
    return {
      valid: false,
      needsRenewal: true,
      message: 'Please renew your session to perform this transaction'
    };
  }
  
  // Valid session with keys
  return {
    valid: true,
    needsRenewal: false
  };
}

/**
 * Check if user can browse (less strict - allows viewing without login)
 */
export function checkSessionForBrowsing(): boolean {
  // Browsing is always allowed, even without login
  return true;
}

/**
 * Hook-friendly version for React components
 */
export function useSessionCheck() {
  return {
    checkForPayment: checkSessionForPayment,
    checkForBrowsing: checkSessionForBrowsing
  };
}
