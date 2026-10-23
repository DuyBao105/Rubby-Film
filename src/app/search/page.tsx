import { Suspense } from "react";
import { SearchPageView } from "@/components/search/search-page-view";
import { Skeleton } from "@/components/ui/skeleton";
import { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tìm Kiếm Phim - RubyFilm",
  description: "Tìm kiếm hàng ngàn bộ phim điện ảnh, phim truyền hình, anime với hệ thống lọc thông minh.",
  robots: {
    index: false,
    follow: true,
  },
};

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="pt-20 sm:pt-24 pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Skeleton className="h-10 w-64 mx-auto mb-4" />
          <Skeleton className="h-12 w-full max-w-xl mx-auto rounded-xl" />
        </div>
      }
    >
      <SearchPageView />
    </Suspense>
  );
}
