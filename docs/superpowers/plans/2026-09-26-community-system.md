# Community System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add movie rating, threaded comments, likes, reports, spoiler tagging, SSE realtime and admin moderation to RUBBYFILM, while migrating auth from JSON files to Neon Postgres so the whole app works on Vercel.

**Architecture:** Neon Postgres (free tier) + Drizzle ORM for CRUD via `neon-http` driver; `postgres` (porsager) for a single long-lived `LISTEN` connection to fan Postgres `NOTIFY` events to in-flight SSE subscribers. Auth surface unchanged; service-layer RLS; 0d/month operating cost; zero breaking changes to existing callers.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript strict, Tailwind, Drizzle ORM, `@neondatabase/serverless`, `postgres`, `react-virtuoso`, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-26-community-system-design.md` (sections 4-24 are authoritative).

## Global Constraints

- All ids: `<slug>_<16-hex>` via `genId(prefix)` (spec section 4).
- Cookie names unchanged: `rubbyfilm_session`, `rubbyfilm_oauth_state`, `rubbyfilm_user_hint` (spec section 5).
- `authRepository` public method signatures + return shapes preserved exactly (spec section 5).
- Demo seed is the only seeded community-table content; no fake ratings/comments (spec section 14).
- Neon free tier only; `DATABASE_URL` is the sole new env var (spec section 19).
- Drizzle column names snake_case; TS property names camelCase via column mapping.
- All new code paths return `apiSuccess` / `apiError` via `src/lib/server/apiResponse.ts` (existing).
- Target Node >= 18; do not bump Next/React (already pinned).
- Vietnam-friendly UI text; cinema-950 dark palette only (existing tokens).
- Do NOT push to git (user confirmed pre-plan; push after manual verification).

## Review Focus (5 spec-implied failure modes needing pinned tests)

1. **Double-tap like race** - toggle, then immediately toggle again -> final state is "unliked" with 0 likes (no double-insert); UNIQUE(user_id,comment_id) is the guard. Pin in Task 9.
2. **Idempotent rating re-vote** - same user rates 4 then 3 -> single row, value 3, updated_at advanced, no created_at change; average recomputed. Pin in Task 7.
3. **Comment content XSS + control chars** - content with `<script>alert(1)</script>` and u0000 stored as-is, returned escaped on render (React), rejected only by length + control-char strip. Pin in Task 5.
4. **SSE reconnect duplication** - server replays buffered comment to a client that already has it -> client de-dupe by `comment.id`. Pin server behavior in Task 12, client de-dupe in Task 14.
5. **Guest hitting mutation endpoint** - POST `/api/community/comments` without session cookie returns 401 `{success:false,error:{code:"UNAUTHENTICATED"}}` (not 500). Pin in Task 10.

## File Inventory (spec section 20)

New: `db/schema.ts`, `db/client.ts`, `drizzle.config.ts`, `db/migrations/`, `scripts/seed.ts`, `scripts/import-legacy-json.ts`, `src/lib/community/{validators,ids,communityRepository,events,ratingService,commentService,likeService,reportService,getCurrentUser,rateLimiter}.ts`, API routes under `src/app/api/{community,users,admin/moderation}`, `src/app/admin/moderation/page.tsx`, `src/components/community/{rating,comments,profile}/*`, `src/hooks/use-community.ts`, `vitest.config.ts`, `tests/**`, `docs/COMMUNITY_SETUP.md`.

Modified: `src/components/movie/movie-detail.tsx`, `src/lib/auth/authService.ts`, `package.json`, `.env.example`.

Unchanged: every other page, every API route under `src/app/api/auth`, providers, layouts, hero, header, footer.
---

### Task 1: Install dependencies and Vitest scaffold

**Files:** Modify `package.json`. Create `vitest.config.ts`, `tests/community/validators.test.ts`, `src/lib/community/validators.ts`, `src/lib/community/ids.ts`.

**Interfaces (consumed by later tasks):**
- `genId(prefix: string): string` -> `${prefix}_${16-hex}`
- `validateRating(raw: unknown): number | null` (1..5 integer or null)
- `validateCommentContent(raw: unknown): string | null` (1..1000 chars, control stripped, trimmed)
- `REPORT_REASONS`, `ReportReason`, `validateReportReason`, `validateDescription`

- [ ] **Step 1: Install deps**

```bash
cd /c/Games/BFilm
npm install drizzle-orm @neondatabase/serverless postgres react-virtuoso
npm install -D drizzle-kit vitest tsx
```

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  test: { environment: "node", include: ["tests/**/*.test.ts", "src/**/*.test.ts"] },
});
```

- [ ] **Step 3: Add scripts to package.json**

Add to "scripts": `"test": "vitest run"`, `"test:watch": "vitest"`, `"db:generate": "drizzle-kit generate"`, `"db:migrate": "drizzle-kit migrate"`, `"db:studio": "drizzle-kit studio"`, `"db:seed": "tsx scripts/seed.ts"`, `"db:import-legacy": "tsx scripts/import-legacy-json.ts"`

- [ ] **Step 4: Write failing validators test**

Create `tests/community/validators.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validateRating, validateCommentContent, validateReportReason, validateDescription }
  from "@/lib/community/validators";

describe("validateRating", () => {
  it("accepts 1..5 integers", () => {
    for (const n of [1,2,3,4,5]) expect(validateRating(n)).toBe(n);
  });
  it("rejects 0,6,fractions,strings,null", () => {
    expect(validateRating(0)).toBeNull();
    expect(validateRating(6)).toBeNull();
    expect(validateRating(3.5)).toBeNull();
    expect(validateRating("4")).toBeNull();
    expect(validateRating(null)).toBeNull();
    expect(validateRating(undefined)).toBeNull();
  });
});

describe("validateCommentContent (Review Focus #3)", () => {
  it("trims and accepts 1..1000 chars", () => {
    expect(validateCommentContent("  hello  ")).toBe("hello");
    expect(validateCommentContent("x".repeat(1000))).toHaveLength(1000);
  });
  it("strips C0/C1 control chars except newline and tab", () => {
    expect(validateCommentContent("a\u0000b\u0007c\nd\te")).toBe("abc\nd\te");
  });
  it("rejects empty, too long, non-string", () => {
    expect(validateCommentContent("")).toBeNull();
    expect(validateCommentContent("   ")).toBeNull();
    expect(validateCommentContent("x".repeat(1001))).toBeNull();
    expect(validateCommentContent(123)).toBeNull();
  });
  it("preserves XSS payload", () => {
    const p = "<script>alert(1)</script>";
    expect(validateCommentContent(p)).toBe(p);
  });
});
```
Append remaining tests + impl:

```ts
describe("validateReportReason", () => {
  it("accepts only enum values", () => {
    for (const r of ["spam","abuse","harassment","inappropriate","spoiler","other"])
      expect(validateReportReason(r)).toBe(r);
    expect(validateReportReason("bogus")).toBeNull();
    expect(validateReportReason("")).toBeNull();
    expect(validateReportReason(null)).toBeNull();
  });
});

describe("validateDescription", () => {
  it("handles null/empty/trim/length/non-string", () => {
    expect(validateDescription(null)).toBe("");
    expect(validateDescription("")).toBe("");
    expect(validateDescription("  ok  ")).toBe("ok");
    expect(validateDescription("x".repeat(501))).toBeNull();
    expect(validateDescription(123)).toBeNull();
  });
});
```

Stub `src/lib/community/validators.ts` with `throw new Error("not implemented");`. Run: `npm test -- tests/community/validators.test.ts`. Expected: FAIL.

- [ ] **Step 5: Implement validators** in `src/lib/community/validators.ts`:

```ts
export function validateRating(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 5) return null;
  return n;
}
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
export function validateCommentContent(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.replace(CONTROL, "").trim();
  if (cleaned.length < 1 || cleaned.length > 1000) return null;
  return cleaned;
}
export const REPORT_REASONS = ["spam","abuse","harassment","inappropriate","spoiler","other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export function validateReportReason(raw: unknown): ReportReason | null {
  return typeof raw === "string" && (REPORT_REASONS as readonly string[]).includes(raw)
    ? (raw as ReportReason) : null;
}
export function validateDescription(raw: unknown): string | null {
  if (raw == null || raw === "") return "";
  if (typeof raw !== "string") return null;
  const cleaned = raw.trim();
  if (cleaned.length > 500) return null;
  return cleaned;
}
```

---

### Task 2: Drizzle schema, config, client, migration

**Files:** Create `db/schema.ts`, `drizzle.config.ts`, `db/client.ts`, `tests/db/schema-shape.test.ts`. Modify `.env.example`.

- [ ] **Step 1: Create `db/schema.ts` (part 1 — enums + users)**

```ts
import { sql } from "drizzle-orm";
import {
  pgTable, text, integer, boolean, timestamp, pgEnum,
  uniqueIndex, index, check,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["user","vip","admin"]);
export const authProvider = pgEnum("auth_provider", ["credentials","google","facebook"]);
export const reportReasonEnum = pgEnum("report_reason", ["spam","abuse","harassment","inappropriate","spoiler","other"]);
export const reportStatusEnum = pgEnum("report_status", ["open","reviewed","dismissed","actioned"]);

const tz = { withTimezone: true } as const;
const now = () => timestamp({ ...tz }).notNull().defaultNow();

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  salt: text("salt"),
  avatarUrl: text("avatar_url"),
  role: userRole("role").notNull().default("user"),
  createdAt: now(),
});
```

- [ ] **Step 1b: Append to `db/schema.ts` (part 2 — identities + sessions)**

```ts
export const authenticationIdentities = pgTable("authentication_identities", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: authProvider("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  email: text("email"),
  createdAt: now(),
  lastUsedAt: timestamp("last_used_at", tz),
}, (t) => [
  uniqueIndex("ident_provider_account_idx").on(t.provider, t.providerAccountId),
  index("ident_user_idx").on(t.userId),
]);

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  token: text("token").notNull().unique(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", tz).notNull(),
  createdAt: now(),
  lastSeenAt: now(),
}, (t) => [
  index("sess_user_idx").on(t.userId),
  index("sess_expires_idx").on(t.expiresAt),
]);
```

- [ ] **Step 1c: Append to `db/schema.ts` (part 3 — ratings + comments + likes + reports)**

```ts
export const movieRatings = pgTable("movie_ratings", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  movieId: text("movie_id").notNull(),
  movieSlug: text("movie_slug").notNull(),
  rating: integer("rating").notNull(),
  createdAt: now(),
  updatedAt: now(),
}, (t) => [
  uniqueIndex("rating_user_movie_idx").on(t.userId, t.movieId),
  index("rating_movie_idx").on(t.movieId),
  check("rating_range", sql`${t.rating} between 1 and 5`),
]);

export const comments = pgTable("comments", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  movieId: text("movie_id").notNull(),
  parentId: text("parent_id").references((): AnyPgColumn => comments.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  isSpoiler: boolean("is_spoiler").notNull().default(false),
  createdAt: now(),
  updatedAt: now(),
  deletedAt: timestamp("deleted_at", tz),
}, (t) => [
  index("cmt_movie_created_idx").on(t.movieId, t.createdAt),
  index("cmt_parent_idx").on(t.parentId),
  index("cmt_user_idx").on(t.userId),
  check("cmt_len", sql`char_length(${t.content}) between 1 and 1000`),
]);

export const commentLikes = pgTable("comment_likes", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  commentId: text("comment_id").notNull().references(() => comments.id, { onDelete: "cascade" }),
  createdAt: now(),
}, (t) => [
  uniqueIndex("like_user_comment_idx").on(t.userId, t.commentId),
  index("like_comment_idx").on(t.commentId),
]);

