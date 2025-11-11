import { Pool } from '@neondatabase/serverless';
import { config } from 'dotenv';
import fs from 'fs';

config();

const newPool = new Pool({ 
  connectionString: process.env.DATABASE_URL!,
  max: 5 
});

async function applySchemaFixes() {
  console.log('🔧 Applying schema fixes to new database...\n');
  
  const client = await newPool.connect();
  
  try {
    const sqlFile = fs.readFileSync('fix-schema-mismatches.sql', 'utf8');
    const statements = sqlFile
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && s !== 'COMMIT');
    
    console.log(`📋 Found ${statements.length} SQL statements to execute\n`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const statement of statements) {
      try {
        await client.query(statement);
        
        // Extract table name for better logging
        const match = statement.match(/TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/i);
        const tableName = match ? match[1] : 'unknown';
        
        if (statement.toUpperCase().includes('CREATE TABLE')) {
          console.log(`✅ Created table: ${tableName}`);
        } else if (statement.toUpperCase().includes('ALTER TABLE')) {
          console.log(`✅ Updated table: ${tableName}`);
        }
        
        successCount++;
      } catch (error: any) {
        // Ignore "already exists" errors
        if (!error.message.includes('already exists') && 
            !error.message.includes('does not exist')) {
          console.error(`❌ Error: ${error.message}`);
          errorCount++;
        }
      }
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ Schema fixes applied successfully!');
    console.log(`   Success: ${successCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log('='.repeat(70));
    
  } catch (error: any) {
    console.error('❌ Failed to apply schema fixes:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await newPool.end();
  }
}

applySchemaFixes();
