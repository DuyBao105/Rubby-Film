"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Clock,
  TrendingUp,
  X,
  Search as SearchIcon,
  AlertTriangle,
  RefreshCw,
  SlidersHorizontal,
  User,
  Film,
} from "lucide-react";
import { SearchBar } from "./search-bar";
import { MovieGrid } from "@/components/movie/movie-grid";
import { EmptyState } from "@/components/ui/empty-state";
import { MovieCardSkeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { Movie, MovieType } from "@/types/movie";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { useSearchHistory } from "@/lib/hooks/use-search-history";

const POPULAR_TAGS = [
  "Phim Chiếu Rạp",
  "Phim Lẻ",
  "Phim Bộ",
  "Hoạt Hình",
  "Phim Hàn Quốc",
  "Mai",
  "Trấn Thành",
  "Lý Hải",
  "Christopher Nolan",
  "Dune",
  "Oppenheimer",
  "Châu Tinh Trì",
];

// Client-side cache for instant pagination and repeated searches
const pageSearchCache = new Map<string, any>();

export function SearchPageView() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read URL params
  const queryParam = searchParams.get("q") || "";
  const directorParam = searchParams.get("director") || "";
  const actorParam = searchParams.get("actor") || "";
  const pageParam = searchParams.get("page");
  const currentPage = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;

  const initialInput = actorParam || directorParam || queryParam;
  const [inputVal, setInputVal] = React.useState(initialInput);
  const [results, setResults] = React.useState<Movie[]>([]);
  const [totalPages, setTotalPages] = React.useState(1);
  const [totalItems, setTotalItems] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(false);
  const [personInfo, setPersonInfo] = React.useState<{
    name: string;
    avatar?: string;
    role: "actor" | "director" | "all";
    roleTitle: string;
    movieCount: number;
  } | null>(null);
  const [errorState, setErrorState] = React.useState<{ code?: string; message?: string } | null>(
    null
  );
  const [searchedQuery, setSearchedQuery] = React.useState(initialInput);

  // User-isolated recent searches
  const {
    recentSearches,
    addRecentSearch,
    removeRecentSearch,
    clearRecentSearches,
  } = useSearchHistory();

  // Filter & Sort states on results
  const [typeFilter, setTypeFilter] = React.useState<MovieType | "all">("all");
  const [sortOption, setSortOption] = React.useState<"default" | "rating" | "year" | "alpha">("default");

  const debouncedVal = useDebounce(inputVal, 300);
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const [isPending, startTransition] = React.useTransition();

  // Sync input value if URL changes via back/forward buttons
  React.useEffect(() => {
    const active = actorParam || directorParam || queryParam;
    setInputVal(active);
  }, [queryParam, directorParam, actorParam]);

  // Perform Search Request
  const performSearch = React.useCallback(
    (q: string, page: number = 1, forceType?: "actor" | "director") => {
      const query = q.trim();

      // Rule: Do not request if empty or single character
      if (!query || query.length < 2) {
        setResults([]);
        setTotalItems(0);
        setTotalPages(1);
        setSearchedQuery("");
        setPersonInfo(null);
        setIsLoading(false);
        setErrorState(null);
        return;
      }

      let requestUrl = `/api/search?q=${encodeURIComponent(query)}&page=${page}&limit=24`;
      if (forceType === "actor" || actorParam) {
        requestUrl = `/api/search?actor=${encodeURIComponent(query)}&page=${page}&limit=24`;
      } else if (forceType === "director" || directorParam) {
        requestUrl = `/api/search?director=${encodeURIComponent(query)}&page=${page}&limit=24`;
      }

      // Check instant client cache
      if (pageSearchCache.has(requestUrl)) {
        const cached = pageSearchCache.get(requestUrl);
        setResults(cached.results);
        setTotalItems(cached.totalItems);
        setTotalPages(cached.totalPages);
        setSearchedQuery(cached.searchedQuery);
        setPersonInfo(cached.personInfo);
        setIsLoading(false);
        setErrorState(null);
        return;
      }

      // Cancel stale previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsLoading(true);
      setErrorState(null);

      fetch(requestUrl, {
        signal: controller.signal,
      })
        .then(async (res) => {
          if (res.status === 429) {
            throw new Error("RATE_LIMITED");
          }
          if (!res.ok) {
            throw new Error(`HTTP_${res.status}`);
          }
          return res.json();
        })
        .then((json) => {
          if (controller.signal.aborted) return;

          if (json.success) {
            const items: Movie[] = Array.isArray(json.data) ? json.data : [];
            const pagination = json.pagination || {};
            const pInfo = json.person
              ? json.person
              : json.director
              ? {
                  name: json.director.name,
                  avatar: json.director.avatar,
                  role: "director",
                  roleTitle: "Đạo Diễn",
                  movieCount: json.director.movieCount,
                }
              : null;

            setResults(items);
            setTotalItems(pagination.totalItems ?? items.length);
            setTotalPages(pagination.totalPages ?? 1);
            setSearchedQuery(query);
            setPersonInfo(pInfo);

            pageSearchCache.set(requestUrl, {
              results: items,
              totalItems: pagination.totalItems ?? items.length,
              totalPages: pagination.totalPages ?? 1,
              searchedQuery: query,
              personInfo: pInfo,
            });

            addRecentSearch(query);
          } else {
            setErrorState({
              code: json.error?.code || "SEARCH_ERROR",
              message: json.error?.message || "Đã xảy ra lỗi khi tìm kiếm.",
            });
          }
          setIsLoading(false);
        })
        .catch((err) => {
          if (err.name === "AbortError") return;
          console.error("Search fetch error:", err);

          if (err.message === "RATE_LIMITED") {
            setErrorState({
              code: "RATE_LIMITED",
              message: "Bạn đang thao tác quá nhanh. Vui lòng thử lại sau vài giây.",
            });
          } else {
            setErrorState({
              code: "NETWORK_ERROR",
              message: "Không thể kết nối đến máy chủ tìm kiếm. Vui lòng kiểm tra lại mạng.",
            });
          }
          setIsLoading(false);
        });
    },
    [addRecentSearch, actorParam, directorParam]
  );

  // Trigger search on debounced input change or actor/director param
  React.useEffect(() => {
    if (actorParam) {
      performSearch(actorParam, 1, "actor");
      return;
    }
    if (directorParam) {
      performSearch(directorParam, 1, "director");
      return;
    }

    const q = debouncedVal.trim();
    if (q) {
      // Update URL query param smoothly
      if (q !== queryParam) {
        router.replace(`/search?q=${encodeURIComponent(q)}&page=1`, { scroll: false });
      }
      performSearch(q, currentPage);
    } else {
      setResults([]);
      setSearchedQuery("");
      setPersonInfo(null);
      setIsLoading(false);
      if (queryParam || directorParam || actorParam) {
        router.replace("/search", { scroll: false });
      }
    }
  }, [debouncedVal, currentPage, performSearch, queryParam, directorParam, actorParam, router]);

  // Handle Tag click
  const handleSelectTerm = (term: string) => {
    const clean = term.trim();
    if (!clean) return;
    addRecentSearch(clean);
    setInputVal(clean);
    router.push(`/search?q=${encodeURIComponent(clean)}&page=1`);
    performSearch(clean, 1);
  };

  // Handle Page Change
  const handlePageChange = (newPage: number) => {
    if (searchedQuery) {
      router.push(`/search?q=${encodeURIComponent(searchedQuery)}&page=${newPage}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Refine and sort current results
  const filteredResults = React.useMemo(() => {
    let list = [...results];

    // Filter by type
    if (typeFilter !== "all") {
      list = list.filter((m) => m.type === typeFilter);
    }

    // Sort
    switch (sortOption) {
      case "rating":
        list.sort((a, b) => b.rating - a.rating);
        break;
      case "year":
        list.sort((a, b) => b.year - a.year);
        break;
      case "alpha":
        list.sort((a, b) => a.title.localeCompare(b.title, "vi"));
        break;
    }

    return list;
  }, [results, typeFilter, sortOption]);

  return (
    <div className="pt-20 sm:pt-24 pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full min-h-[80vh]">
      {/* Top Search Header */}
      <div className="max-w-2xl mx-auto mb-10 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <SearchIcon className="w-5 h-5 text-brand" />
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Tìm Kiếm & Khám Phá Phim
          </h1>
        </div>
        <p className="text-xs sm:text-sm text-cinema-400 mb-6">
          Tìm kiếm chính xác theo tên phim, tên gốc tiếng Anh, đạo diễn hoặc diễn viên
        </p>

        {/* Input Bar */}
        <SearchBar
          value={inputVal}
          onChange={setInputVal}
          onSubmit={(term) => {
            const clean = term.trim();
            if (clean) {
              addRecentSearch(clean);
              setInputVal(clean);
              router.push(`/search?q=${encodeURIComponent(clean)}&page=1`);
              performSearch(clean, 1);
            }
          }}
          isLoading={isLoading}
          autoFocus={!queryParam}
          className="max-w-xl mx-auto shadow-2xl"
        />

        {/* Recent & Trending Tags */}
        <div className="mt-4 flex flex-col items-center gap-2.5">
          {/* Recent Searches */}
          {recentSearches.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs text-cinema-400">
              <span className="flex items-center gap-1 mr-1 text-cinema-300 font-medium">
                <Clock className="w-3.5 h-3.5 text-brand" />
                <span>Tìm kiếm gần đây:</span>
              </span>

              {recentSearches.slice(0, 8).map((term) => (
                <div
                  key={term}
                  onClick={() => handleSelectTerm(term)}
                  className="group/tag inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-cinema-800 text-cinema-300 hover:text-white border border-cinema-700/80 hover:border-cinema-500 transition-all cursor-pointer select-none"
                >
                  <span>{term}</span>
                  <button
                    type="button"
                    onClick={(e) => removeRecentSearch(term, e)}
                    className="p-0.5 rounded-full hover:bg-cinema-700 text-cinema-400 hover:text-red-400 transition-colors"
                    title="Xóa từ khóa này"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={clearRecentSearches}
                className="text-[11px] text-cinema-400 hover:text-red-400 transition-colors ml-1 underline decoration-dotted cursor-pointer"
              >
                Xóa tất cả
              </button>
            </div>
          )}

          {/* Popular Keywords */}
          {!inputVal && (
            <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs text-cinema-400 mt-1">
              <span className="flex items-center gap-1 mr-1 text-cinema-300 font-medium">
                <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                <span>Gợi ý thịnh hành:</span>
              </span>
              {POPULAR_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleSelectTerm(tag)}
                  className="px-2.5 py-1 rounded-xl bg-cinema-850 hover:bg-cinema-800 text-cinema-300 hover:text-brand border border-cinema-800 transition-colors"
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ERROR STATE */}
      {errorState && !isLoading && (
        <div className="max-w-md mx-auto my-12 p-6 rounded-2xl bg-cinema-850/90 border border-red-500/30 text-center shadow-xl">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white mb-1.5">Lỗi tìm kiếm</h3>
          <p className="text-xs sm:text-sm text-cinema-400 mb-5 leading-relaxed">
            {errorState.message}
          </p>
          <Button
            variant="primary"
            size="sm"
            onClick={() => performSearch(searchedQuery || inputVal, currentPage)}
            className="gap-2 font-semibold"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Thử lại</span>
          </Button>
        </div>
      )}

      {/* LOADING STATE SKELETON */}
      {isLoading && (
        <div>
          <div className="h-6 w-48 bg-cinema-800 rounded mb-6 animate-pulse" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <MovieCardSkeleton key={i} />
            ))}
          </div>
        </div>
      )}

      {/* SEARCH RESULTS */}
      {!isLoading && !errorState && searchedQuery && (
        <div>
          {/* Person (Actor / Director) Showcase Banner */}
          {personInfo && (
            <div className="mb-8 p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-brand/20 via-cinema-850 to-cinema-800 border border-brand/40 shadow-2xl flex flex-col sm:flex-row items-center sm:items-start gap-5">
              {personInfo.avatar ? (
                <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-2 border-brand/60 flex-shrink-0 shadow-lg bg-cinema-800">
                  <img
                    src={personInfo.avatar}
                    alt={personInfo.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-cinema-800 border border-brand/30 flex items-center justify-center text-brand flex-shrink-0">
                  <User className="w-10 h-10" />
                </div>
              )}
              <div className="text-center sm:text-left flex-1 min-w-0">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand/20 border border-brand/40 text-brand text-[11px] font-bold uppercase tracking-wider mb-2">
                  <span>
                    {personInfo.role === "director" ? "🎬" : "🎭"} Tuyển Tập {personInfo.roleTitle}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {personInfo.name}
                </h2>
                <p className="text-xs sm:text-sm text-cinema-300 mt-1 leading-relaxed">
                  Tổng hợp {personInfo.movieCount || totalItems} tác phẩm điện ảnh xuất sắc{" "}
                  {personInfo.role === "director" ? "do" : "có sự tham gia của"}{" "}
                  <strong>{personInfo.name}</strong> trên hệ thống.
                </p>
              </div>
            </div>
          )}

          {/* Results Summary Header & Quick Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-3 border-b border-cinema-800">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>Kết quả cho:</span>
                <span className="text-brand font-semibold">&quot;{searchedQuery}&quot;</span>
              </h2>
              <p className="text-xs text-cinema-400 mt-0.5">
                Tìm thấy <strong className="text-white">{totalItems}</strong> kết quả phù hợp
                {totalPages > 1 && ` (Trang ${currentPage} / ${totalPages})`}
              </p>
            </div>

            {/* In-results quick filter & sort */}
            {results.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {/* Type pills */}
                <div className="flex items-center bg-cinema-850 rounded-xl p-1 border border-cinema-750 text-xs">
                  <button
                    type="button"
                    onClick={() => setTypeFilter("all")}
                    className={`px-2.5 py-1 rounded-lg transition-colors ${
                      typeFilter === "all" ? "bg-brand text-cinema-950 font-bold" : "text-cinema-400 hover:text-white"
                    }`}
                  >
                    Tất cả
                  </button>
                  <button
                    type="button"
                    onClick={() => setTypeFilter("single")}
                    className={`px-2.5 py-1 rounded-lg transition-colors ${
                      typeFilter === "single" ? "bg-brand text-cinema-950 font-bold" : "text-cinema-400 hover:text-white"
                    }`}
                  >
                    Phim Lẻ
                  </button>
                  <button
                    type="button"
                    onClick={() => setTypeFilter("series")}
                    className={`px-2.5 py-1 rounded-lg transition-colors ${
                      typeFilter === "series" ? "bg-brand text-cinema-950 font-bold" : "text-cinema-400 hover:text-white"
                    }`}
                  >
                    Phim Bộ
                  </button>
                </div>

                {/* Sort select */}
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as any)}
                  className="bg-cinema-850 border border-cinema-750 text-cinema-200 text-xs rounded-xl px-2.5 py-1.5 outline-none focus:border-brand"
                >
                  <option value="default">Mặc định</option>
                  <option value="rating">Đánh giá cao nhất</option>
                  <option value="year">Năm sản xuất</option>
                  <option value="alpha">Tên phim (A - Z)</option>
                </select>
              </div>
            )}
          </div>

          {/* Results Grid or Empty */}
          {filteredResults.length > 0 ? (
            <div>
              <MovieGrid movies={filteredResults} />

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-12">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                  />
                </div>
              )}
            </div>
          ) : (
            <EmptyState
              icon={<SearchIcon className="w-10 h-10 text-cinema-400" />}
              title="Không tìm thấy phim phù hợp"
              description={`Rất tiếc, chúng tôi không tìm thấy kết quả cho "${searchedQuery}". Vui lòng kiểm tra lại chính tả hoặc thử tìm kiếm với các từ khóa khác.`}
              actionText="Khám Phá Tất Cả Phim"
              actionHref="/movies"
            />
          )}
        </div>
      )}

      {/* IDLE STATE (when no query entered) */}
      {!isLoading && !errorState && !searchedQuery && (
        <div className="py-20 text-center flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-cinema-850/80 border border-cinema-750 flex items-center justify-center text-cinema-400 mb-4 shadow-inner">
            <SearchIcon className="w-8 h-8" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-white mb-2">
            Bắt đầu tìm kiếm tác phẩm yêu thích
          </h3>
          <p className="text-xs sm:text-sm text-cinema-400 max-w-md mx-auto leading-relaxed mb-6">
            Nhập ít nhất 2 ký tự tên phim, diễn viên hoặc thể loại để hệ thống tự động tìm kiếm kết quả
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {["Phim Hành Động", "Phim Tình Cảm", "Phim Hoạt Hình", "Phim Chiếu Rạp"].map((genre) => (
              <button
                key={genre}
                type="button"
                onClick={() => handleSelectTerm(genre)}
                className="px-3 py-1.5 rounded-xl bg-cinema-800 hover:bg-brand hover:text-cinema-950 text-cinema-300 text-xs font-medium border border-cinema-700 transition-colors"
              >
                {genre}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
