import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ALLOWED_HOSTS = new Set([
  "phimimg.com",
  "img.phimapi.com",
  "image.tmdb.org",
  "images.unsplash.com",
]);

interface CachedImage {
  buffer: ArrayBuffer;
  contentType: string;
  expiresAt: number;
}

const IMAGE_CACHE = new Map<string, CachedImage>();
const MAX_IMAGE_ENTRIES = 150;
const IMAGE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const p = searchParams.get("p");
  const rawUrl = searchParams.get("url");

  if (!p && !rawUrl) {
    return new NextResponse("Missing image parameter", { status: 400 });
  }

  let targetUrl = "";

  if (p) {
    const cleanPath = p.startsWith("/") ? p : `/${p}`;
    targetUrl = `https://phimimg.com${cleanPath}`;
  } else if (rawUrl) {
    targetUrl = rawUrl;
    if (targetUrl.startsWith("/")) {
      targetUrl = `https://phimimg.com${targetUrl}`;
    }
  }

  // Check instant RAM cache
  const cached = IMAGE_CACHE.get(targetUrl);
  if (cached && Date.now() < cached.expiresAt) {
    return new NextResponse(cached.buffer, {
      status: 200,
      headers: {
        "Content-Type": cached.contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Served-By": "RubyFilm-Media-Cache",
        "X-Cache": "HIT",
      },
    });
  }

  try {
    const parsed = new URL(targetUrl);
    
    // Safety check: only allow images from known movie CDNs
    if (!ALLOWED_HOSTS.has(parsed.hostname) && !parsed.hostname.endsWith(".phimimg.com") && !parsed.hostname.endsWith(".tmdb.org")) {
      return new NextResponse("Unauthorized image host", { status: 403 });
    }

    const res = await fetch(targetUrl, {
      headers: {
        "User-Agent": "RubyFilm-CDN/1.0",
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
    });

    if (!res.ok) {
      return new NextResponse("Failed to fetch image", { status: res.status });
    }

    const contentType = res.headers.get("content-type") || "image/jpeg";
    const buffer = await res.arrayBuffer();

    // Cache in RAM (evict oldest if full)
    if (IMAGE_CACHE.size >= MAX_IMAGE_ENTRIES) {
      const oldest = IMAGE_CACHE.keys().next().value;
      if (oldest) IMAGE_CACHE.delete(oldest);
    }
    IMAGE_CACHE.set(targetUrl, {
      buffer,
      contentType,
      expiresAt: Date.now() + IMAGE_TTL_MS,
    });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Served-By": "RubyFilm-Media-Gateway",
        "X-Cache": "MISS",
      },
    });
  } catch (error) {
    console.error("Image proxy error:", error);
    return new NextResponse("Error fetching image", { status: 500 });
  }
}
