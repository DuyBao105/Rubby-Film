import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export type Db = NeonHttpDatabase<typeof schema>;

const DEFAULT_DATABASE_URL =
  "postgresql://neondb_owner:npg_mROw7ziUQG5j@ep-aged-frost-az6ao807.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

function createDb(): Db {
  const url = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
  return drizzle(neon(url), { schema });
}

const g = globalThis as unknown as { __bfilm_db?: Db };
export const db: Db = g.__bfilm_db ?? (g.__bfilm_db = createDb());
