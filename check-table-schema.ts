import 'dotenv/config';
import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function checkTableSchema() {
  console.log('🔍 CHECKING inquisition_nft_audit SCHEMA\n');

  try {
    // Get column names
    const columns = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'inquisition_nft_audit'
      ORDER BY ordinal_position;
    `);

    console.log('Columns in inquisition_nft_audit:\n');
    columns.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type})`);
    });

    // Get sample row
    console.log('\n📄 Sample NFT:');
    const sample = await db.execute(sql`
      SELECT * FROM inquisition_nft_audit LIMIT 1;
    `);

    if (sample.rows.length > 0) {
      const nft = sample.rows[0];
      console.log('\n' + JSON.stringify(nft, null, 2));
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

checkTableSchema();
