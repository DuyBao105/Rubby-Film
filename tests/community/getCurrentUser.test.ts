import { describe, it, expect, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));
vi.mock("@/lib/auth/authService", () => ({
  authRepository: { getSession: vi.fn() },
}));

import { cookies } from "next/headers";
import { authRepository } from "@/lib/auth/authService";
import { getCurrentUser, requireAdmin } from "@/lib/community/getCurrentUser";

const mockedCookies = vi.mocked(cookies);
const mockedGetSession = vi.mocked(authRepository.getSession);

function fakeCookieStore(value: string | undefined) {
  return { get: () => (value ? { value } : undefined) } as any;
}

const baseUser = (role: "user" | "admin" = "user") =>
  ({ id: "u1", name: "X", email: "x@x.vn", role, providers: [], identities: [], createdAt: 0 });

describe("getCurrentUser", () => {
  it("returns null when no cookie", async () => {
    mockedCookies.mockReturnValue(fakeCookieStore(undefined));
    expect(await getCurrentUser()).toBeNull();
    expect(mockedGetSession).not.toHaveBeenCalled();
  });

  it("returns null when getSession returns null", async () => {
    mockedCookies.mockReturnValue(fakeCookieStore("x"));
    mockedGetSession.mockResolvedValue(null);
    expect(await getCurrentUser()).toBeNull();
  });

  it("returns user on valid session", async () => {
    mockedCookies.mockReturnValue(fakeCookieStore("tok"));
    mockedGetSession.mockResolvedValue({ token: "tok", expiresAt: 0, user: baseUser() } as any);
    const u = await getCurrentUser();
    expect(u?.id).toBe("u1");
  });
});

describe("requireAdmin", () => {
  it("throws UNAUTHENTICATED when user null", async () => {
    mockedCookies.mockReturnValue(fakeCookieStore(undefined));
    await expect(requireAdmin()).rejects.toThrow("UNAUTHENTICATED");
  });

  it("throws FORBIDDEN when user not admin", async () => {
    mockedCookies.mockReturnValue(fakeCookieStore("tok"));
    mockedGetSession.mockResolvedValue({ token: "tok", expiresAt: 0, user: baseUser("user") } as any);
    await expect(requireAdmin()).rejects.toThrow("FORBIDDEN");
  });

  it("returns admin user", async () => {
    mockedCookies.mockReturnValue(fakeCookieStore("tok"));
    mockedGetSession.mockResolvedValue({ token: "tok", expiresAt: 0, user: baseUser("admin") } as any);
    const u = await requireAdmin();
    expect(u.role).toBe("admin");
  });
});
