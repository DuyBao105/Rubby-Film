import fs from "fs";
import { neon } from "@neondatabase/serverless";

const env = fs.readFileSync(".env.local", "utf-8");
const line = env.split("\n").find((l) => l.startsWith("DATABASE_URL="));
const dbUrl = line ? line.slice(line.indexOf("=") + 1).trim().replace(/^['"]|['"]$/g, "") : null;

console.log("DB URL prefix:", dbUrl ? dbUrl.substring(0, 35) + "..." : "none");

async function run() {
  try {
    const sql = neon(dbUrl);
    const r = await sql`SELECT 1 as val`;
    console.log("DB connected successfully:", r);

    const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
    console.log("Tables:", tables.map(t => t.table_name));
  } catch (err) {
    console.error("DB connection error:", err);
  }
}

run();