export const commentReports = pgTable("comment_reports", {
  id: text("id").primaryKey(),
  reporterUserId: text("reporter_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  commentId: text("comment_id").notNull().references(() => comments.id, { onDelete: "cascade" }),
  reason: reportReasonEnum("reason").notNull(),
  description: text("description"),
  status: reportStatusEnum("status").notNull().default("open"),
  createdAt: now(),
}, (t) => [
  uniqueIndex("rpt_reporter_comment_idx").on(t.reporterUserId, t.commentId),
  index("rpt_status_created_idx").on(t.status, t.createdAt),
  index("rpt_comment_idx").on(t.commentId),
]);
```

- [ ] **Step 2: Create `drizzle.config.ts`**

```ts
import "dotenv/config";
import { defineConfig } from "drizzle-kit";
export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  verbose: true,
  strict: true,
});
```

- [ ] **Step 3: Append DATABASE_URL to `.env.example`**

```
# community (Neon Postgres free tier)
DATABASE_URL="postgres://user:pass@host/db?sslmode=require"
```

- [ ] **Step 4: Create `db/client.ts`**

```ts
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

function createDb(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return drizzle(neon(url), { schema });
}

const g = globalThis as unknown as { __bfilm_db?: Db };
export const db: Db = g.__bfilm_db ?? (g.__bfilm_db = createDb());
export type { Db };
```

- [ ] **Step 5: Generate migration**

```bash
cd /c/Games/BFilm
DATABASE_URL="postgres://placeholder" npm run db:generate
```

Expected: creates `db/migrations/0000_<name>.sql`. Do NOT run `db:migrate` without a real Neon URL.

- [ ] **Step 6: Schema-shape test** — `tests/db/schema-shape.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { users, authenticationIdentities, sessions, movieRatings,
  comments, commentLikes, commentReports } from "../../db/schema";

describe("schema column names + unique indexes", () => {
  it("users maps camel->snake", () => {
    expect(users.passwordHash.name).toBe("password_hash");
    expect(users.createdAt.name).toBe("created_at");
  });
  it("self-FK on comments.parentId", () => {
    expect(comments.parentId?.name).toBe("parent_id");
  });
  it("unique indexes exist", () => {
    expect(uniqueIdxNames(movieRatings)).toContain("rating_user_movie_idx");
    expect(uniqueIdxNames(commentLikes)).toContain("like_user_comment_idx");
    expect(uniqueIdxNames(commentReports)).toContain("rpt_reporter_comment_idx");
    expect(uniqueIdxNames(authenticationIdentities)).toContain("ident_provider_account_idx");
  });
});
function uniqueIdxNames(t: any): string[] {
  return (t?.uniqueIndexes ?? []).map((u: any) => u?.name).filter(Boolean);
}
```

Run: `npm test -- tests/db/schema-shape.test.ts`. Expect PASS.

- [ ] **Step 7: Commit**

```bash
cd /c/Games/BFilm
git add db/schema.ts db/client.ts drizzle.config.ts .env.example db/migrations/ tests/db/schema-shape.test.ts
git commit -m "feat(db): drizzle schema for users, sessions, ratings, comments, likes, reports"
```

---

### Task 3: Seed + legacy import scripts

**Files:** Create `scripts/seed.ts`, `scripts/import-legacy-json.ts`, `tests/scripts/seed-idempotent.test.ts` (DB-gated, `describe.skipIf(!process.env.DATABASE_URL)`).

**Interfaces:**
- Demo user: id `usr_demo_rubbyfilm_001`, email `demo@rubbyfilm.vn`, password `Demo@123456`, role `vip`, avatar unsplash (current value).
- Admin user: id `usr_admin_rubbyfilm_001`, email `admin@rubbyfilm.vn`, password `Admin@123456`, role `admin`.

- [ ] **Step 1: Write `scripts/seed.ts`**

```ts
import "dotenv/config";
import crypto from "node:crypto";
import { db } from "../db/client";
import { users, authenticationIdentities } from "../db/schema";
import { genId } from "../src/lib/community/ids";

function hash(p: string, salt: string) { return crypto.scryptSync(p, salt, 64).toString("hex"); }

async function ensureUser(p: { id: string; email: string; name: string; password: string; role: "vip"|"admin"; avatar?: string }) {
  const email = p.email.toLowerCase();
  const existing = await db.query.users.findFirst({ where: (u, { eq }) => eq(u.email, email) });
  if (existing) return;
  const salt = crypto.randomBytes(16).toString("hex");
  await db.insert(users).values({
    id: p.id, name: p.name, email, role: p.role, avatarUrl: p.avatar,
    passwordHash: hash(p.password, salt), salt,
  });
  await db.insert(authenticationIdentities).values({
    id: genId("ident"), userId: p.id, provider: "credentials",
    providerAccountId: email, email, createdAt: new Date(),
  });
}

async function main() {
  await ensureUser({
    id: "usr_demo_rubbyfilm_001", email: "demo@rubbyfilm.vn",
    name: "Thành Viên VIP", password: "Demo@123456", role: "vip",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=faces",
  });
  await ensureUser({
    id: "usr_admin_rubbyfilm_001", email: "admin@rubbyfilm.vn",
    name: "Admin RubbyFilm", password: "Admin@123456", role: "admin",
  });
  console.log("seed ok");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Write `scripts/import-legacy-json.ts`**

```ts
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { db } from "../db/client";
import { users, authenticationIdentities, sessions } from "../db/schema";
import { genId } from "../src/lib/community/ids";

const DATA = path.join(process.cwd(), "data");

async function importUsers() {
  const file = path.join(DATA, "users.json");
  if (!fs.existsSync(file)) return 0;
  const list = JSON.parse(fs.readFileSync(file, "utf8"));
  let n = 0;
  for (const u of list) {
    const id = u.id ?? genId("usr");
    await db.insert(users).values({
      id, name: u.name, email: u.email.toLowerCase(), passwordHash: u.passwordHash,
      salt: u.salt, avatarUrl: u.avatarUrl, role: u.role ?? "user", createdAt: new Date(u.createdAt),
    }).onConflictDoNothing();
    for (const ident of u.identities ?? []) {
      await db.insert(authenticationIdentities).values({
        id: ident.id ?? genId("ident"), userId: id, provider: ident.provider,
        providerAccountId: ident.providerAccountId, email: ident.email,
        createdAt: new Date(ident.createdAt), lastUsedAt: ident.lastUsedAt ? new Date(ident.lastUsedAt) : null,
      }).onConflictDoNothing();
    }
    n++;
  }
  return n;
}

async function importSessions() {
  const file = path.join(DATA, "sessions.json");
  if (!fs.existsSync(file)) return 0;
  const list = JSON.parse(fs.readFileSync(file, "utf8"));
  let n = 0;
  for (const s of list) {
    if (s.expiresAt <= Date.now()) continue;
    await db.insert(sessions).values({
      id: genId("sess"), token: s.token, userId: s.user.id,
      expiresAt: new Date(s.expiresAt), createdAt: new Date(), lastSeenAt: new Date(),
    }).onConflictDoNothing();
    n++;
  }
  return n;
}

async function main() {
  const u = await importUsers();
  const s = await importSessions();
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  for (const f of ["users.json", "sessions.json"]) {
    const p = path.join(DATA, f);
    if (fs.existsSync(p)) fs.renameSync(p, path.join(DATA, `${f}.migrated-${ts}`));
  }
  console.log(`imported users=${u} sessions=${s}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: Write idempotency test** (skipped without DB)

`tests/scripts/seed-idempotent.test.ts`:
```ts
import { describe, it, expect } from "vitest";
const hasDb = !!process.env.DATABASE_URL;
(hasDb ? describe : describe.skip)("seed", () => {
  it("demo user exists after second run", async () => {
    const { db } = await import("../../db/client");
    const { users } = await import("../../db/schema");
    const u = await db.query.users.findFirst({ where: (t, { eq }) => eq(t.email, "demo@rubbyfilm.vn") });
    expect(u?.id).toBe("usr_demo_rubbyfilm_001");
  });
});
```
Run: `DATABASE_URL=... npm test -- tests/scripts/seed-idempotent.test.ts`. Expect PASS after `npm run db:seed`.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed.ts scripts/import-legacy-json.ts tests/scripts/seed-idempotent.test.ts
git commit -m "feat(scripts): seed demo+admin users and idempotent JSON->Postgres importer"
```

---

### Task 4: authRepository — JSON files -> Drizzle (preserved public surface)

**Files:**
- Modify: `src/lib/auth/authService.ts` (rewrite class internals; keep every public method name, params, and return shape; keep `AUTH_COOKIE_NAME`, `OAUTH_STATE_COOKIE_NAME`, `signOAuthState`, `verifyOAuthState` byte-identical)
- Modify: `src/lib/auth/authTypes.ts` (only if a `StoredUser`-shape type must be exported for API routes; prefer re-exporting as `UserRecord`)
- Test: `tests/auth/authRepository.test.ts` (DB-gated)

**Interfaces (unchanged, listed for verification):**
- `authRepository.findByEmail(email: string): Promise<UserRecord | null>`
- `findById(id): Promise<UserRecord | null>` — `UserRecord` = `{ id, name, email, passwordHash?, salt?, avatarUrl?, role, identities: AuthenticationIdentity[], createdAt: number }` (same shape as old `StoredUser`; `createdAt` stays epoch ms)
- `findByIdentity(provider, providerAccountId): Promise<UserRecord | null>`
- `createUser(input: RegisterInput): Promise<AuthUser>` — throws Vietnamese duplicate-email error (same message)
- `findOrCreateFromOAuth(profile: OAuthProfile): Promise<AuthUser>` (link-by-email logic preserved)
- `unlinkProvider(userId, provider): Promise<AuthUser>` (single-login-method guard preserved)
- `updateUserProfile(userId, updates): Promise<AuthUser>`
- `resetPassword(email, newPassword): Promise<AuthUser>` (adds credentials identity if missing, same errors)
- `verifyPassword(user: UserRecord, passwordAttempt: string): boolean` (timingSafeEqual preserved)
- `createSession(user: AuthUser): Promise<AuthSession>` (token mint identical; now also INSERTs row)
- `getSession(token: string): Promise<AuthSession | null>` (HMAC verify THEN session-row lookup; no row -> null i.e. revoked)
- `deleteSession(token: string): Promise<void>` (DELETE row)
- `getSafeUser(record: UserRecord): AuthUser`

**Removals:** `fs`/`path` imports, `loadFromDisk`, `saveUsersToDisk`, `saveSessionsToDisk`, `createInitialDemoUser`, demo-user-on-load.

- [ ] **Step 1: Write DB-gated failing test**

`tests/auth/authRepository.test.ts`:
```ts
import { describe, it, expect, beforeAll } from "vitest";
const hasDb = !!process.env.DATABASE_URL;
(hasDb ? describe : describe.skip)("authRepository", () => {
  let repo: typeof import("@/lib/auth/authService").authRepository;
  beforeAll(async () => {
    ({ authRepository: repo } = await import("@/lib/auth/authService"));
  });
  it("createUser + findByEmail + verifyPassword roundtrip", async () => {
    const email = `t_${Date.now()}@x.vn`;
    const u = await repo.createUser({ name: "T", email, password: "Secret@123" });
    expect(u.email).toBe(email);
    const rec = await repo.findByEmail(email);
    expect(rec?.passwordHash).toBeTruthy();
    expect(repo.verifyPassword(rec!, "Secret@123")).toBe(true);
    expect(repo.verifyPassword(rec!, "wrong")).toBe(false);
  });
  it("createSession -> getSession -> deleteSession", async () => {
    const email = `s_${Date.now()}@x.vn`;
    const u = await repo.createUser({ name: "S", email, password: "Secret@123" });
    const s = await repo.createSession(u);
    const got = await repo.getSession(s.token);
    expect(got?.user.id).toBe(u.id);
    await repo.deleteSession(s.token);
    expect(await repo.getSession(s.token)).toBeNull();
  });
  it("duplicate email throws Vietnamese error", async () => {
    const email = `d_${Date.now()}@x.vn`;
    await repo.createUser({ name: "D", email, password: "Secret@123" });
    await expect(repo.createUser({ name: "D2", email, password: "Secret@123" }))
      .rejects.toThrow("Email này đã được sử dụng");
  });
});
```
Run: `npm test -- tests/auth/authRepository.test.ts`. Expected: FAIL (writes to JSON still pass but sessions survive delete — actually verify: old code `deleteSession` only clears Map+file; `getSession` falls back to stateless HMAC → non-null. So the revoked-session assertion FAILS on old code. Good failing signal).

- [ ] **Step 2: Rewrite internals**

Replace the `AuthRepository` class body in `src/lib/auth/authService.ts`. Keep crypto/session-mint code as-is. New internals:

```ts
import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { users, authenticationIdentities, sessions } from "@/db/schema";
import { genId } from "@/lib/community/ids";

// UserRecord keeps the old StoredUser shape (epoch-ms createdAt, identities array)
interface UserRecord {
  id: string; name: string; email: string;
  passwordHash?: string; salt?: string; avatarUrl?: string;
  role: "user" | "vip" | "admin";
  identities: AuthenticationIdentity[];
  createdAt: number;
}

async function rowToRecord(userId: string): Promise<UserRecord | null> {
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!u) return null;
  const idents = await db.select().from(authenticationIdentities)
    .where(eq(authenticationIdentities.userId, userId));
  return {
    id: u.id, name: u.name, email: u.email,
    passwordHash: u.passwordHash ?? undefined, salt: u.salt ?? undefined,
    avatarUrl: u.avatarUrl ?? undefined, role: u.role,
    identities: idents.map((i) => ({
      id: i.id, userId: i.userId, provider: i.provider,
      providerAccountId: i.providerAccountId, email: i.email ?? undefined,
      createdAt: i.createdAt.getTime(), lastUsedAt: i.lastUsedAt?.getTime(),
    })),
    createdAt: u.createdAt.getTime(),
  };
}

