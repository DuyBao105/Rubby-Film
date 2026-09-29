
# Community System Design — RUBBYFILM

> **Status:** Draft, awaiting user review
> **Date:** 2026-09-26
> **Scope:** Movie rating (1–5★), comments, replies, likes, reports, spoiler, realtime SSE, admin moderation, role-based "RLS" enforcement. Migrate `authRepository` from JSON files to Postgres so writes persist on Vercel serverless.

---

## 0. Context

### Master prompt (high-level)
A streaming site wants Netflix-class community features: rate, comment, reply, like, report, realtime, moderation. 47 sections in the spec; this design addresses every applicable section (see §14 for the cross-walk).

### Current architecture (findings)
| Layer | Reality | Implication for community |
|---|---|---|
| Framework | Next.js 15 (App Router, RSC) + React 19 + TS + Tailwind + lucide-react | Client/Server components, route handlers, `dynamic = "force-dynamic"` works |
| Auth | **Custom** (NOT Supabase): HMAC-signed stateless JWT in `rubbyfilm_session` cookie, users in `data/users.json`, sessions in `data/sessions.json`, in-memory `globalThis` singleton | Must migrate to real DB so register/OAuth writes persist on Vercel |
| Movie API | External `phimapi.com` (provider `kkphim`) via BFF in `src/lib/server/`; `Movie.id` = external id (string) | Community uses external movie id as `movie_id` |
| Watch history / my list | Client-side `localStorage` per-user (unchanged) | Community must be **server-side** so users see each other |
| UI kit | `Button`, `Skeleton`, `EmptyState`/`ErrorState`, `Toast`, `Badge`; design tokens cinema dark + brand red `#E50000`; Vietnamese copy | Reuse tokens; build new components under `src/components/community/` |
| CSP | `connect-src 'self' https: blob:` (SSE same-origin OK) | No CSP changes needed |
| Rate limiter | In-memory `src/lib/server/rateLimiter.ts` | Reuse, keep per-user scope |
| Middleware | None | Not needed (route-level auth checks) |
| Admin | `role: "user" \| "vip" \| "admin"` exists; no admin UI | Build minimal `/admin/moderation` |

### Honest constraint
The current auth **silently breaks on Vercel**: filesystem is read-only + ephemeral, `globalThis` doesn't share across instances. New registrations / OAuth logins / profile updates / forgot-password are unreliable in production. The master prompt requires community to be public & persistent, so we **must** migrate auth to a real DB as part of this work. We do so without changing the public API contract — `useAuth()`, `openAuthModal()`, the cookie name, and all auth flows keep their current behavior from the caller's perspective.

---

## 1. Goals & Non-Goals

### Goals
1. Authenticated users can rate 1–5★, comment, reply, like, report, edit & delete own content.
2. Guests can read all public comments and rating statistics.
3. All writes persist on Vercel serverless (multi-instance safe).
4. Cross-instance realtime push when others post (≤2s typical, ≤5s worst case on Vercel Hobby).
5. Server-side "RLS": one user cannot edit/delete/another's data, enforced in the service layer.
6. Admin role can review reports, hide / delete / dismiss.
7. No breaking changes to Movie API, Watch Page, Landing Page, Search, Movie Detail layout outside the injected sections.
8. Design matches existing cinema-dark / brand-red token system. Vietnamese UI strings.

### Non-goals (this PR)
- User mention (`@username`), pin comments, reactions beyond 👍, email notifications, full ban system, AI moderation, comment threading deeper than 2 levels.
- Multi-region active-active replication. Single Neon project, region pinned.

---

## 2. Architecture Decision

**Adopt Option A** (confirmed): **Neon Postgres (free tier) + Drizzle ORM + Postgres `LISTEN/NOTIFY` over SSE.**

Why this combination:
- **Neon free tier** = 0đ/month, no credit card, 0.5GB storage, ~190h compute (autosuspend). Sufficient for hobby.
- **Drizzle ORM** is lightweight (no codegen runtime like Prisma), type-safe, supports Neon serverless driver.
- **`LISTEN/NOTIFY`** gives cross-instance realtime using only the DB — no Redis/Vercel KV/Pusher. SSE endpoint keeps a `LISTEN` connection per subscribed movie, `NOTIFY` fan-out is the DB's job.
- **Single dependency footprint**: `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`, `postgres` (porsager for type-safe raw SQL where needed). ~2MB node_modules delta.

Rejected:
- JSON files (Option 1): doesn't work on Vercel — see §0.
- Supabase full stack: requires rewriting auth to Supabase Auth, swapping OAuth flow, larger scope than master prompt allows.

---

## 3. Stack & Dependencies

