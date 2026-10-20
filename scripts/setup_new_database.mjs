import { neon } from "@neondatabase/serverless";
import fs from "fs";
import path from "path";

const dbUrl = "postgresql://neondb_owner:npg_JaVWutY7gR3P@ep-delicate-sky-azi1a85g-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

async function run() {
  const sql = neon(dbUrl);
  console.log("Connecting to new database...");

  // 1. Run Drizzle migration 0000
  const migrationPath = path.resolve("db/migrations/0000_cultured_ben_parker.sql");
  const migrationSql = fs.readFileSync(migrationPath, "utf-8");

  const statements = migrationSql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);

  console.log(`Executing ${statements.length} migration statements from Drizzle...`);
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    try {
      await sql.query(stmt);
    } catch (err) {
      console.warn(`[stmt ${i + 1}] Notice:`, err.message || err);
    }
  }

  // 2. Create User Data tables for sync
  console.log("Creating user data tables...");

  await sql.query(`
    CREATE TABLE IF NOT EXISTS user_watch_history (
      id text PRIMARY KEY,
      user_id text NOT NULL,
      movie_id text NOT NULL,
      movie_slug text NOT NULL,
      movie_title text NOT NULL,
      poster_url text,
      backdrop_url text,
      episode_id text,
      episode_number integer,
      episode_name text,
      progress_seconds integer DEFAULT 0,
      duration_seconds integer DEFAULT 0,
      progress_percent integer DEFAULT 0,
      completed boolean DEFAULT false,
      watched_episodes jsonb DEFAULT '{}',
      movie_data jsonb,
      watched_at bigint NOT NULL,
      updated_at bigint NOT NULL,
      CONSTRAINT uwh_user_movie_unique UNIQUE (user_id, movie_id)
    );
  `);
  await sql.query(`CREATE INDEX IF NOT EXISTS uwh_user_updated_idx ON user_watch_history(user_id, updated_at DESC);`);

  await sql.query(`
    CREATE TABLE IF NOT EXISTS user_favorites (
      id text PRIMARY KEY,
      user_id text NOT NULL,
      movie_id text NOT NULL,
      movie_slug text NOT NULL,
      movie_data jsonb NOT NULL,
      created_at bigint NOT NULL,
      CONSTRAINT ufav_user_movie_unique UNIQUE (user_id, movie_id)
    );
  `);
  await sql.query(`CREATE INDEX IF NOT EXISTS ufav_user_created_idx ON user_favorites(user_id, created_at DESC);`);

  await sql.query(`
    CREATE TABLE IF NOT EXISTS user_search_history (
      user_id text PRIMARY KEY,
      searches jsonb NOT NULL,
      updated_at bigint NOT NULL
    );
  `);

  await sql.query(`
    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id text PRIMARY KEY,
      preferences jsonb NOT NULL,
      updated_at bigint NOT NULL
    );
  `);

  // Verify tables exist
  const tables = await sql.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);

  console.log("Database initialized successfully! Tables in public schema:");
  console.log(tables.map((t) => t.table_name));
}

run().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
