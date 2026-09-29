import postgres from "postgres";

const g = globalThis as unknown as { __bfilm_listen?: ReturnType<typeof postgres> };

export function getListenClient() {
  if (g.__bfilm_listen) return g.__bfilm_listen;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  g.__bfilm_listen = postgres(url, {
    max: 1, idle_timeout: 0, connect_timeout: 10,
    ssl: "require", fetch_types: false,
  });
  return g.__bfilm_listen;
}
