import 'dotenv/config';
import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function verifyMigration() {
  console.log('📊 VERIFYING DATA MIGRATION\n');
  console.log('='.repeat(70));
  
  const keyTables = [
    'gaming_nfts',
    'gaming_nft_collections',
    'gaming_players',
    'nft_collections',
    'users',
    'riddle_wallets',
    'bridge_payloads',
    'tokens',
    'inquisition_nft_audit',
    'inquisition_scan_history',
    'error_logs',
    'external_wallets'
  ];
  
  for (const table of keyTables) {
    try {
      const result = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM ${table}`));
      const countValue = result.rows[0] as any;
      const count = Number(countValue?.count || 0);
      const icon = count > 0 ? '✅' : '⚠️ ';
      console.log(`${icon} ${table}: ${count.toLocaleString()} rows`);
    } catch (error: any) {
      console.log(`❌ ${table}: Error - ${error.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('Verification complete!');
  process.exit(0);
}

verifyMigration();
