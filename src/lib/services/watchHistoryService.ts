import { Movie } from "@/types/movie";
import { WatchHistoryItem, EpisodeWatchedState } from "@/types/user";

export interface IWatchHistoryService {
  getHistory(): WatchHistoryItem[];
  getRecentlyViewed(limit?: number): WatchHistoryItem[];
  getContinueWatching(limit?: number): WatchHistoryItem[];
  updateProgress(
    movie: Movie,
    progressSeconds: number,
    durationSeconds: number,
    episode?: { id: string; episodeNumber: number; name: string },
    immediate?: boolean
  ): void;
  removeFromHistory(movieId: string): void;
  clear(): void;
  getMovieProgress(movieId: string): WatchHistoryItem | undefined;
  getEpisodeProgress(movieId: string, episodeNumber: number): EpisodeWatchedState | undefined;
  isEpisodeWatched(movieId: string, episodeNumber: number): boolean;
  subscribe(callback: (history: WatchHistoryItem[]) => void): () => void;
  setUser(userId: string | null): void;
  syncWithServer(): Promise<void>;
  flushSync(): void;
}

const PRIMARY_KEY = "rubbyfilm_watch_history";
const LEGACY_KEY = "bfilm_watch_history";

function getAuthHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    "Cache-Control": "no-cache",
  };
  if (typeof window !== "undefined") {
    try {
      const token = localStorage.getItem("rubbyfilm_token");
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    } catch {}
  }
  return headers;
}

class WatchHistoryService implements IWatchHistoryService {
  private cache: WatchHistoryItem[] | null = null;
  private listeners: Set<(history: WatchHistoryItem[]) => void> = new Set();
  private currentUserId: string | null = null;
  private syncTimer: NodeJS.Timeout | null = null;
  private lastAutoSyncTime = 0;
  private syncPromise: Promise<void> | null = null;
  private lastSyncTime = 0;
  private pendingSyncItem: {
    movie: Movie;
    progressSeconds: number;
    durationSeconds: number;
    episode?: { id: string; episodeNumber: number; name: string };
  } | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(PRIMARY_KEY);
        localStorage.removeItem(LEGACY_KEY);

