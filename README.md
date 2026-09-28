# BFilm (RubbyFilm)

Ứng dụng xem phim Next.js App Router: duyệt phim theo thể loại / quốc gia / năm, tìm kiếm, phát qua HLS, danh sách cá nhân, lịch sử xem — cùng hệ thống cộng đồng (đánh giá 1–5★, bình luận threaded, like, report, spoiler tag, realtime SSE) và admin moderation. Auth (credentials + Google/Facebook OAuth) lưu trên Neon Postgres qua Drizzle ORM.

## Stack

- **Next.js 15** (App Router) + **React 19** + TypeScript strict
- **Tailwind CSS** (dark theme `cinema-*` tokens)
- **Drizzle ORM** + `@neondatabase/serverless` (HTTP) cho CRUD; `postgres` (porsager) cho LISTEN/NOTIFY
- **hls.js** player, **framer-motion**, **react-virtuoso**, **lucide-react**
- **Vitest** + **@testing-library/react**
- Deploy target: **Vercel** + **Neon Postgres** (free tier)

## Quickstart

```bash
npm install
cp .env.example .env.local   # điền các biến (xem dưới)
npm run db:migrate           # áp schema lên Neon
npm run db:seed              # demo + admin user (idempotent)
npm run dev                  # http://localhost:3000
```

Tài khoản seed:

| Vai trò | Email | Mật khẩu |
|---|---|---|
| VIP demo | `demo@rubbyfilm.vn` | `Demo@123456` |
| Admin | `admin@rubbyfilm.vn` | `Admin@123456` |

## Biến môi trường

Xem `.env.example`. Chính:

- `DATABASE_URL` — Neon Postgres connection string (bắt buộc cho auth + community; không set thì app vẫn chạy nhưng register/login lỗi và SSE chỉ fan-out in-process)
- `MOVIE_API_BASE_URL`, `MOVIE_PROVIDER`, `MOVIE_API_TIMEOUT_MS`, `MOVIE_API_RETRY_COUNT` — movie metadata provider
- `NEXT_PUBLIC_SITE_URL` — OAuth callback + SEO
- `GOOGLE_CLIENT_ID/SECRET`, `FACEBOOK_CLIENT_ID/SECRET` — OAuth (server-side only)

## Scripts

| Lệnh | Chức năng |
|---|---|
| `npm run dev` / `build` / `start` | dev server / production build / serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (next config) |
| `npm test` / `test:watch` | Vitest (DB-gated test tự skip khi thiếu `DATABASE_URL`) |
| `npm run db:generate` | sinh migration SQL từ `db/schema.ts` |
| `npm run db:migrate` | áp migration lên `DATABASE_URL` |
| `npm run db:seed` | seed demo + admin (idempotent) |
| `npm run db:import-legacy` | import `data/users.json` + `sessions.json` cũ sang Postgres, rename `*.migrated-<ts>` |
| `npm run db:studio` | Drizzle Studio |

## Cấu trúc

```
db/                 schema.ts + migrations/ (Drizzle)
scripts/            seed.ts, import-legacy-json.ts
src/app/            pages (home, movies, series, search, watch, profile, admin/…) + API routes
src/app/api/        auth, community (ratings, comments, likes, reports, SSE stream), users, admin/moderation
src/components/     auth, community (rating/comments/profile), home, movie, watch, search, layout, ui
src/hooks/          use-community.ts (useRating, useComments, useCommentStream, useLike, useReport…)
src/lib/            auth (authService, authContext), community (services, SSE repo, validators), providers, server, models, utils
tests/              vitest: api, auth, community, db, hooks, scripts
docs/               COMMUNITY_SETUP.md, superpowers/specs + plans
```

## Tài liệu thêm

- Cộng đồng (đánh giá, bình luận, SSE, moderation) — setup, ops, rate limits, rollback: [`docs/COMMUNITY_SETUP.md`](docs/COMMUNITY_SETUP.md)
- Spec thiết kế: `docs/superpowers/specs/2026-09-26-community-system-design.md`
- Implementation plan: `docs/superpowers/plans/2026-09-26-community-system.md`
