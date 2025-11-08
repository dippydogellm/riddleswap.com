import pg from 'pg';
const { Client } = pg;

const client = new Client({ 
  connectionString: 'postgresql://postgres:postgres@localhost:5432/riddle' 
});

await client.connect();

const result = await client.query(`
  SELECT session_token 
  FROM riddle_wallet_sessions 
  WHERE wallet_address = $1 
    AND is_active = true 
    AND expires_at > NOW() 
  ORDER BY created_at DESC 
  LIMIT 1
`, ['dippydoge']);

if (result.rows.length > 0) {
  console.log(result.rows[0].session_token);
} else {
  console.log('NO_SESSION_FOUND');
}

await client.end();
