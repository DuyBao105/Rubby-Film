const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_mROw7ziUQG5j@ep-aged-frost-az6ao807.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require');

async function main() {
  console.log('Creating analytics tables...');

  await sql.query(`
    CREATE TABLE IF NOT EXISTS analytics_active_sessions (
      session_id TEXT PRIMARY KEY,
      user_id TEXT,
      user_name TEXT,
      user_role TEXT,
      device TEXT NOT NULL DEFAULT 'desktop',
      page TEXT NOT NULL DEFAULT '/',
      title TEXT,
      first_seen BIGINT NOT NULL,
      last_seen BIGINT NOT NULL,
      page_views INT NOT NULL DEFAULT 1
    );
  `);

  await sql.query(`
    CREATE TABLE IF NOT EXISTS analytics_pageviews (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      user_id TEXT,
      user_name TEXT,
      user_role TEXT,
      device TEXT NOT NULL DEFAULT 'desktop',
      page TEXT NOT NULL DEFAULT '/',
      title TEXT,
      created_at BIGINT NOT NULL
    );
  `);

  await sql.query(`CREATE INDEX IF NOT EXISTS idx_analytics_sessions_last_seen ON analytics_active_sessions (last_seen);`);
  await sql.query(`CREATE INDEX IF NOT EXISTS idx_analytics_pv_created_at ON analytics_pageviews (created_at);`);

  console.log('Analytics tables created successfully!');
}

main().catch(console.error);
