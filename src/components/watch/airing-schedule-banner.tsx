"use client";

import * as React from "react";
import { Bell, BellRing, Calendar, Clock, Sparkles } from "lucide-react";
import {
  AiringScheduleInfo,
  getTimeRemaining,
  isEpisodeReminderSet,
  toggleEpisodeReminder,
  checkAndNotifyDueReminders,
  TimeRemaining,
} from "@/lib/utils/airingSchedule";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

interface AiringScheduleBannerProps {
  movieId: string;
  movieTitle?: string;
  schedule: AiringScheduleInfo;
  className?: string;
  compact?: boolean;
}

export function AiringScheduleBanner({
  movieId,
  movieTitle,
  schedule,
  className,
  compact = false,
}: AiringScheduleBannerProps) {
  const toast = useToast();
  const [isMounted, setIsMounted] = React.useState(false);
  const [remaining, setRemaining] = React.useState<TimeRemaining>(() =>
    getTimeRemaining(schedule.nextAirDate)
  );
  const [isReminderActive, setIsReminderActive] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  // Sync reminder state on mount
  React.useEffect(() => {
    if (!isMounted) return;
    setIsReminderActive(isEpisodeReminderSet(movieId, schedule.nextEpisodeNumber));
  }, [movieId, schedule.nextEpisodeNumber, isMounted]);

  // Live countdown timer ticking every 1000ms
  React.useEffect(() => {
    const updateCountdown = () => {
      setRemaining(getTimeRemaining(schedule.nextAirDate));
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [schedule.nextAirDate]);

  // Periodically check if any subscribed episode has reached air date
  React.useEffect(() => {
    const notifyHandler = () => {
      checkAndNotifyDueReminders((dueRem) => {
        toast.success(
          "🎉 Tập mới đã lên sóng!",
          `Tập ${dueRem.episodeNumber} của "${dueRem.movieTitle || "phim bạn theo dõi"}" đã sẵn sàng!`
        );
      });
    };

    notifyHandler();
    const interval = setInterval(notifyHandler, 30000);
    return () => clearInterval(interval);
  }, [toast]);

  const handleToggleReminder = async () => {
    const nextState = await toggleEpisodeReminder({
      movieId,
      movieTitle,
      episodeNumber: schedule.nextEpisodeNumber,
      targetTimestamp: schedule.nextAirDate.getTime(),
      scheduledAirDate: schedule.formattedNextAirDate,
    });
    setIsReminderActive(nextState);

    if (nextState) {
      toast.success(
        "Đã bật nhắc nhở!",
        `Bạn sẽ nhận được thông báo khi Tập ${schedule.nextEpisodeNumber} phát sóng.`
      );
    } else {
      toast.info(
        "Đã tắt nhắc nhở",
        `Đã hủy nhận thông báo cho Tập ${schedule.nextEpisodeNumber}.`
      );
    }
  };

  if (compact) {
    return (
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-gradient-to-r from-cinema-900/90 via-cinema-850 to-cinema-900 border border-brand/30 shadow-lg backdrop-blur-md",
          className
        )}
      >
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-brand/15 text-brand border border-brand/30 flex-shrink-0">
            <Calendar className="w-4 h-4" />
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-brand"></span>
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-white">
                Tập {schedule.nextEpisodeNumber} phát sóng:
              </span>
              <span className="text-xs font-semibold text-brand">
                {schedule.formattedNextAirDate}
              </span>
            </div>
            <p className="text-[11px] text-cinema-400 line-clamp-1">{schedule.scheduleText}</p>
          </div>
        </div>

        {/* Action Button - Mobile full width or auto */}
        <button
          type="button"
          onClick={handleToggleReminder}
          className={cn(
            "w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer",
            isReminderActive
              ? "bg-brand text-cinema-950 font-bold hover:bg-brand/90 shadow-md shadow-brand/20"
              : "bg-cinema-800 text-cinema-200 border border-cinema-700 hover:bg-cinema-750 hover:text-white hover:border-brand/40"
          )}
        >
          {isReminderActive ? (
            <>
              <BellRing className="w-3.5 h-3.5" />
              <span>Đã Bật Nhắc Nhở</span>
            </>
          ) : (
            <>
              <Bell className="w-3.5 h-3.5 text-brand" />
              <span>Nhắc Tôi Khi Có Tập</span>
            </>
          )}
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-brand/35 bg-gradient-to-br from-cinema-900/95 via-cinema-850/90 to-cinema-900/95 p-4 sm:p-5 shadow-2xl backdrop-blur-md",
        className
      )}
    >
      {/* Decorative background glow */}
      <div className="absolute -right-12 -top-12 w-48 h-48 bg-brand/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -left-12 -bottom-12 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 space-y-3.5">
        {/* Header: Badge & Status */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-brand/15 text-brand border border-brand/35">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-brand"></span>
            </span>
            Lịch Phát Sóng
          </span>

          <span className="text-xs text-cinema-300 font-medium bg-white/[0.04] px-2.5 py-1 rounded-lg border border-white/5">
            Đang chiếu: <strong className="text-white font-bold">{schedule.currentEpisodeCount}</strong> /{" "}
            {schedule.totalEpisodes} tập
          </span>
        </div>

        {/* Next Episode Title & Schedule Text */}
        <div className="space-y-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-sm sm:text-base font-bold text-white">Tập tiếp theo:</span>
            <span className="text-base sm:text-lg font-black text-brand tracking-wide">
              Tập {schedule.nextEpisodeNumber}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-cinema-300">
            <Clock className="w-3.5 h-3.5 text-brand flex-shrink-0" />
            <span>{schedule.scheduleText}</span>
          </div>
        </div>

        {/* Countdown Timer - Clean 4 equal columns spanning 100% width */}
        {!remaining.isPast && (
          <div suppressHydrationWarning className="grid grid-cols-4 gap-2 select-none w-full pt-0.5">
            {/* Days */}
            <div className="flex flex-col items-center justify-center py-2 px-1 rounded-xl bg-cinema-800/85 border border-cinema-700/80 shadow-inner group/box hover:border-brand/40 transition-colors">
              <span suppressHydrationWarning className="text-base sm:text-lg font-black text-brand font-mono leading-none">
                {isMounted ? String(remaining.days).padStart(2, "0") : "--"}
              </span>
              <span className="text-[10px] text-cinema-400 font-semibold uppercase tracking-wider mt-1">
                Ngày
              </span>
            </div>

            {/* Hours */}
            <div className="flex flex-col items-center justify-center py-2 px-1 rounded-xl bg-cinema-800/85 border border-cinema-700/80 shadow-inner group/box hover:border-brand/40 transition-colors">
              <span suppressHydrationWarning className="text-base sm:text-lg font-black text-white font-mono leading-none">
                {isMounted ? String(remaining.hours).padStart(2, "0") : "--"}
              </span>
              <span className="text-[10px] text-cinema-400 font-semibold uppercase tracking-wider mt-1">
                Giờ
              </span>
            </div>

            {/* Minutes */}
            <div className="flex flex-col items-center justify-center py-2 px-1 rounded-xl bg-cinema-800/85 border border-cinema-700/80 shadow-inner group/box hover:border-brand/40 transition-colors">
              <span suppressHydrationWarning className="text-base sm:text-lg font-black text-white font-mono leading-none">
                {isMounted ? String(remaining.minutes).padStart(2, "0") : "--"}
              </span>
              <span className="text-[10px] text-cinema-400 font-semibold uppercase tracking-wider mt-1">
                Phút
              </span>
            </div>

            {/* Seconds */}
            <div className="flex flex-col items-center justify-center py-2 px-1 rounded-xl bg-cinema-800/85 border border-cinema-700/80 shadow-inner group/box hover:border-brand/40 transition-colors">
              <span suppressHydrationWarning className="text-base sm:text-lg font-black text-amber-400 font-mono leading-none">
                {isMounted ? String(remaining.seconds).padStart(2, "0") : "--"}
              </span>
              <span className="text-[10px] text-cinema-400 font-semibold uppercase tracking-wider mt-1">
                Giây
              </span>
            </div>
          </div>
        )}

        {/* Action Reminder Button - Full width in card */}
        <button
          type="button"
          onClick={handleToggleReminder}
          className={cn(
            "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md cursor-pointer whitespace-nowrap active:scale-[0.98]",
            isReminderActive
              ? "bg-brand text-cinema-950 hover:bg-brand/90 shadow-brand/20 scale-[1.01]"
              : "bg-cinema-800/90 text-white border border-brand/40 hover:bg-brand hover:text-cinema-950 hover:border-brand hover:shadow-brand/20"
          )}
        >
          {isReminderActive ? (
            <>
              <BellRing className="w-4 h-4 text-cinema-950 animate-bounce" />
              <span>Đã Bật Nhắc Nhở</span>
            </>
          ) : (
            <>
              <Bell className="w-4 h-4 text-brand group-hover:text-cinema-950" />
              <span>Nhắc Tôi Khi Có Tập Mới</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
