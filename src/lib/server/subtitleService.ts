import { TMDB_API_KEY, DEFAULT_TMDB_API_KEY } from "./tmdb";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const STREMIO_SUB_BASE = "https://opensubtitles-v3.strem.io/subtitles";

export interface OnlineSubtitleTrack {
  id: string;
  lang: string;
  languageLabel: string;
  flag: string;
  releaseName: string;
  downloadUrl: string;
  format: "srt" | "vtt";
}

export interface ResolveImdbParams {
  imdbId?: string;
  tmdbId?: string | number;
  title?: string;
  originalTitle?: string;
  year?: number;
  type?: "movie" | "series" | "tv";
}

// In-memory caches to minimize external API calls
const imdbIdCache = new Map<string, string>();
const subtitleListCache = new Map<string, { data: OnlineSubtitleTrack[]; expiresAt: number }>();

const LANGUAGE_MAP: Record<string, { label: string; flag: string; priority: number }> = {
  vie: { label: "Tiếng Việt", flag: "🇻🇳", priority: 0 },
  vi: { label: "Tiếng Việt", flag: "🇻🇳", priority: 0 },
  eng: { label: "English", flag: "🇬🇧", priority: 1 },
  en: { label: "English", flag: "🇬🇧", priority: 1 },
  zho: { label: "Tiếng Trung", flag: "🇨🇳", priority: 2 },
  chi: { label: "Tiếng Trung", flag: "🇨🇳", priority: 2 },
  kor: { label: "Tiếng Hàn", flag: "🇰🇷", priority: 2 },
  jpn: { label: "Tiếng Nhật", flag: "🇯🇵", priority: 2 },
  fre: { label: "Tiếng Pháp", flag: "🇫🇷", priority: 3 },
  fra: { label: "Tiếng Pháp", flag: "🇫🇷", priority: 3 },
  spa: { label: "Tây Ban Nha", flag: "🇪🇸", priority: 3 },
  ger: { label: "Tiếng Đức", flag: "🇩🇪", priority: 3 },
  deu: { label: "Tiếng Đức", flag: "🇩🇪", priority: 3 },
  tha: { label: "Tiếng Thái", flag: "🇹🇭", priority: 3 },
  rus: { label: "Tiếng Nga", flag: "🇷🇺", priority: 3 },
};

/**
 * Resolves IMDb ID (e.g. tt15398776) from TMDB ID or Movie Title + Year
 */
export async function resolveImdbId(params: ResolveImdbParams): Promise<string | null> {
  if (params.imdbId && /^tt\d+$/i.test(params.imdbId.trim())) {
    return params.imdbId.trim();
  }

  const apiKey = TMDB_API_KEY || DEFAULT_TMDB_API_KEY;
  if (!apiKey) return null;

  const isTv = params.type === "series" || params.type === "tv";
  const mediaType = isTv ? "tv" : "movie";

  // Check direct TMDB ID first
  if (params.tmdbId) {
    const tmdbIdStr = String(params.tmdbId).trim();
    const cacheKey = `tmdb-${mediaType}-${tmdbIdStr}`;
    if (imdbIdCache.has(cacheKey)) {
      return imdbIdCache.get(cacheKey) || null;
    }

    try {
      const endpoint = `${TMDB_BASE_URL}/${mediaType}/${tmdbIdStr}/external_ids?api_key=${apiKey}`;
      const res = await fetch(endpoint, { next: { revalidate: 86400 * 30 } });
      if (res.ok) {
        const data = await res.json();
        if (data.imdb_id && /^tt\d+$/i.test(data.imdb_id)) {
          imdbIdCache.set(cacheKey, data.imdb_id);
          return data.imdb_id;
        }
      }
    } catch {}
  }

  // Fallback: Search TMDB by title / originalTitle
  const searchQueries = [params.originalTitle, params.title].filter(
    (q): q is string => Boolean(q && q.trim().length >= 2)
  );

  for (const query of searchQueries) {
    const qTrimmed = query.trim();
    const cacheKey = `search-${mediaType}-${qTrimmed.toLowerCase()}-${params.year || ""}`;
    if (imdbIdCache.has(cacheKey)) {
      const cached = imdbIdCache.get(cacheKey);
      if (cached) return cached;
    }

    try {
      const searchEndpoint = `${TMDB_BASE_URL}/search/multi?api_key=${apiKey}&query=${encodeURIComponent(
        qTrimmed
      )}&include_adult=false`;
      const sRes = await fetch(searchEndpoint, { next: { revalidate: 86400 * 14 } });
      if (!sRes.ok) continue;

      const sData = await sRes.json();
      const results: any[] = sData.results || [];
      if (results.length === 0) continue;

      // Prefer exact year match or matching media type
      const match =
        results.find((r) => {
          const rYear = r.release_date?.slice(0, 4) || r.first_air_date?.slice(0, 4);
          const typeMatch = isTv ? r.media_type === "tv" : r.media_type === "movie";
          return typeMatch && (params.year ? rYear === String(params.year) : true);
        }) ||
        results.find((r) => (isTv ? r.media_type === "tv" : r.media_type === "movie")) ||
        results[0];

      if (match?.id) {
        const targetType = match.media_type === "tv" ? "tv" : "movie";
        const extEndpoint = `${TMDB_BASE_URL}/${targetType}/${match.id}/external_ids?api_key=${apiKey}`;
        const extRes = await fetch(extEndpoint, { next: { revalidate: 86400 * 30 } });
        if (extRes.ok) {
          const extData = await extRes.json();
          if (extData.imdb_id && /^tt\d+$/i.test(extData.imdb_id)) {
            imdbIdCache.set(cacheKey, extData.imdb_id);
            return extData.imdb_id;
          }
        }
      }
    } catch {}
  }

  return null;
}

