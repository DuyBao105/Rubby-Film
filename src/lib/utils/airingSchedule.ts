export interface AiringScheduleInfo {
  isOngoing: boolean;
  totalEpisodes: number;
  currentEpisodeCount: number;
  nextEpisodeNumber: number;
  scheduleText: string;
  nextAirDate: Date;
  formattedNextAirDate: string;
  rawShowtimes?: string;
  rawNotify?: string;
}

export interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isPast: boolean;
}

/**
 * Determine if a series has future unreleased episodes
 */
export function getAiringSchedule(movie: {
  id?: string;
  slug?: string;
  title?: string;
  type?: string;
  totalEpisodes?: number;
  currentEpisode?: string;
  episodes?: Array<{ episodeNumber: number }>;
  showtimes?: string;
  notify?: string;
}): AiringScheduleInfo | null {
  if (movie.type !== "series") return null;

  const episodes = movie.episodes || [];
  const currentEpCount = episodes.length;
  const maxEpNumber = episodes.reduce((max, ep) => Math.max(max, ep.episodeNumber || 0), 0);

  // Check if current episode string signals completion
  const currentEpStr = (movie.currentEpisode || "").trim().toLowerCase();
  const isMarkedCompleted =
    currentEpStr.includes("hoàn tất") ||
    currentEpStr.includes("full") ||
    currentEpStr.includes("trọn bộ") ||
    currentEpStr.includes("tập cuối");

  // Determine total episodes
  let totalEpisodes = movie.totalEpisodes && movie.totalEpisodes > 0 ? movie.totalEpisodes : 0;

  // Try parsing pattern like "Tập 2/6" or "2/12"
  if (!totalEpisodes && movie.currentEpisode) {
    const match = movie.currentEpisode.match(/(\d+)\s*[/|trong]\s*(\d+)/i);
    if (match && match[2]) {
      const parsed = parseInt(match[2], 10);
      if (parsed > 0) totalEpisodes = parsed;
    }
  }

  // If already completed or total is fully reached
  if (isMarkedCompleted && totalEpisodes > 0 && maxEpNumber >= totalEpisodes) {
    return null;
  }

  // If totalEpisodes is known and we already have all episodes
  if (totalEpisodes > 0 && maxEpNumber >= totalEpisodes) {
    return null;
  }

  // If totalEpisodes not known yet, estimate if ongoing
  if (totalEpisodes <= 0) {
    if (isMarkedCompleted) return null;
    totalEpisodes = Math.max(maxEpNumber + 4, 12);
  }

  const nextEpisodeNumber = maxEpNumber + 1;
  if (nextEpisodeNumber > totalEpisodes) return null;

  // Compute next air date
  const now = new Date();
  let nextAirDate: Date;
  let scheduleText = "";

  const showtimes = movie.showtimes?.trim() || "";
  const notify = movie.notify?.trim() || "";

  // 1. Try extracting day of week and time from showtimes / notify
  const textToParse = `${showtimes} ${notify}`.toLowerCase();

  const weekdayMap: Record<string, number> = {
    "chủ nhật": 0,
    "thứ 2": 1,
    "thứ hai": 1,
    "thứ 3": 2,
    "thứ ba": 2,
    "thứ 4": 3,
    "thứ tư": 3,
    "thứ 5": 4,
    "thứ năm": 4,
    "thứ 6": 5,
    "thứ sáu": 5,
    "thứ 7": 6,
    "thứ bảy": 6,
  };

  let matchedDay: number | null = null;
  for (const [dayName, dayNum] of Object.entries(weekdayMap)) {
    if (textToParse.includes(dayName)) {
      matchedDay = dayNum;
      break;
    }
  }

  // Parse hour if specified, e.g. "20h", "20:00", "21:30"
  let airHour = 20;
  let airMinute = 0;
  const timeMatch = textToParse.match(/(\d{1,2})[h:](\d{0,2})/);
  if (timeMatch) {
    const h = parseInt(timeMatch[1], 10);
    const m = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    if (h >= 0 && h <= 23) airHour = h;
    if (m >= 0 && m <= 59) airMinute = m;
  }

  if (matchedDay !== null) {
    // Find next occurrence of this weekday
    const target = new Date(now);
    target.setHours(airHour, airMinute, 0, 0);

    const currentDay = now.getDay();
    let daysUntil = (matchedDay - currentDay + 7) % 7;
    if (daysUntil === 0 && target.getTime() <= now.getTime()) {
      daysUntil = 7;
    }
    target.setDate(now.getDate() + daysUntil);
    nextAirDate = target;

    const dayLabels = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
    scheduleText = showtimes || `Phát sóng lúc ${String(airHour).padStart(2, "0")}:${String(airMinute).padStart(2, "0")} ${dayLabels[matchedDay]} hàng tuần`;
  } else {
    // If no specific weekday found in text
    if (showtimes) {
      scheduleText = showtimes;
    } else if (notify) {
      scheduleText = notify;
    } else {
      scheduleText = "Cập nhật tập mới vào 20:00 Thứ Sáu & Thứ Bảy hàng tuần";
    }

    // Deterministically pick a target air day based on movie ID/slug so countdown doesn't jump randomly
    const key = movie.id || movie.slug || movie.title || "default";
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = (hash * 31 + key.charCodeAt(i)) & 0xffff;
    }
    const targetWeekday = 5; // Friday default (popular broadcast day)

    const target = new Date(now);
    target.setHours(20, 0, 0, 0);
    const currentDay = now.getDay();
    let daysUntil = (targetWeekday - currentDay + 7) % 7;
    if (daysUntil === 0 && target.getTime() <= now.getTime()) {
      daysUntil = 7;
    }
    target.setDate(now.getDate() + daysUntil);
    nextAirDate = target;
  }

  // Format readable next air date
  const dayOfWeekNames = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
  const formattedDay = dayOfWeekNames[nextAirDate.getDay()];
  const formattedDate = `${String(nextAirDate.getDate()).padStart(2, "0")}/${String(nextAirDate.getMonth() + 1).padStart(2, "0")}`;
  const formattedTime = `${String(nextAirDate.getHours()).padStart(2, "0")}:${String(nextAirDate.getMinutes()).padStart(2, "0")}`;
  const formattedNextAirDate = `${formattedTime}, ${formattedDay} (${formattedDate})`;

  return {
    isOngoing: true,
    totalEpisodes,
    currentEpisodeCount: maxEpNumber,
    nextEpisodeNumber,
    scheduleText,
    nextAirDate,
    formattedNextAirDate,
    rawShowtimes: showtimes || undefined,
    rawNotify: notify || undefined,
  };
}

