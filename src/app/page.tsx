import { movieProvider } from "@/lib/providers";
import { MovieHero } from "@/components/movie/movie-hero";
import { MoodDiscovery } from "@/components/home/mood-discovery";
import { MovieRow } from "@/components/movie/movie-row";
import { ContinueWatchingRow } from "@/components/movie/continue-watching-row";
import { TrendingSection } from "@/components/home/trending-section";
import { EditorialSpotlight } from "@/components/home/editorial-spotlight";
import { YearDiscovery } from "@/components/home/year-discovery";
import { FaqSection } from "@/components/home/faq-section";
import { StreamCta } from "@/components/home/stream-cta";
import { AuthSyncBanner } from "@/components/home/auth-sync-banner";
import { getTmdbMedia, TMDB_API_KEY } from "@/lib/server/tmdb";
import { Movie } from "@/types/movie";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "RubyFilm - Trải Nghiệm Điện Ảnh Đỉnh Cao Chuẩn 4K HDR",
  description:
    "Khám phá hàng ngàn tựa phim điện ảnh bom tấn chiếu rạp, phim bộ đặc sắc, anime tuyển chọn với chất lượng 4K HDR sống động trên RubyFilm hoàn toàn miễn phí.",
  openGraph: {
    title: "RubyFilm - Nền Tảng Xem Phim Trực Tuyến Đỉnh Cao",
    description:
      "Thế giới điện ảnh bom tấn và series truyền hình chất lượng 4K HDR không giới hạn.",
    type: "website",
    locale: "vi_VN",
    siteName: "RubyFilm",
  },
};

export const revalidate = 600; // 10 minutes ISR cache

interface HomePagePreparedData {
  heroMovies: Movie[];
  trendingMovies: Movie[];
  latestMovies: Movie[];
  spotlightMovies: Movie[];
  singleMovies: Movie[];
  seriesMovies: Movie[];
  animeMovies: Movie[];
  actionMovies: Movie[];
}

let homePageMemoryCache: { data: HomePagePreparedData; timestamp: number } | null = null;
const HOME_CACHE_TTL = 10 * 60 * 1000;

