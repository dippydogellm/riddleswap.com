import 'dotenv/config';
import { neonConfig, Pool } from '@neondatabase/serverless';
import ws from 'ws';
import * as drizzleSchema from '../shared/schema';
import { drizzle } from 'drizzle-orm/neon-serverless';

// Configure Neon websocket (Windows compatibility)
neonConfig.webSocketConstructor = ws;
neonConfig.useSecureWebSocket = true;
neonConfig.pipelineConnect = false;

// Global handlers to ignore known Neon ErrorEvent mutation noise
process.on('uncaughtException', (error: any) => {
  const msg = typeof error?.message === 'string' ? error.message : String(error);
  if (msg.includes('Cannot set property message of #<ErrorEvent>')) {
    console.warn('⚠️  [IGNORED] Known Neon ErrorEvent mutation during DB connect');
    return; // swallow and continue
  }
  console.error('🚨 Uncaught Exception:', msg);
  process.exit(1);
});

process.on('unhandledRejection', (reason: any) => {
  const msg = typeof reason?.message === 'string' ? reason.message : String(reason);
  if (msg.includes('Cannot set property message of #<ErrorEvent>')) {
    console.warn('⚠️  [IGNORED] Known Neon ErrorEvent mutation during DB connect (promise)');
    return; // swallow and continue
  }
  console.error('🚨 Unhandled Rejection:', msg);
  process.exit(1);
});

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not set');
    process.exit(1);
  }

  const startOverall = Date.now();
  console.log('🔍 Starting database connectivity & schema validation...');

  // Create low-level pool for metadata queries
  const pool = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 10000, max: 3 });
  const db = drizzle({ client: pool, schema: drizzleSchema });

  // 1. Connection test
  const startConn = Date.now();
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    console.log(`✅ Connectivity test passed in ${Date.now() - startConn}ms`);
  } catch (err) {
    // Handle Neon ErrorEvent mutation issue safely
    const message = safeErrorMessage(err);
    if (message.includes('Cannot set property message of #<ErrorEvent>')) {
      console.warn('⚠️  Known Neon ErrorEvent mutation encountered on first try. Retrying once...');
      // Small backoff then retry once
      await new Promise(r => setTimeout(r, 500));
      try {
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        console.log(`✅ Connectivity test passed on retry in ${Date.now() - startConn}ms`);
      } catch (e2) {
        console.error('❌ Connectivity test failed after retry:', safeErrorMessage(e2));
        process.exit(1);
      }
    } else {
      console.error('❌ Connectivity test failed:', message);
      process.exit(1);
    }
  }

  // 2. Collect expected tables from drizzle schema
  // Drizzle table objects expose their name via Symbol.for('drizzle.tableName')
  const tableNameSymbol = Symbol.for('drizzle.tableName');
  type TableInfo = { name: string; columns: string[] };
  const expectedTables: TableInfo[] = [];
  for (const [key, value] of Object.entries(drizzleSchema)) {
    if (value && typeof value === 'object' && tableNameSymbol in value) {
      const name = (value as any)[tableNameSymbol];
      // Column names are keys in value.columns
      let columns: string[] = [];
      try {
        columns = Object.keys((value as any).columns || {});
      } catch { /* ignore */ }
      expectedTables.push({ name, columns });
    }
  }

  if (expectedTables.length === 0) {
    console.warn('⚠️ No tables discovered in schema export. Validation will exit.');
    process.exit(0);
  }

  console.log(`📦 Discovered ${expectedTables.length} expected tables from schema.`);

  // 3. Query actual tables
  interface DbTableRow { table_name: string; }
  const actualTablesRes = await pool.query<DbTableRow>("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
  const actualTables = new Set(actualTablesRes.rows.map(r => r.table_name));

  // 4. Compare table presence
  const missingTables: string[] = [];
  const extraTables: string[] = [];

  expectedTables.forEach(t => {
    if (!actualTables.has(t.name)) missingTables.push(t.name);
  });
  actualTables.forEach(name => {
    if (!expectedTables.some(t => t.name === name)) extraTables.push(name);
  });

  // 5. Column-level diff for present tables
  const columnDiffs: { table: string; missing: string[]; extra: string[] }[] = [];
  for (const t of expectedTables) {
    if (!actualTables.has(t.name)) continue; // skip missing
    const colsRes = await pool.query<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1",
      [t.name]
    );
    const actualCols = new Set(colsRes.rows.map(r => r.column_name));
    const missingCols = t.columns.filter(c => !actualCols.has(c));
    const extraCols: string[] = [];
    actualCols.forEach(c => { if (!t.columns.includes(c)) extraCols.push(c); });
    if (missingCols.length || extraCols.length) {
      columnDiffs.push({ table: t.name, missing: missingCols, extra: extraCols });
    }
  }

  // 6. Output summary
  console.log('------------------------------------------------------------');
  console.log('🧪 Schema Validation Summary');
  console.log('------------------------------------------------------------');
  if (missingTables.length) {
    console.log(`❌ Missing tables (${missingTables.length}):`);
    missingTables.forEach(t => console.log(`   - ${t}`));
  } else {
    console.log('✅ No missing tables.');
  }
  if (extraTables.length) {
    console.log(`⚠️ Extra tables present in DB (${extraTables.length}):`);
    extraTables.forEach(t => console.log(`   - ${t}`));
  } else {
    console.log('✅ No unexpected extra tables.');
  }

  if (columnDiffs.length) {
    console.log(`⚠️ Column mismatches detected in ${columnDiffs.length} table(s):`);
    for (const diff of columnDiffs) {
      console.log(`   Table: ${diff.table}`);
      if (diff.missing.length) console.log(`     Missing columns: ${diff.missing.join(', ')}`);
      if (diff.extra.length) console.log(`     Extra columns: ${diff.extra.join(', ')}`);
    }
  } else {
    console.log('✅ No column mismatches detected.');
  }

  const totalMs = Date.now() - startOverall;
  if (!missingTables.length && !columnDiffs.length) {
    console.log(`🎉 Database schema matches Drizzle definitions (validated in ${totalMs}ms).`);
  } else {
    console.log(`🔍 Validation completed with discrepancies (took ${totalMs}ms). Review above output.`);
  }

  await pool.end();
}

main().catch(err => {
  console.error('❌ Fatal validation error:', safeErrorMessage(err));
  process.exit(1);
});

function safeErrorMessage(err: any): string {
  try {
    if (!err) return 'Unknown error';
    if (typeof err.message === 'string') return err.message;
    if (typeof err === 'string') return err;
    return JSON.stringify(err);
  } catch {
    return 'Unknown error (failed to extract message)';
  }
}
