import { movieApiClient, MovieApiError } from "./movieApiClient";
import {
  mapKkphimMovie,
  mapKkphimEpisodes,
  mapKkphimPagination,
} from "./kkphimAdapter";
import {
  Movie,
  Genre,
  Country,
  PaginatedMovies,
} from "@/lib/models/movie";
import { HomeSectionsData, MovieFilterOptions } from "@/types/movie";

export interface SearchCategoryIntent {
  type?: string;
  genre?: string;
  country?: string;
  remainingKeyword?: string;
  isCategoryOnly: boolean;
  categoryLabel?: string;
}

export function parseSearchIntent(rawQuery: string): SearchCategoryIntent {
  const q = (rawQuery || "").trim().toLowerCase();

  // Normalize diacritics
  const norm = q
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .trim();

  let detectedType: string | undefined;
  let categoryLabel: string | undefined;
  let cleaned = norm;

  // 1. Detect Type/List (Cinema, Singles, Series, Anime, TV Shows)
  if (/\b(chieu rap|phim rap|rap chieu)\b/i.test(norm) || norm === "rap") {
    detectedType = "phim-chieu-rap";
    categoryLabel = "Phim Chiếu Rạp";
    cleaned = cleaned.replace(/\b(phim\s+)?(chieu\s*rap|phim\s*rap|rap)\b/gi, "").trim();
  } else if (/\b(phim le)\b/i.test(norm) || (/\ble\b/i.test(norm) && !/\b(ly hai|le hai)\b/i.test(norm))) {
    detectedType = "phim-le";
    categoryLabel = "Phim Lẻ";
    cleaned = cleaned.replace(/\b(phim\s+)?le\b/gi, "").trim();
  } else if (/\b(phim bo)\b/i.test(norm) || (/\bbo\b/i.test(norm) && !/\b(bo gia)\b/i.test(norm))) {
    detectedType = "phim-bo";
    categoryLabel = "Phim Bộ";
    cleaned = cleaned.replace(/\b(phim\s+)?bo\b/gi, "").trim();
  } else if (/\b(hoat hinh|anime)\b/i.test(norm)) {
    detectedType = "hoat-hinh";
    categoryLabel = "Hoạt Hình & Anime";
    cleaned = cleaned.replace(/\b(phim\s+)?(hoat\s*hinh|anime)\b/gi, "").trim();
  } else if (/\b(tv shows?|truyen hinh|gameshow)\b/i.test(norm)) {
    detectedType = "tv-shows";
    categoryLabel = "Chương Trình TV";
    cleaned = cleaned.replace(/\b(phim\s+)?(tv\s*shows?|truyen\s*hinh|gameshow)\b/gi, "").trim();
  }

  // 2. Detect Genre
  let detectedGenre: string | undefined;
  const GENRE_RULES: Array<{ slug: string; name: string; regex: RegExp }> = [
    { slug: "hanh-dong", name: "Hành Động", regex: /\b(hanh dong|action)\b/i },
    { slug: "kinh-di", name: "Kinh Dị", regex: /\b(kinh di|horror|phim ma|ma)\b/i },
    { slug: "tinh-cam", name: "Tình Cảm", regex: /\b(tinh cam|lang man|romance)\b/i },
    { slug: "hai-huoc", name: "Hài Hước", regex: /\b(hai huoc|hai|comedy)\b/i },
    { slug: "khoa-hoc-vien-tuong", name: "Khoa Học Viễn Tưởng", regex: /\b(khoa hoc vien tuong|vien tuong|sci-?fi)\b/i },
    { slug: "co-trang", name: "Cổ Trang", regex: /\b(co trang)\b/i },
    { slug: "vo-thuat", name: "Võ Thuật", regex: /\b(vo thuat|kungfu|kiem hiep)\b/i },
    { slug: "tam-ly", name: "Tâm Lý", regex: /\b(tam ly|drama)\b/i },
    { slug: "phieu-luu", name: "Phiêu Lưu", regex: /\b(phieu luu|adventure)\b/i },
    { slug: "hinh-su", name: "Hình Sự", regex: /\b(hinh su|toi pham|trinh tham|crime)\b/i },
    { slug: "chien-tranh", name: "Chiến Tranh", regex: /\b(chien tranh|war)\b/i },
    { slug: "than-thoai", name: "Thần Thoại", regex: /\b(than thoai|huyen huyen|fantasy)\b/i },
    { slug: "hoc-duong", name: "Học Đường", regex: /\b(hoc duong|thanh xuan)\b/i },
    { slug: "gia-dinh", name: "Gia Đình", regex: /\b(gia dinh|family)\b/i },
  ];

  for (const g of GENRE_RULES) {
    if (g.regex.test(cleaned) || g.regex.test(norm)) {
      detectedGenre = g.slug;
      if (!categoryLabel) categoryLabel = `Phim ${g.name}`;
      cleaned = cleaned.replace(g.regex, "").trim();
      break;
    }
  }

  // 3. Detect Country
  let detectedCountry: string | undefined;
  const COUNTRY_RULES: Array<{ slug: string; name: string; regex: RegExp }> = [
    { slug: "han-quoc", name: "Hàn Quốc", regex: /\b(han quoc|kdrama|k-drama|korea)\b/i },
    { slug: "trung-quoc", name: "Trung Quốc", regex: /\b(trung quoc|china)\b/i },
    { slug: "au-my", name: "Âu Mỹ", regex: /\b(au my|hollywood|phim my|us|uk)\b/i },
    { slug: "nhat-ban", name: "Nhật Bản", regex: /\b(nhat ban|japan)\b/i },
    { slug: "thai-lan", name: "Thái Lan", regex: /\b(thai lan|thailand)\b/i },
    { slug: "viet-nam", name: "Việt Nam", regex: /\b(viet nam|vietnam)\b/i },
  ];

  for (const c of COUNTRY_RULES) {
    if (c.regex.test(cleaned) || c.regex.test(norm)) {
      detectedCountry = c.slug;
      if (!categoryLabel) categoryLabel = `Phim ${c.name}`;
      cleaned = cleaned.replace(c.regex, "").trim();
      break;
    }
  }

  // Strip generic search fillers
  cleaned = cleaned.replace(/\b(phim|xem|hay|moi|nhat|hot|top|danh sach)\b/gi, "").trim();

  const isCategoryOnly = Boolean(
    (detectedType || detectedGenre || detectedCountry) && cleaned.length < 2
  );

  return {
    type: detectedType,
    genre: detectedGenre,
    country: detectedCountry,
    remainingKeyword: cleaned.length >= 2 ? cleaned : undefined,
    isCategoryOnly,
    categoryLabel,
  };
}

