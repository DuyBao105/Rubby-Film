"use client";

import { useState, useEffect, useCallback } from "react";
import { Movie } from "@/types/movie";
import { WatchHistoryItem, EpisodeWatchedState } from "@/types/user";
import { watchHistoryService } from "@/lib/services/watchHistoryService";

export function useWatchHistory() {
  const [history, setHistory] = useState<WatchHistoryItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Initial fetch from service
    setHistory(watchHistoryService.getHistory());
    setIsLoaded(true);

    // Subscribe to cross-component updates
    const unsubscribe = watchHistoryService.subscribe((updated) => {
      setHistory(updated);
    });

    return unsubscribe;
  }, []);

  const updateProgress = useCallback(
    (
      movie: Movie,
      progressSeconds: number,
      durationSeconds: number,
      episode?: { id: string; episodeNumber: number; name: string },
      immediate?: boolean
    ) => {
      watchHistoryService.updateProgress(movie, progressSeconds, durationSeconds, episode, immediate);
    },
    []
  );

  const removeFromHistory = useCallback((movieId: string) => {
    watchHistoryService.removeFromHistory(movieId);
  }, []);

  const clearHistory = useCallback(() => {
    watchHistoryService.clear();
  }, []);

  const getMovieProgress = useCallback(
    (movieId: string): WatchHistoryItem | undefined => {
      return watchHistoryService.getMovieProgress(movieId);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [history]
  );

  const getEpisodeProgress = useCallback(
    (movieId: string, episodeNumber: number): EpisodeWatchedState | undefined => {
      return watchHistoryService.getEpisodeProgress(movieId, episodeNumber);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [history]
  );

  const isEpisodeWatched = useCallback(
    (movieId: string, episodeNumber: number): boolean => {
      return watchHistoryService.isEpisodeWatched(movieId, episodeNumber);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [history]
  );

  const getRecentlyViewed = useCallback(
    (limit?: number): WatchHistoryItem[] => {
      return watchHistoryService.getRecentlyViewed(limit);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [history]
  );

  const getContinueWatching = useCallback(
    (limit?: number): WatchHistoryItem[] => {
      return watchHistoryService.getContinueWatching(limit);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [history]
  );

  const sync = useCallback(async () => {
    await watchHistoryService.syncWithServer();
  }, []);

  return {
    history,
    isLoaded,
    updateProgress,
    removeFromHistory,
    clearHistory,
    getMovieProgress,
    getEpisodeProgress,
    isEpisodeWatched,
    getRecentlyViewed,
    getContinueWatching,
    sync,
  };
}
