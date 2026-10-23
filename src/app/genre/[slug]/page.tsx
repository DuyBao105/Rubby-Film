import { notFound } from "next/navigation";
import { movieProvider } from "@/lib/providers";
import { MovieGrid } from "@/components/movie/movie-grid";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export const revalidate = 600;

interface GenrePageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    page?: string;
  }>;
}

const KNOWN_GENRES: Record<string, string> = {
  "hoat-hinh": "Hoạt Hình & Anime",
  "hanh-dong": "Hành Động",
  "tinh-cam": "Tình Cảm & Lãng Mạn",
  "vien-tuong": "Khoa Học Viễn Tưởng",
  "kinh-di": "Kinh Dị & Hồi Hộp",
  "co-trang": "Cổ Trang",
  "hai-huoc": "Hài Hước",
  "chinh-kich": "Chính Kịch",
  "tam-ly": "Tâm Lý",
  "hinh-su": "Hình Sự",
  "chien-tranh": "Chiến Tranh",
  "khoa-hoc": "Khoa Học",
  "hoc-duong": "Học Đường",
  "gia-dinh": "Gia Đình",
  "bi-an": "Bí Ẩn",
  "phieu-luu": "Phiêu Lưu",
  "vo-thuat": "Võ Thuật",
  "than-thoai": "Thần Thoại",
  "am-nhac": "Âm Nhạc",
  "the-thao": "Thể Thao",
  "tai-lieu": "Tài Liệu",
};

export async function generateMetadata({
  params,
}: GenrePageProps): Promise<Metadata> {
  const { slug } = await params;
  const genres = await movieProvider.getGenres();
  let genre = genres.find((g) => g.slug === slug);

  if (!genre && KNOWN_GENRES[slug]) {
    genre = {
      id: slug,
      name: KNOWN_GENRES[slug],
      slug,
      description: `Tổng hợp các bộ phim thuộc thể loại ${KNOWN_GENRES[slug]} đặc sắc nhất`,
    };
  }

  const genreName = genre?.name || slug;
  const pageTitle = `Phim ${genreName} Hay Nhất Tuyển Chọn - Vietsub 4K`;
  const pageDescription =
    genre?.description || `Xem ngay danh sách phim thể loại ${genreName} hay nhất, mới nhất với độ phân giải cao và phụ đề chuẩn trên RubyFilm.`;

  return {
    title: pageTitle,
    description: pageDescription,
    alternates: {
      canonical: `/genre/${slug}`,
    },
    openGraph: {
      title: pageTitle,
      description: pageDescription,
      url: `/genre/${slug}`,
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

export default async function GenrePage({ params, searchParams }: GenrePageProps) {
  const { slug } = await params;
  const search = await searchParams;
  const currentPage = search.page ? parseInt(search.page, 10) : 1;

  const genres = await movieProvider.getGenres();
  let genre = genres.find((g) => g.slug === slug);

  if (!genre) {
    if (KNOWN_GENRES[slug]) {
      genre = {
        id: slug,
        name: KNOWN_GENRES[slug],
        slug,
        description: `Tổng hợp các bộ phim thuộc thể loại ${KNOWN_GENRES[slug]} đặc sắc`,
      };
    } else {
      notFound();
    }
  }

  const result = await movieProvider.getMoviesByGenre(slug, {
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

    return qs ? `/genre/${slug}?${qs}` : `/genre/${slug}`;
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
          Thể loại
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-white font-medium">{genre.name}</span>
      </div>

      {/* Header */}
      <div className="mb-6 p-6 rounded-2xl bg-cinema-850/60 border border-cinema-700/60">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-6 rounded-full bg-brand inline-block" />
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Phim {genre.name}
          </h1>
        </div>
        {genre.description && (
          <p className="text-xs sm:text-sm text-cinema-300 max-w-2xl leading-relaxed">
            {genre.description}
          </p>
        )}
      </div>

      {/* Results */}
      {result.items.length > 0 ? (
        <MovieGrid movies={result.items} />
      ) : (
        <EmptyState
          title={`Không tìm thấy phim phù hợp trong thể loại ${genre.name}`}
          description="Hiện tại chưa có phim mới nào trong thể loại này. Mời bạn quay lại sau!"
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
