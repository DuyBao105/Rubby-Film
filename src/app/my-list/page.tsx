"use client";

import * as React from "react";
import { Heart, Trash2 } from "lucide-react";
import { useMyList } from "@/lib/hooks/use-my-list";
import { useAuth } from "@/lib/auth/authContext";
import { MovieGrid } from "@/components/movie/movie-grid";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthSyncBanner } from "@/components/home/auth-sync-banner";

export default function MyListPage() {
  const { user, isAuthenticated, openAuthModal } = useAuth();
  const { list, isLoaded, clearList } = useMyList();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="pt-20 sm:pt-24 pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-6 rounded-full bg-brand inline-block" />
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Phim Yêu Thích
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-cinema-400">
            Các bộ phim bạn đã thêm vào danh sách yêu thích để thưởng thức
          </p>
        </div>

        {mounted && list.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={clearList}
            className="text-xs text-cinema-400 hover:text-red-400 hover:border-red-500/50 self-start sm:self-auto gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Xóa tất cả</span>
          </Button>
        )}
      </div>

      {!mounted || !isLoaded ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-poster w-full rounded-xl" />
          ))}
        </div>
      ) : list.length > 0 ? (
        <div>
          <div className="text-xs text-cinema-400 mb-4 px-1">
            Tổng cộng <strong className="text-white">{list.length}</strong> phim trong danh sách
          </div>
          <MovieGrid movies={list} />
        </div>
      ) : !user ? (
        <EmptyState
          icon={<Heart className="w-8 h-8 text-[#E50000]" />}
          title="Đăng nhập để xem phim yêu thích"
          description="Vui lòng đăng nhập tài khoản RubyFilm để quản lý và xem lại các bộ phim yêu thích của riêng bạn."
          actionText="Đăng Nhập Ngay"
          onAction={() => openAuthModal("login")}
        />
      ) : (
        <EmptyState
          icon={<Heart className="w-8 h-8 text-cinema-400" />}
          title="Danh sách yêu thích đang trống"
          description="Khám phá kho phim và bấm vào biểu tượng trái tim trên poster để lưu lại những bộ phim yêu thích."
          actionText="Khám Phá Phim Ngay"
          actionHref="/movies"
        />
      )}

      {/* Auth Sync Banner */}
      <div className="mt-12">
        <AuthSyncBanner />
      </div>
    </div>
  );
}
