import { notFound } from "next/navigation";
import { movieProvider } from "@/lib/providers";
import { MovieGrid } from "@/components/movie/movie-grid";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { Metadata } from "next";
import Link from "next/link";
import { Calendar, ChevronRight, Sparkles } from "lucide-react";

interface YearPageProps {
  params: Promise<{ year: string }>;
  searchParams: Promise<{
    page?: string;
  }>;
}

const POPULAR_YEARS = [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2015, 2010];

export async function generateMetadata({
  params,
}: YearPageProps): Promise<Metadata> {
  const { year: yearParam } = await params;
  const yearInt = parseInt(yearParam, 10);

  if (isNaN(yearInt) || yearInt < 1920 || yearInt > 2030) {
    return {
      title: "Phim Theo Năm - RubyFilm",
    };
  }

  const pageTitle = `Phim Năm ${yearInt} Hay Nhất - Tuyển Chọn Phim Mới Vietsub 4K | RubyFilm`;
  const pageDescription = `Tổng hợp các bộ phim ra mắt năm ${yearInt} hay nhất, phim chiếu rạp bom tấn và series truyền hình chất lượng 4K HDR hoàn toàn miễn phí tại RubyFilm.`;

  return {
    title: pageTitle,
    description: pageDescription,
    alternates: {
      canonical: `/year/${yearInt}`,
    },
    openGraph: {
      title: pageTitle,
      description: pageDescription,
      type: "website",
      url: `/year/${yearInt}`,
    },
  };
}

export const dynamic = "force-dynamic";

export default async function YearPage({
  params,
  searchParams,
}: YearPageProps) {
  const { year: yearParam } = await params;
  const resolvedSearchParams = await searchParams;
  const yearInt = parseInt(yearParam, 10);

  if (isNaN(yearInt) || yearInt < 1920 || yearInt > 2030) {
    notFound();
  }

  const currentPage = Math.max(1, parseInt(resolvedSearchParams.page || "1", 10));
  const limit = 24;

  const result = await movieProvider.getMovies({
    year: yearInt,
    page: currentPage,
    limit,
    sort: "latest",
  });

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-[#D1D5DB] pb-20 select-none">
      {/* Cinematic Ambient Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[350px] bg-gradient-to-b from-[#E50000]/10 via-transparent to-transparent blur-[120px] pointer-events-none -z-0" />

      {/* Hero Header Section */}
      <div className="relative z-10 border-b border-[#222222] bg-gradient-to-b from-[#141414] via-[#101010] to-[#0F0F0F] pt-20 sm:pt-24 pb-8 sm:pb-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb Navigation */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-[#8E8E93] mb-4">
            <Link href="/" className="hover:text-white transition-colors">
              Trang chủ
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-[#555]" />
            <Link href="/movies" className="hover:text-white transition-colors">
              Khám phá phim
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-[#555]" />
            <span className="text-[#FECF59] font-medium">Năm {yearInt}</span>
          </nav>

          {/* Heading */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E50000]/15 border border-[#E50000]/30 text-[#E50000] text-xs font-bold uppercase tracking-wider mb-2.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>Tuyển Tập Điện Ảnh {yearInt}</span>
                {yearInt === 2026 && (
                  <span className="flex items-center gap-1 bg-[#FECF59] text-black font-extrabold text-[10px] px-1.5 py-0.2 rounded-full">
                    <Sparkles className="w-2.5 h-2.5 fill-black" /> MỚI NHẤT
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
                Phim Phát Hành Năm {yearInt}
              </h1>
              <p className="mt-2 text-sm text-[#9CA3AF] max-w-2xl leading-relaxed">
                Khám phá tuyển tập các siêu phẩm điện ảnh chiếu rạp bom tấn và series truyền hình đình đám phát hành trong năm {yearInt}.
              </p>
            </div>

          </div>

          {/* Year Switcher Pills */}
          <div className="mt-7 pt-5 border-t border-[#222222]/80">
            <p className="text-[11px] font-bold text-[#888] uppercase tracking-wider mb-3">
              Chọn năm phát hành khác:
            </p>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              {POPULAR_YEARS.map((y) => {
                const isActive = y === yearInt;
                return (
                  <Link
                    key={y}
                    href={`/year/${y}`}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                      isActive
                        ? "bg-[#E50000] text-white shadow-lg shadow-[#E50000]/30 border border-[#FF3333]"
                        : "bg-[#181818] hover:bg-[#222222] border border-[#2A2A2A] text-[#D1D5DB] hover:text-white hover:border-[#444]"
                    }`}
                  >
                    Năm {y}
                  </Link>
                );
              })}
              <Link
                href="/movies"
                className="px-3 py-1.5 rounded-xl text-xs font-medium text-[#888] hover:text-[#FECF59] transition-colors shrink-0"
              >
                Bộ lọc nâng cao →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content: Movie Grid & Pagination */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {result.items && result.items.length > 0 ? (
          <>
            <MovieGrid movies={result.items} />

            {result.totalPages > 1 && (
              <div className="mt-12 flex justify-center">
                <Pagination
                  currentPage={currentPage}
                  totalPages={result.totalPages}
                  pageUrlPattern={`/year/${yearInt}?page=[PAGE]`}
                />
              </div>
            )}
          </>
        ) : (
          <EmptyState
            title={`Chưa có phim năm ${yearInt}`}
            description={`Hệ thống đang liên tục cập nhật thêm các tác phẩm phát hành năm ${yearInt}. Bạn có thể khám phá các năm khác hoặc dùng thanh tìm kiếm.`}
            actionText="Xem Phim Năm 2026 Mới Nhất"
            actionHref="/year/2026"
          />
        )}
      </div>
    </div>
  );
}
