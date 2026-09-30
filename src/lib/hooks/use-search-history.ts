"use client";

import { useState, useEffect, useCallback } from "react";
import { searchHistoryService } from "@/lib/services/searchHistoryService";
import { useAuth } from "@/lib/auth/authContext";

export function useSearchHistory() {
  const { user } = useAuth();
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Sync active user to service
    const userId = user?.id ?? null;
    searchHistoryService.setUser(userId);
    setRecentSearches(searchHistoryService.getSearches());
    setIsLoaded(true);

    const unsubscribe = searchHistoryService.subscribe((updated) => {
      setRecentSearches(updated);
    });

    return unsubscribe;
  }, [user]);

  const addRecentSearch = useCallback((term: string) => {
    searchHistoryService.addSearch(term);
  }, []);

  const removeRecentSearch = useCallback((term: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    searchHistoryService.removeSearch(term);
  }, []);

  const clearRecentSearches = useCallback(() => {
    searchHistoryService.clear();
  }, []);

  const sync = useCallback(async () => {
    await searchHistoryService.syncWithServer(true);
  }, []);

  return {
    recentSearches,
    isLoaded,
    addRecentSearch,
    removeRecentSearch,
    clearRecentSearches,
    sync,
  };
}