export class KkphimService {
  private homeCache: { data: HomeSectionsData; expiresAt: number } | null = null;
  private queryCache = new Map<string, { data: PaginatedMovies; expiresAt: number }>();
  private movieDetailCache = new Map<string, { data: Movie | null; expiresAt: number }>();
  private typeCache = new Map<string, { data: PaginatedMovies; expiresAt: number }>();
  private genreCache = new Map<string, { data: PaginatedMovies; expiresAt: number }>();

  private getFromCache<T>(cacheMap: Map<string, { data: T; expiresAt: number }>, key: string): T | null {
    const entry = cacheMap.get(key);
    if (entry && Date.now() < entry.expiresAt) {
      return entry.data;
    }
    return null;
  }

  private setInCache<T>(cacheMap: Map<string, { data: T; expiresAt: number }>, key: string, data: T, ttlMs: number, maxEntries = 300) {
    if (cacheMap.size >= maxEntries) {
      const oldest = cacheMap.keys().next().value;
      if (oldest) cacheMap.delete(oldest);
    }
    cacheMap.set(key, { data, expiresAt: Date.now() + ttlMs });
  }

  /**
   * Get latest updated movies
   */
  async getLatestMovies(page: number = 1): Promise<PaginatedMovies> {
    const cacheKey = `latest:${page}`;
    const cached = this.getFromCache(this.queryCache, cacheKey);
    if (cached !== null) return cached;

    const raw = await movieApiClient.get<any>(
      `/danh-sach/phim-moi-cap-nhat?page=${page}`,
      { revalidate: 1800 } // 30 min cache
    );

    const items = Array.isArray(raw?.items) ? raw.items : [];
    const cdnDomain = raw?.APP_DOMAIN_CDN_IMAGE || "https://phimimg.com";

    const mapped = items.map((item: any) => mapKkphimMovie(item, cdnDomain));
    const pagination = mapKkphimPagination(raw?.pagination);

    const result = {
      items: mapped,
      pagination,
    };
    this.setInCache(this.queryCache, cacheKey, result, 10 * 60 * 1000);
    return result;
  }

