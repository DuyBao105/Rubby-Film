import { db } from "@db/client";
import { users } from "@db/schema";
import { eq } from "drizzle-orm";

/**
 * Ensures a guest user profile exists in database for foreign key constraints.
 * If user already exists and a non-default name is provided, updates the name.
 */
export async function ensureGuestUser(
  guestId: string,
  name = "Khán giả ẩn danh",
  avatarUrl?: string
): Promise<string> {
  try {
    const [existing] = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.id, guestId))
      .limit(1);

    const safeName = name.trim() || "Khán giả ẩn danh";
    const avatar =
      avatarUrl ||
      `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(guestId)}`;

    if (!existing) {
      await db
        .insert(users)
        .values({
          id: guestId,
          name: safeName,
          email: `${guestId}@guest.rubyfilm.internal`,
          avatarUrl: avatar,
          role: "user",
        })
        .onConflictDoNothing();
    } else if (existing.name !== safeName) {
      await db.update(users).set({ name: safeName }).where(eq(users.id, guestId));
    }
    return guestId;
  } catch (err) {
    console.warn("[ensureGuestUser] Non-fatal error ensuring guest user:", err);
    return guestId;
  }
}
