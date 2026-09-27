# Community System — Setup & Operations

> Đánh giá 1–5★, bình luận threaded, like, report, spoiler tag, realtime SSE và admin moderation cho RubbyFilm. Auth migrate kèm theo từ JSON files sang **Neon Postgres (free tier)** để mọi thứ hoạt động trên Vercel serverless.

Xem spec thiết kế ở `docs/superpowers/specs/2026-09-26-community-system-design.md` và implementation plan ở `docs/superpowers/plans/2026-09-26-community-system.md`.

---

## 1. Yêu cầu tối thiểu

| Thành phần | Phiên bản |
|---|---|
| Node.js | ≥ 18.17 (tested trên 20 LTS) |
| Neon Postgres | free tier — 0.5GB, ~190h compute/tháng (autosuspend) |
| Drizzle ORM | 0.45.x (đã có sẵn) |
| `@neondatabase/serverless` | 1.1.x |
| `postgres` (porsager) | 3.4.x (cho LISTEN connection) |
| Vercel Hobby | OK — maxDuration=60s cho SSE |

---

## 2. Provision Neon

1. Tạo project tại https://console.neon.tech (Free Tier, **East US** để latency về VN tốt nhất trong free region).
2. Copy **Connection string** dạng `postgres://user:password@ep-xxxxx.us-east-1.aws.neon.tech/neondb?sslmode=require`.
3. Paste vào `.env.local`:
   ```
   DATABASE_URL="postgres://user:password@ep-xxxxx.us-east-1.aws.neon.tech/neondb?sslmode=require"
   ```
4. Trên Vercel: Settings → Environment Variables → thêm `DATABASE_URL` (cùng giá trị trên, áp dụng cho Production/Preview/Development).

---

## 3. Khởi tạo database (lần đầu)

```bash
# Generate Drizzle SQL từ db/schema.ts (chỉ cần khi schema thay đổi)
npm run db:generate
# Apply migration lên Neon
npm run db:migrate
# Seed demo user + admin (idempotent — chạy nhiều lần vẫn OK)
npm run db:seed
# Import users + sessions từ data/users.json + data/sessions.json hiện có
npm run db:import-legacy
```

Lệnh `db:import-legacy` sẽ rename `data/users.json` và `data/sessions.json` thành `*.migrated-<timestamp>` sau khi import xong (an toàn để rollback).

---

## 4. Idempotency

| Script | Hành vi khi chạy lặp |
|---|---|
| `db:seed` | Bỏ qua nếu user đã tồn tại (lookup theo email) |
| `db:import-legacy` | INSERT ... ON CONFLICT DO NOTHING theo email |
| Demo user fixed id `usr_demo_rubbyfilm_001` | seed script guard bằng existence check; import script guard bằng `onConflictDoNothing` |
| Admin user fixed id `usr_admin_rubbyfilm_001` | tương tự |

---

## 5. Bảng (col -> name → use case)

