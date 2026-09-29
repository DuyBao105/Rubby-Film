/**
 * TMDB (The Movie Database) Integration
 * Fetches original 4K / Full HD backdrops and high-res transparent logos when TMDB_API_KEY is configured.
 */

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_ORIGINAL = "https://image.tmdb.org/t/p/original";
export const DEFAULT_TMDB_API_KEY = "8d1cb1491ebac0d7292095e5c5bcecd0";
export const TMDB_API_KEY = process.env.TMDB_API_KEY || DEFAULT_TMDB_API_KEY;

// In-memory LRU cache to avoid hammering TMDB API
const tmdbBackdropCache = new Map<string, string>();
const tmdbLogoCache = new Map<string, string>();

export interface TmdbFallbackSearch {
  title?: string;
  originalTitle?: string;
  year?: number;
}

/**
 * Searches TMDB for a backdrop path if ID lookup is absent or has no backdrop
 */
async function searchTmdbBackdrop(
  apiKey: string,
  search: TmdbFallbackSearch
): Promise<string | null> {
  const queries = [search.originalTitle, search.title].filter(
    (q): q is string => Boolean(q && q.trim().length >= 2)
  );

  for (const query of queries) {
    try {
      const cacheKey = `search-bd-${query.toLowerCase().trim()}`;
      if (tmdbBackdropCache.has(cacheKey)) {
        const cached = tmdbBackdropCache.get(cacheKey);
        if (cached) return cached;
      }

      const q = encodeURIComponent(query.trim());
      const endpoint = `${TMDB_BASE_URL}/search/multi?api_key=${apiKey}&query=${q}&include_adult=false&language=vi-VN,en-US`;
      const res = await fetch(endpoint, {
        next: { revalidate: 86400 * 7 },
      });

      if (res.ok) {
        const data = await res.json();
        const results: any[] = data.results || [];
        // Find best match with backdrop
        const match =
          results.find((r) => r.backdrop_path && (search.year ? (r.release_date?.startsWith(String(search.year)) || r.first_air_date?.startsWith(String(search.year))) : true)) ||
          results.find((r) => r.backdrop_path);

        if (match?.backdrop_path) {
          const url = `${TMDB_IMAGE_ORIGINAL}${match.backdrop_path}`;
          tmdbBackdropCache.set(cacheKey, url);
          return url;
        }
      }
    } catch {}
  }
  return null;
}

export async function getTmdbBackdropUrl(
  tmdbId?: string | number | null,
  type: "movie" | "tv" = "movie",
  fallbackSearch?: TmdbFallbackSearch
): Promise<string | null> {
  const apiKey = TMDB_API_KEY;
  if (!apiKey) return null;

  const idStr = tmdbId ? String(tmdbId).trim() : "";
  const cacheKey = idStr ? `${type}-${idStr}` : (fallbackSearch?.originalTitle || fallbackSearch?.title || "");

  if (cacheKey && tmdbBackdropCache.has(cacheKey)) {
    return tmdbBackdropCache.get(cacheKey) || null;
  }

  // 1. Direct ID Lookup if ID is present
  if (idStr) {
    const primaryType = type === "tv" ? "tv" : "movie";
    const secondaryType = primaryType === "tv" ? "movie" : "tv";

    try {
      // Step A: Try primary type
      const endpoint = `${TMDB_BASE_URL}/${primaryType}/${idStr}?api_key=${apiKey}&language=vi-VN,en-US`;
      const res = await fetch(endpoint, {
        next: { revalidate: 86400 * 7 },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.backdrop_path) {
          const url = `${TMDB_IMAGE_ORIGINAL}${data.backdrop_path}`;
          tmdbBackdropCache.set(cacheKey, url);
          return url;
        }
      }

      // Step B: Try secondary type (TV vs Movie mismatch recovery)
      const fallbackRes = await fetch(
        `${TMDB_BASE_URL}/${secondaryType}/${idStr}?api_key=${apiKey}&language=vi-VN,en-US`,
        { next: { revalidate: 86400 * 7 } }
      );
      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json();
        if (fallbackData.backdrop_path) {
          const url = `${TMDB_IMAGE_ORIGINAL}${fallbackData.backdrop_path}`;
          tmdbBackdropCache.set(cacheKey, url);
          return url;
        }
      }

      // Step C: Check /images endpoint for untagged high-res backdrops
      for (const t of [primaryType, secondaryType]) {
        const imgRes = await fetch(`${TMDB_BASE_URL}/${t}/${idStr}/images?api_key=${apiKey}`, {
          next: { revalidate: 86400 * 7 },
        });
        if (imgRes.ok) {
          const imgData = await imgRes.json();
          if (imgData.backdrops && imgData.backdrops.length > 0) {
            const url = `${TMDB_IMAGE_ORIGINAL}${imgData.backdrops[0].file_path}`;
            tmdbBackdropCache.set(cacheKey, url);
            return url;
          }
        }
      }
    } catch (error) {
      console.error(`[TMDB] Error fetching backdrop for ID ${tmdbId}:`, error);
    }
  }

  // 2. Fallback search by title / originalTitle
  if (fallbackSearch) {
    const searchBackdrop = await searchTmdbBackdrop(apiKey, fallbackSearch);
    if (searchBackdrop) {
      if (cacheKey) tmdbBackdropCache.set(cacheKey, searchBackdrop);
      return searchBackdrop;
    }
  }

  return null;
}

