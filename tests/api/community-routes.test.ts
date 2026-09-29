import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: () => undefined }),
}));
vi.mock("@/lib/auth/authService", () => ({
  authRepository: { getSession: vi.fn(async () => null) },
}));
// Stub the DB layer so the route's import chain (route -> service -> @db/client)
// doesn't blow up on missing DATABASE_URL in unit tests. These tests only
// assert the 401 contract; service code is never invoked.
vi.mock("@db/client", () => ({
  db: new Proxy({}, { get: () => () => undefined }),
}));

import { PATCH as patchComment, DELETE as deleteComment } from "@/app/api/community/comments/[id]/route";
import { POST as postLike } from "@/app/api/community/comments/[id]/like/route";
import { POST as postReport } from "@/app/api/community/comments/[id]/report/route";

function ctxWithId(id = "cmt_test123") {
  return { params: Promise.resolve({ id }) };
}
function fakeRequest(body?: unknown) {
  return new Request("http://test/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as import("next/server").NextRequest;
}

describe("comment [id] route — 401 contract (Review Focus #5)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("PATCH /comments/[id] returns 401 UNAUTHENTICATED when no cookie", async () => {
    const res = await patchComment(fakeRequest({ content: "edit" }), ctxWithId());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toMatchObject({ success: false, error: { code: "UNAUTHENTICATED" } });
  });

  it("DELETE /comments/[id] returns 401 UNAUTHENTICATED when no cookie", async () => {
    const res = await deleteComment(fakeRequest(), ctxWithId());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toMatchObject({ success: false, error: { code: "UNAUTHENTICATED" } });
  });

  it("POST /comments/[id]/like returns 401 UNAUTHENTICATED when no cookie", async () => {
    const res = await postLike(fakeRequest(), ctxWithId());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toMatchObject({ success: false, error: { code: "UNAUTHENTICATED" } });
  });

  it("POST /comments/[id]/report returns 401 UNAUTHENTICATED when no cookie", async () => {
    const res = await postReport(fakeRequest({ reason: "spam" }), ctxWithId());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toMatchObject({ success: false, error: { code: "UNAUTHENTICATED" } });
  });
});
