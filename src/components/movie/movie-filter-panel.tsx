"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Search, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface MovieFilterPanelProps {
  basePath?: string;
  currentType?: string;
  defaultSort?: string;
  currentSort?: string;
  currentCountry?: string;
  currentGenre?: string;
  currentLanguage?: string;
  currentYear?: number | string;
  className?: string;
}

const SORT_OPTIONS = [
  { label: "Mới cập nhật", val: "latest", icon: "⏱" },
  { label: "Xem nhiều nhất", val: "views", icon: "🔥" },
  { label: "Mới nhất", val: "year", icon: "✨" },
  { label: "Đánh giá cao", val: "rating", icon: "⭐" },
];

const COUNTRIES_LIST = [
  { name: "Trung Quốc", slug: "trung-quoc" },
  { name: "Hàn Quốc", slug: "han-quoc" },
  { name: "Nhật Bản", slug: "nhat-ban" },
  { name: "Thái Lan", slug: "thai-lan" },
  { name: "Âu Mỹ", slug: "au-my" },
  { name: "Đài Loan", slug: "dai-loan" },
  { name: "Hồng Kông", slug: "hong-kong" },
  { name: "Ấn Độ", slug: "an-do" },
  { name: "Anh", slug: "anh" },
  { name: "Pháp", slug: "phap" },
  { name: "Canada", slug: "canada" },
  { name: "Việt Nam", slug: "viet-nam" },
  { name: "Nga", slug: "nga" },
  { name: "Philippines", slug: "philippines" },
  { name: "Úc", slug: "uc" },
  { name: "Đức", slug: "duc" },
  { name: "Tây Ban Nha", slug: "tay-ban-nha" },
  { name: "Ý", slug: "y" },
  { name: "Thổ Nhĩ Kỳ", slug: "tho-nhi-ky" },
  { name: "Indonesia", slug: "indonesia" },
  { name: "Malaysia", slug: "malaysia" },
  { name: "Brazil", slug: "brazil" },
  { name: "Hà Lan", slug: "ha-lan" },
];

const GENRES_LIST = [
  { name: "Hành Động", slug: "hanh-dong" },
  { name: "Tình Cảm", slug: "tinh-cam" },
  { name: "Hài Hước", slug: "hai-huoc" },
  { name: "Cổ Trang", slug: "co-trang" },
  { name: "Tâm Lý", slug: "tam-ly" },
  { name: "Hình Sự", slug: "hinh-su" },
  { name: "Chiến Tranh", slug: "chien-tranh" },
  { name: "Thể Thao", slug: "the-thao" },
  { name: "Võ Thuật", slug: "vo-thuat" },
  { name: "Viễn Tưởng", slug: "vien-tuong" },
  { name: "Phiêu Lưu", slug: "phieu-luu" },
  { name: "Khoa Học", slug: "khoa-hoc" },
  { name: "Tài Liệu", slug: "tai-lieu" },
  { name: "Kinh Dị", slug: "kinh-di" },
  { name: "Chính Kịch", slug: "chinh-kich" },
  { name: "Bí Ẩn", slug: "bi-an" },
  { name: "Hoạt Hình", slug: "hoat-hinh" },
  { name: "Gia Đình", slug: "gia-dinh" },
  { name: "Âm Nhạc", slug: "am-nhac" },
  { name: "Học Đường", slug: "hoc-duong" },
  { name: "Lãng Mạn", slug: "lang-man" },
];

const LANGUAGES_LIST = [
  { name: "Phụ đề", slug: "vietsub" },
  { name: "Thuyết minh", slug: "thuyet-minh" },
  { name: "Lồng tiếng", slug: "long-tieng" },
];

const YEARS_LIST = [2026, 2025, 2024, 2023, 2022, 2021, 2020];

