import { VideoSource } from "@/lib/models/videoSource";
import { Movie, Episode } from "@/types/movie";
import { encryptStreamUrl } from "@/lib/utils/streamSecurity";

interface NguonCItem {
  name: string;
  slug: string;
  embed: string;
  m3u8?: string;
}

interface NguonCServer {
  server_name: string;
  items: NguonCItem[];
}

interface NguonCMovie {
  id?: string;
  name: string;
  slug: string;
  original_name?: string;
  thumb_url?: string;
  poster_url?: string;
  description?: string;
  total_episodes?: number;
  current_episode?: string;
  time?: string;
  quality?: string;
  language?: string;
  director?: string;
  casts?: string;
  category?: Record<string, { group: { name: string }; list: Array<{ id: string; name: string }> }>;
  episodes?: NguonCServer[];
}

interface NguonCResponse {
  status: "success" | "error";
  movie?: NguonCMovie;
  items?: Array<{ name: string; slug: string; original_name?: string }>;
}

const NGUONC_BASE_URL = "https://phim.nguonc.com/api";

class NguonCService {
  private cache = new Map<string, { data: any; expiresAt: number }>();

  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  private setCache(key: string, data: any, ttlMs: number = 30 * 60 * 1000) {
    this.cache.set(key, { data, expiresAt: Date.now() + ttlMs });
  }

