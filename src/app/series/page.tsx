import { movieProvider } from "@/lib/providers";
import { MovieGrid } from "@/components/movie/movie-grid";
import { MovieFilterPanel } from "@/components/movie/movie-filter-panel";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Phim Bộ Đặc Sắc - Xem Trọn Bộ HD/4K Vietsub",
  description: "Tuyển chọn phim bộ truyền hình Hàn Quốc, Trung Quốc, Âu Mỹ, Anime Nhật Bản trọn bộ vietsub chất lượng cao tại RubyFilm.",
  alternates: {
    canonical: "/series",
  },
};

export const dynamic = "force-dynamic";

interface SeriesPageProps {
  searchParams: Promise<{
    page?: string;
    genre?: string;
    country?: string;
    year?: string;
    sort?: string;
    language?: string;
  }>;
}

export default async function SeriesPage({ searchParams }: SeriesPageProps) {
  const params = await searchParams;
  const currentPage = params.page ? parseInt(params.page, 10) : 1;
  const currentGenre = params.genre || undefined;
  const currentCountry = params.country || undefined;
  const currentLanguage = params.language || undefined;
  const currentYear = params.year ? parseInt(params.year, 10) : undefined;
  const currentSort = (params.sort as any) || undefined;

  const result = await movieProvider.getMovies({
    type: "series",
    genre: currentGenre,
    country: currentCountry,
    year: currentYear,
    language: currentLanguage,
    sort: currentSort,
    page: currentPage,
    limit: 24,
  });

  const createQueryString = (overrides: Record<string, string | number | undefined>) => {
    const current = {
      genre: currentGenre,
      country: currentCountry,
      year: currentYear?.toString(),
      language: currentLanguage,
      sort: currentSort,
      page: currentPage.toString(),
      ...overrides,
    };

    const qs = Object.entries(current)
      .filter(([_, v]) => v !== undefined && v !== "")
      .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
      .join("&");

    return qs ? `/series?${qs}` : "/series";
  };

  return (
    <div className="pt-20 sm:pt-24 pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
      {/* Page Title & Breadcrumb */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F9FAFB] tracking-[-0.02em]">
          Phim Bộ Tuyển Chọn
        </h1>
        <p className="text-xs sm:text-sm text-[#D1D5DB] font-normal leading-[1.6] mt-1">
          Trọn bộ các series truyền hình, anime và phim nhiều tập cập nhật nhanh nhất
        </p>
      </div>

      {/* Interactive Movie Filter Panel matching user screenshot */}
      <MovieFilterPanel
        basePath="/series"
        currentType="series"
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
          title="Không tìm thấy phim bộ phù hợp"
          description="Hiện tại danh mục phim bộ đang được cập nhật thêm. Vui lòng quay lại sau."
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
