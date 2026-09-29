import { describe, it, expect } from "vitest";

const hasDb = !!process.env.DATABASE_URL;

(hasDb ? describe : describe.skip)("likeService (DB-gated, Review Focus #1)", () => {
  async function freshComment(tag: string) {
    const { db } = await import("@db/client");
    const { users, comments } = await import("@db/schema");
    const { genId } = await import("@/lib/community/ids");
    const userId = genId("usr");
    const cmtId = genId("cmt");
    const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const email = `lk_${tag}_${suffix}@x.vn`;
    await db.insert(users).values({ id: userId, name: "L", email, role: "user" }).onConflictDoNothing();
    await db.insert(comments).values({ id: cmtId, userId, movieId: `mLk_${suffix}`, content: "hi", isSpoiler: false });
    return { userId, cmtId };
  }
  it("double-toggle", async () => {
    const { likeService } = await import("@/lib/community/likeService");
    const { userId, cmtId } = await freshComment("t1");
    expect(await likeService.toggle({ userId, commentId: cmtId })).toEqual({ liked: true, count: 1 });
    expect(await likeService.toggle({ userId, commentId: cmtId })).toEqual({ liked: false, count: 0 });
    expect(await likeService.toggle({ userId, commentId: cmtId })).toEqual({ liked: true, count: 1 });
  });
  it("two users", async () => {
    const { likeService } = await import("@/lib/community/likeService");
    const { db } = await import("@db/client");
    const { users, comments } = await import("@db/schema");
    const { genId } = await import("@/lib/community/ids");
    const suf = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const owner = genId("usr"), cmtId = genId("cmt"), u1 = genId("usr"), u2 = genId("usr");
    await db.insert(users).values([
      { id: owner, name: "o", email: `o_${suf}@x.vn`, role: "user" },
      { id: u1, name: "a", email: `a_${suf}@x.vn`, role: "user" },
      { id: u2, name: "b", email: `b_${suf}@x.vn`, role: "user" },
    ]).onConflictDoNothing();
    await db.insert(comments).values({ id: cmtId, userId: owner, movieId: `mL_${suf}`, content: "hi", isSpoiler: false });
    expect(await likeService.toggle({ userId: u1, commentId: cmtId })).toEqual({ liked: true, count: 1 });
    expect(await likeService.toggle({ userId: u2, commentId: cmtId })).toEqual({ liked: true, count: 2 });
    expect(await likeService.toggle({ userId: u1, commentId: cmtId })).toEqual({ liked: false, count: 1 });
  });
});
