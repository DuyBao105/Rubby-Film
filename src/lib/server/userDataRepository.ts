import fs from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import type { Movie } from "@/types/movie";
import type { WatchHistoryItem, EpisodeWatchedState, UserPreferences } from "@/types/user";

const DEFAULT_PREFERENCES: UserPreferences = {
  defaultQuality: "4k",
  autoNext: true,
  preferredLanguage: "vietsub",
  volume: 1,
  autoSkipIntro: false,
  skipIntroDuration: 85,
};

const DATA_DIR = path.join(process.cwd(), "data");
const TMP_DIR = path.join(process.env.TEMP || process.env.TMP || "/tmp", "rubbyfilm_data");

function getStoragePaths(filename: string): string[] {
  return [
    path.join(DATA_DIR, filename),
    path.join(TMP_DIR, filename),
  ];
}

function readDataFile<T>(filename: string, fallback: T): T {
  for (const filePath of getStoragePaths(filename)) {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf-8");
        return JSON.parse(content) as T;
      }
    } catch {}
  }
  return fallback;
}

function writeDataFile(filename: string, data: any): void {
  for (const filePath of getStoragePaths(filename)) {
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    } catch {}
  }
}

function getSql() {
  const rawUrl = (process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL)
    ?.replace(/^[\uFEFF\s"']+|[\uFEFF\s"']+$/g, "")
    .trim();
  if (!rawUrl) return null;
  try {
    return neon(rawUrl);
  } catch (err) {
    console.error("[userDataRepository] Failed to connect to Neon DB:", err);
    return null;
  }
}

class UserDataRepository {
  private historyMap: Map<string, WatchHistoryItem[]> = new Map();
  private favoritesMap: Map<string, Movie[]> = new Map();
  private searchHistoryMap: Map<string, string[]> = new Map();
  private preferencesMap: Map<string, UserPreferences> = new Map();

  private persistHistoryToFile(): void {
    const obj: Record<string, WatchHistoryItem[]> = readDataFile<Record<string, WatchHistoryItem[]>>("watch-history.json", {});
    for (const [userId, items] of this.historyMap.entries()) {
      obj[userId] = items;
    }
    writeDataFile("watch-history.json", obj);
  }

  private persistFavoritesToFile(): void {
    const obj: Record<string, Movie[]> = readDataFile<Record<string, Movie[]>>("favorites.json", {});
    for (const [userId, items] of this.favoritesMap.entries()) {
      obj[userId] = items;
    }
    writeDataFile("favorites.json", obj);
  }

  private persistSearchToFile(): void {
    const obj: Record<string, string[]> = readDataFile<Record<string, string[]>>("search-history.json", {});
    for (const [userId, items] of this.searchHistoryMap.entries()) {
      obj[userId] = items;
    }
    writeDataFile("search-history.json", obj);
  }

  private persistPreferencesToFile(): void {
    const obj: Record<string, UserPreferences> = readDataFile<Record<string, UserPreferences>>("user-preferences.json", {});
    for (const [userId, prefs] of this.preferencesMap.entries()) {
      obj[userId] = prefs;
    }
    writeDataFile("user-preferences.json", obj);
  }

  // --- Watch History ---

  public async getWatchHistory(userId: string): Promise<WatchHistoryItem[]> {
    if (!userId) return [];
    const sql = getSql();

    if (sql) {
      try {
        const rows = (await sql.query(
          `SELECT 
            movie_id, movie_slug, movie_title, poster_url, backdrop_url,
            episode_id, episode_number, episode_name, progress_seconds,
            duration_seconds, progress_percent, completed, watched_episodes,
            movie_data, watched_at
           FROM user_watch_history
           WHERE user_id = $1
           ORDER BY updated_at DESC
           LIMIT 50`,
          [userId]
        )) as any[];

        const items: WatchHistoryItem[] = rows.map((r) => {
          let watchedEpisodes: Record<number, EpisodeWatchedState> = {};
          try {
            watchedEpisodes =
              typeof r.watched_episodes === "string"
                ? JSON.parse(r.watched_episodes)
                : r.watched_episodes || {};
          } catch {}

          let movieData: Movie | undefined = undefined;
          try {
            movieData =
              typeof r.movie_data === "string"
                ? JSON.parse(r.movie_data)
                : r.movie_data || undefined;
          } catch {}

          const fallbackMovie: Movie = {
            id: String(r.movie_id || r.movie_slug || ""),
            slug: String(r.movie_slug || ""),
            title: String(r.movie_title || ""),
            originalTitle: String(r.movie_title || ""),
            description: "",
            posterUrl: String(r.poster_url || ""),
            backdropUrl: r.backdrop_url || String(r.poster_url || ""),
            year: new Date().getFullYear(),
            rating: 8.5,
            duration: "",
            country: "",
            countrySlug: "",
            genres: [],
            genreSlugs: [],
            quality: "HD",
            language: "Vietsub",
            type: "single",
          };

          const resolvedMovie: Movie = (movieData && movieData.id) ? movieData : fallbackMovie;

          return {
            movieId: String(r.movie_id || r.movie_slug || ""),
            slug: String(r.movie_slug || ""),
            title: String(r.movie_title || ""),
            posterUrl: String(r.poster_url || resolvedMovie.posterUrl || ""),
            backdropUrl: r.backdrop_url || resolvedMovie.backdropUrl || undefined,
            movie: resolvedMovie,
            episodeId: r.episode_id || undefined,
            episodeNumber: r.episode_number ? Number(r.episode_number) : undefined,
            episodeName: r.episode_name || undefined,
            progressSeconds: Number(r.progress_seconds || 0),
            durationSeconds: Number(r.duration_seconds || 0),
            progressPercent: Number(r.progress_percent || 0),
            completed: Boolean(r.completed),
            watchedAt: Number(r.watched_at || 0),
            watchedEpisodes,
          };
        });

        this.historyMap.set(userId, items);
        this.persistHistoryToFile();
        return items;
      } catch (err) {
        console.error("[userDataRepository] getWatchHistory error (fallback to local):", (err as any)?.message || err);
      }
    }

    if (this.historyMap.has(userId)) {
      return this.historyMap.get(userId) || [];
    }

    const fileStore = readDataFile<Record<string, WatchHistoryItem[]>>("watch-history.json", {});
    const items = fileStore[userId] || [];
    this.historyMap.set(userId, items);
    return items;
  }

  public async saveWatchHistory(userId: string, items: WatchHistoryItem[]): Promise<WatchHistoryItem[]> {
    if (!userId) return [];

    // Deduplicate incoming items
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
    this.persistHistoryToFile();

    const sql = getSql();
    if (sql) {
      try {
        for (const item of capped) {
          const movieId = String(item.movieId || item.movie?.id || item.slug || "").trim();
          const movieSlug = String(item.slug || item.movie?.slug || movieId).trim();
          const movieTitle = String(item.title || item.movie?.title || movieSlug).trim();
          const id = `uwh_${userId}_${movieId}`;
          const now = Number(item.watchedAt || Date.now());

          await sql.query(
            `INSERT INTO user_watch_history (
              id, user_id, movie_id, movie_slug, movie_title, poster_url, backdrop_url,
              episode_id, episode_number, episode_name, progress_seconds, duration_seconds,
              progress_percent, completed, watched_episodes, movie_data, watched_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
            )
            ON CONFLICT (user_id, movie_id) DO UPDATE SET
              movie_slug = EXCLUDED.movie_slug,
              movie_title = EXCLUDED.movie_title,
              poster_url = COALESCE(EXCLUDED.poster_url, user_watch_history.poster_url),
              backdrop_url = COALESCE(EXCLUDED.backdrop_url, user_watch_history.backdrop_url),
              episode_id = EXCLUDED.episode_id,
              episode_number = EXCLUDED.episode_number,
              episode_name = EXCLUDED.episode_name,
              progress_seconds = EXCLUDED.progress_seconds,
              duration_seconds = EXCLUDED.duration_seconds,
              progress_percent = EXCLUDED.progress_percent,
              completed = EXCLUDED.completed,
              watched_episodes = EXCLUDED.watched_episodes,
              movie_data = COALESCE(EXCLUDED.movie_data, user_watch_history.movie_data),
              watched_at = EXCLUDED.watched_at,
              updated_at = EXCLUDED.updated_at`,
            [
              id,
              userId,
              movieId,
              movieSlug,
              movieTitle,
              item.posterUrl || item.movie?.posterUrl || null,
              item.backdropUrl || item.movie?.backdropUrl || null,
              item.episodeId || null,
              item.episodeNumber ? Number(item.episodeNumber) : null,
              item.episodeName || null,
              Number(item.progressSeconds || 0),
              Number(item.durationSeconds || 0),
              Number(item.progressPercent || 0),
              Boolean(item.completed),
              JSON.stringify(item.watchedEpisodes || {}),
              item.movie ? JSON.stringify(item.movie) : null,
              now,
              now,
            ]
          );
        }
      } catch (err) {
        console.error("[userDataRepository] saveWatchHistory error:", (err as any)?.message || err);
      }
    }

    return capped;
  }

  public async updateWatchProgress(
    userId: string,
    movie: Movie,
    progressSeconds: number,
    durationSeconds: number,
    episode?: { id: string; episodeNumber: number; name: string },
    clientWatchedAt?: number
  ): Promise<WatchHistoryItem[]> {
    if (!userId || !movie || !durationSeconds || durationSeconds <= 0) {
      return this.getWatchHistory(userId);
    }

    const currentList = await this.getWatchHistory(userId);
    const progressPercent = Math.min(100, Math.round((progressSeconds / durationSeconds) * 100));
    const epNum = episode?.episodeNumber ?? 1;
    const isCompleted = progressPercent >= 90;
    const now = clientWatchedAt || Date.now();

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

    const updated = [newItem, ...filtered].slice(0, 50);
    this.historyMap.set(userId, updated);
    this.persistHistoryToFile();

    const sql = getSql();
    if (sql) {
      try {
        const id = `uwh_${userId}_${movie.id}`;
        await sql.query(
          `INSERT INTO user_watch_history (
            id, user_id, movie_id, movie_slug, movie_title, poster_url, backdrop_url,
            episode_id, episode_number, episode_name, progress_seconds, duration_seconds,
            progress_percent, completed, watched_episodes, movie_data, watched_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
          )
          ON CONFLICT (user_id, movie_id) DO UPDATE SET
            movie_slug = EXCLUDED.movie_slug,
            movie_title = EXCLUDED.movie_title,
            poster_url = COALESCE(EXCLUDED.poster_url, user_watch_history.poster_url),
            backdrop_url = COALESCE(EXCLUDED.backdrop_url, user_watch_history.backdrop_url),
            episode_id = EXCLUDED.episode_id,
            episode_number = EXCLUDED.episode_number,
            episode_name = EXCLUDED.episode_name,
            progress_seconds = EXCLUDED.progress_seconds,
            duration_seconds = EXCLUDED.duration_seconds,
            progress_percent = EXCLUDED.progress_percent,
            completed = EXCLUDED.completed,
            watched_episodes = EXCLUDED.watched_episodes,
            movie_data = COALESCE(EXCLUDED.movie_data, user_watch_history.movie_data),
            watched_at = EXCLUDED.watched_at,
            updated_at = EXCLUDED.updated_at`,
          [
            id,
            userId,
            movie.id,
            movie.slug,
            movie.title,
            movie.posterUrl || null,
            movie.backdropUrl || null,
            episode?.id || null,
            episode?.episodeNumber ? Number(episode.episodeNumber) : null,
            episode?.name || null,
            Math.round(progressSeconds),
            Math.round(durationSeconds),
            progressPercent,
            isCompleted,
            JSON.stringify(updatedWatched),
            JSON.stringify(movie),
            now,
            now,
          ]
        );
      } catch (err) {
        console.error("[userDataRepository] updateWatchProgress error:", (err as any)?.message || err);
      }
    }

    return updated;
  }

  public async removeWatchHistory(userId: string, movieIdOrSlug: string): Promise<WatchHistoryItem[]> {
    if (!userId || !movieIdOrSlug) return this.getWatchHistory(userId);
    const target = String(movieIdOrSlug).trim().toLowerCase();
    const current = await this.getWatchHistory(userId);
    const updated = current.filter((item) => {
      const id = String(item.movieId || item.movie?.id || "").trim().toLowerCase();
      const slug = String(item.slug || item.movie?.slug || "").trim().toLowerCase();
      return id !== target && slug !== target;
    });

    this.historyMap.set(userId, updated);
    this.persistHistoryToFile();

    const sql = getSql();
    if (sql) {
      try {
        await sql.query(
          `DELETE FROM user_watch_history WHERE user_id = $1 AND (LOWER(movie_id) = $2 OR LOWER(movie_slug) = $2)`,
          [userId, target]
        );
      } catch (err) {
        console.error("[userDataRepository] removeWatchHistory error:", (err as any)?.message || err);
      }
    }
    return updated;
  }

  public async clearWatchHistory(userId: string): Promise<void> {
    if (!userId) return;
    this.historyMap.delete(userId);
    const fileStore = readDataFile<Record<string, WatchHistoryItem[]>>("watch-history.json", {});
    delete fileStore[userId];
    writeDataFile("watch-history.json", fileStore);

    const sql = getSql();
    if (sql) {
      try {
        await sql.query(`DELETE FROM user_watch_history WHERE user_id = $1`, [userId]);
      } catch (err) {
        console.error("[userDataRepository] clearWatchHistory error:", (err as any)?.message || err);
      }
    }
  }

  // --- Favorites / My List ---

  public async getFavorites(userId: string): Promise<Movie[]> {
    if (!userId) return [];
    const sql = getSql();

    if (sql) {
      try {
        const rows = (await sql.query(
          `SELECT movie_data FROM user_favorites WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`,
          [userId]
        )) as any[];

        const items: Movie[] = [];
        for (const r of rows) {
          try {
            const m = typeof r.movie_data === "string" ? JSON.parse(r.movie_data) : r.movie_data;
            if (m && m.id) items.push(m);
          } catch {}
        }
        this.favoritesMap.set(userId, items);
        this.persistFavoritesToFile();
        return items;
      } catch (err) {
        console.error("[userDataRepository] getFavorites error (fallback to local):", (err as any)?.message || err);
      }
    }

    if (this.favoritesMap.has(userId)) {
      return this.favoritesMap.get(userId) || [];
    }
    const fileStore = readDataFile<Record<string, Movie[]>>("favorites.json", {});
    const items = fileStore[userId] || [];
    this.favoritesMap.set(userId, items);
    return items;
  }

  public async saveFavorites(userId: string, items: Movie[]): Promise<Movie[]> {
    if (!userId) return [];
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
    this.persistFavoritesToFile();

    const sql = getSql();
    if (sql) {
      try {
        if (capped.length === 0) {
          await sql.query(`DELETE FROM user_favorites WHERE user_id = $1`, [userId]);
        } else {
          const ids = capped.map((m) => String(m.id || m.slug));
          // Remove favorites no longer in the list
          await sql.query(
            `DELETE FROM user_favorites WHERE user_id = $1 AND NOT (movie_id = ANY($2) OR movie_slug = ANY($2))`,
            [userId, ids]
          );
          // Upsert current items
          for (const movie of capped) {
            const id = `fav_${userId}_${movie.id}`;
            await sql.query(
              `INSERT INTO user_favorites (id, user_id, movie_id, movie_slug, movie_data, created_at)
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT (user_id, movie_id) DO UPDATE SET
                 movie_slug = EXCLUDED.movie_slug,
                 movie_data = EXCLUDED.movie_data`,
              [id, userId, movie.id, movie.slug, JSON.stringify(movie), Date.now()]
            );
          }
        }
      } catch (err) {
        console.error("[userDataRepository] saveFavorites error:", (err as any)?.message || err);
      }
    }
    return capped;
  }

  public async addFavorite(userId: string, movie: Movie): Promise<Movie[]> {
    if (!userId || !movie) return this.getFavorites(userId);
    const current = await this.getFavorites(userId);
    if (current.some((m) => m.id === movie.id || m.slug === movie.slug)) {
      return current;
    }
    const updated = [movie, ...current].slice(0, 100);
    this.favoritesMap.set(userId, updated);
    this.persistFavoritesToFile();

    const sql = getSql();
    if (sql) {
      try {
        const id = `fav_${userId}_${movie.id}`;
        await sql.query(
          `INSERT INTO user_favorites (id, user_id, movie_id, movie_slug, movie_data, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (user_id, movie_id) DO UPDATE SET
             movie_slug = EXCLUDED.movie_slug,
             movie_data = EXCLUDED.movie_data`,
          [id, userId, movie.id, movie.slug, JSON.stringify(movie), Date.now()]
        );
      } catch (err) {
        console.error("[userDataRepository] addFavorite error:", (err as any)?.message || err);
      }
    }
    return updated;
  }

  public async removeFavorite(userId: string, movieId: string): Promise<Movie[]> {
    if (!userId || !movieId) return this.getFavorites(userId);
    const target = String(movieId).trim().toLowerCase();
    const current = await this.getFavorites(userId);
    const updated = current.filter((m) => {
      const id = String(m.id || "").trim().toLowerCase();
      const slug = String(m.slug || "").trim().toLowerCase();
      return id !== target && slug !== target;
    });

    this.favoritesMap.set(userId, updated);
    this.persistFavoritesToFile();

    const sql = getSql();
    if (sql) {
      try {
        await sql.query(
          `DELETE FROM user_favorites WHERE user_id = $1 AND (LOWER(movie_id) = $2 OR LOWER(movie_slug) = $2)`,
          [userId, target]
        );
      } catch (err) {
        console.error("[userDataRepository] removeFavorite error:", (err as any)?.message || err);
      }
    }
    return updated;
  }

  public async clearFavorites(userId: string): Promise<void> {
    if (!userId) return;
    this.favoritesMap.delete(userId);
    const fileStore = readDataFile<Record<string, Movie[]>>("favorites.json", {});
    delete fileStore[userId];
    writeDataFile("favorites.json", fileStore);

    const sql = getSql();
    if (sql) {
      try {
        await sql.query(`DELETE FROM user_favorites WHERE user_id = $1`, [userId]);
      } catch (err) {
        console.error("[userDataRepository] clearFavorites error:", (err as any)?.message || err);
      }
    }
  }

  // --- Search History ---

  public async getSearchHistory(userId: string): Promise<string[]> {
    if (!userId) return [];
    const sql = getSql();

    if (sql) {
      try {
        const rows = (await sql.query(
          `SELECT searches FROM user_search_history WHERE user_id = $1`,
          [userId]
        )) as any[];

        if (rows && rows.length > 0) {
          let list: string[] = [];
          try {
            list = typeof rows[0].searches === "string" ? JSON.parse(rows[0].searches) : rows[0].searches || [];
          } catch {}
          if (Array.isArray(list)) {
            const clean = list.filter((s) => typeof s === "string" && s.trim().length > 0).slice(0, 20);
            this.searchHistoryMap.set(userId, clean);
            this.persistSearchToFile();
            return clean;
          }
        }
      } catch (err) {
        console.error("[userDataRepository] getSearchHistory error:", (err as any)?.message || err);
      }
    }

    if (this.searchHistoryMap.has(userId)) {
      return this.searchHistoryMap.get(userId) || [];
    }
    const fileStore = readDataFile<Record<string, string[]>>("search-history.json", {});
    const list = fileStore[userId] || [];
    this.searchHistoryMap.set(userId, list);
    return list;
  }

  public async saveSearchHistory(userId: string, searches: string[]): Promise<string[]> {
    if (!userId) return [];
    const clean = Array.from(new Set(searches.map((s) => (s || "").trim()).filter(Boolean))).slice(0, 20);
    this.searchHistoryMap.set(userId, clean);
    this.persistSearchToFile();

    const sql = getSql();
    if (sql) {
      try {
        const now = Date.now();
        await sql.query(
          `INSERT INTO user_search_history (user_id, searches, updated_at)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id) DO UPDATE SET
             searches = EXCLUDED.searches,
             updated_at = EXCLUDED.updated_at`,
          [userId, JSON.stringify(clean), now]
        );
      } catch (err) {
        console.error("[userDataRepository] saveSearchHistory error:", (err as any)?.message || err);
      }
    }
    return clean;
  }

  public async addSearchTerm(userId: string, term: string): Promise<string[]> {
    if (!userId || !term) return this.getSearchHistory(userId);
    const cleanTerm = term.trim();
    if (!cleanTerm || cleanTerm.length < 2) return this.getSearchHistory(userId);

    const current = await this.getSearchHistory(userId);
    const filtered = current.filter((s) => s.toLowerCase() !== cleanTerm.toLowerCase());
    const updated = [cleanTerm, ...filtered].slice(0, 20);
    return this.saveSearchHistory(userId, updated);
  }

  public async removeSearchTerm(userId: string, term: string): Promise<string[]> {
    if (!userId || !term) return this.getSearchHistory(userId);
    const cleanTerm = term.trim().toLowerCase();
    const current = await this.getSearchHistory(userId);
    const updated = current.filter((s) => s.toLowerCase() !== cleanTerm);
    return this.saveSearchHistory(userId, updated);
  }

  public async clearSearchHistory(userId: string): Promise<void> {
    if (!userId) return;
    this.searchHistoryMap.delete(userId);
    const fileStore = readDataFile<Record<string, string[]>>("search-history.json", {});
    delete fileStore[userId];
    writeDataFile("search-history.json", fileStore);

    const sql = getSql();
    if (sql) {
      try {
        await sql.query(`DELETE FROM user_search_history WHERE user_id = $1`, [userId]);
      } catch (err) {
        console.error("[userDataRepository] clearSearchHistory error:", (err as any)?.message || err);
      }
    }
  }

  // --- User Preferences (Cloud Sync across Desktop, Mobile, PWA) ---

  public async getPreferences(userId: string): Promise<UserPreferences> {
    if (!userId) return DEFAULT_PREFERENCES;
    const sql = getSql();

    if (sql) {
      try {
        await sql.query(`
          CREATE TABLE IF NOT EXISTS user_preferences (
            user_id text PRIMARY KEY,
            preferences jsonb NOT NULL,
            updated_at bigint NOT NULL
          )
        `);

        const rows = (await sql.query(
          `SELECT preferences FROM user_preferences WHERE user_id = $1`,
          [userId]
        )) as any[];

        if (rows && rows.length > 0) {
          let parsed: any = rows[0].preferences;
          if (typeof parsed === "string") {
            try {
              parsed = JSON.parse(parsed);
            } catch {}
          }
          const merged: UserPreferences = { ...DEFAULT_PREFERENCES, ...(parsed || {}) };
          this.preferencesMap.set(userId, merged);
          this.persistPreferencesToFile();
          return merged;
        }
      } catch (err) {
        console.error("[userDataRepository] getPreferences error:", (err as any)?.message || err);
      }
    }

    if (this.preferencesMap.has(userId)) {
      return this.preferencesMap.get(userId) || DEFAULT_PREFERENCES;
    }
    const fileStore = readDataFile<Record<string, UserPreferences>>("user-preferences.json", {});
    const prefs = fileStore[userId] ? { ...DEFAULT_PREFERENCES, ...fileStore[userId] } : DEFAULT_PREFERENCES;
    this.preferencesMap.set(userId, prefs);
    return prefs;
  }

  public async savePreferences(userId: string, updates: Partial<UserPreferences>): Promise<UserPreferences> {
    if (!userId) return DEFAULT_PREFERENCES;
    const current = await this.getPreferences(userId);
    const updated: UserPreferences = { ...current, ...updates };
    this.preferencesMap.set(userId, updated);
    this.persistPreferencesToFile();

    const sql = getSql();
    if (sql) {
      try {
        await sql.query(`
          CREATE TABLE IF NOT EXISTS user_preferences (
            user_id text PRIMARY KEY,
            preferences jsonb NOT NULL,
            updated_at bigint NOT NULL
          )
        `);

        const now = Date.now();
        await sql.query(
          `INSERT INTO user_preferences (user_id, preferences, updated_at)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id) DO UPDATE SET
             preferences = EXCLUDED.preferences,
             updated_at = EXCLUDED.updated_at`,
          [userId, JSON.stringify(updated), now]
        );
      } catch (err) {
        console.error("[userDataRepository] savePreferences error:", (err as any)?.message || err);
      }
    }
    return updated;
  }
}

export const userDataRepository = new UserDataRepository();
