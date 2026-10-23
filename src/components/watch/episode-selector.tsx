"use client";

import * as React from "react";
import { Episode } from "@/types/movie";
import {
  Play,
  CheckCircle2,
  Tv,
  X,
  Lock,
  Clock,
  Bell,
  BellRing,
  Calendar,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWatchHistory } from "@/lib/hooks/use-watch-history";
import {
  getAiringSchedule,
  getTimeRemaining,
  isEpisodeReminderSet,
  toggleEpisodeReminder,
  AiringScheduleInfo,
} from "@/lib/utils/airingSchedule";
import { useToast } from "@/components/ui/toast";

interface EpisodeSelectorProps {
  movieId: string;
  movieSlug?: string;
  movieTitle?: string;
  totalEpisodes?: number;
  currentEpisodeStr?: string;
  showtimes?: string;
  notify?: string;
  episodes: Episode[];
  activeEpisodeId: string;
  onSelectEpisode: (episode: Episode) => void;
  className?: string;
}

export function EpisodeSelector({
  movieId,
  movieSlug,
  movieTitle,
  totalEpisodes,
  currentEpisodeStr,
  showtimes,
  notify,
  episodes,
  activeEpisodeId,
  onSelectEpisode,
  className,
}: EpisodeSelectorProps) {
  const { isEpisodeWatched, getEpisodeProgress } = useWatchHistory();
  const [selectedSeason, setSelectedSeason] = React.useState(1);
  const [selectedUpcomingEp, setSelectedUpcomingEp] = React.useState<number | null>(null);

  // Compute schedule info if ongoing series
  const scheduleInfo = React.useMemo(() => {
    return getAiringSchedule({
      id: movieId,
      slug: movieSlug,
      title: movieTitle,
      type: "series",
      totalEpisodes,
      currentEpisode: currentEpisodeStr,
      episodes,
      showtimes,
      notify,
    });
  }, [movieId, movieSlug, movieTitle, totalEpisodes, currentEpisodeStr, episodes, showtimes, notify]);

  // Max released episode number
  const maxReleasedEp = React.useMemo(() => {
    return episodes.reduce((max, ep) => Math.max(max, ep.episodeNumber || 0), 0);
  }, [episodes]);

  // List of upcoming unreleased episode numbers
  const upcomingEpisodeNumbers = React.useMemo(() => {
    if (!scheduleInfo || scheduleInfo.totalEpisodes <= maxReleasedEp) return [];
    const list: number[] = [];
    const end = Math.min(scheduleInfo.totalEpisodes, maxReleasedEp + 30);
    for (let i = maxReleasedEp + 1; i <= end; i++) {
      list.push(i);
    }
    return list;
  }, [scheduleInfo, maxReleasedEp]);

  // Group into seasons or chunks if long series
  const seasonGroups = React.useMemo(() => {
    if (!episodes || episodes.length === 0) return [];

    const seasonMap = new Map<number, Episode[]>();
    episodes.forEach((ep) => {
      const s = ep.seasonNumber || 1;
      if (!seasonMap.has(s)) seasonMap.set(s, []);
      seasonMap.get(s)!.push(ep);
    });

    if (seasonMap.size > 1) {
      return Array.from(seasonMap.entries()).map(([seasonNum, eps]) => ({
        id: seasonNum,
        name: `Mùa ${seasonNum}`,
        episodes: eps,
      }));
    }

    if (episodes.length > 40) {
      const chunkSize = 30;
      const chunks = [];
      for (let i = 0; i < episodes.length; i += chunkSize) {
        const chunkEps = episodes.slice(i, i + chunkSize);
        const startEp = chunkEps[0].episodeNumber;
        const endEp = chunkEps[chunkEps.length - 1].episodeNumber;
        chunks.push({
          id: Math.floor(i / chunkSize) + 1,
          name: `Tập ${startEp} - ${endEp}`,
          episodes: chunkEps,
        });
      }
      return chunks;
    }

    return [
      {
        id: 1,
        name: "Mùa 1",
        episodes: episodes,
      },
    ];
  }, [episodes]);

  if (!episodes || episodes.length === 0) return null;

  const currentGroupEpisodes =
    seasonGroups.find((g) => g.id === selectedSeason)?.episodes || episodes;

  const filteredReleasedEpisodes = currentGroupEpisodes;
  const filteredUpcomingEpisodes = upcomingEpisodeNumbers;

  const totalDisplayCount = scheduleInfo ? scheduleInfo.totalEpisodes : episodes.length;

  return (
    <div className={cn("p-5 rounded-2xl bg-cinema-850/80 border border-cinema-700/60 shadow-lg", className)}>
      {/* Header */}
      <div className="flex flex-col gap-3 mb-4 pb-3 border-b border-cinema-750">
        <div className="flex items-center gap-2.5">
          <Tv className="w-4 h-4 text-brand shrink-0" />
          <h3 className="text-base font-bold text-white whitespace-nowrap flex items-center gap-2">
            <span>Danh Sách Tập</span>
            <span className="text-xs text-cinema-400 font-normal whitespace-nowrap">
              ({episodes.length}
              {scheduleInfo && scheduleInfo.totalEpisodes > episodes.length
                ? `/${scheduleInfo.totalEpisodes}`
                : ""}{" "}
              tập)
            </span>
          </h3>
        </div>

        {/* Season Groups Tabs */}
        {seasonGroups.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full no-scrollbar">
            {seasonGroups.map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() => setSelectedSeason(group.id)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors border",
                  selectedSeason === group.id
                    ? "bg-brand text-white border-brand font-bold shadow-sm shadow-brand/20"
                    : "bg-cinema-800 text-cinema-300 border-cinema-700 hover:bg-cinema-700 hover:text-white"
                )}
              >
                {group.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grid of Episode Cards */}
      {filteredReleasedEpisodes.length === 0 && filteredUpcomingEpisodes.length === 0 ? (
        <div className="py-8 text-center text-xs text-cinema-400">
          Chưa có tập phim nào.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 max-h-[460px] overflow-y-auto pr-1">
          {/* Released Episodes */}
          {filteredReleasedEpisodes.map((ep) => {
            const isActive = ep.id === activeEpisodeId;
            const isWatched = isEpisodeWatched(movieId, ep.episodeNumber);
            const progress = getEpisodeProgress(movieId, ep.episodeNumber);

            return (
              <button
                key={ep.id}
                type="button"
                onClick={() => onSelectEpisode(ep)}
                className={cn(
                  "relative flex flex-col justify-center p-2.5 rounded-xl border text-left transition-all duration-200 select-none overflow-hidden group/item cursor-pointer min-h-[44px]",
                  isActive
                    ? "bg-brand text-cinema-950 font-bold border-brand shadow-md shadow-brand/20 scale-[1.02]"
                    : "bg-cinema-800 text-cinema-200 border-cinema-700/80 hover:bg-cinema-750 hover:text-white hover:border-cinema-500"
                )}
              >
                {/* Ep header: Ep number + Watched state */}
                <div className="flex items-center justify-between gap-1 w-full">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {isActive && <Play className="w-3 h-3 fill-current flex-shrink-0" />}
                    <span className="text-xs sm:text-sm font-bold truncate">Tập {ep.episodeNumber}</span>
                  </div>

                  {isWatched && !isActive && (
                    <span className="text-emerald-400 shrink-0" title="Đã xem">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>

                {/* Progress bar if partially watched */}
                {progress && progress.progressPercent > 0 && !progress.completed && !isActive && (
                  <div className="w-full bg-cinema-700 h-1 rounded-full overflow-hidden mt-1.5">
                    <div
                      className="bg-brand h-full rounded-full"
                      style={{ width: `${progress.progressPercent}%` }}
                    />
                  </div>
                )}
              </button>
            );
          })}

          {/* Upcoming / Unreleased Episodes */}
          {filteredUpcomingEpisodes.map((epNum) => {
            const isNext = epNum === maxReleasedEp + 1;
            const hasReminder = isEpisodeReminderSet(movieId, epNum);

            return (
              <button
                key={`upcoming-${epNum}`}
                type="button"
                onClick={() => setSelectedUpcomingEp(epNum)}
                className={cn(
                  "relative flex flex-col justify-center p-2.5 rounded-xl border text-left transition-all duration-200 select-none overflow-hidden cursor-pointer min-h-[44px]",
                  isNext
                    ? "bg-cinema-900/90 border-brand/40 text-cinema-200 hover:border-brand hover:bg-cinema-850 hover:shadow-lg shadow-brand/10"
                    : "bg-cinema-900/60 border-cinema-800 text-cinema-400 hover:bg-cinema-850 hover:border-cinema-700"
                )}
              >
                {/* Ep header: Ep number + Upcoming indicator */}
                <div className="flex items-center justify-between gap-1 w-full">
                  <div className="flex items-center gap-1">
                    {isNext ? (
                      <Clock className="w-3 h-3 text-brand animate-spin-slow flex-shrink-0" />
                    ) : (
                      <Lock className="w-3 h-3 text-cinema-500 flex-shrink-0" />
                    )}
                    <span className={cn("text-xs font-bold truncate", isNext ? "text-white" : "text-cinema-400")}>
                      Tập {epNum}
                    </span>
                  </div>

                  {hasReminder && (
                    <span className="text-brand" title="Đã bật nhắc nhở">
                      <BellRing className="w-3 h-3" />
                    </span>
                  )}
                </div>

                {/* Upcoming Badge */}
                <div className="flex items-center gap-1 mt-1">
                  {isNext ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand bg-brand/15 border border-brand/30 rounded-md px-1.5 py-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand animate-ping" />
                      Sắp chiếu
                    </span>
                  ) : (
                    <span className="text-[10px] text-cinema-500 font-medium">Chưa chiếu</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Upcoming Episode Details Modal */}
      {selectedUpcomingEp !== null && scheduleInfo && (
        <UpcomingEpisodeModal
          movieId={movieId}
          episodeNumber={selectedUpcomingEp}
          isNext={selectedUpcomingEp === maxReleasedEp + 1}
          scheduleInfo={scheduleInfo}
          latestReleasedEpisode={episodes.find((e) => e.episodeNumber === maxReleasedEp)}
          onSelectEpisode={onSelectEpisode}
          onClose={() => setSelectedUpcomingEp(null)}
        />
      )}
    </div>
  );
}

interface UpcomingEpisodeModalProps {
  movieId: string;
  episodeNumber: number;
  isNext: boolean;
  scheduleInfo: AiringScheduleInfo;
  latestReleasedEpisode?: Episode;
  onSelectEpisode: (ep: Episode) => void;
  onClose: () => void;
}

function UpcomingEpisodeModal({
  movieId,
  episodeNumber,
  isNext,
  scheduleInfo,
  latestReleasedEpisode,
  onSelectEpisode,
  onClose,
}: UpcomingEpisodeModalProps) {
  const toast = useToast();
  const [hasReminder, setHasReminder] = React.useState(() =>
    isEpisodeReminderSet(movieId, episodeNumber)
  );
  const [countdown, setCountdown] = React.useState(() =>
    getTimeRemaining(scheduleInfo.nextAirDate)
  );

  React.useEffect(() => {
    if (!isNext) return;
    const timer = setInterval(() => {
      setCountdown(getTimeRemaining(scheduleInfo.nextAirDate));
    }, 1000);
    return () => clearInterval(timer);
  }, [isNext, scheduleInfo.nextAirDate]);

  const handleToggle = async () => {
    const nextState = await toggleEpisodeReminder({
      movieId,
      episodeNumber,
      targetTimestamp: isNext ? scheduleInfo.nextAirDate.getTime() : undefined,
      scheduledAirDate: isNext ? scheduleInfo.formattedNextAirDate : undefined,
    });
    setHasReminder(nextState);
    if (nextState) {
      toast.success(
        "Đã bật nhắc nhở!",
        `Hệ thống sẽ thông báo cho bạn ngay khi Tập ${episodeNumber} được cập nhật.`
      );
    } else {
      toast.info("Đã tắt nhắc nhở", `Đã hủy nhận thông báo cho Tập ${episodeNumber}.`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl bg-cinema-900 border border-brand/40 p-5 sm:p-6 shadow-2xl space-y-4">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-cinema-400 hover:text-white hover:bg-cinema-800 transition-colors cursor-pointer"
          aria-label="Đóng"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-brand/15 text-brand border border-brand/30">
            {isNext ? <Clock className="w-5 h-5 text-brand" /> : <Lock className="w-5 h-5 text-cinema-400" />}
          </div>
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span>Tập {episodeNumber}</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand/20 text-brand border border-brand/30">
                {isNext ? "Tập kế tiếp" : "Sắp phát sóng"}
              </span>
            </h3>
            <p className="text-xs text-cinema-400">
              Tổng số tập: {scheduleInfo.totalEpisodes} tập
            </p>
          </div>
        </div>

        {/* Information Body */}
        <div className="p-4 rounded-xl bg-cinema-850 border border-cinema-750 space-y-3">
          <div className="flex items-start gap-2.5 text-xs text-cinema-200">
            <Calendar className="w-4 h-4 text-brand flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-white">Lịch chiếu dự kiến:</div>
              <div className="text-cinema-300 mt-0.5">
                {isNext ? scheduleInfo.formattedNextAirDate : "Sẽ phát sóng sau khi các tập trước hoàn tất."}
              </div>
            </div>
          </div>

          <div className="text-xs text-cinema-400 pl-6.5 border-t border-cinema-750/80 pt-2.5">
            {scheduleInfo.scheduleText}
          </div>

          {/* Countdown timer if next episode */}
          {isNext && !countdown.isPast && (
            <div className="pt-2 border-t border-cinema-750/80">
              <div className="text-[11px] font-semibold text-cinema-400 mb-2 uppercase tracking-wider text-center">
                Thời gian đếm ngược lên sóng
              </div>
              <div className="flex items-center justify-center gap-2">
                <div className="flex flex-col items-center justify-center w-12 py-1 rounded-lg bg-cinema-800 border border-cinema-700">
                  <span className="text-sm font-extrabold text-brand font-mono">
                    {String(countdown.days).padStart(2, "0")}
                  </span>
                  <span className="text-[8px] text-cinema-400 uppercase">Ngày</span>
                </div>
                <span className="text-brand font-bold text-xs">:</span>

                <div className="flex flex-col items-center justify-center w-12 py-1 rounded-lg bg-cinema-800 border border-cinema-700">
                  <span className="text-sm font-extrabold text-white font-mono">
                    {String(countdown.hours).padStart(2, "0")}
                  </span>
                  <span className="text-[8px] text-cinema-400 uppercase">Giờ</span>
                </div>
                <span className="text-brand font-bold text-xs">:</span>

                <div className="flex flex-col items-center justify-center w-12 py-1 rounded-lg bg-cinema-800 border border-cinema-700">
                  <span className="text-sm font-extrabold text-white font-mono">
                    {String(countdown.minutes).padStart(2, "0")}
                  </span>
                  <span className="text-[8px] text-cinema-400 uppercase">Phút</span>
                </div>
                <span className="text-brand font-bold text-xs">:</span>

                <div className="flex flex-col items-center justify-center w-12 py-1 rounded-lg bg-cinema-800 border border-cinema-700">
                  <span className="text-sm font-extrabold text-amber-400 font-mono">
                    {String(countdown.seconds).padStart(2, "0")}
                  </span>
                  <span className="text-[8px] text-cinema-400 uppercase">Giây</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
          <button
            type="button"
            onClick={handleToggle}
            className={cn(
              "w-full sm:flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md",
              hasReminder
                ? "bg-brand text-cinema-950 hover:bg-brand/90"
                : "bg-cinema-800 text-white border border-brand/50 hover:bg-brand hover:text-cinema-950"
            )}
          >
            {hasReminder ? (
              <>
                <BellRing className="w-3.5 h-3.5" />
                <span>Đã Bật Nhắc Nhở</span>
              </>
            ) : (
              <>
                <Bell className="w-3.5 h-3.5 text-brand group-hover:text-cinema-950" />
                <span>Nhắc Tôi Khi Có Tập Này</span>
              </>
            )}
          </button>

          {latestReleasedEpisode && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onSelectEpisode(latestReleasedEpisode);
              }}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 py-2.5 px-3.5 rounded-xl text-xs font-semibold bg-cinema-800 hover:bg-cinema-750 text-cinema-200 hover:text-white border border-cinema-700 transition-colors cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Xem Tập {latestReleasedEpisode.episodeNumber}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
