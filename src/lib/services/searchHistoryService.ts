export interface ISearchHistoryService {
  getSearches(): string[];
  addSearch(term: string): void;
  removeSearch(term: string): void;
  clear(): void;
  setUser(userId: string | null): void;
  syncWithServer(force?: boolean): Promise<void>;
  subscribe(callback: (searches: string[]) => void): () => void;
}

const PRIMARY_KEY = "rubbyfilm_recent_searches";
const GUEST_KEY = "rubbyfilm_recent_searches_guest";
const LEGACY_OLD_KEY = "bfilm_recent_searches";

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

class SearchHistoryService implements ISearchHistoryService {
  private cache: string[] | null = null;
  private listeners: Set<(searches: string[]) => void> = new Set();
  private currentUserId: string | null = null;
  private lastAutoSyncTime = 0;
  private syncPromise: Promise<void> | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      try {
        // Migrate legacy shared searches if present
        const legacyPrimary = localStorage.getItem(PRIMARY_KEY);
        const legacyOld = localStorage.getItem(LEGACY_OLD_KEY);
        const raw = legacyPrimary || legacyOld;
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const guestRaw = localStorage.getItem(GUEST_KEY);
            if (!guestRaw) {
              localStorage.setItem(GUEST_KEY, raw);
            }
          }
          localStorage.removeItem(PRIMARY_KEY);
          localStorage.removeItem(LEGACY_OLD_KEY);
        }

        const cached = localStorage.getItem("rubbyfilm_cached_user");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed?.id) {
            this.currentUserId = String(parsed.id).trim();
            this.migrateGuestSearches(this.currentUserId);
            this.syncWithServer(true);
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

  private isClient(): boolean {
    return typeof window !== "undefined";
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
      this.migrateGuestSearches(normalized);
      this.syncWithServer(true);
    }
  }

  private migrateGuestSearches(userId: string): void {
    if (!this.isClient() || !userId) return;
    try {
      const guestRaw = localStorage.getItem(GUEST_KEY);
      if (guestRaw) {
        const guestItems = JSON.parse(guestRaw);
        if (Array.isArray(guestItems) && guestItems.length > 0) {
          const userKey = `rubbyfilm_recent_searches_${userId}`;
          let userItems: string[] = [];
          try {
            const uRaw = localStorage.getItem(userKey);
            if (uRaw) {
              const parsed = JSON.parse(uRaw);
              if (Array.isArray(parsed)) userItems = parsed;
            }
          } catch {}

          const merged = Array.from(
            new Set([...guestItems, ...userItems].map((s) => String(s || "").trim()).filter(Boolean))
          ).slice(0, 20);

          localStorage.setItem(userKey, JSON.stringify(merged));
          localStorage.removeItem(GUEST_KEY);
          this.cache = merged;
          this.notify();

          fetch("/api/user/searches", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...getAuthHeaders(),
            },
            credentials: "include",
            body: JSON.stringify({ searches: merged }),
          }).catch(() => {});
        }
      }
    } catch (e) {
      console.warn("[SearchHistoryService] Failed to migrate guest searches:", e);
    }
  }

  private getStorageKey(): string {
    if (this.currentUserId) {
      return `rubbyfilm_recent_searches_${this.currentUserId}`;
    }
    return GUEST_KEY;
  }

  private load(): string[] {
    if (!this.isClient()) return [];
    if (this.cache !== null) return this.cache;

    try {
      const key = this.getStorageKey();
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.cache = parsed.filter((item) => typeof item === "string" && item.trim().length > 0);
          return this.cache;
        }
      }

      // If user storage is empty, fallback to guest storage if any
      if (this.currentUserId) {
        const guestRaw = localStorage.getItem(GUEST_KEY);
        if (guestRaw) {
          const parsed = JSON.parse(guestRaw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.cache = parsed.filter((item) => typeof item === "string" && item.trim().length > 0);
            return this.cache;
          }
        }
      }
    } catch (e) {
      console.error("[SearchHistoryService] Failed to parse search history:", e);
    }

    this.cache = [];
    return this.cache;
  }

  private save(searches: string[]): void {
    if (!this.isClient()) return;
    this.cache = searches;
    try {
      const key = this.getStorageKey();
      localStorage.setItem(key, JSON.stringify(searches));
    } catch (e) {
      console.error("[SearchHistoryService] Failed to save search history:", e);
    }
    this.notify();
  }

  private notify(): void {
    const current = this.load();
    for (const listener of this.listeners) {
      try {
        listener(current);
      } catch (err) {
        console.error("[SearchHistoryService] Error in listener callback:", err);
      }
    }
  }

  public async syncWithServer(force = false): Promise<void> {
    if (!this.isClient() || !this.currentUserId) return;
    if (this.syncPromise && !force) return this.syncPromise;

    this.syncPromise = (async () => {
      try {
        const res = await fetch("/api/user/searches", {
          headers: getAuthHeaders(),
          credentials: "include",
        });

        if (!res.ok) return;

        const body = (await res.json()) as {
          success?: boolean;
          data?: { searches?: string[] };
        };

        if (!body.success || !Array.isArray(body.data?.searches)) return;

        const serverSearches = body.data.searches;
        const localSearches = this.load();

        // Merge without duplicates, preserving order
        const mergedSet = new Set<string>();
        for (const s of serverSearches) {
          const clean = (s || "").trim();
          if (clean) mergedSet.add(clean);
        }

        let localHasNewer = false;
        for (const l of localSearches) {
          const clean = (l || "").trim();
          if (clean && !mergedSet.has(clean)) {
            mergedSet.add(clean);
            localHasNewer = true;
          }
        }

        const merged = Array.from(mergedSet).slice(0, 20);

        const currentCached = this.cache || [];
        const changed =
          currentCached.length !== merged.length ||
          currentCached.some((s, idx) => s !== merged[idx]);

        this.cache = merged;
        if (this.currentUserId) {
          const key = this.getStorageKey();
          localStorage.setItem(key, JSON.stringify(merged));
        }

        if (changed) {
          this.notify();
        }

        // If local had searches not on server, push merged to server
        if (localHasNewer || (serverSearches.length === 0 && merged.length > 0)) {
          fetch("/api/user/searches", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...getAuthHeaders(),
            },
            credentials: "include",
            body: JSON.stringify({ searches: merged }),
          }).catch(() => {});
        }
      } catch (e) {
        console.warn("[SearchHistoryService] syncWithServer error:", e);
      } finally {
        this.syncPromise = null;
      }
    })();

    return this.syncPromise;
  }

  public getSearches(): string[] {
    return [...this.load()];
  }

  public addSearch(term: string): void {
    const clean = term.trim();
    if (!clean || clean.length < 2) return;

    const current = this.load();
    const filtered = current.filter((s) => s.toLowerCase() !== clean.toLowerCase());
    const updated = [clean, ...filtered].slice(0, 15);
    this.save(updated);

    // Sync to server if logged in
    if (this.currentUserId && this.isClient()) {
      fetch("/api/user/searches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        credentials: "include",
        body: JSON.stringify({ term: clean }),
      }).catch(() => {});
    }
  }

  public removeSearch(term: string): void {
    const clean = term.trim();
    const current = this.load();
    const updated = current.filter((s) => s.toLowerCase() !== clean.toLowerCase());
    this.save(updated);

    if (this.currentUserId && this.isClient()) {
      fetch(`/api/user/searches?term=${encodeURIComponent(clean)}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
        credentials: "include",
      }).catch(() => {});
    }
  }

  public clear(): void {
    this.save([]);

    if (this.isClient()) {
      try {
        localStorage.removeItem(this.getStorageKey());
      } catch {}

      if (this.currentUserId) {
        fetch("/api/user/searches", {
          method: "DELETE",
          headers: getAuthHeaders(),
          credentials: "include",
        }).catch(() => {});
      }
    }
  }

  public subscribe(callback: (searches: string[]) => void): () => void {
    this.listeners.add(callback);
    callback(this.load());
    return () => {
      this.listeners.delete(callback);
    };
  }
}

export const searchHistoryService = new SearchHistoryService();

