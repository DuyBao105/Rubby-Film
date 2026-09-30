import { Movie } from "@/types/movie";
import { movieApiClient } from "./movieApiClient";
import { mapKkphimMovie } from "./kkphimAdapter";

export interface PersonInfo {
  name: string;
  avatar?: string;
  role: "actor" | "director" | "all";
  roleTitle: string; // "Diễn Viên" | "Đạo Diễn"
  movieCount: number;
}

export interface PersonSearchResult {
  person: PersonInfo;
  movies: Movie[];
}

import { TMDB_API_KEY } from "@/lib/server/tmdb";

// Comprehensive curated mapping of high-impact Vietnamese, Asian, and International Actors & Directors
const CURATED_PEOPLE: Record<
  string,
  {
    name: string;
    avatar: string;
    role: "actor" | "director";
    roleTitle: string;
    slugs: string[];
    tmdbQuery?: string;
  }
> = {
  // --- VIETNAMESE ACTORS & CELEBRITIES ---
  "phuong anh dao": {
    name: "Phương Anh Đào",
    avatar: "https://image.tmdb.org/t/p/w300/fQB9fzInrYp2PMkcu9Wcx5GLmYG.jpg",
    role: "actor",
    roleTitle: "Diễn Viên",
    slugs: ["mai-2024", "tro-tan-ruc-ro", "chang-vo-cua-em", "vo-dien-sat-nhan"],
  },
  "phương anh đào": {
    name: "Phương Anh Đào",
    avatar: "https://image.tmdb.org/t/p/w300/fQB9fzInrYp2PMkcu9Wcx5GLmYG.jpg",
    role: "actor",
    roleTitle: "Diễn Viên",
    slugs: ["mai-2024", "tro-tan-ruc-ro", "chang-vo-cua-em", "vo-dien-sat-nhan"],
  },
  "tuan tran": {
    name: "Tuấn Trần",
    avatar: "https://image.tmdb.org/t/p/w300/vGvFv9c8B2f8V2R8c9Z8.jpg",
    role: "actor",
    roleTitle: "Diễn Viên",
    slugs: ["mai-2024", "bo-gia-2021", "mong-vuot", "dat-rung-phuong-nam"],
  },
  "tuấn trần": {
    name: "Tuấn Trần",
    avatar: "https://image.tmdb.org/t/p/w300/vGvFv9c8B2f8V2R8c9Z8.jpg",
    role: "actor",
    roleTitle: "Diễn Viên",
    slugs: ["mai-2024", "bo-gia-2021", "mong-vuot", "dat-rung-phuong-nam"],
  },
  "thai hoa": {
    name: "Thái Hòa",
    avatar: "https://image.tmdb.org/t/p/w300/8tH8V7V2b9c8V8.jpg",
    role: "actor",
    roleTitle: "Diễn Viên",
    slugs: ["tiec-trang-mau", "de-mai-tinh", "con-nhot-mot-chong", "cay-tao-no-hoa"],
  },
  "thái hòa": {
    name: "Thái Hòa",
    avatar: "https://image.tmdb.org/t/p/w300/8tH8V7V2b9c8V8.jpg",
    role: "actor",
    roleTitle: "Diễn Viên",
    slugs: ["tiec-trang-mau", "de-mai-tinh", "con-nhot-mot-chong", "cay-tao-no-hoa"],
  },
  "ninh duong lan ngoc": {
    name: "Ninh Dương Lan Ngọc",
    avatar: "https://image.tmdb.org/t/p/w300/nZ4N9c8V2f8V2R8c9Z8.jpg",
    role: "actor",
    roleTitle: "Diễn Viên",
    slugs: ["co-gai-tu-qua-khu", "gai-gia-lam-chieu-3", "gai-gia-lam-chieu-v", "cua-lai-vo-bau"],
  },
  "ninh dương lan ngọc": {
    name: "Ninh Dương Lan Ngọc",
    avatar: "https://image.tmdb.org/t/p/w300/nZ4N9c8V2f8V2R8c9Z8.jpg",
    role: "actor",
    roleTitle: "Diễn Viên",
    slugs: ["co-gai-tu-qua-khu", "gai-gia-lam-chieu-3", "gai-gia-lam-chieu-v", "cua-lai-vo-bau"],
  },
  "kaity nguyen": {
    name: "Kaity Nguyễn",
    avatar: "https://image.tmdb.org/t/p/w300/kZ4N9c8V2f8V2R8c9Z8.jpg",
    role: "actor",
    roleTitle: "Diễn Viên",
    slugs: ["em-chua-18", "tiec-trang-mau", "co-gai-tu-qua-khu", "nguoi-vo-cuoi-cung"],
  },
  "kaity nguyễn": {
    name: "Kaity Nguyễn",
    avatar: "https://image.tmdb.org/t/p/w300/kZ4N9c8V2f8V2R8c9Z8.jpg",
    role: "actor",
    roleTitle: "Diễn Viên",
    slugs: ["em-chua-18", "tiec-trang-mau", "co-gai-tu-qua-khu", "nguoi-vo-cuoi-cung"],
  },
  "kieu minh tuan": {
    name: "Kiều Minh Tuấn",
    avatar: "https://image.tmdb.org/t/p/w300/mZ4N9c8V2f8V2R8c9Z8.jpg",
    role: "actor",
    roleTitle: "Diễn Viên",
    slugs: ["em-chua-18", "tiec-trang-mau", "nghe-sieu-de", "ke-an-hon"],
  },
  "kiều minh tuấn": {
    name: "Kiều Minh Tuấn",
    avatar: "https://image.tmdb.org/t/p/w300/mZ4N9c8V2f8V2R8c9Z8.jpg",
    role: "actor",
    roleTitle: "Diễn Viên",
    slugs: ["em-chua-18", "tiec-trang-mau", "nghe-sieu-de", "ke-an-hon"],
  },
  "uyen an": {
    name: "Uyển Ân",
    avatar: "https://image.tmdb.org/t/p/w300/uZ4N9c8V2f8V2R8c9Z8.jpg",
    role: "actor",
    roleTitle: "Diễn Viên",
    slugs: ["mai-2024", "nha-ba-nu", "cai-gia-cua-hanh-phuc"],
  },
  "uyển ân": {
    name: "Uyển Ân",
    avatar: "https://image.tmdb.org/t/p/w300/uZ4N9c8V2f8V2R8c9Z8.jpg",
    role: "actor",
    roleTitle: "Diễn Viên",
    slugs: ["mai-2024", "nha-ba-nu", "cai-gia-cua-hanh-phuc"],
  },
  "hong dao": {
    name: "Hồng Đào",
    avatar: "https://image.tmdb.org/t/p/w300/hZ4N9c8V2f8V2R8c9Z8.jpg",
    role: "actor",
    roleTitle: "Diễn Viên",
    slugs: ["mai-2024", "thua-me-con-di"],
  },
  "hồng đào": {
    name: "Hồng Đào",
    avatar: "https://image.tmdb.org/t/p/w300/hZ4N9c8V2f8V2R8c9Z8.jpg",
    role: "actor",
    roleTitle: "Diễn Viên",
    slugs: ["mai-2024", "thua-me-con-di"],
  },

  // --- VIETNAMESE DIRECTORS ---
  "tran thanh": {
    name: "Trấn Thành",
    avatar: "https://image.tmdb.org/t/p/w300/1eQdE9wSj2G7u4T2q1k4.jpg",
    role: "director",
    roleTitle: "Đạo Diễn & Diễn Viên",
    slugs: ["mai-2024", "nha-ba-nu", "bo-gia-2021"],
  },
  "trấn thành": {
    name: "Trấn Thành",
    avatar: "https://image.tmdb.org/t/p/w300/1eQdE9wSj2G7u4T2q1k4.jpg",
    role: "director",
    roleTitle: "Đạo Diễn & Diễn Viên",
    slugs: ["mai-2024", "nha-ba-nu", "bo-gia-2021"],
  },
  "ly hai": {
    name: "Lý Hải",
    avatar: "https://image.tmdb.org/t/p/w300/qmPEmGwDEINEoiQywHuGR0dCz0A.jpg",
    role: "director",
    roleTitle: "Đạo Diễn",
    slugs: ["lat-mat-6-tam-ve-dinh-menh", "lat-mat-4-nha-co-khach"],
  },
  "lý hải": {
    name: "Lý Hải",
    avatar: "https://image.tmdb.org/t/p/w300/qmPEmGwDEINEoiQywHuGR0dCz0A.jpg",
    role: "director",
    roleTitle: "Đạo Diễn",
    slugs: ["lat-mat-6-tam-ve-dinh-menh", "lat-mat-4-nha-co-khach"],
  },
  "victor vu": {
    name: "Victor Vũ",
    avatar: "https://image.tmdb.org/t/p/w300/mFwU72d0R5Z8z9x2.jpg",
    role: "director",
    roleTitle: "Đạo Diễn",
    slugs: ["nguoi-vo-cuoi-cung", "mat-biec", "toi-thay-hoa-vang-tren-co-xanh", "nguoi-bat-tu"],
  },
  "victor vũ": {
    name: "Victor Vũ",
    avatar: "https://image.tmdb.org/t/p/w300/mFwU72d0R5Z8z9x2.jpg",
    role: "director",
    roleTitle: "Đạo Diễn",
    slugs: ["nguoi-vo-cuoi-cung", "mat-biec", "toi-thay-hoa-vang-tren-co-xanh", "nguoi-bat-tu"],
  },

  // --- ASIAN SUPERSTARS (with Vietnamese & English names) ---
  "thanh long": {
    name: "Thành Long (Jackie Chan)",
    avatar: "https://image.tmdb.org/t/p/w300/nrazenTD5hXNx66hoTe0uI17z0y.jpg",
    role: "actor",
    roleTitle: "Diễn Viên Võ Thuật",
    slugs: ["gio-cao-diem", "ke-ngoai-toc", "12-con-giap", "cau-be-karate"],
    tmdbQuery: "Jackie Chan",
  },
  "thành long": {
    name: "Thành Long (Jackie Chan)",
    avatar: "https://image.tmdb.org/t/p/w300/nrazenTD5hXNx66hoTe0uI17z0y.jpg",
    role: "actor",
    roleTitle: "Diễn Viên Võ Thuật",
    slugs: ["gio-cao-diem", "ke-ngoai-toc", "12-con-giap", "cau-be-karate"],
    tmdbQuery: "Jackie Chan",
  },
  "jackie chan": {
    name: "Thành Long (Jackie Chan)",
    avatar: "https://image.tmdb.org/t/p/w300/nrazenTD5hXNx66hoTe0uI17z0y.jpg",
    role: "actor",
    roleTitle: "Diễn Viên Võ Thuật",
    slugs: ["gio-cao-diem", "ke-ngoai-toc", "12-con-giap", "cau-be-karate"],
    tmdbQuery: "Jackie Chan",
  },
  "chau tinh tri": {
    name: "Châu Tinh Trì (Stephen Chow)",
    avatar: "https://image.tmdb.org/t/p/w300/j5DWs54BGZfp92G43c9OyHPvkNG.jpg",
    role: "actor",
    roleTitle: "Đạo Diễn & Diễn Viên",
    slugs: ["tuyet-dinh-kungfu", "doi-bong-thieu-lam", "sieu-khuyen-cj7", "my-nhan-ngu", "quoc-san-007", "than-an", "vua-hai-kich"],
  },
  "châu tinh trì": {
    name: "Châu Tinh Trì (Stephen Chow)",
    avatar: "https://image.tmdb.org/t/p/w300/j5DWs54BGZfp92G43c9OyHPvkNG.jpg",
    role: "actor",
    roleTitle: "Đạo Diễn & Diễn Viên",
    slugs: ["tuyet-dinh-kungfu", "doi-bong-thieu-lam", "sieu-khuyen-cj7", "my-nhan-ngu", "quoc-san-007", "than-an", "vua-hai-kich"],
  },
  "chan tu dan": {
    name: "Chân Tử Đan (Donnie Yen)",
    avatar: "https://image.tmdb.org/t/p/w300/hTlhrrTllm23f9v2b59.jpg",
    role: "actor",
    roleTitle: "Diễn Viên Võ Thuật",
    slugs: ["diep-van-4-hoi-ket", "diep-van-3", "diep-van-2", "diep-van", "sat-pha-lang"],
    tmdbQuery: "Donnie Yen",
  },
  "chân tử đan": {
    name: "Chân Tử Đan (Donnie Yen)",
    avatar: "https://image.tmdb.org/t/p/w300/hTlhrrTllm23f9v2b59.jpg",
    role: "actor",
    roleTitle: "Diễn Viên Võ Thuật",
    slugs: ["diep-van-4-hoi-ket", "diep-van-3", "diep-van-2", "diep-van", "sat-pha-lang"],
    tmdbQuery: "Donnie Yen",
  },
  "song joong ki": {
    name: "Song Joong-ki",
    avatar: "https://image.tmdb.org/t/p/w300/uU8eJ0c6Z8.jpg",
    role: "actor",
    roleTitle: "Diễn Viên",
    slugs: ["cau-ut-nha-tai-phiet", "hau-due-mat-troi", "vincenzo", "con-tau-chien-thang"],
  },
  "hyun bin": {
    name: "Hyun Bin",
    avatar: "https://image.tmdb.org/t/p/w300/z6c9R6R9.jpg",
    role: "actor",
    roleTitle: "Diễn Viên",
    slugs: ["ha-canh-noi-anh", "dac-vu-xuyen-quoc-gia"],
  },

  // --- HOLLYWOOD STARS ---
  "tom cruise": {
    name: "Tom Cruise",
    avatar: "https://image.tmdb.org/t/p/w300/maf8PhSvDCdEwjEMbYfGpojR5RP.jpg",
    role: "actor",
    roleTitle: "Siêu Sao Điện Ảnh",
    slugs: ["phi-cong-sieu-dang-maverick", "nhiem-vu-bat-kha-thi-nghiep-bao-phan-1", "cuoc-chien-luan-hoi", "lang-quen"],
    tmdbQuery: "Tom Cruise",
  },
  "keanu reeves": {
    name: "Keanu Reeves",
    avatar: "https://image.tmdb.org/t/p/w300/8RZLOyYGsoRe9p44q3xin9QkMHv.jpg",
    role: "actor",
    roleTitle: "Diễn Viên",
    slugs: ["sat-thu-john-wick-phan-4", "sat-thu-john-wick-phan-3", "sat-thu-john-wick", "ma-tran"],
    tmdbQuery: "Keanu Reeves",
  },
  "leonardo dicaprio": {
    name: "Leonardo DiCaprio",
    avatar: "https://image.tmdb.org/t/p/w300/wo2hxAz0nF29w9J0V0R0.jpg",
    role: "actor",
    roleTitle: "Diễn Viên Đoạt Giải Oscar",
    slugs: ["titanic", "ke-danh-cap-giac-mo", "soi-gia-pho-wall", "dao-kinh-hoang"],
    tmdbQuery: "Leonardo DiCaprio",
  },
  "cillian murphy": {
    name: "Cillian Murphy",
    avatar: "https://image.tmdb.org/t/p/w300/i9YFh9iUuN3YvjV9L8Y8.jpg",
    role: "actor",
    roleTitle: "Diễn Viên Đoạt Giải Oscar",
    slugs: ["oppenheimer", "bong-ma-anh-quoc", "ke-danh-cap-giac-mo"],
    tmdbQuery: "Cillian Murphy",
  },
  "zendaya": {
    name: "Zendaya",
    avatar: "https://image.tmdb.org/t/p/w300/r3A7PwewT9E.jpg",
    role: "actor",
    roleTitle: "Diễn Viên",
    slugs: ["hanh-tinh-cat-phan-hai", "hanh-tinh-cat", "nguoi-nhen-khong-con-nha"],
    tmdbQuery: "Zendaya",
  },
  "timothee chalamet": {
    name: "Timothée Chalamet",
    avatar: "https://image.tmdb.org/t/p/w300/BE2Abx517Tf.jpg",
    role: "actor",
    roleTitle: "Diễn Viên",
    slugs: ["hanh-tinh-cat-phan-hai", "hanh-tinh-cat", "wonka"],
    tmdbQuery: "Timothee Chalamet",
  },

  // --- INTERNATIONAL DIRECTORS ---
  "christopher nolan": {
    name: "Christopher Nolan",
    avatar: "https://image.tmdb.org/t/p/w300/xuAIuYSmsUzKlUMBFGVZaWsY3DZ.jpg",
    role: "director",
    roleTitle: "Đạo Diễn Huyền Thoại",
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
    role: "director",
    roleTitle: "Đạo Diễn Bạc Tỷ",
    slugs: [
      "avatar-dong-chay-cua-nuoc",
      "avatar",
      "titanic",
      "ke-huy-diet",
      "ke-huy-diet-2-ngay-phan-xet",
    ],
  },
  "makoto shinkai": {
    name: "Makoto Shinkai",
    avatar: "https://image.tmdb.org/t/p/w300/o724s0zW30VlV29kR.jpg",
    role: "director",
    roleTitle: "Đạo Diễn Anime",
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
    role: "director",
    roleTitle: "Huyền Thoại Ghibli",
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
    role: "director",
    roleTitle: "Đạo Diễn Điện Ảnh",
    slugs: [
      "hanh-tinh-cat-phan-hai",
      "hanh-tinh-cat",
      "toi-pham-nhan-ban-2049",
      "cuoc-do-bo-bi-an",
      "ran-doc-sicario",
    ],
  },
  // --- ADDITIONAL ASIAN & INTERNATIONAL STARS ---
  "trieu le dinh": {
    name: "Triệu Lệ Dĩnh",
    avatar: "https://image.tmdb.org/t/p/w300/zhaoLiying.jpg",
    role: "actor",
    roleTitle: "Diễn Viên",
    slugs: ["so-kieu-truyen", "minh-lan-truyen"],
    tmdbQuery: "Zhao Liying",
  },
  "triệu lệ dĩnh": {
    name: "Triệu Lệ Dĩnh",
    avatar: "https://image.tmdb.org/t/p/w300/zhaoLiying.jpg",
    role: "actor",
    roleTitle: "Diễn Viên",
    slugs: ["so-kieu-truyen", "minh-lan-truyen"],
    tmdbQuery: "Zhao Liying",
  },
  "duong mich": {
    name: "Dương Mịch",
    avatar: "https://image.tmdb.org/t/p/w300/yangMi.jpg",
    role: "actor",
    roleTitle: "Diễn Viên",
    slugs: ["tam-sinh-tam-the-thap-ly-dao-hoa", "hoa-bi-2"],
    tmdbQuery: "Yang Mi",
  },
  "dương mịch": {
    name: "Dương Mịch",
    avatar: "https://image.tmdb.org/t/p/w300/yangMi.jpg",
    role: "actor",
    roleTitle: "Diễn Viên",
    slugs: ["tam-sinh-tam-the-thap-ly-dao-hoa", "hoa-bi-2"],
    tmdbQuery: "Yang Mi",
  },
  "trieu lo tu": {
    name: "Triệu Lộ Tư",
    avatar: "https://image.tmdb.org/t/p/w300/zhaoLusi.jpg",
    role: "actor",
    roleTitle: "Diễn Viên",
    slugs: ["tinh-ha-xan-lan", "vung-trom-khong-the-giau"],
    tmdbQuery: "Zhao Lusi",
  },
  "triệu lộ tư": {
    name: "Triệu Lộ Tư",
    avatar: "https://image.tmdb.org/t/p/w300/zhaoLusi.jpg",
    role: "actor",
    roleTitle: "Diễn Viên",
    slugs: ["tinh-ha-xan-lan", "vung-trom-khong-the-giau"],
    tmdbQuery: "Zhao Lusi",
  },
  "tieu chien": {
    name: "Tiêu Chiến",
    avatar: "https://image.tmdb.org/t/p/w300/xiaoZhan.jpg",
    role: "actor",
    roleTitle: "Diễn Viên",
    slugs: ["tran-tinh-lenh", "ngoc-cot-dao"],
    tmdbQuery: "Xiao Zhan",
  },
  "tiêu chiến": {
    name: "Tiêu Chiến",
    avatar: "https://image.tmdb.org/t/p/w300/xiaoZhan.jpg",
    role: "actor",
    roleTitle: "Diễn Viên",
    slugs: ["tran-tinh-lenh", "ngoc-cot-dao"],
    tmdbQuery: "Xiao Zhan",
  },
};

