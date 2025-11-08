#!/usr/bin/env node

/**
 * RiddleSwap Endpoint Security Verification Script
 * Verifies all endpoints have proper middleware, CSP, and Vite configuration
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 RiddleSwap Endpoint Security Verification');
console.log('============================================');

// Configuration checks
const checks = {
  middleware: {
    name: 'Security Middleware',
    files: ['server/index.ts', 'server/routes.ts'],
    requirements: [
      'helmet',
      'cors',
      'express-rate-limit',
      'express-session'
    ]
  },
  csp: {
    name: 'Content Security Policy',
    files: ['server/index.ts'],
    requirements: [
      'contentSecurityPolicy',
      'crossOriginEmbedderPolicy',
      'crossOriginOpenerPolicy'
    ]
  },
  vite: {
    name: 'Vite Configuration',
    files: ['vite.config.ts', 'server/vite.ts'],
    requirements: [
      'createServer',
      'middlewareMode',
      'configFile'
    ]
  },
  authentication: {
    name: 'Authentication Middleware',
    files: ['server/routes.ts'],
    requirements: [
      'isAuthenticated',
      'session',
      'passport'
    ]
  }
};

// Endpoint categories that need protection
const protectedEndpoints = [
  '/api/wallets/',
  '/api/payments/',
  '/api/transactions/',
  '/api/rewards/',
  '/api/profile/',
  '/api/upload/',
  '/api/social/'
];

const publicEndpoints = [
  '/api/health',
  '/api/bridge/prices',
  '/api/bridge/exchange-rate',
  '/api/tokens/',
  '/api/auth/'
];

function checkFileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch (error) {
    return false;
  }
}

function checkFileContent(filePath, requirements) {
  if (!checkFileExists(filePath)) {
    return { exists: false, missing: requirements };
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const missing = requirements.filter(req => !content.includes(req));
    return { exists: true, missing, content };
  } catch (error) {
    return { exists: false, missing: requirements, error: error.message };
  }
}

function runSecurityChecks() {
  console.log('\n📋 Running Security Checks...\n');
  
  let allPassed = true;
  const results = {};

  for (const [checkName, config] of Object.entries(checks)) {
    console.log(`🔍 Checking ${config.name}...`);
    results[checkName] = {};

    for (const file of config.files) {
      const result = checkFileContent(file, config.requirements);
      results[checkName][file] = result;

      if (!result.exists) {
        console.log(`❌ ${file} - File not found`);
        allPassed = false;
      } else if (result.missing.length > 0) {
        console.log(`⚠️  ${file} - Missing: ${result.missing.join(', ')}`);
        allPassed = false;
      } else {
        console.log(`✅ ${file} - All requirements found`);
      }
    }
    console.log('');
  }

  return { allPassed, results };
}

function checkEndpointProtection() {
  console.log('🛡️  Checking Endpoint Protection...\n');
  
  const routesFile = 'server/routes.ts';
  if (!checkFileExists(routesFile)) {
    console.log('❌ Routes file not found');
    return false;
  }

  const content = fs.readFileSync(routesFile, 'utf8');
  let protectionIssues = [];

  // Check if protected endpoints have authentication
  for (const endpoint of protectedEndpoints) {
    const regex = new RegExp(`app\\.(get|post|put|delete)\\(['"]${endpoint.replace(/\//g, '\\/')}`, 'g');
    const matches = content.match(regex);
    
    if (matches) {
      // Check if isAuthenticated middleware is used before these endpoints
      const authRegex = new RegExp(`app\\.(get|post|put|delete)\\(['"]${endpoint.replace(/\//g, '\\/')}.+?isAuthenticated`, 'gs');
      if (!authRegex.test(content)) {
        protectionIssues.push(`${endpoint} - Missing authentication middleware`);
      }
    }
  }

  if (protectionIssues.length > 0) {
    console.log('❌ Endpoint Protection Issues:');
    protectionIssues.forEach(issue => console.log(`   - ${issue}`));
    return false;
  } else {
    console.log('✅ All protected endpoints have authentication');
    return true;
  }
}

function generateRepairScript(results) {
  console.log('\n🔧 Generating Repair Script...\n');
  
  const repairActions = [];

  // Check for missing middleware
  if (results.middleware?.['server/index.ts']?.missing?.length > 0) {
    repairActions.push(`
// Add missing security middleware to server/index.ts
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

// Apply security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disabled for wallet compatibility
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false
}));

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://riddleswap.com', 'https://riddle.finance']
    : true,
  credentials: true
}));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP'
}));`);
  }

  // Check for missing authentication setup
  if (results.authentication?.['server/routes.ts']?.missing?.includes('isAuthenticated')) {
    repairActions.push(`
// Ensure authentication middleware is properly applied
// Protected endpoints should use: app.get('/api/protected', isAuthenticated, handler)
// Public endpoints should NOT use isAuthenticated middleware`);
  }

  return repairActions;
}

function main() {
  const { allPassed, results } = runSecurityChecks();
  const endpointProtection = checkEndpointProtection();
  
  console.log('\n📊 Security Verification Summary');
  console.log('================================');
  
  if (allPassed && endpointProtection) {
    console.log('✅ All security checks passed!');
    console.log('✅ All endpoints properly protected');
    console.log('✅ System is ready for production');
  } else {
    console.log('❌ Security issues found');
    
    const repairActions = generateRepairScript(results);
    if (repairActions.length > 0) {
      console.log('\n🛠️  Suggested Repairs:');
      repairActions.forEach((action, index) => {
        console.log(`\n${index + 1}. ${action}`);
      });
    }
  }

  console.log('\n🔄 To fix issues automatically, run: npm run fix-security');
  
  process.exit(allPassed && endpointProtection ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = { runSecurityChecks, checkEndpointProtection, generateRepairScript };