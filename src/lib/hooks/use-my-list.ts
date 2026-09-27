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

    // Subscribe to cross-component updates
    const unsubscribe = myListService.subscribe((updated) => {
      setList(updated);
    });

    return unsubscribe;
  }, []);

  const addMovie = useCallback((movie: Movie) => {
    if (!user) {
      toast.info("Oop!", "Bạn hãy đăng nhập để thêm vào danh sách yêu thích nha!");
      return;
    }
    myListService.add(movie);
    toast.success("Đã thêm vào yêu thích", `"${movie.title}" đã được lưu vào danh sách.`);
  }, [user, toast]);

  const removeMovie = useCallback((id: string) => {
    if (!user) {
      toast.info("Oop!", "Bạn hãy đăng nhập để thêm vào danh sách yêu thích nha!");
      return;
    }
    myListService.remove(id);
    toast.info("Đã xóa khỏi yêu thích", "Phim đã được gỡ khỏi danh sách yêu thích.");
  }, [user, toast]);

  const toggleMovie = useCallback((movie: Movie) => {
    if (!user) {
      toast.info("Oop!", "Bạn hãy đăng nhập để thêm vào danh sách yêu thích nha!");
      return false;
    }
    const added = myListService.toggle(movie);
    if (added) {
      toast.success("Đã thêm vào yêu thích", `"${movie.title}" đã được lưu vào danh sách.`);
    } else {
      toast.info("Đã xóa khỏi yêu thích", `"${movie.title}" đã được gỡ khỏi danh sách.`);
    }
    return added;
  }, [user, toast]);

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
