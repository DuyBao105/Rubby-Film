"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  X,
  Clock,
  ArrowRight,
  Star,
  Film,
  Loader2,
  Play,
  Sparkles,
} from "lucide-react";
import { Movie } from "@/types/movie";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { useSearchHistory } from "@/lib/hooks/use-search-history";
import { Badge } from "@/components/ui/badge";
import { cn, formatRating } from "@/lib/utils";
import { FALLBACK_POSTER } from "@/lib/utils/image";

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

// Client-side in-memory cache for 0ms instant feedback
const searchClientCache = new Map<
  string,
  {
    results: Movie[];
    person: { name: string; roleTitle: string; role: string } | null;
  }
>();

// Global client pool of indexed movies for instant as-you-type suggestion
const instantMoviePool = new Map<string, Movie>();

export function SearchOverlay({ isOpen, onClose }: SearchOverlayProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<Movie[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  const { recentSearches, addRecentSearch, removeRecentSearch, clearRecentSearches } =
    useSearchHistory();

  // Prefetch popular movies on idle to seed the instant suggestion pool
  React.useEffect(() => {
    if (instantMoviePool.size === 0) {
      fetch("/api/movies/latest?limit=24")
        .then((res) => res.json())
        .then((data) => {
          const items: Movie[] = Array.isArray(data.data) ? data.data : [];
          items.forEach((m) => {
            if (m.id || m.slug) instantMoviePool.set(m.id || m.slug, m);
          });
        })
        .catch(() => {});
    }
  }, []);

  // Ultra-responsive 60ms debounce for real-time instant suggestion
  const debouncedQuery = useDebounce(query, 60);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    const clean = val.trim().toLowerCase();
    if (!clean) {
      setResults([]);
      setDetectedPerson(null);
      setIsLoading(false);
    } else if (searchClientCache.has(clean)) {
      // Instant 0ms hit from client cache
      const cached = searchClientCache.get(clean)!;
      setResults(cached.results);
      setDetectedPerson(cached.person);
      setIsLoading(false);
    } else {
      // Instant match from local movie pool while awaiting network
      const poolMatches = Array.from(instantMoviePool.values())
        .filter((m) => {
          const t = (m.title || "").toLowerCase();
          const orig = (m.originalTitle || "").toLowerCase();
          const slug = (m.slug || "").toLowerCase();
          return t.includes(clean) || orig.includes(clean) || slug.includes(clean);
        })
        .slice(0, 12);

      if (poolMatches.length > 0) {
        setResults(poolMatches);
        setIsLoading(true);
      }
    }
  };

  // Fetch suggestions
  const [detectedPerson, setDetectedPerson] = React.useState<{
    name: string;
    roleTitle: string;
    role: string;
  } | null>(null);

  React.useEffect(() => {
    const cleanQuery = debouncedQuery.trim();
    if (!cleanQuery) {
      setResults([]);
      setDetectedPerson(null);
      setIsLoading(false);
      return;
    }

    // 1. Instant Cache Hit: Return in 0ms!
    const cacheKey = cleanQuery.toLowerCase();
    if (searchClientCache.has(cacheKey)) {
      const cached = searchClientCache.get(cacheKey)!;
      setResults(cached.results);
      setDetectedPerson(cached.person);
      setIsLoading(false);
      return;
    }

    // 2. Network Fetch with AbortController for stale cancellation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);

    fetch(`/api/search?q=${encodeURIComponent(cleanQuery)}&limit=12`, {
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data) => {
        if (!controller.signal.aborted) {
          const items: Movie[] = Array.isArray(data.data) ? data.data : data.results || [];
          let personObj: { name: string; roleTitle: string; role: string } | null = null;
          if (data.person) {
            personObj = data.person;
          } else if (data.director) {
            personObj = {
              name: data.director.name,
              role: "director",
              roleTitle: "Đạo Diễn",
            };
          }

          setResults(items);
          setDetectedPerson(personObj);
          setIsLoading(false);

          // Seed items into instant movie pool for future keystrokes
          items.forEach((m) => {
            if (m.id || m.slug) instantMoviePool.set(m.id || m.slug, m);
          });

          // Save to client cache
          searchClientCache.set(cacheKey, {
            results: items,
            person: personObj,
          });
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("Search suggestions error:", err);
          setIsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [debouncedQuery]);

  // Keyboard escape listener
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
      // Focus input on open
      setTimeout(() => inputRef.current?.focus(), 50);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  const goToSearchPage = (customQuery?: string) => {
    const term = (customQuery ?? query).trim();
    if (term) {
      addRecentSearch(term);
      onClose();
      router.push(`/search?q=${encodeURIComponent(term)}`);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      goToSearchPage();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    goToSearchPage();
  };

  const handleSelectRecent = (term: string) => {
    setQuery(term);
    goToSearchPage(term);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center pt-16 sm:pt-24 px-4 bg-cinema-950/80 backdrop-blur-md animate-fade-in">
      <div
        className="fixed inset-0 -z-10"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="w-full max-w-2xl bg-cinema-900 border border-cinema-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Search Input Bar */}
        <form
          onSubmit={handleSubmit}
          className="flex items-center px-4 py-3.5 border-b border-cinema-800 bg-cinema-850/90"
        >
          <Search className="w-5 h-5 text-cinema-400 mr-3 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Tìm kiếm phim, diễn viên, thể loại..."
            autoFocus
            className="w-full bg-transparent text-white placeholder-cinema-400 text-base outline-none"
          />
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin text-brand mr-2" />
          ) : query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="text-cinema-400 hover:text-white mr-2"
              aria-label="Xóa"
            >
              <X className="w-4 h-4" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-cinema-400 hover:text-white px-2 py-1 rounded bg-cinema-800 border border-cinema-700"
          >
            Esc
          </button>
        </form>

        {/* Content Area */}
        <div className="overflow-y-auto p-4 space-y-4">
          {/* Query Results */}
          {query.trim() && (
            <div>
              <div className="flex items-center justify-between text-xs text-cinema-400 mb-2 px-1">
                <span className={detectedPerson ? "text-brand font-semibold" : ""}>
                  {detectedPerson
                    ? `${detectedPerson.role === "director" ? "🎬" : "🎭"} ${detectedPerson.roleTitle.toUpperCase()}: ${detectedPerson.name.toUpperCase()}`
                    : "GỢI Ý KẾT QUẢ"}
                </span>
                {results.length > 0 && (
                  <button
                    type="button"
                    onClick={() => goToSearchPage()}
                    className="text-brand hover:underline flex items-center gap-1 cursor-pointer font-medium"
                  >
                    <span>Xem tất cả kết quả</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>

              {results.length > 0 ? (
                <div className="space-y-1.5">
                  {results.map((movie) => (
                    <Link
                      key={movie.id}
                      href={`/movie/${movie.slug}`}
                      prefetch={true}
                      onClick={() => {
                        addRecentSearch(query.trim());
                        onClose();
                      }}
                      className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-transparent hover:border-cinema-700/60 hover:bg-cinema-800/60 transition-all duration-150 group cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-grow">
                        <div className="relative w-10 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-cinema-800 border border-cinema-700/50">
                          <Image
                            src={movie.posterUrl || FALLBACK_POSTER}
                            alt={movie.title}
                            fill
                            unoptimized={true}
                            className="object-cover group-hover:scale-105 transition-transform"
                            sizes="40px"
                          />
                        </div>
                        <div className="flex-grow min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-semibold truncate text-white group-hover:text-brand transition-colors">
                              {movie.title}
                            </h4>
                            {movie.quality && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-cinema-800 text-cinema-300 border border-cinema-700 shrink-0">
                                {movie.quality.includes("4K") ? "4K" : "HD"}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-cinema-400 truncate mt-0.5">
                            {movie.originalTitle ? `${movie.originalTitle} • ` : ""}
                            {movie.year || "Full"}
                            {movie.genres?.length
                              ? ` • ${movie.genres.slice(0, 2).join(", ")}`
                              : ""}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="rating" className="text-[11px] px-1.5 py-0.5">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          <span>{formatRating(movie.rating)}</span>
                        </Badge>
                      </div>
                    </Link>
                  ))}

                  {results.length > 0 && (
                    <button
                      type="button"
                      onClick={() => goToSearchPage()}
                      className="w-full mt-2.5 py-2.5 rounded-xl border border-cinema-700/60 bg-cinema-850 hover:bg-cinema-800 text-xs font-semibold text-cinema-300 hover:text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span>Xem tất cả kết quả cho &quot;{query}&quot;</span>
                      <ArrowRight className="w-3.5 h-3.5 text-brand" />
                    </button>
                  )}
                </div>
              ) : !isLoading ? (
                <div className="py-8 text-center text-sm text-cinema-400">
                  <Film className="w-8 h-8 mx-auto text-cinema-600 mb-2" />
                  Không tìm thấy kết quả phù hợp cho &quot;{query}&quot;
                </div>
              ) : null}
            </div>
          )}

          {/* Recent Searches */}
          {!query.trim() && recentSearches.length > 0 && (
            <div>
              <div className="flex items-center justify-between text-xs text-cinema-400 mb-2 px-1">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-brand" />
                  <span>TÌM KIẾM GẦN ĐÂY</span>
                </span>
                <button
                  type="button"
                  onClick={clearRecentSearches}
                  className="hover:text-cinema-200 transition-colors"
                >
                  Xóa lịch sử
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {recentSearches.map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => handleSelectRecent(term)}
                    className="flex items-center gap-1.5 text-xs text-cinema-300 bg-cinema-800 hover:bg-cinema-750 hover:text-white border border-cinema-700/80 rounded-lg px-3 py-1.5 transition-colors group cursor-pointer"
                  >
                    <span>{term}</span>
                    <span
                      onClick={(e) => removeRecentSearch(term, e)}
                      className="hover:text-red-400 ml-1 text-cinema-500"
                    >
                      ×
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Popular Suggestions */}
          {!query.trim() && (
            <div className="pt-2 border-t border-cinema-800">
              <span className="text-xs text-cinema-400 block mb-2 px-1">
                TỪ KHÓA PHỔ BIẾN
              </span>
              <div className="flex flex-wrap gap-2">
                {[
                  "Dune",
                  "Oppenheimer",
                  "Shogun",
                  "Arcane",
                  "Christopher Nolan",
                  "Hành động",
                  "Trấn Thành",
                  "Lý Hải",
                ].map((keyword) => (
                  <button
                    key={keyword}
                    type="button"
                    onClick={() => handleSelectRecent(keyword)}
                    className="text-xs text-cinema-300 bg-cinema-850 hover:bg-cinema-800 hover:text-brand border border-cinema-800 rounded-lg px-2.5 py-1 transition-colors cursor-pointer"
                  >
                    {keyword}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
