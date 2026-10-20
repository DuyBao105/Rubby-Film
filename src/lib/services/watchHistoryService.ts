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
const GUEST_KEY = "rubbyfilm_watch_history_guest";

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

export function mergeWatchedEpisodes(
  serverEpisodes?: Record<number, EpisodeWatchedState>,
  localEpisodes?: Record<number, EpisodeWatchedState>
): Record<number, EpisodeWatchedState> {
  const result: Record<number, EpisodeWatchedState> = {};
  const s = serverEpisodes || {};
  const l = localEpisodes || {};
  const allKeys = new Set([...Object.keys(s), ...Object.keys(l)]);

  for (const key of allKeys) {
    const epNum = Number(key);
    const itemS = s[epNum];
    const itemL = l[epNum];

    if (itemS && !itemL) {
      result[epNum] = itemS;
    } else if (!itemS && itemL) {
      result[epNum] = itemL;
    } else if (itemS && itemL) {
      const timeS = itemS.watchedAt || 0;
      const timeL = itemL.watchedAt || 0;
      if (timeL > timeS) {
        result[epNum] = itemL;
      } else if (timeS > timeL) {
        result[epNum] = itemS;
      } else {
        result[epNum] = (itemL.progressSeconds || 0) >= (itemS.progressSeconds || 0) ? itemL : itemS;
      }
    }
  }

  return result;
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
    watchedAt?: number;
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
        if (now - this.lastAutoSyncTime > 4000 && this.currentUserId) {
          this.lastAutoSyncTime = now;
          this.syncWithServer(true);
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
      this.migrateGuestHistory(normalized);
      this.syncWithServer(true);
    }
  }

  private migrateGuestHistory(userId: string): void {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(GUEST_KEY);
      if (raw) {
        const guestItems = JSON.parse(raw) as WatchHistoryItem[];
        if (Array.isArray(guestItems) && guestItems.length > 0) {
          localStorage.removeItem(GUEST_KEY);
          const current = this.load();
          const map = new Map<string, WatchHistoryItem>();
          for (const item of [...current, ...guestItems]) {
            const id = String(item.movieId || item.movie?.id || item.slug || "").trim();
            if (id && !map.has(id)) {
              map.set(id, item);
            }
          }
          const merged = Array.from(map.values()).slice(0, 50);
          this.save(merged);
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
      }
    } catch {}
  }

  private getStorageKey(): string {
    if (!this.currentUserId) return GUEST_KEY;
    return `rubbyfilm_watch_history_${this.currentUserId}`;
  }

  private getTombstoneKey(): string {
    if (!this.currentUserId) return "rubbyfilm_watch_history_tombstones_guest";
    return `rubbyfilm_watch_history_tombstones_${this.currentUserId}`;
  }

  private getTombstones(): Set<string> {
    if (typeof window === "undefined") return new Set();
    const key = this.getTombstoneKey();
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return new Set(parsed.map((s) => String(s).toLowerCase().trim()));
        }
      }
    } catch {}
    return new Set();
  }

  private addTombstone(id: string): void {
    if (typeof window === "undefined" || !id) return;
    const key = this.getTombstoneKey();
    try {
      const set = this.getTombstones();
      set.add(String(id).toLowerCase().trim());
      localStorage.setItem(key, JSON.stringify(Array.from(set)));
    } catch {}
  }

  private removeTombstone(id: string): void {
    if (typeof window === "undefined" || !id) return;
    const key = this.getTombstoneKey();
    try {
      const set = this.getTombstones();
      const target = String(id).toLowerCase().trim();
      if (set.has(target)) {
        set.delete(target);
        localStorage.setItem(key, JSON.stringify(Array.from(set)));
      }
    } catch {}
  }

  private load(): WatchHistoryItem[] {
    if (typeof window === "undefined") return [];
    if (this.cache !== null) return this.cache;

    try {
      const key = this.getStorageKey();
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const tombstones = this.getTombstones();
          const seen = new Set<string>();
          const deduplicated: WatchHistoryItem[] = [];
          for (const item of parsed) {
            const id = String(item?.movieId || item?.movie?.id || "").toLowerCase().trim();
            const slug = String(item?.slug || item?.movie?.slug || "").toLowerCase().trim();
            if ((id && tombstones.has(id)) || (slug && tombstones.has(slug))) {
              continue;
            }
            const keyId = id || slug;
            if (keyId && !seen.has(keyId)) {
              seen.add(keyId);
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
    if (typeof window !== "undefined") {
      try {
        const key = this.getStorageKey();
        localStorage.setItem(key, JSON.stringify(items));
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
    if (!force && now - this.lastSyncTime < 3000) {
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
        const tombstones = this.getTombstones();

        // Merge server items and local items with timestamp precision
        const map = new Map<string, WatchHistoryItem>();

        // Put server items first, filtering out any deleted items (tombstones)
        for (const s of serverItems) {
          const id = String(s.movieId || s.movie?.id || "").toLowerCase().trim();
          const slug = String(s.slug || s.movie?.slug || "").toLowerCase().trim();

          if ((id && tombstones.has(id)) || (slug && tombstones.has(slug))) {
            // Server still has this deleted item, send DELETE again to ensure server cleans it
            fetch(`/api/user/history?id=${encodeURIComponent(s.movieId || s.slug || "")}`, {
              method: "DELETE",
              headers: getAuthHeaders(),
              credentials: "include",
            }).catch(() => {});
          } else {
            const primaryId = String(s.movieId || s.movie?.id || s.slug || "").trim();
            if (primaryId) map.set(primaryId, s);
          }
        }

        let localHasNewer = false;

        // Merge local items
        for (const l of localItems) {
          const id = String(l.movieId || l.movie?.id || "").toLowerCase().trim();
          const slug = String(l.slug || l.movie?.slug || "").toLowerCase().trim();
          if ((id && tombstones.has(id)) || (slug && tombstones.has(slug))) {
            continue;
          }

          const primaryId = String(l.movieId || l.movie?.id || l.slug || "").trim();
          if (!primaryId) continue;

          const serverMatch = map.get(primaryId);
          if (!serverMatch) {
            map.set(primaryId, l);
            localHasNewer = true;
          } else {
            const mergedEpisodes = mergeWatchedEpisodes(
              serverMatch.watchedEpisodes,
              l.watchedEpisodes
            );
            const serverTime = serverMatch.watchedAt || 0;
            const localTime = l.watchedAt || 0;

            if (localTime > serverTime) {
              map.set(primaryId, {
                ...l,
                watchedEpisodes: mergedEpisodes,
              });
              localHasNewer = true;
            } else {
              map.set(primaryId, {
                ...serverMatch,
                watchedEpisodes: mergedEpisodes,
              });
              // Check if any episode in local has a newer watchedAt than server
              const hasNewerEp = Object.entries(l.watchedEpisodes || {}).some(
                ([epNumStr, epState]) => {
                  const sEp = serverMatch.watchedEpisodes?.[Number(epNumStr)];
                  return !sEp || (epState.watchedAt || 0) > (sEp.watchedAt || 0);
                }
              );
              if (hasNewerEp) {
                localHasNewer = true;
              }
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

        // If local had items not yet on server or newer episodes, push merged to server
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
      const payload = {
        ...this.pendingSyncItem,
        watchedAt: this.pendingSyncItem.watchedAt || Date.now(),
      };
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
    const now = Date.now();

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
        watchedAt: now,
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
      watchedAt: now,
      completed: isCompleted,
      watchedEpisodes: updatedWatched,
    };

    if (movie.id) this.removeTombstone(movie.id);
    if (movie.slug) this.removeTombstone(movie.slug);

    const updated = [newItem, ...filtered].slice(0, 50);
    this.save(updated);

    // Queue server sync
    if (this.currentUserId && typeof window !== "undefined") {
      this.pendingSyncItem = {
        movie,
        progressSeconds,
        durationSeconds,
        episode,
        watchedAt: now,
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
    this.addTombstone(target);

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
    const current = this.load();
    for (const item of current) {
      if (item.movieId) this.addTombstone(item.movieId);
      if (item.slug) this.addTombstone(item.slug);
      if (item.movie?.id) this.addTombstone(item.movie.id);
    }
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
