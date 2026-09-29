import { cookies, headers } from "next/headers";
import { authRepository } from "@/lib/auth/authService";
import type { AuthUser } from "@/lib/auth/authTypes";

export const AUTH_COOKIE_NAME = "rubbyfilm_session";

export async function getCurrentUser(): Promise<AuthUser | null> {
  const jar = await cookies();
  let token = jar.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    try {
      const head = await headers();
      const authHeader = head.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.substring(7).trim();
      }
    } catch {}
  }
  if (!token) return null;
  const s = await authRepository.getSession(token);
  return s?.user ?? null;
}

export class HttpError extends Error {
  constructor(
    public code: "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "BAD_REQUEST" | "RATE_LIMITED",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "HttpError";
  }
}

export async function requireAdmin(): Promise<AuthUser> {
  const u = await getCurrentUser();
  if (!u) throw new HttpError("UNAUTHENTICATED");
  if (u.role !== "admin") throw new HttpError("FORBIDDEN");
  return u;
}
