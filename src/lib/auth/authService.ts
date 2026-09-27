import crypto from "node:crypto";
import { eq, and, gt } from "drizzle-orm";
import { db } from "@db/client";
import { users, authenticationIdentities, sessions } from "@db/schema";
import { genId } from "@/lib/community/ids";
import {
  AuthUser, AuthSession, RegisterInput, AuthProvider, AuthenticationIdentity, OAuthProfile,
} from "./authTypes";

export const AUTH_COOKIE_NAME = "rubbyfilm_session";
export const OAUTH_STATE_COOKIE_NAME = "rubbyfilm_oauth_state";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

const AUTH_SECRET =
  process.env.AUTH_SECRET ||
  process.env.GOOGLE_CLIENT_SECRET ||
  process.env.FACEBOOK_CLIENT_SECRET ||
  "rubbyfilm_jwt_secret_fallback_key_2026";

export function signOAuthState(payload: Record<string, any>): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", AUTH_SECRET).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyOAuthState(stateStr: string): Record<string, any> | null {
  if (!stateStr) return null;
  try {
    const parts = stateStr.split(".");
    if (parts.length === 2) {
      const [data, sig] = parts;
      const expectedSig = crypto.createHmac("sha256", AUTH_SECRET).update(data).digest("base64url");
      if (sig === expectedSig) {
        const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf-8"));
        if (payload.timestamp && Date.now() - payload.timestamp < 15 * 60 * 1000) {
          return payload;
        }
      }
    }
  } catch {}
  return null;
}

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  passwordHash?: string;
  salt?: string;
  avatarUrl?: string;
  role: "user" | "vip" | "admin";
  identities: AuthenticationIdentity[];
  createdAt: number;
}

async function rowToRecord(userId: string): Promise<UserRecord | null> {
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const u = rows[0];
  if (!u) return null;
  const idents = await db.select().from(authenticationIdentities)
    .where(eq(authenticationIdentities.userId, userId));
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    passwordHash: u.passwordHash ?? undefined,
    salt: u.salt ?? undefined,
    avatarUrl: u.avatarUrl ?? undefined,
    role: u.role,
    identities: idents.map((i) => ({
      id: i.id,
      userId: i.userId,
      provider: i.provider,
      providerAccountId: i.providerAccountId,
      email: i.email ?? undefined,
      createdAt: i.createdAt.getTime(),
      lastUsedAt: i.lastUsedAt ? i.lastUsedAt.getTime() : undefined,
    })),
    createdAt: u.createdAt.getTime(),
  };
}

function toSafeUser(stored: UserRecord): AuthUser {
  const providers: AuthProvider[] = [];
  if (stored.passwordHash) providers.push("credentials");
  for (const ident of stored.identities) {
    if (!providers.includes(ident.provider)) providers.push(ident.provider);
  }
  return {
    id: stored.id,
    name: stored.name,
    email: stored.email,
    avatarUrl: stored.avatarUrl,
    role: stored.role,
    providers,
    identities: stored.identities.map((i) => ({ ...i })),
    createdAt: stored.createdAt,
  };
}

class AuthRepository {
  private hashPassword(password: string, salt: string): string {
    return crypto.scryptSync(password, salt, 64).toString("hex");
  }

  public async findByEmail(email: string): Promise<UserRecord | null> {
    const rows = await db.select().from(users)
      .where(eq(users.email, email.toLowerCase().trim())).limit(1);
    const u = rows[0];
    return u ? rowToRecord(u.id) : null;
  }

  public async findById(id: string): Promise<UserRecord | null> {
    return rowToRecord(id);
  }

  public async findByIdentity(
    provider: AuthProvider, providerAccountId: string,
  ): Promise<UserRecord | null> {
    const rows = await db.select().from(authenticationIdentities).where(and(
      eq(authenticationIdentities.provider, provider),
      eq(authenticationIdentities.providerAccountId, providerAccountId),
    )).limit(1);
    const i = rows[0];
    return i ? rowToRecord(i.userId) : null;
  }

