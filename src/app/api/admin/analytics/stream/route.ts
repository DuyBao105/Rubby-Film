import { requireAdmin } from "@/lib/community/getCurrentUser";
import { presenceTracker } from "@/lib/server/presenceTracker";

export const maxDuration = 60;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
  } catch (e) {
    const code = e instanceof Error && "code" in e ? (e as { code: unknown }).code : undefined;
    const status = code === "UNAUTHENTICATED" ? 401 : 403;
    return new Response(
      JSON.stringify({ success: false, error: { code: String(code ?? "FORBIDDEN"), message: "Admin only" } }),
      {
        status,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const encoder = new TextEncoder();
  let cleanup = () => {};
  let hb: ReturnType<typeof setInterval> | null = null;
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {}
      };

      // 1. Send initial snapshot immediately
      const initialStats = await presenceTracker.getActiveStats();
      send("presence", initialStats);

      // 2. Poll DB every 3 seconds to sync stats from other Vercel Lambdas
      pollInterval = setInterval(async () => {
        try {
          const stats = await presenceTracker.getActiveStats();
          send("presence", stats);
        } catch {}
      }, 3000);

      // 3. Local in-process subscribe
      cleanup = presenceTracker.subscribe((stats) => {
        send("presence", stats);
      });

      // 4. Heartbeat ping every 10 seconds to keep connection alive
      hb = setInterval(() => {
        send("ping", { at: Date.now() });
      }, 10000);

      // 5. Auto-refresh connection every 55 seconds (standard for Next.js / Vercel Edge/Serverless)
      timeout = setTimeout(() => {
        if (hb) clearInterval(hb);
        if (pollInterval) clearInterval(pollInterval);
        send("end", { at: Date.now() });
        try {
          controller.close();
        } catch {}
      }, 55000);
    },
    cancel() {
      if (timeout) clearTimeout(timeout);
      if (hb) clearInterval(hb);
      if (pollInterval) clearInterval(pollInterval);
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