async function getPreparedHomePageData(): Promise<HomePagePreparedData> {
  const now = Date.now();
  if (homePageMemoryCache && now - homePageMemoryCache.timestamp < HOME_CACHE_TTL) {
    return homePageMemoryCache.data;
  }

  // Fetch curated home sections
  const homeData = await movieProvider.getHomeMovies();

  // 1. Hero Carousel (Tuyển chọn siêu phẩm bom tấn chiếu rạp, phim HOT mới ra mắt nhiều người xem nhất)
  const currentYear = new Date().getFullYear();

  // Nguồn dữ liệu thuần túy từ danh sách Phim Chiếu Rạp và Phim Thịnh Hành (Hot) từ hệ thống API
  const allCandidates = [
    ...(homeData.singles || []), // Phim điện ảnh / chiếu rạp
    ...(homeData.hot || []), // Phim thịnh hành có lượt xem cao
    ...(homeData.featured || []), // Phim được hệ thống đề cử
  ];

  const uniqueCandidates = Array.from(
    new Map(allCandidates.map((m) => [m.id, { ...m }])).values()
  );

  // Lọc động 100%: Chỉ lấy phim phát hành mới nhất (năm hiện tại) và có ảnh nền backdrop chất lượng cao
  let validCandidates = uniqueCandidates.filter((m) => {
    const isCurrentYear = m.year === currentYear;
    const hasBackdrop = Boolean(m.backdropUrl) && m.backdropUrl.length > 10;
    return isCurrentYear && hasBackdrop;
  });

  // Nếu đầu năm số lượng phim năm hiện tại chưa đủ 8 phim, mở rộng động sang năm liền kề (currentYear - 1)
  if (validCandidates.length < 8) {
    const prevYearCandidates = uniqueCandidates.filter((m) => {
      const isRecent = m.year && m.year >= currentYear - 1;
      const hasBackdrop = Boolean(m.backdropUrl) && m.backdropUrl.length > 10;
      return isRecent && hasBackdrop;
    });
    validCandidates = prevYearCandidates;
  }

  // Thuật toán chấm điểm hoàn toàn dựa trên số liệu thực tế (Lượt xem, Đánh giá, Độ Hot, Phim Chiếu Rạp)
  const preliminaryRanked = [...validCandidates].sort((a, b) => {
    const isCinemaA = (homeData.singles || []).some((s) => s.id === a.id);
    const isCinemaB = (homeData.singles || []).some((s) => s.id === b.id);
    const isHotA = a.isHot || (homeData.hot || []).some((h) => h.id === a.id);
    const isHotB = b.isHot || (homeData.hot || []).some((h) => h.id === b.id);

    const yearScoreA = (a.year || 0) * 10;
    const yearScoreB = (b.year || 0) * 10;

    const viewsA = a.views || 0;
    const viewsB = b.views || 0;

    const ratingA = (a.rating || a.tmdbVoteAverage || 7.5) * 50;
    const ratingB = (b.rating || b.tmdbVoteAverage || 7.5) * 50;

    const scoreA =
      (isCinemaA ? 500 : 0) +
      (isHotA ? 300 : 0) +
      yearScoreA +
      ratingA +
      Math.min(500, Math.floor(viewsA / 100));

    const scoreB =
      (isCinemaB ? 500 : 0) +
      (isHotB ? 300 : 0) +
      yearScoreB +
      ratingB +
      Math.min(500, Math.floor(viewsB / 100));

    return scoreB - scoreA;
  });

  // Tự động nâng cấp sang ảnh gốc TMDB 4K / Original studio backdrop & transparent logo
  const topEnrichCandidates = preliminaryRanked.slice(0, 16);
  const hasTmdb = Boolean(TMDB_API_KEY);

  if (hasTmdb) {
    await Promise.all(
      topEnrichCandidates.map(async (m) => {
        const type = m.tmdbType || (m.type === "series" ? "tv" : "movie");
        const media = await getTmdbMedia(m.tmdbId, type, {
          title: m.title,
          originalTitle: m.originalTitle,
          year: m.year,
        });
        if (media.backdropUrl) {
          m.backdropUrl = media.backdropUrl;
        }
        if (media.posterUrl) {
          m.posterUrl = media.posterUrl;
        } else if (m.posterUrl && m.posterUrl.includes("phimimg.com") && m.posterUrl.includes("-thumb.")) {
          m.posterUrl = m.posterUrl.replace("-thumb.", "-poster.");
        }
        if (media.logoUrl) {
          m.logoUrl = media.logoUrl;
        }
      })
    );
  }

  // Chấm điểm chung kết hoàn toàn động:
  // Ưu tiên phim có backdrop 4K và poster dọc 4K từ TMDB (+1000) cùng điểm số thực tế
  const sortedHeroPool = [...topEnrichCandidates].sort((a, b) => {
    const isTmdbA =
      (a.backdropUrl.includes("image.tmdb.org") ? 500 : 0) +
      (a.posterUrl?.includes("image.tmdb.org") ? 500 : 0);
    const isTmdbB =
      (b.backdropUrl.includes("image.tmdb.org") ? 500 : 0) +
      (b.posterUrl?.includes("image.tmdb.org") ? 500 : 0);
    const isCinemaA = (homeData.singles || []).some((s) => s.id === a.id) ? 400 : 0;
    const isCinemaB = (homeData.singles || []).some((s) => s.id === b.id) ? 400 : 0;
    const isHotA = a.isHot || (homeData.hot || []).some((h) => h.id === a.id) ? 200 : 0;
    const isHotB = b.isHot || (homeData.hot || []).some((h) => h.id === b.id) ? 200 : 0;

    const viewsA = a.views || 0;
    const viewsB = b.views || 0;

    const ratingA = (a.rating || a.tmdbVoteAverage || 7.5) * 40;
    const ratingB = (b.rating || b.tmdbVoteAverage || 7.5) * 40;

    const scoreA =
      isTmdbA +
      isCinemaA +
      isHotA +
      (a.year === currentYear ? 400 : 100) +
      ratingA +
      Math.min(300, Math.floor(viewsA / 200));

    const scoreB =
      isTmdbB +
      isCinemaB +
      isHotB +
      (b.year === currentYear ? 400 : 100) +
      ratingB +
      Math.min(300, Math.floor(viewsB / 200));

    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }
    return String(a.id || a.slug).localeCompare(String(b.id || b.slug));
  });

  // Tuyển chọn 8 siêu phẩm chất lượng 4K nét nhất cho Panel chính
  const heroMovies = sortedHeroPool.slice(0, 8).map((m) => ({ ...m }));
  const heroIds = new Set(heroMovies.map((m) => m.id));

  // 2. Trending Now (10 hot movies)
  const trendingMovies = (homeData.hot || []).slice(0, 10);

  // 3. Phim Mới Cập Nhật (14+ distinct new updates)
  const latestMovies = (homeData.latest || []).slice(0, 16);

  // 4. Standout Editorial Spotlight: 5-6 curated high-res cinematic spotlight movies
  const candidateSpotlights = [
    ...(homeData.recommended || []),
    ...(homeData.singles || []),
    ...(homeData.hot || []),
    ...(homeData.series || []),
  ];

  const seenSpotlightIds = new Set<string>();
  const spotlightMovies: Movie[] = [];

  for (const m of candidateSpotlights) {
    if (heroIds.has(m.id)) continue;
    if (seenSpotlightIds.has(m.id)) continue;
    if (
      Boolean(m.backdropUrl) &&
      !m.backdropUrl.endsWith("-poster.webp") &&
      !m.backdropUrl.endsWith("poster.webp") &&
      m.backdropUrl.length > 10
    ) {
      seenSpotlightIds.add(m.id);
      spotlightMovies.push(m);
      if (spotlightMovies.length >= 6) break;
    }
  }

  if (spotlightMovies.length === 0 && homeData.featured?.[0]) {
    spotlightMovies.push(homeData.featured[0]);
  }

  // Enrich spotlightMovies with TMDB 4K backdrops and media
  if (hasTmdb) {
    await Promise.all(
      spotlightMovies.map(async (m) => {
        if (!m.backdropUrl.includes("image.tmdb.org")) {
          const type = m.tmdbType || (m.type === "series" ? "tv" : "movie");
          const media = await getTmdbMedia(m.tmdbId, type, {
            title: m.title,
            originalTitle: m.originalTitle,
            year: m.year,
          });
          if (media.backdropUrl) m.backdropUrl = media.backdropUrl;
          if (media.posterUrl) m.posterUrl = media.posterUrl;
          if (media.logoUrl) m.logoUrl = media.logoUrl;
        }
      })
    );
  }

  // 5. Phim Lẻ Chiếu Rạp (14-16 contemporary cinema blockbusters)
  const singleMovies = (homeData.singles || []).slice(0, 16);

  // 6. Phim Bộ Đặc Sắc (14-16 top series)
  const seriesMovies = (homeData.series || []).slice(0, 16);

  // 7. Anime & Hoạt Hình Tuyển Chọn (14-16 anime favorites)
  const animeMovies = (homeData.animation || []).slice(0, 16);

  // 8. Phim Hành Động Kịch Tính (14-16 genuine live-action blockbusters)
  const actionMovies = (homeData.action || []).slice(0, 16);

  const prepared: HomePagePreparedData = {
    heroMovies,
    trendingMovies,
    latestMovies,
    spotlightMovies,
    singleMovies,
    seriesMovies,
    animeMovies,
    actionMovies,
  };

  homePageMemoryCache = {
    data: prepared,
    timestamp: now,
  };

  // Non-blocking background pre-warming of top hero and trending movie details
  setTimeout(() => {
    const warmSlugs = Array.from(
      new Set([
        ...heroMovies.map((m) => m.slug),
        ...trendingMovies.slice(0, 8).map((m) => m.slug),
      ])
    ).filter(Boolean);

    warmSlugs.forEach((slug) => {
      movieProvider.getMovieBySlug(slug).catch(() => {});
    });
  }, 100);

  return prepared;
}