  public async createUser(input: RegisterInput): Promise<AuthUser> {
    const cleanEmail = input.email.toLowerCase().trim();
    const existing = await this.findByEmail(cleanEmail);
    if (existing) {
      throw new Error("Email này đã được sử dụng. Vui lòng chọn email khác.");
    }
    const salt = crypto.randomBytes(16).toString("hex");
    const passwordHash = this.hashPassword(input.password, salt);
    const id = genId("usr");
    await db.insert(users).values({
      id, name: input.name.trim(), email: cleanEmail,
      passwordHash, salt, role: "user", createdAt: new Date(),
    });
    await db.insert(authenticationIdentities).values({
      id: genId("ident"), userId: id, provider: "credentials",
      providerAccountId: cleanEmail, email: cleanEmail, createdAt: new Date(),
    });
    const rec = await rowToRecord(id);
    if (!rec) throw new Error("Failed to create user");
    return toSafeUser(rec);
  }

  public async findOrCreateFromOAuth(profile: OAuthProfile): Promise<AuthUser> {
    const cleanEmail = profile.email.toLowerCase().trim();
    let existing = await this.findByIdentity(profile.provider, profile.providerAccountId);
    if (existing) {
      await db.update(authenticationIdentities)
        .set({ lastUsedAt: new Date() })
        .where(and(
          eq(authenticationIdentities.provider, profile.provider),
          eq(authenticationIdentities.providerAccountId, profile.providerAccountId),
        ));
      return toSafeUser(existing);
    }
    existing = await this.findByEmail(cleanEmail);
    if (existing) {
      const hasIdentity = existing.identities.some((i) => i.provider === profile.provider);
      if (!hasIdentity) {
        await db.insert(authenticationIdentities).values({
          id: genId("ident"), userId: existing.id, provider: profile.provider,
          providerAccountId: profile.providerAccountId, email: cleanEmail,
          createdAt: new Date(), lastUsedAt: new Date(),
        });
      }
      if (!existing.avatarUrl && profile.avatarUrl) {
        await db.update(users).set({ avatarUrl: profile.avatarUrl }).where(eq(users.id, existing.id));
      }
      const fresh = await rowToRecord(existing.id);
      return fresh ? toSafeUser(fresh) : toSafeUser(existing);
    }
    const newUserId = genId("usr");
    const newName = profile.name.trim() || (profile.provider === "google" ? "Google User" : "Facebook User");
    await db.insert(users).values({
      id: newUserId, name: newName, email: cleanEmail,
      avatarUrl: profile.avatarUrl ?? null, role: "user", createdAt: new Date(),
    });
    await db.insert(authenticationIdentities).values({
      id: genId("ident"), userId: newUserId, provider: profile.provider,
      providerAccountId: profile.providerAccountId, email: cleanEmail,
      createdAt: new Date(), lastUsedAt: new Date(),
    });
    const rec = await rowToRecord(newUserId);
    if (!rec) throw new Error("Failed to create OAuth user");
    return toSafeUser(rec);
  }

  public async unlinkProvider(userId: string, provider: AuthProvider): Promise<AuthUser> {
    const user = await this.findById(userId);
    if (!user) throw new Error("Không tìm thấy thông tin người dùng.");
    const hasPassword = Boolean(user.passwordHash);
    const oauthCount = user.identities.filter((i) => i.provider !== "credentials").length;
    const totalLoginMethods = (hasPassword ? 1 : 0) + oauthCount;
    if (totalLoginMethods <= 1) {
      throw new Error(
        "Không thể hủy liên kết phương thức đăng nhập duy nhất của tài khoản. Vui lòng thiết lập mật khẩu hoặc liên kết tài khoản khác trước.",
      );
    }
    await db.delete(authenticationIdentities).where(and(
      eq(authenticationIdentities.userId, userId),
      eq(authenticationIdentities.provider, provider),
    ));
    const fresh = await rowToRecord(userId);
    return fresh ? toSafeUser(fresh) : toSafeUser(user);
  }

