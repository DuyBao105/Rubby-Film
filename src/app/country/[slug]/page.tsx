import { notFound } from "next/navigation";
import { movieProvider } from "@/lib/providers";
import { MovieGrid } from "@/components/movie/movie-grid";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export const revalidate = 600;

interface CountryPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    page?: string;
  }>;
}

export async function generateMetadata({
  params,
}: CountryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const countries = await movieProvider.getCountries();
  const country = countries.find((c) => c.slug === slug);

  if (!country) {
    return {
      title: "Quốc Gia Phim - RubyFilm",
      robots: { index: false, follow: false },
    };
  }

  const pageTitle = `Phim ${country.name} Hay Nhất Tuyển Chọn - Vietsub 4K`;
  const pageDescription = `Danh sách phim ${country.name} chọn lọc được yêu thích nhất với chất lượng cao 4K Ultra HD trên RubyFilm.`;

  return {
    title: pageTitle,
    description: pageDescription,
    alternates: {
      canonical: `/country/${country.slug}`,
    },
    openGraph: {
      title: pageTitle,
      description: pageDescription,
      url: `/country/${country.slug}`,
      siteName: "RubyFilm",
      locale: "vi_VN",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
      description: pageDescription,
    },
  };
}

export default async function CountryPage({
  params,
  searchParams,
}: CountryPageProps) {
  const { slug } = await params;
  const search = await searchParams;
  const currentPage = search.page ? parseInt(search.page, 10) : 1;

  const countries = await movieProvider.getCountries();
  const country = countries.find((c) => c.slug === slug);

  if (!country) {
    notFound();
  }

  const result = await movieProvider.getMoviesByCountry(slug, {
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

    return qs ? `/country/${slug}?${qs}` : `/country/${slug}`;
  };

  return (
    <div className="pt-20 sm:pt-24 pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-cinema-400 mb-4">
        <Link href="/" className="hover:text-white transition-colors">
          Trang chủ
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <Link href="/movies" className="hover:text-white transition-colors">
          Quốc gia
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-white font-medium">{country.name}</span>
      </div>

      {/* Header */}
      <div className="mb-6 p-6 rounded-2xl bg-cinema-850/60 border border-cinema-700/60">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-6 rounded-full bg-brand inline-block" />
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Phim {country.name}
          </h1>
        </div>
        <p className="text-xs sm:text-sm text-cinema-300">
          Tuyển chọn những kiệt tác điện ảnh và series xuất sắc nhất đến từ nền điện ảnh {country.name}.
        </p>
      </div>

      {/* Results */}
      {result.items.length > 0 ? (
        <MovieGrid movies={result.items} />
      ) : (
        <EmptyState
          title={`Chưa có phim từ ${country.name}`}
          description="Hiện tại danh mục này đang được bổ sung thêm. Mời bạn khám phá các bộ phim khác."
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