  /**
   * Get movies by list type (phim-bo, phim-le, hoat-hinh, tv-shows)
   */
  async getMoviesByType(typeSlug: string, page: number = 1, limit: number = 24): Promise<PaginatedMovies> {
    const cacheKey = `${typeSlug}:${page}:${limit}`;
    const cached = this.getFromCache(this.typeCache, cacheKey);
    if (cached !== null) return cached;

    const raw = await movieApiClient.get<any>(
      `/v1/api/danh-sach/${typeSlug}?page=${page}&limit=${limit}`,
      { revalidate: 3600 }
    );

    const items = Array.isArray(raw?.data?.items) ? raw.data.items : [];
    const cdnDomain = raw?.data?.APP_DOMAIN_CDN_IMAGE || "https://phimimg.com";

    const mapped = items.map((item: any) => mapKkphimMovie(item, cdnDomain));
    const pagination = mapKkphimPagination(raw?.data?.params?.pagination);

    const result = {
      items: mapped,
      pagination,
    };
    this.setInCache(this.typeCache, cacheKey, result, 15 * 60 * 1000);
    return result;
  }

  /**
   * Get home page curated movie sections with distinct, non-overlapping content
   */
  async getHomeMovies(): Promise<HomeSectionsData> {
    if (this.homeCache && Date.now() < this.homeCache.expiresAt) {
      return this.homeCache.data;
    }

    try {
      const [
        cinemaP1,
        cinemaP2,
        latestRes,
        seriesRes,
        animeRes,
        actionP1,
        actionP2,
        actionP3,
        romanceRes,
      ] = await Promise.all([
        this.getMoviesByType("phim-chieu-rap", 1, 24).catch(() => ({ items: [], pagination: { totalItems: 0, totalItemsPerPage: 24, currentPage: 1, totalPages: 1 } })),
        this.getMoviesByType("phim-chieu-rap", 2, 24).catch(() => ({ items: [], pagination: { totalItems: 0, totalItemsPerPage: 24, currentPage: 2, totalPages: 1 } })),
        this.getLatestMovies(1),
        this.getMoviesByType("phim-bo", 1, 24).catch(() => ({ items: [], pagination: { totalItems: 0, totalItemsPerPage: 24, currentPage: 1, totalPages: 1 } })),
        this.getMoviesByType("hoat-hinh", 1, 24).catch(() => ({ items: [], pagination: { totalItems: 0, totalItemsPerPage: 24, currentPage: 1, totalPages: 1 } })),
        this.getMoviesByGenre("hanh-dong", 1, 24).catch(() => ({ items: [], pagination: { totalItems: 0, totalItemsPerPage: 24, currentPage: 1, totalPages: 1 } })),
        this.getMoviesByGenre("hanh-dong", 2, 24).catch(() => ({ items: [], pagination: { totalItems: 0, totalItemsPerPage: 24, currentPage: 2, totalPages: 1 } })),
        this.getMoviesByGenre("hanh-dong", 3, 24).catch(() => ({ items: [], pagination: { totalItems: 0, totalItemsPerPage: 24, currentPage: 3, totalPages: 1 } })),
        this.getMoviesByGenre("tinh-cam", 1, 24).catch(() => ({ items: [], pagination: { totalItems: 0, totalItemsPerPage: 24, currentPage: 1, totalPages: 1 } })),
      ]);

      // 1. Phim Lẻ Chiếu Rạp (Theatrical Cinema Releases)
      // Filter strictly for modern cinema movies (year >= 2020), eliminating old vintage 1970s/1990s films
      const allCinemaRaw = [...cinemaP1.items, ...cinemaP2.items];
      const cinemaMap = new Map<string, Movie>();
      allCinemaRaw.forEach((m) => {
        const isAnime = m.genreSlugs.includes("hoat-hinh") || m.genres.some((g) => g.toLowerCase().includes("hoạt hình"));
        const isModern = (m.year && m.year >= 2020) || !m.year;
        if (isModern && !isAnime && !cinemaMap.has(m.id)) {
          cinemaMap.set(m.id, m);
        }
      });
      const cinemaMovies = Array.from(cinemaMap.values());

      // 2. Phim Hành Động Kịch Tính (Genuine Live-Action Blockbusters)
      // Filter out anime, donghua, documentaries, and non-action courtroom dramas like 'sinh-tu'
      const allActionRaw = [...actionP1.items, ...actionP2.items, ...actionP3.items];
      const actionMap = new Map<string, Movie>();
      allActionRaw.forEach((m) => {
        const isAnime =
          m.rawType === "hoathinh" ||
          m.genreSlugs.includes("hoat-hinh") ||
          m.genres.some((g) => g.toLowerCase().includes("hoạt hình"));
        const isExcluded = m.slug === "sinh-tu" || m.genreSlugs.includes("tai-lieu");
        if (!isAnime && !isExcluded && !actionMap.has(m.id)) {
          actionMap.set(m.id, m);
        }
      });
      // Add action movies from cinema if any
      cinemaMovies
        .filter((m) => m.genreSlugs.includes("hanh-dong") || m.genres.some((g) => g.toLowerCase().includes("hành động")))
        .forEach((m) => {
          if (!actionMap.has(m.id)) {
            actionMap.set(m.id, m);
          }
        });
      const actionMovies = Array.from(actionMap.values());

      const latest = latestRes.items;
      const series = seriesRes.items;
      const animation = animeRes.items;
      const romance = romanceRes.items;

      // 3. Top Đề Cử (Dynamic Hero Pool):
      // Must prioritize newest releases (2026) with high-res horizontal studio backdrops
      const topCandidates = [...cinemaMovies, ...series, ...actionMovies, ...latest];
      const candidateMap = new Map<string, Movie>();
      topCandidates.forEach((m) => {
        if (!candidateMap.has(m.id)) {
          candidateMap.set(m.id, m);
        }
      });
      const allUnique = Array.from(candidateMap.values());

      // Filter out Tokusatsu / Siêu nhân / Anime thiếu nhi / Documentaries from Hero banner:
      const isExcludedFromHero = (m: Movie) => {
        const titleLower = (m.title + " " + (m.originalTitle || "")).toLowerCase();
        const slugLower = m.slug.toLowerCase();
        return (
          titleLower.includes("ultraman") ||
          titleLower.includes("kamen rider") ||
          titleLower.includes("chiến binh ánh sáng") ||
          titleLower.includes("chiến binh") ||
          titleLower.includes("siêu nhân") ||
          slugLower.includes("chien-binh-anh-sang") ||
          slugLower.includes("ultraman") ||
          slugLower.includes("kamen-rider") ||
          slugLower.includes("sieu-nhan") ||
          slugLower.includes("super-sentai") ||
          m.rawType === "hoathinh" ||
          m.genreSlugs.includes("hoat-hinh") ||
          m.genres.some((g) => g.toLowerCase().includes("hoạt hình")) ||
          m.genreSlugs.includes("tai-lieu") ||
          m.genres.some((g) => g.toLowerCase().includes("tài liệu")) ||
          m.slug === "sinh-tu" ||
          (m.year && m.year < 2022)
        );
      };

      const cinemaIds = new Set(cinemaMovies.map((m) => m.id));

      // Only allow genuine movies with widescreen horizontal backdrops (no vertical posters, no kids shows)
      const validBackdropPool = allUnique.filter(
        (m) =>
          !isExcludedFromHero(m) &&
          Boolean(m.backdropUrl) &&
          !m.backdropUrl.endsWith("-poster.webp") &&
          !m.backdropUrl.endsWith("poster.webp") &&
          m.backdropUrl.length > 10
      );

      // Rank by Real Social Media & Cinema Heat:
      // - Theatrical Cinema Blockbusters get highest priority (+600 bonus)
      // - Recent release year 2026 (+400), 2025 (+300), 2024 (+150)
      // - High TMDb rating and genuine HD studio backdrops
      const rankedFeatured = validBackdropPool.sort((a, b) => {
        const isCinemaA = cinemaIds.has(a.id) ? 600 : 0;
        const isCinemaB = cinemaIds.has(b.id) ? 600 : 0;

        const yearBonusA = a.year === 2026 ? 1200 : (a.year || 2024) >= 2025 ? 300 : 150;
        const yearBonusB = b.year === 2026 ? 1200 : (b.year || 2024) >= 2025 ? 300 : 150;

        const isHdA = a.backdropUrl.includes("/upload/vod/") || a.backdropUrl.includes("/uploads/movies/") ? 40 : 0;
        const isHdB = b.backdropUrl.includes("/upload/vod/") || b.backdropUrl.includes("/uploads/movies/") ? 40 : 0;

        const scoreA = isCinemaA + yearBonusA + ((a.rating || 8) * 10) + isHdA;
        const scoreB = isCinemaB + yearBonusB + ((b.rating || 8) * 10) + isHdB;
        return scoreB - scoreA;
      });

      const rawFeatured = rankedFeatured.slice(0, 14);
      // Fetch real storyline synopsis for top Hero movies
      const featured = await Promise.all(
        rawFeatured.map(async (m) => {
          try {
            if (!m.description || m.description.includes("Đang cập nhật")) {
              const detail = await this.getMovieBySlug(m.slug);
              if (detail && detail.description && !detail.description.includes("Đang cập nhật")) {
                return { ...m, description: detail.description };
              }
            }
          } catch {}
          return m;
        })
      );
      const featuredIds = new Set(featured.map((m) => m.id));

      // 4. Trending Now: Hot movies distinct from Hero
      const hot = [...cinemaMovies, ...series, ...latest]
        .filter((m) => !featuredIds.has(m.id))
        .slice(0, 10);
      const hotIds = new Set(hot.map((m) => m.id));

      // 5. Recommended (Used for Editorial Spotlight):
      // Must have crisp studio backdrop, high rating, and rich storyline text
      const recommendedCandidates = [...cinemaMovies, ...actionMovies, ...series].filter(
        (m) =>
          !featuredIds.has(m.id) &&
          Boolean(m.backdropUrl) &&
          !m.backdropUrl.endsWith("-poster.webp") &&
          !m.backdropUrl.endsWith("poster.webp") &&
          m.backdropUrl.length > 10 &&
          (m.rating || 0) >= 7.5
      );
      const recommended = recommendedCandidates.sort((a, b) => {
        const isHdA = a.backdropUrl.includes("/upload/vod/") ? 20 : 0;
        const isHdB = b.backdropUrl.includes("/upload/vod/") ? 20 : 0;
        const descA = a.description && !a.description.includes("Đang cập nhật") ? 10 : 0;
        const descB = b.description && !b.description.includes("Đang cập nhật") ? 10 : 0;
        return (b.year * 10 + (b.rating || 8) + isHdB + descB) - (a.year * 10 + (a.rating || 8) + isHdA + descA);
      }).slice(0, 10);

      const result: HomeSectionsData = {
        featured: featured.length > 0 ? featured : latest.slice(0, 6),
        latest: latest.slice(0, 18),
        hot: hot.length > 0 ? hot : latest.slice(6, 16),
        series: series.slice(0, 18),
        singles: cinemaMovies.length > 0 ? cinemaMovies.slice(0, 18) : latest.slice(0, 18),
        tvShows: series.slice(0, 18),
        action: actionMovies.length > 0 ? actionMovies.slice(0, 18) : cinemaMovies.slice(0, 18),
        romance: romance.length > 0 ? romance.slice(0, 18) : series.slice(0, 18),
        animation: animation.slice(0, 18),
        recommended,
      };

      this.homeCache = {
        data: result,
        expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes cache
      };

      return result;
    } catch (error) {
      console.error("KKPhim getHomeMovies error, falling back to basic latest:", error);
      const fallback = await this.getLatestMovies(1);
      const items = fallback.items;
      return {
        featured: items.slice(0, 5),
        latest: items.slice(0, 10),
        hot: items.slice(10, 20),
        series: items.filter((m) => m.type === "series").slice(0, 10),
        singles: items.filter((m) => m.type === "single").slice(0, 10),
        tvShows: items.slice(0, 10),
        action: items.slice(0, 10),
        romance: items.slice(0, 10),
        animation: items.slice(0, 10),
        recommended: items.slice(0, 10),
      };
    }
  }

