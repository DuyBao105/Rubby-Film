import { describe, it, expect } from "vitest";

const hasDb = !!process.env.DATABASE_URL;

(hasDb ? describe : describe.skip)("commentService (DB-gated)", () => {
  async function newUser(tag: string) {
    const { db } = await import("@db/client");
    const { users } = await import("@db/schema");
    const { genId } = await import("@/lib/community/ids");
    const id = genId("usr");
    const email = `c_${tag}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@x.vn`;
    await db.insert(users).values({ id, name: tag, email, role: "user" }).onConflictDoNothing();
    return id;
  }

  it("preserves XSS payload exactly (Review Focus #3)", async () => {
    const { commentService } = await import("@/lib/community/commentService");
    const u = await newUser("xss");
    const c = await commentService.create({
      userId: u, movieId: "mX",
      content: "<script>alert(1)</script>", isSpoiler: false,
    });
    expect(c.content).toBe("<script>alert(1)</script>");
  });

  it("rejects depth 3 (MAX_DEPTH cap at 2)", async () => {
    const { commentService } = await import("@/lib/community/commentService");
    const u = await newUser("d");
    const lvl1 = await commentService.create({ userId: u, movieId: "mD", content: "A", isSpoiler: false });
    const lvl2 = await commentService.create({ userId: u, movieId: "mD", parentId: lvl1.id, content: "B", isSpoiler: false });
    await expect(
      commentService.create({ userId: u, movieId: "mD", parentId: lvl2.id, content: "C", isSpoiler: false }),
    ).rejects.toMatchObject({ code: "MAX_DEPTH" });
  });

  it("edit preserves isSpoiler + rejects non-owner", async () => {
    const { commentService } = await import("@/lib/community/commentService");
    const owner = await newUser("own");
    const other = await newUser("oth");
    const c = await commentService.create({ userId: owner, movieId: "mS", content: "spoiler time", isSpoiler: true });
    const e = await commentService.edit({ commentId: c.id, userId: owner, isAdmin: false, content: "updated" });
    expect(e.isSpoiler).toBe(true);
    expect(e.content).toBe("updated");
    await expect(
      commentService.edit({ commentId: c.id, userId: other, isAdmin: false, content: "hijack" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("delete is soft when replies exist, hard when leaf", async () => {
    const { commentService } = await import("@/lib/community/commentService");
    const { db } = await import("@db/client");
    const { comments } = await import("@db/schema");
    const { eq } = await import("drizzle-orm");
    const u = await newUser("del");

    const leaf = await commentService.create({ userId: u, movieId: "mDel", content: "leaf", isSpoiler: false });
    await commentService.delete({ commentId: leaf.id, userId: u, isAdmin: false });
    const leafRows = await db.select().from(comments).where(eq(comments.id, leaf.id));
    expect(leafRows.length).toBe(0); // hard delete

    const parent = await commentService.create({ userId: u, movieId: "mDel2", content: "p", isSpoiler: false });
    await commentService.create({ userId: u, movieId: "mDel2", parentId: parent.id, content: "kid", isSpoiler: false });
    await commentService.delete({ commentId: parent.id, userId: u, isAdmin: false });
    const parentRows = await db.select().from(comments).where(eq(comments.id, parent.id));
    expect(parentRows.length).toBe(1); // kept
    expect(parentRows[0].deletedAt).toBeTruthy();
    expect(parentRows[0].content).toBe("[removed]");
  });

  it("list returns top-level + 1-level replies, viewer-scoped like", async () => {
    const { commentService } = await import("@/lib/community/commentService");
    const { db } = await import("@db/client");
    const { commentLikes } = await import("@db/schema");
    const { genId } = await import("@/lib/community/ids");
    const viewer = await newUser("vw");
    const author = await newUser("au");
    const tag = `L${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const movieId = tag;

    const top1 = await commentService.create({ userId: author, movieId, content: "top1", isSpoiler: false });
    await new Promise((r) => setTimeout(r, 5));
    const top2 = await commentService.create({ userId: author, movieId, content: "top2", isSpoiler: false });
    const reply = await commentService.create({ userId: author, movieId, parentId: top1.id, content: "r", isSpoiler: false });

    await db.insert(commentLikes).values({ id: genId("like"), userId: viewer, commentId: top1.id });

    const page = await commentService.list({ movieId, sort: "newest", viewerId: viewer });
    expect(page.total).toBe(2);
    expect(page.items.length).toBe(2);
    const newest = page.items[0];
    expect(newest.id).toBe(top2.id);
    expect(newest.likeCount).toBe(0);
    const older = page.items.find((i) => i.id === top1.id)!;
    expect(older.likeCount).toBe(1);
    expect(older.likedByViewer).toBe(true);
    expect(older.replies?.length).toBe(1);
    expect(older.replies![0].id).toBe(reply.id);

    const guest = await commentService.list({ movieId, sort: "newest" });
    expect(guest.items[0].likedByViewer).toBe(false);
  });

  it("rejects empty/overlong content", async () => {
    const { commentService } = await import("@/lib/community/commentService");
    const u = await newUser("v");
    await expect(commentService.create({ userId: u, movieId: "mV", content: "", isSpoiler: false }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(commentService.create({ userId: u, movieId: "mV", content: "x".repeat(1001), isSpoiler: false }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
