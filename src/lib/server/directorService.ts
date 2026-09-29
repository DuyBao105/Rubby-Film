import { Movie } from "@/types/movie";
import { movieApiClient } from "./movieApiClient";
import { mapKkphimMovie } from "./kkphimAdapter";

export interface DirectorInfo {
  name: string;
  avatar?: string;
  movieCount: number;
  slug?: string;
}

export interface DirectorSearchResult {
  director: DirectorInfo;
  movies: Movie[];
}

import { TMDB_API_KEY } from "@/lib/server/tmdb";

// Comprehensive curated mapping of high-impact Vietnamese and International directors
const CURATED_DIRECTORS: Record<
  string,
  {
    name: string;
    avatar: string;
    slugs: string[];
  }
> = {
  "tran thanh": {
    name: "Trấn Thành",
    avatar: "https://image.tmdb.org/t/p/w300/1eQdE9wSj2G7u4T2q1k4.jpg",
    slugs: ["mai-2024", "nha-ba-nu", "bo-gia-2021"],
  },
  "trấn thành": {
    name: "Trấn Thành",
    avatar: "https://image.tmdb.org/t/p/w300/1eQdE9wSj2G7u4T2q1k4.jpg",
    slugs: ["mai-2024", "nha-ba-nu", "bo-gia-2021"],
  },
  "ly hai": {
    name: "Lý Hải",
    avatar: "https://image.tmdb.org/t/p/w300/qmPEmGwDEINEoiQywHuGR0dCz0A.jpg",
    slugs: [
      "lat-mat-7-mot-dieu-uoc",
      "lat-mat-6-tam-ve-dinh-menh",
      "lat-mat-48h",
      "lat-mat-4-nha-co-khach",
      "lat-mat-ba-chang-khuyet",
    ],
  },
  "lý hải": {
    name: "Lý Hải",
    avatar: "https://image.tmdb.org/t/p/w300/qmPEmGwDEINEoiQywHuGR0dCz0A.jpg",
    slugs: [
      "lat-mat-7-mot-dieu-uoc",
      "lat-mat-6-tam-ve-dinh-menh",
      "lat-mat-48h",
      "lat-mat-4-nha-co-khach",
      "lat-mat-ba-chang-khuyet",
    ],
  },
  "victor vu": {
    name: "Victor Vũ",
    avatar: "https://image.tmdb.org/t/p/w300/mFwU72d0R5Z8z9x2.jpg",
    slugs: [
      "nguoi-vo-cuoi-cung",
      "mat-biec",
      "toi-thay-hoa-vang-tren-co-xanh",
      "nguoi-bat-tu",
      "qua-tim-mau",
    ],
  },
  "victor vũ": {
    name: "Victor Vũ",
    avatar: "https://image.tmdb.org/t/p/w300/mFwU72d0R5Z8z9x2.jpg",
    slugs: [
      "nguoi-vo-cuoi-cung",
      "mat-biec",
      "toi-thay-hoa-vang-tren-co-xanh",
      "nguoi-bat-tu",
      "qua-tim-mau",
    ],
  },
  "christopher nolan": {
    name: "Christopher Nolan",
    avatar: "https://image.tmdb.org/t/p/w300/xuAIuYSmsUzKlUMBFGVZaWsY3DZ.jpg",
    slugs: [
      "oppenheimer",
      "ho-den-tu-than",
      "ke-danh-cap-giac-mo",
      "tenet",
      "ky-si-bong-dem",
      "ky-si-bong-dem-tro-lai",
      "batman-khoi-dau",
      "dunkirk",
      "ao-thuat-gia-dau-tri",
      "memento",
    ],
  },
  "james cameron": {
    name: "James Cameron",
    avatar: "https://image.tmdb.org/t/p/w300/2Hh4Jos62luf90CCglP5K32qaWO.jpg",
    slugs: [
      "avatar-dong-chay-cua-nuoc",
      "avatar",
      "titanic",
      "ke-huy-diet",
      "ke-huy-diet-2-ngay-phan-xet",
    ],
  },
  "chau tinh tri": {
    name: "Châu Tinh Trì (Stephen Chow)",
    avatar: "https://image.tmdb.org/t/p/w300/j5DWs54BGZfp92G43c9OyHPvkNG.jpg",
    slugs: [
      "tuyet-dinh-kungfu",
      "doi-bong-thieu-lam",
      "sieu-khuyen-cj7",
      "my-nhan-ngu",
      "tay-du-hang-ma-thien",
      "quoc-san-007",
      "than-an",
      "vua-hai-kich",
    ],
  },
  "châu tinh trì": {
    name: "Châu Tinh Trì (Stephen Chow)",
    avatar: "https://image.tmdb.org/t/p/w300/j5DWs54BGZfp92G43c9OyHPvkNG.jpg",
    slugs: [
      "tuyet-dinh-kungfu",
      "doi-bong-thieu-lam",
      "sieu-khuyen-cj7",
      "my-nhan-ngu",
      "tay-du-hang-ma-thien",
      "quoc-san-007",
      "than-an",
      "vua-hai-kich",
    ],
  },
  "makoto shinkai": {
    name: "Makoto Shinkai",
    avatar: "https://image.tmdb.org/t/p/w300/o724s0zW30VlV29kR.jpg",
    slugs: [
      "khoa-chat-cua-nao-suzume",
      "dua-con-cua-thoi-tiet",
      "ten-cau-la-gi",
      "khu-vuon-ngon-tu",
      "5-centimet-tren-giay",
    ],
  },
  "hayao miyazaki": {
    name: "Hayao Miyazaki",
    avatar: "https://image.tmdb.org/t/p/w300/eG45G5eM0a9w.jpg",
    slugs: [
      "thieu-nien-va-chim-diec",
      "vung-dat-linh-hon",
      "lau-dai-bay-cua-howl",
      "hang-xom-cua-toi-la-totoro",
      "cong-chua-mononoke",
    ],
  },
  "denis villeneuve": {
    name: "Denis Villeneuve",
    avatar: "https://image.tmdb.org/t/p/w300/zdAQ9w61F05W9i38zS7Q3q9M1sB.jpg",
    slugs: [
      "hanh-tinh-cat-phan-hai",
      "hanh-tinh-cat",
      "toi-pham-nhan-ban-2049",
      "cuoc-do-bo-bi-an",
      "ran-doc-sicario",
    ],
  },
  "quentin tarantino": {
    name: "Quentin Tarantino",
    avatar: "https://image.tmdb.org/t/p/w300/1gjVu985geL9iozDpDlR56tneCW.jpg",
    slugs: [
      "chuyen-ngay-xua-o-hollywood",
      "django-noi-loan",
      "dinh-thu-mau-jackie-brown",
    ],
  },
  "bong joon ho": {
    name: "Bong Joon-ho",
    avatar: "https://image.tmdb.org/t/p/w300/mFqf6d3f3fXq.jpg",
    slugs: ["ki-sinh-trung", "chuyen-tau-bang-gia", "quai-vat-song-han"],
  },
  "bong joon-ho": {
    name: "Bong Joon-ho",
    avatar: "https://image.tmdb.org/t/p/w300/mFqf6d3f3fXq.jpg",
    slugs: ["ki-sinh-trung", "chuyen-tau-bang-gia", "quai-vat-song-han"],
  },
};

