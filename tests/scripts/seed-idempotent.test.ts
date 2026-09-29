import { describe, it, expect } from "vitest";

const hasDb = !!process.env.DATABASE_URL;

(hasDb ? describe : describe.skip)("seed idempotency (DB-gated)", () => {
  it("demo user exists with fixed id after seed runs", async () => {
    const { db } = await import("../../db/client");
    const { users } = await import("../../db/schema");
    const u = await db.query.users.findFirst({ where: (t, { eq }) => eq(t.email, "demo@rubbyfilm.vn") });
    expect(u?.id).toBe("usr_demo_rubbyfilm_001");
    expect(u?.role).toBe("vip");
  });

  it("admin user exists with fixed id", async () => {
    const { db } = await import("../../db/client");
    const { users } = await import("../../db/schema");
    const u = await db.query.users.findFirst({ where: (t, { eq }) => eq(t.email, "admin@rubbyfilm.vn") });
    expect(u?.id).toBe("usr_admin_rubbyfilm_001");
    expect(u?.role).toBe("admin");
  });
});
