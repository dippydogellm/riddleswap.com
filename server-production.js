import express from "express";
import { registerRoutes } from "./server/routes.js";
import { productionSecurity } from "./server/production-security.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Set production environment
process.env.NODE_ENV = 'production';

// Apply production security measures
productionSecurity(app);

// Request size limits for security
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

console.log('🔒 Production mode enabled with enhanced security');

// Serve static files from built client
app.use(express.static(path.join(__dirname, "dist/public")));

// Register API routes
registerRoutes(app).then((server) => {
  // Serve index.html for all non-API routes (SPA)
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "dist/public/index.html"));
  });

  const port = process.env.PORT || 5000;
  server.listen(port, "0.0.0.0", () => {
    console.log(`Production server running on port ${port}`);
  });
}).catch(err => {
  console.error("Failed to start server:", err);
  process.exit(1);
});