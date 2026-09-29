export const DEFAULT_CDN_DOMAIN = "https://phimimg.com";
export const FALLBACK_POSTER = "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop&q=80";
export const FALLBACK_BACKDROP = "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1920&auto=format&fit=crop&q=80";

/**
 * Normalizes movie poster/backdrop URLs returned by the API
 */
export function getMovieImageUrl(
  pathOrUrl?: string | null,
  type: "poster" | "backdrop" = "poster",
  customCdn?: string
): string {
  if (!pathOrUrl || typeof pathOrUrl !== "string" || pathOrUrl.trim() === "") {
    return type === "backdrop" ? FALLBACK_BACKDROP : FALLBACK_POSTER;
  }

  const trimmed = pathOrUrl.trim();

  // Already a full URL
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  const baseCdn = (customCdn || DEFAULT_CDN_DOMAIN).replace(/\/+$/, "");
  const cleanPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `${baseCdn}${cleanPath}`;
}
