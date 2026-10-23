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
  syncWithServer(force?: boolean): Promise<void>;
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
        // Migrate legacy shared storage if present
        const legacyPrimary = localStorage.getItem(PRIMARY_KEY);
        const legacyOld = localStorage.getItem(LEGACY_KEY);
        const legacyRaw = legacyPrimary || legacyOld;
        if (legacyRaw) {
          const parsed = JSON.parse(legacyRaw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const guestRaw = localStorage.getItem(GUEST_KEY);
            if (!guestRaw) {
              localStorage.setItem(GUEST_KEY, legacyRaw);
            }
          }
          localStorage.removeItem(PRIMARY_KEY);
          localStorage.removeItem(LEGACY_KEY);
        }

        const cached = localStorage.getItem("rubbyfilm_cached_user");
        if (cached) {
          const parsed = JSON.parse(cached) as { id?: string } | null;
          if (parsed?.id) {
            this.currentUserId = String(parsed.id).trim();
            this.migrateGuestFavorites(this.currentUserId);
            this.syncWithServer(true);
          }
        }
      } catch {}

      // Cross-device sync: auto re-sync when switching back to tab/browser window
      const triggerAutoSync = () => {
        const now = Date.now();
        if (now - this.lastAutoSyncTime > 15000 && this.currentUserId) {
          this.lastAutoSyncTime = now;
          this.syncWithServer(false);
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
    if (!changed) return;
    this.currentUserId = normalized;
    this.cache = null;
    this.notify();
    if (normalized) {
      this.migrateGuestFavorites(normalized);
      this.syncWithServer(false);
    }
  }

  private getStorageKey(): string {
    if (!this.currentUserId) return GUEST_KEY;
    return `rubbyfilm_my_list_${this.currentUserId}`;
  }

  private getTombstoneKey(): string {
    if (!this.currentUserId) return "rubbyfilm_my_list_tombstones_guest";
    return `rubbyfilm_my_list_tombstones_${this.currentUserId}`;
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
      set.delete(String(id).toLowerCase().trim());
      localStorage.setItem(key, JSON.stringify(Array.from(set)));
    } catch {}
  }

  private clearTombstones(): void {
    if (typeof window === "undefined") return;
    const key = this.getTombstoneKey();
    try {
      localStorage.removeItem(key);
    } catch {}
  }

  private migrateGuestFavorites(userId: string): void {
    if (typeof window === "undefined" || !userId) return;
    try {
      const raw = localStorage.getItem(GUEST_KEY);
      if (raw) {
        const guestItems = JSON.parse(raw) as Movie[];
        if (Array.isArray(guestItems) && guestItems.length > 0) {
          const userKey = `rubbyfilm_my_list_${userId}`;
          let userItems: Movie[] = [];
          try {
            const userRaw = localStorage.getItem(userKey);
            if (userRaw) {
              const p = JSON.parse(userRaw);
              if (Array.isArray(p)) userItems = p;
            }
          } catch {}

          const seen = new Set<string>();
          const merged: Movie[] = [];
          for (const m of [...guestItems, ...userItems]) {
            const key = String(m?.id || m?.slug || "").trim().toLowerCase();
            if (key && !seen.has(key)) {
              seen.add(key);
              merged.push(m);
            }
          }

          localStorage.setItem(userKey, JSON.stringify(merged));
          localStorage.removeItem(GUEST_KEY);
          this.cache = merged;
          this.notify();

          fetch("/api/user/favorites", {
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
    } catch (e) {
      console.warn("[MyListService] Failed to migrate guest favorites:", e);
    }
  }

  private load(): Movie[] {
    if (typeof window === "undefined") return [];
    if (this.cache !== null) return this.cache;

    try {
      const key = this.getStorageKey();
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const tombstones = this.getTombstones();
          const filtered = parsed.filter((m) => {
            const id = String(m?.id || "").toLowerCase().trim();
            const slug = String(m?.slug || "").toLowerCase().trim();
            return (!id || !tombstones.has(id)) && (!slug || !tombstones.has(slug));
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
    if (typeof window !== "undefined") {
      try {
        const key = this.getStorageKey();
        localStorage.setItem(key, JSON.stringify(items));
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
    if (!force && now - this.lastSyncTime < 8000) {
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
        const tombstones = this.getTombstones();

        // 1. Process server items: filter out any deleted items (tombstones)
        const resolved: Movie[] = [];
        const seenKeys = new Set<string>();

        for (const s of serverItems) {
          const id = String(s.id || "").toLowerCase().trim();
          const slug = String(s.slug || "").toLowerCase().trim();

          if ((id && tombstones.has(id)) || (slug && tombstones.has(slug))) {
            // Server still has this deleted item, send DELETE again to ensure server cleans it
            fetch(`/api/user/favorites?id=${encodeURIComponent(s.id || s.slug)}`, {
              method: "DELETE",
              headers: getAuthHeaders(),
              credentials: "include",
            }).catch(() => {});
          } else {
            const key = id || slug;
            if (key && !seenKeys.has(key)) {
              seenKeys.add(key);
              resolved.push(s);
            }
          }
        }

        // 2. Clear tombstones ONLY IF server returned items (confirming server is reachable and returned data)
        if (serverItems.length > 0) {
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
        }

        // 3. MERGE LOCAL ITEMS THAT ARE NOT TOMBSTONED
        // Critical safeguard: Never let an empty or partial server response wipe local additions!
        let localHasUnsynced = false;
        for (const loc of localItems) {
          const id = String(loc.id || "").toLowerCase().trim();
          const slug = String(loc.slug || "").toLowerCase().trim();

          if ((!id || !tombstones.has(id)) && (!slug || !tombstones.has(slug))) {
            const key = id || slug;
            if (key && !seenKeys.has(key)) {
              seenKeys.add(key);
              resolved.push(loc);
              localHasUnsynced = true;
            }
          }
        }

        // 4. Update local cache and localStorage directly
        const currentCached = this.cache || [];
        const changed =
          currentCached.length !== resolved.length ||
          currentCached.some((m, idx) => m.id !== resolved[idx]?.id);

        this.cache = resolved;
        if (this.currentUserId) {
          const key = this.getStorageKey();
          localStorage.setItem(key, JSON.stringify(resolved));
        }
        if (changed) {
          this.notify();
        }

        // 5. If local had items missing from server, push merged list to server
        if (localHasUnsynced || (serverItems.length === 0 && resolved.length > 0)) {
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
    if (!movieId) return false;
    const target = String(movieId).trim().toLowerCase();
    const tombstones = this.getTombstones();
    if (tombstones.has(target)) return false;

    return this.load().some((m) => {
      const id = String(m.id || "").trim().toLowerCase();
      const slug = String(m.slug || "").trim().toLowerCase();
      return (id && id === target) || (slug && slug === target);
    });
  }

  public add(movie: Movie): void {
    if (!movie) return;
    const targetId = String(movie.id || "").trim().toLowerCase();
    const targetSlug = String(movie.slug || "").trim().toLowerCase();

    // Clear from tombstones since user explicitly added it
    if (targetId) this.removeTombstone(targetId);
    if (targetSlug) this.removeTombstone(targetSlug);

    const current = this.load();
    if (current.some((m) => (m.id && m.id === movie.id) || (m.slug && m.slug === movie.slug))) {
      return;
    }
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
    if (!movieId) return;
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
    if (!movie) return false;
    const targetId = movie.id || movie.slug;
    if (this.has(targetId)) {
      this.remove(targetId);
      return false;
    } else {
      this.add(movie);
      return true;
    }
  }

  public clear(): void {
    this.save([]);
    this.clearTombstones();

    if (typeof window !== "undefined") {
      try {
        const key = this.getStorageKey();
        localStorage.removeItem(key);
      } catch {}

      if (this.currentUserId) {
        fetch("/api/user/favorites", {
          method: "DELETE",
          headers: getAuthHeaders(),
          credentials: "include",
        }).catch(() => {});
      }
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

