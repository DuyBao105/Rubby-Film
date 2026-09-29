import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://rubyfilm.vn";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/movies", "/movie/", "/watch/", "/genre/", "/country/"],
        disallow: [
          "/api/",
          "/profile",
          "/my-list",
          "/history",
          "/search",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
