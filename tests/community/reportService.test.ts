import { describe, it, expect } from "vitest";

const hasDb = !!process.env.DATABASE_URL;

(hasDb ? describe : describe.skip)("reportService (DB-gated)", () => {
  async function setup(tag: string) {
    const { db } = await import("@db/client");
    const { users, comments } = await import("@db/schema");
    const { genId } = await import("@/lib/community/ids");
    const suf = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const author = genId("usr");
    const reporter = genId("usr");
    const admin = genId("usr");
    const cmtId = genId("cmt");
    await db.insert(users).values([
      { id: author, name: "au", email: `ra_${tag}_${suf}@x.vn`, role: "user" },
      { id: reporter, name: "rp", email: `rr_${tag}_${suf}@x.vn`, role: "user" },
      { id: admin, name: "ad", email: `rd_${tag}_${suf}@x.vn`, role: "admin" },
    ]).onConflictDoNothing();
    await db.insert(comments).values({ id: cmtId, userId: author, movieId: `mR_${suf}`, content: "bad stuff", isSpoiler: false });
    return { reporter, admin, cmtId };
  }

  it("rejects duplicate report from same user", async () => {
    const { reportService } = await import("@/lib/community/reportService");
    const { reporter, cmtId } = await setup("dup");
    await reportService.create({ reporterUserId: reporter, commentId: cmtId, reason: "spam" });
    await expect(reportService.create({ reporterUserId: reporter, commentId: cmtId, reason: "spam" }))
      .rejects.toMatchObject({ code: "ALREADY_REPORTED" });
  });

  it("rejects invalid reason + unknown comment", async () => {
    const { reportService } = await import("@/lib/community/reportService");
    const { reporter, cmtId } = await setup("inv");
    await expect(reportService.create({ reporterUserId: reporter, commentId: cmtId, reason: "bogus" }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(reportService.create({ reporterUserId: reporter, commentId: "no-cmt", reason: "spam" }))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("list + updateStatus require admin", async () => {
    const { reportService } = await import("@/lib/community/reportService");
    const { reporter, admin, cmtId } = await setup("adm");
    const { id } = await reportService.create({ reporterUserId: reporter, commentId: cmtId, reason: "abuse", description: "ok" });
    await expect(reportService.list({ adminId: reporter })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(reportService.updateStatus({ reportId: id, adminId: reporter, status: "dismissed" }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    const page = await reportService.list({ adminId: admin });
    expect(page.total).toBeGreaterThanOrEqual(1);
    const mine = page.items.find((i) => i.id === id);
    expect(mine?.reason).toBe("abuse");
    expect(mine?.comment.content).toBe("bad stuff");
    await reportService.updateStatus({ reportId: id, adminId: admin, status: "dismissed" });
    const filtered = await reportService.list({ adminId: admin, status: "dismissed" });
    expect(filtered.items.some((i) => i.id === id)).toBe(true);
  });
});
