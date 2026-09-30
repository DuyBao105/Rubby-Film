import { NextRequest, NextResponse } from "next/server";
import { presenceTracker } from "@/lib/server/presenceTracker";
import { getCurrentUser } from "@/lib/community/getCurrentUser";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const action = req.nextUrl.searchParams.get("action");
    let body: any = {};
    try {
      body = await req.json();
    } catch {}

    const sessionId = String(body.sessionId || "").trim();
    if (!sessionId) {
      return NextResponse.json({ ok: false, error: "Missing sessionId" }, { status: 400 });
    }

    if (action === "leave") {
      presenceTracker.removeSession(sessionId);
      return NextResponse.json({ ok: true });
    }

    const user = await getCurrentUser();

    presenceTracker.recordHeartbeat({
      sessionId,
      page: String(body.page || "/").slice(0, 150),
      title: body.title ? String(body.title).slice(0, 100) : undefined,
      device: body.device === "mobile" ? "mobile" : "desktop",
      userId: user?.id,
      userName: user?.name,
      userRole: user?.role,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
