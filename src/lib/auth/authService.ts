import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
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

const DATA_DIR = path.join(process.cwd(), "data");
const TMP_DIR = path.join(process.env.TEMP || process.env.TMP || "/tmp", "rubbyfilm_data");
const USERS_FILENAME = "users.json";
const SESSIONS_FILENAME = "sessions.json";
const USERS_FILE = path.join(DATA_DIR, USERS_FILENAME);
const SESSIONS_FILE = path.join(DATA_DIR, SESSIONS_FILENAME);

function getCandidatePaths(filePath: string): string[] {
  const filename = path.basename(filePath);
  return [
    path.join(TMP_DIR, filename),
    path.join(DATA_DIR, filename),
  ];
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  for (const candidate of getCandidatePaths(filePath)) {
    try {
      if (fs.existsSync(candidate)) {
        const content = fs.readFileSync(candidate, "utf-8");
        return JSON.parse(content) as T;
      }
    } catch {}
  }
  try {
    if (filePath.includes(USERS_FILENAME) && fs.existsSync(DATA_DIR)) {
      const files = fs.readdirSync(DATA_DIR);
      const migrated = files.find((f) => f.startsWith("users.json.migrated-"));
      if (migrated) {
        const content = fs.readFileSync(path.join(DATA_DIR, migrated), "utf-8");
        const parsed = JSON.parse(content);
        writeJsonFile(filePath, parsed);
        return parsed as T;
      }
    }
  } catch {}
  return fallback;
}

function writeJsonFile(filePath: string, data: any): void {
  for (const candidate of getCandidatePaths(filePath)) {
    try {
      const dir = path.dirname(candidate);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(candidate, JSON.stringify(data, null, 2), "utf-8");
    } catch {
      // In read-only serverless environment, DATA_DIR may fail, but TMP_DIR will succeed
    }
  }
}

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
  for (const ident of stored.identities || []) {
    if (!providers.includes(ident.provider)) providers.push(ident.provider);
  }
  return {
    id: stored.id,
    name: stored.name,
    email: stored.email,
    avatarUrl: stored.avatarUrl,
    role: stored.role,
    providers,
    identities: (stored.identities || []).map((i) => ({ ...i })),
    createdAt: stored.createdAt,
  };
}

class AuthRepository {
  private hashPassword(password: string, salt: string): string {
    return crypto.scryptSync(password, salt, 64).toString("hex");
  }

  public async findByEmail(email: string): Promise<UserRecord | null> {
    const cleanEmail = email.toLowerCase().trim();
    try {
      const rows = await db.select().from(users)
        .where(eq(users.email, cleanEmail)).limit(1);
      const u = rows[0];
      if (u) {
        const rec = await rowToRecord(u.id);
        if (rec) return rec;
      }
    } catch (dbErr) {
      console.warn("[authService] DB findByEmail failed, using local file storage:", (dbErr as any)?.message || dbErr);
    }
    const usersList = readJsonFile<UserRecord[]>(USERS_FILE, []);
    return usersList.find((u) => u.email.toLowerCase() === cleanEmail) || null;
  }

  public async findById(id: string): Promise<UserRecord | null> {
    try {
      const rec = await rowToRecord(id);
      if (rec) return rec;
    } catch (dbErr) {
      console.warn("[authService] DB findById failed, using local file storage:", (dbErr as any)?.message || dbErr);
    }
    const usersList = readJsonFile<UserRecord[]>(USERS_FILE, []);
    return usersList.find((u) => u.id === id) || null;
  }

  public async findByIdentity(
    provider: AuthProvider, providerAccountId: string,
  ): Promise<UserRecord | null> {
    try {
      const rows = await db.select().from(authenticationIdentities).where(and(
        eq(authenticationIdentities.provider, provider),
        eq(authenticationIdentities.providerAccountId, providerAccountId),
      )).limit(1);
      const i = rows[0];
      if (i) {
        const rec = await rowToRecord(i.userId);
        if (rec) return rec;
      }
    } catch (dbErr) {
      console.warn("[authService] DB findByIdentity failed, using local file storage:", (dbErr as any)?.message || dbErr);
    }
    const usersList = readJsonFile<UserRecord[]>(USERS_FILE, []);
    return (
      usersList.find((u) =>
        u.identities?.some(
          (ident) => ident.provider === provider && ident.providerAccountId === providerAccountId
        )
      ) || null
    );
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

    try {
      await db.insert(users).values({
        id, name: input.name.trim(), email: cleanEmail,
        passwordHash, salt, role: "user", createdAt: new Date(),
      });
      await db.insert(authenticationIdentities).values({
        id: genId("ident"), userId: id, provider: "credentials",
        providerAccountId: cleanEmail, email: cleanEmail, createdAt: new Date(),
      });
      const rec = await rowToRecord(id);
      if (rec) return toSafeUser(rec);
    } catch (dbErr) {
      console.warn("[authService] DB createUser failed, using local file storage fallback:", (dbErr as any)?.message || dbErr);
    }

    const usersList = readJsonFile<UserRecord[]>(USERS_FILE, []);
    const localUser: UserRecord = {
      id,
      name: input.name.trim(),
      email: cleanEmail,
      passwordHash,
      salt,
      role: "user",
      createdAt: Date.now(),
      identities: [
        {
          id: genId("ident"),
          userId: id,
          provider: "credentials",
          providerAccountId: cleanEmail,
          email: cleanEmail,
          createdAt: Date.now(),
        },
      ],
    };
    usersList.push(localUser);
    writeJsonFile(USERS_FILE, usersList);
    return toSafeUser(localUser);
  }

