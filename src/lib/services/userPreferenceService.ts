import { User, UserPreferences } from "@/types/user";

export interface IUserPreferenceService {
  getUser(): User;
  updateUser(updates: Partial<User>): void;
  getPreferences(): UserPreferences;
  updatePreferences(updates: Partial<UserPreferences>): void;
  subscribe(callback: (prefs: UserPreferences, user: User) => void): () => void;
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
};

class UserPreferenceService implements IUserPreferenceService {
  private userCache: User | null = null;
  private prefsCache: UserPreferences | null = null;
  private listeners: Set<(prefs: UserPreferences, user: User) => void> = new Set();

  private isClient(): boolean {
    return typeof window !== "undefined";
  }

  public getUser(): User {
    if (!this.isClient()) return DEFAULT_USER;
    if (this.userCache !== null) return this.userCache;

    try {
      const raw = localStorage.getItem(USER_KEY);
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
        localStorage.setItem(USER_KEY, JSON.stringify(updated));
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
      const raw = localStorage.getItem(PREFS_KEY);
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
        localStorage.setItem(PREFS_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error("[UserPreferenceService] Failed to save preferences:", e);
      }
    }
    this.notify();
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
