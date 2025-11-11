import { Pool } from '@neondatabase/serverless';
import { config } from 'dotenv';

config();

const OLD_DB = 'postgresql://neondb_owner:npg_qdIe1X8rkaJb@ep-broad-surf-a576s6yl.us-east-2.aws.neon.tech/neondb?sslmode=require';
const NEW_DB = process.env.DATABASE_URL!;

console.log('🔄 DATA MIGRATION STARTING...\n');
console.log('📤 Source: ep-broad-surf-a576s6yl.us-east-2.aws.neon.tech');
console.log('📥 Target: ep-long-shape-adphvnz2-pooler.c-2.us-east-1.aws.neon.tech\n');

const oldPool = new Pool({ connectionString: OLD_DB, max: 5 });
const newPool = new Pool({ connectionString: NEW_DB, max: 5 });

async function migrateData() {
  let oldClient, newClient;
  
  try {
    console.log('🔌 Connecting to both databases...');
    oldClient = await oldPool.connect();
    newClient = await newPool.connect();
    console.log('✅ Connected to both databases\n');

    // Get list of all tables
    const tablesResult = await oldClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const tables = tablesResult.rows.map(r => r.table_name);
    console.log(`📋 Found ${tables.length} tables to migrate\n`);

    let totalRows = 0;
    let migratedTables = 0;
    let skippedTables = 0;

    for (const table of tables) {
      try {
        // Count rows in old database
        const countResult = await oldClient.query(`SELECT COUNT(*) as count FROM "${table}"`);
        const rowCount = parseInt(countResult.rows[0].count);

        if (rowCount === 0) {
          console.log(`⏭️  ${table}: 0 rows (skipping)`);
          skippedTables++;
          continue;
        }

        console.log(`🔄 Migrating ${table}: ${rowCount.toLocaleString()} rows...`);

        // Fetch all data from old database
        const dataResult = await oldClient.query(`SELECT * FROM "${table}"`);
        
        if (dataResult.rows.length === 0) {
          console.log(`   ✅ ${table}: No data to migrate`);
          continue;
        }

        // Get column names
        const columns = Object.keys(dataResult.rows[0]);
        const columnList = columns.map(c => `"${c}"`).join(', ');
        
        // Insert data in batches
        const batchSize = 100;
        let inserted = 0;

        for (let i = 0; i < dataResult.rows.length; i += batchSize) {
          const batch = dataResult.rows.slice(i, i + batchSize);
          
          // Build VALUES clause
          const values = batch.map((row, idx) => {
            const placeholders = columns.map((_, colIdx) => `$${idx * columns.length + colIdx + 1}`).join(', ');
            return `(${placeholders})`;
          }).join(', ');

          // Flatten all values
          const allValues = batch.flatMap(row => columns.map(col => row[col]));

          // Insert batch with ON CONFLICT DO NOTHING to handle duplicates
          const insertQuery = `
            INSERT INTO "${table}" (${columnList})
            VALUES ${values}
            ON CONFLICT DO NOTHING
          `;

          await newClient.query(insertQuery, allValues);
          inserted += batch.length;
          
          if (batch.length === batchSize) {
            process.stdout.write(`   📦 ${inserted}/${dataResult.rows.length}\r`);
          }
        }

        console.log(`   ✅ ${table}: ${inserted.toLocaleString()} rows migrated`);
        totalRows += inserted;
        migratedTables++;

      } catch (error: any) {
        console.error(`   ❌ ${table}: Migration failed - ${error.message}`);
        // Continue with next table
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('🎉 DATA MIGRATION COMPLETED!\n');
    console.log(`✅ Tables migrated: ${migratedTables}`);
    console.log(`⏭️  Tables skipped (empty): ${skippedTables}`);
    console.log(`📊 Total rows migrated: ${totalRows.toLocaleString()}`);
    console.log('='.repeat(70));

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (oldClient) oldClient.release();
    if (newClient) newClient.release();
    await oldPool.end();
    await newPool.end();
    console.log('\n👋 Connections closed');
  }
}

migrateData();
