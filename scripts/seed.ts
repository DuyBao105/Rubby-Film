import crypto from "node:crypto";
import { db } from "../db/client";
import { users, authenticationIdentities } from "../db/schema";
import { genId } from "../src/lib/community/ids";

function hash(p: string, salt: string) {
  return crypto.scryptSync(p, salt, 64).toString("hex");
}

async function ensureUser(p: {
  id: string; email: string; name: string; password: string;
  role: "vip" | "admin"; avatar?: string;
}) {
  const email = p.email.toLowerCase();
  const existing = await db.query.users.findFirst({ where: (u, { eq }) => eq(u.email, email) });
  if (existing) return;
  const salt = crypto.randomBytes(16).toString("hex");
  await db.insert(users).values({
    id: p.id, name: p.name, email, role: p.role, avatarUrl: p.avatar,
    passwordHash: hash(p.password, salt), salt,
    createdAt: new Date(),
  });
  await db.insert(authenticationIdentities).values({
    id: genId("ident"), userId: p.id, provider: "credentials",
    providerAccountId: email, email, createdAt: new Date(),
  });
}

async function main() {
  await ensureUser({
    id: "usr_demo_rubbyfilm_001", email: "demo@rubbyfilm.vn",
    name: "Thành Viên VIP", password: "Demo@123456", role: "vip",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=faces",
  });
  await ensureUser({
    id: "usr_admin_rubbyfilm_001", email: "admin@rubbyfilm.vn",
    name: "Admin RubbyFilm", password: "Admin@123456", role: "admin",
  });
  console.log("seed ok");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
