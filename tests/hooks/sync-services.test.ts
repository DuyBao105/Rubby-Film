// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mergeWatchedEpisodes, watchHistoryService } from "@/lib/services/watchHistoryService";
import { myListService } from "@/lib/services/myListService";
import type { Movie } from "@/types/movie";

const mockMovieA: Movie = {
  id: "movie_a",
  slug: "movie-a",
  title: "Movie A",
  originalTitle: "Movie A",
  description: "",
  posterUrl: "",
  backdropUrl: "",
  year: 2026,
  rating: 8.5,
  duration: "120m",
  country: "",
  countrySlug: "",
  genres: [],
  genreSlugs: [],
  quality: "HD",
  language: "Vietsub",
  type: "single",
};

const mockMovieB: Movie = {
  id: "movie_b",
  slug: "movie-b",
  title: "Movie B",
  originalTitle: "Movie B",
  description: "",
  posterUrl: "",
  backdropUrl: "",
  year: 2026,
  rating: 8.5,
  duration: "120m",
  country: "",
  countrySlug: "",
  genres: [],
  genreSlugs: [],
  quality: "HD",
  language: "Vietsub",
  type: "series",
};

describe("Cross-Device Sync Logic", () => {
  describe("mergeWatchedEpisodes", () => {
    it("preserves episodes watched on different devices", () => {
      const serverEps = {
        1: { progressSeconds: 1500, durationSeconds: 3000, progressPercent: 50, completed: false, watchedAt: 1000 },
      };
      const localEps = {
        2: { progressSeconds: 600, durationSeconds: 3000, progressPercent: 20, completed: false, watchedAt: 2000 },
      };

      const merged = mergeWatchedEpisodes(serverEps, localEps);
      expect(merged[1].progressSeconds).toBe(1500);
      expect(merged[2].progressSeconds).toBe(600);
    });

    it("chooses the episode progress with the newer timestamp", () => {
      const pcEps = {
        1: { progressSeconds: 2400, durationSeconds: 3000, progressPercent: 80, completed: false, watchedAt: 5000 },
      };
      const phoneEps = {
        1: { progressSeconds: 300, durationSeconds: 3000, progressPercent: 10, completed: false, watchedAt: 1000 },
      };

      // Regardless of which is passed first, PC's newer progress wins
      const merged1 = mergeWatchedEpisodes(pcEps, phoneEps);
      expect(merged1[1].progressSeconds).toBe(2400);

      const merged2 = mergeWatchedEpisodes(phoneEps, pcEps);
      expect(merged2[1].progressSeconds).toBe(2400);
    });

    it("picks greater progressSeconds when timestamps are equal", () => {
      const a = {
        1: { progressSeconds: 1200, durationSeconds: 3000, progressPercent: 40, completed: false, watchedAt: 1000 },
      };
      const b = {
        1: { progressSeconds: 1800, durationSeconds: 3000, progressPercent: 60, completed: false, watchedAt: 1000 },
      };

      const merged = mergeWatchedEpisodes(a, b);
      expect(merged[1].progressSeconds).toBe(1800);
    });
  });

  describe("myListService Deletion and Anti-Resurrection", () => {
    beforeEach(() => {
      localStorage.clear();
      const defaultFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: { favorites: [] },
        }),
      });
      vi.stubGlobal("fetch", defaultFetch);
      myListService.setUser("user_test_123");
    });

    it("removes movie and does not resurrect it during server sync", async () => {
      // Setup initial list with movie A
      myListService.add(mockMovieA);
      expect(myListService.has("movie_a")).toBe(true);

      // User deletes movie A
      myListService.remove("movie_a");
      expect(myListService.has("movie_a")).toBe(false);

      // Server sync responds without movie A
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: { favorites: [] },
        }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await myListService.syncWithServer(true);

      // Movie A must NOT be resurrected
      expect(myListService.has("movie_a")).toBe(false);
      expect(myListService.getList()).toHaveLength(0);
    });

    it("tombstone filters out movie even if server temporarily returns stale record", async () => {
      // User removes movie B
      myListService.add(mockMovieB);
      myListService.remove("movie_b");

      // Server returns stale movie B due to temporary replication lag
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: { favorites: [mockMovieB] },
        }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await myListService.syncWithServer(true);

      // Tombstone ensures it remains deleted on client
      expect(myListService.has("movie_b")).toBe(false);
      expect(myListService.getList()).toHaveLength(0);
    });

    it("retains locally added favorites when server returns empty list (prevents disappearing bug)", async () => {
      myListService.add(mockMovieA);
      expect(myListService.has("movie_a")).toBe(true);

      // Server returns empty list (e.g. fresh container or DB quota error)
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: { favorites: [] },
        }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await myListService.syncWithServer(true);

      // Local addition must be retained, NOT erased!
      expect(myListService.has("movie_a")).toBe(true);
      expect(myListService.getList()).toHaveLength(1);
      expect(myListService.getList()[0].id).toBe("movie_a");
    });

    it("supports guest favorites and migrates them upon login", () => {
      myListService.setUser(null);
      expect(myListService.getList()).toHaveLength(0);

      // Guest adds movie A
      myListService.add(mockMovieA);
      expect(myListService.has("movie_a")).toBe(true);

      // User logs in
      myListService.setUser("user_logged_in_456");
      expect(myListService.has("movie_a")).toBe(true);
      expect(myListService.getList()).toHaveLength(1);
    });
  });

  describe("searchHistoryService Guest and Retention", () => {
    it("allows adding searches and migrates guest searches on login", async () => {
      const { searchHistoryService } = await import("@/lib/services/searchHistoryService");
      localStorage.clear();
      searchHistoryService.setUser(null);

      searchHistoryService.addSearch("dune 2");
      expect(searchHistoryService.getSearches()).toContain("dune 2");

      // User logs in
      searchHistoryService.setUser("user_search_789");
      expect(searchHistoryService.getSearches()).toContain("dune 2");
    });

    it("prevents deleted search terms from resurrecting during server sync", async () => {
      const { searchHistoryService } = await import("@/lib/services/searchHistoryService");
      localStorage.clear();
      searchHistoryService.setUser("user_search_789");

      searchHistoryService.addSearch("avatar");
      expect(searchHistoryService.getSearches()).toContain("avatar");

      // User removes "avatar"
      searchHistoryService.removeSearch("avatar");
      expect(searchHistoryService.getSearches()).not.toContain("avatar");

      // Server returns stale "avatar" due to lag/out-of-order sync
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: { searches: ["avatar"] },
        }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await searchHistoryService.syncWithServer(true);

      // "avatar" must NOT be resurrected
      expect(searchHistoryService.getSearches()).not.toContain("avatar");
    });
  });

  describe("watchHistoryService Deletion and Anti-Resurrection", () => {
    it("prevents deleted watch history item from resurrecting during server sync", async () => {
      localStorage.clear();
      watchHistoryService.setUser("user_history_123");

      watchHistoryService.updateProgress(mockMovieA, 600, 3600, undefined, true);
      expect(watchHistoryService.getHistory()).toHaveLength(1);

      // User removes movie A from history
      watchHistoryService.removeFromHistory("movie_a");
      expect(watchHistoryService.getHistory()).toHaveLength(0);

      // Server still returns stale movie A
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            history: [
              {
                movieId: "movie_a",
                slug: "movie-a",
                title: "Movie A",
                progressSeconds: 600,
                durationSeconds: 3600,
                progressPercent: 17,
                watchedAt: Date.now() - 5000,
              },
            ],
          },
        }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await watchHistoryService.syncWithServer(true);

      // movie A must NOT be resurrected
      expect(watchHistoryService.getHistory()).toHaveLength(0);
    });
  });
});