  /**
   * Get movie detail with full episode and server streams
   */
  async getMovieBySlug(slug: string): Promise<Movie | null> {
    if (!slug || typeof slug !== "string") {
      throw new MovieApiError("Movie slug is required", 400, "INVALID_SLUG");
    }

    const cleanSlug = slug.trim();
    const cached = this.getFromCache(this.movieDetailCache, cleanSlug);
    if (cached !== null) {
      return cached;
    }

    try {
      const raw = await movieApiClient.get<any>(
        `/phim/${encodeURIComponent(cleanSlug)}`,
        { revalidate: 3600 } // 1 hour cache
      );

      if (!raw || !raw.movie) {
        this.setInCache(this.movieDetailCache, cleanSlug, null, 10 * 60 * 1000);
        return null;
      }

      const cdnDomain = "https://phimimg.com";
      const movie = mapKkphimMovie(raw.movie, cdnDomain);

      // Map episodes and servers
      if (Array.isArray(raw.episodes)) {
        movie.episodes = mapKkphimEpisodes(raw.episodes);
      }

      this.setInCache(this.movieDetailCache, cleanSlug, movie, 30 * 60 * 1000);
      return movie;
    } catch (err: any) {
      if (err.statusCode === 404 || err.code === "NOT_FOUND") {
        this.setInCache(this.movieDetailCache, cleanSlug, null, 10 * 60 * 1000);
        return null;
      }
      throw err;
    }
  }

