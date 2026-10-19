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
const GUEST_KEY = "rubbyfilm_my_list_guest";

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
      // Check and migrate any guest favorites once
      this.migrateGuestFavorites(normalized);
      this.syncWithServer(true);
    }
  }

  private getStorageKey(): string | null {
    if (!this.currentUserId) return GUEST_KEY;
    return `rubbyfilm_my_list_${this.currentUserId}`;
  }

  private getTombstoneKey(): string | null {
    if (!this.currentUserId) return null;
    return `rubbyfilm_my_list_tombstones_${this.currentUserId}`;
  }

  private getTombstones(): Set<string> {
    if (typeof window === "undefined") return new Set();
    const key = this.getTombstoneKey();
    if (!key) return new Set();
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
    if (!key) return;
    try {
      const set = this.getTombstones();
      set.add(String(id).toLowerCase().trim());
      localStorage.setItem(key, JSON.stringify(Array.from(set)));
    } catch {}
  }

  private removeTombstone(id: string): void {
    if (typeof window === "undefined" || !id) return;
    const key = this.getTombstoneKey();
    if (!key) return;
    try {
      const set = this.getTombstones();
      set.delete(String(id).toLowerCase().trim());
      localStorage.setItem(key, JSON.stringify(Array.from(set)));
    } catch {}
  }

  private clearTombstones(): void {
    if (typeof window === "undefined") return;
    const key = this.getTombstoneKey();
    if (key) {
      try {
        localStorage.removeItem(key);
      } catch {}
    }
  }

  private migrateGuestFavorites(userId: string): void {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(GUEST_KEY);
      if (raw) {
        const guestItems = JSON.parse(raw) as Movie[];
        if (Array.isArray(guestItems) && guestItems.length > 0) {
          localStorage.removeItem(GUEST_KEY);
          fetch("/api/user/favorites", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...getAuthHeaders(),
            },
            credentials: "include",
            body: JSON.stringify({ items: guestItems }),
          }).catch(() => {});
        }
      }
    } catch {}
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
          const tombstones = this.getTombstones();
          const filtered = parsed.filter((m) => {
            const id = String(m.id || "").toLowerCase().trim();
            const slug = String(m.slug || "").toLowerCase().trim();
            return !tombstones.has(id) && !tombstones.has(slug);
          });
          this.cache = filtered;
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
    if (!force && now - this.lastSyncTime < 3000) {
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
        const tombstones = this.getTombstones();

        // 1. Process server items: filter out any deleted items (tombstones)
        const resolved: Movie[] = [];
        for (const s of serverItems) {
          const id = String(s.id || "").toLowerCase().trim();
          const slug = String(s.slug || "").toLowerCase().trim();

          if (tombstones.has(id) || tombstones.has(slug)) {
            // Server still has this deleted item, send DELETE again to ensure server cleans it
            fetch(`/api/user/favorites?id=${encodeURIComponent(s.id || s.slug)}`, {
              method: "DELETE",
              headers: getAuthHeaders(),
              credentials: "include",
            }).catch(() => {});
          } else {
            resolved.push(s);
          }
        }

        // 2. Clear tombstones that are no longer present on the server (deletion confirmed)
        for (const tombstoneId of Array.from(tombstones)) {
          const stillOnServer = serverItems.some((s) => {
            const id = String(s.id || "").toLowerCase().trim();
            const slug = String(s.slug || "").toLowerCase().trim();
            return id === tombstoneId || slug === tombstoneId;
          });
          if (!stillOnServer) {
            this.removeTombstone(tombstoneId);
          }
        }

        // 3. Update local cache and localStorage directly to match the authoritative server list
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
    const tombstones = this.getTombstones();
    if (tombstones.has(target)) return false;

    return this.load().some((m) => {
      const id = String(m.id || "").trim().toLowerCase();
      const slug = String(m.slug || "").trim().toLowerCase();
      return id === target || slug === target;
    });
  }

  public add(movie: Movie): void {
    if (!this.currentUserId || !movie) return;
    const targetId = String(movie.id || "").trim().toLowerCase();
    const targetSlug = String(movie.slug || "").trim().toLowerCase();

    // Clear from tombstones since user re-added it
    if (targetId) this.removeTombstone(targetId);
    if (targetSlug) this.removeTombstone(targetSlug);

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

    // Mark as deleted in tombstones immediately so sync will never resurrect it
    this.addTombstone(target);

    const current = this.load();
    const updated = current.filter((m) => {
      const id = String(m.id || "").trim().toLowerCase();
      const slug = String(m.slug || "").trim().toLowerCase();
      if (id === target || slug === target) {
        if (id) this.addTombstone(id);
        if (slug) this.addTombstone(slug);
        return false;
      }
      return true;
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
    this.clearTombstones();

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
