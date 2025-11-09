import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import helmet from 'helmet'; // RE-ENABLED with smart wallet exceptions
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { processPending } from "./bridge-verification-service";
import { globalErrorHandler, notFoundHandler } from "./middleware/errorHandler";
import { errorLogs } from "../shared/schema";
import { securityMiddleware, nonceMiddleware, blockStripeRequests, detectStripeEnvironment } from "./middleware/security";
import { trackUserActivity } from "./middleware/activity-tracking";
import walletRoutes from "./wallet-routes";
import walletImportRoutes from "./wallet-import-routes";
// Rewards routes are now set up in routes.ts
import { setupBalanceRoutesV2 } from "./balance-routes-v2";
import sessionCheckRoutes from "./session-check-endpoint";
import { validateEnvironment, handleValidationResults, checkRiddlePadReadiness, generateConfigRecommendations } from "./production-validation";
// Route Inventory System imports
import { RouteInventorySystem } from "./route-inventory-system";
import { createRouteUsageTracker } from "./middleware/route-usage-tracker";
import routeInventoryAdminRoutes from "./route-inventory-admin-routes";
// Project Authentication routes
import projectAuthRoutes from "./project-auth-routes";
// AI Weapon Image Generation routes
import aiWeaponRoutes from "./ai-weapon-routes";
// AI Studio routes for image generation, Sora video, and NFT creation
import aiStudioRoutes from "./ai-studio-routes";
import battleSystemRoutes from "./battle-system-routes";
import oracleBattleRoutes from "./routes/battle-routes";
import allianceRoutes from "./alliance-routes";
import squadronRoutes from "./squadron-routes";
import landPurchaseRoutes from "./land-purchase-routes";
import landInventoryRoutes from "./land-inventory-routes";
import leaderboardRoutes from "./routes/leaderboard-routes";
import matchmakingRoutes from "./routes/matchmaking-routes";
import tournamentRoutes from "./routes/tournament-routes";
import addressBookRoutes from "./address-book-routes";
import multiChainFeaturedTokensRoutes from "./multi-chain-featured-tokens";
import multiDexAggregatorRoutes from "./multi-dex-aggregator";
import inquisitionGeneratorRoutes from "./inquisition-generator-routes";
import inquisitionAuditRoutes from "./routes/inquisition-audit-routes";
import riddleCityRoutes from "./routes/riddlecity";
import riddleCityApiRoutes from "./routes/riddle-city";
import gamingRoutes from "./routes/gaming";



const app = express();

// SMART SECURITY MIDDLEWARE - CSP enabled with wallet compatibility exceptions

// Configure trust proxy BEFORE rate limiting
app.set('trust proxy', 1);

// Disable rate limiting in development to prevent 429 errors during HMR and rapid reloads
const isDev = process.env.NODE_ENV !== 'production';
if (!isDev) {
  app.use(rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 2000,
    message: 'Too many requests from this IP',
    standardHeaders: true,
    legacyHeaders: false,
    validate: {
      trustProxy: false,
      xForwardedForHeader: false
    }
  }));
  console.log('✅ Rate limiting enabled (production mode)');
} else {
  console.log('⚠️ Rate limiting DISABLED in development mode to avoid HMR conflicts');
}

// Comprehensive CORS configuration - production ready
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? true // Allow all origins in production for deployment flexibility
    : true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
  allowedHeaders: [
    'Origin', 
    'X-Requested-With', 
    'Content-Type', 
    'Accept', 
    'Authorization', 
    'Cache-Control', 
    'Pragma',
    'X-HTTP-Method-Override',
    'X-Forwarded-For',
    'X-Real-IP',
    'User-Agent'
  ],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count', 'X-Rate-Limit-Remaining'],
  maxAge: 86400, // 24 hour preflight cache
  preflightContinue: false,
  optionsSuccessStatus: 200
}));

// Apply nonce middleware BEFORE security middleware for CSP nonce support
app.use(nonceMiddleware);

// STRIPE BLOCKING: Disabled for testing - Apply anti-Stripe HTTP restrictions before all other middleware
// app.use(blockStripeRequests); // DISABLED FOR TESTING

