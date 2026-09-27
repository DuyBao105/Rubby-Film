import { NextRequest } from "next/server";
import { communityRepository } from "@/lib/community/communityRepository";

export const maxDuration = 60;
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const movieId = url.searchParams.get("movieId");
  if (!movieId) {
    return new Response(JSON.stringify({ success: false, error: { code: "BAD_REQUEST", message: "movieId required" } }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  let cleanup = () => {};
  let hb: ReturnType<typeof setInterval> | null = null;
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          // controller closed; ignore
        }
      };
      send("hello", { movieId, at: Date.now() });
      try {
        cleanup = await communityRepository.subscribe(movieId, (e) => send(e.type, e));
      } catch (err) {
        console.error("[stream] subscribe failed", err);
        send("error", { message: "subscribe failed" });
      }
      hb = setInterval(() => send("ping", { at: Date.now() }), 25000);
      timeout = setTimeout(() => {
        if (hb) clearInterval(hb);
        send("end", { at: Date.now() });
        try { controller.close(); } catch { /* already closed */ }
      }, 55000);
    },
    cancel() {
      if (timeout) clearTimeout(timeout);
      if (hb) clearInterval(hb);
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
