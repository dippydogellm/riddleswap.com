import dotenv from 'dotenv';
dotenv.config();

import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function checkTables() {
  const r1 = await db.execute(sql`SELECT COUNT(*) as cnt FROM gaming_nfts`);
  const r2 = await db.execute(sql`SELECT COUNT(*) as cnt FROM inquisition_nft_audit`);
  
  console.log('\nTable Counts:');
  console.log(`  gaming_nfts: ${r1.rows[0].cnt}`);
  console.log(`  inquisition_nft_audit: ${r2.rows[0].cnt}`);
  
  const sample = await db.execute(sql`SELECT nft_token_id FROM inquisition_nft_audit LIMIT 1`);
  const testId = sample.rows[0]?.nft_token_id;
  console.log(`\nSample NFT from inquisition: ${testId}`);
  
  const check = await db.execute(sql`SELECT COUNT(*) as cnt FROM gaming_nfts WHERE nft_id = ${testId}`);
  const checkRows = (check.rows as any[]).map(r => ({ cnt: Number((r as any).cnt || 0) })) as Array<{ cnt: number }>;
  console.log(`Found in gaming_nfts: ${checkRows[0]?.cnt > 0 ? 'YES' : 'NO'}`);
  
  process.exit(0);
}

checkTables();
