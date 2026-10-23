"use client";

import { useState, useEffect, useCallback } from "react";
import { Movie } from "@/types/movie";
import { myListService } from "@/lib/services/myListService";
import { useAuth } from "@/lib/auth/authContext";
import { useToast } from "@/components/ui/toast";

export function useMyList() {
  const { user, isAuthenticated, openAuthModal } = useAuth();
  const toast = useToast();
  const [list, setList] = useState<Movie[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Only load list if authenticated
    if (isAuthenticated && user?.id) {
      setList(myListService.getList());
      myListService.syncWithServer(false);
    } else {
      setList([]);
    }
    setIsLoaded(true);

    // Subscribe to cross-component updates
    const unsubscribe = myListService.subscribe((updated) => {
      if (isAuthenticated && user?.id) {
        setList(updated);
      }
    });

    return unsubscribe;
  }, [user?.id, isAuthenticated]);

  const addMovie = useCallback(
    (movie: Movie) => {
      if (!isAuthenticated && !user) {
        toast.warning(
          "Yêu cầu đăng nhập",
          "Vui lòng đăng nhập tài khoản để lưu phim vào danh sách yêu thích!"
        );
        openAuthModal("login");
        return;
      }
      myListService.add(movie);
      toast.success("Đã thêm vào yêu thích", `"${movie.title}" đã được lưu vào danh sách.`);
    },
    [user, isAuthenticated, openAuthModal, toast]
  );

  const removeMovie = useCallback(
    (id: string) => {
      if (!isAuthenticated && !user) {
        toast.warning(
          "Yêu cầu đăng nhập",
          "Vui lòng đăng nhập tài khoản để thao tác danh sách yêu thích!"
        );
        openAuthModal("login");
        return;
      }
      myListService.remove(id);
      toast.info("Đã xóa khỏi yêu thích", "Phim đã được gỡ khỏi danh sách yêu thích.");
    },
    [user, isAuthenticated, openAuthModal, toast]
  );

  const toggleMovie = useCallback(
    (movie: Movie) => {
      if (!isAuthenticated && !user) {
        toast.warning(
          "Yêu cầu đăng nhập",
          "Vui lòng đăng nhập tài khoản để lưu phim vào danh sách yêu thích!"
        );
        openAuthModal("login");
        return false;
      }
      const added = myListService.toggle(movie);
      if (added) {
        toast.success("Đã thêm vào yêu thích", `"${movie.title}" đã được lưu vào danh sách.`);
      } else {
        toast.info("Đã xóa khỏi yêu thích", `"${movie.title}" đã được gỡ khỏi danh sách.`);
      }
      return added;
    },
    [user, isAuthenticated, openAuthModal, toast]
  );

  const isInList = useCallback(
    (id: string): boolean => {
      if (!isAuthenticated && !user) return false;
      return myListService.has(id);
    },
    [list, isAuthenticated, user]
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

