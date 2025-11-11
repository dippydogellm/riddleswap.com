import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-serverless';

const db = drizzle(process.env.DATABASE_URL!);

async function auditSchema() {
  console.log('🔍 Starting database schema audit...\n');

  try {
    // Get all tables
    const tables = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log(`📊 Found ${tables.rows?.length || 0} tables in database:\n`);

    for (const table of tables.rows || []) {
      const tableName = (table as any).table_name;
      console.log(`\n=== TABLE: ${tableName} ===`);

      // Get columns for this table
      const columns = await db.execute(sql`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = ${tableName}
        ORDER BY ordinal_position
      `);

      console.log(`Columns (${columns.rows?.length || 0}):`);
      for (const col of columns.rows || []) {
        const colInfo = col as any;
        const nullable = colInfo.is_nullable === 'YES' ? '✓' : '✗';
        console.log(`  - ${colInfo.column_name}: ${colInfo.data_type} [NULL: ${nullable}]${colInfo.column_default ? ` DEFAULT: ${colInfo.column_default}` : ''}`);
      }

      // Get indexes for this table
      const indexes = await db.execute(sql`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = ${tableName}
        ORDER BY indexname
      `);

      if ((indexes.rows?.length || 0) > 0) {
        console.log(`\nIndexes (${indexes.rows?.length || 0}):`);
        for (const idx of indexes.rows || []) {
          const idxInfo = idx as any;
          console.log(`  - ${idxInfo.indexname}`);
        }
      }
    }

    console.log('\n\n✅ Database audit complete!');
    console.log('\nNext steps:');
    console.log('1. Compare this output with shared/schema.ts');
    console.log('2. Identify missing columns, tables, and indexes');
    console.log('3. Create migration file to add missing fields');
    console.log('4. Run: npx drizzle-kit push --config drizzle.config.ts');

  } catch (error) {
    console.error('❌ Error auditing database:', error);
  }

  process.exit(0);
}

auditSchema();