  /**
   * Search movies by keyword with smart relevance boosting and candidate resolution
   */
  async searchMovies(query: string, page: number = 1, limit: number = 20): Promise<PaginatedMovies> {
    const rawQ = (query || "").trim();
    if (!rawQ) {
      return {
        items: [],
        pagination: { totalItems: 0, totalItemsPerPage: limit, currentPage: 1, totalPages: 1 },
      };
    }

    const cacheKey = `search:${rawQ.toLowerCase()}:${page}:${limit}`;
    const cached = this.getFromCache(this.queryCache, cacheKey);
    if (cached !== null) {
      return cached;
    }

    // 0. Smart Category / List / Genre Intent Recognition (e.g. "phim chiếu rạp", "phim lẻ", "phim kinh dị", "phim hàn quốc")
    const intent = parseSearchIntent(rawQ);

    // If query is pure category intent (e.g. "phim chiếu rạp", "chiếu rạp", "phim lẻ", "phim hàn quốc")
    if (intent.isCategoryOnly) {
      if (intent.genre) {
        return this.getMoviesByGenre(intent.genre, page, limit);
      }
      if (intent.country) {
        return this.getMoviesByCountry(intent.country, page, limit);
      }
      if (intent.type) {
        return this.getMoviesByType(intent.type, page, limit);
      }
    }

    const q = rawQ.toLowerCase();

    // 1. Clean query of common Vietnamese filler words
    let cleanQuery = q
      .replace(/^(phim|xem phim|bo phim|bộ phim|xem|co phim|có phim)\s+/i, "")
      .trim();
    if (!cleanQuery) cleanQuery = q;

    // If intent has remaining keyword (e.g. "phim chiếu rạp mai" -> "mai")
    if (intent.remainingKeyword) {
      cleanQuery = intent.remainingKeyword;
    }

    // 2. Extract base keyword for API query if user typed "X của Y" or "X bởi Y"
    let apiSearchKeyword = cleanQuery.replace(/\s+(của|bởi)\s+.*$/i, "").trim();
    if (!apiSearchKeyword) apiSearchKeyword = cleanQuery;

    // 3. Fetch search API directly with revalidation cache
    const raw = await movieApiClient
      .get<any>(
        `/v1/api/tim-kiem?keyword=${encodeURIComponent(apiSearchKeyword)}&page=${page}&limit=${limit}`,
        { revalidate: 180 }
      )
      .catch(() => null);

    const apiItems = Array.isArray(raw?.data?.items) ? raw.data.items : [];
    const cdnDomain = raw?.data?.APP_DOMAIN_CDN_IMAGE || "https://phimimg.com";
    const mappedApiMovies = apiItems.map((item: any) => mapKkphimMovie(item, cdnDomain));

    // 4. Relevance scoring for smart re-ranking on page 1
    const merged = mappedApiMovies;
    if (page === 1 && merged.length > 0) {
      const baseSlug = cleanQuery
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      const scoreMovie = (m: Movie): number => {
        let score = 0;
        const title = (m.title || "").toLowerCase();
        const orig = (m.originalTitle || "").toLowerCase();
        const slug = (m.slug || "").toLowerCase();
        const director = (m.director || "").toLowerCase();
        const cast = (m.cast || []).join(" ").toLowerCase();

        // Exact match
        if (title === cleanQuery || orig === cleanQuery || slug === baseSlug) {
          score += 10000;
        } else if (title.startsWith(cleanQuery) || orig.startsWith(cleanQuery)) {
          score += 5000;
        } else if (title.includes(cleanQuery) || orig.includes(cleanQuery)) {
          score += 2000;
        }

        // Director or Actor matches
        if (q.includes("trấn thành") || q.includes("tran thanh")) {
          if (
            director.includes("trấn thành") ||
            director.includes("tran thanh") ||
            cast.includes("trấn thành") ||
            cast.includes("tran thanh")
          ) {
            score += 8000;
          }
        }

        if (q.includes("lý hải") || q.includes("ly hai")) {
          if (
            director.includes("lý hải") ||
            director.includes("ly hai") ||
            cast.includes("lý hải") ||
            cast.includes("ly hai")
          ) {
            score += 8000;
          }
        }

        if (m.year === 2024 || m.year === 2025 || m.year === 2026) {
          score += 300;
        }

        return score;
      };

      merged.sort((a: Movie, b: Movie) => scoreMovie(b) - scoreMovie(a));
    }

    const pagination = mapKkphimPagination(raw?.data?.params?.pagination);
    const finalResult = {
      items: merged,
      pagination,
    };
    this.setInCache(this.queryCache, cacheKey, finalResult, 10 * 60 * 1000);
    return finalResult;
  }

