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
}

const PRIMARY_KEY = "rubbyfilm_my_list";
const LEGACY_KEY = "bfilm_my_list";

class MyListService implements IMyListService {
  private cache: Movie[] | null = null;
  private listeners: Set<(list: Movie[]) => void> = new Set();
  private currentUserId: string | null = null;

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
    }
  }

  public setUser(userId: string | null): void {
    const normalized = userId ? String(userId).trim() : null;
    if (this.currentUserId === normalized) return;
    this.currentUserId = normalized;
    this.cache = null;
    this.notify();

    if (normalized) {
      this.syncWithServer();
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

  private async syncWithServer(): Promise<void> {
    if (typeof window === "undefined" || !this.currentUserId) return;

    try {
      const res = await fetch("/api/user/favorites", {
        method: "GET",
        headers: { "Cache-Control": "no-cache" },
      });

      if (!res.ok) return;

      const body = (await res.json()) as {
        success?: boolean;
        data?: { favorites?: Movie[] };
      };

      if (!body.success || !Array.isArray(body.data?.favorites)) return;

      const serverItems = body.data.favorites;
      const localItems = this.load();

      // Merge server and local
      const map = new Map<string, Movie>();
      for (const m of serverItems) {
        const id = String(m.id || m.slug || "").trim();
        if (id) map.set(id, m);
      }

      let localHasNew = false;
      for (const m of localItems) {
        const id = String(m.id || m.slug || "").trim();
        if (id && !map.has(id)) {
          map.set(id, m);
          localHasNew = true;
        }
      }

      const merged = Array.from(map.values()).slice(0, 100);
      this.cache = merged;

      if (this.currentUserId) {
        const key = this.getStorageKey();
        if (key) {
          localStorage.setItem(key, JSON.stringify(merged));
        }
      }
      this.notify();

      if (localHasNew || (serverItems.length === 0 && merged.length > 0)) {
        fetch("/api/user/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: merged }),
        }).catch(() => {});
      }
    } catch (e) {
      console.warn("[MyListService] syncWithServer error:", e);
    }
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
        headers: { "Content-Type": "application/json" },
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