export interface GetSubtitlesOptions {
  imdbId: string;
  type?: "movie" | "series" | "tv";
  season?: number;
  episode?: number;
}

/**
 * Fetches subtitles from Stremio OpenSubtitles v3 addon
 */
export async function getOnlineSubtitles(opts: GetSubtitlesOptions): Promise<OnlineSubtitleTrack[]> {
  const { imdbId, type = "movie", season = 1, episode = 1 } = opts;
  const isSeries = type === "series" || type === "tv";
  const subKey = isSeries ? `series:${imdbId}:${season}:${episode}` : `movie:${imdbId}`;

  // Check cache (TTL 6 hours)
  const cached = subtitleListCache.get(subKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  const endpoint = isSeries
    ? `${STREMIO_SUB_BASE}/series/${imdbId}:${season}:${episode}.json`
    : `${STREMIO_SUB_BASE}/movie/${imdbId}.json`;

  try {
    const res = await fetch(endpoint, {
      headers: {
        "User-Agent": "RubbyFilm/2.0 (Stremio-Subtitles-Integration)",
        Accept: "application/json",
      },
      next: { revalidate: 3600 * 6 },
    });

    if (!res.ok) {
      return [];
    }

    const json = await res.json();
    const rawSubs: any[] = json?.subtitles || [];

    const mapped: OnlineSubtitleTrack[] = rawSubs
      .map((item, index) => {
        const rawLang = (item.lang || "eng").toLowerCase();
        const langConfig = LANGUAGE_MAP[rawLang] || {
          label: rawLang.toUpperCase(),
          flag: "🌐",
          priority: 5,
        };

        const release =
          item.movieReleaseName ||
          item.subtitleFileName ||
          `Bản dịch ${index + 1} (${langConfig.label})`;

        const url = item.url;
        const format: "srt" | "vtt" = url?.endsWith(".vtt") ? "vtt" : "srt";

        return {
          id: String(item.id || index + 1),
          lang: rawLang,
          languageLabel: langConfig.label,
          flag: langConfig.flag,
          releaseName: release,
          downloadUrl: url,
          format,
        };
      })
      .filter((sub) => Boolean(sub.downloadUrl));

    // Sort: Vietnamese first (priority 0), then English (priority 1), then others
    mapped.sort((a, b) => {
      const pA = LANGUAGE_MAP[a.lang]?.priority ?? 99;
      const pB = LANGUAGE_MAP[b.lang]?.priority ?? 99;
      if (pA !== pB) return pA - pB;
      return a.releaseName.localeCompare(b.releaseName);
    });

    // Save to cache (6 hours)
    subtitleListCache.set(subKey, {
      data: mapped,
      expiresAt: Date.now() + 6 * 3600 * 1000,
    });

    return mapped;
  } catch (error) {
    console.error("[subtitleService] Failed to fetch subtitles from Stremio:", error);
    return [];
  }
}