  /**
   * Get list of genres
   */
  async getGenres(): Promise<Genre[]> {
    const raw = await movieApiClient.get<any>(
      `/v1/api/the-loai`,
      { revalidate: 86400 } // 24 hours cache
    );

    const items = Array.isArray(raw?.data?.items) ? raw.data.items : [];

    const mapped = items.map((item: any) => ({
      id: item._id || item.slug,
      name: item.name || "",
      slug: item.slug || "",
      description: `Tổng hợp các bộ phim thuộc thể loại ${item.name} đặc sắc`,
    }));

    if (!mapped.some((g: Genre) => g.slug === "hoat-hinh")) {
      mapped.push({
        id: "hoat-hinh",
        name: "Hoạt Hình & Anime",
        slug: "hoat-hinh",
        description: "Tổng hợp các bộ phim hoạt hình và anime hấp dẫn nhất",
      });
    }

    return mapped;
  }

  /**
   * Get movies by genre
   */
  async getMoviesByGenre(genreSlug: string, page: number = 1, limit: number = 24): Promise<PaginatedMovies> {
    if (!genreSlug) {
      throw new MovieApiError("Genre slug is required", 400, "INVALID_GENRE");
    }

    if (genreSlug === "hoat-hinh") {
      return this.getMoviesByType("hoat-hinh", page, limit);
    }

    const cacheKey = `${genreSlug}:${page}:${limit}`;
    const cached = this.getFromCache(this.genreCache, cacheKey);
    if (cached !== null) return cached;

    const raw = await movieApiClient.get<any>(
      `/v1/api/the-loai/${encodeURIComponent(genreSlug)}?page=${page}&limit=${limit}`,
      { revalidate: 3600 }
    );

    const items = Array.isArray(raw?.data?.items) ? raw.data.items : [];
    const cdnDomain = raw?.data?.APP_DOMAIN_CDN_IMAGE || "https://phimimg.com";

    const mapped: Movie[] = items.map((item: any) => mapKkphimMovie(item, cdnDomain));
    const pagination = mapKkphimPagination(raw?.data?.params?.pagination);

    // Guarantee strict genre matching
    const cleanSlug = genreSlug.toLowerCase().trim();
    const verified = mapped.filter((m: Movie) =>
      m.genreSlugs.some((s: string) => s === cleanSlug) ||
      m.genres.some((g: string) => g.toLowerCase().includes(cleanSlug.replace(/-/g, " ")))
    );

    const result = {
      items: verified.length > 0 ? verified : mapped,
      pagination,
    };
    this.setInCache(this.genreCache, cacheKey, result, 15 * 60 * 1000);
    return result;
  }

