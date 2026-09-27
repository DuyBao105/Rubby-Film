import { describe, it, expect } from "vitest";

const hasDb = !!process.env.DATABASE_URL;

(hasDb ? describe : describe.skip)("communityRepository (DB-gated)", () => {
  it("local fan-out works without DB round-trip", async () => {
    const { communityRepository } = await import("@/lib/community/communityRepository");
    const got: { type: string; movieId: string; payload: unknown }[] = [];
    const off = await communityRepository.subscribe("m1", (e) => got.push(e));
    await communityRepository.notify("m1", "comment_created", { id: "x" });
    expect(got).toHaveLength(1);
    expect(got[0].type).toBe("comment_created");
    expect(got[0].movieId).toBe("m1");
    off();
  });

  it("DB round-trip notify -> subscribe receives", async () => {
    const { communityRepository } = await import("@/lib/community/communityRepository");
    const got: any[] = [];
    const off = await communityRepository.subscribe("m2", (e) => got.push(e));
    await new Promise((r) => setTimeout(r, 100));
    await communityRepository.notify("m2", "rating_upserted", { v: 5 });
    await new Promise((r) => setTimeout(r, 300));
    expect(got.find((g) => g.payload?.v === 5)).toBeTruthy();
    off();
  });

  it("unsubscribe stops delivery", async () => {
    const { communityRepository } = await import("@/lib/community/communityRepository");
    const got: any[] = [];
    const off = await communityRepository.subscribe("m3", (e) => got.push(e));
    await communityRepository.notify("m3", "comment_created", { i: 1 });
    expect(got.length).toBe(1);
    off();
    await communityRepository.notify("m3", "comment_created", { i: 2 });
    expect(got.length).toBe(1);
  });
});


describe("events.channelFor", () => {
  it("namespaces per movie", async () => {
    const { channelFor } = await import("@/lib/community/events");
    expect(channelFor("m1")).toBe("channel_movie_m1");
    expect(channelFor("abc-123")).toBe("channel_movie_abc-123");
  });
});