export async function getTmdbLogoUrl(
  tmdbId?: string | number | null,
  type: "movie" | "tv" = "movie",
  fallbackSearch?: TmdbFallbackSearch
): Promise<string | null> {
  const apiKey = TMDB_API_KEY;
  if (!apiKey) return null;

  const idStr = tmdbId ? String(tmdbId).trim() : "";
  const cacheKey = idStr ? `${type}-${idStr}` : (fallbackSearch?.originalTitle || fallbackSearch?.title || "");

  if (cacheKey && tmdbLogoCache.has(cacheKey)) {
    return tmdbLogoCache.get(cacheKey) || null;
  }

  let resolvedId = idStr;
  let resolvedType = type;

  // If no ID or need discovery, try search first
  if (!resolvedId && fallbackSearch) {
    const queries = [fallbackSearch.originalTitle, fallbackSearch.title].filter(
      (q): q is string => Boolean(q && q.trim().length >= 2)
    );
    for (const qStr of queries) {
      try {
        const sRes = await fetch(
          `${TMDB_BASE_URL}/search/multi?api_key=${apiKey}&query=${encodeURIComponent(qStr)}&include_adult=false`,
          { next: { revalidate: 86400 * 7 } }
        );
        if (sRes.ok) {
          const sData = await sRes.json();
          const match = sData.results?.[0];
          if (match?.id) {
            resolvedId = String(match.id);
            resolvedType = match.media_type === "tv" ? "tv" : "movie";
            break;
          }
        }
      } catch {}
    }
  }

  if (!resolvedId) return null;

  const primaryType = resolvedType === "tv" ? "tv" : "movie";
  const secondaryType = primaryType === "tv" ? "movie" : "tv";

  for (const currentType of [primaryType, secondaryType]) {
    try {
      const endpoint = `${TMDB_BASE_URL}/${currentType}/${resolvedId}/images?api_key=${apiKey}&include_image_language=vi,en,zh,ko,ja,null`;
      const res = await fetch(endpoint, {
        next: { revalidate: 86400 * 7 },
      });

      if (res.ok) {
        const data = await res.json();
        const logos: Array<{ file_path: string; iso_639_1?: string; vote_average?: number }> =
          data.logos || [];

        if (logos.length > 0) {
          // Prioritize Vietnamese logo, then English, then original / highest rated
          const viLogo = logos.find((l) => l.iso_639_1 === "vi");
          const enLogo = logos.find((l) => l.iso_639_1 === "en");
          const best = viLogo || enLogo || logos[0];

          if (best?.file_path) {
            const url = `${TMDB_IMAGE_ORIGINAL}${best.file_path}`;
            if (cacheKey) tmdbLogoCache.set(cacheKey, url);
            return url;
          }
        }
      }
    } catch (error) {
      console.error(`[TMDB] Error fetching logo for ID ${resolvedId}:`, error);
    }
  }

  return null;
}
