import { describe, it, expect } from "vitest";

const hasDb = !!process.env.DATABASE_URL;

(hasDb ? describe : describe.skip)("ratingService (DB-gated, Review Focus #2)", () => {
  it("upsert idempotent + re-vote updates in place (Review Focus #2)", async () => {
    const { ratingService } = await import("@/lib/community/ratingService");
    const { db } = await import("@db/client");
    const { users } = await import("@db/schema");
    const { genId } = await import("@/lib/community/ids");

    const email = `r_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@x.vn`;
    const id = genId("usr");
    await db.insert(users).values({ id, name: "R", email, role: "user" }).onConflictDoNothing();

    const movieId = `mX_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const r1 = await ratingService.upsert({ userId: id, movieId, movieSlug: "x", rating: 4 });
    expect(r1.viewerRating).toBe(4);
    expect(r1.count).toBe(1);
    expect(r1.average).toBe(4);
    expect(r1.distribution[4]).toBe(1);

    const before = await db.query.movieRatings.findFirst({
      where: (t, { and, eq }) => and(eq(t.userId, id), eq(t.movieId, movieId)),
    });
    expect(before?.rating).toBe(4);

    await new Promise((r) => setTimeout(r, 20));
    const r2 = await ratingService.upsert({ userId: id, movieId, movieSlug: "x", rating: 3 });
    expect(r2.viewerRating).toBe(3);
    expect(r2.count).toBe(1); // still one row
    expect(r2.distribution[3]).toBe(1);
    expect(r2.distribution[4]).toBe(0);

    const after = await db.query.movieRatings.findFirst({
      where: (t, { and, eq }) => and(eq(t.userId, id), eq(t.movieId, movieId)),
    });
    expect(after?.rating).toBe(3);
    expect(after?.id).toBe(before?.id); // same row id — update in place
    expect(after!.updatedAt.getTime()).toBeGreaterThan(before!.updatedAt.getTime());
  });

  it("getStats aggregates multiple users; getViewerRating returns own or null; delete removes", async () => {
    const { ratingService } = await import("@/lib/community/ratingService");
    const { db } = await import("@db/client");
    const { users } = await import("@db/schema");
    const { genId } = await import("@/lib/community/ids");

    const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const u1 = genId("usr"), u2 = genId("usr"), u3 = genId("usr");
    await db.insert(users).values([
      { id: u1, name: "A", email: `a_${suffix}@x.vn`, role: "user" },
      { id: u2, name: "B", email: `b_${suffix}@x.vn`, role: "user" },
      { id: u3, name: "C", email: `c_${suffix}@x.vn`, role: "user" },
    ]).onConflictDoNothing();
    const movieId = `m${suffix}`;

    await ratingService.upsert({ userId: u1, movieId, movieSlug: "x", rating: 5 });
    await ratingService.upsert({ userId: u2, movieId, movieSlug: "x", rating: 3 });
    await ratingService.upsert({ userId: u3, movieId, movieSlug: "x", rating: 3 });

    const stats = await ratingService.getStats(movieId, u1);
    expect(stats.count).toBe(3);
    expect(stats.average).toBeCloseTo(11 / 3, 5);
    expect(stats.distribution[3]).toBe(2);
    expect(stats.distribution[5]).toBe(1);
    expect(stats.viewerRating).toBe(5);

    expect(await ratingService.getViewerRating(movieId, u2)).toBe(3);
    const guest = await ratingService.getStats(movieId);
    expect(guest.viewerRating).toBeNull();

    await ratingService.delete(u3, movieId);
    const after = await ratingService.getStats(movieId, u3);
    expect(after.count).toBe(2);
    expect(after.viewerRating).toBeNull();
  });

  it("rejects invalid rating", async () => {
    const { ratingService } = await import("@/lib/community/ratingService");
    await expect(ratingService.upsert({ userId: "u", movieId: "m", movieSlug: "s", rating: 6 }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