Add to `package.json`:
```jsonc
"dependencies": {
  "drizzle-orm": "^0.36.0",
  "@neondatabase/serverless": "^0.10.0",
  "postgres": "^3.4.0"
},
"devDependencies": {
  "drizzle-kit": "^0.28.0",
  "dotenv-cli": "^7.4.0"
}
```

New scripts:
```jsonc
"db:generate": "drizzle-kit generate",
"db:migrate": "drizzle-kit migrate",
"db:push": "drizzle-kit push",
"db:studio": "drizzle-kit studio",
"db:seed": "tsx scripts/seed.ts",
"db:import-legacy": "tsx scripts/import-legacy-json.ts"
```

No runtime framework changes. No new UI library.

---

## 4. Data Model

All tables use `text` ids prefixed with short slug (`usr_`, `cmt_`, `like_`, `rpt_`, `rate_`, `sess_`) via `crypto.randomBytes(8).toString('hex')` to match existing authRepository.

### 4.1 `users` — id PK; name; email UNIQUE NOT NULL; password_hash; salt; avatar_url; role enum('user','vip','admin') DEFAULT 'user'; created_at
### 4.2 `authentication_identities` — id PK; user_id FK; provider enum; provider_account_id; email; created_at; last_used_at. UNIQUE(provider,provider_account_id)
### 4.3 `sessions` — id PK; token UNIQUE; user_id FK; expires_at (30d); created_at; last_seen_at. INDEX(user_id), INDEX(expires_at)
### 4.4 `movie_ratings` — id PK; user_id FK; movie_id; movie_slug; rating int CHECK 1-5; created_at; updated_at. UNIQUE(user_id,movie_id)
### 4.5 `comments` — id PK; user_id FK; movie_id; parent_id FK comments (NULL=top-level); content text 1-1000; is_spoiler bool; created_at; updated_at; deleted_at (soft). INDEX(movie_id, created_at DESC), max depth 2 in service
### 4.6 `comment_likes` — id PK; user_id FK; comment_id FK; created_at. UNIQUE(user_id,comment_id)
### 4.7 `comment_reports` — id PK; reporter_user_id FK; comment_id FK; reason enum('spam','abuse','harassment','inappropriate','spoiler','other'); description max 500; status enum DEFAULT 'open'; created_at. UNIQUE(reporter_user_id,comment_id)

Drizzle Kit generates migrations in `db/migrations/`. Schema-as-code in `db/schema.ts`.

## 5. Auth Migration (JSON -> Postgres)

`src/lib/auth/authRepository.ts` keeps **public method signature unchanged**. Every method swaps Map+file IO for Drizzle.

| Method | Before | After |
|---|---|---|
| findByEmail | Map lookup | SELECT * FROM users WHERE email=$1 |
| findById | Map scan | SELECT id |
| findByIdentity | Map scan | JOIN users + identities |
| createUser | Map.set + writeFile | INSERT users + identities |
| findOrCreateFromOAuth | Map ops | Upsert via identity then email |
| unlinkProvider | Map filter | DELETE FROM identities |
| updateUserProfile | Map assign | UPDATE users |
| resetPassword | Map assign | UPDATE users |
| createSession | Map.set + writeFile | INSERT INTO sessions |
| getSession | Map cache + JWT | Verify HMAC + SELECT FROM sessions JOIN users |
| deleteSession | Map.delete | DELETE FROM sessions |

Demo user auto-seed moves to `scripts/seed.ts` (idempotent). One-time import `scripts/import-legacy-json.ts` reads `data/users.json` + `data/sessions.json`, INSERTs (ON CONFLICT DO NOTHING), renames files to `.migrated-<ts>`.

Cookie names (`rubbyfilm_session`, `rubbyfilm_oauth_state`, `rubbyfilm_user_hint`) unchanged. All callers work without modification.

## 6. RLS-Style Policy Enforcement

Single connection pool, no per-user setting → RLS at service layer:

| action | guest | user self | user other | admin |
|---|---|---|---|---|
| SELECT comments | YES | YES | YES | YES |
| INSERT comment | NO | YES | NO | NO |
| UPDATE comment | NO | YES | NO | YES |
| DELETE comment | NO | YES | NO | YES |
| SELECT ratings | YES | YES | YES | YES |
| INSERT/UPDATE rating | NO | YES | NO | NO |
| INSERT comment_like | NO | YES | NO | NO |
| DELETE comment_like | NO | YES | NO | YES |
| INSERT comment_report | NO | YES | NO | NO |
| SELECT comment_reports | NO | NO | NO | YES |

