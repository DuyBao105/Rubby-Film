import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get("url");

  if (!targetUrl) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  try {
    const parsed = new URL(targetUrl);
    // Safety check: ensure URL is HTTP/HTTPS
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return new NextResponse("Invalid protocol", { status: 400 });
    }

    const res = await fetch(targetUrl, {
      headers: {
        "User-Agent": "RubbyFilm/2.0 (Subtitle Proxy)",
      },
      next: { revalidate: 86400 },
    });

    if (!res.ok) {
      return new NextResponse(`Upstream failed: ${res.statusText}`, { status: res.status });
    }

    const text = await res.text();

    return new NextResponse(text, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch (error) {
    console.error("[api/subtitles/download] Error proxying subtitle:", error);
    return new NextResponse("Failed to download subtitle file", { status: 500 });
  }
}
