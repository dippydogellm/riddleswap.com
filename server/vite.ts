import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  
  console.log(`[${formattedTime}] [${source}] ${message}`);
}

/**
 * SIMPLIFIED VITE SETUP - NO HMR, STATIC SERVING ONLY
 * HMR WebSocket was causing crashes. Disabling it entirely for stability.
 * Build client once, serve static files - simple and reliable.
 */
export async function setupVite(app: Express, server: Server) {
  log(`🔧 Setting up STATIC file serving (HMR disabled for stability)`);

  try {
    // Create Vite server with HMR COMPLETELY DISABLED
    const vite = await createViteServer({
      ...viteConfig,
      root: path.resolve(__dirname, "..", "client"),
      configFile: false,
      server: {
        middlewareMode: true,
        hmr: false, // HMR explicitly disabled for stability
        watch: { usePolling: false },
      },
      appType: "spa",
      customLogger: {
        ...viteLogger,
        error: (msg, options) => {
          if (msg && typeof msg === 'string' && msg.includes('Pre-transform')) return;
          viteLogger.error(msg, options);
        },
        warn: (msg, options) => {
          if (msg && typeof msg === 'string' && msg.includes('Pre-transform')) return;
          viteLogger.warn(msg, options);
        },
      },
      define: {},
      optimizeDeps: {
        // Prevent esbuild service crash by constraining target & disabled aggressive pre-bundling
        esbuildOptions: {
          target: 'es2020',
        },
        force: true,
      },
    });

    // Apply Vite middleware FIRST - it handles /src/, /@vite, etc.
    app.use(vite.middlewares);
  log(`✅ Vite middlewares applied (HMR disabled, polling off)`);

    // SPA catch-all - serve index.html for frontend routes ONLY
    // Let Vite handle all /src/, /@vite, etc. - don't interfere
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      
      // Let Vite handle its own special paths
      if (url.startsWith('/@vite') || url.startsWith('/@react-refresh') || url.startsWith('/@fs/')) {
        return next();
      }
      
      // Let Vite handle source file requests
      if (url.startsWith('/src/') || url.startsWith('/node_modules/')) {
        return next();
      }
      
      // Skip API routes
      if (url.startsWith('/api/') || url.startsWith('/auth') || url.startsWith('/ws')) {
        return next();
      }
      
      // Serve index.html for all other routes (SPA routing)
      try {
        const clientTemplate = path.resolve(__dirname, '..', 'client', 'index.html');
        let template = await fs.promises.readFile(clientTemplate, 'utf-8');
        const page = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' } as any).end(page);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });

    log(`✅ Vite setup complete (STATIC MODE - no HMR, no WebSocket crashes)`);
  } catch (err) {
    log(`❌ Vite setup failed: ${err}`);
    log(`❌ Server will continue without Vite`);
    return;
  }
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(process.cwd(), "dist", "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
