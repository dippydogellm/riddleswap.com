import { db } from '../server/db';
import { sql } from 'drizzle-orm';

(async () => {
  const res = await db.execute(sql`SELECT user_handle, COUNT(*) AS c FROM gaming_players GROUP BY user_handle HAVING COUNT(*) > 1 ORDER BY c DESC LIMIT 20;`);
  console.log(res.rows);
  process.exit(0);
})();
