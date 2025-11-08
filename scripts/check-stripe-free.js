#!/usr/bin/env node

/**
 * STRIPE-FREE CI CHECK
 * This script ensures the codebase remains 100% Stripe-free
 * Fails CI if any Stripe references are found in code
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STRIPE_PATTERNS = [
  /stripe/i,
  /STRIPE/g,
  /@stripe/g,
  /api\.stripe\.com/g,
  /js\.stripe\.com/g
];

const SEARCH_DIRS = ['client/src', 'server', 'shared'];
const EXCLUDED_FILES = [
  '.eslintrc.json',
  'check-stripe-free.js',
  'replit.md'
];

const ALLOWED_ANTI_STRIPE_PATTERNS = [
  /STRIPE BLOCKED/g,
  /stripe\.com.*blocked?/gi,
  /block.*stripe/gi,
  /anti-stripe/gi,
  /🚫.*stripe/gi,
  /STRIPE SECURITY/g,
  /STRIPE-BLOCKING/g
];

console.log('🛡️ STRIPE-FREE CI CHECK: Scanning codebase for Stripe references...');

let stripeFound = false;
let totalFiles = 0;

function scanDirectory(dir) {
  if (!fs.existsSync(dir)) return;
  
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      scanDirectory(filePath);
    } else if (stat.isFile() && (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx'))) {
      if (EXCLUDED_FILES.some(excluded => filePath.includes(excluded))) {
        continue;
      }
      
      totalFiles++;
      const content = fs.readFileSync(filePath, 'utf8');
      
      for (const pattern of STRIPE_PATTERNS) {
        const matches = content.match(pattern);
        if (matches) {
          // Check if this is an allowed anti-Stripe security measure
          let isAntiStripe = false;
          for (const antiPattern of ALLOWED_ANTI_STRIPE_PATTERNS) {
            if (antiPattern.test(content)) {
              isAntiStripe = true;
              break;
            }
          }
          
          if (!isAntiStripe) {
            console.error(`🚨 STRIPE DETECTED: ${filePath}`);
            console.error(`   Pattern: ${pattern}`);
            console.error(`   Match: ${matches}`);
            stripeFound = true;
          }
        }
      }
    }
  }
}

// Scan all source directories
for (const dir of SEARCH_DIRS) {
  scanDirectory(dir);
}

console.log(`✅ Scanned ${totalFiles} files in ${SEARCH_DIRS.join(', ')}`);

if (stripeFound) {
  console.error('\n🚨 STRIPE-FREE CHECK FAILED');
  console.error('💡 This application only supports blockchain-native payments');
  console.error('🔒 Remove all Stripe references to maintain security');
  process.exit(1);
} else {
  console.log('\n✅ STRIPE-FREE CHECK PASSED');
  console.log('🛡️ Codebase is 100% Stripe-free - blockchain payments only');
  process.exit(0);
}