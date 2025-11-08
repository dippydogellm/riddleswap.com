import { drizzle } from 'drizzle-orm/neon-serverless';
import { migrate } from 'drizzle-orm/neon-serverless/migrator';
import ws from 'ws';
import * as schema from './shared/schema';

const sql = drizzle(process.env.DATABASE_URL!, { 
  schema,
  ws: ws as any 
});

console.log('Pushing schema to database...');

// Note: Using db.execute for schema changes
const tables = [
  `CREATE TABLE IF NOT EXISTS ai_generated_images (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    prompt TEXT NOT NULL,
    input_image_url TEXT,
    output_image_url TEXT NOT NULL,
    model TEXT NOT NULL DEFAULT 'gpt-image-1',
    size TEXT DEFAULT '1024x1024',
    quality TEXT DEFAULT 'standard',
    style TEXT,
    generation_type TEXT NOT NULL,
    revised_prompt TEXT,
    status TEXT NOT NULL DEFAULT 'completed',
    error_message TEXT,
    is_nft BOOLEAN DEFAULT false,
    nft_project_id TEXT,
    nft_token_id TEXT,
    video_project_id INTEGER,
    video_frame_order INTEGER,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_ai_images_user ON ai_generated_images(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_ai_images_status ON ai_generated_images(status);`,
  `CREATE INDEX IF NOT EXISTS idx_ai_images_video_project ON ai_generated_images(video_project_id);`,
  `CREATE INDEX IF NOT EXISTS idx_ai_images_nft_project ON ai_generated_images(nft_project_id);`,
  
  `CREATE TABLE IF NOT EXISTS ai_video_projects (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    project_name TEXT NOT NULL,
    description TEXT,
    video_prompt TEXT NOT NULL,
    image_count INTEGER NOT NULL DEFAULT 0,
    image_ids JSONB DEFAULT '[]',
    total_images INTEGER NOT NULL,
    price_xrp DECIMAL(18, 8) NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'pending',
    payment_tx_hash TEXT,
    video_url TEXT,
    video_duration INTEGER,
    video_format TEXT DEFAULT 'mp4',
    video_resolution TEXT DEFAULT '1920x1080',
    status TEXT NOT NULL DEFAULT 'draft',
    processing_started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    is_nft BOOLEAN DEFAULT false,
    nft_project_id TEXT,
    nft_token_id TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_video_projects_user ON ai_video_projects(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_video_projects_status ON ai_video_projects(status);`,
  `CREATE INDEX IF NOT EXISTS idx_video_projects_payment ON ai_video_projects(payment_status);`,
  
  `CREATE TABLE IF NOT EXISTS ai_nft_collections (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    collection_name TEXT NOT NULL,
    collection_description TEXT,
    collection_symbol TEXT,
    source_type TEXT NOT NULL,
    source_id INTEGER NOT NULL,
    devtools_project_id TEXT,
    chain TEXT NOT NULL DEFAULT 'xrpl',
    contract_address TEXT,
    token_id TEXT,
    metadata_url TEXT,
    metadata_json JSONB,
    mint_status TEXT NOT NULL DEFAULT 'draft',
    mint_tx_hash TEXT,
    minted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_ai_nft_user ON ai_nft_collections(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_ai_nft_source ON ai_nft_collections(source_type, source_id);`,
  `CREATE INDEX IF NOT EXISTS idx_ai_nft_devtools ON ai_nft_collections(devtools_project_id);`,
  `CREATE INDEX IF NOT EXISTS idx_ai_nft_status ON ai_nft_collections(mint_status);`
];

for (const tableSQL of tables) {
  await sql.execute(tableSQL);
}

console.log('✅ Schema pushed successfully!');
process.exit(0);