  public async updateUserProfile(
    userId: string, updates: { name?: string; avatarUrl?: string },
  ): Promise<AuthUser> {
    const user = await this.findById(userId);
    if (!user) throw new Error("Không tìm thấy thông tin tài khoản.");
    const patch: { name?: string; avatarUrl?: string | null } = {};
    if (updates.name && updates.name.trim()) patch.name = updates.name.trim();
    if (updates.avatarUrl !== undefined) patch.avatarUrl = updates.avatarUrl;
    if (Object.keys(patch).length > 0) {
      await db.update(users).set(patch).where(eq(users.id, userId));
    }
    const fresh = await rowToRecord(userId);
    return fresh ? toSafeUser(fresh) : toSafeUser(user);
  }

  public async resetPassword(email: string, newPassword: string): Promise<AuthUser> {
    const cleanEmail = email.toLowerCase().trim();
    const user = await this.findByEmail(cleanEmail);
    if (!user) throw new Error("Không tìm thấy tài khoản với địa chỉ email này.");
    if (newPassword.length < 6) throw new Error("Mật khẩu mới phải có tối thiểu 6 ký tự.");
    const salt = crypto.randomBytes(16).toString("hex");
    const passwordHash = this.hashPassword(newPassword, salt);
    await db.update(users).set({ passwordHash, salt }).where(eq(users.id, user.id));
    const hasCred = user.identities.some((i) => i.provider === "credentials");
    if (!hasCred) {
      await db.insert(authenticationIdentities).values({
        id: genId("ident"), userId: user.id, provider: "credentials",
        providerAccountId: cleanEmail, email: cleanEmail, createdAt: new Date(),
      });
    }
    const fresh = await rowToRecord(user.id);
    return fresh ? toSafeUser(fresh) : toSafeUser(user);
  }

  public verifyPassword(user: UserRecord, passwordAttempt: string): boolean {
    if (!user.passwordHash || !user.salt) return false;
    const hash = this.hashPassword(passwordAttempt, user.salt);
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(user.passwordHash, "hex"));
  }

  public async createSession(user: AuthUser): Promise<AuthSession> {
    const expiresAt = Date.now() + SESSION_DURATION_MS;
    const payload = { sub: user.id, user, exp: expiresAt, iat: Date.now() };
    const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const sig = crypto.createHmac("sha256", AUTH_SECRET).update(payloadBase64).digest("base64url");
    const token = `${payloadBase64}.${sig}`;
    await db.insert(sessions).values({
      id: genId("sess"), token, userId: user.id,
      expiresAt: new Date(expiresAt), createdAt: new Date(), lastSeenAt: new Date(),
    });
    return { token, user, expiresAt };
  }

  public async getSession(token: string): Promise<AuthSession | null> {
    if (!token) return null;
    let payload: { exp: number; user: AuthUser; sub: string } | null = null;
    try {
      const parts = token.split(".");
      if (parts.length === 2) {
        const [payloadBase64, sig] = parts;
        const expectedSig = crypto.createHmac("sha256", AUTH_SECRET).update(payloadBase64).digest("base64url");
        if (sig === expectedSig) {
          const parsed = JSON.parse(Buffer.from(payloadBase64, "base64url").toString("utf-8"));
          if (parsed.exp && Date.now() <= parsed.exp && parsed.user) {
            payload = parsed;
          }
        }
      }
    } catch {}
    if (!payload) return null;
    const rows = await db.select({ id: sessions.id }).from(sessions)
      .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date()))).limit(1);
    if (rows.length === 0) return null;
    await db.update(sessions).set({ lastSeenAt: new Date() }).where(eq(sessions.token, token));
    const fresh = await rowToRecord(payload.user.id);
    const safeUser = fresh ? toSafeUser(fresh) : payload.user;
    return { token, user: safeUser, expiresAt: payload.exp };
  }

  public async deleteSession(token: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.token, token));
  }

  public getSafeUser(record: UserRecord): AuthUser {
    return toSafeUser(record);
  }
}

declare global {
  var __rubbyfilm_auth_repo: AuthRepository | undefined;
}

if (
  !globalThis.__rubbyfilm_auth_repo ||
  typeof (globalThis.__rubbyfilm_auth_repo as any).resetPassword !== "function" ||
  typeof (globalThis.__rubbyfilm_auth_repo as any).updateUserProfile !== "function"
) {
  globalThis.__rubbyfilm_auth_repo = new AuthRepository();
}

export const authRepository = globalThis.__rubbyfilm_auth_repo;
