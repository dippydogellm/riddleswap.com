import { config } from 'dotenv';
import { Pool } from '@neondatabase/serverless';

// Load environment variables first
config();

console.log('🔍 Checking database connection...\n');

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set in environment variables');
  console.log('\n📁 Checking .env file...');
  process.exit(1);
}

console.log('✅ DATABASE_URL is configured');
console.log(`📋 Database: ${process.env.DATABASE_URL.split('@')[1]?.split('/')[1]?.split('?')[0] || 'Unknown'}`);
console.log(`🌐 Host: ${process.env.DATABASE_URL.split('@')[1]?.split('/')[0] || 'Unknown'}\n`);

// Create a test pool
const testPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
  max: 5,
});

async function testConnection() {
  let client;
  
  try {
    console.log('🔌 Attempting to connect to database...');
    client = await testPool.connect();
    console.log('✅ Successfully connected to database!');
    
    // Test query
    console.log('\n🧪 Running test query...');
    const result = await client.query('SELECT version()');
    const version = result.rows[0].version.split('\n')[0];
    console.log(`✅ PostgreSQL version: ${version}`);
    
    // Get database info
    const dbInfo = await client.query(`
      SELECT 
        current_database() as database,
        current_user as user,
        pg_size_pretty(pg_database_size(current_database())) as size
    `);
    
    console.log(`\n📊 Database Information:`);
    console.log(`   Database: ${dbInfo.rows[0].database}`);
    console.log(`   User: ${dbInfo.rows[0].user}`);
    console.log(`   Size: ${dbInfo.rows[0].size}`);
    
    // Check tables
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log(`\n📋 Tables in database (${tables.rows.length} total):`);
    if (tables.rows.length > 0) {
      tables.rows.slice(0, 10).forEach(row => {
        console.log(`   - ${row.table_name}`);
      });
      if (tables.rows.length > 10) {
        console.log(`   ... and ${tables.rows.length - 10} more`);
      }
    } else {
      console.log('   (No tables found)');
    }
    
    console.log('\n✅ Database connection test completed successfully!');
    
  } catch (error: any) {
    console.error('\n❌ Database connection test failed!');
    console.error(`Error: ${error.message}`);
    
    if (error.code) {
      console.error(`Error code: ${error.code}`);
    }
    
    if (process.env.NODE_ENV !== 'production') {
      console.error('\nFull error:', error);
    }
    
    process.exit(1);
  } finally {
    if (client) {
      client.release();
      console.log('\n🔌 Connection released');
    }
    await testPool.end();
    console.log('👋 Connection pool closed');
  }
}

testConnection();