- `users` — id, name, email (unique), passwordHash, salt, avatarUrl, role (`user|vip|admin`), createdAt.
- `authentication_identities` — multi-provider link (credentials/Google/Facebook). UNIQUE(provider, provider_account_id).
- `sessions` — token (unique, HMAC-signed), user_id, expires_at. INDEX expires_at cho cleanup.
- `movie_ratings` — UNIQUE(user_id, movie_id) → idempotent re-vote (Review Focus #2). CHECK rating BETWEEN 1 AND 5.
- `comments` — self-FK `parent_id`. Depth-2 cap enforced at service layer (max 2 levels).
- `comment_likes` — UNIQUE(user_id, comment_id) → race-safe double-tap (Review Focus #1).
- `comment_reports` — UNIQUE(reporter_user_id, comment_id).

Indexes cover all primary query patterns (rate aggregator, comment list by movie, reports by status).

---

## 6. Realtime SSE

Endpoint: `GET /api/community/stream?movieId=<id>` (cùng-origin, `credentials: "include"`).

- Server: `ReadableStream` (`maxDuration=60s`), subscribes `LISTEN channel_movie_<id>` trên porsager connection, `NOTIFY` từ `communityRepository.notify` đẩy payload vào stream.
- 55s server chủ động đóng (`event: end`) → client browser auto-reconnect (`EventSource` semantics).
- Heartbeat `event: ping` mỗi 25s giữ connection sống qua proxy.
- Lỗi mạng → client `error` handler reconnect sau 3s (polling fallback ngầm định).

`communityRepository.notify` là **dual emit**: in-process `EventEmitter` (same-instance instant) + Postgres `NOTIFY` (cross-instance fan-out). Free tier latency US-East → VN ~250ms; acceptable cho ≤2s SLA.

> Note: connection LISTEN là process-global (1 long-lived postgres connection per instance). Vercel cold start có thể mất 1-2s để warm.

---

## 7. Rate limits (per userId)

| Endpoint | Limit | Window |
|---|---|---|
| `POST /api/community/ratings` | 30 | 60s |
| `DELETE /api/community/ratings` | 30 | 60s |
| `POST /api/community/comments` | 10 | 60s |
| `PATCH /api/community/comments/[id]` | 10 | 60s |
| `DELETE /api/community/comments/[id]` | 10 | 60s |
| `POST /api/community/comments/[id]/like` | 60 | 60s |
| `POST /api/community/comments/[id]/report` | 5 | 60s |

Vi phạm → 429 + `Retry-After`. Token bucket in-memory (per-instance) — không chính xác 100% trên multi-instance, đủ ràng buộc abuse.

---

## 8. Auth contract (caller surface không đổi)

- `useAuth()` từ `@/lib/auth/authContext` — return `{user, isAuthenticated, openAuthModal, ...}`.
- `authRepository` (service) — public method names + return shapes preserved; chỉ backing store đổi từ JSON files → Postgres.
- Cookie names giữ nguyên: `rubbyfilm_session`, `rubbyfilm_oauth_state`, `rubbyfilm_user_hint`.

Migration cutover **tự động**: chỉ một code path. `data/users.json` không được ghi mới (chỉ read một lần bởi `db:import-legacy`).

---

## 9. Free-tier limits (Neon) & khuyến nghị

- Storage: 0.5GB → đủ cho ~10–20 nghìn comments + users tùy length content.
- Compute: 190h/tháng autosuspend → nếu site idle, không tốn. Cold-start thêm 200-500ms.
- Region: **US East 1** (`aws-us-east-1`) là free region tốt nhất cho VN.
- Backup: Neon free tier không có point-in-time. Production nên upgrade Pro.

---

## 10. Rollback

Giữ `data/users.json.migrated-<ts>` và `data/sessions.json.migrated-<ts>` ít nhất **7 ngày** sau cutover.

```bash
# Revert Postgres → JSON
mv data/users.json.migrated-2026-09-26T12-00-00Z data/users.json
mv data/sessions.json.migrated-2026-09-26T12-00-00Z data/sessions.json
git revert <commit-sha-of-cutover>
# Vercel redeploy
```

---

## 11. Local dev (không có Neon)

Có thể chạy app **mà không** set `DATABASE_URL`:
- `communityRepository.notify` bỏ qua `postgres_notify`, chỉ emit in-process.
- Auth sẽ fail khi register/login. Để test end-to-end cần Neon.
- Mọi test Vitest đều có `describe.skipIf(!process.env.DATABASE_URL)` — không cần DB.

---

## 12. Manual smoke checklist (spec §21)

- [ ] Đăng ký → đăng nhập → rate 4★ → comment → reply → like → edit → report
- [ ] Logout → visit movie → thấy stats + comments → click like → AuthModal opens
- [ ] Hai tab cùng movieId: A post → B thấy via SSE trong ≤ 2s
- [ ] Mobile 375x667: layout nguyên vẹn, sections xếp dọc
- [ ] Admin role: hide report → comment hiển thị "[removed]" ở mọi nơi
- [ ] `data/users.json` không bị ghi mới sau cutover

---

## 13. Files of interest

```
db/
  schema.ts               # All tables + enums
  client.ts               # Drizzle client (Neon HTTP)
  migrations/             # Generated SQL
src/lib/
  auth/authService.ts     # Auth repo (Drizzle-backed, JSON surface gone)
  auth/authContext.tsx    # useAuth() — unchanged public
  community/
    communityRepository.ts  # dual emit (EventEmitter + pg_notify)
    listenClient.ts        # porsager LISTEN client (1 connection, max:1)
    events.ts              # CommunityEventType union
    ids.ts                 # genId(prefix)
    validators.ts          # validateRating / validateCommentContent
    ratingService.ts       # upsert + stats
    commentService.ts      # list + create + edit + delete (soft/hard)
    likeService.ts         # toggle (race-safe)
    reportService.ts       # create + list + updateStatus
    getCurrentUser.ts      # requireAdmin + HttpError
src/app/api/community/
  ratings/route.ts
  comments/route.ts
  comments/[id]/route.ts
  comments/[id]/like/route.ts
  comments/[id]/report/route.ts
  stream/route.ts         # SSE
src/app/api/users/[id]/route.ts        # public profile preview
src/app/api/admin/moderation/reports/route.ts
src/app/api/admin/moderation/reports/[id]/route.ts
src/app/admin/moderation/page.tsx
src/components/community/
  rating/   comments/   profile/
src/hooks/use-community.ts             # useRating, useComments, useCommentStream,
                                       # useLike, useReport, useProfilePreview,
                                       # useCommunityDeDupe helpers
scripts/
  seed.ts
  import-legacy-json.ts
```