  /**
   * Fetch backup video sources from NguonC for a movie by slug or title
   */
  async getBackupSourcesForMovie(
    slug: string,
    title?: string
  ): Promise<Map<number, VideoSource[]>> {
    const epSourceMap = new Map<number, VideoSource[]>();
    if (!slug) return epSourceMap;

    const cacheKey = `nguonc_sources_${slug}`;
    const cached = this.getCached<Record<number, VideoSource[]>>(cacheKey);
    if (cached) {
      Object.entries(cached).forEach(([epNum, srcs]) => {
        epSourceMap.set(Number(epNum), srcs);
      });
      return epSourceMap;
    }

    try {
      let movieData: NguonCMovie | null = null;

      // 1. Try direct slug
      try {
        const res = await fetch(`${NGUONC_BASE_URL}/film/${encodeURIComponent(slug)}`, {
          signal: AbortSignal.timeout(3000),
          headers: { "Accept": "application/json", "User-Agent": "RubyFilm/2.0" },
        });
        if (res.ok) {
          const json: NguonCResponse = await res.json();
          if (json.status === "success" && json.movie?.episodes) {
            movieData = json.movie;
          }
        }
      } catch {}

      // 2. If not found by direct slug, search by title
      if (!movieData && title) {
        try {
          const sRes = await fetch(
            `${NGUONC_BASE_URL}/films/search?keyword=${encodeURIComponent(title)}`,
            {
              signal: AbortSignal.timeout(3000),
              headers: { "Accept": "application/json", "User-Agent": "RubyFilm/2.0" },
            }
          );
          if (sRes.ok) {
            const sJson: NguonCResponse = await sRes.json();
            if (sJson.status === "success" && sJson.items && sJson.items.length > 0) {
              const matchedSlug = sJson.items[0].slug;
              const fRes = await fetch(`${NGUONC_BASE_URL}/film/${encodeURIComponent(matchedSlug)}`, {
                signal: AbortSignal.timeout(3000),
                headers: { "Accept": "application/json", "User-Agent": "RubyFilm/2.0" },
              });
              if (fRes.ok) {
                const fJson: NguonCResponse = await fRes.json();
                if (fJson.status === "success" && fJson.movie?.episodes) {
                  movieData = fJson.movie;
                }
              }
            }
          }
        } catch {}
      }

      if (!movieData || !movieData.episodes) {
        return epSourceMap;
      }

      // 3. Map servers and episodes
      movieData.episodes.forEach((serverGroup, sIdx) => {
        const rawServerName = serverGroup.server_name || `Dự phòng #${sIdx + 1}`;
        const isTM = rawServerName.includes("Lồng") || rawServerName.includes("Thuyết");
        const cleanServerName = isTM
          ? `Máy chủ Ruby #${sIdx + 2} (Thuyết Minh)`
          : `Máy chủ Ruby #${sIdx + 2} (Dự phòng Fast)`;

        serverGroup.items.forEach((item, idx) => {
          // Extract episode number
          const match = item.name.match(/\d+/);
          const epNum = match ? parseInt(match[0], 10) : idx + 1;

          if (!epSourceMap.has(epNum)) {
            epSourceMap.set(epNum, []);
          }

          // Extract potential m3u8 stream from embed wrapper
          let m3u8Stream = item.m3u8;
          if (!m3u8Stream && item.embed) {
            const mMatch = item.embed.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i);
            if (mMatch && mMatch[1]) {
              m3u8Stream = decodeURIComponent(mMatch[1]);
            }
          }

          // If m3u8 stream available
          if (m3u8Stream) {
            epSourceMap.get(epNum)!.push({
              serverName: cleanServerName + " (HLS VIP)",
              label: cleanServerName + " (HLS 1080p)",
              url: encryptStreamUrl(m3u8Stream),
              type: "hls",
            });
          }

          // Embed player stream (ultra reliable failover)
          if (item.embed && !m3u8Stream) {
            epSourceMap.get(epNum)!.push({
              serverName: cleanServerName,
              label: cleanServerName + " (Embed Không Giật)",
              url: encryptStreamUrl(item.embed),
              type: "embed",
            });
          }
        });
      });

      // Save to cache
      const serializable: Record<number, VideoSource[]> = {};
      epSourceMap.forEach((val, key) => {
        serializable[key] = val;
      });
      this.setCache(cacheKey, serializable);

      return epSourceMap;
    } catch {
      return epSourceMap;
    }
  }

  /**
   * If KKPhim returns 404 for a movie, fetch full movie from NguonC as failover
   */
  async getMovieFailover(slug: string): Promise<Movie | null> {
    try {
      const res = await fetch(`${NGUONC_BASE_URL}/film/${encodeURIComponent(slug)}`, {
        signal: AbortSignal.timeout(4000),
        headers: { "Accept": "application/json", "User-Agent": "RubyFilm/2.0" },
      });
      if (!res.ok) return null;

      const json: NguonCResponse = await res.json();
      if (json.status !== "success" || !json.movie) return null;

      const m = json.movie;
      const episodes: Episode[] = [];

      (m.episodes || []).forEach((serverGroup, sIdx) => {
        const rawServerName = serverGroup.server_name || `Dự phòng #${sIdx + 1}`;
        const serverName = `Máy chủ Ruby #${sIdx + 1} (VIP)`;

        serverGroup.items.forEach((item, idx) => {
          const match = item.name.match(/\d+/);
          const epNum = match ? parseInt(match[0], 10) : idx + 1;

          const sources: VideoSource[] = [];
          if (item.m3u8) {
            sources.push({
              serverName: serverName + " [HLS]",
              label: serverName,
              url: encryptStreamUrl(item.m3u8),
              type: "hls",
            });
          }
          if (item.embed) {
            sources.push({
              serverName: serverName,
              label: serverName + " (Embed)",
              url: encryptStreamUrl(item.embed),
              type: "embed",
            });
          }

          const existing = episodes.find((e) => e.episodeNumber === epNum);
          if (existing) {
            existing.videoSources.push(...sources);
          } else {
            episodes.push({
              id: item.slug || `ep-${epNum}`,
              name: `Tập ${epNum}`,
              slug: item.slug || `tap-${epNum}`,
              episodeNumber: epNum,
              seasonNumber: 1,
              duration: m.time || "Full HD",
              videoSources: sources,
            });
          }
        });
      });

      return {
        id: m.id || m.slug,
        title: m.name,
        originalTitle: m.original_name || m.name,
        slug: m.slug,
        description: m.description || "",
        posterUrl: m.poster_url || m.thumb_url || "",
        backdropUrl: m.thumb_url || m.poster_url || "",
        rating: 8.5,
        views: 2500,
        year: new Date().getFullYear(),
        duration: m.time || "Full HD",
        type: episodes.length > 1 ? "series" : "single",
        genres: ["Phim Hay"],
        genreSlugs: ["phim-hay"],
        country: "Quốc Tế",
        countrySlug: "quoc-te",
        quality: m.quality || "FHD",
        language: m.language || "Vietsub",
        director: m.director || "Đang cập nhật",
        cast: m.casts ? m.casts.split(",").map((c) => c.trim()) : [],
        actors: m.casts ? m.casts.split(",").map((c) => ({ name: c.trim() })) : [],
        episodes: episodes.sort((a, b) => a.episodeNumber - b.episodeNumber),
      };
    } catch {
      return null;
    }
  }

  /**
   * Search movies from NguonC to supplement search catalog
   */
  async searchMovies(keyword: string): Promise<Movie[]> {
    if (!keyword || !keyword.trim()) return [];
    const cleanKw = keyword.trim();
    const cacheKey = `nguonc_search_${cleanKw.toLowerCase()}`;
    const cached = this.getCached<Movie[]>(cacheKey);
    if (cached) return cached;

    try {
      const res = await fetch(
        `${NGUONC_BASE_URL}/films/search?keyword=${encodeURIComponent(cleanKw)}`,
        {
          signal: AbortSignal.timeout(3000),
          headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" },
        }
      );
      if (!res.ok) return [];
      const json = await res.json();
      if (json.status !== "success" || !Array.isArray(json.items)) return [];

      const movies: Movie[] = json.items.map((item: any) => ({
        id: item.slug,
        title: item.name,
        originalTitle: item.original_name || item.name,
        slug: item.slug,
        description: item.description || "",
        posterUrl: item.poster_url_webp || item.poster_url || item.thumb_url_webp || item.thumb_url || "",
        backdropUrl: item.thumb_url_webp || item.thumb_url || item.poster_url_webp || item.poster_url || "",
        rating: 8.0,
        views: 1000,
        year: item.year || new Date().getFullYear(),
        duration: item.time || (item.total_episodes ? `${item.total_episodes} tập` : "HD"),
        type: item.total_episodes && item.total_episodes > 1 ? "series" : "single",
        genres: ["Phim Mới"],
        genreSlugs: ["phim-moi"],
        country: "Quốc Tế",
        countrySlug: "quoc-te",
        quality: item.quality || "HD",
        language: item.language || "Vietsub",
        director: item.director || "Đang cập nhật",
        cast: item.casts ? item.casts.split(",").map((c: string) => c.trim()) : [],
        actors: item.casts ? item.casts.split(",").map((c: string) => ({ name: c.trim() })) : [],
      }));

      this.setCache(cacheKey, movies, 15 * 60 * 1000);
      return movies;
    } catch {
      return [];
    }
  }
}

export const nguoncService = new NguonCService();

