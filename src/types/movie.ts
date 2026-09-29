export type MovieType = "single" | "series";

export interface VideoSource {
  serverName: string;
  label: string;
  url: string;
  type: "mp4" | "hls" | "embed";
}

export interface Episode {
  id: string;
  name: string;
  slug: string;
  episodeNumber: number;
  seasonNumber: number;
  duration?: string;
  thumbnailUrl?: string;
  videoSources: VideoSource[];
}

export interface Movie {
  id: string;
  slug: string;
  title: string;
  originalTitle: string;
  description: string;
  posterUrl: string;
  backdropUrl: string;
  year: number;
  rating: number; // 0 - 10
  duration: string;
  country: string;
  countrySlug: string;
  genres: string[];
  genreSlugs: string[];
  quality: string;
  language: string;
  type: MovieType;
  rawType?: string;
  director?: string;
  cast?: string[];
  totalEpisodes?: number;
  currentEpisode?: string;
  showtimes?: string;
  notify?: string;
  episodes?: Episode[];
  isHot?: boolean;
  isLatest?: boolean;
  isRecommended?: boolean;
  views?: number;
  tmdbId?: string | number;
  tmdbType?: "movie" | "tv";
  logoUrl?: string;
  trailerUrl?: string;
  tmdbVoteAverage?: number;
  imdbVoteAverage?: number;
}

export interface Genre {
  id: string;
  name: string;
  slug: string;
  description?: string;
  count?: number;
}

export interface Country {
  id: string;
  name: string;
  slug: string;
  code: string;
  count?: number;
}

export interface MovieFilterOptions {
  genre?: string;
  country?: string;
  year?: number;
  type?: MovieType | "hoat-hinh" | "chieu-rap";
  sort?: "latest" | "rating" | "views" | "year" | "year_asc" | "alpha";
  rating?: number;
  quality?: string;
  language?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface HomeSectionsData {
  featured: Movie[];
  latest: Movie[];
  hot: Movie[];
  series: Movie[];
  singles: Movie[];
  tvShows: Movie[];
  action: Movie[];
  romance: Movie[];
  animation: Movie[];
  recommended: Movie[];
}
