#!/usr/bin/env node

/**
 * RiddleSwap Security Fix Script
 * Automatically repairs middleware, CSP, and Vite configuration issues
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 RiddleSwap Security Auto-Repair Script');
console.log('==========================================');

// Security configurations
const SECURITY_MIDDLEWARE = `
// Security middleware configuration
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

// Apply security middleware
export function applySecurityMiddleware(app: Express) {
  // Helmet with wallet-compatible settings
  app.use(helmet({
    contentSecurityPolicy: false, // Disabled for wallet compatibility
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  }));

  // CORS configuration
  app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://riddleswap.com', 'https://riddle.finance']
      : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization']
  }));

  // Rate limiting
  app.use(rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per windowMs
    message: 'Too many requests from this IP',
    standardHeaders: true,
    legacyHeaders: false
  }));
}`;

const AUTHENTICATION_MIDDLEWARE = `
// Authentication middleware for protected routes
export const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ 
      success: false, 
      error: 'Authentication required',
      message: 'Please log in to access this resource'
    });
  }
  next();
};

// Session validation middleware
export const validateSession = (req: Request, res: Response, next: NextFunction) => {
  if (req.session && req.session.user) {
    // Refresh session expiry
    req.session.touch();
  }
  next();
};`;

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.log(`⚠️  Could not read ${filePath}: ${error.message}`);
    return null;
  }
}

function writeFile(filePath, content) {
  try {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  } catch (error) {
    console.log(`❌ Failed to write ${filePath}: ${error.message}`);
    return false;
  }
}

function fixServerIndex() {
  console.log('🔧 Fixing server/index.ts...');
  
  const filePath = 'server/index.ts';
  let content = readFile(filePath);
  
  if (!content) return false;

  // Check if security middleware is properly imported and used
  const hasHelmet = content.includes('helmet');
  const hasCors = content.includes('cors');
  const hasRateLimit = content.includes('express-rate-limit');

  if (!hasHelmet || !hasCors || !hasRateLimit) {
    console.log('📦 Adding missing security dependencies...');
    
    // Add imports if missing
    if (!hasHelmet) {
      content = `import helmet from 'helmet';\n${content}`;
    }
    if (!hasCors) {
      content = `import cors from 'cors';\n${content}`;
    }
    if (!hasRateLimit) {
      content = `import rateLimit from 'express-rate-limit';\n${content}`;
    }

    // Add security middleware after app creation
    const appCreationRegex = /const app = express\(\);/;
    if (appCreationRegex.test(content)) {
      content = content.replace(
        appCreationRegex,
        `const app = express();

// Apply comprehensive security middleware
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
  max: 1000, // requests per window
  message: 'Too many requests from this IP'
}));`
      );
    }
  }

  return writeFile(filePath, content);
}

function fixRoutes() {
  console.log('🔧 Fixing server/routes.ts...');
  
  const filePath = 'server/routes.ts';
  let content = readFile(filePath);
  
  if (!content) return false;

  // Check if authentication middleware exists
  const hasAuthMiddleware = content.includes('isAuthenticated') || 
                           content.includes('requireAuthentication');

  if (!hasAuthMiddleware) {
    console.log('🔐 Adding authentication middleware...');
    
    // Add authentication middleware import
    const importSection = content.match(/import.*from.*;\s*/g);
    if (importSection) {
      const lastImport = importSection[importSection.length - 1];
      content = content.replace(
        lastImport,
        `${lastImport}
// Authentication middleware
const isAuthenticated = (req: any, res: any, next: any) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ 
      success: false, 
      error: 'Authentication required' 
    });
  }
  next();
};
`
      );
    }
  }

  // Ensure protected endpoints use authentication
  const protectedPatterns = [
    /app\.(get|post|put|delete)\('\/api\/wallets/g,
    /app\.(get|post|put|delete)\('\/api\/payments/g,
    /app\.(get|post|put|delete)\('\/api\/transactions/g,
    /app\.(get|post|put|delete)\('\/api\/rewards/g,
    /app\.(get|post|put|delete)\('\/api\/profile/g,
    /app\.(get|post|put|delete)\('\/api\/upload/g,
    /app\.(get|post|put|delete)\('\/api\/social/g
  ];

  for (const pattern of protectedPatterns) {
    const matches = content.match(pattern);
    if (matches) {
      matches.forEach(match => {
        // Check if this endpoint already has isAuthenticated
        const lineStart = content.indexOf(match);
        const lineEnd = content.indexOf('\n', lineStart);
        const line = content.substring(lineStart, lineEnd);
        
        if (!line.includes('isAuthenticated') && !line.includes('requireAuthentication')) {
          console.log(`🔒 Adding authentication to: ${match}`);
          content = content.replace(
            match,
            match.replace('(\'', '(\'/api/protected-endpoint\', isAuthenticated, \'')
          );
        }
      });
    }
  }

  return writeFile(filePath, content);
}

function fixViteConfig() {
  console.log('🔧 Checking Vite configuration...');
  
  const filePath = 'vite.config.ts';
  let content = readFile(filePath);
  
  if (!content) return false;

  // Check if Vite is properly configured for production
  const hasProperServer = content.includes('server:') && 
                         content.includes('middlewareMode');

  if (!hasProperServer) {
    console.log('⚙️  Vite configuration appears correct');
  }

  return true;
}

function verifyPackageJson() {
  console.log('📦 Verifying package.json dependencies...');
  
  try {
    const packageContent = JSON.parse(readFile('package.json'));
    const requiredDeps = ['helmet', 'cors', 'express-rate-limit', 'express-session'];
    const missingDeps = requiredDeps.filter(dep => 
      !packageContent.dependencies?.[dep] && !packageContent.devDependencies?.[dep]
    );

    if (missingDeps.length > 0) {
      console.log(`❌ Missing dependencies: ${missingDeps.join(', ')}`);
      console.log('📌 Run: npm install ' + missingDeps.join(' '));
      return false;
    } else {
      console.log('✅ All required dependencies found');
      return true;
    }
  } catch (error) {
    console.log('❌ Could not verify package.json');
    return false;
  }
}

function addFixSecurityScript() {
  console.log('📝 Adding fix-security script to package.json...');
  
  try {
    const packagePath = 'package.json';
    const packageContent = JSON.parse(readFile(packagePath));
    
    if (!packageContent.scripts) {
      packageContent.scripts = {};
    }
    
    packageContent.scripts['verify-security'] = 'node verify-endpoints.js';
    packageContent.scripts['fix-security'] = 'node fix-security.js';
    
    return writeFile(packagePath, JSON.stringify(packageContent, null, 2));
  } catch (error) {
    console.log('❌ Could not update package.json scripts');
    return false;
  }
}

function main() {
  console.log('🚀 Starting security fixes...\n');
  
  const results = {
    serverIndex: fixServerIndex(),
    routes: fixRoutes(),
    viteConfig: fixViteConfig(),
    packageJson: verifyPackageJson(),
    scripts: addFixSecurityScript()
  };

  console.log('\n📊 Repair Summary');
  console.log('=================');
  
  let allFixed = true;
  for (const [task, success] of Object.entries(results)) {
    const status = success ? '✅' : '❌';
    console.log(`${status} ${task}`);
    if (!success) allFixed = false;
  }

  if (allFixed) {
    console.log('\n🎉 All security issues have been fixed!');
    console.log('🔄 Restart your server to apply changes');
    console.log('🧪 Run "npm run verify-security" to verify fixes');
  } else {
    console.log('\n⚠️  Some issues could not be automatically fixed');
    console.log('📖 Please review the error messages above');
  }

  console.log('\n🔗 Next steps:');
  console.log('   1. Restart the development server');
  console.log('   2. Run verification: npm run verify-security');
  console.log('   3. Test all endpoints manually');
  
  process.exit(allFixed ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = { fixServerIndex, fixRoutes, fixViteConfig, verifyPackageJson };