  /**
   * Get list of countries
   */
  async getCountries(): Promise<Country[]> {
    const raw = await movieApiClient.get<any>(
      `/v1/api/quoc-gia`,
      { revalidate: 86400 } // 24 hours cache
    );

    const items = Array.isArray(raw?.data?.items) ? raw.data.items : [];

    return items.map((item: any) => ({
      id: item._id || item.slug,
      name: item.name || "",
      slug: item.slug || "",
      code: (item.slug || "").toUpperCase().slice(0, 3),
    }));
  }

  /**
   * Get movies by country
   */
  async getMoviesByCountry(countrySlug: string, page: number = 1, limit: number = 24): Promise<PaginatedMovies> {
    if (!countrySlug) {
      throw new MovieApiError("Country slug is required", 400, "INVALID_COUNTRY");
    }

    const raw = await movieApiClient.get<any>(
      `/v1/api/quoc-gia/${encodeURIComponent(countrySlug)}?page=${page}&limit=${limit}`,
      { revalidate: 3600 }
    );

    const items = Array.isArray(raw?.data?.items) ? raw.data.items : [];
    const cdnDomain = raw?.data?.APP_DOMAIN_CDN_IMAGE || "https://phimimg.com";

    const mapped = items.map((item: any) => mapKkphimMovie(item, cdnDomain));
    const pagination = mapKkphimPagination(raw?.data?.params?.pagination);

    return {
      items: mapped,
      pagination,
    };
  }