Pattern in service: actor ownership check before write, throw NOT_FOUND or FORBIDDEN. API routes use new `getCurrentUser(req)` helper returning `AuthUser | null` → 401/403.

## 7. Service Layer

**`src/lib/community/communityRepository.ts`** — Drizzle client + EventEmitter + `notify(movieId, eventType, payload)` that runs `pg_notify('channel_movie_<id>', JSON.stringify(payload))` and emits locally.

**`ratingService.ts`** — `upsertRating`, `getStats(movieId)`, `getUserRating(userId, movieId)`. Mutations call notify('rating_upserted').

**`commentService.ts`** — `listComments({movieId,sort,page,limit,viewerId})`, `createComment`, `editComment`, `deleteComment` (soft if has replies/reports, hard otherwise). Depth-2 enforced.

**`likeService.ts`** — `toggleLike({userId,commentId})`, returns new count + state.

**`reportService.ts`** — `createReport`, `listReports` (admin), `updateReportStatus` (admin).

**`validators.ts`** — hand-rolled, no Zod dep. validateRating(1..5), validateCommentContent(1..1000,strip,trim), validateReportReason(enum).
## 8. API Surface

All routes under `src/app/api/community/`. Pattern: validate body -> call service -> return apiSuccess/apiError.

| Method + Path | Auth | Purpose |
|---|---|---|
| GET `/api/community/ratings?movieId=` | guest | Stats + viewer rating if authed |
| POST `/api/community/ratings` | user | Upsert rating |
| DELETE `/api/community/ratings?movieId=` | user | Delete own rating |
| GET `/api/community/comments?movieId=&sort=&page=&limit=` | guest | List comments tree |
| POST `/api/community/comments` | user | Create top-level or reply |
| PATCH `/api/community/comments/[id]` | user/admin | Edit own / any |
| DELETE `/api/community/comments/[id]` | user/admin | Soft/hard delete |
| POST `/api/community/comments/[id]/like` | user | Toggle like |
| POST `/api/community/comments/[id]/report` | user | Create report |
| GET `/api/community/stream?movieId=` | guest | SSE stream (rating + comment events) |
| GET `/api/users/[id]` | guest | Public profile preview |
| GET `/api/admin/moderation/reports?status=&page=&limit=` | admin | List reports |
| PATCH `/api/admin/moderation/reports/[id]` | admin | Update status |

Pagination default page=1, limit=20, max=50. Sort: newest, oldest, top.

## 9. Realtime SSE

Vercel Serverless maxDuration=60s per streaming response.

1. Client opens EventSource('/api/community/stream?movieId=...').
2. Server creates ReadableStream (60s), subscribes pg_notify('channel_movie_<id>').
3. Each NOTIFY -> writes SSE data frame.
4. At 55s server closes with event:end -> client auto-reconnects.
5. Fallback: 15s polling when SSE fails.

Single-process bonus: in-memory EventEmitter delivers instantly without DB round-trip when publisher and subscriber share a runtime instance.

One global listenClient (globalThis singleton) wrapping pg.Client, LISTEN on demand per movieId with refcount Map. Last subscriber leaves -> UNLISTEN.

## 10. Rate Limiting

In-memory token bucket per userId|guestIp+route:
- POST /comments: 10/min
- POST like: 60/min
- POST report: 5/min
- POST /ratings: 30/min

Returns 429 + Retry-After. Per-instance limit (documented).

## 11. Frontend Components

Reuse design system (button, skeleton, empty-state, toast). Client components.

Rating (`src/components/community/rating/`): rating-section (wraps stars+distribution+average), rating-stars (1-5 input, keyboard arrows, guest opens AuthModal), rating-distribution (bar chart 5->1), rating-skeleton.

Comments (`src/components/community/comments/`): comment-section (composer+list+sort), comment-composer (textarea, char counter, spoiler toggle), comment-list (react-virtuoso windowed), comment-item (avatar, name, time, badges, content or SpoilerBlock, actions), comment-sort (newest/oldest/top segmented), spoiler-block (overlay + reveal button, aria-pressed), comment-skeleton, report-modal (reason radio + description).

Profile (`src/components/community/profile/`): profile-preview-modal (click avatar -> fetch /api/users/[id]).

Hooks (`src/hooks/use-community.ts`): useRating, useComments, useCommentStream (EventSource+reconnect), useLike, useReport, useProfilePreview.

## 12. Movie Detail Integration

Single edit point: `src/components/movie/movie-detail.tsx`.
1. RatingSection between metadata block and synopsis.
2. CommentSection below cast & crew, above related movies.

Each in Suspense with own skeleton. Mobile responsive.

## 13. Admin Moderation

