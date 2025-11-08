import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { nanoid } from "nanoid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
 * SIMPLE APPROACH: Just serve static files
 * No WebSocket, no HMR, no complexity
 * Works immediately
 */
export async function setupVite(app: Express, _server: any) {
  log(`📁 Setting up static file serving (no HMR)`);

  const publicPath = path.resolve(__dirname, "..", "client", "public");
  const indexPath = path.resolve(__dirname, '..', 'client', 'index.html');

  // Serve static files
  app.use(express.static(publicPath, {
    etag: false,
    maxAge: '1h',
  }));

  log(`✅ Static files serving from: ${publicPath}`);

  // SPA catch-all - serve index.html for all routes that aren't API/files
  const shouldBypassHtmlFallback = (u: string) => {
    // Don't serve HTML for API routes
    if (u.startsWith('/api/')) return true;
    if (u.startsWith('/ws')) return true;
    // Don't serve HTML for actual files
    if (/\.(js|css|json|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)(\?|$)/.test(u)) return true;
    return false;
  };

  app.use('*', (req, res, next) => {
    const url = req.originalUrl;
    if (shouldBypassHtmlFallback(url)) return next();
    
    try {
      let html = fs.readFileSync(indexPath, 'utf-8');
      // Add cache-busting to main.tsx
      html = html.replace(
        'src="/src/main.tsx"',
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      res.status(200).set({ 'Content-Type': 'text/html' }).send(html);
    } catch (e) {
      log(`❌ Error serving index.html: ${e}`);
      next(e);
    }
  });

  log(`✅ SPA catch-all configured`);
  log(`✅ Frontend serving ready`);
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
