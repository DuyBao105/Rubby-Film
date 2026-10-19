"use client";

import { useState, useEffect, useCallback } from "react";
import { Movie } from "@/types/movie";
import { myListService } from "@/lib/services/myListService";
import { useAuth } from "@/lib/auth/authContext";
import { useToast } from "@/components/ui/toast";

export function useMyList() {
  const { user } = useAuth();
  const toast = useToast();
  const [list, setList] = useState<Movie[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Initial fetch from service
    setList(myListService.getList());
    setIsLoaded(true);
    if (user?.id) {
      myListService.syncWithServer(true);
    }

    // Subscribe to cross-component updates
    const unsubscribe = myListService.subscribe((updated) => {
      setList(updated);
    });

    return unsubscribe;
  }, [user]);

  const addMovie = useCallback(
    (movie: Movie) => {
      myListService.add(movie);
      if (user) {
        toast.success("Đã thêm vào yêu thích", `"${movie.title}" đã được lưu vào danh sách.`);
      } else {
        toast.success(
          "Đã thêm vào yêu thích",
          `"${movie.title}" đã lưu trên máy. Đăng nhập để đồng bộ qua điện thoại!`
        );
      }
    },
    [user, toast]
  );

  const removeMovie = useCallback(
    (id: string) => {
      myListService.remove(id);
      toast.info("Đã xóa khỏi yêu thích", "Phim đã được gỡ khỏi danh sách yêu thích.");
    },
    [toast]
  );

  const toggleMovie = useCallback(
    (movie: Movie) => {
      const added = myListService.toggle(movie);
      if (added) {
        if (user) {
          toast.success("Đã thêm vào yêu thích", `"${movie.title}" đã được lưu vào danh sách.`);
        } else {
          toast.success(
            "Đã thêm vào yêu thích",
            `"${movie.title}" đã lưu trên máy. Đăng nhập để đồng bộ qua điện thoại!`
          );
        }
      } else {
        toast.info("Đã xóa khỏi yêu thích", `"${movie.title}" đã được gỡ khỏi danh sách.`);
      }
      return added;
    },
    [user, toast]
  );

  const isInList = useCallback(
    (id: string): boolean => {
      return myListService.has(id);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [list]
  );

  const clearList = useCallback(() => {
    myListService.clear();
  }, []);

  return {
    list,
    isLoaded,
    addMovie,
    removeMovie,
    toggleMovie,
    isInList,
    clearList,
  };
}

