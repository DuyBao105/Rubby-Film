import postgres from "postgres";

const g = globalThis as unknown as { __bfilm_listen?: ReturnType<typeof postgres> };

const DEFAULT_DATABASE_URL =
  "postgresql://neondb_owner:npg_mROw7ziUQG5j@ep-aged-frost-az6ao807.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

export function getListenClient() {
  if (g.__bfilm_listen) return g.__bfilm_listen;
  const url = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
  if (!url) return null;
  try {
    g.__bfilm_listen = postgres(url, {
      max: 1, idle_timeout: 0, connect_timeout: 10,
      ssl: "require", fetch_types: false,
    });
    return g.__bfilm_listen;
  } catch (err) {
    console.warn("Postgres listen client failed to initialize:", err);
    return null;
  }
}
