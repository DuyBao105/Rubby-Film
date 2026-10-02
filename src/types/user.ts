import { Movie } from "./movie";

export interface User {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  isVip?: boolean;
  vipExpiresAt?: number | null;
  createdAt: number;
}

export interface UserPreferences {
  defaultQuality: "4k" | "1080p" | "auto";
  autoNext: boolean;
  preferredLanguage: "vietsub" | "dub" | "orig";
  volume: number;
  autoSkipIntro?: boolean;
  skipIntroDuration?: number;
}

export interface EpisodeWatchedState {
  progressSeconds: number;
  durationSeconds: number;
  progressPercent: number;
  completed: boolean;
  watchedAt: number;
}

export interface WatchHistoryItem {
  movieId: string;
  slug: string;
  title: string;
  posterUrl: string;
  backdropUrl?: string;
  movie: Movie;
  episodeId?: string;
  episodeNumber?: number;
  episodeName?: string;
  progressSeconds: number;
  durationSeconds: number;
  progressPercent: number;
  watchedAt: number;
  updatedAt?: number;
  completed?: boolean;
  watchedEpisodes?: Record<number, EpisodeWatchedState>;
}

export interface FavoriteItem {
  id: string;
  movieId: string;
  movie: Movie;
  addedAt: number;
}