Page `/admin/moderation` (requireAdmin).
- Stats: open reports, actioned today, dismissed today.
- Reports table: comment preview, reporter, reason, status, actions (dismiss/hide/delete).
- Soft-delete: comments.deleted_at + reports.status=actioned, renders "[removed]".
- Hard-delete: cascades replies/likes/reports.

Entry only when user.role === 'admin'.
## 14. Master Prompt Cross-Walk

| request | spec section |
|---|---|
| 1-5 star rating | 4.4, 11 |
| comments + replies | 4.5, 11, 12 |
| like | 4.6, 11 |
| report | 4.7, 11, 13 |
| spoiler | 4.5 is_spoiler, 11 |
| realtime | 9 |
| admin moderation | 13 |
| auth role-gating (RLS) | 6 |
| mobile responsive | 11, 12 |
| cinema dark UI | 11 |
| no fake data | 5 (demo seed only) |
| no breaking changes | 5 (preserved signatures) |

## 15. Accessibility

- All interactive keyboard-reachable.
- Star input: radio group + sr-only labels.
- Spoiler: aria-pressed + focusable.
- Comments: article per item.
- Modal: focus trap, Esc close, aria-modal, restore focus.
- Reduced motion via CSS var --motion-duration.
- Color contrast >= 4.5 against cinema-950.

## 16. Performance

- movie-detail stays RSC; client islands as next/dynamic({ ssr: false }).
- Public profile preview: Cache-Control public, max-age=60, s-maxage=300, stale-while-revalidate=600.
- Comments list: ISR revalidate 30s fallback.
- DB indexes cover primary query patterns.
- Like toggle debounced 250ms.

## 17. SEO

No new public SEO surface. Admin + API routes noindex/nofollow. Profile preview client-only after auth gate.

## 18. Migration Plan

1. Provision Neon project, copy DATABASE_URL.
2. .env.local -> npm run db:generate && npm run db:migrate.
3. npm run db:seed once (demo user + admin).
4. npm run db:import-legacy once (archives JSON).
5. Cutover automatic (single code path).
6. Rollback: keep .json.migrated-* 7 days, drop tables, restore files, revert commit.

## 19. Env Vars

| Var | Source | Used by |
|---|---|---|
| DATABASE_URL | Neon dashboard | db/client, listenClient |
| SESSION_SECRET | already set | unchanged |
| OAUTH_* | already set | unchanged |

Extend .env.example with new vars.

## 20. File-by-File Change Plan

New:
- db/schema.ts, db/client.ts, db/migrations/0000_init.sql
- scripts/seed.ts, scripts/import-legacy-json.ts
- src/lib/community/{communityRepository,ratingService,commentService,likeService,reportService,validators,getCurrentUser,rateLimiter,events}.ts
- src/app/api/community/{ratings,comments,comments/[id],comments/[id]/like,comments/[id]/report,stream}/route.ts
- src/app/api/users/[id]/route.ts
- src/app/api/admin/moderation/{reports,reports/[id]}/route.ts
- src/app/admin/moderation/page.tsx
- src/components/community/rating/* (4 files)
- src/components/community/comments/* (8 files)
- src/components/community/profile/* (1 file)
- src/hooks/use-community.ts
- docs/COMMUNITY_SETUP.md

Modified:
- src/components/movie/movie-detail.tsx (inject 2 sections)
- src/lib/auth/authRepository.ts (Drizzle internals, preserved signature)
- .env.example, package.json scripts

Unchanged: hero, header, footer, layout, providers.

## 21. Testing

Unit (Vitest): validators, service-layer policy, rateLimiter, eventEmitter.
Integration: real Neon test DB, per-test transaction rollback.
E2E (Playwright on Vercel preview):
1. Register -> rate -> comment -> reply -> like -> edit -> report.
2. Guest sees stats + comments, auth-gated actions.
3. Two browsers: SSE <= 2s propagation.
4. Mobile viewport 375x667.
5. Admin hide -> [removed] everywhere.
Manual: typecheck, lint, build, Vercel preview URL.

## 22. Risks

- Cold start SSE 1-2s while Postgres LISTEN warms.
- Polling fallback cached last payload avoids spinner.
- Free tier AWS US East ~250ms from VN.
- globalThis leak: all singletons on globalThis with dev guard.
- Reconnect race de-dupe by comment id in client store.

## 23. Future Work

Email digest, Web Push, cursor pagination, mention autocomplete, image attachments, ML moderation assist.

## 24. References

- Neon: serverless driver, HTTP+WebSocket.
- Drizzle ORM: schema, migrations, postgres-js.
- Postgres LISTEN/NOTIFY.
- Vercel streaming + maxDuration.

---

Status: READY FOR REVIEW
