import { Episode } from "./episode";

export type MovieType = "single" | "series";

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
  keywords?: string[];
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

export interface MoviePagination {
  totalItems: number;
  totalItemsPerPage: number;
  currentPage: number;
  totalPages: number;
}

export interface PaginatedMovies {
  items: Movie[];
  pagination: MoviePagination;
}
