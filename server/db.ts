import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "../shared/schema";

// Configure WebSocket and fetch for Windows compatibility
neonConfig.webSocketConstructor = ws;

// Configure for better WebSocket support on Windows
neonConfig.useSecureWebSocket = true;
neonConfig.pipelineConnect = false;

// Polyfill fetch if not available (Node < 18)
if (typeof fetch === 'undefined') {
  (async () => {
    const nodeFetch = await import('node-fetch');
    globalThis.fetch = nodeFetch.default as any;
  })();
}

// Prevent process exit on unhandled promise rejections in development
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ [UNHANDLED REJECTION]:', reason);
  if (process.env.NODE_ENV === 'development') {
    console.error('💡 [DEBUG] Promise:', promise);
    // Don't exit in development - let server continue
  } else {
    process.exit(1);
  }
});

process.on('uncaughtException', (error) => {
  console.error('⚠️ [UNCAUGHT EXCEPTION]:', error);
  if (process.env.NODE_ENV !== 'development') {
    process.exit(1);
  }
});

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure connection with better error handling and retries
const connectionString = process.env.DATABASE_URL;
export const pool = new Pool({
  connectionString,
  connectionTimeoutMillis: 10000,
  max: 10,
  idleTimeoutMillis: 30000,
});

// Add error handler to prevent uncaught errors
pool.on('error', (err) => {
  // Normalize ErrorEvent objects (Neon may emit WebSocket ErrorEvent)
  const normalized = normalizeDbError(err);
  console.error('⚠️ [DATABASE] Unexpected error on idle client:', normalized.message);
});

function normalizeDbError(err: any): Error {
  if (err instanceof Error) return err;
  // Some environments emit ErrorEvent with .message readonly; clone details
  try {
    const message = typeof err?.message === 'string' ? err.message : 'Unknown database error';
    const e = new Error(message);
    (e as any).original = err;
    return e;
  } catch {
    return new Error('Unknown database error (failed to normalize)');
  }
}

// Lightweight connection test (no fallback, just verification) exported for startup
export async function testDatabaseConnection(): Promise<void> {
  const start = Date.now();
  try {
    // Simple query: SELECT 1; Using pg protocol via pool
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
      const ms = Date.now() - start;
      console.log(`✅ [DB] Connection test succeeded in ${ms}ms`);
    } finally {
      client.release();
    }
  } catch (err) {
    const normalized = normalizeDbError(err);
    console.error('❌ [DB] Connection test failed:', normalized.message);
    if (process.env.NODE_ENV !== 'production') {
      console.error('[DB] Full error object:', err);
    }
  }
}

export const db = drizzle({ client: pool, schema });