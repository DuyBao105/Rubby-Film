import { Movie } from "@/types/movie";

export interface IMyListService {
  getList(): Movie[];
  add(movie: Movie): void;
  remove(movieId: string): void;
  toggle(movie: Movie): boolean;
  has(movieId: string): boolean;
  clear(): void;
  subscribe(callback: (list: Movie[]) => void): () => void;
  setUser(userId: string | null): void;
  syncWithServer(): Promise<void>;
}

const PRIMARY_KEY = "rubbyfilm_my_list";
const LEGACY_KEY = "bfilm_my_list";

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

class MyListService implements IMyListService {
  private cache: Movie[] | null = null;
  private listeners: Set<(list: Movie[]) => void> = new Set();
  private currentUserId: string | null = null;
  private lastAutoSyncTime = 0;
  private syncPromise: Promise<void> | null = null;
  private lastSyncTime = 0;

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
        if (now - this.lastAutoSyncTime > 5000 && this.currentUserId) {
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
      this.syncWithServer(true);
    }
  }

  private getStorageKey(): string | null {
    if (!this.currentUserId) return null;
    return `rubbyfilm_my_list_${this.currentUserId}`;
  }

  private load(): Movie[] {
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
          this.cache = parsed;
          return this.cache;
        }
      }
    } catch (e) {
      console.error("[MyListService] Failed to parse storage:", e);
    }

    this.cache = [];
    return this.cache;
  }

  private save(items: Movie[]): void {
    this.cache = items;
    if (typeof window !== "undefined" && this.currentUserId) {
      try {
        const key = this.getStorageKey();
        if (key) {
          localStorage.setItem(key, JSON.stringify(items));
        }
      } catch (e) {
        console.error("[MyListService] Failed to write storage:", e);
      }
    }
    this.notify();
  }

  private notify(): void {
    const list = this.getList();
    this.listeners.forEach((fn) => {
      try {
        fn(list);
      } catch (e) {
        console.error("[MyListService] Listener error:", e);
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
        const res = await fetch("/api/user/favorites", {
          method: "GET",
          headers: getAuthHeaders(),
          credentials: "include",
        });

        if (!res.ok) return;

        const body = (await res.json()) as {
          success?: boolean;
          data?: { favorites?: Movie[] };
        };

        if (!body.success || !Array.isArray(body.data?.favorites)) return;

        const serverItems = body.data.favorites;
        const localItems = this.load();

        const map = new Map<string, Movie>();
        for (const s of serverItems) {
          const id = String(s.id || s.slug || "").trim();
          if (id) map.set(id, s);
        }

        let localHasNewer = false;
        for (const l of localItems) {
          const id = String(l.id || l.slug || "").trim();
          if (!id) continue;
          if (!map.has(id)) {
            map.set(id, l);
            localHasNewer = true;
          }
        }

        const resolved = Array.from(map.values());
        if (localHasNewer || (serverItems.length === 0 && resolved.length > 0)) {
          fetch("/api/user/favorites", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...getAuthHeaders(),
            },
            credentials: "include",
            body: JSON.stringify({ items: resolved }),
          }).catch(() => {});
        }

        const currentCached = this.cache || [];
        const changed =
          currentCached.length !== resolved.length ||
          currentCached.some((m, idx) => m.id !== resolved[idx]?.id);

        this.cache = resolved;
        if (this.currentUserId) {
          const key = this.getStorageKey();
          if (key) {
            localStorage.setItem(key, JSON.stringify(resolved));
          }
        }
        if (changed) {
          this.notify();
        }
      } catch (e) {
        console.warn("[MyListService] syncWithServer error:", e);
      } finally {
        this.syncPromise = null;
      }
    })();

    return this.syncPromise;
  }

  // --- Public Methods ---

  public getList(): Movie[] {
    return [...this.load()];
  }

  public has(movieId: string): boolean {
    const target = String(movieId).trim().toLowerCase();
    return this.load().some((m) => {
      const id = String(m.id || "").trim().toLowerCase();
      const slug = String(m.slug || "").trim().toLowerCase();
      return id === target || slug === target;
    });
  }

  public add(movie: Movie): void {
    if (!this.currentUserId || !movie) return;
    const current = this.load();
    if (current.some((m) => m.id === movie.id || m.slug === movie.slug)) return;
    const updated = [movie, ...current];
    this.save(updated);

    if (this.currentUserId && typeof window !== "undefined") {
      fetch("/api/user/favorites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        credentials: "include",
        body: JSON.stringify({ movie }),
      }).catch(() => {});
    }
  }

  public remove(movieId: string): void {
    if (!this.currentUserId || !movieId) return;
    const target = String(movieId).trim().toLowerCase();
    const current = this.load();
    const updated = current.filter((m) => {
      const id = String(m.id || "").trim().toLowerCase();
      const slug = String(m.slug || "").trim().toLowerCase();
      return id !== target && slug !== target;
    });

    this.save(updated);

    if (this.currentUserId && typeof window !== "undefined") {
      fetch(`/api/user/favorites?id=${encodeURIComponent(target)}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
        credentials: "include",
      }).catch(() => {});
    }
  }

  public toggle(movie: Movie): boolean {
    if (!this.currentUserId || !movie) return false;
    if (this.has(movie.id)) {
      this.remove(movie.id);
      return false;
    } else {
      this.add(movie);
      return true;
    }
  }

  public clear(): void {
    this.save([]);
    if (typeof window !== "undefined" && this.currentUserId) {
      try {
        const key = this.getStorageKey();
        if (key) localStorage.removeItem(key);
      } catch {}

      fetch("/api/user/favorites", {
        method: "DELETE",
        headers: getAuthHeaders(),
        credentials: "include",
      }).catch(() => {});
    }
  }

  public subscribe(callback: (list: Movie[]) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }
}

export const myListService = new MyListService();