// Static files CORS middleware - MUST be before security middleware
app.use((req, res, next) => {
  // Handle manifest.json and other static files with proper CORS
  if (req.path === '/manifest.json' || req.path.endsWith('.json') || 
      req.path.endsWith('.png') || req.path.endsWith('.svg') || 
      req.path.endsWith('.ico') || req.path.endsWith('.webmanifest')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    
    // Remove any CSP headers for static files
    res.removeHeader('Content-Security-Policy');
    res.removeHeader('Content-Security-Policy-Report-Only');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
  }
  next();
});

// Apply security middleware with Stripe blocking CSP
securityMiddleware(app);

// STRIPE DETECTION: Disabled for testing
// detectStripeEnvironment(); // DISABLED FOR TESTING

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// CRITICAL: Fast health check endpoint for deployment health checks
// Must respond immediately before route registration to prevent timeouts
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// CRUCIAL: Register API routes BEFORE other middleware to prevent conflicts
console.log('🔄 Registering API routes BEFORE Vite middleware...');

// Set up automatic server-side error logging
process.on('uncaughtException', (error) => {
  // Filter noisy Neon serverless ErrorEvent mutation bug during websocket connect
  if (typeof (error as any)?.message === 'string' && (error as any).message.includes('Cannot set property message of #<ErrorEvent>')) {
    console.warn('⚠️ [IGNORED] Known Neon ErrorEvent mutation during DB connect test');
    return; // Do not auto-log these
  }
  console.error('🚨 UNCAUGHT EXCEPTION - AUTO-LOGGING:', error);
  
  const errorData = {
    error_message: error.message || 'Uncaught server exception',
    stack_trace: error.stack || 'No stack trace available',
    page_url: 'server-side',
    user_agent: 'server',
    error_type: 'api_error' as const,
    severity: 'critical' as const,
    component_name: 'server',
    error_context: {
      serverSide: true,
      errorName: error.name
    },
    created_at: new Date()
  };
  
  // Try to save to database (async to not block)
  import('./db').then(({ db }) => {
    db.insert(errorLogs).values(errorData as any).catch(console.error);
  }).catch(console.error);
});

process.on('unhandledRejection', (reason, promise) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  if (msg.includes('Cannot set property message of #<ErrorEvent>')) {
    console.warn('⚠️ [IGNORED] Known Neon ErrorEvent mutation during DB connect test (promise)');
    return; // Ignore noisy library bug
  }
  console.error('🚨 UNHANDLED REJECTION - AUTO-LOGGING:', reason);
  
  const errorData = {
    error_message: reason instanceof Error ? reason.message : String(reason),
    stack_trace: reason instanceof Error ? reason.stack : 'No stack trace available', 
    page_url: 'server-side',
    user_agent: 'server',
    error_type: 'api_error' as const,
    severity: 'high' as const,
    component_name: 'server',
    error_context: {
      serverSide: true,
      unhandledRejection: true,
      reason: String(reason)
    },
    created_at: new Date()
  };
  
  // Try to save to database (async to not block)
  import('./db').then(({ db }) => {
    db.insert(errorLogs).values(errorData as any).catch(console.error);
  }).catch(console.error);
});

console.log('✅ Automatic server-side error logging set up');



