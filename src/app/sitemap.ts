import { MetadataRoute } from "next";
import { movieProvider } from "@/lib/providers";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://rubyfilm.vn";

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/movies`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];

  try {
    const [genres, countries, latestMovies] = await Promise.all([
      movieProvider.getGenres().catch(() => []),
      movieProvider.getCountries().catch(() => []),
      movieProvider.getLatestMovies(60).catch(() => []),
    ]);

    const genreRoutes: MetadataRoute.Sitemap = genres.map((g) => ({
      url: `${baseUrl}/genre/${g.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    }));

    const countryRoutes: MetadataRoute.Sitemap = countries.map((c) => ({
      url: `${baseUrl}/country/${c.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    }));

    const movieRoutes: MetadataRoute.Sitemap = latestMovies.map((m) => ({
      url: `${baseUrl}/movie/${m.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    }));

    return [...staticRoutes, ...genreRoutes, ...countryRoutes, ...movieRoutes];
  } catch (error) {
    console.error("Error generating sitemap:", error);
    return staticRoutes;
  }
}