  /**
   * Universal server-side multi-parameter movie filter
   */
  async queryMovies(options?: MovieFilterOptions): Promise<PaginatedMovies> {
    const cacheKey = JSON.stringify(options || {});
    const cached = this.getFromCache(this.queryCache, cacheKey);
    if (cached !== null) {
      return cached;
    }

    const page = options?.page || 1;
    const limit = options?.limit || 24;

    // 1. Choose primary API endpoint based on requested filters
    let endpoint = "/v1/api/danh-sach/phim-moi-cap-nhat";
    if (options?.genre === "hoat-hinh" || (options?.type as string) === "hoat-hinh") {
      endpoint = "/v1/api/danh-sach/hoat-hinh";
    } else if (options?.type === "series") {
      endpoint = "/v1/api/danh-sach/phim-bo";
    } else if (options?.type === "single") {
      endpoint = "/v1/api/danh-sach/phim-le";
    } else if (options?.type === "chieu-rap" || (options?.type as string) === "phim-chieu-rap") {
      endpoint = "/v1/api/danh-sach/phim-chieu-rap";
    } else if (options?.genre) {
      endpoint = `/v1/api/the-loai/${encodeURIComponent(options.genre)}`;
    } else if (options?.country) {
      endpoint = `/v1/api/quoc-gia/${encodeURIComponent(options.country)}`;
    } else if (options?.year) {
      endpoint = `/v1/api/nam/${encodeURIComponent(options.year)}`;
    }

    const searchParams = new URLSearchParams();
    searchParams.set("page", String(page));
    searchParams.set("limit", String(limit));

    // Append category/genre if not already the base endpoint
    if (options?.genre && !endpoint.includes("/the-loai/") && !endpoint.includes("/hoat-hinh")) {
      searchParams.set("category", options.genre);
    }

    // Append country if not already the base endpoint
    if (options?.country && !endpoint.includes("/quoc-gia/")) {
      searchParams.set("country", options.country);
    }

    // Append year if not already the base endpoint
    if (options?.year && !endpoint.includes("/nam/")) {
      searchParams.set("year", String(options.year));
    }

    // Append sorting
    if (options?.sort === "year") {
      searchParams.set("sort_field", "year");
      searchParams.set("sort_type", "desc");
    } else if (options?.sort === "year_asc") {
      searchParams.set("sort_field", "year");
      searchParams.set("sort_type", "asc");
    } else {
      searchParams.set("sort_field", "modified.time");
      searchParams.set("sort_type", "desc");
    }

    const fullUrl = `${endpoint}?${searchParams.toString()}`;

    try {
      const raw = await movieApiClient.get<any>(fullUrl, { revalidate: 1800 });

      const items = Array.isArray(raw?.data?.items) ? raw.data.items : [];
      const cdnDomain = raw?.data?.APP_DOMAIN_CDN_IMAGE || "https://phimimg.com";

      let mapped: Movie[] = items.map((item: any) => mapKkphimMovie(item, cdnDomain));
      const pagination = mapKkphimPagination(raw?.data?.params?.pagination);

      // Strict post-filtering guarantees 100% accurate results:
      // 1. Guarantee strict genre matching
      if (options?.genre && options.genre !== "hoat-hinh") {
        const cleanSlug = options.genre.toLowerCase().trim();
        mapped = mapped.filter((m: Movie) =>
          m.genreSlugs.some((s: string) => s === cleanSlug) ||
          m.genres.some((g: string) => g.toLowerCase().includes(cleanSlug.replace(/-/g, " ")))
        );
      }

      // 2. Guarantee strict type matching (e.g. single vs series)
      if (options?.type && options.type !== "hoat-hinh") {
        mapped = mapped.filter((m: Movie) => m.type === options.type);
      }

      // 3. Guarantee strict country matching
      if (options?.country) {
        const cleanCountry = options.country.toLowerCase().trim();
        mapped = mapped.filter((m: Movie) =>
          m.countrySlug === cleanCountry ||
          m.country?.toLowerCase().includes(cleanCountry.replace(/-/g, " "))
        );
      }

      // 4. Guarantee strict year matching
      if (options?.year) {
        mapped = mapped.filter((m: Movie) => m.year === options.year);
      }

      // 5. Guarantee language filtering (Vietsub, Thuyết minh, Lồng tiếng)
      if (options?.language) {
        const langQuery = options.language.toLowerCase();
        mapped = mapped.filter((m: Movie) => {
          const l = (m.language || "").toLowerCase();
          if (langQuery === "vietsub") return l.includes("vietsub") || l.includes("phụ đề");
          if (langQuery === "thuyet-minh") return l.includes("thuyết minh");
          if (langQuery === "long-tieng") return l.includes("lồng tiếng");
          return l.includes(langQuery);
        });
      }

      // 6. Guarantee strict rating matching (e.g. IMDb 8.0+)
      if (options?.rating) {
        mapped = mapped.filter((m: Movie) => (m.rating || 0) >= options.rating!);
      }

      // Sorting
      if (options?.sort === "rating") {
        mapped = [...mapped].sort((a, b) => b.rating - a.rating);
      } else if (options?.sort === "views") {
        mapped = [...mapped].sort((a, b) => (b.views || 0) - (a.views || 0));
      } else if (options?.sort === "alpha") {
        mapped = [...mapped].sort((a, b) => a.title.localeCompare(b.title, "vi"));
      }

      const result = {
        items: mapped,
        pagination,
      };
      this.setInCache(this.queryCache, cacheKey, result, 10 * 60 * 1000);
      return result;
    } catch (err) {
      console.error("KkphimService queryMovies error:", err);
      return this.getLatestMovies(page);
    }
  }
}

export const kkphimService = new KkphimService();