/**
 * Calculate remaining time until target date
 */
export function getTimeRemaining(targetDate: Date): TimeRemaining {
  const totalMs = targetDate.getTime() - Date.now();
  if (totalMs <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true };
  }

  const seconds = Math.floor((totalMs / 1000) % 60);
  const minutes = Math.floor((totalMs / 1000 / 60) % 60);
  const hours = Math.floor((totalMs / (1000 * 60 * 60)) % 24);
  const days = Math.floor(totalMs / (1000 * 60 * 60 * 24));

  return {
    days,
    hours,
    minutes,
    seconds,
    isPast: false,
  };
}

const REMINDERS_KEY = "rubbyfilm_episode_reminders";

export interface EpisodeReminderItem {
  id: string; // `${movieId}:${episodeNumber}`
  movieId: string;
  movieSlug?: string;
  movieTitle?: string;
  episodeNumber: number;
  scheduledAirDate?: string;
  targetTimestamp?: number;
  notified?: boolean;
  createdAt: number;
}

/**
 * Request native browser notification permission
 */
export async function requestBrowserNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission !== "denied") {
    try {
      const perm = await Notification.requestPermission();
      return perm === "granted";
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Send native system/browser notification if permitted
 */
export function sendNativeNotification(title: string, body: string, url?: string): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "granted") {
    try {
      const n = new Notification(title, {
        body,
        icon: "/icon.png",
      });
      if (url) {
        n.onclick = () => {
          window.focus();
          window.location.href = url;
        };
      }
    } catch {}
  }
}

/**
 * Get all stored reminders
 */
export function getStoredReminders(): EpisodeReminderItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(REMINDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item: any) => {
      if (typeof item === "string") {
        const [movieId, epStr] = item.split(":");
        return {
          id: item,
          movieId,
          episodeNumber: parseInt(epStr, 10) || 1,
          createdAt: Date.now(),
        };
      }
      return item;
    });
  } catch {
    return [];
  }
}

/**
 * Check if user subscribed to notifications for an episode
 */
export function isEpisodeReminderSet(movieId: string, episodeNumber: number): boolean {
  if (typeof window === "undefined") return false;
  const list = getStoredReminders();
  const key = `${movieId}:${episodeNumber}`;
  return list.some((item) => item.id === key);
}

/**
 * Toggle reminder for an upcoming episode with metadata & browser notification request
 */
export async function toggleEpisodeReminder(options: {
  movieId: string;
  movieSlug?: string;
  movieTitle?: string;
  episodeNumber: number;
  targetTimestamp?: number;
  scheduledAirDate?: string;
}): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const { movieId, movieSlug, movieTitle, episodeNumber, targetTimestamp, scheduledAirDate } = options;
  const key = `${movieId}:${episodeNumber}`;
  const list = getStoredReminders();
  const idx = list.findIndex((item) => item.id === key);

  if (idx >= 0) {
    // Remove reminder
    list.splice(idx, 1);
    localStorage.setItem(REMINDERS_KEY, JSON.stringify(list));
    return false;
  } else {
    // Add reminder & request browser permission
    await requestBrowserNotificationPermission();

    const newItem: EpisodeReminderItem = {
      id: key,
      movieId,
      movieSlug,
      movieTitle,
      episodeNumber,
      targetTimestamp,
      scheduledAirDate,
      notified: false,
      createdAt: Date.now(),
    };
    list.push(newItem);
    localStorage.setItem(REMINDERS_KEY, JSON.stringify(list));

    // Send a polite initial confirmation if browser notification granted
    sendNativeNotification(
      "RubyFilm - Đã Bật Nhắc Nhở",
      `Bạn sẽ nhận được thông báo ngay khi Tập ${episodeNumber} của "${movieTitle || "phim"}" phát sóng!`
    );

    return true;
  }
}

/**
 * Check for reminders whose air time has arrived and trigger callback
 */
export function checkAndNotifyDueReminders(
  callback: (reminder: EpisodeReminderItem) => void
): void {
  if (typeof window === "undefined") return;
  const list = getStoredReminders();
  const now = Date.now();
  let hasChanges = false;

  list.forEach((rem) => {
    if (rem.targetTimestamp && now >= rem.targetTimestamp && !rem.notified) {
      rem.notified = true;
      hasChanges = true;

      // Trigger native notification
      sendNativeNotification(
        "🎉 Tập Mới Đã Lên Sóng!",
        `Tập ${rem.episodeNumber} của "${rem.movieTitle || "phim bạn theo dõi"}" đã sẵn sàng. Xem ngay!`,
        rem.movieSlug ? `/watch/${rem.movieSlug}?episode=${rem.episodeNumber}` : undefined
      );

      // Trigger UI callback (e.g. Toast)
      callback(rem);
    }
  });

  if (hasChanges) {
    localStorage.setItem(REMINDERS_KEY, JSON.stringify(list));
  }
}
