import { movieProvider } from "@/lib/providers";
import { MovieGrid } from "@/components/movie/movie-grid";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Phim Mới Cập Nhật - Xem Phim Mới Nhất",
  description: "Cập nhật liên tục các tập phim và tác phẩm điện ảnh mới ra mắt với bản đẹp Full HD, 4K Vietsub tại RubyFilm.",
  alternates: {
    canonical: "/latest",
  },
};

export const revalidate = 180;

interface LatestPageProps {
  searchParams: Promise<{
    page?: string;
  }>;
}

export default async function LatestPage({ searchParams }: LatestPageProps) {
  const params = await searchParams;
  const currentPage = params.page ? parseInt(params.page, 10) : 1;

  const result = await movieProvider.getMovies({
    sort: "latest",
    page: currentPage,
    limit: 24,
  });

  const createQueryString = (overrides: Record<string, string | number | undefined>) => {
    const current = {
      page: currentPage.toString(),
      ...overrides,
    };

    const qs = Object.entries(current)
      .filter(([_, v]) => v !== undefined && v !== "")
      .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
      .join("&");

    return qs ? `/latest?${qs}` : "/latest";
  };

  return (
    <div className="pt-20 sm:pt-24 pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
      {/* Page Title & Breadcrumb */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Phim Mới Cập Nhật
        </h1>
        <p className="text-xs sm:text-sm text-cinema-400 mt-1">
          Những tập phim và bản phát hành mới nhất vừa được đưa lên hệ thống
        </p>
      </div>

      {/* Grid or Empty */}
      {result.items.length > 0 ? (
        <MovieGrid movies={result.items} />
      ) : (
        <EmptyState
          title="Không tìm thấy phim mới phù hợp"
          description="Hiện tại chưa có bản cập nhật mới nào. Mời bạn quay lại sau!"
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
