import { movieProvider } from "@/lib/providers";
import { MovieGrid } from "@/components/movie/movie-grid";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Phim Thịnh Hành - Top Phim Xem Nhiều Nhất",
  description: "Khám phá bảng xếp hạng các bộ phim đang được xem nhiều nhất và nhận được đánh giá cao nhất trên RubyFilm.",
  alternates: {
    canonical: "/trending",
  },
};

export const revalidate = 300;

import { MovieFilterPanel } from "@/components/movie/movie-filter-panel";

interface TrendingPageProps {
  searchParams: Promise<{
    page?: string;
    type?: string;
    genre?: string;
    country?: string;
    year?: string;
    sort?: string;
    language?: string;
  }>;
}

export default async function TrendingPage({ searchParams }: TrendingPageProps) {
  const params = await searchParams;
  const currentPage = params.page ? parseInt(params.page, 10) : 1;
  const currentType = (params.type as any) || undefined;
  const currentGenre = params.genre || undefined;
  const currentCountry = params.country || undefined;
  const currentLanguage = params.language || undefined;
  const currentYear = params.year ? parseInt(params.year, 10) : undefined;
  const currentSort = (params.sort as any) || "views";

  const result = await movieProvider.getMovies({
    type: currentType,
    sort: currentSort,
    genre: currentGenre,
    country: currentCountry,
    year: currentYear,
    language: currentLanguage,
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
      sort: currentSort !== "views" ? currentSort : undefined,
      page: currentPage.toString(),
      ...overrides,
    };

    const qs = Object.entries(current)
      .filter(([_, v]) => v !== undefined && v !== "")
      .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
      .join("&");

    return qs ? `/trending?${qs}` : "/trending";
  };

  return (
    <div className="pt-20 sm:pt-24 pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
      {/* Page Title & Breadcrumb */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F9FAFB] tracking-[-0.02em]">
          Phim Thịnh Hành
        </h1>
        <p className="text-xs sm:text-sm text-[#D1D5DB] font-normal leading-[1.6] mt-1">
          Bảng xếp hạng các tác phẩm điện ảnh và truyền hình có lượt xem cao nhất hiện nay
        </p>
      </div>

      {/* Interactive Movie Filter Panel matching user screenshot */}
      <MovieFilterPanel
        basePath="/trending"
        defaultSort="views"
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
          title="Không tìm thấy phim thịnh hành"
          description="Hiện tại bảng xếp hạng đang được làm mới. Vui lòng quay lại sau."
          actionText="Xem Kho Phim"
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
