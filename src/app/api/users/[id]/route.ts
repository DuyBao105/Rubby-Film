import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";

import { apiError, apiSuccess } from "@/lib/server/apiResponse";
import { db } from "@db/client";
import { users, comments } from "@db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const [u] = await db
      .select({
        id: users.id,
        name: users.name,
        avatarUrl: users.avatarUrl,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (!u) return apiError("NOT_FOUND", "Không tìm thấy người dùng.", 404);

    const [c] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(comments)
      .where(eq(comments.userId, id));
    const commentCount = c?.c ?? 0;

    return apiSuccess(
      {
        id: u.id,
        name: u.name,
        avatarUrl: u.avatarUrl ?? undefined,
        role: u.role,
        createdAt: u.createdAt.getTime(),
        commentCount,
      },
      undefined,
      { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600" },
    );
  } catch (e) {
    console.error("[users/[id]]", e);
    return apiError("INTERNAL", "Đã xảy ra lỗi.", 500);
  }
}