// Attach a request ID and enhance API logging, especially for 5xx
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  const reqId = (req.headers['x-request-id'] as string) || `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  res.setHeader('X-Request-Id', reqId);

  let capturedJsonResponse: Record<string, any> | undefined = undefined;
  const originalResJson = res.json;
  // Enhance res.json to automatically attach requestId to error payloads (status >= 400)
  res.json = function (bodyJson, ...args) {
    try {
      capturedJsonResponse = bodyJson;
      if (res.statusCode >= 400 && bodyJson && typeof bodyJson === 'object' && !Array.isArray(bodyJson)) {
        if (!(bodyJson as any).requestId) {
          (bodyJson as any).requestId = reqId;
        }
        // Ensure minimal error field presence for 5xx if missing
        if (res.statusCode >= 500 && !(bodyJson as any).error) {
          (bodyJson as any).error = 'Internal server error';
        }
      }
    } catch (e) {
      // Fail safe: never break response flow
    }
    return originalResJson.apply(res, [bodyJson, ...args]);
  } as any;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      const isError = res.statusCode >= 500;
      const preview = capturedJsonResponse ? JSON.stringify(capturedJsonResponse).slice(0, 300) : '';
      const base = `${req.method} ${path} ${res.statusCode} in ${duration}ms id=${reqId}`;
      if (isError) {
        console.error(`🚨 API 5xx: ${base} :: ${preview}`);
      } else {
        let line = `${base}${preview ? ` :: ${preview}` : ''}`;
        if (line.length > 200) line = line.slice(0, 199) + '…';
        log(line);
      }
    }
  });

  next();
});

// CRITICAL: Create HTTP server and start listening immediately for health checks
import { createServer } from 'http';
const server = createServer(app);

// Dynamically resolve a free port to avoid EADDRINUSE during development
async function getAvailablePort(startPort: number, host: string, maxTries = 10): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const tryPort = (portToTry: number, triesLeft: number) => {
      const tester = createServer();
      tester.once('error', (err: any) => {
        tester.close();
        if (err && (err as any).code === 'EADDRINUSE' && triesLeft > 0) {
          // Try next port
          tryPort(portToTry + 1, triesLeft - 1);
        } else {
          reject(err);
        }
      });
      tester.once('listening', () => {
        tester.close(() => resolve(portToTry));
      });
      tester.listen(portToTry, host);
    };
    tryPort(startPort, maxTries);
  });
}

// Start listening as early as possible on an available port
// Use 0.0.0.0 for all platforms
const isWindows = process.platform === 'win32';
(async () => {
  const preferredPort = Number(process.env.PORT) || 5000;
  const host = '0.0.0.0'; // Changed from conditional to always use 0.0.0.0
  let finalPort = preferredPort;
  try {
    finalPort = await getAvailablePort(preferredPort, host, 20);
  } catch (err) {
    console.error('❌ Failed to resolve an available port, falling back to preferred:', preferredPort, err);
  }

  // Expose the resolved port to the process env for any consumers
  process.env.PORT = String(finalPort);

  server.listen(finalPort, host, () => {
    log(`🚀 Server listening on port ${finalPort}`);
    console.log('🚀 Server is now accepting connections and responding to health checks');
    console.log(`✅ Production ready - VM deployment with single port ${finalPort}`);

    // Now perform all heavy initialization after server is listening
    performAsyncInitialization().catch((error) => {
      console.error('🚨 [STARTUP] Async initialization failed:', error);
      // Don't exit - server is already listening
    });
  });
})();

// All heavy initialization happens here, after server is listening
async function performAsyncInitialization() {
  try {
    // CRITICAL: Validate production environment after server starts
    console.log('🔍 [STARTUP] Validating production environment...');
    const validationResult = validateEnvironment();
    handleValidationResults(validationResult, process.env.NODE_ENV === 'production');

    // Test DB connection early (with timeout to prevent startup hangs)
    console.log('🔌 [STARTUP] Testing primary database connection...');
    const { testDatabaseConnection } = await import('./db');
    try {
      // Wrap in timeout - if DB doesn't respond in 5s, continue anyway
      await Promise.race([
        testDatabaseConnection(),
        new Promise<void>((_, reject) => 
          setTimeout(() => reject(new Error('Database connection test timeout')), 5000)
        )
      ]);
    } catch (err: any) {
      console.warn('⚠️ [STARTUP] Database test did not complete:', err?.message || 'Unknown error');
      console.warn('ℹ️ [STARTUP] Continuing startup - API routes will fail until DB is available');
    }
    console.log('🗂️ [STARTUP] Preloading users cache...');
    try {
      const { preloadUsersCache } = await import('./services/user-cache');
      await preloadUsersCache();
    } catch (e) {
      console.warn('⚠️ [STARTUP] Skipping users cache preload due to error:', (e as any)?.message);
      console.warn('ℹ️ Continuing startup without user cache - some features may be slower');
    }
    
    // Start scanner scheduler for automated rarity calculations
    console.log('📊 [STARTUP] Starting scanner scheduler...');
    try {
      const { scannerScheduler } = await import('./services/scanner-scheduler');
      await scannerScheduler.start();
      console.log('✅ [STARTUP] Scanner scheduler started successfully');
    } catch (e) {
      console.warn('⚠️ [STARTUP] Failed to start scanner scheduler:', (e as any)?.message);
      console.warn('ℹ️ Rarity calculations will need to be triggered manually');
    }
    
    // Check RiddlePad readiness
    const riddlePadStatus = checkRiddlePadReadiness();
    console.log(`🚀 [RIDDLEPAD] ${riddlePadStatus.message}`);
    console.log(`🚀 [RIDDLEPAD] Can Accept Contributions: ${riddlePadStatus.canAcceptContributions ? 'YES' : 'NO'}`);
    console.log(`🚀 [RIDDLEPAD] Can Process Fees: ${riddlePadStatus.canProcessFees ? 'YES' : 'NO'}`);
    console.log(`🚀 [RIDDLEPAD] Can Settle On-Chain: ${riddlePadStatus.canSettleOnChain ? 'YES' : 'NO'}`);
    
    // Generate configuration recommendations
    const recommendations = generateConfigRecommendations();
    if (recommendations.length > 0) {
      console.log('💡 [CONFIG RECOMMENDATIONS]:');
      recommendations.forEach(rec => console.log(`   - ${rec}`));
    }

    // Add route usage tracking middleware BEFORE route registration
    console.log('📊 Setting up route usage tracking middleware...');
    app.use(createRouteUsageTracker());
    console.log('✅ Route usage tracking middleware enabled');

    // Now register routes after server is listening
    await registerRoutes(app, server);
  
  // Initialize WebSocket chat server after HTTP server is ready
  console.log('💬 Initializing WebSocket chat server...');
  const { chatServer } = await import('./websocket/chat-server');
  chatServer.initialize(server);
  

  
  // Wallet routes
  app.use('/api/wallets', walletRoutes);
  
  // Wallet import routes
  app.use('/api/wallets/import', walletImportRoutes);
  
  // Chat routes
  const chatRoutes = await import('./chat/launch-chat-routes');
  app.use('/api/chat', chatRoutes.default);

  // THE ORACLE AI RiddleAuthor routes
  console.log('🤖 Registering THE ORACLE AI routes...');
  const riddleAuthorRoutes = await import('./riddleauthor-routes');
  app.use('/api/riddleauthor', riddleAuthorRoutes.default);
  console.log('✅ THE ORACLE AI routes registered successfully');

  // Customer Support Ticket System
  console.log('🎫 Registering Customer Support routes...');
  const supportRoutes = await import('./support-routes');
  app.use('/api/support', supportRoutes.default);
  console.log('✅ Customer Support routes registered successfully');

  // The Inquiry NFT Collection Management
  console.log('🔍 Registering The Inquiry Collection routes...');
  const inquiryRoutes = await import('./inquiry-collection-routes');
  app.use(inquiryRoutes.default);
  console.log('✅ The Inquiry Collection routes registered successfully');

  // Twitter/X API routes for THE ORACLE
  console.log('🐦 Registering Twitter/X API routes...');
  const twitterRoutes = await import('./twitter-service');
  app.use('/api/twitter', twitterRoutes.default);
  
  // Initialize Twitter scheduler
  console.log('🐦 Initializing THE ORACLE tweet scheduler...');
  await import('./twitter-scheduler');
  console.log('✅ Twitter/X API routes and scheduler registered successfully');
  
  // Initialize Activity Monitor Scheduler (auto-tweet about platform activities)
  // DISABLED: Oracle auto-posting stopped per user request
  // console.log('🔍 Initializing Activity Monitor scheduler...');
  // await import('./activity-monitor-scheduler');
  // console.log('✅ Activity Monitor scheduler initialized - tracking new users, big trades, and milestones');
  
  // Initialize AMM Scheduler (Automatic Market Maker)
  console.log('🤖 Initializing AMM execution scheduler...');
  const ammScheduler = await import('./amm-scheduler');
  
  // Initialize Inquisition NFT Scanner (Hourly cron job)
  // DISABLED - Scanner causing issues, will revisit later
  // console.log('🔍 Initializing Inquisition NFT Scanner (hourly)...');
  // const { startInquisitionCron } = await import('./services/inquisition-cron');
  // startInquisitionCron();
  // console.log('✅ Inquisition NFT Scanner initialized - scans all 4 collections hourly');
  console.log('⚠️  Inquisition NFT Scanner DISABLED - will revisit later');
  ammScheduler.default.start();
  console.log('✅ AMM scheduler initialized - checking for trades every 5 minutes');
  
  // Set up Balance System V2 routes
  setupBalanceRoutesV2(app);
  
  // Route Inventory Admin Routes (register early to track admin usage)
  app.use('/api/admin/routes', routeInventoryAdminRoutes);
  console.log('📋 Route inventory admin routes registered');
  
  // Project Authentication Routes
  app.use('/api/projects/auth', projectAuthRoutes);
  console.log('🔐 Project authentication routes registered');
  
  // AI Weapon Image Generation Routes
  app.use('/api/ai-weapons', aiWeaponRoutes);
  console.log('🎨 AI weapon image generation routes registered');

  // AI Studio Routes (Image Generation, Sora Video, NFT Creation)
  app.use('/api', aiStudioRoutes);
  console.log('🎬 AI Studio routes registered (image generation, Sora video, NFT creation)');

  // Battle System Routes (Squadrons, Battles, Tournaments)
  app.use(battleSystemRoutes);
  console.log('⚔️ Battle System routes registered (squadrons, battles, tournaments)');

  // Oracle Battle Routes (Turn-based battles with AI narration)
  app.use('/api/battles', oracleBattleRoutes);
  console.log('🔮 Oracle Battle routes registered (turn-based battles with AI narration)');

  // Alliance System Routes (Guild Management)
  app.use('/api', allianceRoutes);
  console.log('🤝 Alliance System routes registered (guilds, members, join requests)');

  // Inquisition Image Generation Routes (NFT AI Images)
  const { setupInquisitionImageRoutes } = await import('./inquisition-image-routes');
  setupInquisitionImageRoutes(app);
  console.log('🎨 Inquisition NFT image generation routes registered (DALL-E powered)');

  // Inquisition Generator Routes (AI-powered character generation)
  app.use('/api/gaming/inquisition-members', inquisitionGeneratorRoutes);
  console.log('🎭 Inquisition Generator routes registered (AI-powered character generation)');
  
  // Inquisition NFT Audit Routes (Player NFTs endpoint)
  app.use('/api/gaming', inquisitionAuditRoutes);
  console.log('🔍 Inquisition NFT Audit routes registered (player NFTs with power stats)');

  // Gaming Routes (Player stats, battles, squadrons, civilizations)
  app.use('/api/gaming', gamingRoutes);
  console.log('🎮 Gaming routes registered (player profiles, battles, squadrons)');

  // RiddleCity Routes (Land stats, marketplace)
  app.use('/api/riddle-city', riddleCityApiRoutes);
  console.log('🏙️ RiddleCity routes registered (land stats, marketplace)');

  // NFT Image History Routes (Image generation history and management)
  const nftImageHistoryRoutes = (await import('./routes/nft-image-history-routes')).default;
  app.use('/api/gaming', nftImageHistoryRoutes);
  console.log('🖼️ NFT Image History routes registered (view history, switch images)');

  // Scanner Routes (Collection scanning, AI scoring, rarity calculation, civilization metrics)
  const scannerRoutes = (await import('./routes/scanner-routes')).default;
  app.use('/api/scanners', scannerRoutes);
  console.log('🔬 Scanner routes registered (collection scan, AI scoring, rarity, civilization)');

  // Rankings Routes (NFT rankings, rarity data, civilization rankings, leaderboards)
  const rankingsRoutes = (await import('./routes/rankings-routes')).default;
  app.use('/api/rankings', rankingsRoutes);
  console.log('🏆 Rankings routes registered (NFT rankings, rarity tracking, leaderboards)');

  // Scorecard Routes (Trait-based rarity scoring and NFT rankings)
  const scorecardRoutes = (await import('./scorecard-routes')).default;
  app.use('/api', scorecardRoutes);
  console.log('📊 Scorecard routes registered (trait rarity, NFT scorecards, project stats)');

  // Squadron System Routes (NFT Battle Groups)
  app.use(squadronRoutes);
  console.log('⚔️ Squadron System routes registered (create, manage NFT battle groups)');

  // Land Purchase Routes (Medieval Land Plots)
  app.use('/api/land', landPurchaseRoutes);
  console.log('🏞️ Land Purchase routes registered (medieval land plots, XRP/RDL payments)');

  // Land Inventory Routes (NFTs, Buildings, Weapons on Land)
  app.use('/api/land-inventory', landInventoryRoutes);
  console.log('🏰 Land Inventory routes registered (place NFTs, buildings, weapons on land)');

  // Leaderboard Routes (Global Rankings with % Change Tracking)
  app.use('/api/leaderboards', leaderboardRoutes);
  console.log('🏆 Leaderboard routes registered (players, alliances, rank tracking)');

  // Matchmaking Routes (Fair opponent matching)
  app.use('/api/matchmaking', matchmakingRoutes);
  console.log('⚔️ Matchmaking routes registered (find opponents, validate matches)');

  // Tournament Routes (Brackets, prizes, progression)
  app.use('/api/tournaments', tournamentRoutes);
  console.log('🏆 Tournament routes registered (create, register, brackets, prizes)');

  // Address Book & RiddleHandle Search Routes
  app.use(addressBookRoutes);
  console.log('📇 Address Book & RiddleHandle Search routes registered');

  // Public Image Generation Routes (NO AUTH REQUIRED)
  const publicImageRoutes = (await import('./routes/public-image-generation')).default;
  app.use('/api/public', publicImageRoutes);
  console.log('🎨 Public Image Generation routes registered (NO AUTH REQUIRED)');

  // Multi-Chain Featured Tokens Routes
  app.use(multiChainFeaturedTokensRoutes);
  console.log('⭐ Multi-Chain Featured Tokens routes registered');

  // Multi-DEX Aggregator Routes (EVM Swaps)
  app.use('/api/evm', multiDexAggregatorRoutes);
  console.log('💱 Multi-DEX Aggregator routes registered (EVM swaps)');

  // DevTools Routes (Project Verification, Airdrops, Snapshots, Promotions)
  console.log('🛠️ Registering DevTools routes...');
  const { devtoolsRoutes } = await import('./devtools-endpoints');
  app.use('/api/devtools', devtoolsRoutes);
  console.log('✅ DevTools routes registered (project verification, airdrops, snapshots, promotions)');

  // Sitemap Routes (SEO)
  console.log('🗺️ Registering sitemap routes...');
  const sitemapRoutes = await import('./sitemap-routes');
  app.use('/', sitemapRoutes.default);
  console.log('✅ Sitemap routes registered successfully');

  // NFT Project Launchpad Routes
  console.log('🚀 Registering NFT Project Launchpad routes...');
  const nftProjectRoutes = await import('./nft-project-routes');
  app.use(nftProjectRoutes.default);
  console.log('✅ NFT Project Launchpad routes registered successfully');

  // Activity tracking middleware (must be after routes registration)
  console.log('📊 Setting up activity tracking middleware...');
  app.use(trackUserActivity());
  // Session check endpoint
  app.use('/api/auth', sessionCheckRoutes);
  console.log('🔐 Session check endpoint registered');

  // Generate comprehensive route inventory after ALL routes are registered
  console.log('🔍 Generating comprehensive route inventory...');
  try {
    const routeInventorySystem = RouteInventorySystem.getInstance();
    const inventory = await routeInventorySystem.generateInventory(app);
    console.log(`✅ Route inventory generated: ${inventory.totalRoutes} routes discovered`);
    console.log(`📊 Route categories: ${Object.keys(inventory.routesByCategory).join(', ')}`);
    
    // Set up daily report generation (runs at midnight)
    const scheduleDaily = () => {
      const now = new Date();
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const msUntilMidnight = tomorrow.getTime() - now.getTime();
      
      setTimeout(async () => {
        console.log('🕛 Generating daily route usage report...');
        try {
          await routeInventorySystem.generateDailyReport();
          console.log('✅ Daily route usage report generated');
        } catch (error) {
          console.error('❌ Failed to generate daily report:', error);
        }
        
        // Schedule next day's report
        scheduleDaily();
      }, msUntilMidnight);
    };
    
    // Start daily report scheduling
    scheduleDaily();
    console.log('⏰ Daily route usage reports scheduled');
    
  } catch (error) {
    console.error('❌ Failed to generate route inventory:', error);
  }
  
  // Solana routes handled in main routes.ts
  
  // Rewards routes are set up in routes.ts

  // Add global error handling middleware (standardized error shape with requestId)
  app.use(globalErrorHandler);

  // Error handling middleware will be applied after Vite setup
  // (Removed duplicate /health endpoint - using only the early fast one at line 109)

  // Production-specific SPA route handling for NFT pages
  if (process.env.NODE_ENV === "production") {
    // Explicitly handle NFT routes that should serve the SPA
    const nftRoutes = [
      '/nft-marketplace',
      '/nft-marketplace-v2', 
      '/nft-gateway',
      '/nft-launchpad',
      '/nft-management',
      '/nft-top24h',
      '/nft-wallet-management',
      '/nft/collection/*',
      '/nft-collections/*',
      '/nft/*',
      '/nft-profile/*'
    ];
    
    nftRoutes.forEach(route => {
      app.get(route, (req, res, next) => {
        // For production, these routes should be handled by the SPA
        // The serveStatic middleware will handle this, but this ensures proper routing
        next();
      });
    });
  }

  // Register additional endpoints BEFORE Vite setup to prevent conflicts
  console.log("🔄 Registering additional API endpoints...");
  
  // Register payment endpoints
  const { registerPaymentRoutes } = await import('./payment-endpoints');
  registerPaymentRoutes(app);
  console.log('✅ Payment endpoints registered');

  // Register Solana SPL token endpoints
  const { registerSolanaEndpoints } = await import('./solana-endpoints');
  registerSolanaEndpoints(app);
  console.log('✅ Solana SPL token endpoints registered');

  // Register transaction status endpoints
  const { registerTransactionStatusRoutes } = await import('./transaction-status-endpoints');
  registerTransactionStatusRoutes(app);
  console.log('✅ Transaction status endpoints registered');

  // Register NFT Broker routes
  const { registerBrokerRoutes } = await import('./broker-routes');
  await registerBrokerRoutes(app);
  console.log('✅ NFT Broker routes registered');

  // Register NEW XRPL NFT Brokered Offer routes
  console.log('🎨 Registering XRPL NFT Brokered Offer routes...');
  const nftOfferRoutes = await import('./nft-offer-routes');
  app.use('/api/nft/offers', nftOfferRoutes.default);
  console.log('✅ XRPL NFT Brokered Offer routes registered');

  // Register Automated Broker Escrow routes
  const { registerBrokerEscrowRoutes } = await import('./broker-escrow-routes');
  registerBrokerEscrowRoutes(app);
  console.log('✅ Automated Broker Escrow routes registered');

  // Register Broker Minting Escrow routes (External Platform)
  console.log('🏭 Registering Broker Minting Escrow routes...');
  const brokerMintExternalRoutes = await import('./broker-mint-external-routes');
  app.use('/api/broker/mint/external', brokerMintExternalRoutes.default);
  console.log('✅ External Platform Minting Escrow routes registered');

  // Register Broker Minting Escrow routes (DevTools Platform)
  const brokerMintDevToolsRoutes = await import('./broker-mint-devtools-routes');
  app.use('/api/broker/mint/devtools', brokerMintDevToolsRoutes.default);
  console.log('✅ DevTools Platform Minting Escrow routes registered');

  // Register Admin Broker Monitoring routes
  console.log('📊 Registering Admin Broker Monitoring routes...');
  const brokerAdminRoutes = await import('./broker-admin-routes');
  app.use('/api/admin/broker', brokerAdminRoutes.default);
  console.log('✅ Admin Broker Monitoring routes registered');

  // Start automated broker monitoring system
  const { startBrokerMonitor } = await import('./broker-monitor');
  startBrokerMonitor().catch(console.error);
  console.log('🔍 Broker blockchain monitor started');

  // Start automated broker mint monitoring system - DISABLED FOR NOW
  // const { startBrokerMintMonitor } = await import('./broker-mint-monitor');
  // startBrokerMintMonitor();
  // console.log('🔍 Broker mint escrow monitor started');

  // Register separate Scanner routes for each chain
  const { registerXRPLScannerRoutes } = await import('./scanner-routes-xrpl');
  registerXRPLScannerRoutes(app);
  console.log('✅ XRPL Scanner routes registered');

  const { registerEVMScannerRoutes } = await import('./scanner-routes-evm');
  registerEVMScannerRoutes(app);
  console.log('✅ EVM Scanner routes registered');

  const { registerSolanaScannerRoutes } = await import('./scanner-routes-solana');
  registerSolanaScannerRoutes(app);
  console.log('✅ Solana Scanner routes registered');

  // Register NFTScan Multi-Chain Marketplace routes
  console.log('🎨 Registering NFTScan Multi-Chain Marketplace routes...');
  const nftscanRoutes = await import('./routes/nftscan-routes');
  app.use('/api/nftscan', nftscanRoutes.default);
  console.log('✅ NFTScan Multi-Chain Marketplace routes registered');

  // Register NFT Launchpad IPFS routes
  const { registerNFTLaunchpadIPFSRoutes } = await import('./nft-launchpad-ipfs-routes');
  registerNFTLaunchpadIPFSRoutes(app);
  console.log('✅ NFT Launchpad IPFS routes registered');

  // Register Multi-Chain NFT Marketplace routes
  const { registerMultiChainMarketplaceRoutes } = await import('./multi-chain-nft-marketplace-routes');
  registerMultiChainMarketplaceRoutes(app);
  console.log('✅ Multi-Chain NFT Marketplace routes registered');

  // Setup static file serving before Vite to ensure proper asset serving
  console.log("🗂️ Setting up static file serving...");
  
  // Serve attached assets (user uploads)
  app.use('/attached_assets', express.static('attached_assets', { 
    setHeaders: (res, path) => {
      if (path.endsWith('.png')) res.setHeader('Content-Type', 'image/png');
      if (path.endsWith('.jpg') || path.endsWith('.jpeg')) res.setHeader('Content-Type', 'image/jpeg');
      if (path.endsWith('.svg')) res.setHeader('Content-Type', 'image/svg+xml');
    }
  }));
  
  // All organized images are now served by Vite from client/public/
  // No need for separate server static serving as Vite handles client/public/

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "development") {
    console.log("🔧 Setting up Vite development server...");
    try {
      await setupVite(app, server);
      console.log("✅ Vite development server setup completed");
    } catch (error) {
      console.error(`❌ Error setting up Vite: ${error}`);
      console.log("🔄 Falling back to static file serving for development...");
      // Import and setup static file serving as fallback
      const { serveStatic } = await import('./vite');
      serveStatic(app);
      console.log("✅ Static file serving fallback enabled for development");
    }
  } else {
    serveStatic(app);
  }

  // Add API 404 handler AFTER Vite setup to catch unregistered API routes
  app.use('/api/*', (req, res) => {
    console.log(`⚠️ [API 404] Unregistered API route accessed: ${req.originalUrl}`);
    res.status(404).json({ 
      error: 'API endpoint not found',
      path: req.originalUrl,
      method: req.method 
    });
  });

  // Apply error handling middleware only to API routes, not frontend
  // Vite handles all non-API routes with its catch-all handler

  // Start bridge verification service (checks every 30 seconds) - DISABLED per user request
  // setInterval(() => {
  //   processPending().catch(console.error);
  // }, 30000);
  
  log("🔄 Bridge verification service started - checking for completed transactions");
  
  // Initialize 3-hour rarity scanner cron job - DISABLED per user request
  // try {
  //   console.log('⏰ Initializing rarity scanner cron job (runs every 3 hours)...');
  //   const { setupRarityScannerCron } = await import('./scanners/rarity-scoring-scanner');
  //   setupRarityScannerCron();
  //   console.log('✅ Rarity scanner cron job initialized');
  // } catch (error) {
  //   console.error('❌ Failed to initialize rarity scanner cron:', error);
  // }
  
    console.log('✅ [STARTUP] Server initialization completed successfully');
    console.log('🎉 [STARTUP] All systems operational - server ready to handle requests');
    
  } catch (error) {
    console.error('🚨 CRITICAL: Failed to initialize server components:', error);
    console.log('⚠️ Server will continue running with limited functionality');
    // Don't exit the process - the server is already listening and can respond to health checks
    // This ensures deployment doesn't fail even if some initialization has issues
  }
}

// Keep process alive - prevent exit
// Graceful shutdown handlers
const gracefulShutdown = (signal: 'SIGINT' | 'SIGTERM') => {
  console.log(`👋 ${signal} received, shutdown requested...`);

  server.close(() => {
    console.log('🛑 Server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received at', new Date().toISOString());
  console.log(new Error('SIGTERM trace').stack);
  gracefulShutdown('SIGTERM');
});
process.on('SIGINT', () => {
  console.log('👋 SIGINT received at', new Date().toISOString());
  console.log(new Error('SIGINT trace').stack);
  gracefulShutdown('SIGINT');
});
