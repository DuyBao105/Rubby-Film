import { notFound } from "next/navigation";
import { movieProvider } from "@/lib/providers";
import { MovieDetail } from "@/components/movie/movie-detail";
import { Metadata } from "next";

export const revalidate = 1800;

interface MovieDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: MovieDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const movie = await movieProvider.getMovieBySlug(slug);

  if (!movie) {
    return {
      title: "Không Tìm Thấy Phim - RubyFilm",
      robots: { index: false, follow: false },
    };
  }

  const movieYear = movie.year ? ` (${movie.year})` : "";
  const pageTitle = `${movie.title}${movieYear} - Xem Phim Online HD / 4K`;
  const pageDescription =
    movie.description && movie.description.length > 10
      ? movie.description.slice(0, 160)
      : `Xem phim ${movie.title}${movieYear} (${movie.originalTitle}) thể loại ${movie.genres?.join(", ") || "Điện ảnh"} với chất lượng 4K UHD, âm thanh sống động tại RubyFilm.`;

  const ogImages = [
    movie.backdropUrl && {
      url: movie.backdropUrl,
      width: 1280,
      height: 720,
      alt: `${movie.title} Backdrop`,
    },
    movie.posterUrl && {
      url: movie.posterUrl,
      width: 600,
      height: 900,
      alt: `${movie.title} Poster`,
    },
  ].filter(Boolean) as { url: string; width: number; height: number; alt: string }[];

  return {
    title: pageTitle,
    description: pageDescription,
    alternates: {
      canonical: `/movie/${movie.slug}`,
    },
    openGraph: {
      title: pageTitle,
      description: pageDescription,
      url: `/movie/${movie.slug}`,
      siteName: "RubyFilm",
      type: movie.type === "series" ? "video.tv_show" : "video.movie",
      locale: "vi_VN",
      images: ogImages,
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
      description: pageDescription,
      images: [movie.backdropUrl || movie.posterUrl].filter(Boolean),
    },
  };
}

export default async function MovieDetailPage({ params }: MovieDetailPageProps) {
  const { slug } = await params;
  const movie = await movieProvider.getMovieBySlug(slug);

  if (!movie) {
    notFound();
  }

  const related = await movieProvider.getRelatedMovies(slug);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": movie.type === "series" ? "TVSeries" : "Movie",
    name: movie.title,
    alternateName: movie.originalTitle || undefined,
    description: movie.description || undefined,
    image: [movie.posterUrl, movie.backdropUrl].filter(Boolean),
    dateCreated: movie.year ? `${movie.year}` : undefined,
    genre: movie.genres && movie.genres.length > 0 ? movie.genres : undefined,
    inLanguage: movie.language || "vi",
    ...(movie.rating && movie.rating > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: movie.rating,
            bestRating: 10,
            worstRating: 1,
            ratingCount: Math.max(1, Math.round((movie.views || 100) / 10)),
          },
        }
      : {}),
    ...(movie.country
      ? {
          countryOfOrigin: {
            "@type": "Country",
            name: movie.country,
          },
        }
      : {}),
  };

  const safeJsonLdString = JSON.stringify(jsonLd).replace(/</g, "\\u003c");

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdString }}
      />
      <MovieDetail movie={movie} relatedMovies={related} />
    </>
  );
}