export default async function HomePage() {
  const {
    heroMovies,
    trendingMovies,
    latestMovies,
    spotlightMovies,
    singleMovies,
    seriesMovies,
    animeMovies,
    actionMovies,
  } = await getPreparedHomePageData();

  return (
    <main className="flex flex-col w-full pb-24 sm:pb-16 overflow-x-hidden min-h-screen bg-[#0F0F0F] relative">
      {/* Ambient Theatrical Background Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] bg-gradient-to-b from-[#E50000]/12 via-[#E50000]/4 to-transparent blur-[140px] pointer-events-none -z-0" />
      <div className="absolute top-[35%] right-0 w-[500px] h-[500px] bg-[#E50000]/5 blur-[160px] pointer-events-none -z-0" />
      <div className="absolute top-[65%] left-0 w-[500px] h-[500px] bg-[#E50000]/5 blur-[160px] pointer-events-none -z-0" />

      {/* 1. Large Cinematic Hero Carousel (Full First Viewport) */}
      <MovieHero movies={heroMovies} />

      {/* 2. Khám Phá Theo Chủ Đề (Mood & Emotion Discovery - Ngay dưới khung hình đầu tiên) */}
      <MoodDiscovery />

      {/* Auth Sync & Continuation CTA Banner */}
      <AuthSyncBanner />

      {/* 3. Continue Watching (Rendered only when user has watch history) */}
      <ContinueWatchingRow />

      {/* 4. Trending Now with Top 10 Ranking */}
      {trendingMovies.length > 0 && <TrendingSection movies={trendingMovies} title="Top 10 phim thịnh hành hôm nay" />}

      {/* 5. Phim Mới Cập Nhật */}
      {latestMovies.length > 0 && (
        <MovieRow
          id="latest"
          title="Phim Mới Cập Nhật"
          subtitle="Những tác phẩm vừa được cập nhật bản đẹp và thuyết minh mới nhất"
          movies={latestMovies}
          viewAllHref="/movies?sort=latest"
        />
      )}

      {/* 6. Phân Loại Phim Theo Năm Phát Hành (Year Discovery) */}
      <YearDiscovery />

      {/* 7. Editorial Spotlight: Panoramic artwork showcase (Auto-play Carousel) */}
      {spotlightMovies.length > 0 && <EditorialSpotlight movies={spotlightMovies} />}

      {/* 8. Phim Lẻ Chiếu Rạp */}
      {singleMovies.length > 0 && (
        <MovieRow
          title="Phim Lẻ Chiếu Rạp"
          subtitle="Trải nghiệm chất lượng rạp chiếu ngay tại gia đình bạn"
          movies={singleMovies}
          viewAllHref="/movies?type=single"
        />
      )}

      {/* 9. Phim Bộ Đặc Sắc */}
      {seriesMovies.length > 0 && (
        <MovieRow
          title="Phim Bộ Đặc Sắc"
          subtitle="Trọn bộ các series truyền hình đình đám và lôi cuốn nhất"
          movies={seriesMovies}
          viewAllHref="/movies?type=series"
        />
      )}

      {/* 10. Hoạt Hình & Anime */}
      {animeMovies.length > 0 && (
        <MovieRow
          title="Hoạt Hình & Anime Tuyển Chọn"
          subtitle="Thế giới hình họa sống động và giàu cảm xúc cho mọi lứa tuổi"
          movies={animeMovies}
          viewAllHref="/genre/hoat-hinh"
        />
      )}

      {/* 11. Phim Hành Động Kịch Tính */}
      {actionMovies.length > 0 && (
        <MovieRow
          title="Phim Hành Động Kịch Tính"
          subtitle="Những pha rượt đuổi nghẹt thở và chiến đấu đỉnh cao"
          movies={actionMovies}
          viewAllHref="/genre/hanh-dong"
        />
      )}

      {/* 13. Frequently Asked Questions (FAQ) */}
      <FaqSection />

      {/* 14. Free Streaming CTA Banner with Real Trending Movie Stack */}
      <StreamCta movies={trendingMovies} />
    </main>
  );
}
