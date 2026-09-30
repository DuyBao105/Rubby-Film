import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export type Db = NeonHttpDatabase<typeof schema>;

function createDb(): Db {
  const rawUrl = process.env.DATABASE_URL?.replace(/^[\uFEFF\s]+|[\uFEFF\s]+$/g, "");
  const url = rawUrl || "postgresql://placeholder:placeholder@localhost:5432/placeholder";
  return drizzle(neon(url), { schema });
}

const g = globalThis as unknown as { __bfilm_db?: Db };
export const db: Db = g.__bfilm_db ?? (g.__bfilm_db = createDb());