export function MovieFilterPanel({
  basePath = "/movies",
  currentType,
  defaultSort = "latest",
  currentSort,
  currentCountry = "",
  currentGenre = "",
  currentLanguage = "",
  currentYear = "",
  className,
}: MovieFilterPanelProps) {
  const router = useRouter();

  // Filter panel defaults to collapsed so it does not block the movie grid
  const [isOpen, setIsOpen] = React.useState(false);

  // Draft local states
  const [selectedSort, setSelectedSort] = React.useState(currentSort || defaultSort);
  const [selectedCountry, setSelectedCountry] = React.useState(currentCountry || "");
  const [selectedGenre, setSelectedGenre] = React.useState(currentGenre || "");
  const [selectedLanguage, setSelectedLanguage] = React.useState(currentLanguage || "");
  const [selectedYear, setSelectedYear] = React.useState<string | number>(currentYear || "");
  const [customYearInput, setCustomYearInput] = React.useState("");
  const [showCustomYearInput, setShowCustomYearInput] = React.useState(false);

  // Sync when props change
  React.useEffect(() => {
    setSelectedSort(currentSort || defaultSort);
    setSelectedCountry(currentCountry || "");
    setSelectedGenre(currentGenre || "");
    setSelectedLanguage(currentLanguage || "");
    setSelectedYear(currentYear || "");
  }, [currentSort, defaultSort, currentCountry, currentGenre, currentLanguage, currentYear]);

  // Count active selections (sort only counts if it differs from defaultSort)
  const isSortFiltered = Boolean(selectedSort && selectedSort !== defaultSort);
  const activeCount = [
    isSortFiltered ? selectedSort : null,
    selectedCountry,
    selectedGenre,
    selectedLanguage,
    selectedYear,
  ].filter(Boolean).length;

  const [isPending, startTransition] = React.useTransition();

  const handleApply = () => {
    const params: Record<string, string> = {};

    if (currentType) params.type = currentType;
    if (selectedSort && selectedSort !== defaultSort) params.sort = selectedSort;
    if (selectedCountry) params.country = selectedCountry;
    if (selectedGenre) params.genre = selectedGenre;
    if (selectedLanguage) params.language = selectedLanguage;
    if (selectedYear) params.year = String(selectedYear);

    const qs = Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");

    const targetUrl = qs ? `${basePath}?${qs}` : basePath;
    startTransition(() => {
      router.push(targetUrl, { scroll: false });
    });
  };

  const handleReset = () => {
    setSelectedSort(defaultSort);
    setSelectedCountry("");
    setSelectedGenre("");
    setSelectedLanguage("");
    setSelectedYear("");
    setCustomYearInput("");
    setShowCustomYearInput(false);
    setIsOpen(false);

    const targetUrl = currentType ? `${basePath}?type=${encodeURIComponent(currentType)}` : basePath;
    startTransition(() => {
      router.push(targetUrl, { scroll: false });
    });
  };

  const handleCustomYearSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(customYearInput.trim(), 10);
    if (!isNaN(parsed) && parsed >= 1970 && parsed <= 2030) {
      setSelectedYear(parsed);
      setShowCustomYearInput(false);
    }
  };

  return (
    <div className={cn("w-full mb-6 select-none", className)}>
      {/* Top Filter Button matching screenshot */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 border cursor-pointer active:scale-95",
            isOpen
              ? "border-[#F5C247] text-[#F5C247] bg-[#F5C247]/15 shadow-[0_0_20px_rgba(245,194,71,0.25)]"
              : "border-[#F5C247]/60 text-[#F5C247] bg-[#F5C247]/10 hover:bg-[#F5C247]/20 hover:border-[#F5C247]"
          )}
        >
          {/* Rounded Triangle Icon matching screenshot */}
          <svg
            className="w-3.5 h-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinejoin="round"
          >
            <path d="M12 4L21 19H3L12 4Z" />
          </svg>
          <span>Bộ lọc phim</span>
          {activeCount > 0 && (
            <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-[#F5C247] text-black text-[10px] font-extrabold">
              {activeCount}
            </span>
          )}
        </button>

        {activeCount > 0 && (
          <button
            type="button"
            onClick={handleReset}
            className="text-xs text-[#9CA3AF] hover:text-[#F9FAFB] flex items-center gap-1.5 transition-colors font-medium px-2 py-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Đặt lại bộ lọc</span>
          </button>
        )}
      </div>

      {/* Expanded Filter Panel */}
      {isOpen && (
        <div className="rounded-2xl bg-[#0D0F14]/95 border border-[#222530] p-5 sm:p-6 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-3 duration-300 space-y-4">
          
          {/* Row 1: Sắp xếp */}
          <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4 pb-3 border-b border-white/[0.06]">
            <div className="text-xs sm:text-[13px] font-semibold text-[#D1D5DB] min-w-[100px] pt-1 flex items-center gap-1.5 shrink-0">
              <svg className="w-3.5 h-3.5 text-[#9CA3AF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M6 12h12M9 18h6" />
              </svg>
              <span>Sắp xếp:</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
              {SORT_OPTIONS.map((opt) => {
                const isActive = selectedSort === opt.val;
                return (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => setSelectedSort(opt.val)}
                    className={cn(
                      "text-xs sm:text-[13px] px-3 py-1 rounded-full transition-all cursor-pointer flex items-center gap-1.5",
                      isActive
                        ? "border border-[#F5C247] text-[#F5C247] font-semibold bg-[#F5C247]/10 shadow-[0_0_12px_rgba(245,194,71,0.2)]"
                        : "text-[#9CA3AF] hover:text-[#F9FAFB] hover:bg-white/5 border border-transparent"
                    )}
                  >
                    <span>{opt.icon}</span>
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Row 2: Quốc gia */}
          <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4 pb-3 border-b border-white/[0.06]">
            <div className="text-xs sm:text-[13px] font-semibold text-[#D1D5DB] min-w-[100px] pt-1 shrink-0">
              Quốc gia:
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
              <button
                type="button"
                onClick={() => setSelectedCountry("")}
                className={cn(
                  "text-xs sm:text-[13px] px-3 py-1 rounded-full transition-all cursor-pointer font-medium",
                  selectedCountry === ""
                    ? "border border-[#F5C247] text-[#F5C247] font-semibold bg-[#F5C247]/10 shadow-[0_0_12px_rgba(245,194,71,0.2)]"
                    : "text-[#9CA3AF] hover:text-[#F9FAFB] hover:bg-white/5 border border-transparent"
                )}
              >
                Tất cả
              </button>
              {COUNTRIES_LIST.map((c) => {
                const isActive = selectedCountry === c.slug;
                return (
                  <button
                    key={c.slug}
                    type="button"
                    onClick={() => setSelectedCountry(c.slug)}
                    className={cn(
                      "text-xs sm:text-[13px] px-2.5 py-1 rounded-full transition-all cursor-pointer",
                      isActive
                        ? "border border-[#F5C247] text-[#F5C247] font-semibold bg-[#F5C247]/10 shadow-[0_0_12px_rgba(245,194,71,0.2)]"
                        : "text-[#9CA3AF] hover:text-[#F9FAFB] hover:bg-white/5 border border-transparent"
                    )}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Row 3: Thể loại */}
          <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4 pb-3 border-b border-white/[0.06]">
            <div className="text-xs sm:text-[13px] font-semibold text-[#D1D5DB] min-w-[100px] pt-1 shrink-0">
              Thể loại:
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
              <button
                type="button"
                onClick={() => setSelectedGenre("")}
                className={cn(
                  "text-xs sm:text-[13px] px-3 py-1 rounded-full transition-all cursor-pointer font-medium",
                  selectedGenre === ""
                    ? "border border-[#F5C247] text-[#F5C247] font-semibold bg-[#F5C247]/10 shadow-[0_0_12px_rgba(245,194,71,0.2)]"
                    : "text-[#9CA3AF] hover:text-[#F9FAFB] hover:bg-white/5 border border-transparent"
                )}
              >
                Tất cả
              </button>
              {GENRES_LIST.map((g) => {
                const isActive = selectedGenre === g.slug;
                return (
                  <button
                    key={g.slug}
                    type="button"
                    onClick={() => setSelectedGenre(g.slug)}
                    className={cn(
                      "text-xs sm:text-[13px] px-2.5 py-1 rounded-full transition-all cursor-pointer",
                      isActive
                        ? "border border-[#F5C247] text-[#F5C247] font-semibold bg-[#F5C247]/10 shadow-[0_0_12px_rgba(245,194,71,0.2)]"
                        : "text-[#9CA3AF] hover:text-[#F9FAFB] hover:bg-white/5 border border-transparent"
                    )}
                  >
                    {g.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Row 4: Ngôn ngữ */}
          <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4 pb-3 border-b border-white/[0.06]">
            <div className="text-xs sm:text-[13px] font-semibold text-[#D1D5DB] min-w-[100px] pt-1 shrink-0">
              Ngôn ngữ:
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
              <button
                type="button"
                onClick={() => setSelectedLanguage("")}
                className={cn(
                  "text-xs sm:text-[13px] px-3 py-1 rounded-full transition-all cursor-pointer font-medium",
                  selectedLanguage === ""
                    ? "border border-[#F5C247] text-[#F5C247] font-semibold bg-[#F5C247]/10 shadow-[0_0_12px_rgba(245,194,71,0.2)]"
                    : "text-[#9CA3AF] hover:text-[#F9FAFB] hover:bg-white/5 border border-transparent"
                )}
              >
                Tất cả
              </button>
              {LANGUAGES_LIST.map((l) => {
                const isActive = selectedLanguage === l.slug;
                return (
                  <button
                    key={l.slug}
                    type="button"
                    onClick={() => setSelectedLanguage(l.slug)}
                    className={cn(
                      "text-xs sm:text-[13px] px-3 py-1 rounded-full transition-all cursor-pointer",
                      isActive
                        ? "border border-[#F5C247] text-[#F5C247] font-semibold bg-[#F5C247]/10 shadow-[0_0_12px_rgba(245,194,71,0.2)]"
                        : "text-[#9CA3AF] hover:text-[#F9FAFB] hover:bg-white/5 border border-transparent"
                    )}
                  >
                    {l.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Row 5: Năm sản xuất */}
          <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4 pb-4">
            <div className="text-xs sm:text-[13px] font-semibold text-[#D1D5DB] min-w-[100px] pt-1 shrink-0">
              Năm sản xuất:
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedYear("");
                  setShowCustomYearInput(false);
                }}
                className={cn(
                  "text-xs sm:text-[13px] px-3 py-1 rounded-full transition-all cursor-pointer font-medium",
                  selectedYear === ""
                    ? "border border-[#F5C247] text-[#F5C247] font-semibold bg-[#F5C247]/10 shadow-[0_0_12px_rgba(245,194,71,0.2)]"
                    : "text-[#9CA3AF] hover:text-[#F9FAFB] hover:bg-white/5 border border-transparent"
                )}
              >
                Tất cả
              </button>
              {YEARS_LIST.map((y) => {
                const isActive = String(selectedYear) === String(y);
                return (
                  <button
                    key={y}
                    type="button"
                    onClick={() => {
                      setSelectedYear(y);
                      setShowCustomYearInput(false);
                    }}
                    className={cn(
                      "text-xs sm:text-[13px] px-3 py-1 rounded-full transition-all cursor-pointer",
                      isActive
                        ? "border border-[#F5C247] text-[#F5C247] font-semibold bg-[#F5C247]/10 shadow-[0_0_12px_rgba(245,194,71,0.2)]"
                        : "text-[#9CA3AF] hover:text-[#F9FAFB] hover:bg-white/5 border border-transparent"
                    )}
                  >
                    {y}
                  </button>
                );
              })}

              {/* Custom Year Search Button or Input */}
              {showCustomYearInput ? (
                <form onSubmit={handleCustomYearSubmit} className="inline-flex items-center gap-1.5">
                  <input
                    type="number"
                    autoFocus
                    placeholder="VD: 2019"
                    value={customYearInput}
                    onChange={(e) => setCustomYearInput(e.target.value)}
                    className="w-24 px-2.5 py-1 text-xs rounded-full bg-[#181B23] border border-[#F5C247]/60 text-white outline-none focus:border-[#F5C247]"
                  />
                  <button
                    type="submit"
                    className="px-2.5 py-1 rounded-full bg-[#F5C247] text-black text-xs font-bold"
                  >
                    OK
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowCustomYearInput(true)}
                  className={cn(
                    "text-xs sm:text-[13px] px-3 py-1 rounded-full transition-all cursor-pointer flex items-center gap-1.5",
                    typeof selectedYear === "number" && !YEARS_LIST.includes(selectedYear)
                      ? "border border-[#F5C247] text-[#F5C247] font-semibold bg-[#F5C247]/10"
                      : "text-[#9CA3AF] hover:text-[#F9FAFB] bg-[#161820] hover:bg-[#1E212C] border border-white/5"
                  )}
                >
                  <Search className="w-3 h-3 text-[#9CA3AF]" />
                  <span>
                    {typeof selectedYear === "number" && !YEARS_LIST.includes(selectedYear)
                      ? `Năm: ${selectedYear}`
                      : "Nhập năm khác"}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Action Row: Lọc kết quả -> & Đóng */}
          <div className="pt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={handleApply}
              disabled={isPending}
              className={cn(
                "bg-[#F5C247] hover:bg-[#FFD15C] text-black font-extrabold text-xs sm:text-sm px-6 py-2.5 rounded-full flex items-center gap-2 shadow-lg shadow-[#F5C247]/25 transition-all hover:scale-105 active:scale-95 cursor-pointer",
                isPending && "opacity-75 cursor-wait"
              )}
            >
              <span>{isPending ? "Đang lọc..." : "Lọc kết quả"}</span>
              <ArrowRight className={cn("w-4 h-4 stroke-[2.5]", isPending && "animate-spin")} />
            </button>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="bg-[#1C1F28] hover:bg-[#282C38] text-[#D1D5DB] hover:text-white font-semibold text-xs sm:text-sm px-6 py-2.5 rounded-full border border-white/10 transition-colors cursor-pointer"
            >
              <span>Đóng</span>
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