export class DirectorService {
  /**
   * Search and get all movies directed by a specific director
   */
  async getMoviesByDirector(query: string): Promise<DirectorSearchResult | null> {
    const raw = (query || "").trim();
    if (!raw) return null;

    const normKey = raw
      .toLowerCase()
      .replace(/^(dao dien|đạo diễn)\s+/i, "")
      .trim();

    if (!normKey) return null;

    // 1. Check curated directory first (instant sub-millisecond response)
    const curated = CURATED_DIRECTORS[normKey];
    if (curated) {
      const cdnDomain = "https://phimimg.com";
      const movieFetches = curated.slugs.map(async (slug) => {
        try {
          const res = await movieApiClient.get<any>(`/phim/${encodeURIComponent(slug)}`, {
            revalidate: 3600,
          });
          if (res?.movie?._id) {
            return mapKkphimMovie(res.movie, cdnDomain);
          }
        } catch {
          // Ignore missing slug
        }
        return null;
      });

      const movies = (await Promise.all(movieFetches)).filter((m): m is Movie => m !== null);
      if (movies.length > 0) {
        return {
          director: {
            name: curated.name,
            avatar: curated.avatar,
            movieCount: movies.length,
          },
          movies,
        };
      }
    }

    // 2. Query TMDB Person API for any director globally if API key is configured
    if (!TMDB_API_KEY) return null;

    try {
      const searchUrl = `https://api.themoviedb.org/3/search/person?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(
        normKey
      )}`;
      const tmdbRes = await fetch(searchUrl, { next: { revalidate: 86400 } }).then((r) =>
        r.json()
      );

      const person = tmdbRes?.results?.[0];
      if (!person) return null;

      const creditsUrl = `https://api.themoviedb.org/3/person/${person.id}/movie_credits?api_key=${TMDB_API_KEY}`;
      const creditsRes = await fetch(creditsUrl, { next: { revalidate: 86400 } }).then((r) =>
        r.json()
      );

      const directedList = (creditsRes?.crew || [])
        .filter((c: any) => c.department === "Directing" && c.job === "Director")
        .sort((a: any, b: any) => (b.vote_count || 0) - (a.vote_count || 0))
        .slice(0, 12);

      if (directedList.length === 0) return null;

      // Match each directed movie in KKPhim
      const cdnDomain = "https://phimimg.com";
      const moviePromises = directedList.map(async (d: any) => {
        try {
          const qTitle = d.title || d.original_title;
          const searchRes = await movieApiClient.get<any>(
            `/v1/api/tim-kiem?keyword=${encodeURIComponent(qTitle)}&limit=2`,
            { revalidate: 3600 }
          );
          const items = searchRes?.data?.items || [];
          if (items.length > 0) {
            return mapKkphimMovie(items[0], cdnDomain);
          }
        } catch {
          // Ignore lookup errors
        }
        return null;
      });

      const matchedMovies = (await Promise.all(moviePromises)).filter(
        (m): m is Movie => m !== null
      );

      // Deduplicate by ID
      const seenIds = new Set<string>();
      const uniqueMovies: Movie[] = [];
      for (const m of matchedMovies) {
        if (!seenIds.has(m.id)) {
          seenIds.add(m.id);
          uniqueMovies.push(m);
        }
      }

      if (uniqueMovies.length > 0) {
        return {
          director: {
            name: person.name,
            avatar: person.profile_path
              ? `https://image.tmdb.org/t/p/w300${person.profile_path}`
              : undefined,
            movieCount: uniqueMovies.length,
          },
          movies: uniqueMovies,
        };
      }
    } catch (e) {
      console.error("DirectorService TMDB search error:", e);
    }

    return null;
  }
}

export const directorService = new DirectorService();
