import fs from "node:fs";
import path from "node:path";
import { db } from "@db/client";
import { users, authenticationIdentities, sessions } from "@db/schema";
import { genId } from "../src/lib/community/ids";

const DATA = path.join(process.cwd(), "data");

async function importUsers() {
  const file = path.join(DATA, "users.json");
  if (!fs.existsSync(file)) return 0;
  const list = JSON.parse(fs.readFileSync(file, "utf8"));
  let n = 0;
  for (const u of list) {
    const id = u.id ?? genId("usr");
    await db.insert(users).values({
      id, name: u.name, email: u.email.toLowerCase(),
      passwordHash: u.passwordHash ?? null,
      salt: u.salt ?? null,
      avatarUrl: u.avatarUrl ?? null,
      role: u.role ?? "user",
      createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
    }).onConflictDoNothing();
    for (const ident of u.identities ?? []) {
      await db.insert(authenticationIdentities).values({
        id: ident.id ?? genId("ident"),
        userId: id,
        provider: ident.provider,
        providerAccountId: ident.providerAccountId,
        email: ident.email ?? null,
        createdAt: ident.createdAt ? new Date(ident.createdAt) : new Date(),
        lastUsedAt: ident.lastUsedAt ? new Date(ident.lastUsedAt) : null,
      }).onConflictDoNothing();
    }
    n++;
  }
  return n;
}

async function importSessions() {
  const file = path.join(DATA, "sessions.json");
  if (!fs.existsSync(file)) return 0;
  const list = JSON.parse(fs.readFileSync(file, "utf8"));
  let n = 0;
  for (const s of list) {
    if (s.expiresAt <= Date.now()) continue;
    await db.insert(sessions).values({
      id: genId("sess"),
      token: s.token,
      userId: s.user.id,
      expiresAt: new Date(s.expiresAt),
      createdAt: new Date(),
      lastSeenAt: new Date(),
    }).onConflictDoNothing();
    n++;
  }
  return n;
}

async function main() {
  const u = await importUsers();
  const s = await importSessions();
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  for (const f of ["users.json", "sessions.json"]) {
    const p = path.join(DATA, f);
    if (fs.existsSync(p)) fs.renameSync(p, path.join(DATA, `${f}.migrated-${ts}`));
  }
  console.log(`imported users=${u} sessions=${s}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
