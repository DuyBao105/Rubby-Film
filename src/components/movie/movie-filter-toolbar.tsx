"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  SlidersHorizontal,
  X,
  RotateCcw,
  Check,
  Film,
  Calendar,
  Globe2,
  ArrowUpDown,
} from "lucide-react";
import { Genre, Country, MovieType } from "@/types/movie";
import { Button } from "@/components/ui/button";

interface MovieFilterToolbarProps {
  genres: Genre[];
  countries: Country[];
  currentGenre?: string;
  currentCountry?: string;
  currentYear?: number;
  currentType?: MovieType | "hoat-hinh";
  currentRating?: number;
  currentQuality?: string;
  currentSort?: string;
  basePath?: string;
}

const YEAR_OPTIONS = [
  2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017,
  2016, 2015, 2014, 2013, 2012, 2011, 2010, 2005, 2000,
];

export function MovieFilterToolbar({
  genres,
  countries,
  currentGenre,
  currentCountry,
  currentYear,
  currentType,
  currentSort = "latest",
  basePath = "/movies",
}: MovieFilterToolbarProps) {
  const router = useRouter();

  // Mobile drawer state
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  // Local draft state for mobile sheet
  const [draftGenre, setDraftGenre] = React.useState(currentGenre || "");
  const [draftCountry, setDraftCountry] = React.useState(currentCountry || "");
  const [draftYear, setDraftYear] = React.useState<number | undefined>(currentYear);
  const [draftType, setDraftType] = React.useState<MovieType | "hoat-hinh" | undefined>(currentType);
  const [draftSort, setDraftSort] = React.useState(currentSort);

  // Sync draft when props change
  React.useEffect(() => {
    setDraftGenre(currentGenre || "");
    setDraftCountry(currentCountry || "");
    setDraftYear(currentYear);
    setDraftType(currentType);
    setDraftSort(currentSort);
  }, [
    currentGenre,
    currentCountry,
    currentYear,
    currentType,
    currentSort,
  ]);

  // Count active filters (excluding sort)
  const activeFilterCount = [
    currentGenre,
    currentCountry,
    currentYear,
    currentType,
  ].filter(Boolean).length;

  const pushFilters = (overrides: Record<string, string | number | undefined>) => {
    let targetBase = basePath;

    // If changing type to single from /series or vice versa, route to the correct base path
    if (overrides.type === "single" && targetBase.startsWith("/series")) {
      targetBase = "/movies";
    } else if (overrides.type === "series" && targetBase === "/movies") {
      targetBase = "/series";
    } else if (overrides.type === undefined && targetBase.startsWith("/series")) {
      targetBase = "/movies";
    }

    const current = {
      genre: currentGenre,
      country: currentCountry,
      year: currentYear?.toString(),
      type: currentType,
      sort: currentSort !== "latest" ? currentSort : undefined,
      page: undefined, // Always reset to page 1 on filter change
      ...overrides,
    };

    const qs = Object.entries(current)
      .filter(([_, v]) => v !== undefined && v !== "")
      .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
      .join("&");

    startTransition(() => {
      router.push(qs ? `${targetBase}?${qs}` : targetBase);
    });
  };

  const resetAllFilters = () => {
    startTransition(() => {
      router.push(basePath);
    });
    setIsMobileOpen(false);
  };

  const handleApplyMobile = () => {
    pushFilters({
      genre: draftGenre || undefined,
      country: draftCountry || undefined,
      year: draftYear?.toString(),
      type: draftType,
      sort: draftSort !== "latest" ? draftSort : undefined,
    });
    setIsMobileOpen(false);
  };

  return (
    <div className="mb-8">
      {/* Mobile Trigger Button */}
      <div className="flex md:hidden items-center justify-between gap-3 p-3.5 rounded-2xl bg-cinema-850/90 border border-cinema-700/80 mb-4">
        <button
          type="button"
          onClick={() => setIsMobileOpen(true)}
          className="flex items-center gap-2 text-xs font-bold text-white px-3.5 py-2 rounded-xl bg-cinema-800 hover:bg-cinema-750 border border-cinema-700 transition-colors"
        >
          <SlidersHorizontal className="w-4 h-4 text-brand" />
          <span>Bộ Lọc & Sắp Xếp</span>
          {activeFilterCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-brand text-cinema-950 flex items-center justify-center text-[10px] font-extrabold ml-1">
              {activeFilterCount}
            </span>
          )}
        </button>

        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={resetAllFilters}
            className="text-xs text-cinema-400 hover:text-white flex items-center gap-1 transition-colors px-2 py-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Đặt lại</span>
          </button>
        )}
      </div>

      {/* Desktop Filter Panel */}
      <div className="hidden md:block p-5 rounded-2xl bg-cinema-850/80 border border-cinema-700/70 shadow-lg space-y-4">
        {/* Top Row: Type Pills & Reset */}
        <div className="flex items-center justify-between gap-4 pb-3 border-b border-cinema-750">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-cinema-400 font-semibold uppercase tracking-wider mr-2 flex items-center gap-1.5">
              <Film className="w-3.5 h-3.5 text-brand" />
              <span>Phân loại:</span>
            </span>
            {[
              { label: "Tất cả", val: undefined },
              { label: "Phim Lẻ", val: "single" as const },
              { label: "Phim Bộ", val: "series" as const },
              { label: "Hoạt Hình & Anime", val: "hoat-hinh" as const },
            ].map((item) => {
              const isActive = currentType === item.val;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => pushFilters({ type: item.val })}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                    isActive
                      ? "bg-brand text-cinema-950 border-brand shadow-sm font-bold scale-[1.02]"
                      : "bg-cinema-800 text-cinema-300 border-cinema-700 hover:bg-cinema-750 hover:text-white"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={resetAllFilters}
              className="text-xs text-cinema-400 hover:text-red-400 flex items-center gap-1.5 transition-colors font-medium shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Đặt lại bộ lọc ({activeFilterCount})</span>
            </button>
          )}
        </div>

        {/* Filter Dropdowns Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Genre */}
          <div>
            <label className="block text-[11px] text-cinema-400 mb-1 font-semibold flex items-center gap-1">
              <Film className="w-3 h-3 text-brand" />
              <span>Thể Loại</span>
            </label>
            <select
              value={currentGenre || ""}
              onChange={(e) => pushFilters({ genre: e.target.value || undefined })}
              className="w-full bg-cinema-800 border border-cinema-700 hover:border-cinema-500 text-cinema-200 text-xs rounded-xl px-3 py-2.5 outline-none focus:border-brand transition-colors cursor-pointer"
            >
              <option value="">Tất cả thể loại ({genres.length})</option>
              {genres.map((g) => (
                <option key={g.slug} value={g.slug}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          {/* Country */}
          <div>
            <label className="block text-[11px] text-cinema-400 mb-1 font-semibold flex items-center gap-1">
              <Globe2 className="w-3 h-3 text-brand" />
              <span>Quốc Gia</span>
            </label>
            <select
              value={currentCountry || ""}
              onChange={(e) => pushFilters({ country: e.target.value || undefined })}
              className="w-full bg-cinema-800 border border-cinema-700 hover:border-cinema-500 text-cinema-200 text-xs rounded-xl px-3 py-2.5 outline-none focus:border-brand transition-colors cursor-pointer"
            >
              <option value="">Tất cả quốc gia ({countries.length})</option>
              {countries.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Year */}
          <div>
            <label className="block text-[11px] text-cinema-400 mb-1 font-semibold flex items-center gap-1">
              <Calendar className="w-3 h-3 text-brand" />
              <span>Năm Sản Xuất</span>
            </label>
            <select
              value={currentYear || ""}
              onChange={(e) =>
                pushFilters({ year: e.target.value ? parseInt(e.target.value) : undefined })
              }
              className="w-full bg-cinema-800 border border-cinema-700 hover:border-cinema-500 text-cinema-200 text-xs rounded-xl px-3 py-2.5 outline-none focus:border-brand transition-colors cursor-pointer"
            >
              <option value="">Tất cả các năm</option>
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  Năm {y}
                </option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <div>
            <label className="block text-[11px] text-cinema-400 mb-1 font-semibold flex items-center gap-1">
              <ArrowUpDown className="w-3 h-3 text-brand" />
              <span>Sắp Xếp</span>
            </label>
            <select
              value={currentSort}
              onChange={(e) => pushFilters({ sort: e.target.value })}
              className="w-full bg-cinema-800 border border-brand/50 text-brand font-semibold text-xs rounded-xl px-3 py-2.5 outline-none focus:border-brand transition-colors cursor-pointer"
            >
              <option value="latest">Mới cập nhật</option>
              <option value="year">Năm phát hành (Mới nhất)</option>
              <option value="year_asc">Năm phát hành (Cũ nhất)</option>
              <option value="rating">Đánh giá cao nhất</option>
              <option value="views">Lượt xem nhiều nhất</option>
              <option value="alpha">Tên phim (A - Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* MOBILE DRAWER / BOTTOM SHEET */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end md:hidden animate-in fade-in duration-200">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setIsMobileOpen(false)}
          />

          {/* Bottom Sheet Modal */}
          <div className="relative z-10 w-full max-h-[85vh] bg-cinema-900 border-t border-cinema-700 rounded-t-3xl p-5 overflow-y-auto shadow-2xl flex flex-col gap-5">
            {/* Sheet Header */}
            <div className="flex items-center justify-between pb-3 border-b border-cinema-800">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-brand" />
                <h3 className="text-base font-bold text-white">Bộ Lọc & Sắp Xếp</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileOpen(false)}
                className="p-1 rounded-full text-cinema-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Type selector */}
            <div>
              <span className="text-xs font-semibold text-cinema-300 block mb-2">Phân loại</span>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Tất cả", val: undefined },
                  { label: "Phim Lẻ", val: "single" as const },
                  { label: "Phim Bộ", val: "series" as const },
                  { label: "Hoạt Hình & Anime", val: "hoat-hinh" as const },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setDraftType(item.val)}
                    className={`py-2 rounded-xl text-xs font-semibold border ${
                      draftType === item.val
                        ? "bg-brand text-cinema-950 border-brand font-bold"
                        : "bg-cinema-800 text-cinema-300 border-cinema-700"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sắp xếp */}
            <div>
              <span className="text-xs font-semibold text-cinema-300 block mb-2">Sắp xếp theo</span>
              <select
                value={draftSort}
                onChange={(e) => setDraftSort(e.target.value)}
                className="w-full bg-cinema-800 border border-cinema-700 text-white text-xs rounded-xl p-3 outline-none"
              >
                <option value="latest">Mới cập nhật</option>
                <option value="year">Năm phát hành (Mới nhất)</option>
                <option value="year_asc">Năm phát hành (Cũ nhất)</option>
                <option value="rating">Đánh giá cao nhất</option>
                <option value="views">Lượt xem nhiều nhất</option>
                <option value="alpha">Tên phim (A - Z)</option>
              </select>
            </div>

            {/* Thể loại */}
            <div>
              <span className="text-xs font-semibold text-cinema-300 block mb-2">Thể loại</span>
              <select
                value={draftGenre}
                onChange={(e) => setDraftGenre(e.target.value)}
                className="w-full bg-cinema-800 border border-cinema-700 text-white text-xs rounded-xl p-3 outline-none"
              >
                <option value="">Tất cả thể loại</option>
                {genres.map((g) => (
                  <option key={g.slug} value={g.slug}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Quốc gia */}
            <div>
              <span className="text-xs font-semibold text-cinema-300 block mb-2">Quốc gia</span>
              <select
                value={draftCountry}
                onChange={(e) => setDraftCountry(e.target.value)}
                className="w-full bg-cinema-800 border border-cinema-700 text-white text-xs rounded-xl p-3 outline-none"
              >
                <option value="">Tất cả quốc gia</option>
                {countries.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Năm */}
            <div>
              <span className="text-xs font-semibold text-cinema-300 block mb-1">Năm sản xuất</span>
              <select
                value={draftYear || ""}
                onChange={(e) =>
                  setDraftYear(e.target.value ? parseInt(e.target.value) : undefined)
                }
                className="w-full bg-cinema-800 border border-cinema-700 text-white text-xs rounded-xl p-2.5 outline-none"
              >
                <option value="">Tất cả các năm</option>
                {YEAR_OPTIONS.map((y) => (
                  <option key={y} value={y}>
                    Năm {y}
                  </option>
                ))}
              </select>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-cinema-800">
              <Button
                variant="secondary"
                onClick={resetAllFilters}
                className="w-full text-xs h-11 border border-cinema-700"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                <span>Đặt Lại</span>
              </Button>

              <Button
                variant="primary"
                onClick={handleApplyMobile}
                className="w-full text-xs h-11 font-bold"
              >
                <Check className="w-4 h-4 mr-1" />
                <span>Áp Dụng</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
