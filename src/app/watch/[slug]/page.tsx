import { notFound } from "next/navigation";
import { movieProvider } from "@/lib/providers";
import { WatchView } from "@/components/watch/watch-view";
import { Metadata } from "next";

export const revalidate = 1800;

interface WatchPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ episode?: string; ep?: string; season?: string; server?: string }>;
}

export async function generateMetadata({
  params,
  searchParams,
}: WatchPageProps): Promise<Metadata> {
  const { slug } = await params;
  const query = await searchParams;
  const movie = await movieProvider.getMovieBySlug(slug);

  if (!movie) {
    return {
      title: "Xem Phim - RubyFilm",
      robots: { index: false, follow: false },
    };
  }

  const epNum = query.episode || query.ep;
  const epTitle = epNum ? ` (Tập ${epNum})` : "";
  const pageTitle = `Xem Phim ${movie.title}${epTitle} - 4K Vietsub | RubyFilm`;
  const pageDescription = `Xem online phim ${movie.title}${epTitle} (${movie.originalTitle}) năm ${movie.year || ""}. Thể loại ${movie.genres?.join(", ") || "Phim hay"}, phụ đề / thuyết minh chuẩn, tốc độ cao không giật lag.`;

  return {
    title: pageTitle,
    description: pageDescription,
    alternates: {
      canonical: `/watch/${movie.slug}`,
    },
    openGraph: {
      title: pageTitle,
      description: pageDescription,
      url: `/watch/${movie.slug}`,
      siteName: "RubyFilm",
      type: "video.other",
      locale: "vi_VN",
      images: [
        movie.backdropUrl && {
          url: movie.backdropUrl,
          width: 1280,
          height: 720,
          alt: `${movie.title} Thumbnail`,
        },
        movie.posterUrl && {
          url: movie.posterUrl,
          width: 600,
          height: 900,
          alt: `${movie.title} Poster`,
        },
      ].filter(Boolean) as { url: string; width: number; height: number; alt: string }[],
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
      description: pageDescription,
      images: [movie.backdropUrl || movie.posterUrl].filter(Boolean),
    },
  };
}

export default async function WatchPage({ params }: WatchPageProps) {
  const { slug } = await params;
  const movie = await movieProvider.getMovieBySlug(slug);

  if (!movie) {
    notFound();
  }

  const related = await movieProvider.getRelatedMovies(slug);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: movie.title,
    description: movie.description || `Xem phim ${movie.title} online`,
    thumbnailUrl: [movie.backdropUrl, movie.posterUrl].filter(Boolean),
    uploadDate: movie.year ? `${movie.year}-01-01` : undefined,
    inLanguage: movie.language || "vi",
  };

  const safeJsonLdString = JSON.stringify(jsonLd).replace(/</g, "\\u003c");

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdString }}
      />
      <WatchView movie={movie} relatedMovies={related} />
    </>
  );
}
