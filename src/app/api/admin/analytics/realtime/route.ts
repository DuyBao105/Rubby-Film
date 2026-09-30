import { NextResponse } from "next/server";
import { requireAdmin, HttpError } from "@/lib/community/getCurrentUser";
import { presenceTracker } from "@/lib/server/presenceTracker";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    const stats = presenceTracker.getActiveStats();
    return NextResponse.json({ ok: true, data: stats });
  } catch (error) {
    if (error instanceof HttpError) {
      const status = error.code === "UNAUTHENTICATED" ? 401 : 403;
      return NextResponse.json({ ok: false, error: error.message }, { status });
    }
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
