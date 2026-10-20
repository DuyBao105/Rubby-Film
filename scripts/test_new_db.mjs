import { neon } from "@neondatabase/serverless";

const dbUrl = "postgresql://neondb_owner:npg_JaVWutY7gR3P@ep-delicate-sky-azi1a85g-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

async function test() {
  try {
    const sql = neon(dbUrl);
    const res = await sql`SELECT 1 as connected, NOW() as current_time`;
    console.log("SUCCESS:", JSON.stringify(res));
  } catch (err) {
    console.error("FAILED:", err);
  }
}

test();
