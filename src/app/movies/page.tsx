import { movieProvider } from "@/lib/providers";
import { MovieGrid } from "@/components/movie/movie-grid";
import { MovieFilterPanel } from "@/components/movie/movie-filter-panel";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { MovieType } from "@/types/movie";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kho Phim Đặc Sắc - Xem Phim Hay Tuyển Chọn",
  description: "Khám phá hàng ngàn bộ phim điện ảnh bom tấn, phim bộ truyền hình, anime hot nhất với chất lượng 4K Ultra HD bản quyền tại RubyFilm.",
  alternates: {
    canonical: "/movies",
  },
  openGraph: {
    title: "Kho Phim Đặc Sắc - RubyFilm",
    description: "Khám phá hàng ngàn bộ phim điện ảnh bom tấn chất lượng 4K Ultra HD tại RubyFilm.",
    url: "/movies",
    siteName: "RubyFilm",
    locale: "vi_VN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kho Phim Đặc Sắc - RubyFilm",
    description: "Khám phá hàng ngàn bộ phim điện ảnh bom tấn chất lượng 4K Ultra HD tại RubyFilm.",
  },
};

export const dynamic = "force-dynamic";

interface MoviesPageProps {
  searchParams: Promise<{
    type?: string;
    page?: string;
    genre?: string;
    country?: string;
    year?: string;
    sort?: string;
    rating?: string;
    language?: string;
  }>;
}

export default async function MoviesPage({ searchParams }: MoviesPageProps) {
  const params = await searchParams;
  const currentType = (params.type as MovieType | "hoat-hinh") || undefined;
  const currentPage = params.page ? parseInt(params.page, 10) : 1;
  const currentGenre = params.genre || undefined;
  const currentCountry = params.country || undefined;
  const currentLanguage = params.language || undefined;
  const currentYear = params.year ? parseInt(params.year, 10) : undefined;
  const currentSort = (params.sort as any) || undefined;
  const currentRating = params.rating ? parseFloat(params.rating) : undefined;

  const result = await movieProvider.getMovies({
    type: currentType,
    genre: currentGenre,
    country: currentCountry,
    year: currentYear,
    language: currentLanguage,
    sort: currentSort,
    rating: currentRating,
    page: currentPage,
    limit: 24,
  });

  const createQueryString = (overrides: Record<string, string | number | undefined>) => {
    const current = {
      type: currentType,
      genre: currentGenre,
      country: currentCountry,
      year: currentYear?.toString(),
      language: currentLanguage,
      sort: currentSort,
      rating: currentRating?.toString(),
      page: currentPage.toString(),
      ...overrides,
    };

    const qs = Object.entries(current)
      .filter(([_, v]) => v !== undefined && v !== "")
      .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
      .join("&");

    return qs ? `/movies?${qs}` : "/movies";
  };

  // Determine Title based on active filter
  let pageTitle = "Kho Phim Tổng Hợp";
  let pageSubtitle = "Khám phá toàn bộ kho phim chiếu rạp và phim bộ chất lượng cao";

  if (currentRating && currentRating >= 8) {
    pageTitle = "Phim Đỉnh Cao (IMDb 8.0+)";
    pageSubtitle = "Những kiệt tác điện ảnh điểm số cao xuất sắc từ 8.0 trở lên";
  } else if (currentType === "single") {
    pageTitle = "Phim Lẻ Đặc Sắc";
    pageSubtitle = "Khám phá hàng ngàn tác phẩm điện ảnh chiếu rạp bom tấn chất lượng Full HD & 4K";
  } else if (currentType === "series") {
    pageTitle = "Phim Bộ Tuyển Chọn";
    pageSubtitle = "Trọn bộ các series truyền hình, anime và phim dài tập được yêu thích nhất";
  } else if (currentType === "hoat-hinh") {
    pageTitle = "Phim Hoạt Hình & Anime";
    pageSubtitle = "Kho phim hoạt hình anime Nhật Bản và quốc tế đặc sắc nhất";
  } else if (currentGenre) {
    pageTitle = `Phim Thể Loại: ${currentGenre.toUpperCase()}`;
    pageSubtitle = `Danh sách các tác phẩm chuẩn thể loại ${currentGenre}`;
  }

  return (
    <div className="pt-20 sm:pt-24 pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
      {/* Page Title & Breadcrumb */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F9FAFB] tracking-[-0.02em]">
          {pageTitle}
        </h1>
        <p className="text-xs sm:text-sm text-[#D1D5DB] font-normal leading-[1.6] mt-1">
          {pageSubtitle}
        </p>
      </div>

      {/* Interactive Movie Filter Panel matching user screenshot */}
      <MovieFilterPanel
        basePath="/movies"
        currentType={currentType}
        currentGenre={currentGenre}
        currentCountry={currentCountry}
        currentLanguage={currentLanguage}
        currentYear={currentYear}
        currentSort={currentSort}
      />

      {/* Grid or Empty */}
      {result.items.length > 0 ? (
        <MovieGrid movies={result.items} />
      ) : (
        <EmptyState
          title="Không tìm thấy phim phù hợp"
          description="Hiện tại chưa có nội dung nào trong mục này. Mời bạn quay lại sau!"
          actionText="Xem Tất Cả Phim"
          actionHref="/movies"
        />
      )}

      {/* Pagination */}
      {result.totalPages > 1 && (
        <div className="mt-12">
          <Pagination
            currentPage={currentPage}
            totalPages={result.totalPages}
            pageUrlPattern={createQueryString({ page: "[PAGE]" })}
          />
        </div>
      )}
    </div>
  );
}