class AuthRepository {
  public async findByEmail(email: string): Promise<UserRecord | null> {
    const [u] = await db.select().from(users)
      .where(eq(users.email, email.toLowerCase().trim())).limit(1);
    return u ? rowToRecord(u.id) : null;
  }
  public async findById(id: string): Promise<UserRecord | null> { return rowToRecord(id); }
  public async findByIdentity(provider: AuthProvider, providerAccountId: string): Promise<UserRecord | null> {
    const [i] = await db.select().from(authenticationIdentities)
      .where(and(eq(authenticationIdentities.provider, provider),
                 eq(authenticationIdentities.providerAccountId, providerAccountId))).limit(1);
    return i ? rowToRecord(i.userId) : null;
  }
  // ... createUser / findOrCreateFromOAuth / unlinkProvider / updateUserProfile /
  //     resetPassword / verifyPassword / createSession / getSession / deleteSession / getSafeUser
}
```

Method bodies map 1:1 to the old logic (see current `src/lib/auth/authService.ts:189-499`):
- `createUser`: duplicate check via `findByEmail`, INSERT user + INSERT credentials identity, return `toSafeUser`.
- `findOrCreateFromOAuth`: same 3-step flow (identity -> email-link -> create) using the three finders above.
- `unlinkProvider`: count login methods from `record.identities` + passwordHash; single-method guard throws the same Vietnamese message; DELETE identity row.
- `updateUserProfile`: UPDATE users SET name/avatarUrl; sessions read fresh user on `getSession` so no session mutation needed.
- `resetPassword`: same validations + messages; UPDATE users; INSERT credentials identity if missing.
- `createSession`: keep token mint; INSERT session row (id `genId("sess")`, token, userId, expiresAt `new Date(expiresAt)`).
- `getSession`: (1) HMAC-verify token (same code); (2) parse payload; (3) `SELECT 1 FROM sessions WHERE token=$1 AND expires_at>now()` — missing row -> return null (revoked); (4) refresh user via `rowToRecord` -> `toSafeUser`; (5) UPDATE lastSeenAt.
- `deleteSession`: DELETE row.
- `getSafeUser`/`toSafeUser`: unchanged mapping logic.

Keep the globalThis singleton guard exactly as-is (`__rubbyfilm_auth_repo`).

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`. Expected: no errors (callers in `src/app/api/auth/*` use only the public surface).

- [ ] **Step 4: Run auth tests**

Run: `npm test -- tests/auth/authRepository.test.ts`. Expected: PASS (with DATABASE_URL set) / SKIP (without).

- [ ] **Step 5: Manual dev-server smoke**

```bash
cd /c/Games/BFilm
DATABASE_URL=<neon-url> npm run dev
# register a user, login, logout, /api/auth/me still works
```
Expected: register/login/logout/me all work; `data/users.json` no longer written.

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth/authService.ts src/lib/auth/authTypes.ts tests/auth/authRepository.test.ts
git commit -m "feat(auth): persist users+sessions to Postgres via Drizzle (Vercel-compatible, surface preserved)"
```

---

### Task 5: getCurrentUser + community rateLimiter

**Files:**
- Create: `src/lib/community/getCurrentUser.ts`
- Create: `tests/community/getCurrentUser.test.ts`
- (Reuse existing `src/lib/server/rateLimiter.ts` `checkRateLimit(identifier, limit, windowSeconds)` directly. No new file needed; per-route limit constants live in this task's tests + `src/lib/community/rateLimiterConfig.ts` if any non-default limits are needed. Skip creation otherwise.)

**Interfaces:**
- `getCurrentUser(): Promise<AuthUser | null>` — server-side, reads `rubbyfilm_session` cookie via `cookies()` from `next/headers`, calls `authService.authRepository.getSession(token)`, returns user or null. Throws nothing.
- `requireAdmin(): Promise<AuthUser>` — server-side, calls `getCurrentUser`, throws when null or role !== "admin"; route handlers catch and return `apiError("FORBIDDEN"|"UNAUTHENTICATED")` via `handleRouteError`.

- [ ] **Step 1: Write failing test**

`tests/community/getCurrentUser.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));
vi.mock("@/lib/auth/authService", () => ({
  authRepository: { getSession: vi.fn() },
}));

import { cookies } from "next/headers";
import { authRepository } from "@/lib/auth/authService";
import { getCurrentUser, requireAdmin } from "@/lib/community/getCurrentUser";

const mockedCookies = vi.mocked(cookies);
const mockedGetSession = vi.mocked(authRepository.getSession);

describe("getCurrentUser", () => {
  it("returns null when no cookie", async () => {
    mockedCookies.mockReturnValue({ get: () => undefined } as any);
    expect(await getCurrentUser()).toBeNull();
    expect(mockedGetSession).not.toHaveBeenCalled();
  });
  it("returns null when getSession returns null", async () => {
    mockedCookies.mockReturnValue({ get: () => ({ value: "x" }) } as any);
    mockedGetSession.mockResolvedValue(null);
    expect(await getCurrentUser()).toBeNull();
  });
  it("returns user on valid session", async () => {
    mockedCookies.mockReturnValue({ get: () => ({ value: "tok" }) } as any);
    mockedGetSession.mockResolvedValue({ token: "tok", expiresAt: 0, user: { id: "u1", name: "X", email: "x@x.vn", role: "user", providers: [], identities: [], createdAt: 0 } });
    const u = await getCurrentUser();
    expect(u?.id).toBe("u1");
  });
});

describe("requireAdmin", () => {
  it("throws when user null", async () => {
    mockedCookies.mockReturnValue({ get: () => undefined } as any);
    await expect(requireAdmin()).rejects.toThrow("UNAUTHENTICATED");
  });
  it("throws when user not admin", async () => {
    mockedCookies.mockReturnValue({ get: () => ({ value: "tok" }) } as any);
    mockedGetSession.mockResolvedValue({ token: "tok", expiresAt: 0, user: { id: "u1", name: "X", email: "x@x.vn", role: "user", providers: [], identities: [], createdAt: 0 } });
    await expect(requireAdmin()).rejects.toThrow("FORBIDDEN");
  });
  it("returns admin user", async () => {
    mockedCookies.mockReturnValue({ get: () => ({ value: "tok" }) } as any);
    mockedGetSession.mockResolvedValue({ token: "tok", expiresAt: 0, user: { id: "a1", name: "A", email: "a@x.vn", role: "admin", providers: [], identities: [], createdAt: 0 } });
    const u = await requireAdmin();
    expect(u.role).toBe("admin");
  });
});
```
Run: `npm test -- tests/community/getCurrentUser.test.ts`. Expected: FAIL (module not implemented).

- [ ] **Step 2: Implement**

`src/lib/community/getCurrentUser.ts`:
```ts
import { cookies } from "next/headers";
import { authRepository } from "@/lib/auth/authService";
import type { AuthUser } from "@/lib/auth/authTypes";
export const AUTH_COOKIE_NAME = "rubbyfilm_session";

export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  const s = await authRepository.getSession(token);
  return s?.user ?? null;
}

