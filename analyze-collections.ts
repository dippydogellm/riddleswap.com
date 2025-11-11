import 'dotenv/config';
import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function analyzeCollections() {
  console.log('🔍 ANALYZING COLLECTIONS IN inquisition_nft_audit\n');

  try {
    const collections = await db.execute(sql`
      SELECT 
        issuer_address, 
        taxon, 
        COUNT(*) as nft_count,
        MIN(name) as sample_name
      FROM inquisition_nft_audit 
      GROUP BY issuer_address, taxon 
      ORDER BY nft_count DESC;
    `);

    console.log(`Found ${collections.rows.length} unique collections:\n`);
    console.log('Issuer'.padEnd(45) + 'Taxon'.padEnd(10) + 'NFTs'.padEnd(10) + 'Sample Name');
    console.log('='.repeat(100));

    for (const col of collections.rows) {
      const issuer = String(col.issuer_address);
      const taxon = String(col.taxon);
      const count = String(col.nft_count);
      const sample = String(col.sample_name || 'N/A').slice(0, 30);
      
      console.log(
        issuer.slice(0, 43).padEnd(45) + 
        taxon.padEnd(10) + 
        count.padEnd(10) + 
        sample
      );
    }

    console.log('\n' + '='.repeat(100));
    console.log(`\n✅ Total: ${collections.rows.length} collections with ${collections.rows.reduce((sum, r) => sum + Number(r.nft_count), 0)} NFTs`);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

analyzeCollections();
