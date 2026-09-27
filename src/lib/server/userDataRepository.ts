import fs from "fs";
import path from "path";
import type { Movie } from "@/types/movie";
import type { WatchHistoryItem, EpisodeWatchedState } from "@/types/user";

const DATA_DIR = path.join(process.cwd(), "data");
const HISTORY_FILE = path.join(DATA_DIR, "watch-history.json");
const FAVORITES_FILE = path.join(DATA_DIR, "favorites.json");

class UserDataRepository {
  private historyMap: Map<string, WatchHistoryItem[]> = new Map();
  private favoritesMap: Map<string, Movie[]> = new Map();
  private isLoaded = false;

  constructor() {
    this.loadFromDisk();
  }

  private ensureDirectory() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
    } catch (e) {
      console.error("[UserDataRepository] Failed to ensure data directory:", e);
    }
  }

  private loadFromDisk() {
    if (this.isLoaded) return;
    this.ensureDirectory();

    try {
      if (fs.existsSync(HISTORY_FILE)) {
        const raw = fs.readFileSync(HISTORY_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          for (const [userId, items] of Object.entries(parsed)) {
            if (Array.isArray(items)) {
              this.historyMap.set(userId, items);
            }
          }
        }
      }
    } catch (e) {
      console.error("[UserDataRepository] Failed to load watch history:", e);
    }

    try {
      if (fs.existsSync(FAVORITES_FILE)) {
        const raw = fs.readFileSync(FAVORITES_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          for (const [userId, items] of Object.entries(parsed)) {
            if (Array.isArray(items)) {
              this.favoritesMap.set(userId, items);
            }
          }
        }
      }
    } catch (e) {
      console.error("[UserDataRepository] Failed to load favorites:", e);
    }

    this.isLoaded = true;
  }

  private saveHistoryToDisk() {
    this.ensureDirectory();
    try {
      const obj: Record<string, WatchHistoryItem[]> = {};
      for (const [userId, items] of this.historyMap.entries()) {
        obj[userId] = items;
      }
      fs.writeFileSync(HISTORY_FILE, JSON.stringify(obj, null, 2), "utf-8");
    } catch (e) {
      console.error("[UserDataRepository] Failed to save watch history:", e);
    }
  }

  private saveFavoritesToDisk() {
    this.ensureDirectory();
    try {
      const obj: Record<string, Movie[]> = {};
      for (const [userId, items] of this.favoritesMap.entries()) {
        obj[userId] = items;
      }
      fs.writeFileSync(FAVORITES_FILE, JSON.stringify(obj, null, 2), "utf-8");
    } catch (e) {
      console.error("[UserDataRepository] Failed to save favorites:", e);
    }
  }

  // --- Watch History ---

  public getWatchHistory(userId: string): WatchHistoryItem[] {
    if (!userId) return [];
    this.loadFromDisk();
    return this.historyMap.get(userId) || [];
  }

  public saveWatchHistory(userId: string, items: WatchHistoryItem[]): WatchHistoryItem[] {
    if (!userId) return [];
    this.loadFromDisk();

    // Deduplicate and cap at 50 items
    const seen = new Set<string>();
    const deduplicated: WatchHistoryItem[] = [];

    for (const item of items) {
      const key = String(item.movieId || item.movie?.id || item.slug || "").trim();
      if (key && !seen.has(key)) {
        seen.add(key);
        deduplicated.push(item);
      }
    }

    const capped = deduplicated.slice(0, 50);
    this.historyMap.set(userId, capped);
    this.saveHistoryToDisk();
    return capped;
  }

  public updateWatchProgress(
    userId: string,
    movie: Movie,
    progressSeconds: number,
    durationSeconds: number,
    episode?: { id: string; episodeNumber: number; name: string }
  ): WatchHistoryItem[] {
    if (!userId || !movie || !durationSeconds || durationSeconds <= 0) {
      return this.getWatchHistory(userId);
    }

    const currentList = this.getWatchHistory(userId);
    const progressPercent = Math.min(100, Math.round((progressSeconds / durationSeconds) * 100));
    const epNum = episode?.episodeNumber ?? 1;
    const isCompleted = progressPercent >= 90;

    const existing = currentList.find(
      (item) => item.movieId === movie.id || item.movie?.id === movie.id || item.slug === movie.slug
    );
    const filtered = currentList.filter(
      (item) => item.movieId !== movie.id && item.movie?.id !== movie.id && item.slug !== movie.slug
    );

    const existingWatched = existing?.watchedEpisodes || {};
    const updatedWatched: Record<number, EpisodeWatchedState> = {
      ...existingWatched,
      [epNum]: {
        progressSeconds: Math.round(progressSeconds),
        durationSeconds: Math.round(durationSeconds),
        progressPercent,
        completed: isCompleted || Boolean(existingWatched[epNum]?.completed),
        watchedAt: Date.now(),
      },
    };

    const newItem: WatchHistoryItem = {
      movieId: movie.id,
      slug: movie.slug,
      title: movie.title,
      posterUrl: movie.posterUrl,
      backdropUrl: movie.backdropUrl,
      movie,
      episodeId: episode?.id,
      episodeNumber: episode?.episodeNumber,
      episodeName: episode?.name,
      progressSeconds: Math.round(progressSeconds),
      durationSeconds: Math.round(durationSeconds),
      progressPercent,
      watchedAt: Date.now(),
      completed: isCompleted,
      watchedEpisodes: updatedWatched,
    };

    const updated = [newItem, ...filtered].slice(0, 50);
    this.historyMap.set(userId, updated);
    this.saveHistoryToDisk();
    return updated;
  }

  public removeWatchHistory(userId: string, movieIdOrSlug: string): WatchHistoryItem[] {
    if (!userId || !movieIdOrSlug) return this.getWatchHistory(userId);
    const target = String(movieIdOrSlug).trim().toLowerCase();
    const current = this.getWatchHistory(userId);
    const updated = current.filter((item) => {
      const id = String(item.movieId || item.movie?.id || "").trim().toLowerCase();
      const slug = String(item.slug || item.movie?.slug || "").trim().toLowerCase();
      return id !== target && slug !== target;
    });

    this.historyMap.set(userId, updated);
    this.saveHistoryToDisk();
    return updated;
  }

  public clearWatchHistory(userId: string): void {
    if (!userId) return;
    this.historyMap.delete(userId);
    this.saveHistoryToDisk();
  }

  // --- Favorites / My List ---

  public getFavorites(userId: string): Movie[] {
    if (!userId) return [];
    this.loadFromDisk();
    return this.favoritesMap.get(userId) || [];
  }

  public saveFavorites(userId: string, items: Movie[]): Movie[] {
    if (!userId) return [];
    this.loadFromDisk();

    const seen = new Set<string>();
    const deduplicated: Movie[] = [];
    for (const m of items) {
      const key = String(m.id || m.slug || "").trim();
      if (key && !seen.has(key)) {
        seen.add(key);
        deduplicated.push(m);
      }
    }

    const capped = deduplicated.slice(0, 100);
    this.favoritesMap.set(userId, capped);
    this.saveFavoritesToDisk();
    return capped;
  }

  public addFavorite(userId: string, movie: Movie): Movie[] {
    if (!userId || !movie) return this.getFavorites(userId);
    const current = this.getFavorites(userId);
    if (current.some((m) => m.id === movie.id || m.slug === movie.slug)) {
      return current;
    }
    const updated = [movie, ...current].slice(0, 100);
    this.favoritesMap.set(userId, updated);
    this.saveFavoritesToDisk();
    return updated;
  }

  public removeFavorite(userId: string, movieId: string): Movie[] {
    if (!userId || !movieId) return this.getFavorites(userId);
    const target = String(movieId).trim().toLowerCase();
    const current = this.getFavorites(userId);
    const updated = current.filter((m) => {
      const id = String(m.id || "").trim().toLowerCase();
      const slug = String(m.slug || "").trim().toLowerCase();
      return id !== target && slug !== target;
    });

    this.favoritesMap.set(userId, updated);
    this.saveFavoritesToDisk();
    return updated;
  }

  public clearFavorites(userId: string): void {
    if (!userId) return;
    this.favoritesMap.delete(userId);
    this.saveFavoritesToDisk();
  }
}

export const userDataRepository = new UserDataRepository();
