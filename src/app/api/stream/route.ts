import { NextRequest, NextResponse } from "next/server";
import { decryptStreamUrl, encryptStreamUrl } from "@/lib/utils/streamSecurity";

export const dynamic = "force-dynamic";

// Standard CORS headers so client HLS player never gets blocked
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Expose-Headers": "Content-Length, Content-Range, Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

function resolveTargetUrl(req: NextRequest): string | null {
  const { searchParams } = new URL(req.url);
  const sParam = searchParams.get("s");
  const urlParam = searchParams.get("url");

  if (sParam) {
    const decrypted = decryptStreamUrl(sParam);
    if (decrypted && decrypted.startsWith("http")) return decrypted;
  }

  if (urlParam) {
    if (urlParam.startsWith("http")) return urlParam;
    const decrypted = decryptStreamUrl(urlParam);
    if (decrypted && decrypted.startsWith("http")) return decrypted;
  }

  return null;
}

// In-memory cache for rewritten m3u8 playlists (15m TTL for static VOD streams)
interface CachedPlaylist {
  body: string;
  expiresAt: number;
}
const playlistCache = new Map<string, CachedPlaylist>();

function getCachedPlaylist(url: string): string | null {
  const cached = playlistCache.get(url);
  if (!cached) return null;
  if (Date.now() > cached.expiresAt) {
    playlistCache.delete(url);
    return null;
  }
  return cached.body;
}

function setCachedPlaylist(url: string, body: string, ttlMs: number = 15 * 60 * 1000) {
  if (playlistCache.size > 1000) {
    playlistCache.clear();
  }
  playlistCache.set(url, { body, expiresAt: Date.now() + ttlMs });
}

export async function GET(req: NextRequest) {
  const targetUrl = resolveTargetUrl(req);

  if (!targetUrl) {
    return new NextResponse("Invalid stream parameter", {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  // Instant 302 redirect for .ts segments directly to upstream CDN so Node.js NEVER proxies video binary
  if (targetUrl.includes(".ts")) {
    return NextResponse.redirect(targetUrl, {
      status: 302,
      headers: CORS_HEADERS,
    });
  }

  // Instant response if m3u8 playlist is already cached in memory
  if (targetUrl.includes(".m3u8")) {
    const cachedBody = getCachedPlaylist(targetUrl);
    if (cachedBody) {
      return new NextResponse(cachedBody, {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/vnd.apple.mpegurl",
          "Cache-Control": "public, max-age=300, s-maxage=300",
          "X-Rubby-Cache": "HIT",
        },
      });
    }
  }

  try {
    const reqHeaders: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    };

    // Forward range header for video seeking
    const range = req.headers.get("range");
    if (range) {
      reqHeaders["Range"] = range;
    }

    // Set appropriate referer based on upstream host
    const urlObj = new URL(targetUrl);
    if (
      urlObj.hostname.includes("streamc") ||
      urlObj.hostname.includes("nguonc") ||
      urlObj.hostname.includes("hihihoho") ||
      urlObj.hostname.includes(".top")
    ) {
      reqHeaders["Referer"] = "https://embed13.streamc.xyz/";
    } else if (urlObj.hostname.includes("phimapi") || urlObj.hostname.includes("kkphim")) {
      reqHeaders["Referer"] = "https://phimapi.com/";
    }

    const isPlaylist = targetUrl.includes(".m3u8");
    const controller = new AbortController();
    // Fast 3.5s timeout for playlists so failed upstream servers failover immediately
    const timeout = setTimeout(() => controller.abort(), isPlaylist ? 3500 : 12000);

    const upstreamRes = await fetch(targetUrl, {
      method: "GET",
      headers: reqHeaders,
      signal: controller.signal,
      cache: "no-store",
    });

    clearTimeout(timeout);

    if (!upstreamRes.ok) {
      return new NextResponse(`Upstream returned ${upstreamRes.status}`, {
        status: upstreamRes.status,
        headers: {
          ...CORS_HEADERS,
          "Cache-Control": "no-cache, no-store",
        },
      });
    }

    const contentType = upstreamRes.headers.get("content-type") || "";
    const isM3u8 =
      isPlaylist ||
      contentType.includes("mpegurl") ||
      contentType.includes("application/x-mpegurl") ||
      contentType.includes("vnd.apple.mpegurl");

    if (isM3u8) {
      const text = await upstreamRes.text();
      const lines = text.split("\n");
      const rewritten: string[] = [];

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) {
          rewritten.push(rawLine);
          continue;
        }

        // Keep comments & directives intact, except if they have URI inside
        if (line.startsWith("#")) {
          // Handle #EXT-X-KEY:METHOD=...,URI="..."
          if (line.includes('URI="')) {
            const replaced = line.replace(/URI="([^"]+)"/, (_, uriMatch) => {
              const absUri = new URL(uriMatch, targetUrl).href;
              const proxied = `/api/stream?s=${encodeURIComponent(encryptStreamUrl(absUri))}`;
              return `URI="${proxied}"`;
            });
            rewritten.push(replaced);
          } else {
            rewritten.push(rawLine);
          }
        } else {
          // Playlist URL or .ts segment URL
          try {
            const absUrl = new URL(line, targetUrl).href;
            if (line.includes(".m3u8") || line.includes("index") || !line.includes(".ts")) {
              const proxiedUrl = `/api/stream?s=${encodeURIComponent(encryptStreamUrl(absUrl))}`;
              rewritten.push(proxiedUrl);
            } else {
              // Direct CDN link for .ts chunks - maximum speed, zero Node.js server overhead
              rewritten.push(absUrl);
            }
          } catch {
            rewritten.push(line);
          }
        }
      }

      const bodyText = rewritten.join("\n");
      // Cache rewritten playlist in memory for 15 minutes
      setCachedPlaylist(targetUrl, bodyText, 15 * 60 * 1000);

      return new NextResponse(bodyText, {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/vnd.apple.mpegurl",
          "Cache-Control": "public, max-age=60, s-maxage=60",
          "X-Rubby-Cache": "MISS",
        },
      });
    }

    // Binary stream: .ts segment, video chunks, key files
    const resHeaders = new Headers();
    for (const [k, v] of Object.entries(CORS_HEADERS)) {
      resHeaders.set(k, v);
    }

    const upstreamType = upstreamRes.headers.get("content-type");
    if (
      (targetUrl.includes(".png") || targetUrl.includes(".jpg")) &&
      (targetUrl.includes("hihihoho") || targetUrl.includes("streamc") || targetUrl.includes(".top"))
    ) {
      resHeaders.set("Content-Type", "video/mp2t");
    } else if (upstreamType) {
      resHeaders.set("Content-Type", upstreamType);
    } else if (targetUrl.includes(".ts")) {
      resHeaders.set("Content-Type", "video/mp2t");
    }

    const contentLen = upstreamRes.headers.get("content-length");
    if (contentLen) resHeaders.set("Content-Length", contentLen);

    const contentRange = upstreamRes.headers.get("content-range");
    if (contentRange) resHeaders.set("Content-Range", contentRange);

    resHeaders.set("Cache-Control", "public, max-age=3600, immutable");

    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      headers: resHeaders,
    });
  } catch (error: any) {
    return new NextResponse(`Stream proxy error: ${error?.message || "timeout"}`, {
      status: 504,
      headers: CORS_HEADERS,
    });
  }
}