  public async findOrCreateFromOAuth(profile: OAuthProfile): Promise<AuthUser> {
    const cleanEmail = profile.email.toLowerCase().trim();

    try {
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
      if (rec) return toSafeUser(rec);
    } catch (dbErr) {
      console.warn("[authService] DB findOrCreateFromOAuth failed, using local file storage fallback:", (dbErr as any)?.message || dbErr);
    }

    // Local file storage fallback
    const usersList = readJsonFile<UserRecord[]>(USERS_FILE, []);
    let localUser = usersList.find((u) =>
      u.identities?.some(
        (i) => i.provider === profile.provider && i.providerAccountId === profile.providerAccountId
      )
    );
    if (localUser) {
      const ident = localUser.identities.find(
        (i) => i.provider === profile.provider && i.providerAccountId === profile.providerAccountId
      );
      if (ident) ident.lastUsedAt = Date.now();
      if (!localUser.avatarUrl && profile.avatarUrl) {
        localUser.avatarUrl = profile.avatarUrl;
      }
      writeJsonFile(USERS_FILE, usersList);
      return toSafeUser(localUser);
    }

    localUser = usersList.find((u) => u.email.toLowerCase() === cleanEmail);
    if (localUser) {
      if (!localUser.identities) localUser.identities = [];
      const hasIdentity = localUser.identities.some((i) => i.provider === profile.provider);
      if (!hasIdentity) {
        localUser.identities.push({
          id: genId("ident"),
          userId: localUser.id,
          provider: profile.provider,
          providerAccountId: profile.providerAccountId,
          email: cleanEmail,
          createdAt: Date.now(),
          lastUsedAt: Date.now(),
        });
      }
      if (!localUser.avatarUrl && profile.avatarUrl) {
        localUser.avatarUrl = profile.avatarUrl;
      }
      writeJsonFile(USERS_FILE, usersList);
      return toSafeUser(localUser);
    }

    const newUserId = genId("usr");
    const newName = profile.name.trim() || (profile.provider === "google" ? "Google User" : "Facebook User");
    const newUserRecord: UserRecord = {
      id: newUserId,
      name: newName,
      email: cleanEmail,
      avatarUrl: profile.avatarUrl,
      role: "user",
      createdAt: Date.now(),
      identities: [
        {
          id: genId("ident"),
          userId: newUserId,
          provider: profile.provider,
          providerAccountId: profile.providerAccountId,
          email: cleanEmail,
          createdAt: Date.now(),
          lastUsedAt: Date.now(),
        },
      ],
    };
    usersList.push(newUserRecord);
    writeJsonFile(USERS_FILE, usersList);
    return toSafeUser(newUserRecord);
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
    try {
      await db.delete(authenticationIdentities).where(and(
        eq(authenticationIdentities.userId, userId),
        eq(authenticationIdentities.provider, provider),
      ));
      const fresh = await rowToRecord(userId);
      if (fresh) return toSafeUser(fresh);
    } catch (err) {
      console.warn("[authService] DB unlinkProvider failed, falling back to local file storage:", err);
    }
    const usersList = readJsonFile<UserRecord[]>(USERS_FILE, []);
    const localUser = usersList.find((u) => u.id === userId);
    if (localUser) {
      localUser.identities = localUser.identities.filter((i) => i.provider !== provider);
      writeJsonFile(USERS_FILE, usersList);
      return toSafeUser(localUser);
    }
    return toSafeUser(user);
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
      try {
        await db.update(users).set(patch).where(eq(users.id, userId));
        const fresh = await rowToRecord(userId);
        if (fresh) return toSafeUser(fresh);
      } catch (err) {
        console.warn("[authService] DB updateUserProfile failed, falling back to local file storage:", err);
      }
      const usersList = readJsonFile<UserRecord[]>(USERS_FILE, []);
      const localUser = usersList.find((u) => u.id === userId);
      if (localUser) {
        if (patch.name) localUser.name = patch.name;
        if (patch.avatarUrl !== undefined) localUser.avatarUrl = patch.avatarUrl ?? undefined;
        writeJsonFile(USERS_FILE, usersList);
        return toSafeUser(localUser);
      }
    }
    return toSafeUser(user);
  }

  public async resetPassword(email: string, newPassword: string): Promise<AuthUser> {
    const cleanEmail = email.toLowerCase().trim();
    const user = await this.findByEmail(cleanEmail);
    if (!user) throw new Error("Không tìm thấy tài khoản với địa chỉ email này.");
    if (newPassword.length < 6) throw new Error("Mật khẩu mới phải có tối thiểu 6 ký tự.");
    const salt = crypto.randomBytes(16).toString("hex");
    const passwordHash = this.hashPassword(newPassword, salt);
    try {
      await db.update(users).set({ passwordHash, salt }).where(eq(users.id, user.id));
      const hasCred = user.identities.some((i) => i.provider === "credentials");
      if (!hasCred) {
        await db.insert(authenticationIdentities).values({
          id: genId("ident"), userId: user.id, provider: "credentials",
          providerAccountId: cleanEmail, email: cleanEmail, createdAt: new Date(),
        });
      }
      const fresh = await rowToRecord(user.id);
      if (fresh) return toSafeUser(fresh);
    } catch (err) {
      console.warn("[authService] DB resetPassword failed, falling back to local file storage:", err);
    }
    const usersList = readJsonFile<UserRecord[]>(USERS_FILE, []);
    const localUser = usersList.find((u) => u.email.toLowerCase() === cleanEmail);
    if (localUser) {
      localUser.passwordHash = passwordHash;
      localUser.salt = salt;
      if (!localUser.identities) localUser.identities = [];
      const hasCred = localUser.identities.some((i) => i.provider === "credentials");
      if (!hasCred) {
        localUser.identities.push({
          id: genId("ident"),
          userId: localUser.id,
          provider: "credentials",
          providerAccountId: cleanEmail,
          email: cleanEmail,
          createdAt: Date.now(),
        });
      }
      writeJsonFile(USERS_FILE, usersList);
      return toSafeUser(localUser);
    }
    return toSafeUser(user);
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

    try {
      await db.insert(sessions).values({
        id: genId("sess"), token, userId: user.id,
        expiresAt: new Date(expiresAt), createdAt: new Date(), lastSeenAt: new Date(),
      });
    } catch (dbErr) {
      console.warn("[authService] DB createSession failed, saving to local file storage:", (dbErr as any)?.message || dbErr);
    }

    const sessionsList = readJsonFile<any[]>(SESSIONS_FILE, []);
    sessionsList.push({
      id: genId("sess"),
      token,
      userId: user.id,
      user,
      expiresAt,
      createdAt: Date.now(),
      lastSeenAt: Date.now(),
    });
    const activeSessions = sessionsList.filter((s) => s.expiresAt > Date.now());
    writeJsonFile(SESSIONS_FILE, activeSessions);

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

    try {
      const rows = await db.select({ id: sessions.id }).from(sessions)
        .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date()))).limit(1);
      if (rows.length > 0) {
        await db.update(sessions).set({ lastSeenAt: new Date() }).where(eq(sessions.token, token));
        const fresh = await this.findById(payload.user.id);
        const safeUser = fresh ? toSafeUser(fresh) : payload.user;
        return { token, user: safeUser, expiresAt: payload.exp };
      }
    } catch (dbErr) {
      // DB failed, fall back to checking local session file
    }

    const sessionsList = readJsonFile<any[]>(SESSIONS_FILE, []);
    const localSess = sessionsList.find((s) => s.token === token && s.expiresAt > Date.now());
    if (localSess) {
      const fresh = await this.findById(payload.user.id);
      const safeUser = fresh ? toSafeUser(fresh) : (localSess.user || payload.user);
      return { token, user: safeUser, expiresAt: payload.exp };
    }

    const fresh = await this.findById(payload.user.id);
    const safeUser = fresh ? toSafeUser(fresh) : payload.user;
    return { token, user: safeUser, expiresAt: payload.exp };
  }

  public async deleteSession(token: string): Promise<void> {
    try {
      await db.delete(sessions).where(eq(sessions.token, token));
    } catch {}
    try {
      const sessionsList = readJsonFile<any[]>(SESSIONS_FILE, []);
      const updated = sessionsList.filter((s) => s.token !== token);
      writeJsonFile(SESSIONS_FILE, updated);
    } catch {}
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

