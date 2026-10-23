import { NextRequest, NextResponse } from "next/server";
import { decryptStreamUrl, encryptStreamUrl } from "@/lib/utils/streamSecurity";

export const dynamic = "force-dynamic";

// In-memory cache for embed pages (15m TTL)
interface CachedEmbed {
  html: string;
  expiresAt: number;
}
const embedCache = new Map<string, CachedEmbed>();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sParam = searchParams.get("s");
  const urlParam = searchParams.get("url");

  let targetUrl = "";
  if (sParam) {
    targetUrl = decryptStreamUrl(sParam);
  } else if (urlParam) {
    targetUrl = urlParam.startsWith("RF_ENC_") ? decryptStreamUrl(urlParam) : urlParam;
  }

  if (!targetUrl || !targetUrl.startsWith("http")) {
    return new NextResponse(renderErrorPage("Không tìm thấy đường truyền hợp lệ"), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // Check in-memory cache for instant 0ms responses
  const cachedEmbed = embedCache.get(targetUrl);
  if (cachedEmbed && Date.now() < cachedEmbed.expiresAt) {
    return new NextResponse(cachedEmbed.html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=1800, s-maxage=1800",
        "X-Rubby-Cache": "HIT",
      },
    });
  }

  // Case 1: If the embed URL wraps an m3u8 stream (e.g. player.phimapi.com/player/?url=...m3u8)
  let extractedM3u8: string | null = null;
  if (targetUrl.includes(".m3u8")) {
    const match = targetUrl.match(/url=([^&]+)/);
    if (match && match[1]) {
      extractedM3u8 = decodeURIComponent(match[1]);
    } else if (targetUrl.endsWith(".m3u8") || targetUrl.includes("/index.m3u8")) {
      extractedM3u8 = targetUrl;
    }
  }

  if (extractedM3u8) {
    const proxiedStreamUrl = `/api/stream?s=${encodeURIComponent(encryptStreamUrl(extractedM3u8))}`;
    return new NextResponse(renderNativePlayer(proxiedStreamUrl), {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  // Case 2: Direct resolution for StreamC / NguonC embeds into Native HLS VIP Player
  if (targetUrl.includes("streamc") || targetUrl.includes("embed.php")) {
    const resolvedHls = await resolveStreamcPlaylist(targetUrl);
    if (resolvedHls) {
      const proxiedStreamUrl = `/api/stream?s=${encodeURIComponent(encryptStreamUrl(resolvedHls))}`;
      return new NextResponse(renderNativePlayer(proxiedStreamUrl), {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=1800",
        },
      });
    }
  }

  // Case 3: Third-party web embed fallback
  try {
    const reqHeaders: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    };
    if (targetUrl.includes("streamc") || targetUrl.includes("nguonc")) {
      reqHeaders["Referer"] = "https://phim.nguonc.com/";
    }

    const upstreamRes = await fetch(targetUrl, {
      method: "GET",
      headers: reqHeaders,
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });

    if (!upstreamRes.ok) {
      return new NextResponse(renderErrorPage("Máy chủ phát hiện đang bận hoặc bảo trì."), {
        status: upstreamRes.status,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    let html = await upstreamRes.text();
    const upstreamOrigin = new URL(targetUrl).origin;

    // Convert root-relative assets to absolute upstream URLs so they never 404
    html = html.replaceAll('"/assets/', `"${upstreamOrigin}/assets/`);
    html = html.replaceAll("'/assets/", `'${upstreamOrigin}/assets/`);
    html = html.replaceAll('(/assets/', `(${upstreamOrigin}/assets/`);

    const headRegex = /<head[^>]*>/i;
    const injectScripts = `<head><meta name="referrer" content="unsafe-url"><script>
      console.error = function(){};
      console.warn = function(){};
      window.addEventListener('error', function(e){ e.stopImmediatePropagation(); }, true);
    </script><base href="${upstreamOrigin}/">`;

    if (headRegex.test(html)) {
      html = html.replace(headRegex, injectScripts);
    } else {
      html = injectScripts + html;
    }

    // Save to in-memory cache for 15 minutes
    if (embedCache.size > 500) {
      embedCache.clear();
    }
    embedCache.set(targetUrl, { html, expiresAt: Date.now() + 15 * 60 * 1000 });

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=1800, s-maxage=1800",
        "X-Rubby-Cache": "MISS",
      },
    });
  } catch (err: any) {
    return new NextResponse(renderErrorPage("Không thể kết nối đến máy chủ phát video."), {
      status: 502,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}

async function resolveStreamcPlaylist(embedUrl: string): Promise<string | null> {
  try {
    const urlObj = new URL(embedUrl);
    const hash = urlObj.searchParams.get("hash");
    if (!hash) return null;

    const origin = urlObj.origin;
    const body = {
      action: "bootstrap",
      referrer: "https://phim.nguonc.com/",
      frame_origins: ["https://phim.nguonc.com"],
      request_grant: true,
      playlist_format: "hls",
      pretty_url: true,
      path_chunks: true,
      bootstrap_format: "json",
    };

    const res = await fetch(embedUrl, {
      method: "POST",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: embedUrl,
        Origin: origin,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) return null;
    const json = await res.json();
    return json?.preissued?.playlist || null;
  } catch {
    return null;
  }
}

function renderNativePlayer(streamUrl: string): string {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <title>RubyFilm Player</title>
  <script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.8/dist/hls.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; background: #000; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    #player-wrap { position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
    video { width: 100%; height: 100%; object-fit: contain; }
    #loading { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: #fff; background: rgba(0,0,0,0.6); z-index: 10; transition: opacity 0.3s; }
    .spinner { width: 44px; height: 44px; border: 3px solid rgba(255,255,255,0.2); border-top-color: #E50000; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    #error-box { position: absolute; inset: 0; display: none; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: #fff; background: #0c0c0c; z-index: 20; padding: 20px; text-align: center; }
    .btn-retry { background: #E50000; color: #fff; border: 0; padding: 10px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; }
  </style>
</head>
<body>
  <div id="player-wrap">
    <video id="video" controls playsinline autoplay></video>
    <div id="loading"><div class="spinner"></div><span style="font-size:13px;color:#aaa">Đang tải luồng phát bảo mật...</span></div>
    <div id="error-box">
      <p style="font-size:14px;color:#eee">Đường truyền máy chủ đang bận hoặc bảo trì.</p>
      <button class="btn-retry" onclick="location.reload()">Thử Lại</button>
    </div>
  </div>
  <script>
    (function() {
      // Suppress devtools error logs
      console.error = function(){};
      console.warn = function(){};

      var video = document.getElementById('video');
      var loading = document.getElementById('loading');
      var errorBox = document.getElementById('error-box');
      var streamUrl = ${JSON.stringify(streamUrl)};

      function hideLoading() { if (loading) loading.style.display = 'none'; }
      function notifyParentError(reason) {
        try {
          if (window.parent && window.parent !== window) {
            window.parent.postMessage({ type: 'RUBBY_STREAM_ERROR', reason: reason || 'stream_error' }, '*');
          }
        } catch(e) {}
      }
      function showError(reason) {
        hideLoading();
        notifyParentError(reason);
        if (errorBox) errorBox.style.display = 'flex';
      }

      if (Hls.isSupported()) {
        var hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          maxBufferLength: 30,
        });
        hls.loadSource(streamUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, function() {
          hideLoading();
          video.play().catch(function(){});
        });
        hls.on(Hls.Events.ERROR, function(e, data) {
          if (data.fatal) {
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              showError(data.details);
            } else {
              hls.recoverMediaError();
            }
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = streamUrl;
        video.addEventListener('loadedmetadata', function() {
          hideLoading();
          video.play().catch(function(){});
        });
        video.addEventListener('error', function() {
          showError('native_error');
        });
      } else {
        video.src = streamUrl;
      }
    })();
  </script>
</body>
</html>`;
}

function renderErrorPage(msg: string): string {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <style>
    body { background: #0a0a0a; color: #fff; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
    .box { padding: 24px; max-width: 400px; }
    h3 { font-size: 16px; margin-bottom: 8px; color: #ff4d4d; }
    p { font-size: 13px; color: #999; margin-bottom: 16px; }
    button { background: #E50000; color: #fff; border: 0; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: bold; }
  </style>
</head>
<body>
  <div class="box">
    <h3>Thông báo máy chủ</h3>
    <p>${msg}</p>
    <button onclick="location.reload()">Thử lại</button>
  </div>
</body>
</html>`;
}
