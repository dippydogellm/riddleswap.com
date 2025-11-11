import { config } from 'dotenv';
config(); // Load .env file

import { pool, testDatabaseConnection } from './server/db';

async function checkConnection() {
  console.log('🔍 Testing database connection...');
  console.log('📋 Database URL configured:', process.env.DATABASE_URL ? '✅ Yes' : '❌ No');
  console.log('');

  try {
    // Test basic connection
    await testDatabaseConnection();
    
    // Additional detailed test
    console.log('\n🔍 Running detailed connection test...');
    const client = await pool.connect();
    
    try {
      // Get database version
      const versionResult = await client.query('SELECT version()');
      console.log('✅ PostgreSQL version:', versionResult.rows[0].version.split('\n')[0]);
      
      // Get current database name
      const dbResult = await client.query('SELECT current_database()');
      console.log('✅ Current database:', dbResult.rows[0].current_database);
      
      // Get current user
      const userResult = await client.query('SELECT current_user');
      console.log('✅ Current user:', userResult.rows[0].current_user);
      
      // Check pool stats
      console.log('\n📊 Connection pool stats:');
      console.log(`   - Total connections: ${pool.totalCount}`);
      console.log(`   - Idle connections: ${pool.idleCount}`);
      console.log(`   - Waiting requests: ${pool.waitingCount}`);
      
      console.log('\n✅ Database connection is working properly!');
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('\n👋 Connection pool closed.');
  }
}

checkConnection();