export class HttpError extends Error {
  constructor(public code: "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "BAD_REQUEST" | "RATE_LIMITED", message?: string) { super(message ?? code); }
}
export async function requireAdmin(): Promise<AuthUser> {
  const u = await getCurrentUser();
  if (!u) throw new HttpError("UNAUTHENTICATED");
  if (u.role !== "admin") throw new HttpError("FORBIDDEN");
  return u;
}
```

- [ ] **Step 3: Re-run tests** — expect PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/community/getCurrentUser.ts tests/community/getCurrentUser.test.ts
git commit -m "feat(community): server-side getCurrentUser + requireAdmin helper"
```

---

### Task 6: communityRepository — pg_notify + EventEmitter

**Files:** Create `src/lib/community/communityRepository.ts`, `src/lib/community/events.ts`, `src/lib/community/listenClient.ts`, `tests/community/communityRepository.test.ts`.

**Interfaces:**
- `type CommunityEventType = "rating_upserted" | "rating_deleted" | "comment_created" | "comment_updated" | "comment_deleted" | "like_changed" | "report_created"`
- `interface CommunityEvent { type: CommunityEventType; movieId: string; payload: unknown; at: number }`
- `communityRepository.notify(movieId: string, type: CommunityEventType, payload: unknown): Promise<void>` — emits in-process + calls `postgres_notify('channel_movie_<id>', JSON.stringify(event))`.
- `communityRepository.subscribe(movieId: string, handler: (e: CommunityEvent) => void): () => void` — refcounted; increments listener for movieId; returns unsubscribe (refcount down → if 0, UNLISTEN).
- `getListenClient(): ReturnType<typeof postgres>` — globalThis singleton via porsager `postgres(url, { max: 1, ssl: "require" })` so LISTEN is isolated from the HTTP-query pool.

- [ ] **Step 1: `src/lib/community/events.ts`**

```ts
export type CommunityEventType =
  | "rating_upserted" | "rating_deleted"
  | "comment_created" | "comment_updated" | "comment_deleted"
  | "like_changed" | "report_created";

export interface CommunityEvent {
  type: CommunityEventType;
  movieId: string;
  payload: unknown;
  at: number;
}

export function channelFor(movieId: string): string {
  return `channel_movie_${movieId}`;
}
```

- [ ] **Step 2: `src/lib/community/listenClient.ts`**

```ts
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
```

- [ ] **Step 3: Write failing tests**

`tests/community/communityRepository.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
const hasDb = !!process.env.DATABASE_URL;

(hasDb ? describe : describe.skip)("communityRepository.subscribe", () => {
  it("local fan-out works without DB", async () => {
    const { communityRepository } = await import("@/lib/community/communityRepository");
    const got: any[] = [];
    const off = communityRepository.subscribe("m1", (e) => got.push(e));
    await communityRepository.notify("m1", "comment_created", { id: "x" });
    expect(got).toHaveLength(1);
    expect(got[0].type).toBe("comment_created");
    off();
  });
  it("DB round-trip: notify -> subscribe receives after relisten", async () => {
    const { communityRepository } = await import("@/lib/community/communityRepository");
    const got: any[] = [];
    const off = communityRepository.subscribe("m2", (e) => got.push(e));
    await new Promise((r) => setTimeout(r, 100));
    await communityRepository.notify("m2", "rating_upserted", { v: 5 });
    await new Promise((r) => setTimeout(r, 300));
    expect(got.find((g) => g.payload?.v === 5)).toBeTruthy();
    off();
  });
});
```
Run: `DATABASE_URL=... npm test -- tests/community/communityRepository.test.ts`. Expected: FAIL.

- [ ] **Step 4: Implement `communityRepository.ts`**

```ts
import { EventEmitter } from "node:events";
import { getListenClient } from "./listenClient";
import { channelFor, type CommunityEvent, type CommunityEventType } from "./events";

interface State {
  emitter: EventEmitter;
  refs: Map<string, number>; // movieId -> listener count
  subscribed: Set<string>;
}
const g = globalThis as unknown as { __bfilm_commRepo?: State };

function ensureState(): State {
  if (g.__bfilm_commRepo) return g.__bfilm_commRepo;
  const s: State = { emitter: new EventEmitter(), refs: new Map(), subscribed: new Set() };
  s.emitter.setMaxListeners(0);
  g.__bfilm_commRepo = s;
  return s;
}

async function ensureSubscribed(movieId: string) {
  const s = ensureState();
  const channel = channelFor(movieId);
  if (s.subscribed.has(channel)) return;
  const sql = getListenClient();
  await sql.listen(channel, (payload) => {
    try {
      const ev = JSON.parse(payload as string) as CommunityEvent;
      if (ev.movieId === movieId) s.emitter.emit(channelFor(movieId), ev);
    } catch {}
  });
  s.subscribed.add(channel);
}

export const communityRepository = {
  async notify(movieId: string, type: CommunityEventType, payload: unknown): Promise<void> {
    const event: CommunityEvent = { type, movieId, payload, at: Date.now() };
    const s = ensureState();
    s.emitter.emit(channelFor(movieId), event);
    if (process.env.DATABASE_URL) {
      try {
        const sql = getListenClient();
        await sql.notify(channelFor(movieId), JSON.stringify(event));
      } catch (e) { /* notify fire-and-forget */ }
    }
  },
  async subscribe(movieId: string, handler: (e: CommunityEvent) => void): Promise<() => void> {
    const s = ensureState();
    const channel = channelFor(movieId);
    s.refs.set(movieId, (s.refs.get(movieId) ?? 0) + 1);
    s.emitter.on(channel, handler);
    if (process.env.DATABASE_URL) await ensureSubscribed(movieId);
    return () => {
      s.emitter.off(channel, handler);
      const next = (s.refs.get(movieId) ?? 1) - 1;
      if (next <= 0) {
        s.refs.delete(movieId);
        // porsager has no explicit UNLISTEN; the channel is permanent but listener count guards it.
      } else s.refs.set(movieId, next);
    };
  },
};
```

- [ ] **Step 5: Run tests** — expect PASS (with DB) / SKIP (without).

- [ ] **Step 6: Commit**

```bash
git add src/lib/community/events.ts src/lib/community/listenClient.ts src/lib/community/communityRepository.ts tests/community/communityRepository.test.ts
git commit -m "feat(community): porsager LISTEN/NOTIFY wrapper + in-process EventEmitter"
```

---

### Task 7: ratingService

**Files:** Create `src/lib/community/ratingService.ts`, `tests/community/ratingService.test.ts` (DB-gated, Review Focus #2).

**Interfaces:**
- `ratingService.upsert({ userId, movieId, movieSlug, rating }) -> { average: number; count: number; distribution: Record<1|2|3|4|5, number>; viewerRating: number }`
- `getStats(movieId)` -> same shape (viewerRating null)
- `getViewerRating(movieId, userId)` -> `number | null`
- `delete(userId, movieId)` -> void

- [ ] **Step 1: Failing test (Review Focus #2)**

`tests/community/ratingService.test.ts`:
```ts
const hasDb = !!process.env.DATABASE_URL;
(hasDb ? describe : describe.skip)("ratingService", () => {
  it("upsert idempotent + re-vote updates in place (Review Focus #2)", async () => {
    const { ratingService } = await import("@/lib/community/ratingService");
    const { db } = await import("@/db/client");
    const { users } = await import("@/db/schema");
    const email = `r_${Date.now()}@x.vn`;
    await db.insert(users).values({ id: "usr_" + email, name: "R", email }).onConflictDoNothing();
    const { genId } = await import("@/lib/community/ids");
    const id = genId("usr");
    await db.insert(users).values({ id, name: "R", email, role: "user" }).onConflictDoNothing();
    const r1 = await ratingService.upsert({ userId: id, movieId: "mX", movieSlug: "x", rating: 4 });
    const before = await db.query.movieRatings.findFirst({ where: (t, { and, eq }) => and(eq(t.userId, id), eq(t.movieId, "mX")) });
    expect(r1.viewerRating).toBe(4);
    expect(before?.rating).toBe(4);
    await new Promise(r => setTimeout(r, 10));
    const r2 = await ratingService.upsert({ userId: id, movieId: "mX", movieSlug: "x", rating: 3 });
    expect(r2.viewerRating).toBe(3);
    const after = await db.query.movieRatings.findFirst({ where: (t, { and, eq }) => and(eq(t.userId, id), eq(t.movieId, "mX")) });
    expect(after?.rating).toBe(3);
    expect(after?.id).toBe(before?.id); // same row
    expect(after!.updatedAt.getTime()).toBeGreaterThan(before!.updatedAt.getTime());
  });
});
```
Run: `DATABASE_URL=... npm test -- tests/community/ratingService.test.ts`. Expected: FAIL.

- [ ] **Step 2: Implement**

`src/lib/community/ratingService.ts`:
```ts
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { movieRatings } from "@/db/schema";
import { genId } from "./ids";
import { communityRepository } from "./communityRepository";
import { validateRating } from "./validators";

export interface RatingStats {
  average: number; count: number; distribution: Record<1|2|3|4|5, number>;
  viewerRating: number | null;
}
function emptyDist(): Record<1|2|3|4|5, number> { return { 1:0, 2:0, 3:0, 4:0, 5:0 }; }

export const ratingService = {
  async upsert(input: { userId: string; movieId: string; movieSlug: string; rating: number }): Promise<RatingStats> {
    const r = validateRating(input.rating);
    if (r == null) throw Object.assign(new Error("Invalid rating"), { code: "BAD_REQUEST" });
    const existing = await db.select({ id: movieRatings.id, createdAt: movieRatings.createdAt })
      .from(movieRatings).where(and(eq(movieRatings.userId, input.userId), eq(movieRatings.movieId, input.movieId))).limit(1);
    if (existing.length) {
      await db.update(movieRatings).set({ rating: r, updatedAt: new Date() }).where(eq(movieRatings.id, existing[0].id));
    } else {
      await db.insert(movieRatings).values({
        id: genId("rate"), userId: input.userId, movieId: input.movieId, movieSlug: input.movieSlug, rating: r,
      });
    }
    const stats = await this.getStats(input.movieId, input.userId);
    await communityRepository.notify(input.movieId, "rating_upserted", { movieId: input.movieId });
    return stats;
  },
  async getStats(movieId: string, viewerId?: string | null): Promise<RatingStats> {
    const rows = await db.select({ rating: movieRatings.rating })
      .from(movieRatings).where(eq(movieRatings.movieId, movieId));
    const dist = emptyDist();
    let sum = 0;
    for (const r of rows) { sum += r.rating; dist[r.rating as 1|2|3|4|5]++; }
    const viewerRating = viewerId
      ? (await db.select({ rating: movieRatings.rating }).from(movieRatings)
          .where(and(eq(movieRatings.movieId, movieId), eq(movieRatings.userId, viewerId))).limit(1))[0]?.rating ?? null
      : null;
    return { average: rows.length ? sum / rows.length : 0, count: rows.length, distribution: dist, viewerRating: viewerRating as any };
  },
  async getViewerRating(movieId: string, userId: string) {
    const [r] = await db.select({ rating: movieRatings.rating }).from(movieRatings)
      .where(and(eq(movieRatings.movieId, movieId), eq(movieRatings.userId, userId))).limit(1);
    return r?.rating ?? null;
  },
  async delete(userId: string, movieId: string) {
    await db.delete(movieRatings)
      .where(and(eq(movieRatings.userId, userId), eq(movieRatings.movieId, movieId)));
    await communityRepository.notify(movieId, "rating_deleted", { movieId, userId });
  },
};
```

- [ ] **Step 3: Run + commit**

```bash
DATABASE_URL=... npm test -- tests/community/ratingService.test.ts
git add src/lib/community/ratingService.ts tests/community/ratingService.test.ts
git commit -m "feat(community): ratingService with idempotent upsert + aggregation (review focus #2 pinned)"
```

---

### Task 8: commentService

**Files:** Create `src/lib/community/commentService.ts`, `tests/community/commentService.test.ts`.

**Interfaces:**
- `list({ movieId, sort, page, limit, viewerId? }) -> { items: CommentView[]; total: number; page: number; limit: number; totalPages: number }` — top-level only at top; each `CommentView` includes `replies` array (one level). Sort: newest|oldest|top.
- `create({ userId, movieId, parentId?, content, isSpoiler }) -> CommentView`
- `edit({ commentId, userId, isAdmin, content }) -> CommentView`
- `delete({ commentId, userId, isAdmin }) -> void` — soft if has replies or reports; else hard; cascades kept by FK.

**Depth cap:** parent must have `parentId == null` OR a parent whose `parentId == null`. Reject deeper with "MAX_DEPTH" code.

- [ ] **Step 1: Failing tests** (Review Focus #3 + invariants)

`tests/community/commentService.test.ts`:
```ts
const hasDb = !!process.env.DATABASE_URL;
(hasDb ? describe : describe.skip)("commentService", () => {
  async function newUser(suffix: string) {
    const { db } = await import("@/db/client");
    const { users, authenticationIdentities } = await import("@/db/schema");
    const { genId } = await import("@/lib/community/ids");
    const id = genId("usr");
    const email = `c_${suffix}_${Date.now()}@x.vn`;
    await db.insert(users).values({ id, name: suffix, email, role: "user" });
    await db.insert(authenticationIdentities).values({
      id: genId("ident"), userId: id, provider: "credentials",
      providerAccountId: email, email, createdAt: new Date(),
    });
    return id;
  }
  it("preserves XSS payload exactly (Review Focus #3)", async () => {
    const { commentService } = await import("@/lib/community/commentService");
    const u = await newUser("xss");
    const c = await commentService.create({ userId: u, movieId: "mX", content: "<script>alert(1)</script>", isSpoiler: false });
    expect(c.content).toBe("<script>alert(1)</script>");
  });
  it("rejects depth 3", async () => {
    const { commentService } = await import("@/lib/community/commentService");
    const u = await newUser("d");
    const lvl1 = await commentService.create({ userId: u, movieId: "mD", content: "A", isSpoiler: false });
    const lvl2 = await commentService.create({ userId: u, movieId: "mD", parentId: lvl1.id, content: "B", isSpoiler: false });
    await expect(commentService.create({ userId: u, movieId: "mD", parentId: lvl2.id, content: "C", isSpoiler: false }))
      .rejects.toThrow("MAX_DEPTH");
  });
  it("edit preserves isSpoiler", async () => {
    const { commentService } = await import("@/lib/community/commentService");
    const u = await newUser("s");
    const c = await commentService.create({ userId: u, movieId: "mS", content: "spoiler time", isSpoiler: true });
    const e = await commentService.edit({ commentId: c.id, userId: u, isAdmin: false, content: "updated" });
    expect(e.isSpoiler).toBe(true);
  });
});
```
Run: `DATABASE_URL=... npm test -- tests/community/commentService.test.ts`. Expected: FAIL.

- [ ] **Step 2: Implement** — full content in repo. Stub:

```ts
// src/lib/community/commentService.ts
import { eq, and, desc, asc, sql, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { comments, users, commentLikes, commentReports } from "@/db/schema";
import { genId } from "./ids";
import { validateCommentContent } from "./validators";
import { communityRepository } from "./communityRepository";

export interface CommentView {
  id: string; movieId: string; parentId: string | null;
  content: string; isSpoiler: boolean;
  createdAt: number; updatedAt: number; deletedAt: number | null;
  author: { id: string; name: string; avatarUrl?: string; role: "user"|"vip"|"admin" };
  likeCount: number; likedByViewer: boolean;
  replies?: CommentView[];
}
export const MAX_DEPTH = 2;

async function rowToView(row: any, viewerId?: string | null): Promise<CommentView> {
  const [likeCountRow] = await db.select({ c: sql<number>`count(*)::int` }).from(commentLikes).where(eq(commentLikes.commentId, row.id));
  const liked = viewerId
    ? (await db.select({ x: sql<number>`1` }).from(commentLikes)
        .where(and(eq(commentLikes.commentId, row.id), eq(commentLikes.userId, viewerId))).limit(1)).length > 0
    : false;
  return {
    id: row.id, movieId: row.movieId, parentId: row.parentId, content: row.content,
    isSpoiler: row.isSpoiler,
    createdAt: row.createdAt.getTime(), updatedAt: row.updatedAt.getTime(),
    deletedAt: row.deletedAt?.getTime() ?? null,
    author: { id: row.user_id ?? row.userId, name: row.user_name ?? row.userName, avatarUrl: row.avatar ?? row.userAvatar, role: row.user_role ?? row.userRole },
    likeCount: likeCountRow?.c ?? 0, likedByViewer: liked,
  };
}

export const commentService = {
  async list(opts: { movieId: string; sort: "newest"|"oldest"|"top"; page?: number; limit?: number; viewerId?: string | null }) {
    const { movieId, sort, page = 1, limit = 20, viewerId = null } = opts;
    const orderBy = sort === "oldest" ? asc(comments.createdAt)
      : sort === "top" ? sql`like_count desc, ${comments.createdAt} desc`
      : desc(comments.createdAt);
    const baseRows = await db.select({
      c: comments, u: users, likeCount: sql<number>`(select count(*)::int from comment_likes where comment_id = ${comments.id})`.as("like_count"),
    })
      .from(comments).leftJoin(users, eq(comments.userId, users.id))
      .where(and(eq(comments.movieId, movieId), isNull(comments.parentId), isNull(comments.deletedAt)))
      .orderBy(orderBy).limit(limit).offset((page - 1) * limit);

    const total = (await db.select({ c: sql<number>`count(*)::int` }).from(comments)
      .where(and(eq(comments.movieId, movieId), isNull(comments.parentId), isNull(comments.deletedAt))))[0].c;

    const items: CommentView[] = [];
    for (const r of baseRows) {
      const view = await rowToView({ ...r.c, ...r.u, like_count: r.likeCount }, viewerId);
      const replyRows = await db.select({ c: comments, u: users, likeCount: sql<number>`(select count(*)::int from comment_likes where comment_id = ${comments.id})` })
        .from(comments).leftJoin(users, eq(comments.userId, users.id))
        .where(and(eq(comments.parentId, r.c.id), isNull(comments.deletedAt)))
        .orderBy(asc(comments.createdAt));
      view.replies = [];
      for (const rr of replyRows) view.replies.push(await rowToView({ ...rr.c, ...rr.u, like_count: rr.likeCount }, viewerId));
      items.push(view);
    }
    return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
  },
  async create(input: { userId: string; movieId: string; parentId?: string|null; content: string; isSpoiler: boolean }) {
    const clean = validateCommentContent(input.content);
    if (clean == null) throw Object.assign(new Error("Invalid content"), { code: "BAD_REQUEST" });
    if (input.parentId) {
      const [p] = await db.select().from(comments).where(eq(comments.id, input.parentId)).limit(1);
      if (!p) throw new Error("NOT_FOUND");
      if (p.parentId !== null) {
        // Reject creating under a non-top-level. We can only reply to top-level (depth 2 cap).
        throw Object.assign(new Error("MAX_DEPTH"), { code: "MAX_DEPTH" });
      }
    }
    const id = genId("cmt");
    const [row] = await db.insert(comments).values({
      id, userId: input.userId, movieId: input.movieId,
      parentId: input.parentId ?? null, content: clean, isSpoiler: input.isSpoiler,
    }).returning();
    await communityRepository.notify(input.movieId, "comment_created", { id });
    return rowToView(row, input.userId);
  },
  async edit(input: { commentId: string; userId: string; isAdmin: boolean; content: string }) {
    const clean = validateCommentContent(input.content);
    if (clean == null) throw Object.assign(new Error("Invalid content"), { code: "BAD_REQUEST" });
    const [c] = await db.select().from(comments).where(eq(comments.id, input.commentId)).limit(1);
    if (!c) throw new Error("NOT_FOUND");
    if (!input.isAdmin && c.userId !== input.userId) throw Object.assign(new Error("FORBIDDEN"), { code: "FORBIDDEN" });
    await db.update(comments).set({ content: clean, updatedAt: new Date() }).where(eq(comments.id, input.commentId));
    await communityRepository.notify(c.movieId, "comment_updated", { id: input.commentId });
    return rowToView({ ...c, content: clean, updatedAt: new Date() }, input.userId);
  },
  async delete(input: { commentId: string; userId: string; isAdmin: boolean }) {
    const [c] = await db.select().from(comments).where(eq(comments.id, input.commentId)).limit(1);
    if (!c) throw new Error("NOT_FOUND");
    if (!input.isAdmin && c.userId !== input.userId) throw Object.assign(new Error("FORBIDDEN"), { code: "FORBIDDEN" });
    // Soft delete if has replies or reports
    const [rep] = await db.select({ c: sql<number>`count(*)::int` }).from(comments)
      .where(and(eq(comments.parentId, input.commentId), isNull(comments.deletedAt)));
    const [rpt] = await db.select({ c: sql<number>`count(*)::int` }).from(commentReports).where(eq(commentReports.commentId, input.commentId));
    const hasRel = (rep?.c ?? 0) > 0 || (rpt?.c ?? 0) > 0;
    if (hasRel) {
      await db.update(comments).set({ deletedAt: new Date(), content: "[removed]" }).where(eq(comments.id, input.commentId));
    } else {
      await db.delete(comments).where(eq(comments.id, input.commentId));
    }
    await communityRepository.notify(c.movieId, "comment_deleted", { id: input.commentId });
  },
};
```

- [ ] **Step 3: Run + commit**

```bash
DATABASE_URL=... npm test -- tests/community/commentService.test.ts
git add src/lib/community/commentService.ts tests/community/commentService.test.ts
git commit -m "feat(community): commentService with depth cap, soft/hard delete, validation"
```

---

### Task 9: likeService + reportService

**Files:** Create `src/lib/community/likeService.ts`, `src/lib/community/reportService.ts`, `tests/community/likeService.test.ts`, `tests/community/reportService.test.ts`.

**Interfaces:**
- `likeService.toggle({ userId, commentId }) -> { liked: boolean; count: number }` (race-safe via UNIQUE; Review Focus #1)
- `reportService.create({ reporterUserId, commentId, reason, description? }) -> void` (UNIQUE per reporter+comment)
- `reportService.list({ status?, page, limit })` (admin only)
- `reportService.updateStatus({ reportId, adminId, status }) -> void` (admin only)

- [ ] **Step 1: Like race test (Review Focus #1)**

`tests/community/likeService.test.ts`:
```ts
const hasDb = !!process.env.DATABASE_URL;
(hasDb ? describe : describe.skip)("likeService", () => {
  async function fresh() {
    const { db } = await import("@/db/client");
    const { users, comments } = await import("@/db/schema");
    const { genId } = await import("@/lib/community/ids");
    const userId = genId("usr"); const cmtId = genId("cmt");
    const email = `${userId}@x.vn`;
    await db.insert(users).values({ id: userId, name: "L", email, role: "user" });
    await db.insert(comments).values({ id: cmtId, userId, movieId: "mLk", content: "hi", isSpoiler: false });
    return { userId, cmtId };
  }
  it("double-toggle returns to unliked with count 0 (Review Focus #1)", async () => {
    const { likeService } = await import("@/lib/community/likeService");
    const { userId, cmtId } = await fresh();
    const r1 = await likeService.toggle({ userId, commentId: cmtId });
    expect(r1).toEqual({ liked: true, count: 1 });
    const r2 = await likeService.toggle({ userId, commentId: cmtId });
    expect(r2).toEqual({ liked: false, count: 0 });
  });
  it("two users -> two likes", async () => {
    const { likeService } = await import("@/lib/community/likeService");
    const { db } = await import("@/db/client");
    const { users } = await import("@/db/schema");
    const { genId } = await import("@/lib/community/ids");
    const u1 = genId("usr"); const u2 = genId("usr"); const cid = genId("cmt");
    await db.insert(users).values([{ id: u1, name: "a", email: `${u1}@x.vn`, role: "user" }, { id: u2, name: "b", email: `${u2}@x.vn`, role: "user" }]);
    await db.insert(require("@/db/schema").comments).values({ id: cid, userId: u1, movieId: "mT", content: "hi", isSpoiler: false });
    const r = await likeService.toggle({ userId: u2, commentId: cid });
    expect(r).toEqual({ liked: true, count: 1 });
  });
});
```
Run: expect FAIL.

- [ ] **Step 2: Implement `likeService.ts`**

```ts
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { commentLikes } from "@/db/schema";
import { genId } from "./ids";
import { communityRepository } from "./communityRepository";

export const likeService = {
  async toggle({ userId, commentId }: { userId: string; commentId: string }) {
    const [existing] = await db.select({ id: commentLikes.id }).from(commentLikes)
      .where(and(eq(commentLikes.userId, userId), eq(commentLikes.commentId, commentId))).limit(1);
    let liked: boolean;
    if (existing) { await db.delete(commentLikes).where(eq(commentLikes.id, existing.id)); liked = false; }
    else { await db.insert(commentLikes).values({ id: genId("like"), userId, commentId }); liked = true; }
    const [{ c }] = await db.select({ c: sql<number>`count(*)::int` }).from(commentLikes).where(eq(commentLikes.commentId, commentId));
    // Get movieId for notify
    const [row] = await db.select({ mid: sql<string>`(select movie_id from comments where id = ${commentId})` }).from(sql`select 1`);
    void row;
    await communityRepository.notify(await this.movieIdForComment(commentId), "like_changed", { commentId, liked, count: c });
    return { liked, count: c };
  },
  async movieIdForComment(commentId: string) {
    const [r] = await db.select({ mid: sql<string>`(select movie_id from comments where id = ${commentId})` }).from(sql`select 1`);
    return r?.mid ?? "";
  },
};
```

(Adjust the `movieIdForComment` helper to a plain `await db.select({ movieId: comments.movieId }).from(comments).where(eq(comments.id, commentId))` for clarity.)

- [ ] **Step 3: Report test**

`tests/community/reportService.test.ts`:
```ts
const hasDb = !!process.env.DATABASE_URL;
(hasDb ? describe : describe.skip)("reportService", () => {
  it("rejects duplicate report from same user", async () => {
    const { reportService } = await import("@/lib/community/reportService");
    const { db } = await import("@/db/client");
    const { users, comments } = await import("@/db/schema");
    const { genId } = await import("@/lib/community/ids");
    const u1 = genId("usr"); const cid = genId("cmt");
    await db.insert(users).values({ id: u1, name: "R", email: `${u1}@x.vn`, role: "user" });
    await db.insert(comments).values({ id: cid, userId: u1, movieId: "mR", content: "hi", isSpoiler: false });
    await reportService.create({ reporterUserId: u1, commentId: cid, reason: "spam", description: "" });
    await expect(reportService.create({ reporterUserId: u1, commentId: cid, reason: "spam", description: "" }))
      .rejects.toThrow();
  });
});
```

- [ ] **Step 4: Implement `reportService.ts`** + `list` + `updateStatus` (admin-only checks throw `FORBIDDEN`).

- [ ] **Step 5: Run + commit**

```bash
DATABASE_URL=... npm test -- tests/community/likeService.test.ts tests/community/reportService.test.ts
git add src/lib/community/likeService.ts src/lib/community/reportService.ts tests/community/
git commit -m "feat(community): likeService (double-tap race pinned) + reportService"
```

---

### Task 10: API routes — ratings, comments, likes, reports, users/[id] (Review Focus #5)

**Files:**
- Create: `src/app/api/community/ratings/route.ts` (GET, POST, DELETE)
- Create: `src/app/api/community/comments/route.ts` (GET, POST)
- Create: `src/app/api/community/comments/[id]/route.ts` (PATCH, DELETE)
- Create: `src/app/api/community/comments/[id]/like/route.ts` (POST)
- Create: `src/app/api/community/comments/[id]/report/route.ts` (POST)
- Create: `src/app/api/users/[id]/route.ts` (GET — public profile preview)
- Test: `tests/api/community-routes.test.ts` (uses `next-test-api-route-handler` OR `node:test` with manual fetch — pick whichever has the lighter setup)

**Error contract (Review Focus #5):** all POST/PATCH/DELETE return `401 {success:false,error:{code:"UNAUTHENTICATED"}}` on no session; `403 {code:"FORBIDDEN"}` on policy deny; `400 {code:"BAD_REQUEST",message}` on validation failure; `429` on rate-limit.

- [ ] **Step 1: Helpers**

`src/app/api/community/_util.ts`:
```ts
import { NextResponse, NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/server/apiResponse";
import { HttpError, getCurrentUser } from "@/lib/community/getCurrentUser";
import { checkRateLimit } from "@/lib/server/rateLimiter";

export async function withAuth(req: NextRequest, routeKey: string, limit: number) {
  const user = await getCurrentUser();
  if (!user) return { user: null, error: NextResponse.json(apiError("UNAUTHENTICATED", "Vui lòng đăng nhập."), { status: 401 }) };
  const res = checkRateLimit(`${user.id}:${routeKey}`, limit, 60);
  if (!res.allowed) {
    const h = new Headers({ "Retry-After": String(res.resetSeconds), "X-RateLimit-Limit": String(limit), "X-RateLimit-Remaining": "0" });
    return { user: null, error: NextResponse.json(apiError("RATE_LIMITED", "Bạn đang thao tác quá nhanh."), { status: 429, headers: h }) };
  }
  return { user, error: null } as { user: any; error: null };
}
export async function withOptionalAuth(req: NextRequest) {
  const user = await getCurrentUser();
  return { user, error: null as null };
}
export function handleError(e: unknown) {
  if (e instanceof HttpError) return NextResponse.json(apiError(e.code, e.message), { status: e.code === "UNAUTHENTICATED" ? 401 : 403 });
  if (e && typeof e === "object" && "code" in e) {
    const code = (e as any).code;
    if (code === "BAD_REQUEST") return NextResponse.json(apiError("BAD_REQUEST", (e as Error).message), { status: 400 });
    if (code === "MAX_DEPTH") return NextResponse.json(apiError("BAD_REQUEST", "Không thể trả lời sâu hơn."), { status: 400 });
    if (code === "FORBIDDEN") return NextResponse.json(apiError("FORBIDDEN", "Bạn không có quyền."), { status: 403 });
    if (code === "NOT_FOUND") return NextResponse.json(apiError("NOT_FOUND", "Không tìm thấy."), { status: 404 });
  }
  console.error("[community route]", e);
  return NextResponse.json(apiError("INTERNAL", "Đã xảy ra lỗi."), { status: 500 });
}
```

- [ ] **Step 2: Ratings route** `src/app/api/community/ratings/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { apiSuccess } from "@/lib/server/apiResponse";
import { ratingService } from "@/lib/community/ratingService";
import { validateRating } from "@/lib/community/validators";
import { withAuth, withOptionalAuth, handleError } from "../_util";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const movieId = url.searchParams.get("movieId");
    if (!movieId) return NextResponse.json({ success: false, error: { code: "BAD_REQUEST", message: "movieId required" } }, { status: 400 });
    const { user } = await withOptionalAuth(req);
    const stats = await ratingService.getStats(movieId, user?.id ?? null);
    return NextResponse.json(apiSuccess(stats));
  } catch (e) { return handleError(e); }
}

export async function POST(req: NextRequest) {
  try {
    const { user, error } = await withAuth(req, "ratings.post", 30);
    if (error) return error;
    const body = await req.json();
    const r = validateRating(body?.rating);
    if (r == null) return NextResponse.json({ success: false, error: { code: "BAD_REQUEST", message: "rating 1..5" } }, { status: 400 });
    if (!body?.movieId) return NextResponse.json({ success: false, error: { code: "BAD_REQUEST", message: "movieId required" } }, { status: 400 });
    const stats = await ratingService.upsert({ userId: user.id, movieId: body.movieId, movieSlug: body.movieSlug ?? "", rating: r });
    return NextResponse.json(apiSuccess(stats));
  } catch (e) { return handleError(e); }
}

export async function DELETE(req: NextRequest) {
  try {
    const { user, error } = await withAuth(req, "ratings.delete", 30);
    if (error) return error;
    const url = new URL(req.url);
    const movieId = url.searchParams.get("movieId");
    if (!movieId) return NextResponse.json({ success: false, error: { code: "BAD_REQUEST", message: "movieId" } }, { status: 400 });
    await ratingService.delete(user.id, movieId);
    return NextResponse.json(apiSuccess({ ok: true }));
  } catch (e) { return handleError(e); }
}
```

- [ ] **Step 3: Comments routes**

`src/app/api/community/comments/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { apiSuccess } from "@/lib/server/apiResponse";
import { commentService } from "@/lib/community/commentService";
import { validateCommentContent } from "@/lib/community/validators";
import { withAuth, withOptionalAuth, handleError } from "../_util";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const movieId = url.searchParams.get("movieId")!;
    const sort = (url.searchParams.get("sort") as "newest"|"oldest"|"top") ?? "newest";
    const page = Number(url.searchParams.get("page") ?? 1);
    const limit = Math.min(50, Number(url.searchParams.get("limit") ?? 20));
    const { user } = await withOptionalAuth(req);
    const result = await commentService.list({ movieId, sort, page, limit, viewerId: user?.id ?? null });
    return NextResponse.json(apiSuccess(result));
  } catch (e) { return handleError(e); }
}

export async function POST(req: NextRequest) {
  try {
    const { user, error } = await withAuth(req, "comments.post", 10);
    if (error) return error;
    const body = await req.json();
    const clean = validateCommentContent(body?.content);
    if (clean == null) return NextResponse.json({ success: false, error: { code: "BAD_REQUEST", message: "Nội dung 1..1000 ký tự" } }, { status: 400 });
    const c = await commentService.create({
      userId: user.id, movieId: body.movieId, parentId: body.parentId ?? null,
      content: clean, isSpoiler: Boolean(body.isSpoiler),
    });
    return NextResponse.json(apiSuccess(c), { status: 201 });
  } catch (e) { return handleError(e); }
}
```

`src/app/api/community/comments/[id]/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { apiSuccess } from "@/lib/server/apiResponse";
import { withAuth, handleError } from "../../_util";
import { commentService } from "@/lib/community/commentService";
import { validateCommentContent } from "@/lib/community/validators";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const { user, error } = await withAuth(req, "comments.patch", 10);
    if (error) return error;
    const body = await req.json();
    const clean = validateCommentContent(body?.content);
    if (clean == null) return NextResponse.json({ success: false, error: { code: "BAD_REQUEST" } }, { status: 400 });
    const isAdmin = user.role === "admin";
    const c = await commentService.edit({ commentId: id, userId: user.id, isAdmin, content: clean });
    return NextResponse.json(apiSuccess(c));
  } catch (e) { return handleError(e); }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const { user, error } = await withAuth(req, "comments.delete", 10);
    if (error) return error;
    const isAdmin = user.role === "admin";
    await commentService.delete({ commentId: id, userId: user.id, isAdmin });
    return NextResponse.json(apiSuccess({ ok: true }));
  } catch (e) { return handleError(e); }
}
```

`src/app/api/community/comments/[id]/like/route.ts`:
```ts
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const { user, error } = await withAuth(req, "comments.like", 60);
    if (error) return error;
    const r = await likeService.toggle({ userId: user.id, commentId: id });
    return NextResponse.json(apiSuccess(r));
  } catch (e) { return handleError(e); }
}
```

`src/app/api/community/comments/[id]/report/route.ts`:
```ts
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const { user, error } = await withAuth(req, "comments.report", 5);
    if (error) return error;
    const body = await req.json();
    const reason = validateReportReason(body?.reason);
    if (!reason) return NextResponse.json({ success: false, error: { code: "BAD_REQUEST" } }, { status: 400 });
    const desc = validateDescription(body?.description);
    if (desc == null) return NextResponse.json({ success: false, error: { code: "BAD_REQUEST" } }, { status: 400 });
    await reportService.create({ reporterUserId: user.id, commentId: id, reason, description: desc ?? undefined });
    return NextResponse.json(apiSuccess({ ok: true }), { status: 201 });
  } catch (e) { return handleError(e); }
}
```

`src/app/api/users/[id]/route.ts`:
```ts
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const [u] = await db.select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl, role: users.role, createdAt: users.createdAt })
      .from(users).where(eq(users.id, id)).limit(1);
    if (!u) return NextResponse.json(apiError("NOT_FOUND", "Không tìm thấy."), { status: 404 });
    const [{ comments }] = await db.select({ comments: sql<number>`count(*)::int` }).from(commentsT).where(eq(commentsT.userId, id));
    return NextResponse.json(apiSuccess({ ...u, createdAt: u.createdAt.getTime(), commentCount: comments }));
  } catch (e) { return handleError(e); }
}
```

- [ ] **Step 4: Route tests (Review Focus #5)**

`tests/api/community-routes.test.ts` — exercise `POST /api/community/comments` with no cookie → 401. Use a fake NextRequest shape (call `withAuth` directly OR import only the helper).
```ts
import { describe, it, expect, vi } from "vitest";
vi.mock("next/headers", () => ({ cookies: () => ({ get: () => undefined }) }));
vi.mock("@/lib/auth/authService", () => ({ authRepository: { getSession: vi.fn() } }));

import { withAuth } from "@/app/api/community/_util";

describe("withAuth (Review Focus #5)", () => {
  it("returns 401 when no cookie", async () => {
    const { error, user } = await withAuth({} as any, "comments.post", 10);
    expect(user).toBeNull();
    expect(error?.status).toBe(401);
    const body = await error!.json();
    expect(body).toMatchObject({ success: false, error: { code: "UNAUTHENTICATED" } });
  });
});
```
Run: `npm test -- tests/api/community-routes.test.ts`. Expect PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/community src/app/api/users tests/api/community-routes.test.ts
git commit -m "feat(api): community routes (ratings, comments, likes, reports, profile) + 401 contract"
```

---

### Task 11: SSE stream route (Review Focus #4 server side)

**Files:** Create `src/app/api/community/stream/route.ts`, `tests/api/community-stream.test.ts`.

- [ ] **Step 1: Implement route**

`src/app/api/community/stream/route.ts`:
```ts
import { NextRequest } from "next/server";
import { communityRepository } from "@/lib/community/communityRepository";

export const maxDuration = 60;
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const movieId = url.searchParams.get("movieId");
  if (!movieId) return new Response("movieId required", { status: 400 });

  const encoder = new TextEncoder();
  let cleanup = () => {};
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      send("hello", { movieId, at: Date.now() });
      cleanup = await communityRepository.subscribe(movieId, (e) => send(e.type, e));
      // Heartbeat every 25s; close at 55s to trigger reconnect
      const hb = setInterval(() => send("ping", { at: Date.now() }), 25000);
      timeout = setTimeout(() => {
        clearInterval(hb);
        send("end", { at: Date.now() });
        try { controller.close(); } catch {}
      }, 55000);
    },
    cancel() { if (timeout) clearTimeout(timeout); cleanup(); },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
```

- [ ] **Step 2: Server test (polls first event then cleanup)**

`tests/api/community-stream.test.ts` — uses a real `fetch` against the route handler. Skip if no DB or no dev server.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/community/stream/route.ts tests/api/community-stream.test.ts
git commit -m "feat(api): SSE stream route with 55s reconnect + Postgres LISTEN fan-out"
```

---

### Task 12: Admin moderation API + page

**Files:**
- Create: `src/app/api/admin/moderation/reports/route.ts` (GET)
- Create: `src/app/api/admin/moderation/reports/[id]/route.ts` (PATCH)
- Create: `src/app/admin/moderation/page.tsx`
- Modify: nav/route entry for `user.role === 'admin'` (add link in `src/components/site-header.tsx` only behind `useAuth().user?.role === 'admin'`)

**API contract:**
- `GET /api/admin/moderation/reports?status=open&page=1&limit=20` returns `{ items: ReportView[], total, page, limit, totalPages }`
- `PATCH /api/admin/moderation/reports/:id` body `{ status: "dismissed"|"actioned", action: "hide"|"delete"|null }`

- [ ] **Step 1: Reports list route**

```ts
export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const url = new URL(req.url);
    const status = url.searchParams.get("status") as "open"|"reviewed"|"dismissed"|"actioned"|null;
    const page = Number(url.searchParams.get("page") ?? 1);
    const limit = Math.min(50, Number(url.searchParams.get("limit") ?? 20));
    const result = await reportService.list({ status, page, limit });
    return NextResponse.json(apiSuccess(result));
  } catch (e) { return handleError(e); }
}
```

- [ ] **Step 2: Report update route**

```ts
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const body = await req.json();
    const status = body?.status as "dismissed"|"actioned"|null;
    if (!status) return NextResponse.json({ success: false, error: { code: "BAD_REQUEST" } }, { status: 400 });
    if (body?.action === "hide") {
      await db.update(comments).set({ deletedAt: new Date(), content: "[removed]" }).where(eq(comments.id, (await db.select().from(commentReports).where(eq(commentReports.id, id)).limit(1))[0].commentId));
    } else if (body?.action === "delete") {
      await db.delete(comments).where(eq(comments.id, (await db.select().from(commentReports).where(eq(commentReports.id, id)).limit(1))[0].commentId));
    }
    await reportService.updateStatus({ reportId: id, adminId: admin.id, status });
    return NextResponse.json(apiSuccess({ ok: true }));
  } catch (e) { return handleError(e); }
}
```

- [ ] **Step 3: `/admin/moderation/page.tsx`** (client component, lists reports with status badges + hide/delete buttons + dismiss button, optimistic updates)

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin src/app/admin src/components/site-header.tsx
git commit -m "feat(admin): moderation API + page + nav entry gated by role"
```

---

### Task 13: use-community hooks (Review Focus #4 client de-dupe)

**Files:** Create `src/hooks/use-community.ts`.

**Public:**
- `useRating(movieId, movieSlug)` returns `{ stats, viewerRating, rate(r), removeRating(), isLoading }`
- `useComments(movieId, sort)` returns `{ items, total, page, setPage, sort, setSort, refresh, appendOptimistic(), confirmOptimistic(), removeOptimistic() }`
- `useCommentStream(movieId, onEvent)` opens EventSource; auto-reconnect on `end`; client **de-dupe by event payload id** so the same comment arriving twice via SSE reconnect is only added once.
- `useLike(commentId, initialLiked, initialCount)` optimistic toggle with 250ms debounce; rolls back on error
- `useReport()` posts to `/api/community/comments/:id/report`; opens a toast on success

**De-dupe strategy (RF#4 client):**
```ts
function appendOptimistic(c: CommentView) {
  setItems((prev) => prev.some((x) => x.id === c.id) ? prev : [c, ...prev]);
}
function onEvent(e: CommunityEvent) {
  if (e.type === "comment_created") {
    const c = (e.payload as CommentView);
    if (somewhereHasComment(c.id)) return; // de-dupe
    addComment(c);
  }
}
```

- [ ] **Step 1: Write hook test (de-dupe unit-testable)**

`tests/hooks/use-community.test.ts` — use `react-test-renderer` or `@testing-library/react` + `vitest`. Test the appendOptimistic reducer-style by exporting a pure helper if needed; if hook-internal, use `act` with `renderHook` from `@testing-library/react`.

```ts
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCommunityDeDupe } from "@/hooks/use-community";

describe("useCommunityDeDupe (Review Focus #4 client)", () => {
  it("drops duplicates by id", () => {
    const { result } = renderHook(() => useCommunityDeDupe());
    act(() => result.current.add({ id: "a", text: "1" }));
    act(() => result.current.add({ id: "a", text: "again" }));
    act(() => result.current.add({ id: "b", text: "2" }));
    expect(result.current.items).toHaveLength(2);
    expect(result.current.items[0].id).toBe("a");
  });
});
```
(Export the pure reducer from the hook module for testability.)

- [ ] **Step 2: Implement hooks** — production shape:

```ts
// src/hooks/use-community.ts
"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
// ... service calls, EventSource wrapper, set items with de-dupe
```

- [ ] **Step 3: Run + commit**

```bash
git add src/hooks/use-community.ts tests/hooks/use-community.test.ts
git commit -m "feat(hooks): use-community with SSE reconnect + id de-dupe (review focus #4)"
```

---

### Task 14: Rating components

**Files:**
- Create: `src/components/community/rating/rating-section.tsx`
- Create: `src/components/community/rating/rating-stars.tsx`
- Create: `src/components/community/rating/rating-distribution.tsx`
- Create: `src/components/community/rating/rating-skeleton.tsx`

**Behavior:**
- `<RatingSection movieId movieSlug>` is a client component using `useRating` from Task 13 + cinema-950 background + brand-red accents.
- Guest clicking a star triggers `useAuth().openAuthModal("login")`.
- Keyboard: ↑↓/←→ adjust by 1; 1..5 selects; Space/Enter submits.
- `<RatingDistribution distribution count>` renders 5 horizontal bars; width proportional to share.

- [ ] **Step 1: rating-stars.tsx** (full code, exact):

```tsx
"use client";
import { Star } from "lucide-react";
import { useCallback, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { useAuth } from "@/lib/auth/authContext";

export function RatingStars({ value, onChange, disabled }: { value: number; onChange: (n: number) => void; disabled?: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const handle = useCallback((n: number) => { if (!disabled) onChange(n); }, [disabled, onChange]);
  return (
    <div role="radiogroup" aria-label="Đánh giá" className="flex items-center gap-1" onMouseLeave={() => setHover(null)}>
      {[1,2,3,4,5].map((n) => {
        const filled = (hover ?? value) >= n;
        return (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} sao`}
            disabled={disabled}
            onMouseEnter={() => setHover(n)} onFocus={() => setHover(n)} onBlur={() => setHover(null)}
            onClick={() => handle(n)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); handle(Math.min(5, (hover ?? value) + 1)); }
              if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); handle(Math.max(1, (hover ?? value) - 1)); }
              if (["1","2","3","4","5"].includes(e.key)) { e.preventDefault(); handle(Number(e.key)); }
            }}
            className={cn("p-1 rounded transition-colors", filled ? "text-cinema-500" : "text-cinema-700 hover:text-cinema-300", disabled && "opacity-50 cursor-not-allowed")}>
            <Star className={cn("h-6 w-6", filled && "fill-current")} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}

export function GuestGateStars({ value, onPick }: { value: number; onPick: (n: number) => void }) {
  const { openAuthModal } = useAuth();
  return <RatingStars value={value} disabled onChange={(n) => { openAuthModal("login"); onPick(n); }} />;
}
```

- [ ] **Step 2: rating-distribution.tsx**

```tsx
"use client";
import { cn } from "@/lib/utils/cn";
export function RatingDistribution({ distribution, count, onJumpTo }: { distribution: Record<1|2|3|4|5, number>; count: number; onJumpTo?: (stars: number) => void }) {
  if (count === 0) return <p className="text-cinema-400 text-sm">Chưa có đánh giá nào.</p>;
  return (
    <div className="space-y-1.5" aria-label="Phân bố đánh giá">
      {[5,4,3,2,1].map((s) => {
        const n = distribution[s as 1|2|3|4|5];
        const pct = Math.round((n / count) * 100);
        return (
          <button key={s} type="button" onClick={() => onJumpTo?.(s)} className="grid grid-cols-[40px_1fr_60px] items-center gap-2 text-xs w-full hover:bg-cinema-900/40 rounded">
            <span className="text-cinema-200">{s} sao</span>
            <div className="h-2 bg-cinema-800 rounded overflow-hidden">
              <div className="h-full bg-cinema-500" style={{ width: `${pct}%` }} aria-hidden="true" />
            </div>
            <span className="text-cinema-400 text-right tabular-nums">{n}</span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: rating-section.tsx** — calls `useRating(movieId, movieSlug)`, wires stars to onChange→POST, renders distribution. Skeleton wraps in Suspense at the call site (Task 17).

```tsx
"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/authContext";
import { RatingStars, GuestGateStars } from "./rating-stars";
import { RatingDistribution } from "./rating-distribution";
import { ratingService } from "@/lib/community/ratingService"; // client may call API instead

export function RatingSection({ movieId, movieSlug }: { movieId: string; movieSlug: string }) {
  const { user, openAuthModal } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [viewerRating, setViewerRating] = useState<number | null>(null);
  // Fetch on mount + when user changes
  useEffect(() => {
    fetch(`/api/community/ratings?movieId=${movieId}`, { credentials: "include" })
      .then((r) => r.json()).then((j) => { if (j.success) { setStats(j.data); setViewerRating(j.data.viewerRating); } });
  }, [movieId, user?.id]);

  async function rate(n: number) {
    if (!user) { openAuthModal("login"); return; }
    const res = await fetch("/api/community/ratings", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ movieId, movieSlug, rating: n }) });
    const j = await res.json();
    if (j.success) { setStats(j.data); setViewerRating(j.data.viewerRating); }
  }
  // ... render skeleton/empty/normal states
  return (
    <section aria-label="Đánh giá phim" className="rounded-xl border border-cinema-800 bg-cinema-900/50 p-4 md:p-6">
      <h2 className="text-lg font-semibold text-cinema-100 mb-4">Đánh giá của khán giả</h2>
      <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-6">
        <div className="text-center">
          <div className="text-4xl font-bold text-cinema-50 tabular-nums">{(stats?.average ?? 0).toFixed(1)}</div>
          <div className="text-xs text-cinema-400">{stats?.count ?? 0} lượt đánh giá</div>
          {!user ? <GuestGateStars value={0} onPick={rate} /> : <RatingStars value={viewerRating ?? 0} onChange={rate} />}
        </div>
        <RatingDistribution distribution={stats?.distribution ?? {1:0,2:0,3:0,4:0,5:0}} count={stats?.count ?? 0} />
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Skeleton + commit**

```tsx
// rating-skeleton.tsx
export function RatingSkeleton() { return <div className="rounded-xl border border-cinema-800 bg-cinema-900/50 p-6 animate-pulse h-40" />; }
```

```bash
git add src/components/community/rating
git commit -m "feat(ui): rating section (stars, distribution, skeleton)"
```

---

### Task 15: Comment components

**Files:**
- Create: `src/components/community/comments/comment-section.tsx`
- Create: `src/components/community/comments/comment-composer.tsx`
- Create: `src/components/community/comments/comment-list.tsx`
- Create: `src/components/community/comments/comment-item.tsx`
- Create: `src/components/community/comments/comment-sort.tsx`
- Create: `src/components/community/comments/spoiler-block.tsx`
- Create: `src/components/community/comments/comment-skeleton.tsx`
- Create: `src/components/community/comments/report-modal.tsx`

- [ ] **Step 1: spoiler-block.tsx** — controlled by `revealed: boolean` + `onToggle`:

```tsx
"use client";
import { useState } from "react";
export function SpoilerBlock({ content }: { content: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      {!open && <button type="button" aria-pressed={false} onClick={() => setOpen(true)}
        className="absolute inset-0 bg-cinema-950/95 text-cinema-200 flex items-center justify-center text-sm rounded border border-cinema-700">
        ⚠ Chứa spoiler — nhấn để hiện
      </button>}
      {open && <div className="text-cinema-100 whitespace-pre-wrap break-words">{content}</div>}
    </div>
  );
}
```

- [ ] **Step 2: report-modal.tsx**

```tsx
"use client";
import { useState } from "react";
import { REPORT_REASONS, type ReportReason } from "@/lib/community/validators";
import { useToast } from "@/components/ui/toast";

export function ReportModal({ commentId, open, onClose }: { commentId: string; open: boolean; onClose: () => void }) {
  const [reason, setReason] = useState<ReportReason>("spam"); const [desc, setDesc] = useState("");
  const toast = useToast();
  if (!open) return null;
  async function submit() {
    const res = await fetch(`/api/community/comments/${commentId}/report`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason, description: desc }) });
    const j = await res.json();
    if (j.success) { toast.success("Đã gửi báo cáo", "Cảm ơn bạn đã giúp giữ cộng đồng lành mạnh."); onClose(); }
    else toast.error("Lỗi", j?.error?.message ?? "Thử lại sau.");
  }
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-cinema-900 border border-cinema-700 rounded-xl p-5 w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-cinema-100 font-semibold">Báo cáo bình luận</h3>
        <div className="space-y-1 text-sm text-cinema-200">
          {REPORT_REASONS.map((r) => (
            <label key={r} className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} />
              {r}
            </label>
          ))}
        </div>
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={500} placeholder="Mô tả thêm (tuỳ chọn)" className="w-full bg-cinema-950 border border-cinema-700 rounded p-2 text-cinema-100" />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded text-cinema-300 hover:bg-cinema-800">Huỷ</button>
          <button onClick={submit} className="px-3 py-1.5 rounded bg-brand-red text-white">Gửi báo cáo</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: comment-item.tsx** — renders avatar, name, time ago, content (or SpoilerBlock), action row (reply, like, report, edit/delete if owner/admin).

```tsx
"use client";
import { useState } from "react";
import { Heart, MessageSquareReply, MoreHorizontal, Trash2, Edit2 } from "lucide-react";
import { useAuth } from "@/lib/auth/authContext";
import { SpoilerBlock } from "./spoiler-block";
import { ReportModal } from "./report-modal";
import { useLike } from "@/hooks/use-community";

export interface CommentItemProps {
  c: any; // CommentView
  onReply?: (parentId: string) => void;
  onChanged?: () => void;
  canReply?: boolean;
}
export function CommentItem({ c, onReply, onChanged, canReply }: CommentItemProps) {
  const { user } = useAuth();
  const liked = useLike(c.id, c.likedByViewer, c.likeCount);
  const [reportOpen, setReportOpen] = useState(false);
  const isOwner = user?.id === c.author.id;
  const isAdmin = user?.role === "admin";

  async function del() { if (!confirm("Xóa bình luận?")) return; await fetch(`/api/community/comments/${c.id}`, { method: "DELETE", credentials: "include" }); onChanged?.(); }
  async function saveEdit(newContent: string, isSpoiler: boolean) {
    await fetch(`/api/community/comments/${c.id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: newContent, isSpoiler }) });
    onChanged?.();
  }

  return (
    <article aria-labelledby={`cmt-${c.id}-author`} className="flex gap-3 py-3 border-b border-cinema-800">
      <img src={c.author.avatarUrl ?? "/default-avatar.png"} alt="" className="h-8 w-8 rounded-full object-cover" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm">
          <span id={`cmt-${c.id}-author`} className="font-medium text-cinema-100">{c.author.name}</span>
          {c.author.role !== "user" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-cinema-700 text-cinema-200 uppercase">{c.author.role}</span>}
          <time className="text-xs text-cinema-500">{new Date(c.createdAt).toLocaleString("vi-VN")}</time>
        </div>
        <div className="mt-1 text-sm">
          {c.deletedAt ? <span className="italic text-cinema-500">[Bình luận đã bị xoá]</span>
            : c.isSpoiler ? <SpoilerBlock content={c.content} />
            : <p className="text-cinema-100 whitespace-pre-wrap break-words">{c.content}</p>}
        </div>
        <div className="mt-2 flex items-center gap-3 text-xs text-cinema-400">
          <button onClick={liked.toggle} className="flex items-center gap-1 hover:text-cinema-200" aria-pressed={liked.liked}>
            <Heart className={`h-3.5 w-3.5 ${liked.liked ? "fill-cinema-500 text-cinema-500" : ""}`} /> {liked.count}
          </button>
          {canReply && <button onClick={() => onReply?.(c.id)} className="flex items-center gap-1 hover:text-cinema-200"><MessageSquareReply className="h-3.5 w-3.5" /> Trả lời</button>}
          {!isOwner && <button onClick={() => setReportOpen(true)} className="hover:text-cinema-200">Báo cáo</button>}
          {(isOwner || isAdmin) && (
            <>
              {isOwner && <button onClick={() => { const v = prompt("Sửa nội dung:", c.content); if (v) saveEdit(v, c.isSpoiler); }} className="hover:text-cinema-200"><Edit2 className="h-3.5 w-3.5" /></button>}
              <button onClick={del} className="hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
            </>
          )}
        </div>
        {c.replies?.length > 0 && <div className="mt-3 pl-4 border-l border-cinema-800 space-y-3">{c.replies.map((r: any) => <CommentItem key={r.id} c={r} onChanged={onChanged} canReply={false} />)}</div>}
      </div>
      <ReportModal commentId={c.id} open={reportOpen} onClose={() => setReportOpen(false)} />
    </article>
  );
}
```

- [ ] **Step 4: comment-list + comment-composer + comment-sort + comment-section + skeleton**

Pattern follows `comment-item`. Composer: textarea + char counter + spoiler toggle + submit; guest submit → AuthModal. List: `<Virtuoso data={items} itemContent={...}>` for windowing. Sort: 3-button segmented control. Section: hosts composer + list + sort + SSE `useCommentStream`.

- [ ] **Step 5: Commit**

```bash
git add src/components/community/comments
git commit -m "feat(ui): comment composer, list, item, spoiler, report modal, sort, skeleton"
```

---

### Task 16: Profile preview modal + commit

**Files:**
- Create: `src/components/community/profile/profile-preview-modal.tsx`
- Create: `src/hooks/use-profile-preview.ts` (small hook — could live inside `use-community.ts` if compact)

- [ ] **Step 1: Profile preview modal**

```tsx
"use client";
import { useEffect, useState } from "react";
export function ProfilePreviewModal({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    if (!userId) return;
    fetch(`/api/users/${userId}`).then((r) => r.json()).then((j) => setData(j.success ? j.data : null));
  }, [userId]);
  if (!userId) return null;
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-cinema-900 border border-cinema-700 rounded-xl p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        {data ? (
          <div className="flex flex-col items-center gap-2 text-center">
            <img src={data.avatarUrl ?? "/default-avatar.png"} alt="" className="h-16 w-16 rounded-full object-cover" />
            <div className="font-semibold text-cinema-100">{data.name}</div>
            <div className="text-xs text-cinema-500">{data.role !== "user" && <span className="px-1.5 mr-1 rounded bg-cinema-700 uppercase">{data.role}</span>}Gia nhập {new Date(data.createdAt).toLocaleDateString("vi-VN")}</div>
            <div className="text-sm text-cinema-300">{data.commentCount} bình luận</div>
          </div>
        ) : <div className="text-cinema-400 text-sm">Đang tải...</div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/community/profile src/hooks/use-community.ts
git commit -m "feat(ui): profile preview modal"
```

---

### Task 17: Movie detail integration

**Files:**
- Modify: `src/components/movie/movie-detail.tsx` — INSERT two sections; render skeleton fallbacks.

**Where:** between the metadata block and the synopsis → `<RatingSection>`; below cast & crew, above related movies → `<CommentSection>`. Wrap each in `<Suspense fallback={...}>`.

- [ ] **Step 1: Read existing rendering** (the file is large; locate anchors with `grep -n 'phần\|hero\|related\|metadata' src/components/movie/movie-detail.tsx` and add imports + JSX in two places).

- [ ] **Step 2: Add dynamic imports**

```tsx
import dynamic from "next/dynamic";
const RatingSection = dynamic(() => import("@/components/community/rating/rating-section").then(m => m.RatingSection), { ssr: false, loading: () => <RatingSkeleton /> });
const CommentSection = dynamic(() => import("@/components/community/comments/comment-section").then(m => m.CommentSection), { ssr: false, loading: () => <CommentSkeleton /> });
```

Insert sections using existing anchors.

- [ ] **Step 3: Manual smoke** — open `/movie/<slug>` on dev server, rate, comment, observe SSE connect on DevTools Network.

- [ ] **Step 4: Commit**

```bash
git add src/components/movie/movie-detail.tsx
git commit -m "feat(integration): inject RatingSection + CommentSection into movie detail page"
```

---

### Task 18: Docs + final smoke

- [ ] **Step 1: Write `docs/COMMUNITY_SETUP.md`** with: Neon project URL setup, env, migrate, seed, import-legacy, Vercel secrets, idempotency notes, rollback, free-tier limits, SSE reconnect + polling fallback doc.

- [ ] **Step 2: Final typecheck + lint + build**

```bash
cd /c/Games/BFilm
npm run typecheck
npm run lint
npm run build
```
All must pass. Fix any issues.

- [ ] **Step 3: Manual checklist (spec §21 smoke)**

- Register → login → rate 4★ → comment → reply → like → edit → report
- Logout → visit movie → see stats + comments → click like → auth modal opens
- Two browser tabs on same movie: A posts → B sees via SSE ≤ 2s
- Mobile 375px: layout intact
- Admin role: hide report → comment shows "[removed]" everywhere

- [ ] **Step 4: Final commit**

```bash
git add docs/COMMUNITY_SETUP.md
git commit -m "docs(community): setup + ops docs"
```

- [ ] **Step 5: Push** (only when user instructs)

```bash
git push origin main
```

---

## Summary of Review Focus coverage

| RF | Where pinned |
|---|---|
| #1 Double-tap like race | Task 9 — `likeService.toggle` test + UNIQUE index |
| #2 Rating re-vote idempotency | Task 7 — ratingService.test re-vote assertion |
| #3 Comment XSS + control chars preserved | Task 5 — `validateCommentContent` tests |
| #4 SSE reconnect dupes | Task 11 (server) + Task 13 (client `useCommunityDeDupe`) |
| #5 Guest mutation → 401 | Task 10 — `withAuth` test |











