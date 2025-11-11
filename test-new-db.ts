import { Pool } from '@neondatabase/serverless';

const newConnectionString = 'postgresql://neondb_owner:npg_Z9NCJE2Xdzet@ep-long-shape-adphvnz2-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

console.log('🔍 Testing NEW database connection...\n');

const testPool = new Pool({
  connectionString: newConnectionString,
  connectionTimeoutMillis: 10000,
  max: 5,
});

async function testNewConnection() {
  let client;
  
  try {
    console.log('🔌 Connecting to new database...');
    client = await testPool.connect();
    console.log('✅ Successfully connected to new database!');
    
    const result = await client.query('SELECT version()');
    const version = result.rows[0].version.split('\n')[0];
    console.log(`✅ PostgreSQL version: ${version}`);
    
    const dbInfo = await client.query(`
      SELECT 
        current_database() as database,
        current_user as user,
        pg_size_pretty(pg_database_size(current_database())) as size
    `);
    
    console.log(`\n📊 New Database Information:`);
    console.log(`   Database: ${dbInfo.rows[0].database}`);
    console.log(`   User: ${dbInfo.rows[0].user}`);
    console.log(`   Size: ${dbInfo.rows[0].size}`);
    
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log(`\n📋 Tables in new database: ${tables.rows.length}`);
    if (tables.rows.length > 0) {
      tables.rows.slice(0, 5).forEach(row => {
        console.log(`   - ${row.table_name}`);
      });
      if (tables.rows.length > 5) {
        console.log(`   ... and ${tables.rows.length - 5} more`);
      }
    } else {
      console.log('   ⚠️  (No tables - database is empty, ready for migration)');
    }
    
    console.log('\n✅ New database connection is ready!');
    
  } catch (error: any) {
    console.error('\n❌ Failed to connect to new database!');
    console.error(`Error: ${error.message}`);
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
    await testPool.end();
  }
}

testNewConnection();