export class PersonService {
  /**
   * Search movies by actor or director
   */
  async searchPerson(
    query: string,
    forcedRole?: "actor" | "director",
    allowExternal: boolean = true
  ): Promise<PersonSearchResult | null> {
    const raw = (query || "").trim();
    if (!raw) return null;

    // Normalize prefix
    const normKey = raw
      .toLowerCase()
      .replace(/^(dien vien|diễn viên|dao dien|đạo diễn|nghe si|nghệ sĩ)\s+/i, "")
      .trim();

    if (!normKey) return null;

    const cdnDomain = "https://phimimg.com";

    // 1. Check Curated Directory (fast slug fetching)
    const curated = CURATED_PEOPLE[normKey];
    if (curated) {
      if (Array.isArray(curated.slugs) && curated.slugs.length > 0) {
        const moviePromises = curated.slugs.map(async (slug) => {
          try {
            const res = await movieApiClient.get<any>(`/phim/${slug}`, { revalidate: 3600 });
            if (res?.movie) {
              return mapKkphimMovie(res.movie, cdnDomain);
            }
          } catch {}
          return null;
        });
        const movies = (await Promise.all(moviePromises)).filter((m): m is Movie => m !== null);
        if (movies.length > 0) {
          return {
            person: {
              name: curated.name,
              avatar: curated.avatar,
              role: curated.role,
              roleTitle: curated.roleTitle,
              movieCount: movies.length,
            },
            movies,
          };
        }
      }
    }

    // Fast-path: If external search is disabled or no TMDB key, bail out immediately!
    if (!allowExternal || !TMDB_API_KEY) return null;

    try {
      const tmdbSearchQuery = curated?.tmdbQuery || normKey;
      const searchUrl = `https://api.themoviedb.org/3/search/person?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(
        tmdbSearchQuery
      )}`;
      const tmdbRes = await fetch(searchUrl, { next: { revalidate: 86400 } }).then((r) =>
        r.json()
      );

      const person = tmdbRes?.results?.[0];
      if (!person) return null;

      const isDirector =
        forcedRole === "director" ||
        (forcedRole !== "actor" && person.known_for_department === "Directing");

      const creditsUrl = `https://api.themoviedb.org/3/person/${person.id}/combined_credits?api_key=${TMDB_API_KEY}`;
      const creditsRes = await fetch(creditsUrl, { next: { revalidate: 86400 } }).then((r) =>
        r.json()
      );

      let targetCredits: any[] = [];

      if (isDirector) {
        targetCredits = (creditsRes?.crew || [])
          .filter((c: any) => c.department === "Directing" && c.job === "Director")
          .sort((a: any, b: any) => (b.vote_count || 0) - (a.vote_count || 0))
          .slice(0, 16);
      } else {
        targetCredits = (creditsRes?.cast || [])
          .sort((a: any, b: any) => (b.vote_count || 0) - (a.vote_count || 0))
          .slice(0, 16);
      }

      if (targetCredits.length === 0) return null;

      // Match each movie in KKPhim by candidate titles
      const moviePromises = targetCredits.map(async (c: any) => {
        const candidateTitles = [c.title, c.name, c.original_title].filter(
          (t): t is string => Boolean(t && typeof t === "string" && t.trim().length > 0)
        );
        for (const qTitle of candidateTitles) {
          try {
            const searchRes = await movieApiClient.get<any>(
              `/v1/api/tim-kiem?keyword=${encodeURIComponent(qTitle)}&limit=1`,
              { revalidate: 3600 }
            );
            const items = searchRes?.data?.items || [];
            if (items.length > 0) {
              return mapKkphimMovie(items[0], cdnDomain);
            }
          } catch {}
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
        const role = isDirector ? "director" : "actor";
        const roleTitle = isDirector ? "Đạo Diễn" : "Diễn Viên";

        return {
          person: {
            name: curated?.name || person.name,
            avatar: person.profile_path
              ? `https://image.tmdb.org/t/p/w300${person.profile_path}`
              : curated?.avatar || undefined,
            role,
            roleTitle,
            movieCount: uniqueMovies.length,
          },
          movies: uniqueMovies,
        };
      }
    } catch (e) {
      console.error("PersonService error:", e);
    }

    return null;
  }
}

export const personService = new PersonService();
