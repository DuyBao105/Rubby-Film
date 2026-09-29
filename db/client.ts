import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export type Db = NeonHttpDatabase<typeof schema>;

function createDb(): Db {
  const url = process.env.DATABASE_URL || "postgres://dummy:dummy@localhost:5432/dummy";
  return drizzle(neon(url), { schema });
}

const g = globalThis as unknown as { __bfilm_db?: Db };
export const db: Db = g.__bfilm_db ?? (g.__bfilm_db = createDb());
