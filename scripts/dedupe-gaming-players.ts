import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('\n🧹 Deduplicating gaming_players by user_handle (keeping latest updated_at)...');

  // Delete duplicates keeping the most recently updated row per handle
  await db.execute(sql`
    WITH ranked AS (
      SELECT id, user_handle,
             ROW_NUMBER() OVER (PARTITION BY user_handle ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC) AS rn
      FROM gaming_players
    )
    DELETE FROM gaming_players gp
    USING ranked r
    WHERE gp.id = r.id AND r.rn > 1;
  `);

  console.log('✅ Deduplication complete');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