        const cached = localStorage.getItem("rubbyfilm_cached_user");
        if (cached) {
          const parsed = JSON.parse(cached) as { id?: string } | null;
          if (parsed?.id) {
            this.currentUserId = String(parsed.id).trim();
            this.syncWithServer();
          }
        }
      } catch {}

      // Cross-device sync: auto re-sync when switching back to tab/browser window
      const triggerAutoSync = () => {
        const now = Date.now();
        if (now - this.lastAutoSyncTime > 2500 && this.currentUserId) {
          this.lastAutoSyncTime = now;
          this.syncWithServer();
        }
      };

      window.addEventListener("focus", triggerAutoSync);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          triggerAutoSync();
        }
      });
    }
  }

  public setUser(userId: string | null): void {
    const normalized = userId ? String(userId).trim() : null;
    const changed = this.currentUserId !== normalized;
    this.currentUserId = normalized;
    if (changed) {
      this.cache = null;
      this.notify();
    }
    if (normalized) {
      this.syncWithServer(true);
    }
  }

  private getStorageKey(): string | null {
    if (!this.currentUserId) return null;
    return `rubbyfilm_watch_history_${this.currentUserId}`;
  }

  private load(): WatchHistoryItem[] {
    if (typeof window === "undefined") return [];
    if (!this.currentUserId) {
      this.cache = [];
      return [];
    }
    if (this.cache !== null) return this.cache;

    try {
      const key = this.getStorageKey();
      if (!key) {
        this.cache = [];
        return [];
      }

      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const seen = new Set<string>();
          const deduplicated: WatchHistoryItem[] = [];
          for (const item of parsed) {
            const id = item?.movieId || item?.movie?.id || item?.slug;
            if (id && !seen.has(String(id))) {
              seen.add(String(id));
              deduplicated.push(item);
            }
          }
          this.cache = deduplicated;
          return this.cache;
        }
      }
    } catch (e) {
      console.error("[WatchHistoryService] Failed to parse storage:", e);
    }

    this.cache = [];
    return this.cache;
  }

  private save(items: WatchHistoryItem[]): void {
    this.cache = items;
    if (typeof window !== "undefined" && this.currentUserId) {
      try {
        const key = this.getStorageKey();
        if (key) {
          localStorage.setItem(key, JSON.stringify(items));
        }
      } catch (e) {
        console.error("[WatchHistoryService] Failed to write storage:", e);
      }
    }
    this.notify();
  }

  private notify(): void {
    const history = this.getHistory();
    this.listeners.forEach((fn) => {
      try {
        fn(history);
      } catch (e) {
        console.error("[WatchHistoryService] Listener error:", e);
      }
    });
  }

  // --- Cloud Sync ---

  public async syncWithServer(force: boolean = false): Promise<void> {
    if (typeof window === "undefined" || !this.currentUserId) return;

    if (this.syncPromise) return this.syncPromise;

    const now = Date.now();
    if (!force && now - this.lastSyncTime < 4000) {
      return;
    }
    this.lastSyncTime = now;

    this.syncPromise = (async () => {
      try {
        const res = await fetch("/api/user/history", {
          method: "GET",
          headers: getAuthHeaders(),
          credentials: "include",
        });

        if (!res.ok) return;

        const body = (await res.json()) as {
          success?: boolean;
          data?: { history?: WatchHistoryItem[] };
        };

        if (!body.success || !Array.isArray(body.data?.history)) return;

        const serverItems = body.data.history;
        const localItems = this.load();

        // Merge server items and local items
        const map = new Map<string, WatchHistoryItem>();

        // Put server items first
        for (const s of serverItems) {
          const id = String(s.movieId || s.movie?.id || s.slug || "").trim();
          if (id) map.set(id, s);
        }

        let localHasNewer = false;

        // Merge local items only if local has newer watch timestamp than server
        for (const l of localItems) {
          const id = String(l.movieId || l.movie?.id || l.slug || "").trim();
          if (!id) continue;

          const serverMatch = map.get(id);
          if (!serverMatch) {
            map.set(id, l);
            localHasNewer = true;
          } else {
            const mergedEpisodes = {
              ...(serverMatch.watchedEpisodes || {}),
              ...(l.watchedEpisodes || {}),
            };
            if ((l.watchedAt || 0) > (serverMatch.watchedAt || 0)) {
              map.set(id, {
                ...l,
                watchedEpisodes: mergedEpisodes,
              });
              localHasNewer = true;
            } else {
              map.set(id, {
                ...serverMatch,
                watchedEpisodes: mergedEpisodes,
              });
            }
          }
        }

        const merged = Array.from(map.values())
          .sort((a, b) => (b.watchedAt || 0) - (a.watchedAt || 0))
          .slice(0, 50);

        const currentCached = this.cache || [];
        const changed =
          currentCached.length !== merged.length ||
          currentCached.some(
            (m, idx) =>
              (m.movieId || m.slug) !== (merged[idx]?.movieId || merged[idx]?.slug) ||
              m.progressSeconds !== merged[idx]?.progressSeconds
          );

        this.cache = merged;
        if (this.currentUserId) {
          const key = this.getStorageKey();
          if (key) {
            localStorage.setItem(key, JSON.stringify(merged));
          }
        }
        if (changed) {
          this.notify();
        }

        // If local had items not yet on server or newer, push merged to server
        if (localHasNewer || (serverItems.length === 0 && merged.length > 0)) {
          fetch("/api/user/history", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...getAuthHeaders(),
            },
            credentials: "include",
            body: JSON.stringify({ items: merged }),
          }).catch(() => {});
        }
      } catch (e) {
        console.warn("[WatchHistoryService] syncWithServer error:", e);
      } finally {
        this.syncPromise = null;
      }
    })();

    return this.syncPromise;
  }

  public flushSync(): void {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }

    if (this.pendingSyncItem && this.currentUserId && typeof window !== "undefined") {
      const payload = { ...this.pendingSyncItem };
      this.pendingSyncItem = null;

      try {
        fetch("/api/user/history", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
          credentials: "include",
          body: JSON.stringify(payload),
          keepalive: true,
        }).catch(() => {
          if (navigator.sendBeacon) {
            const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
            navigator.sendBeacon("/api/user/history", blob);
          }
        });
      } catch {}
    }
  }

  // --- Public Methods ---

  public getHistory(): WatchHistoryItem[] {
    return [...this.load()];
  }

  public getRecentlyViewed(limit: number = 10): WatchHistoryItem[] {
    return this.load().slice(0, limit);
  }

  public getContinueWatching(limit: number = 10): WatchHistoryItem[] {
    return this.load()
      .filter((item) => item.progressSeconds > 5 && !item.completed)
      .slice(0, limit);
  }

  public updateProgress(
    movie: Movie,
    progressSeconds: number,
    durationSeconds: number,
    episode?: { id: string; episodeNumber: number; name: string },
    immediate: boolean = false
  ): void {
    if (!durationSeconds || durationSeconds <= 0) return;
    const progressPercent = Math.min(100, Math.round((progressSeconds / durationSeconds) * 100));
    const epNum = episode?.episodeNumber ?? 1;
    const isCompleted = progressPercent >= 90;

    const currentList = this.load();
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
    this.save(updated);

    // Queue server sync
    if (this.currentUserId && typeof window !== "undefined") {
      this.pendingSyncItem = {
        movie,
        progressSeconds,
        durationSeconds,
        episode,
      };

      if (immediate) {
        this.flushSync();
      } else {
        if (this.syncTimer) clearTimeout(this.syncTimer);
        this.syncTimer = setTimeout(() => {
          this.flushSync();
        }, 3000);
      }
    }
  }

  public removeFromHistory(movieIdOrSlug: string): void {
    if (!movieIdOrSlug) return;
    const target = String(movieIdOrSlug).trim().toLowerCase();
    const current = this.load();
    const updated = current.filter((item) => {
      const id = String(item.movieId || item.movie?.id || "").trim().toLowerCase();
      const slug = String(item.slug || item.movie?.slug || "").trim().toLowerCase();
      return id !== target && slug !== target;
    });

    this.save(updated);

    if (this.currentUserId && typeof window !== "undefined") {
      fetch(`/api/user/history?id=${encodeURIComponent(target)}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
        credentials: "include",
      }).catch(() => {});
    }
  }

  public clear(): void {
    this.save([]);
    if (typeof window !== "undefined" && this.currentUserId) {
      try {
        const key = this.getStorageKey();
        if (key) localStorage.removeItem(key);
      } catch {}

      fetch("/api/user/history", {
        method: "DELETE",
        headers: getAuthHeaders(),
        credentials: "include",
      }).catch(() => {});
    }
  }

  public getMovieProgress(movieIdOrSlug: string): WatchHistoryItem | undefined {
    if (!movieIdOrSlug) return undefined;
    const target = String(movieIdOrSlug).trim().toLowerCase();
    return this.load().find((item) => {
      const id = String(item.movieId || item.movie?.id || "").trim().toLowerCase();
      const slug = String(item.slug || item.movie?.slug || "").trim().toLowerCase();
      return id === target || slug === target;
    });
  }

  public getEpisodeProgress(
    movieIdOrSlug: string,
    episodeNumber: number
  ): EpisodeWatchedState | undefined {
    const item = this.getMovieProgress(movieIdOrSlug);
    if (!item) return undefined;

    if (item.watchedEpisodes && item.watchedEpisodes[episodeNumber]) {
      return item.watchedEpisodes[episodeNumber];
    }

    if (item.episodeNumber === episodeNumber || (!item.episodeNumber && episodeNumber === 1)) {
      return {
        progressSeconds: item.progressSeconds,
        durationSeconds: item.durationSeconds,
        progressPercent: item.progressPercent,
        completed: Boolean(item.completed),
        watchedAt: item.watchedAt,
      };
    }

    return undefined;
  }

  public isEpisodeWatched(movieId: string, episodeNumber: number): boolean {
    const ep = this.getEpisodeProgress(movieId, episodeNumber);
    if (ep?.completed) return true;
    if (ep && ep.progressPercent >= 85) return true;
    return false;
  }

  public subscribe(callback: (history: WatchHistoryItem[]) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }
}

export const watchHistoryService = new WatchHistoryService();
