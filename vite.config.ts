import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
// Removed import for runtimeErrorOverlay to prevent plugin error
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    react(),
    // Removed runtimeErrorOverlay plugin to resolve Material UI styled function error
    nodePolyfills({
      include: ['stream', 'crypto', 'buffer', 'process', 'util', 'vm'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      stream: 'stream-browserify',
      crypto: 'crypto-browserify',
    },
    dedupe: ['@emotion/react', '@emotion/styled'],
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
  },
  server: {
    host: "0.0.0.0",
    port: parseInt(process.env.PORT || "5000"),
    hmr: false,
  },
  optimizeDeps: {
    include: [
      "@emotion/react",
      "@emotion/styled",
    ],
    esbuildOptions: {
      target: 'es2020',
    },
  },
});
