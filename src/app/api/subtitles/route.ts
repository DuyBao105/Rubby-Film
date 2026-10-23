import { NextRequest, NextResponse } from "next/server";
import { resolveImdbId, getOnlineSubtitles } from "@/lib/server/subtitleService";
import { checkRateLimit } from "@/lib/server/rateLimiter";

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
  const rateLimit = checkRateLimit(`sub_${ip}`, 120, 60);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { success: false, message: "Too many subtitle requests" },
      { status: 429, headers: { "Retry-After": String(rateLimit.resetSeconds) } }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const imdbIdParam = searchParams.get("imdbId") || undefined;
    const tmdbIdParam = searchParams.get("tmdbId") || undefined;
    const title = searchParams.get("title") || undefined;
    const originalTitle = searchParams.get("originalTitle") || undefined;
    const yearStr = searchParams.get("year");
    const year = yearStr ? parseInt(yearStr, 10) : undefined;
    const rawType = searchParams.get("type");
    const type: "movie" | "series" = rawType === "series" || rawType === "tv" ? "series" : "movie";

    const seasonStr = searchParams.get("season");
    const episodeStr = searchParams.get("episode");
    const season = seasonStr ? Math.max(1, parseInt(seasonStr, 10) || 1) : 1;
    const episode = episodeStr ? Math.max(1, parseInt(episodeStr, 10) || 1) : 1;

    // 1. Resolve IMDb ID
    const imdbId = await resolveImdbId({
      imdbId: imdbIdParam,
      tmdbId: tmdbIdParam,
      title,
      originalTitle,
      year: isNaN(year as number) ? undefined : year,
      type,
    });

    if (!imdbId) {
      return NextResponse.json({
        success: false,
        message: "Could not resolve IMDb ID for this title",
        subtitles: [],
      });
    }

    // 2. Fetch from Stremio OpenSubtitles v3
    const subtitles = await getOnlineSubtitles({
      imdbId,
      type,
      season,
      episode,
    });

    const vietnameseCount = subtitles.filter((s) => s.lang === "vie" || s.lang === "vi").length;
    const englishCount = subtitles.filter((s) => s.lang === "eng" || s.lang === "en").length;

    return NextResponse.json(
      {
        success: true,
        imdbId,
        type,
        season: type === "series" ? season : undefined,
        episode: type === "series" ? episode : undefined,
        total: subtitles.length,
        vietnameseCount,
        englishCount,
        subtitles,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      }
    );
  } catch (error) {
    console.error("[api/subtitles] Error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error fetching subtitles" },
      { status: 500 }
    );
  }
}
