// RTN (Riddle Transaction Number) Generator
// Generates unique transaction identifiers with ULID format for tracking and monitoring

import { ulid, monotonicFactory } from 'ulid';

// Monotonic ULID factory for guaranteed uniqueness and ordering
const monoUlid = monotonicFactory();

/**
 * Generates a unique RTN (Riddle Transaction Number) for transaction tracking
 * Format: RTN-YYYYMMDD-<ULID_SUFFIX>
 * 
 * Examples:
 * - RTN-20250921-01HQK7J3H8F9N2M5P7Q8R3S4T6
 * - RTN-20241225-01HQK7K8M2N4P5Q7R8S9T1U3V5
 * 
 * @returns {string} Unique RTN identifier
 */
export function generateRTN(): string {
  const date = new Date();
  // Use UTC for consistent date handling across timezones
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const datePrefix = `${year}${month}${day}`;
  
  // Generate monotonic ULID for guaranteed uniqueness and ordering
  const ulidSuffix = monoUlid();
  
  return `RTN-${datePrefix}-${ulidSuffix}`;
}

/**
 * Validates if a string is a valid RTN format
 * @param rtn The RTN string to validate
 * @returns {boolean} True if valid RTN format
 */
export function isValidRTN(rtn: string): boolean {
  // RTN format: RTN-YYYYMMDD-<26_CHARACTER_ULID>
  const rtnPattern = /^RTN-\d{8}-[0-9A-HJKMNP-TV-Z]{26}$/;
  return rtnPattern.test(rtn);
}

/**
 * Extracts the date from an RTN
 * @param rtn The RTN string
 * @returns {Date | null} The date extracted from RTN, or null if invalid
 */
export function extractDateFromRTN(rtn: string): Date | null {
  if (!isValidRTN(rtn)) {
    return null;
  }
  
  const datePart = rtn.substring(4, 12); // Extract YYYYMMDD part
  const year = parseInt(datePart.substring(0, 4));
  const month = parseInt(datePart.substring(4, 6)) - 1; // Month is 0-indexed
  const day = parseInt(datePart.substring(6, 8));
  
  return new Date(year, month, day);
}

/**
 * Checks if an RTN was generated today (UTC)
 * @param rtn The RTN string
 * @returns {boolean} True if RTN was generated today
 */
export function isRTNFromToday(rtn: string): boolean {
  const rtnDate = extractDateFromRTN(rtn);
  if (!rtnDate) return false;
  
  const today = new Date();
  return (
    rtnDate.getUTCFullYear() === today.getUTCFullYear() &&
    rtnDate.getUTCMonth() === today.getUTCMonth() &&
    rtnDate.getUTCDate() === today.getUTCDate()
  );
}

/**
 * Batch generates multiple RTNs (monotonic factory ensures uniqueness without delays)
 * @param count Number of RTNs to generate
 * @returns {string[]} Array of unique RTNs
 */
export function generateBatchRTNs(count: number): string[] {
  const rtns: string[] = [];
  
  // Monotonic ULID factory ensures uniqueness without delays
  for (let i = 0; i < count; i++) {
    rtns.push(generateRTN());
  }
  
  return rtns;
}

/**
 * Gets RTN generation statistics for monitoring
 * @returns {object} Statistics about RTN format and generation
 */
export function getRTNStats() {
  const sampleRTN = generateRTN();
  
  return {
    format: 'RTN-YYYYMMDD-<ULID>',
    totalLength: sampleRTN.length, // Should be 40 characters
    datePartLength: 12, // 'RTN-YYYYMMDD'
    ulidPartLength: 26,
    sortable: true,
    monotonicGuarantee: true,
    collisionResistance: 'Astronomically high (2^80 random space per millisecond)',
    exampleRTN: sampleRTN,
    generatedAt: new Date().toISOString(),
    timezone: 'UTC'
  };
}

// Export interface for RTN utilities
export interface RTNUtilities {
  generate: () => string;
  validate: (rtn: string) => boolean;
  extractDate: (rtn: string) => Date | null;
  isFromToday: (rtn: string) => boolean;
  generateBatch: (count: number) => string[];
  getStats: () => object;
}

// Default export with all utilities
export const RTN: RTNUtilities = {
  generate: generateRTN,
  validate: isValidRTN,
  extractDate: extractDateFromRTN,
  isFromToday: isRTNFromToday,
  generateBatch: generateBatchRTNs,
  getStats: getRTNStats
};