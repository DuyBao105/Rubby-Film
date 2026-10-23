import { Movie, MovieType, Genre, Country, MoviePagination } from "@/lib/models/movie";
import { Episode } from "@/lib/models/episode";
import { VideoSource } from "@/lib/models/videoSource";
import { getMovieImageUrl } from "@/lib/utils/image";
import { getBilingualTitles } from "@/lib/utils/title";
import { generateMovieSynopsis } from "@/lib/utils/synopsis";
import { encryptStreamUrl } from "@/lib/utils/streamSecurity";

function cleanHtmlText(text?: string | null): string {
  if (!text) return "";
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/(phimmoi|kkphim|ophim|nguonc|motchill|subnhanh|dongphym|bilutv|tvhay|ghienphim|phim1080)[\w\.\/]*/gi, "")
    .replace(/(xem phim|xem full|chúc các bạn xem phim vui vẻ).*?(tại|ở)\s+[\w\.\-]+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatBrandServerName(rawName: string, isEmbed = false, serverIndex = 0): string {
  const lower = (rawName || "").toLowerCase();

  if (lower.includes("thuyết minh") || lower.includes("thuyet minh") || lower.includes("lồng tiếng")) {
    return isEmbed ? "Máy chủ Ruby (Thuyết Minh Dự Phòng)" : "Máy chủ Ruby (Thuyết Minh VIP)";
  }

  if (isEmbed) {
    return serverIndex > 0 ? `Máy chủ Ruby #${serverIndex + 1} (Dự phòng)` : "Máy chủ Ruby (Dự phòng VIP)";
  }

  return serverIndex === 0 ? "Máy chủ Ruby #1 (4K Ultra)" : `Máy chủ Ruby #${serverIndex + 1} (Tốc độ cao)`;
}

export function mapKkphimVideoSource(
  serverData: any,
  serverName: string,
  serverIndex: number = 0
): VideoSource[] {
  const sources: VideoSource[] = [];

  // 1. Native M3U8 HLS stream
  if (serverData.link_m3u8) {
    sources.push({
      serverName: formatBrandServerName(serverName, false, serverIndex),
      label: `Máy chủ Ruby #${serverIndex + 1} (HLS 4K)`,
      url: encryptStreamUrl(serverData.link_m3u8),
      type: "hls",
    });
  }

  // 2. Embed player stream & fallback
  if (serverData.link_embed) {
    const rawEmbed = String(serverData.link_embed).trim();
    if (rawEmbed) {
      let isDuplicateOfM3u8 = false;
      if (rawEmbed.includes("player.phimapi.com") || rawEmbed.includes("phimapi.com")) {
        const match = rawEmbed.match(/url=([^&]+)/);
        if (match && match[1]) {
          const decoded = decodeURIComponent(match[1]);
          if (decoded === serverData.link_m3u8) {
            isDuplicateOfM3u8 = true;
          } else if (decoded.includes(".m3u8")) {
            sources.push({
              serverName: `Máy chủ Ruby #${serverIndex + 2} (HLS VIP)`,
              label: `Máy chủ Ruby #${serverIndex + 2} (HLS Backup)`,
              url: encryptStreamUrl(decoded),
              type: "hls",
            });
          }
        }
      }

      // Only add embed if it provides a distinct fallback stream
      if (!isDuplicateOfM3u8 && (!serverData.link_m3u8 || !rawEmbed.includes("player.phimapi.com"))) {
        sources.push({
          serverName: formatBrandServerName(serverName, true, serverIndex + 1),
          label: `Máy chủ Ruby #${serverIndex + 2} (Dự phòng VIP)`,
          url: encryptStreamUrl(rawEmbed),
          type: "embed",
        });
      }
    }
  }

  // Fallback if none
  if (sources.length === 0) {
    sources.push({
      serverName: "Máy chủ Ruby Demo",
      label: "HD (1080p)",
      url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
      type: "mp4",
    });
  }

  return sources;
}

export function mapKkphimEpisode(
  epItem: any,
  serverName: string,
  index: number,
  serverIndex: number = 0
): Episode {
  const epNum =
    typeof epItem.slug === "string" && epItem.slug.startsWith("tap-")
      ? parseInt(epItem.slug.replace("tap-", ""), 10) || index + 1
      : index + 1;

  const sources = mapKkphimVideoSource(epItem, serverName, serverIndex);

  const rawName = String(epItem.name || "").trim();
  const cleanName = rawName.replace(/vietsub/gi, "").replace(/[#_()]/g, "").trim();
  const isPureNumber = /^\d+$/.test(cleanName);
  const formattedName = isPureNumber
    ? `Tập ${parseInt(cleanName, 10)}`
    : cleanName
    ? cleanName.startsWith("Tập")
      ? cleanName
      : `Tập ${cleanName}`
    : `Tập ${epNum}`;

  return {
    id: epItem.slug || `ep-${index + 1}`,
    name: formattedName,
    slug: epItem.slug || `tap-${epNum}`,
    episodeNumber: epNum,
    seasonNumber: 1,
    duration: "Full HD",
    videoSources: sources,
  };
}

export function mapKkphimEpisodes(rawEpisodes: any[]): Episode[] {
  if (!Array.isArray(rawEpisodes) || rawEpisodes.length === 0) {
    return [];
  }

  // Merge or group episodes by episode slug
  const epMap = new Map<string, Episode>();

  rawEpisodes.forEach((serverGroup: any, groupIndex: number) => {
    const serverName = serverGroup.server_name || "VIP Fast";
    const serverDataList = Array.isArray(serverGroup.server_data) ? serverGroup.server_data : [];

    serverDataList.forEach((dataItem: any, idx: number) => {
      const slug = dataItem.slug || `tap-${idx + 1}`;
      const sources = mapKkphimVideoSource(dataItem, serverName, groupIndex);

      if (epMap.has(slug)) {
        const existing = epMap.get(slug)!;
        existing.videoSources.push(...sources);
      } else {
        const mapped = mapKkphimEpisode(dataItem, serverName, idx, groupIndex);
        epMap.set(slug, mapped);
      }
    });
  });

  return Array.from(epMap.values());
}

export function mapKkphimMovie(raw: any, cdnDomain?: string): Movie {
  if (!raw) {
    throw new Error("Invalid raw KKPhim movie object");
  }

  // Normalize categories / genres
  const rawCategories = Array.isArray(raw.category) ? raw.category : [];
  const genres = rawCategories.map((c: any) => c.name || "Khác");
  const genreSlugs = rawCategories.map((c: any) => c.slug || "khac");

  // Normalize country
  const rawCountries = Array.isArray(raw.country) ? raw.country : [];
  const primaryCountry = rawCountries[0] || { name: "Quốc tế", slug: "quoc-te" };

  // Normalize type
  const rawType = raw.type || "";
  const tmdbType: "movie" | "tv" | undefined =
    raw.tmdb?.type === "tv" ? "tv" : raw.tmdb?.type === "movie" ? "movie" : undefined;
  const isSeriesType =
    rawType === "series" ||
    rawType === "tvshows" ||
    tmdbType === "tv" ||
    (typeof raw.episode_total === "string" && !raw.episode_total.toLowerCase().includes("full") && parseInt(raw.episode_total, 10) > 1);
  const type: MovieType = isSeriesType ? "series" : "single";

  // If raw type is hoathinh (donghua, anime), ensure it's tagged with hoat-hinh genre
  if (rawType === "hoathinh") {
    if (!genreSlugs.includes("hoat-hinh")) {
      genreSlugs.push("hoat-hinh");
    }
    if (!genres.includes("Hoạt Hình")) {
      genres.push("Hoạt Hình");
    }
  }

  // Normalize rating
  let rating = 8.5;
  if (raw.tmdb?.vote_average && raw.tmdb.vote_average > 0) {
    rating = Math.min(10, Math.round(raw.tmdb.vote_average * 10) / 10);
  } else if (raw.imdb?.vote_average && raw.imdb.vote_average > 0) {
    rating = Math.min(10, Math.round(raw.imdb.vote_average * 10) / 10);
  }

  // Normalize image URLs (thumb_url is the vertical 2:3 card poster, poster_url is the wide 16:9 banner)
  const posterUrl = getMovieImageUrl(raw.thumb_url || raw.poster_url, "poster", cdnDomain);
  const backdropUrl = getMovieImageUrl(raw.poster_url || raw.thumb_url, "backdrop", cdnDomain);

  // Normalize cast and director
  const cast = Array.isArray(raw.actor) ? raw.actor.filter(Boolean) : [];
  const director = Array.isArray(raw.director) ? raw.director.filter(Boolean).join(", ") : raw.director || "";

  // Normalize total episodes
  const totalEpisodes = raw.episode_total ? parseInt(raw.episode_total, 10) || undefined : undefined;

  // Normalize bilingual titles (Vietnamese primary, English/original secondary)
  const { primaryTitle, secondaryTitle } = getBilingualTitles({
    name: raw.name,
    origin_name: raw.origin_name,
    slug: raw.slug,
  });

  return {
    id: raw._id || raw.slug || Math.random().toString(),
    slug: raw.slug || "",
    title: primaryTitle,
    originalTitle: secondaryTitle,
    description: generateMovieSynopsis({
      title: primaryTitle,
      description: cleanHtmlText(raw.content),
      genres,
      genreSlugs,
      year: typeof raw.year === "number" ? raw.year : parseInt(raw.year, 10) || new Date().getFullYear(),
      type,
    }),
    posterUrl,
    backdropUrl,
    year: typeof raw.year === "number" ? raw.year : parseInt(raw.year, 10) || new Date().getFullYear(),
    rating,
    duration: raw.time || (type === "series" ? "45 phút/tập" : "110 phút"),
    country: primaryCountry.name || "Quốc tế",
    countrySlug: primaryCountry.slug || "quoc-te",
    genres: genres.length > 0 ? genres : ["Điện ảnh"],
    genreSlugs: genreSlugs.length > 0 ? genreSlugs : ["dien-anh"],
    quality: raw.quality || "4K UHD",
    language:
      raw.lang && !raw.lang.toLowerCase().includes("vietsub")
        ? raw.lang
        : "Ruby VIP",
    type,
    rawType: raw.type || undefined,
    director: director || undefined,
    cast: cast.length > 0 ? cast : undefined,
    totalEpisodes,
    currentEpisode: raw.episode_current
      ? raw.episode_current.replace(/vietsub/gi, "").replace(/[()]/g, "").trim()
      : undefined,
    showtimes: typeof raw.showtimes === "string" && raw.showtimes.trim() ? raw.showtimes.trim() : undefined,
    notify: typeof raw.notify === "string" && raw.notify.trim() ? raw.notify.trim() : undefined,
    isHot: raw.chieurap === true || rating >= 8.5,
    isLatest: true,
    isRecommended: rating >= 8.0,
    views: (() => {
      let hash = 0;
      const key = raw.slug || raw._id || primaryTitle;
      for (let i = 0; i < key.length; i++) {
        hash = (hash * 31 + key.charCodeAt(i)) & 0xfffff;
      }
      const votes = (raw.imdb?.vote_count || 0) + (raw.tmdb?.vote_count || 0);
      return Math.max(12000, votes * 150 + (hash % 500000) + 75000);
    })(),
    tmdbId: raw.tmdb?.id || undefined,
    tmdbType: tmdbType || (type === "series" ? "tv" : "movie"),
    trailerUrl: typeof raw.trailer_url === "string" && raw.trailer_url.trim() ? raw.trailer_url.trim() : undefined,
    tmdbVoteAverage: raw.tmdb?.vote_average ? Math.round(Number(raw.tmdb.vote_average) * 10) / 10 : undefined,
    imdbVoteAverage: raw.imdb?.vote_average ? Math.round(Number(raw.imdb.vote_average) * 10) / 10 : undefined,
  };
}

export function mapKkphimPagination(rawPagination: any): MoviePagination {
  if (!rawPagination) {
    return {
      totalItems: 0,
      totalItemsPerPage: 24,
      currentPage: 1,
      totalPages: 1,
    };
  }

  return {
    totalItems: rawPagination.totalItems || 0,
    totalItemsPerPage: rawPagination.totalItemsPerPage || 24,
    currentPage: rawPagination.currentPage || 1,
    totalPages: rawPagination.totalPages || 1,
  };
}
