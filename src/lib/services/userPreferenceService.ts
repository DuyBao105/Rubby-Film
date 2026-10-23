import { User, UserPreferences } from "@/types/user";

export interface IUserPreferenceService {
  getUser(): User;
  updateUser(updates: Partial<User>): void;
  getPreferences(): UserPreferences;
  updatePreferences(updates: Partial<UserPreferences>): void;
  subscribe(callback: (prefs: UserPreferences, user: User) => void): () => void;
  setUser(userId: string | null): void;
  syncWithServer(): Promise<void>;
}

const USER_KEY = "rubbyfilm_user_profile";
const PREFS_KEY = "rubbyfilm_user_preferences";

const DEFAULT_USER: User = {
  id: "usr_guest_vip",
  name: "Thành Viên VIP Cinema",
  email: "cinema_vip_user@rubyfilm.io",
  avatarUrl: "",
  isVip: true,
  vipExpiresAt: null,
  createdAt: Date.now(),
};

const DEFAULT_PREFERENCES: UserPreferences = {
  defaultQuality: "4k",
  autoNext: true,
  preferredLanguage: "vietsub",
  volume: 1,
  autoSkipIntro: false,
  skipIntroDuration: 85,
};

function getAuthHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
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

class UserPreferenceService implements IUserPreferenceService {
  private userCache: User | null = null;
  private prefsCache: UserPreferences | null = null;
  private listeners: Set<(prefs: UserPreferences, user: User) => void> = new Set();
  private currentUserId: string | null = null;
  private lastAutoSyncTime = 0;
  private syncPromise: Promise<void> | null = null;
  private lastSyncTime = 0;

  constructor() {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("rubbyfilm_cached_user");
        if (cached) {
          const parsed = JSON.parse(cached) as { id?: string } | null;
          if (parsed?.id) {
            this.currentUserId = String(parsed.id).trim();
            this.syncWithServer().catch(() => {});
          }
        }
      } catch {}

      // Cross-device sync: auto re-sync when switching back to tab/browser window or PWA app
      const triggerAutoSync = () => {
        const now = Date.now();
        if (now - this.lastAutoSyncTime > 15000 && this.currentUserId) {
          this.lastAutoSyncTime = now;
          this.syncWithServer().catch(() => {});
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
    if (!changed) return;
    this.currentUserId = normalized;
    this.userCache = null;
    this.prefsCache = null;
    this.notify();
    if (normalized) {
      this.syncWithServer().catch(() => {});
    }
  }

  private getUserStorageKey(): string {
    if (!this.currentUserId) return "rubbyfilm_user_profile_guest";
    return `rubbyfilm_user_profile_${this.currentUserId}`;
  }

  private getStorageKey(): string {
    if (!this.currentUserId) return "rubbyfilm_user_preferences_guest";
    return `${PREFS_KEY}_${this.currentUserId}`;
  }

  public getUser(): User {
    if (!this.isClient()) return DEFAULT_USER;
    if (this.userCache !== null) return this.userCache;

    try {
      const key = this.getUserStorageKey();
      const raw = localStorage.getItem(key);
      if (raw) {
        this.userCache = { ...DEFAULT_USER, ...JSON.parse(raw) };
        return this.userCache!;
      }
    } catch (e) {
      console.error("[UserPreferenceService] Failed to load user:", e);
    }

    this.userCache = DEFAULT_USER;
    return this.userCache;
  }

  public updateUser(updates: Partial<User>): void {
    const current = this.getUser();
    const updated: User = { ...current, ...updates };
    this.userCache = updated;

    if (this.isClient()) {
      try {
        const key = this.getUserStorageKey();
        localStorage.setItem(key, JSON.stringify(updated));
      } catch (e) {
        console.error("[UserPreferenceService] Failed to save user:", e);
      }
    }
    this.notify();
  }

  public getPreferences(): UserPreferences {
    if (!this.isClient()) return DEFAULT_PREFERENCES;
    if (this.prefsCache !== null) return this.prefsCache;

    try {
      const key = this.getStorageKey();
      const raw = localStorage.getItem(key);
      if (raw) {
        this.prefsCache = { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
        return this.prefsCache!;
      }
    } catch (e) {
      console.error("[UserPreferenceService] Failed to load preferences:", e);
    }

    this.prefsCache = DEFAULT_PREFERENCES;
    return this.prefsCache;
  }

  public updatePreferences(updates: Partial<UserPreferences>): void {
    const current = this.getPreferences();
    const updated: UserPreferences = { ...current, ...updates };
    this.prefsCache = updated;

    if (this.isClient()) {
      try {
        localStorage.setItem(this.getStorageKey(), JSON.stringify(updated));
        localStorage.setItem(PREFS_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error("[UserPreferenceService] Failed to save preferences:", e);
      }

      // Synchronize to cloud database when logged in
      if (this.currentUserId) {
        fetch("/api/user/preferences", {
          method: "POST",
          headers: getAuthHeaders(),
          credentials: "include",
          body: JSON.stringify(updates),
        }).catch((err) => {
          console.warn("[UserPreferenceService] Cloud save failed:", err);
        });
      }
    }
    this.notify();
  }

  public async syncWithServer(): Promise<void> {
    if (!this.isClient() || !this.currentUserId) return;
    if (this.syncPromise) return this.syncPromise;

    const now = Date.now();
    if (now - this.lastSyncTime < 8000) return;
    this.lastSyncTime = now;

    this.syncPromise = (async () => {
      try {
        const res = await fetch(`/api/user/preferences?_t=${Date.now()}`, {
          method: "GET",
          headers: getAuthHeaders(),
          credentials: "include",
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data?.preferences) {
            const serverPrefs = json.data.preferences as UserPreferences;
            const current = this.getPreferences();
            const merged: UserPreferences = { ...current, ...serverPrefs };
            this.prefsCache = merged;
            try {
              localStorage.setItem(this.getStorageKey(), JSON.stringify(merged));
              localStorage.setItem(PREFS_KEY, JSON.stringify(merged));
            } catch {}
            this.notify();
          }
        }
      } catch (err) {
        console.warn("[UserPreferenceService] syncWithServer failed:", err);
      } finally {
        this.syncPromise = null;
      }
    })();

    return this.syncPromise;
  }

  private notify(): void {
    const user = this.getUser();
    const prefs = this.getPreferences();
    this.listeners.forEach((fn) => {
      try {
        fn(prefs, user);
      } catch (e) {
        console.error("[UserPreferenceService] Listener error:", e);
      }
    });
  }

  public subscribe(callback: (prefs: UserPreferences, user: User) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }
}

export const userPreferenceService = new UserPreferenceService();
