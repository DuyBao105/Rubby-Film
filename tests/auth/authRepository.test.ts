import { describe, it, expect, beforeAll } from "vitest";

const hasDb = !!process.env.DATABASE_URL;

(hasDb ? describe : describe.skip)("authRepository (DB-gated)", () => {
  let repo: typeof import("@/lib/auth/authService").authRepository;
  beforeAll(async () => {
    ({ authRepository: repo } = await import("@/lib/auth/authService"));
  });

  it("createUser + findByEmail + verifyPassword roundtrip", async () => {
    const email = `t_${Date.now()}@x.vn`;
    const u = await repo.createUser({ name: "T", email, password: "Secret@123" });
    expect(u.email).toBe(email);
    expect(u.role).toBe("user");
    const rec = await repo.findByEmail(email);
    expect(rec?.passwordHash).toBeTruthy();
    expect(rec?.salt).toBeTruthy();
    expect(repo.verifyPassword(rec!, "Secret@123")).toBe(true);
    expect(repo.verifyPassword(rec!, "wrong")).toBe(false);
  });

  it("createSession -> getSession -> deleteSession (revocation)", async () => {
    const email = `s_${Date.now()}@x.vn`;
    const u = await repo.createUser({ name: "S", email, password: "Secret@123" });
    const s = await repo.createSession(u);
    const got = await repo.getSession(s.token);
    expect(got?.user.id).toBe(u.id);
    await repo.deleteSession(s.token);
    expect(await repo.getSession(s.token)).toBeNull();
  });

  it("duplicate email throws Vietnamese error", async () => {
    const email = `d_${Date.now()}@x.vn`;
    await repo.createUser({ name: "D", email, password: "Secret@123" });
    await expect(repo.createUser({ name: "D2", email, password: "Secret@123" }))
      .rejects.toThrow("Email này đã được sử dụng");
  });

  it("updateUserProfile + resetPassword preserve identity chain", async () => {
    const email = `u_${Date.now()}@x.vn`;
    const u = await repo.createUser({ name: "U", email, password: "Secret@123" });
    const updated = await repo.updateUserProfile(u.id, { name: "U2" });
    expect(updated.name).toBe("U2");
    const reset = await repo.resetPassword(email, "NewSecret@9");
    expect(reset.id).toBe(u.id);
    const rec = await repo.findByEmail(email);
    expect(repo.verifyPassword(rec!, "NewSecret@9")).toBe(true);
  });

  it("unlinkProvider blocks last login method", async () => {
    const email = `l_${Date.now()}@x.vn`;
    const u = await repo.createUser({ name: "L", email, password: "Secret@123" });
    await expect(repo.unlinkProvider(u.id, "credentials")).rejects.toThrow(
      "Không thể hủy liên kết phương thức đăng nhập duy nhất",
    );
  });

  it("getSafeUser hides passwordHash/salt", async () => {
    const email = `g_${Date.now()}@x.vn`;
    const u = await repo.createUser({ name: "G", email, password: "Secret@123" });
    const rec = await repo.findByEmail(email);
    const safe = repo.getSafeUser(rec!);
    expect((safe as any).passwordHash).toBeUndefined();
    expect((safe as any).salt).toBeUndefined();
    expect(safe.providers).toContain("credentials");
  });
});
