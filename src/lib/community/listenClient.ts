import postgres from "postgres";

const g = globalThis as unknown as { __bfilm_listen?: ReturnType<typeof postgres> };

export function getListenClient() {
  if (g.__bfilm_listen) return g.__bfilm_listen;
  const url = process.env.DATABASE_URL?.replace(/^[\uFEFF\s]+|[\uFEFF\s]+$/g, "");
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
