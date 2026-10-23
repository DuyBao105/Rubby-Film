"use client";

import * as React from "react";
import Image from "next/image";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  RotateCcw,
  RotateCw,
  Server,
  AlertTriangle,
  RefreshCw,
  FastForward,
  X,
  SkipBack,
  SkipForward,
  Settings,
  Tv,
  PictureInPicture,
  Subtitles,
  Check,
  SlidersHorizontal,
  Scan,
  Smartphone,
  ExternalLink,
  Copy,
  Zap,
  Upload,
  HelpCircle,
  Plus,
  Minus,
  Globe,
  Loader2,
} from "lucide-react";
import Hls from "hls.js";
import { VideoSource, Episode } from "@/types/movie";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { decryptStreamUrl, encryptStreamUrl } from "@/lib/utils/streamSecurity";

import { useUserProfile } from "@/lib/hooks/use-user-profile";

interface QualityOption {
  index: number; // -1 for Auto
  label: string;
  height: number;
}

export interface OnlineSubtitleTrack {
  id: string;
  lang: string;
  languageLabel: string;
  flag: string;
  releaseName: string;
  downloadUrl: string;
  format: "srt" | "vtt";
}

export interface SubtitleCue {
  id: number;
  startTime: number;
  endTime: number;
  text: string;
}

export function parseSrtOrVtt(content: string): SubtitleCue[] {
  if (!content) return [];
  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  const blocks = normalized.split(/\n\s*\n/);
  const cues: SubtitleCue[] = [];
  const timeRegex = /(?:(\d+):)?(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(?:(\d+):)?(\d{2}):(\d{2})[,.](\d{3})/;

  let cueId = 1;
  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    let timeLineIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (timeRegex.test(lines[i])) {
        timeLineIdx = i;
        break;
      }
    }

    if (timeLineIdx === -1) continue;

    const match = lines[timeLineIdx].match(timeRegex);
    if (!match) continue;

    const parseSeconds = (h: string | undefined, m: string, s: string, ms: string) => {
      const hours = h ? parseInt(h, 10) : 0;
      const minutes = parseInt(m, 10);
      const seconds = parseInt(s, 10);
      const milliseconds = parseInt(ms, 10);
      return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
    };

    const startTime = parseSeconds(match[1], match[2], match[3], match[4]);
    const endTime = parseSeconds(match[5], match[6], match[7], match[8]);
    const textLines = lines.slice(timeLineIdx + 1);
    const text = textLines
      .join("\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\{[^}]+\}/g, "")
      .trim();

    if (text && endTime > startTime) {
      cues.push({
        id: cueId++,
        startTime,
        endTime,
        text,
      });
    }
  }

  return cues;
}

interface VideoPlayerProps {
  source: VideoSource;
  sources?: VideoSource[];
  activeSourceIndex?: number;
  onSelectSourceIndex?: (index: number) => void;
  title: string;
  originalTitle?: string;
  year?: number;
  tmdbId?: string | number;
  seasonNumber?: number;
  episodeNumber?: number;
  subtitle?: string;
  posterUrl?: string;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  initialTime?: number;
  isSeries?: boolean;
  onPause?: () => void;
  onEnded?: () => void;
  hasNextEpisode?: boolean;
  onNextEpisode?: () => void;
  hasPrevEpisode?: boolean;
  onPrevEpisode?: () => void;
  autoNextEnabled?: boolean;
  autoSkipIntro?: boolean;
  skipIntroDuration?: number;
  nextEpisodeTitle?: string;
  onSwitchServer?: () => void;
  isCinemaMode?: boolean;
  onToggleCinemaMode?: () => void;
  episodes?: Episode[];
  onSelectEpisode?: (episode: Episode) => void;
}
interface WebkitHTMLVideoElement extends HTMLVideoElement {
  webkitEnterFullscreen?: () => void;
}

interface WebkitHTMLElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void>;
}

interface WebkitDocument extends Document {
  webkitFullscreenElement?: Element;
  webkitExitFullscreen?: () => Promise<void>;
}

interface ScreenOrientationWithLock extends ScreenOrientation {
  lock?: (orientation: "landscape" | "landscape-primary" | "portrait" | "natural") => Promise<void>;
}


export interface VideoPlayerHandle {
  seekTo: (timeSeconds: number) => void;
  play: () => void;
  pause: () => void;
  togglePip: () => void;
}

export const VideoPlayer = React.forwardRef<VideoPlayerHandle, VideoPlayerProps>(
  function VideoPlayer(
    {
      source,
      sources,
      activeSourceIndex = 0,
      onSelectSourceIndex,
      title,
      originalTitle,
      year,
      tmdbId,
      seasonNumber = 1,
      episodeNumber = 1,
      subtitle,
      posterUrl,
      onTimeUpdate,
      initialTime = 0,
      isSeries = false,
      onPause,
      onEnded,
      hasNextEpisode = false,
      onNextEpisode,
      hasPrevEpisode = false,
      onPrevEpisode,
      autoNextEnabled = true,
      autoSkipIntro: autoSkipIntroProp,
      skipIntroDuration: skipIntroDurationProp,
      nextEpisodeTitle,
      onSwitchServer,
      isCinemaMode = false,
      onToggleCinemaMode,
      episodes = [],
      onSelectEpisode,
    },
    ref
  ) {
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const progressBarRef = React.useRef<HTMLDivElement>(null);
    const hlsRef = React.useRef<Hls | null>(null);

    const { preferences, updatePreferences } = useUserProfile();
    const effectiveAutoSkip = autoSkipIntroProp ?? preferences.autoSkipIntro ?? false;
    const effectiveSkipDuration = skipIntroDurationProp ?? preferences.skipIntroDuration ?? 85;

    React.useImperativeHandle(ref, () => ({
      seekTo: (timeSeconds: number) => {
        if (videoRef.current) {
          try {
            videoRef.current.currentTime = timeSeconds;
            setCurrentTime(timeSeconds);
          } catch {}
        }
      },
      play: () => {
        if (videoRef.current) {
          videoRef.current.play().catch(() => {});
        }
      },
      pause: () => {
        if (videoRef.current) {
          videoRef.current.pause();
        }
      },
      togglePip: () => {
        togglePip();
      },
    }));

  const [isPlaying, setIsPlaying] = React.useState(false);
  const [hasStarted, setHasStarted] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [bufferedPercent, setBufferedPercent] = React.useState(0);
  const [volume, setVolume] = React.useState(1);
  const [isMuted, setIsMuted] = React.useState(false);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [showControls, setShowControls] = React.useState(true);
  const [playbackRate, setPlaybackRate] = React.useState(1);
  const [showSettings, setShowSettings] = React.useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = React.useState<"main" | "speed" | "quality" | "subtitle" | "audio" | "intro" | "boost">("main");
  const [videoFit, setVideoFit] = React.useState<"contain" | "cover" | "fill">("contain");
  const [isLoading, setIsLoading] = React.useState(false);
  const [hasError, setHasError] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState("");
  const [autoNextCountdown, setAutoNextCountdown] = React.useState<number | null>(null);
  const [isCssLandscape, setIsCssLandscape] = React.useState(false);
  const [isIosStandalone, setIsIosStandalone] = React.useState(false);
  const [iosPipPromptOpen, setIosPipPromptOpen] = React.useState(false);
  const [copiedToast, setCopiedToast] = React.useState(false);
  const [introDismissed, setIntroDismissed] = React.useState(false);
  const [nextEpisodeDismissed, setNextEpisodeDismissed] = React.useState(false);
  const [skipIntroToast, setSkipIntroToast] = React.useState<string | null>(null);
  const [lastSkipPreviousTime, setLastSkipPreviousTime] = React.useState<number | null>(null);
  const hasAutoSkippedRef = React.useRef(false);
  const hasTriggeredAutoNextRef = React.useRef(false);
  const isPipActiveRef = React.useRef(false);

  // Sync fullscreen state & auto unlock screen orientation
  React.useEffect(() => {
    const handleFullscreenChange = () => {
      const webkitDoc = document as WebkitDocument;
      const isFull = !!(document.fullscreenElement || webkitDoc.webkitFullscreenElement);
      setIsFullscreen(isFull);
      if (!isFull) {
        setIsCssLandscape(false);
        if (typeof screen !== "undefined" && screen.orientation && typeof screen.orientation.unlock === "function") {
          try {
            screen.orientation.unlock();
          } catch {}
        }
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
    };
  }, []);

  const cycleVideoFit = () => {
    setVideoFit((prev) => {
      if (prev === "contain") return "cover";
      if (prev === "cover") return "fill";
      return "contain";
    });
  };

  // Auto-scroll into view when cinema mode is activated
  React.useEffect(() => {
    if (isCinemaMode && containerRef.current) {
      setTimeout(() => {
        containerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
    }
  }, [isCinemaMode]);

  // Scrubber hover & drag states
  const [isScrubbing, setIsScrubbing] = React.useState(false);
  const [hoverTime, setHoverTime] = React.useState<number | null>(null);
  const [hoverPercent, setHoverPercent] = React.useState<number>(0);

  // HLS and stream qualities
  const [qualities, setQualities] = React.useState<QualityOption[]>([
    { index: -1, label: "Tự động (Khuyên dùng)", height: 0 },
    { index: 1080, label: "1080p (Full HD)", height: 1080 },
    { index: 720, label: "720p (HD)", height: 720 },
    { index: 480, label: "480p (Tiết kiệm)", height: 480 },
  ]);
  const [currentQualityIndex, setCurrentQualityIndex] = React.useState<number>(-1);
  const [qualityToast, setQualityToast] = React.useState<string | null>(null);
  const [iframeLoading, setIframeLoading] = React.useState(true);

  // Subtitle tracks
  const [subtitleTracks, setSubtitleTracks] = React.useState<{ id: number; label: string }[]>([]);
  const [currentSubtitleId, setCurrentSubtitleId] = React.useState<number>(-1); // -1 = off
  const [customCues, setCustomCues] = React.useState<SubtitleCue[]>([]);
  const [customSubtitleName, setCustomSubtitleName] = React.useState<string | null>(null);
  const [subOffset, setSubOffset] = React.useState<number>(0); // in seconds (-0.5s = earlier, +0.5s = later)
  const [subtitleFontSize, setSubtitleFontSize] = React.useState<number>(18); // px
  const [isDraggingFile, setIsDraggingFile] = React.useState<boolean>(false);
  const subFileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Online subtitles (Stremio OpenSubtitles v3 integration)
  const [onlineSubs, setOnlineSubs] = React.useState<OnlineSubtitleTrack[]>([]);
  const [isLoadingOnlineSubs, setIsLoadingOnlineSubs] = React.useState<boolean>(false);
  const [onlineSubsLoaded, setOnlineSubsLoaded] = React.useState<boolean>(false);
  const [activeOnlineSubId, setActiveOnlineSubId] = React.useState<string | null>(null);
  const [loadingSubId, setLoadingSubId] = React.useState<string | null>(null);

  // Audio Boost states (Web Audio API)
  const [audioBoost, setAudioBoost] = React.useState<number>(1); // 1 = 100%, 1.25 = 125%, 1.5 = 150%, 2 = 200%
  const audioCtxRef = React.useRef<AudioContext | null>(null);
  const gainNodeRef = React.useRef<GainNode | null>(null);
  const sourceNodeRef = React.useRef<MediaElementAudioSourceNode | null>(null);

  // Universal Player Toast
  const [playerToast, setPlayerToast] = React.useState<string | null>(null);
  const playerToastTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const triggerPlayerToast = React.useCallback((msg: string) => {
    if (playerToastTimeoutRef.current) clearTimeout(playerToastTimeoutRef.current);
    setPlayerToast(msg);
    playerToastTimeoutRef.current = setTimeout(() => {
      setPlayerToast(null);
    }, 2800);
  }, []);

  // Keyboard shortcuts modal
  const [showShortcutsModal, setShowShortcutsModal] = React.useState<boolean>(false);

  // Binge Mode Drawer state (Episodes & Servers Quick Switcher)
  const [showEpisodeDrawer, setShowEpisodeDrawer] = React.useState<boolean>(false);
  const [drawerChunkIndex, setDrawerChunkIndex] = React.useState(0);
  const CHUNK_SIZE = 40;

  const episodeChunks = React.useMemo(() => {
    if (!episodes || episodes.length === 0) return [];
    const chunks: Episode[][] = [];
    for (let i = 0; i < episodes.length; i += CHUNK_SIZE) {
      chunks.push(episodes.slice(i, i + CHUNK_SIZE));
    }
    return chunks;
  }, [episodes]);

  // Sync active chunk with current episode
  React.useEffect(() => {
    if (episodes && episodes.length > CHUNK_SIZE) {
      const idx = episodes.findIndex((e) => e.episodeNumber === episodeNumber);
      if (idx !== -1) {
        setDrawerChunkIndex(Math.floor(idx / CHUNK_SIZE));
      }
    }
  }, [episodes, episodeNumber]);

  // Auto-Failover to backup server on playback failure
  const failoverAttemptsRef = React.useRef(0);
  const hasTriedProxyRef = React.useRef(false);

  // Picture in picture support
  const [isPipSupported, setIsPipSupported] = React.useState(false);

  // Refs to prevent re-initializing playback or re-seeking during active playback
  const initialTimeRef = React.useRef(initialTime);
  const hasAppliedInitialTimeRef = React.useRef(false);
  const hasStartedRef = React.useRef(hasStarted);

  const triggerAutoFailover = React.useCallback(
    (reason: string) => {
      if (!sources || sources.length <= 1 || !onSelectSourceIndex) {
        return false;
      }

      if (failoverAttemptsRef.current >= sources.length) {
        console.warn("[Auto-Failover] All backup servers tried, stopping failover.");
        return false;
      }

      failoverAttemptsRef.current += 1;
      const nextIndex = (activeSourceIndex + 1) % sources.length;
      const currentServer = sources[activeSourceIndex]?.serverName || `Server #${activeSourceIndex + 1}`;
      const nextServer = sources[nextIndex]?.serverName || `Server #${nextIndex + 1}`;

      // Preserve playback position
      const currentPlaybackSec = videoRef.current?.currentTime || currentTime;
      if (currentPlaybackSec > 0) {
        initialTimeRef.current = currentPlaybackSec;
        hasAppliedInitialTimeRef.current = false;
      }

      triggerPlayerToast(`⚡ ${currentServer} gặp sự cố (${reason}). Đang chuyển sang ${nextServer}...`);
      onSelectSourceIndex(nextIndex);
      return true;
    },
    [sources, activeSourceIndex, onSelectSourceIndex, currentTime, triggerPlayerToast]
  );

  // Listen for failover events from internal sandboxed player (/api/player)
  React.useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === "RUBBY_STREAM_ERROR") {
        triggerAutoFailover("Máy chủ embed gặp sự cố");
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [triggerAutoFailover]);

  // Clean up Hls instance and thoroughly reset video element to prevent pipeline stall
  const destroyHls = React.useCallback(() => {
    if (hlsRef.current) {
      try {
        hlsRef.current.stopLoad();
        hlsRef.current.detachMedia();
        hlsRef.current.destroy();
      } catch {}
      hlsRef.current = null;
    }
    if (videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.removeAttribute("src");
        videoRef.current.load();
      } catch {}
    }
  }, []);

  const handleQuickSwitchServer = React.useCallback(
    (idx: number) => {
      if (idx === activeSourceIndex || !onSelectSourceIndex || !sources) return;
      const currentPlaybackSec = videoRef.current?.currentTime || currentTime;
      if (currentPlaybackSec > 0) {
        initialTimeRef.current = currentPlaybackSec;
        hasAppliedInitialTimeRef.current = false;
      }
      setIsLoading(true);
      setIframeLoading(true);
      setHasError(false);
      setErrorMessage("");
      destroyHls();
      onSelectSourceIndex(idx);
      triggerPlayerToast(`⚡ Đang kết nối ${sources[idx]?.serverName || `Server #${idx + 1}`}...`);
    },
    [activeSourceIndex, onSelectSourceIndex, sources, currentTime, triggerPlayerToast, destroyHls]
  );

  // Immediate UI feedback & media pipeline reset whenever active source changes
  const prevSourceUrlRef = React.useRef(source.url);
  const prevSourceIndexRef = React.useRef(activeSourceIndex);

  React.useEffect(() => {
    if (prevSourceUrlRef.current !== source.url || prevSourceIndexRef.current !== activeSourceIndex) {
      prevSourceUrlRef.current = source.url;
      prevSourceIndexRef.current = activeSourceIndex;

      const currentPlaybackSec = videoRef.current?.currentTime || currentTime;
      if (currentPlaybackSec > 5) {
        initialTimeRef.current = currentPlaybackSec;
        hasAppliedInitialTimeRef.current = false;
      }

      setIsLoading(true);
      setIframeLoading(true);
      setHasError(false);
      setErrorMessage("");
      const targetName = sources?.[activeSourceIndex]?.serverName || `Server #${activeSourceIndex + 1}`;
      triggerPlayerToast(`⚡ Đang kết nối ${targetName}...`);
      destroyHls();
    }
  }, [source.url, activeSourceIndex, sources, currentTime, triggerPlayerToast, destroyHls]);



  const attemptSeekToInitialTime = React.useCallback(() => {
    const video = videoRef.current;
    if (!video) return false;
    const target = initialTimeRef.current;
    if (target <= 0) return true;

    if (video.readyState >= 1 || (video.duration && !isNaN(video.duration) && video.duration > 0)) {
      try {
        const safeTarget = Math.max(0, Math.min(target, (video.duration || target + 10) - 1));
        video.currentTime = safeTarget;
        setCurrentTime(safeTarget);
        hasAppliedInitialTimeRef.current = true;
        return true;
      } catch (err) {
        console.warn("[VideoPlayer] seek to initial time failed:", err);
      }
    }
    return false;
  }, []);

  React.useEffect(() => {
    initialTimeRef.current = initialTime;
    if (initialTime === 0) {
      if (videoRef.current) {
        try {
          videoRef.current.currentTime = 0;
          setCurrentTime(0);
        } catch {}
      }
      hasAppliedInitialTimeRef.current = true;
    } else if (!hasStartedRef.current) {
      hasAppliedInitialTimeRef.current = false;
      attemptSeekToInitialTime();
    }
  }, [initialTime, attemptSeekToInitialTime]);

  React.useEffect(() => {
    hasStartedRef.current = hasStarted;
  }, [hasStarted]);

  React.useEffect(() => {
    // When source URL changes, allow seeking once for the new media
    hasAppliedInitialTimeRef.current = false;
    setIntroDismissed(false);
    setNextEpisodeDismissed(false);
    hasAutoSkippedRef.current = false;
    hasTriggeredAutoNextRef.current = false;
    setLastSkipPreviousTime(null);
    setAutoNextCountdown(null);
  }, [source.url]);

  // Tự động bỏ qua phần giới thiệu (Auto Skip Intro) khi bắt đầu phát từ đầu
  React.useEffect(() => {
    if (
      effectiveAutoSkip &&
      !hasAutoSkippedRef.current &&
      hasStarted &&
      currentTime >= 1 &&
      currentTime <= 4 &&
      duration > 180 &&
      initialTime === 0
    ) {
      hasAutoSkippedRef.current = true;
      if (videoRef.current) {
        const target = Math.min(effectiveSkipDuration, (videoRef.current.duration || 1000) - 5);
        setLastSkipPreviousTime(videoRef.current.currentTime);
        videoRef.current.currentTime = target;
        setCurrentTime(target);
        setSkipIntroToast(`Đã tự động bỏ qua phần giới thiệu (${formatTime(target)})`);
        setTimeout(() => setSkipIntroToast(null), 4000);
      }
    }
  }, [effectiveAutoSkip, effectiveSkipDuration, hasStarted, currentTime, duration, initialTime]);

  const hideControlsTimer = React.useRef<NodeJS.Timeout | null>(null);
  const autoNextTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Seek feedback animation state (+10s / -10s floating badge)
  const [seekFeedback, setSeekFeedback] = React.useState<{
    direction: "rewind" | "forward";
    time: number;
    key: number;
  } | null>(null);
  const seekFeedbackTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const lastTapRef = React.useRef<{ time: number; x: number }>({ time: 0, x: 0 });

  const triggerSeekFeedback = (direction: "rewind" | "forward", seconds: number) => {
    if (seekFeedbackTimerRef.current) clearTimeout(seekFeedbackTimerRef.current);
    setSeekFeedback({ direction, time: Math.abs(seconds), key: Date.now() });
    seekFeedbackTimerRef.current = setTimeout(() => {
      setSeekFeedback(null);
    }, 700);
  };

  React.useEffect(() => {
    if (typeof document !== "undefined") {
      if (document.pictureInPictureEnabled) {
        setIsPipSupported(true);
      }
    }
    const isIOSDevice =
      typeof navigator !== "undefined" &&
      (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

    if (typeof window !== "undefined" && isIOSDevice) {
      const isStandalone =
        Boolean((navigator as any).standalone) ||
        window.matchMedia("(display-mode: standalone)").matches;
      if (isStandalone) {
        setIsIosStandalone(true);
      }
      setIsPipSupported(true);
    }

    const video = videoRef.current;
    if (video) {
      if (
        (video as any).webkitSupportsPresentationMode &&
        typeof (video as any).webkitSupportsPresentationMode === "function" &&
        (video as any).webkitSupportsPresentationMode("picture-in-picture")
      ) {
        setIsPipSupported(true);
      }

      const handleEnterPip = () => {
        isPipActiveRef.current = true;
      };
      const handleLeavePip = () => {
        if (!hasTriggeredAutoNextRef.current) {
          isPipActiveRef.current = false;
        }
      };
      const handlePresentationModeChange = () => {
        if ((video as any).webkitPresentationMode) {
          const inPip = (video as any).webkitPresentationMode === "picture-in-picture";
          if (inPip || !hasTriggeredAutoNextRef.current) {
            isPipActiveRef.current = inPip;
          }
        }
      };

      video.addEventListener("enterpictureinpicture", handleEnterPip);
      video.addEventListener("leavepictureinpicture", handleLeavePip);
      video.addEventListener("webkitpresentationmodechanged", handlePresentationModeChange);

      const handleBeginFull = () => setIsFullscreen(true);
      const handleEndFull = () => setIsFullscreen(false);
      video.addEventListener("webkitbeginfullscreen", handleBeginFull);
      video.addEventListener("webkitendfullscreen", handleEndFull);
      return () => {
        video.removeEventListener("enterpictureinpicture", handleEnterPip);
        video.removeEventListener("leavepictureinpicture", handleLeavePip);
        video.removeEventListener("webkitpresentationmodechanged", handlePresentationModeChange);
        video.removeEventListener("webkitbeginfullscreen", handleBeginFull);
        video.removeEventListener("webkitendfullscreen", handleEndFull);
      };
    }
  }, []);


  // Tự động mở chế độ PiP (hình trong hình) khi vuốt ra màn hình chính trên iOS / trình duyệt hỗ trợ
  React.useEffect(() => {
    const handleVisibilityChange = () => {
      const video = videoRef.current;
      if (!video) return;
      if (document.visibilityState === "hidden" && !video.paused) {
        if (
          (video as any).webkitSetPresentationMode &&
          (video as any).webkitSupportsPresentationMode &&
          (video as any).webkitSupportsPresentationMode("picture-in-picture")
        ) {
          try {
            (video as any).webkitSetPresentationMode("picture-in-picture");
          } catch {}
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const resetControlsTimeout = React.useCallback(() => {
    setShowControls(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    if (isPlaying && !showSettings && !isScrubbing) {
      hideControlsTimer.current = setTimeout(() => {
        setShowControls(false);
      }, 3500);
    }
  }, [isPlaying, showSettings, isScrubbing]);

  // Initialize playback or Hls stream
  const initPlayer = React.useCallback(() => {
    setHasError(false);
    setErrorMessage("");
    setIsLoading(true);
    setQualities([]);
    destroyHls();
    hasTriedProxyRef.current = false;

    const video = videoRef.current;
    if (!video) return;

    // Tự động chuyển máy chủ nếu máy chủ hiện tại không có link phát
    if (!source || !source.url || typeof source.url !== "string" || !source.url.trim()) {
      console.warn("[VideoPlayer] Máy chủ hiện tại không có link phát, tự động chuyển máy chủ dự phòng...");
      const switched = triggerAutoFailover("Máy chủ không có link phát");
      if (!switched) {
        setHasError(true);
        setErrorMessage("Máy chủ này hiện chưa có link phát. Vui lòng chọn máy chủ khác.");
        setIsLoading(false);
      }
      return;
    }

    const rawStreamUrl = decryptStreamUrl(source.url);
    if (!rawStreamUrl) {
      console.warn("[VideoPlayer] Link phát không hợp lệ hoặc không giải mã được, tự động chuyển máy chủ...");
      const switched = triggerAutoFailover("Link phát không hợp lệ");
      if (!switched) {
        setHasError(true);
        setErrorMessage("Link phát của máy chủ này không hợp lệ. Vui lòng chuyển sang máy chủ khác.");
        setIsLoading(false);
      }
      return;
    }

    const isHls =
      source.type === "hls" ||
      (rawStreamUrl && (rawStreamUrl.includes(".m3u8") || rawStreamUrl.includes("hls")));

    const streamToken = source.url.startsWith("http")
      ? encryptStreamUrl(source.url)
      : source.url;
    const proxiedStreamUrl = `/api/stream?s=${encodeURIComponent(streamToken)}`;

    // Direct CDN stream URL: 0ms proxy overhead, maximum CDN streaming bandwidth
    const directUrl = rawStreamUrl && rawStreamUrl.startsWith("http") ? rawStreamUrl : null;
    const streamToLoad = directUrl || proxiedStreamUrl;

    if (isHls) {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          manifestLoadingTimeOut: 3500,
          manifestLoadingMaxRetry: 1,
          manifestLoadingRetryDelay: 300,
          levelLoadingTimeOut: 3500,
          levelLoadingMaxRetry: 1,
          fragLoadingTimeOut: 5000,
          fragLoadingMaxRetry: 2,
          backBufferLength: 30,
          maxBufferLength: 20,
          maxMaxBufferLength: 40,
          maxBufferSize: 30 * 1000 * 1000,
          startLevel: -1,
          capLevelToPlayerSize: true,
          progressive: true,
          startFragPrefetch: true,
          maxBufferHole: 0.5,
          nudgeOffset: 0.1,
          nudgeMaxRetry: 3,
        });
        hlsRef.current = hls;

        hls.loadSource(streamToLoad);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsLoading(false);
          failoverAttemptsRef.current = 0;

          // Detect genuine HLS quality levels
          if (hls.levels && hls.levels.length > 1) {
            const parsedQualities: QualityOption[] = [
              { index: -1, label: "Tự động (Auto)", height: 0 },
              ...hls.levels.map((lvl, idx) => ({
                index: idx,
                label: `${lvl.height}p${lvl.height >= 1080 ? " (Full HD)" : lvl.height >= 720 ? " (HD)" : ""}`,
                height: lvl.height,
              })).sort((a, b) => b.height - a.height),
            ];
            setQualities(parsedQualities);
          } else {
            // Keep default adaptive stream qualities
            setQualities([
              { index: -1, label: "Tự động (Khuyên dùng)", height: 0 },
              { index: 1080, label: "1080p (Full HD)", height: 1080 },
              { index: 720, label: "720p (HD)", height: 720 },
              { index: 480, label: "480p (Tiết kiệm)", height: 480 },
            ]);
          }

          if (!hasAppliedInitialTimeRef.current && initialTimeRef.current > 0) {
            attemptSeekToInitialTime();
          }
          if (hasStartedRef.current) {
            video.play().catch(() => {});
          } else {
            // Attempt autoplay when entering watch page
            video
              .play()
              .then(() => {
                setHasStarted(true);
                setIsPlaying(true);
              })
              .catch(() => {
                // Browser requires user gesture - poster play overlay remains active
              });
          }
        });

        // Detect embedded HLS WebVTT subtitle tracks
        hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_, data) => {
          if (data && Array.isArray(data.subtitleTracks) && data.subtitleTracks.length > 0) {
            setSubtitleTracks(
              data.subtitleTracks.map((t, idx) => ({
                id: idx,
                label: t.name || t.lang || `Phụ đề #${idx + 1}`,
              }))
            );
          }
        });

        let mediaErrorCount = 0;
        let networkErrorCount = 0;
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                networkErrorCount++;
                const isManifestOrCors =
                  data.details === "manifestLoadError" ||
                  data.details === "manifestLoadTimeOut" ||
                  data.details === "levelLoadError" ||
                  data.details === "levelLoadTimeOut" ||
                  (Boolean(data.response && typeof data.response.code === "number" && (data.response.code === 0 || data.response.code >= 400)));

                const is404 = Boolean(data.response && data.response.code === 404);

                if (is404 || isManifestOrCors || networkErrorCount > 1) {
                  // If direct CDN failed with manifest/CORS (and not a dead 404), try proxiedStreamUrl before failover
                  if (!is404 && streamToLoad === directUrl && proxiedStreamUrl && !hasTriedProxyRef.current) {
                    hasTriedProxyRef.current = true;
                    console.warn("[HLS] Direct CDN failed, falling back to proxy stream:", proxiedStreamUrl);
                    hls.loadSource(proxiedStreamUrl);
                    hls.startLoad();
                    return;
                  }

                  destroyHls();
                  const switched = triggerAutoFailover(
                    is404
                      ? "Nguồn phim bị lỗi 404 từ nhà cung cấp"
                      : isManifestOrCors
                      ? "Máy chủ bận, tự động chuyển"
                      : "Mạng bị gián đoạn"
                  );
                  if (!switched) {
                    setHasError(true);
                    setErrorMessage(
                      is404
                        ? "Máy chủ này hiện đang bị lỗi 404 từ nhà cung cấp gốc. Vui lòng chuyển sang máy chủ khác."
                        : "Đường truyền video bị gián đoạn. Vui lòng kiểm tra mạng hoặc đổi server."
                    );
                    setIsLoading(false);
                  }
                } else {
                  console.warn("HLS network error, recovering...", data);
                  hls.startLoad();
                }
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                mediaErrorCount++;
                if (mediaErrorCount <= 2) {
                  console.warn("HLS media error, recovering...", data);
                  hls.recoverMediaError();
                } else {
                  destroyHls();
                  const switched = triggerAutoFailover("Lỗi giải mã luồng video");
                  if (!switched) {
                    setHasError(true);
                    setErrorMessage("Không thể giải mã luồng video này. Vui lòng đổi server khác.");
                    setIsLoading(false);
                  }
                }
                break;
              default:
                destroyHls();
                const switched = triggerAutoFailover("Không thể tải luồng phát");
                if (!switched) {
                  setHasError(true);
                  setErrorMessage("Không thể tải luồng video HLS này. Vui lòng thử lại hoặc đổi server.");
                  setIsLoading(false);
                }
                break;
            }
          }
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        // Native Safari HLS
        video.src = streamToLoad;
        if (!hasAppliedInitialTimeRef.current && initialTimeRef.current > 0) {
          attemptSeekToInitialTime();
        }
        video
          .play()
          .then(() => {
            setHasStarted(true);
            setIsPlaying(true);
          })
          .catch(() => {});
      } else {
        setHasError(true);
        setErrorMessage("Trình duyệt không hỗ trợ giải mã định dạng video HLS.");
        setIsLoading(false);
      }
    } else {
      // Direct MP4 or video source
      video.src = proxiedStreamUrl;
      if (!hasAppliedInitialTimeRef.current && initialTimeRef.current > 0) {
        attemptSeekToInitialTime();
      }
      video
        .play()
        .then(() => {
          setHasStarted(true);
          setIsPlaying(true);
        })
        .catch(() => {});
    }
  }, [source.url, source.type, attemptSeekToInitialTime]);

  // Effect when source changes
  React.useEffect(() => {
    if (source.type !== "embed") {
      initPlayer();
    }
    return () => {
      destroyHls();
    };
  }, [source.url, source.type, initPlayer]);

  // Audio Boost Web Audio API implementation
  const applyAudioBoost = React.useCallback((multiplier: number) => {
    try {
      const video = videoRef.current;
      if (!video) return;

      if (!audioCtxRef.current) {
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextClass) return;
        const ctx = new AudioContextClass();
        const gain = ctx.createGain();
        const sourceNode = ctx.createMediaElementSource(video);
        sourceNode.connect(gain);
        gain.connect(ctx.destination);

        audioCtxRef.current = ctx;
        gainNodeRef.current = gain;
        sourceNodeRef.current = sourceNode;
      }

      if (audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume().catch(() => {});
      }

      if (gainNodeRef.current) {
        gainNodeRef.current.gain.value = multiplier;
        setAudioBoost(multiplier);
        triggerPlayerToast(
          multiplier > 1
            ? `🚀 Audio Boost: ${Math.round(multiplier * 100)}%`
            : "Âm lượng: 100% (Mặc định)"
        );
      }
    } catch (err) {
      console.warn("Could not enable Audio Boost:", err);
      triggerPlayerToast("⚠️ Máy chủ này chưa hỗ trợ Audio Boost qua Web Audio");
    }
  }, [triggerPlayerToast]);

  const cycleAudioBoost = React.useCallback(() => {
    const levels = [1, 1.25, 1.5, 2];
    const currentIndex = levels.indexOf(audioBoost);
    const nextLevel = levels[(currentIndex + 1) % levels.length];
    applyAudioBoost(nextLevel);
  }, [audioBoost, applyAudioBoost]);

  // Clean up Web Audio Context on unmount
  React.useEffect(() => {
    return () => {
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  // Subtitle file & offset handling
  const handleLoadSubtitleFile = React.useCallback((file: File) => {
    if (!file.name.match(/\.(srt|vtt)$/i)) {
      triggerPlayerToast("⚠️ Vui lòng chọn file .srt hoặc .vtt");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const cues = parseSrtOrVtt(text);
        if (cues.length === 0) {
          triggerPlayerToast("⚠️ Không tìm thấy dòng phụ đề hợp lệ");
          return;
        }
        setCustomCues(cues);
        setCustomSubtitleName(file.name);
        setCurrentSubtitleId(9999);
        setActiveOnlineSubId(null);
        setSubOffset(0);
        setShowSettings(false);
        setActiveSettingsTab("main");
        triggerPlayerToast(`✓ Đã nạp ${cues.length} câu sub: ${file.name}`);
      } catch {
        triggerPlayerToast("⚠️ Lỗi khi đọc file phụ đề");
      }
    };
    reader.readAsText(file, "UTF-8");
  }, [triggerPlayerToast]);

  const adjustSubOffset = React.useCallback((delta: number) => {
    setSubOffset((prev) => {
      const next = Math.round((prev + delta) * 10) / 10;
      const text =
        next > 0
          ? `+${next}s (Hiện chậm hơn)`
          : next < 0
          ? `${next}s (Hiện sớm hơn)`
          : "0.0s (Chuẩn)";
      triggerPlayerToast(`Đồng bộ phụ đề: ${text}`);
      return next;
    });
  }, [triggerPlayerToast]);

  const activeSubtitleText = React.useMemo(() => {
    if (currentSubtitleId !== 9999 || customCues.length === 0) return null;
    const adjusted = currentTime - subOffset;
    const matches = customCues.filter((c) => adjusted >= c.startTime && adjusted <= c.endTime);
    if (matches.length === 0) return null;
    return matches.map((m) => m.text).join("\n");
  }, [currentSubtitleId, customCues, currentTime, subOffset]);

  // Fetch online subtitles via /api/subtitles
  const fetchOnlineSubtitles = React.useCallback(async () => {
    if (isLoadingOnlineSubs) return;
    setIsLoadingOnlineSubs(true);
    try {
      const params = new URLSearchParams();
      if (title) params.set("title", title);
      if (originalTitle) params.set("originalTitle", originalTitle);
      if (year) params.set("year", String(year));
      if (tmdbId) params.set("tmdbId", String(tmdbId));
      if (isSeries) {
        params.set("type", "series");
        params.set("season", String(seasonNumber || 1));
        params.set("episode", String(episodeNumber || 1));
      } else {
        params.set("type", "movie");
      }

      const res = await fetch(`/api/subtitles?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.subtitles)) {
          setOnlineSubs(data.subtitles);
        }
      }
    } catch (err) {
      console.warn("[VideoPlayer] Failed to load online subtitles:", err);
    } finally {
      setIsLoadingOnlineSubs(false);
      setOnlineSubsLoaded(true);
    }
  }, [title, originalTitle, year, tmdbId, isSeries, seasonNumber, episodeNumber, isLoadingOnlineSubs]);

  // Reset online subs cache when episode or title changes
  React.useEffect(() => {
    setOnlineSubsLoaded(false);
    setOnlineSubs([]);
    setActiveOnlineSubId(null);
  }, [seasonNumber, episodeNumber, title]);

  // Auto-fetch when user enters subtitle tab
  React.useEffect(() => {
    if (activeSettingsTab === "subtitle" && !onlineSubsLoaded && !isLoadingOnlineSubs) {
      fetchOnlineSubtitles();
    }
  }, [activeSettingsTab, onlineSubsLoaded, isLoadingOnlineSubs, fetchOnlineSubtitles]);

  // Select online subtitle (1-click stream)
  const selectOnlineSubtitle = React.useCallback(async (sub: OnlineSubtitleTrack) => {
    try {
      setLoadingSubId(sub.id);
      const downloadProxyUrl = `/api/subtitles/download?url=${encodeURIComponent(sub.downloadUrl)}`;
      const res = await fetch(downloadProxyUrl);
      if (!res.ok) throw new Error("Tải phụ đề thất bại");
      const text = await res.text();
      const parsed = parseSrtOrVtt(text);
      if (parsed.length === 0) {
        triggerPlayerToast("⚠️ Không phân tích được nội dung phụ đề này");
        return;
      }
      setCustomCues(parsed);
      setCustomSubtitleName(`${sub.flag} ${sub.languageLabel}`);
      setActiveOnlineSubId(sub.id);
      setCurrentSubtitleId(9999);
      setSubOffset(0);
      setShowSettings(false);
      setActiveSettingsTab("main");
      triggerPlayerToast(`✓ Đã bật phụ đề: ${sub.flag} ${sub.languageLabel} (${parsed.length} câu)`);
    } catch (err) {
      console.error("[VideoPlayer] selectOnlineSubtitle error:", err);
      triggerPlayerToast("⚠️ Lỗi khi nạp phụ đề, vui lòng thử bản dịch khác");
    } finally {
      setLoadingSubId(null);
    }
  }, [triggerPlayerToast]);

  const turnOffSubtitles = React.useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.subtitleTrack = -1;
    }
    const video = videoRef.current;
    if (video && video.textTracks) {
      Array.from(video.textTracks).forEach((t) => {
        t.mode = "disabled";
      });
    }
    setCurrentSubtitleId(-1);
    setActiveOnlineSubId(null);
    setCustomCues([]);
    setCustomSubtitleName(null);
    setShowSettings(false);
    setActiveSettingsTab("main");
    triggerPlayerToast("Đã tắt phụ đề ngoài");
  }, [triggerPlayerToast]);

  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(true);
  }, []);

  const handleDragLeave = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (containerRef.current && !containerRef.current.contains(e.relatedTarget as Node)) {
      setIsDraggingFile(false);
    }
  }, []);

  const handleDrop = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleLoadSubtitleFile(file);
    }
  }, [handleLoadSubtitleFile]);

  // Keyboard controls
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setShowShortcutsModal((prev) => !prev);
        return;
      }

      switch (e.key) {
        case " ":
          e.preventDefault();
          togglePlay();
          resetControlsTimeout();
          break;
        case "ArrowLeft":
          e.preventDefault();
          skipTime(-10);
          resetControlsTimeout();
          break;
        case "ArrowRight":
          e.preventDefault();
          skipTime(10);
          resetControlsTimeout();
          break;
        case "ArrowUp":
          e.preventDefault();
          adjustVolume(0.1);
          resetControlsTimeout();
          break;
        case "ArrowDown":
          e.preventDefault();
          adjustVolume(-0.1);
          resetControlsTimeout();
          break;
        case "f":
        case "F":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "m":
        case "M":
          e.preventDefault();
          toggleMute();
          resetControlsTimeout();
          break;
        case "c":
        case "C":
          if (onToggleCinemaMode) {
            e.preventDefault();
            onToggleCinemaMode();
          }
          break;
        case "s":
        case "S":
          e.preventDefault();
          if (currentTime < effectiveSkipDuration + 10) {
            handleSkipIntro(effectiveSkipDuration);
          } else {
            handleSkipIntro(currentTime + effectiveSkipDuration);
          }
          resetControlsTimeout();
          break;
        case "z":
        case "Z":
          e.preventDefault();
          adjustSubOffset(-0.5);
          resetControlsTimeout();
          break;
        case "x":
        case "X":
          e.preventDefault();
          adjustSubOffset(0.5);
          resetControlsTimeout();
          break;
        case "b":
        case "B":
          e.preventDefault();
          cycleAudioBoost();
          resetControlsTimeout();
          break;
        case "e":
        case "E":
          if (isSeries || (episodes && episodes.length > 1) || (sources && sources.length > 1)) {
            e.preventDefault();
            setShowEpisodeDrawer((prev) => !prev);
            resetControlsTimeout();
          }
          break;
        case "Escape":
          if (showEpisodeDrawer) {
            e.preventDefault();
            setShowEpisodeDrawer(false);
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    setHasStarted(true);
    hasStartedRef.current = true;

    if (!hasAppliedInitialTimeRef.current && initialTimeRef.current > 0) {
      attemptSeekToInitialTime();
    }

    if (video.paused) {
      video
        .play()
        .then(() => {
          setIsPlaying(true);
          if (!hasAppliedInitialTimeRef.current && initialTimeRef.current > 0) {
            attemptSeekToInitialTime();
          }
        })
        .catch((err) => {
          if (err && (err.name === "NotAllowedError" || String(err).includes("user gesture"))) {
            // Autoplay policy: try playing muted so video starts immediately
            video.muted = true;
            setIsMuted(true);
            video
              .play()
              .then(() => {
                setIsPlaying(true);
              })
              .catch(() => {
                setIsPlaying(false);
              });
          } else {
            setIsPlaying(false);
          }
        });
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current || isScrubbing) return;
    const cur = videoRef.current.currentTime;
    const dur = videoRef.current.duration || 0;
    setCurrentTime(cur);
    setDuration(dur);
    if (onTimeUpdate) {
      onTimeUpdate(cur, dur);
    }

    // Auto chuyển tập trước khi video kết thúc (1.2s trước khi kết thúc) để giữ cửa sổ PiP không bị trình duyệt tắt
    if (
      isSeries &&
      hasNextEpisode &&
      autoNextEnabled &&
      onNextEpisode &&
      dur > 30 &&
      cur >= dur - 1.2 &&
      !hasTriggeredAutoNextRef.current
    ) {
      hasTriggeredAutoNextRef.current = true;
      onNextEpisode();
    }
  };

  const updateBuffered = () => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    if (video.buffered.length > 0) {
      const end = video.buffered.end(video.buffered.length - 1);
      setBufferedPercent(Math.min(100, (end / video.duration) * 100));
    }
  };

  // Text track detection
  const checkTextTracks = () => {
    const video = videoRef.current;
    if (!video) return;
    const tracks = Array.from(video.textTracks || []);
    if (tracks.length > 0) {
      setSubtitleTracks(
        tracks.map((t, idx) => ({
          id: idx,
          label: t.label || t.language || `Phụ đề ${idx + 1}`,
        }))
      );
    } else {
      setSubtitleTracks([]);
    }
  };

  const skipTime = React.useCallback((seconds: number) => {
    if (videoRef.current) {
      const cur = videoRef.current.currentTime || 0;
      const dur = videoRef.current.duration || 10000;
      const nextTime = Math.max(0, Math.min(dur, cur + seconds));
      videoRef.current.currentTime = nextTime;
      setCurrentTime(nextTime);
      triggerSeekFeedback(seconds > 0 ? "forward" : "rewind", seconds);
    }
  }, []);

  // MediaSession API: Cung cấp nút Chuyển tập (Next Track), Phát/Dừng trực tiếp trên cửa sổ PiP & OS Media Controls
  React.useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: title || "RubyFilm",
        artist: subtitle || "RubyFilm",
        album: isSeries ? "Phim bộ" : "Phim lẻ",
        artwork: posterUrl
          ? [
              { src: posterUrl, sizes: "96x96", type: "image/jpeg" },
              { src: posterUrl, sizes: "128x128", type: "image/jpeg" },
              { src: posterUrl, sizes: "192x192", type: "image/jpeg" },
              { src: posterUrl, sizes: "256x256", type: "image/jpeg" },
              { src: posterUrl, sizes: "384x384", type: "image/jpeg" },
              { src: posterUrl, sizes: "512x512", type: "image/jpeg" },
            ]
          : undefined,
      });

      navigator.mediaSession.setActionHandler("play", () => {
        videoRef.current?.play().catch(() => {});
      });

      navigator.mediaSession.setActionHandler("pause", () => {
        videoRef.current?.pause();
      });

      navigator.mediaSession.setActionHandler("seekbackward", (details) => {
        skipTime(-(details.seekOffset || 10));
      });

      navigator.mediaSession.setActionHandler("seekforward", (details) => {
        skipTime(details.seekOffset || 10);
      });

      if (hasNextEpisode && onNextEpisode) {
        navigator.mediaSession.setActionHandler("nexttrack", () => {
          onNextEpisode();
        });
      } else {
        navigator.mediaSession.setActionHandler("nexttrack", null);
      }

      if (hasPrevEpisode && onPrevEpisode) {
        navigator.mediaSession.setActionHandler("previoustrack", () => {
          onPrevEpisode();
        });
      } else {
        navigator.mediaSession.setActionHandler("previoustrack", null);
      }
    } catch (err) {
      console.warn("MediaSession error:", err);
    }
  }, [title, subtitle, posterUrl, isSeries, hasNextEpisode, onNextEpisode, hasPrevEpisode, onPrevEpisode, skipTime]);

  const handleSkipIntro = React.useCallback(
    (targetSeconds?: number) => {
      const video = videoRef.current;
      if (!video) return;
      const dest = targetSeconds ?? Math.max(effectiveSkipDuration, currentTime + 85);
      const safeTarget = Math.min(dest, (video.duration || dest + 10) - 2);
      setLastSkipPreviousTime(video.currentTime);
      video.currentTime = safeTarget;
      setCurrentTime(safeTarget);
      triggerSeekFeedback("forward", Math.round(safeTarget - currentTime));
      setIntroDismissed(true);
      setSkipIntroToast(`Đã bỏ qua giới thiệu (đến ${formatTime(safeTarget)})`);
      setTimeout(() => setSkipIntroToast(null), 4000);
    },
    [effectiveSkipDuration, currentTime]
  );

  const handleUndoSkipIntro = () => {
    if (lastSkipPreviousTime !== null && videoRef.current) {
      videoRef.current.currentTime = lastSkipPreviousTime;
      setCurrentTime(lastSkipPreviousTime);
      setLastSkipPreviousTime(null);
      setSkipIntroToast(null);
      setIntroDismissed(false);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const adjustVolume = (delta: number) => {
    if (!videoRef.current) return;
    const newVol = Math.max(0, Math.min(1, volume + delta));
    videoRef.current.volume = newVol;
    setVolume(newVol);
    setIsMuted(newVol === 0);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.volume = val;
      setVolume(val);
      setIsMuted(val === 0);
    }
  };

  const toggleRotateLandscape = async () => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!container) return;

    // 1. If currently in CSS landscape rotation mode, exit it
    if (isCssLandscape) {
      setIsCssLandscape(false);
      if (document.fullscreenElement) {
        try {
          await document.exitFullscreen();
        } catch {}
      }
      if (typeof screen !== "undefined" && screen.orientation && typeof screen.orientation.unlock === "function") {
        try {
          screen.orientation.unlock();
        } catch {}
      }
      return;
    }

    // 2. iOS Safari (iPhone): trigger native landscape theater player
    const isIOS =
      typeof navigator !== "undefined" &&
      (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

    const iosVideo = video as WebkitHTMLVideoElement | null;
    if (isIOS && iosVideo && iosVideo.webkitEnterFullscreen) {
      try {
        iosVideo.webkitEnterFullscreen();
        return;
      } catch (err) {
        console.warn("iOS webkitEnterFullscreen failed", err);
      }
    }

    // 3. Android Chrome / modern mobile browsers: request fullscreen and lock orientation
    try {
      if (!document.fullscreenElement) {
        if (container.requestFullscreen) {
          await container.requestFullscreen();
        } else if ((container as WebkitHTMLElement).webkitRequestFullscreen) {
          await (container as WebkitHTMLElement).webkitRequestFullscreen!();
        }
        setIsFullscreen(true);
      }

      const screenOrientation = typeof screen !== "undefined" ? (screen.orientation as ScreenOrientationWithLock | undefined) : undefined;
      if (screenOrientation && typeof screenOrientation.lock === "function") {
        try {
          await screenOrientation.lock("landscape");
          return;
        } catch {
          try {
            await screenOrientation.lock("landscape-primary");
            return;
          } catch {}
        }
      }
    } catch (err) {
      console.warn("Fullscreen/orientation lock error", err);
    }

    // 4. Fallback: CSS pseudo-landscape rotation so it immediately rotates 90 degrees and fills screen!
    setIsCssLandscape(true);
  };

  const toggleFullscreen = async () => {
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container) return;

    const webkitDoc = document as WebkitDocument;
    const isCurrentlyFull = !!(
      document.fullscreenElement ||
      webkitDoc.webkitFullscreenElement ||
      isCssLandscape
    );

    if (!isCurrentlyFull) {
      const isMobile =
        typeof window !== "undefined" &&
        (window.innerWidth < 1024 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));

      const isIOS =
        typeof navigator !== "undefined" &&
        (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
          (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

      const iosVideo = video as WebkitHTMLVideoElement | null;
      if (isIOS && iosVideo && iosVideo.webkitEnterFullscreen) {
        try {
          iosVideo.webkitEnterFullscreen();
          return;
        } catch (e) {
          console.warn("webkitEnterFullscreen fallback to container", e);
        }
      }

      try {
        if (container.requestFullscreen) {
          await container.requestFullscreen();
        } else if ((container as WebkitHTMLElement).webkitRequestFullscreen) {
          await (container as WebkitHTMLElement).webkitRequestFullscreen!();
        }
        setIsFullscreen(true);
      } catch (err) {
        console.warn("Fullscreen error", err);
      }

      // Auto-lock to landscape on mobile screens or fallback to CSS rotation
      let lockedLandscape = false;
      if (isMobile) {
        const screenOrientation = typeof screen !== "undefined" ? (screen.orientation as ScreenOrientationWithLock | undefined) : undefined;
        if (screenOrientation && typeof screenOrientation.lock === "function") {
          try {
            await screenOrientation.lock("landscape");
            lockedLandscape = true;
          } catch {
            try {
              await screenOrientation.lock("landscape-primary");
              lockedLandscape = true;
            } catch {}
          }
        }

        // If orientation lock API failed/unsupported (e.g. iOS Safari) and currently in portrait, rotate via CSS!
        if (!lockedLandscape && window.innerHeight > window.innerWidth) {
          setIsCssLandscape(true);
        }
      }
    } else {
      setIsFullscreen(false);
      setIsCssLandscape(false);
      try {
        if (document.fullscreenElement || webkitDoc.webkitFullscreenElement) {
          if (document.exitFullscreen) {
            await document.exitFullscreen();
          } else if (webkitDoc.webkitExitFullscreen) {
            await webkitDoc.webkitExitFullscreen();
          }
        }
        if (typeof screen !== "undefined" && screen.orientation && typeof screen.orientation.unlock === "function") {
          try {
            screen.orientation.unlock();
          } catch {}
        }
      } catch (err) {
        console.warn("Exit fullscreen error", err);
      }
    }
  };

  const togglePip = async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      // 1. Ưu tiên số 1: WebKit presentation mode trên iOS Safari / iPadOS
      if (
        (video as any).webkitSupportsPresentationMode &&
        typeof (video as any).webkitSetPresentationMode === "function" &&
        (video as any).webkitSupportsPresentationMode("picture-in-picture")
      ) {
        const currentMode = (video as any).webkitPresentationMode;
        (video as any).webkitSetPresentationMode(
          currentMode === "picture-in-picture" ? "inline" : "picture-in-picture"
        );
        return;
      }

      // 2. Chuẩn W3C Picture-in-Picture (Desktop Chrome, Edge, Firefox, Desktop Safari)
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        return;
      } else if (typeof video.requestPictureInPicture === "function") {
        await video.requestPictureInPicture();
        return;
      }
    } catch (err) {
      console.warn("PiP error:", err);
    }

    // 3. Nếu là iOS PWA cài màn hình chính (bị Apple chặn chạy nền PiP)
    if (isIosStandalone) {
      setIosPipPromptOpen(true);
    }
  };

  const changePlaybackRate = (rate: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
      setPlaybackRate(rate);
      setShowSettings(false);
      setActiveSettingsTab("main");
    }
  };

  const changeQuality = (lvlIndex: number) => {
    if (hlsRef.current && hlsRef.current.levels && hlsRef.current.levels.length > 1) {
      hlsRef.current.currentLevel = lvlIndex;
    }
    setCurrentQualityIndex(lvlIndex);
    const selected = qualities.find((q) => q.index === lvlIndex);
    const label = selected?.label || (lvlIndex === -1 ? "Tự động" : `${lvlIndex}p`);
    setQualityToast(label);
    setTimeout(() => {
      setQualityToast(null);
    }, 2500);
    setShowSettings(false);
    setActiveSettingsTab("main");
  };

  const selectSubtitle = (id: number) => {
    if (hlsRef.current) {
      hlsRef.current.subtitleTrack = id;
    }
    const video = videoRef.current;
    if (video && video.textTracks) {
      Array.from(video.textTracks).forEach((t, idx) => {
        t.mode = idx === id ? "showing" : "disabled";
      });
    }
    setCurrentSubtitleId(id);
    setShowSettings(false);
    setActiveSettingsTab("main");
    triggerPlayerToast(`✓ Đã bật phụ đề tích hợp #${id + 1}`);
  };

  // Interactive Scrub Bar Logic
  const calcScrubTime = React.useCallback(
    (e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent) => {
      if (!progressBarRef.current || !duration || duration <= 0) return 0;
      const rect = progressBarRef.current.getBoundingClientRect();
      if (!rect.width || rect.width <= 0) return 0;

      let clientX: number | undefined;
      if ("changedTouches" in e && e.changedTouches && e.changedTouches.length > 0) {
        clientX = e.changedTouches[0].clientX;
      } else if ("touches" in e && e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
      } else if ("clientX" in e) {
        clientX = (e as MouseEvent).clientX;
      }

      if (typeof clientX !== "number" || isNaN(clientX)) return currentTime;

      const clickX = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const targetTime = (clickX / rect.width) * duration;
      return Math.max(0, Math.min(targetTime, duration));
    },
    [duration, currentTime]
  );

  const handleProgressBarMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !duration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percent = (clickX / rect.width) * 100;
    setHoverPercent(percent);
    setHoverTime((percent / 100) * duration);
  };

  const handleProgressBarMouseLeave = () => {
    setHoverTime(null);
  };

  const handleScrubStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    setIsScrubbing(true);
    const newTime = calcScrubTime(e);
    if (isFinite(newTime)) {
      setCurrentTime(newTime);
      if (videoRef.current) {
        videoRef.current.currentTime = newTime;
      }
    }
  };

  React.useEffect(() => {
    if (!isScrubbing) return;
    const handleMove = (e: MouseEvent | TouchEvent) => {
      const newTime = calcScrubTime(e);
      if (isFinite(newTime)) {
        setCurrentTime(newTime);
        if (videoRef.current) {
          videoRef.current.currentTime = newTime;
        }
      }
    };
    const handleEnd = (e: MouseEvent | TouchEvent) => {
      setIsScrubbing(false);
      const newTime = calcScrubTime(e);
      if (isFinite(newTime) && videoRef.current) {
        videoRef.current.currentTime = newTime;
      }
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("touchend", handleEnd);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleEnd);
    };
  }, [isScrubbing, calcScrubTime]);

  // Handle video end + Auto Next
  const handleEnded = () => {
    setIsPlaying(false);
    if (onEnded) onEnded();

    if (hasNextEpisode && autoNextEnabled && onNextEpisode) {
      if (!hasTriggeredAutoNextRef.current) {
        hasTriggeredAutoNextRef.current = true;
        onNextEpisode();
      }
    }
  };

  const cancelAutoNext = () => {
    if (autoNextTimerRef.current) {
      clearInterval(autoNextTimerRef.current);
      autoNextTimerRef.current = null;
    }
    setAutoNextCountdown(null);
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return "00:00";
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) {
      const remainingMinutes = minutes % 60;
      return `${hours}:${remainingMinutes < 10 ? "0" : ""}${remainingMinutes}:${
        seconds < 10 ? "0" : ""
      }${seconds}`;
    }
    return `${minutes < 10 ? "0" : ""}${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const activeSourceObj = (sources && activeSourceIndex !== undefined && sources[activeSourceIndex]) || source;
  const getSourceAudioType = (sName: string) => {
    const lower = (sName || "").toLowerCase();
    if (lower.includes("thuyết minh")) return "Thuyết Minh";
    if (lower.includes("lồng tiếng")) return "Lồng Tiếng";
    return "Ruby VIP";
  };
  const currentAudioLabel = getSourceAudioType(activeSourceObj?.serverName || "");

  // IFRAME EMBED PLAYER
  if (source.type === "embed") {
    return (
      <div
        ref={containerRef}
        className={cn(
          "relative w-full max-w-full bg-cinema-950 overflow-hidden shadow-2xl border border-cinema-700/80 group transition-all duration-300",
          isCinemaMode
            ? "h-[65vh] sm:h-[78vh] lg:h-[86vh] max-h-[940px] rounded-none sm:rounded-2xl"
            : "aspect-video rounded-2xl"
        )}
      >
        {iframeLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10 pointer-events-none">
            <div className="w-12 h-12 rounded-full border-4 border-brand/20 border-t-brand animate-spin mb-3" />
            <span className="text-xs text-cinema-300 font-medium tracking-wider uppercase">Đang kết nối máy chủ phát...</span>
          </div>
        )}
        <iframe
          src={`/api/player?s=${encodeURIComponent(
            source.url.startsWith("http") ? encryptStreamUrl(source.url) : source.url
          )}&title=${encodeURIComponent(title || "")}`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          onLoad={() => setIframeLoading(false)}
          className="w-full h-full border-0"
        />

        <div className="absolute top-3 right-3 flex items-center gap-2 z-20">
          {/* Cinema mode for embed */}
          {onToggleCinemaMode && (
            <button
              type="button"
              onClick={onToggleCinemaMode}
              className={cn(
                "hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold shadow-lg backdrop-blur-md transition-all active:scale-95 cursor-pointer",
                isCinemaMode
                  ? "bg-brand text-white border-brand shadow-brand/20"
                  : "bg-cinema-950/80 hover:bg-[#E50000] border-cinema-700 text-white"
              )}
              title={isCinemaMode ? "Thoát chế độ rạp phim (Phím C)" : "Chế độ rạp chiếu phim (Phím C)"}
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden="true">
                <path d="M19 4H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zm0 12H5V6h14v10zm-9.3-6.7L7.4 11l2.3 1.7-.8 1.1L5.5 11l3.4-2.8.8 1.1zm4.6 0l.8-1.1L18.5 11l-3.4 2.8-.8-1.1 2.3-1.7-2.3-1.7zM4 19h16v1.5H4V19z" />
              </svg>
              <span>{isCinemaMode ? "Thu nhỏ" : "Rạp phim"}</span>
            </button>
          )}

          {onSwitchServer && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onSwitchServer}
              className="text-xs gap-1.5 bg-cinema-950/80 backdrop-blur-md border border-cinema-700 text-cinema-200 hover:text-white"
            >
              <Server className="w-3.5 h-3.5 text-brand" />
              <span>Đổi Server</span>
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Double-tap to seek on mobile (left side: -10s, right side: +10s)
  const handleContainerTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.changedTouches.length !== 1 || isScrubbing) return;
    const touch = e.changedTouches[0];
    const now = Date.now();
    const prev = lastTapRef.current;
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const relativeX = touch.clientX - rect.left;
    const isLeft = relativeX < rect.width * 0.38;
    const isRight = relativeX > rect.width * 0.62;

    if (now - prev.time < 320 && Math.abs(touch.clientX - prev.x) < 60) {
      if (isLeft) {
        skipTime(-10);
      } else if (isRight) {
        skipTime(10);
      }
      lastTapRef.current = { time: 0, x: 0 };
    } else {
      lastTapRef.current = { time: now, x: touch.clientX };
    }
  };

  // NATIVE / HLS VIDEO PLAYER
  return (
    <div
      ref={containerRef}
      onMouseMove={resetControlsTimeout}
      onMouseEnter={() => setShowControls(true)}
      onClick={resetControlsTimeout}
      onTouchEnd={handleContainerTouchEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "relative w-full max-w-full bg-black overflow-hidden shadow-2xl select-none group border border-cinema-700/80 transition-all duration-300",
        isCssLandscape
          ? "!fixed !inset-0 !z-[9999] !w-[100dvh] !h-[100dvw] !max-w-none !rounded-none rotate-90 origin-top-left translate-x-[100dvw]"
          : isCinemaMode
          ? "h-[65vh] sm:h-[78vh] lg:h-[86vh] max-h-[940px] rounded-none sm:rounded-2xl"
          : "aspect-video rounded-2xl"
      )}
    >
      <video
        ref={videoRef}
        playsInline
        onTimeUpdate={handleTimeUpdate}
        onProgress={updateBuffered}
        onLoadedMetadata={() => {
          if (videoRef.current) {
            setDuration(videoRef.current.duration);
            setIsLoading(false);
            checkTextTracks();
            if (
              (videoRef.current as any).webkitSupportsPresentationMode &&
              (videoRef.current as any).webkitSupportsPresentationMode("picture-in-picture")
            ) {
              setIsPipSupported(true);
            }
            if (!hasAppliedInitialTimeRef.current && initialTimeRef.current > 0) {
              attemptSeekToInitialTime();
            }
          }
        }}
        onCanPlay={() => {
          setIsLoading(false);
          if (!hasAppliedInitialTimeRef.current && initialTimeRef.current > 0) {
            attemptSeekToInitialTime();
          }
          if (isPipActiveRef.current && videoRef.current) {
            if (
              document.pictureInPictureEnabled &&
              !document.pictureInPictureElement &&
              typeof videoRef.current.requestPictureInPicture === "function"
            ) {
              videoRef.current.requestPictureInPicture().catch(() => {});
            }
          }
        }}
        onWaiting={() => setIsLoading(true)}
        onPlaying={() => {
          setIsLoading(false);
          setIsPlaying(true);
          setHasStarted(true);
          failoverAttemptsRef.current = 0;
        }}
        onPause={() => {
          setIsPlaying(false);
          if (onPause) onPause();
        }}
        onEnded={handleEnded}
        onError={() => {
          // If Hls.js is active, allow Hls.js error recovery to handle it
          if (hlsRef.current) {
            console.warn("[VideoPlayer] Native video error while HLS is active, deferring to Hls.js");
            return;
          }
          const switched = triggerAutoFailover("Lỗi tải video");
          if (!switched) {
            setHasError(true);
            setErrorMessage("Không thể phát video này. Định dạng hoặc đường truyền gặp sự cố.");
            setIsLoading(false);
          }
        }}
        onClick={togglePlay}
        className={cn(
          "w-full h-full cursor-pointer transition-all duration-200",
          videoFit === "cover"
            ? "object-cover"
            : videoFit === "fill"
            ? "object-fill"
            : "object-contain"
        )}
      />

      {/* Poster Placeholder before first play */}
      {!hasStarted && posterUrl && !isPlaying && !isLoading && !hasError && (
        <div
          className="absolute inset-0 z-10 cursor-pointer overflow-hidden"
          onClick={togglePlay}
        >
          <Image
            src={posterUrl}
            alt={title}
            fill
            priority
            className="object-cover opacity-60 filter blur-[1px]"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            <button
              type="button"
              aria-label="Bắt đầu xem"
              className="w-20 h-20 rounded-full bg-brand text-cinema-950 flex items-center justify-center shadow-2xl shadow-brand/40 transition-transform hover:scale-110 active:scale-95 mb-4 group/play cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
            >
              <Play className="w-10 h-10 fill-current ml-1" />
            </button>
            <h3 className="text-xl sm:text-2xl font-bold text-white drop-shadow-md line-clamp-1 max-w-xl">
              {title}
            </h3>
            {subtitle && (
              <p className="text-sm text-cinema-300 drop-shadow mt-1">
                {subtitle}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Loading Spinner */}
      {isLoading && !hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-20 pointer-events-none">
          <div className="w-12 h-12 rounded-full border-4 border-brand/20 border-t-brand animate-spin mb-3" />
          <span className="text-xs text-cinema-300 font-medium tracking-wider uppercase">Đang tải video...</span>
        </div>
      )}

      {/* ERROR STATE: Unable to play video */}
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-cinema-950/95 p-6 z-30 text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h4 className="text-lg font-bold text-white mb-1.5">Không thể phát video này</h4>
          <p className="text-sm text-cinema-400 max-w-md mb-6 leading-relaxed">
            {errorMessage || "Không thể phát video này. Vui lòng tải lại hoặc đổi máy chủ khác."}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              variant="primary"
              onClick={initPlayer}
              className="gap-2 font-semibold"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Thử lại</span>
            </Button>
            {sources && sources.length > 1 && onSelectSourceIndex ? (
              <Button
                variant="secondary"
                onClick={() => triggerAutoFailover("Người dùng đổi server")}
                className="gap-2 bg-brand/10 border-brand/30 text-brand hover:bg-brand/20 font-semibold"
              >
                <Server className="w-4 h-4" />
                <span>Đổi sang {sources[(activeSourceIndex + 1) % sources.length]?.serverName || "Máy chủ khác"}</span>
              </Button>
            ) : onSwitchServer ? (
              <Button
                variant="secondary"
                onClick={onSwitchServer}
                className="gap-2"
              >
                <Server className="w-4 h-4 text-brand" />
                <span>Đổi Server</span>
              </Button>
            ) : null}
          </div>
        </div>
      )}

      {/* Auto Next Countdown Overlay */}
      {autoNextCountdown !== null && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 z-25 p-6 text-center animate-in fade-in duration-300">
          <div className="w-14 h-14 rounded-full bg-brand/20 border border-brand/40 text-brand flex items-center justify-center mb-3">
            <FastForward className="w-7 h-7" />
          </div>
          <h4 className="text-lg font-bold text-white mb-1">Tập tiếp theo sau {autoNextCountdown} giây</h4>
          <p className="text-xs text-cinema-400 mb-5">Hệ thống đang chuẩn bị phát tập tiếp theo cho bạn</p>
          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                cancelAutoNext();
                if (onNextEpisode) onNextEpisode();
              }}
              className="font-bold gap-1.5"
            >
              <FastForward className="w-4 h-4" />
              <span>Phát ngay</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={cancelAutoNext}
              className="gap-1.5"
            >
              <X className="w-4 h-4" />
              <span>Hủy</span>
            </Button>
          </div>
        </div>
      )}

      {/* Center Play Button on Pause */}
      {!isPlaying && !isLoading && hasStarted && !hasError && autoNextCountdown === null && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="Phát video"
          className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-brand/90 hover:bg-brand text-cinema-950 flex items-center justify-center shadow-xl shadow-brand/30 transition-transform hover:scale-110 active:scale-95 z-20"
        >
          <Play className="w-8 h-8 fill-current ml-1" />
        </button>
      )}

      {/* Custom Subtitle Overlay (SRT/VTT with real-time sync offset & custom styling) */}
      {currentSubtitleId === 9999 && activeSubtitleText && (
        <div
          className="absolute left-1/2 -translate-x-1/2 pointer-events-none z-35 text-center px-4 max-w-[90%] transition-all duration-200 select-none"
          style={{
            bottom: showControls ? "86px" : "36px",
            fontSize: `${subtitleFontSize}px`,
          }}
        >
          <span className="inline-block bg-black/85 text-white font-medium px-4 py-1.5 rounded-xl backdrop-blur-[2px] leading-relaxed tracking-wide shadow-2xl border border-white/10 [text-shadow:_0_2px_4px_rgba(0,0,0,0.9),_0_0_2px_rgba(0,0,0,0.9)] whitespace-pre-line">
            {activeSubtitleText}
          </span>
        </div>
      )}

      {/* Drag & Drop Subtitle File Overlay */}
      {isDraggingFile && (
        <div className="absolute inset-0 z-50 bg-cinema-950/90 border-2 border-dashed border-brand rounded-2xl flex flex-col items-center justify-center p-6 backdrop-blur-sm pointer-events-none animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-full bg-brand/20 border border-brand/50 text-brand flex items-center justify-center mb-3 animate-bounce">
            <Subtitles className="w-8 h-8" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-white mb-1">
            Thả file phụ đề (.srt / .vtt) vào đây
          </h3>
          <p className="text-xs text-cinema-300">
            RubbyFilm sẽ tự động đồng bộ và phát phụ đề tức thì
          </p>
        </div>
      )}

      {/* Hidden file input for subtitle upload */}
      <input
        ref={subFileInputRef}
        type="file"
        accept=".srt,.vtt,text/vtt,application/x-subrip"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleLoadSubtitleFile(file);
            e.target.value = "";
          }
        }}
      />

      {/* Controls Overlay */}
      <div
        className={`absolute inset-0 flex flex-col justify-between p-4 sm:p-6 bg-gradient-to-t from-black/95 via-transparent to-black/70 transition-opacity duration-300 pointer-events-none z-20 ${
          showControls && hasStarted ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between text-white pointer-events-auto">
          <div>
            <h4 className="font-semibold text-sm sm:text-base line-clamp-1 drop-shadow-md">
              {title}
            </h4>
            {subtitle && (
              <p className="text-xs text-cinema-300 line-clamp-1">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Universal Player Toast (Audio Boost, Subtitle sync, etc.) */}
        {playerToast && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 bg-cinema-950/95 text-white border border-brand/50 px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2 shadow-2xl backdrop-blur-md pointer-events-none transition-all animate-in fade-in zoom-in-95">
            <span className="w-2 h-2 rounded-full bg-brand animate-ping" />
            <span>{playerToast}</span>
          </div>
        )}

        {/* Quality Toast Notification */}
        {qualityToast && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 bg-cinema-950/95 text-white border border-brand/50 px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2 shadow-2xl backdrop-blur-md pointer-events-none transition-all">
            <span className="w-2 h-2 rounded-full bg-brand animate-ping" />
            <span>Chất lượng video: <strong className="text-brand font-bold">{qualityToast}</strong></span>
          </div>
        )}

        {/* Floating Seek Feedback Notification (-10s / +10s) */}
        {seekFeedback && (
          <div
            key={seekFeedback.key}
            className={cn(
              "absolute top-1/2 -translate-y-1/2 z-30 pointer-events-none flex flex-col items-center justify-center p-3 sm:p-4 rounded-full bg-black/85 text-white border border-brand/50 shadow-2xl backdrop-blur-md animate-in zoom-in-75 fade-in duration-200",
              seekFeedback.direction === "rewind" ? "left-8 sm:left-20" : "right-8 sm:right-20"
            )}
          >
            {seekFeedback.direction === "rewind" ? (
              <RotateCcw className="w-7 h-7 sm:w-8 sm:h-8 text-brand" />
            ) : (
              <RotateCw className="w-7 h-7 sm:w-8 sm:h-8 text-brand" />
            )}
            <span className="text-[11px] sm:text-xs font-bold mt-1 text-white font-mono">
              {seekFeedback.direction === "rewind" ? "-10s" : "+10s"}
            </span>
          </div>
        )}

        {/* Bottom Controls */}
        <div className="flex flex-col gap-2.5 pointer-events-auto">
          {/* Interactive Scrub Bar - 32px touch target with touch-none */}
          <div
            ref={progressBarRef}
            onMouseDown={handleScrubStart}
            onTouchStart={handleScrubStart}
            onMouseMove={handleProgressBarMouseMove}
            onMouseLeave={handleProgressBarMouseLeave}
            className="relative py-3 -my-2 flex items-center cursor-pointer group/bar touch-none select-none"
          >
            {/* Hover Preview Card (Netflix / Stremio style) */}
            {hoverTime !== null && (
              <div
                className="absolute -top-[90px] pointer-events-none -translate-x-1/2 flex flex-col items-center z-40 transition-transform duration-75 animate-in fade-in zoom-in-95"
                style={{
                  left: `${Math.max(8, Math.min(92, hoverPercent))}%`,
                }}
              >
                <div className="p-1 rounded-xl bg-cinema-950/95 border border-white/20 shadow-2xl backdrop-blur-xl flex flex-col items-center min-w-[110px] overflow-hidden">
                  {/* Thumbnail / Backdrop snapshot if available */}
                  {posterUrl ? (
                    <div className="relative w-24 h-14 rounded-lg overflow-hidden bg-black/60 mb-0.5">
                      <Image
                        src={posterUrl}
                        alt="Preview"
                        fill
                        sizes="96px"
                        className="object-cover opacity-80"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent flex items-end justify-center pb-0.5">
                        <span className="font-mono font-bold text-white text-[11px] drop-shadow-md">
                          {formatTime(hoverTime)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <span className="font-mono font-bold text-white text-xs px-2 py-1">
                      {formatTime(hoverTime)}
                    </span>
                  )}

                  {/* Intro / Outro Segment Badge */}
                  {duration > 180 && hoverTime <= effectiveSkipDuration && (
                    <span className="text-[9px] font-extrabold text-amber-300 bg-amber-400/15 px-1.5 py-0.5 rounded border border-amber-400/30">
                      Intro
                    </span>
                  )}
                  {duration > 180 && hoverTime >= duration - 55 && (
                    <span className="text-[9px] font-extrabold text-purple-300 bg-purple-400/15 px-1.5 py-0.5 rounded border border-purple-400/30">
                      Credits
                    </span>
                  )}
                </div>

                {/* Downward indicator needle */}
                <div className="w-2 h-2 bg-cinema-950 border-r border-b border-white/20 rotate-45 -mt-1 shadow-sm" />
              </div>
            )}

            {/* Background track */}
            <div className="relative w-full h-2 group-hover/bar:h-2.5 rounded-full bg-cinema-800/80 overflow-hidden transition-all">
              {/* Intro region marker */}
              {duration > 180 && (
                <div
                  className="absolute left-0 top-0 bottom-0 bg-amber-400/25 border-r border-amber-400/60 z-0 pointer-events-none"
                  style={{ width: `${Math.min(25, (effectiveSkipDuration / duration) * 100)}%` }}
                  title="Đoạn mở đầu (Intro)"
                />
              )}

              {/* Credits region marker */}
              {duration > 180 && (
                <div
                  className="absolute right-0 top-0 bottom-0 bg-purple-400/25 border-l border-purple-400/60 z-0 pointer-events-none"
                  style={{ width: `${Math.min(15, (55 / duration) * 100)}%` }}
                  title="Đoạn kết (Credits)"
                />
              )}

              {/* Buffer bar */}
              <div
                className="absolute left-0 top-0 bottom-0 bg-white/20 rounded-full transition-all"
                style={{ width: `${bufferedPercent}%` }}
              />

              {/* Current progress bar */}
              <div
                className="absolute left-0 top-0 bottom-0 bg-brand rounded-full transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Hover hairline needle */}
            {hoverTime !== null && (
              <div
                className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 bg-white/70 pointer-events-none -translate-x-1/2 z-10"
                style={{ left: `${hoverPercent}%` }}
              />
            )}

            {/* Scrub thumb */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-white rounded-full shadow-lg opacity-100 sm:opacity-0 sm:group-hover/bar:opacity-100 transition-opacity pointer-events-none z-20"
              style={{ left: `${progressPercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between gap-1 sm:gap-2">
            {/* Left Controls */}
            <div className="flex items-center gap-1 sm:gap-2 min-w-0">
              {/* Seek -10s */}
              <button
                type="button"
                onClick={() => skipTime(-10)}
                aria-label="Tua lại 10 giây"
                className="text-cinema-200 hover:text-white transition-colors p-1.5 sm:p-2 rounded-lg hover:bg-white/10 shrink-0"
                title="Tua lùi 10s (Phím ←)"
              >
                <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              {/* Play / Pause */}
              <button
                type="button"
                onClick={togglePlay}
                aria-label={isPlaying ? "Tạm dừng" : "Phát"}
                className="text-white hover:text-brand transition-colors p-1.5 sm:p-2 rounded-lg hover:bg-white/10 shrink-0"
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
              </button>

              {/* Seek +10s */}
              <button
                type="button"
                onClick={() => skipTime(10)}
                aria-label="Tua tới 10 giây"
                className="text-cinema-200 hover:text-white transition-colors p-1.5 sm:p-2 rounded-lg hover:bg-white/10 shrink-0"
                title="Tua tới 10s (Phím →)"
              >
                <RotateCw className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              {/* Previous Episode (Desktop only - mobile already has large dedicated buttons below player) */}
              {isSeries && onPrevEpisode && (
                <button
                  type="button"
                  onClick={onPrevEpisode}
                  disabled={!hasPrevEpisode}
                  aria-label="Tập trước đó"
                  className="hidden md:inline-flex text-cinema-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors p-2 rounded-lg hover:bg-white/10 shrink-0"
                  title="Tập trước đó"
                >
                  <SkipBack className="w-4 h-4 fill-current" />
                </button>
              )}

              {/* Next Episode (Desktop only) */}
              {isSeries && onNextEpisode && (
                <button
                  type="button"
                  onClick={onNextEpisode}
                  disabled={!hasNextEpisode}
                  aria-label="Tập tiếp theo"
                  className="hidden md:inline-flex text-cinema-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors p-2 rounded-lg hover:bg-white/10 shrink-0"
                  title="Tập tiếp theo"
                >
                  <SkipForward className="w-4 h-4 fill-current" />
                </button>
              )}

              {/* Volume Slider (Desktop only - mobile uses hardware buttons) */}
              <div className="hidden sm:flex items-center gap-1.5 group/vol ml-1 shrink-0">
                <button
                  type="button"
                  onClick={toggleMute}
                  aria-label={isMuted ? "Bật âm thanh" : "Tắt âm thanh"}
                  className="text-cinema-200 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10"
                  title="Tắt/Bật tiếng (Phím M)"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-5 h-5 text-red-400" />
                  ) : (
                    <Volume2 className="w-5 h-5" />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  aria-label="Âm lượng"
                  className="w-14 sm:w-20 h-1 rounded bg-cinema-700 appearance-none cursor-pointer accent-brand"
                />

                {/* Audio Boost indicator button */}
                <button
                  type="button"
                  onClick={() => {
                    setShowSettings(true);
                    setActiveSettingsTab("boost");
                  }}
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5 transition-colors cursor-pointer ${
                    audioBoost > 1
                      ? "bg-amber-500 text-cinema-950 shadow-md shadow-amber-500/30 animate-pulse font-extrabold"
                      : "text-cinema-400 hover:text-white hover:bg-white/10"
                  }`}
                  title={`Khuếch đại âm thanh: ${Math.round(audioBoost * 100)}% (Phím B)`}
                >
                  <Zap className="w-2.5 h-2.5 fill-current" />
                  <span>{Math.round(audioBoost * 100)}%</span>
                </button>
              </div>

              {/* Realtime Time Display */}
              <div className="text-[11px] sm:text-xs text-cinema-200 font-mono ml-1 sm:ml-3 flex items-center select-none whitespace-nowrap shrink-0">
                <span className="font-semibold text-white">{formatTime(currentTime)}</span>
                <span className="mx-0.5 sm:mx-1 text-cinema-500">/</span>
                <span className="text-cinema-400">{formatTime(duration)}</span>
              </div>
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-1 sm:gap-2 relative shrink-0">
              {/* Keyboard Shortcuts Help Button */}
              <button
                type="button"
                onClick={() => setShowShortcutsModal(true)}
                aria-label="Phím tắt trình phát"
                className="hidden sm:inline-flex text-cinema-400 hover:text-white transition-colors p-1.5 sm:p-2 rounded-lg hover:bg-white/10 shrink-0 cursor-pointer"
                title="Bảng phím tắt (?)"
              >
                <HelpCircle className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              {/* Picture-in-Picture */}
              {isPipSupported && (
                <button
                  type="button"
                  onClick={togglePip}
                  aria-label="Hình trong hình"
                  className="text-cinema-300 hover:text-white transition-colors p-1.5 sm:p-2 rounded-lg hover:bg-white/10 shrink-0 cursor-pointer"
                  title="Hình trong hình (Picture-in-Picture)"
                >
                  <PictureInPicture className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              )}

              {/* Binge Mode: Danh sách tập & Server ngay trong Fullscreen (Phím E) */}
              {(isSeries || (episodes && episodes.length > 1) || (sources && sources.length > 1)) && (
                <button
                  type="button"
                  onClick={() => setShowEpisodeDrawer((prev) => !prev)}
                  aria-label="Danh sách tập & Server (Phím E)"
                  className={cn(
                    "text-cinema-200 hover:text-white transition-all p-1.5 sm:p-2 rounded-lg hover:bg-white/10 shrink-0 flex items-center gap-1.5 cursor-pointer relative",
                    showEpisodeDrawer ? "text-brand bg-white/15" : ""
                  )}
                  title="Danh sách tập & Đổi Server (Phím E)"
                >
                  <Tv className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                  {isSeries && episodeNumber && (
                    <span className="hidden md:inline-block text-[11px] font-extrabold px-1.5 py-0.5 rounded bg-brand/20 text-brand border border-brand/30">
                      Tập {episodeNumber}
                    </span>
                  )}
                </button>
              )}

              {/* Quick Subtitle / CC Button */}
              <button
                type="button"
                onClick={() => {
                  if (showSettings && activeSettingsTab === "subtitle") {
                    setShowSettings(false);
                    setActiveSettingsTab("main");
                  } else {
                    setShowSettings(true);
                    setActiveSettingsTab("subtitle");
                  }
                }}
                aria-label="Phụ đề (CC)"
                className={cn(
                  "p-1.5 sm:p-2 rounded-lg transition-all shrink-0 flex items-center gap-1 cursor-pointer",
                  currentSubtitleId !== -1
                    ? "text-brand bg-brand/15 hover:bg-brand/25 font-bold"
                    : "text-cinema-300 hover:text-white hover:bg-white/10"
                )}
                title={currentSubtitleId !== -1 ? "Phụ đề: Đang BẬT (Bấm để chọn / cài đặt)" : "Phụ đề (CC)"}
              >
                <Subtitles className="w-4 h-4 sm:w-5 sm:h-5" />
                {currentSubtitleId !== -1 && (
                  <span className="hidden lg:inline text-[9px] font-extrabold uppercase px-1 py-0.5 rounded bg-brand text-cinema-950 leading-none">
                    BẬT
                  </span>
                )}
              </button>

              {/* Settings Gear ⚙ */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowSettings(!showSettings);
                    setActiveSettingsTab("main");
                  }}
                  aria-label="Cài đặt phát"
                  className={`text-cinema-200 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10 ${
                    showSettings ? "text-brand bg-white/10" : ""
                  }`}
                  title="Cài đặt (Tốc độ, Chất lượng, Phụ đề, Âm thanh)"
                >
                  <Settings className="w-5 h-5" />
                </button>

                {showSettings && (
                  <div className="absolute right-0 bottom-11 mb-2 bg-cinema-900/95 border border-cinema-700/80 rounded-2xl p-2.5 shadow-2xl backdrop-blur-xl flex flex-col gap-1.5 min-w-[210px] z-40 text-xs">
                    {/* Main Settings Menu */}
                    {activeSettingsTab === "main" && (
                      <div className="space-y-1">
                        <div className="px-2.5 py-1 text-[11px] font-bold text-cinema-400 uppercase tracking-wider border-b border-cinema-800 pb-1.5 mb-1">
                          Cài đặt trình phát
                        </div>

                        {/* Speed Entry */}
                        <button
                          type="button"
                          onClick={() => setActiveSettingsTab("speed")}
                          className="w-full flex items-center justify-between p-2 rounded-xl text-cinema-200 hover:bg-cinema-800 hover:text-white transition-colors"
                        >
                          <span className="flex items-center gap-2">
                            <SlidersHorizontal className="w-3.5 h-3.5 text-brand" />
                            <span>Tốc độ phát</span>
                          </span>
                          <span className="text-cinema-400 font-semibold">{playbackRate}x ›</span>
                        </button>

                        {/* Quality Entry - Always available */}
                        <button
                          type="button"
                          onClick={() => setActiveSettingsTab("quality")}
                          className="w-full flex items-center justify-between p-2 rounded-xl text-cinema-200 hover:bg-cinema-800 hover:text-white transition-colors"
                        >
                          <span className="flex items-center gap-2">
                            <Settings className="w-3.5 h-3.5 text-brand" />
                            <span>Chất lượng</span>
                          </span>
                          <span className="text-cinema-400 font-semibold text-xs">
                            {currentQualityIndex === -1
                              ? "Tự động"
                              : qualities.find((q) => q.index === currentQualityIndex)?.label.split(" ")[0] || "1080p"} ›
                          </span>
                        </button>

                        {/* Audio Boost Entry */}
                        <button
                          type="button"
                          onClick={() => setActiveSettingsTab("boost")}
                          className="w-full flex items-center justify-between p-2 rounded-xl text-cinema-200 hover:bg-cinema-800 hover:text-white transition-colors"
                        >
                          <span className="flex items-center gap-2">
                            <Zap className="w-3.5 h-3.5 text-amber-400" />
                            <span>Audio Boost</span>
                          </span>
                          <span className="text-amber-400 font-semibold text-xs">
                            {audioBoost > 1 ? `${Math.round(audioBoost * 100)}% 🚀` : "100%"} ›
                          </span>
                        </button>

                        {/* Audio / Translation Entry */}
                        <button
                          type="button"
                          onClick={() => setActiveSettingsTab("audio")}
                          className="w-full flex items-center justify-between p-2 rounded-xl text-cinema-200 hover:bg-cinema-800 hover:text-white transition-colors"
                        >
                          <span className="flex items-center gap-2">
                            <Volume2 className="w-3.5 h-3.5 text-brand" />
                            <span>Bản dịch / Âm thanh</span>
                          </span>
                          <span className="text-cinema-400 font-semibold text-xs truncate max-w-[110px]">
                            {currentAudioLabel} ›
                          </span>
                        </button>

                        {/* Subtitles Entry (Always accessible) */}
                        <button
                          type="button"
                          onClick={() => setActiveSettingsTab("subtitle")}
                          className="w-full flex items-center justify-between p-2 rounded-xl text-cinema-200 hover:bg-cinema-800 hover:text-white transition-colors"
                        >
                          <span className="flex items-center gap-2">
                            <Subtitles className="w-3.5 h-3.5 text-brand" />
                            <span>Phụ đề</span>
                          </span>
                          <span className="text-cinema-400 font-semibold text-xs truncate max-w-[100px]">
                            {currentSubtitleId === -1
                              ? "Tắt"
                              : currentSubtitleId === 9999
                              ? customSubtitleName || "Tệp ngoài"
                              : subtitleTracks.find((t) => t.id === currentSubtitleId)?.label || "Bật"} ›
                          </span>
                        </button>

                        {/* Skip Intro Entry */}
                        <button
                          type="button"
                          onClick={() => setActiveSettingsTab("intro")}
                          className="w-full flex items-center justify-between p-2 rounded-xl text-cinema-200 hover:bg-cinema-800 hover:text-white transition-colors"
                        >
                          <span className="flex items-center gap-2">
                            <FastForward className="w-3.5 h-3.5 text-brand" />
                            <span>Bỏ qua giới thiệu</span>
                          </span>
                          <span className="text-cinema-400 font-semibold text-xs">
                            {effectiveAutoSkip ? "Tự động" : `${effectiveSkipDuration}s`} ›
                          </span>
                        </button>
                      </div>
                    )}

                    {/* Speed Submenu */}
                    {activeSettingsTab === "speed" && (
                      <div className="space-y-1">
                        <button
                          type="button"
                          onClick={() => setActiveSettingsTab("main")}
                          className="w-full text-left px-2 py-1 text-[11px] font-bold text-brand hover:underline flex items-center gap-1 mb-1 border-b border-cinema-800 pb-1.5"
                        >
                          ‹ Quay lại
                        </button>
                        {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                          <button
                            key={rate}
                            type="button"
                            onClick={() => changePlaybackRate(rate)}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors ${
                              playbackRate === rate
                                ? "bg-brand text-cinema-950 font-bold"
                                : "text-cinema-200 hover:bg-cinema-800"
                            }`}
                          >
                            <span>{rate === 1 ? "Chuẩn (1x)" : `${rate}x`}</span>
                            {playbackRate === rate && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Quality Submenu */}
                    {activeSettingsTab === "quality" && (
                      <div className="space-y-1">
                        <button
                          type="button"
                          onClick={() => setActiveSettingsTab("main")}
                          className="w-full text-left px-2 py-1 text-[11px] font-bold text-brand hover:underline flex items-center gap-1 mb-1 border-b border-cinema-800 pb-1.5"
                        >
                          ‹ Quay lại
                        </button>
                        {qualities.map((q) => (
                          <button
                            key={q.index}
                            type="button"
                            onClick={() => changeQuality(q.index)}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors ${
                              currentQualityIndex === q.index
                                ? "bg-brand text-cinema-950 font-bold"
                                : "text-cinema-200 hover:bg-cinema-800"
                            }`}
                          >
                            <span>{q.label}</span>
                            {currentQualityIndex === q.index && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Audio / Translation Submenu */}
                    {activeSettingsTab === "audio" && (
                      <div className="space-y-1.5">
                        <button
                          type="button"
                          onClick={() => setActiveSettingsTab("main")}
                          className="w-full text-left px-2 py-1 text-[11px] font-bold text-brand hover:underline flex items-center gap-1 mb-1 border-b border-cinema-800 pb-1.5"
                        >
                          ‹ Quay lại
                        </button>

                        <div className="px-2 py-0.5 text-[10px] font-bold text-cinema-400 uppercase tracking-wider">
                          Hệ thống Máy chủ Ruby
                        </div>

                        {sources && sources.length > 1 ? (
                          <div className="space-y-1">
                            {sources.map((src, idx) => {
                              const isCurrent = (activeSourceIndex !== undefined ? activeSourceIndex : 0) === idx;
                              const aType = getSourceAudioType(src.serverName);
                              return (
                                <button
                                  key={`${src.serverName}-${idx}`}
                                  type="button"
                                  onClick={() => {
                                    handleQuickSwitchServer(idx);
                                  }}
                                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors text-xs ${
                                    isCurrent
                                      ? "bg-brand text-cinema-950 font-bold"
                                      : "text-cinema-200 hover:bg-cinema-800"
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="truncate">{src.serverName}</span>
                                    <span
                                      className={`text-[9px] px-1 py-0.5 rounded font-bold uppercase ${
                                        isCurrent ? "bg-black/20 text-cinema-950" : "bg-cinema-700 text-brand"
                                      }`}
                                    >
                                      {aType}
                                    </span>
                                  </div>
                                  {isCurrent && <Check className="w-3.5 h-3.5 stroke-[3] shrink-0" />}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="p-2.5 rounded-xl bg-cinema-800/80 border border-cinema-700/60 text-xs space-y-1">
                            <div className="flex items-center gap-1.5 text-white font-semibold">
                              <span className="w-2 h-2 rounded-full bg-emerald-400" />
                              <span>Bản chuẩn Full HD / 4K</span>
                            </div>
                            <p className="text-[11px] text-cinema-400 leading-relaxed">
                              Phim phát trực tiếp trên hạ tầng độc quyền RubyFilm.
                            </p>
                          </div>
                        )}

                        <div className="p-2 rounded-lg bg-cinema-900/90 border border-cinema-800 text-[10.5px] text-cinema-400 leading-snug">
                          <span className="text-zinc-300 font-semibold">Ghi chú:</span> Video phát chuẩn âm thanh vòm và phụ đề hiển thị sắc nét với băng thông tốc độ cao.
                        </div>
                      </div>
                    )}

                    {/* Subtitle Submenu */}
                    {activeSettingsTab === "subtitle" && (
                      <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-0.5 custom-scrollbar">
                        <div className="flex items-center justify-between pb-1.5 border-b border-cinema-800">
                          <button
                            type="button"
                            onClick={() => setActiveSettingsTab("main")}
                            className="text-[11px] font-bold text-brand hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            ‹ Quay lại
                          </button>
                          <div className="flex items-center gap-1 text-[10px] text-cinema-400 font-medium">
                            <Globe className="w-3 h-3 text-brand" />
                            <span>Stremio Online Subs</span>
                          </div>
                        </div>

                        {/* Subtitle Sync Offset & Size Controls (Shown when any sub is active) */}
                        {currentSubtitleId !== -1 && (
                          <div className="p-2.5 rounded-xl bg-cinema-800/90 border border-brand/30 space-y-2 shadow-lg">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-cinema-300 font-medium">Độ trễ (Sync):</span>
                              <span className="font-mono font-bold text-brand">
                                {subOffset > 0 ? `+${subOffset.toFixed(1)}s` : `${subOffset.toFixed(1)}s`}
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-1">
                              <button
                                type="button"
                                onClick={() => adjustSubOffset(-0.5)}
                                className="px-1.5 py-1 rounded bg-cinema-700 hover:bg-cinema-600 text-cinema-200 text-[10px] font-mono font-bold transition-colors cursor-pointer"
                                title="Hiện sớm hơn 0.5s (Phím Z)"
                              >
                                -0.5s (Z)
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSubOffset(0);
                                  triggerPlayerToast("Đã đặt lại độ trễ phụ đề về 0.0s");
                                }}
                                className="px-1.5 py-1 rounded bg-cinema-700 hover:bg-cinema-600 text-cinema-200 text-[10px] font-bold transition-colors cursor-pointer"
                              >
                                0.0s
                              </button>
                              <button
                                type="button"
                                onClick={() => adjustSubOffset(0.5)}
                                className="px-1.5 py-1 rounded bg-cinema-700 hover:bg-cinema-600 text-cinema-200 text-[10px] font-mono font-bold transition-colors cursor-pointer"
                                title="Hiện trễ hơn 0.5s (Phím X)"
                              >
                                +0.5s (X)
                              </button>
                            </div>

                            {/* Font size selector */}
                            <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-cinema-700/50">
                              <span className="text-cinema-300 font-medium">Cỡ chữ:</span>
                              <div className="flex items-center gap-1">
                                {[14, 18, 22, 26].map((size) => (
                                  <button
                                    key={size}
                                    type="button"
                                    onClick={() => setSubtitleFontSize(size)}
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                                      subtitleFontSize === size
                                        ? "bg-brand text-cinema-950"
                                        : "bg-cinema-700 text-cinema-300 hover:bg-cinema-600"
                                    }`}
                                  >
                                    {size === 14 ? "S" : size === 18 ? "M" : size === 22 ? "L" : "XL"}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Turn off subtitle option */}
                        <button
                          type="button"
                          onClick={turnOffSubtitles}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                            currentSubtitleId === -1
                              ? "bg-brand text-cinema-950 font-bold"
                              : "text-cinema-200 hover:bg-cinema-800"
                          }`}
                        >
                          <div className="flex items-center gap-1.5 text-xs">
                            <span>Tắt phụ đề ngoài</span>
                            <span className={`text-[10px] ${currentSubtitleId === -1 ? "text-cinema-950/80" : "text-cinema-500"}`}>
                              (Dùng Vietsub gốc)
                            </span>
                          </div>
                          {currentSubtitleId === -1 && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </button>

                        {/* Online Subtitles Section (1-Click Auto Subtitles) */}
                        <div className="pt-1 space-y-1.5">
                          <div className="flex items-center justify-between px-1">
                            <span className="text-[10px] font-bold text-cinema-400 uppercase tracking-wider flex items-center gap-1">
                              <Globe className="w-3 h-3 text-brand" />
                              Phụ đề Online tự động
                            </span>
                            {isLoadingOnlineSubs ? (
                              <div className="flex items-center gap-1 text-[10px] text-brand">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>Đang tìm...</span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-cinema-500 font-mono">
                                {onlineSubs.length > 0 ? `${onlineSubs.length} bản dịch` : ""}
                              </span>
                            )}
                          </div>

                          {isLoadingOnlineSubs && onlineSubs.length === 0 ? (
                            <div className="p-3 rounded-xl bg-cinema-800/40 border border-cinema-700/40 flex items-center justify-center gap-2 text-xs text-cinema-400">
                              <Loader2 className="w-3.5 h-3.5 text-brand animate-spin" />
                              <span>Đang tìm phụ đề từ máy chủ Stremio...</span>
                            </div>
                          ) : onlineSubs.length > 0 ? (
                            <div className="space-y-1 max-h-[190px] overflow-y-auto pr-0.5 custom-scrollbar">
                              {onlineSubs.map((sub) => {
                                const isSelected = activeOnlineSubId === sub.id && currentSubtitleId === 9999;
                                const isLoadingThis = loadingSubId === sub.id;
                                return (
                                  <button
                                    key={sub.id}
                                    type="button"
                                    disabled={isLoadingThis}
                                    onClick={() => selectOnlineSubtitle(sub)}
                                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl transition-all cursor-pointer text-left border ${
                                      isSelected
                                        ? "bg-brand text-cinema-950 font-bold border-brand shadow-md"
                                        : "bg-cinema-800/70 hover:bg-cinema-800 text-cinema-200 border-cinema-700/40 hover:border-cinema-600"
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 min-w-0 pr-1">
                                      <span className="text-sm leading-none shrink-0">{sub.flag}</span>
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-xs font-semibold">{sub.languageLabel}</span>
                                          <span
                                            className={`text-[8.5px] px-1 py-0.2 rounded font-mono uppercase ${
                                              isSelected
                                                ? "bg-black/20 text-cinema-950 font-bold"
                                                : "bg-cinema-700 text-cinema-400"
                                            }`}
                                          >
                                            {sub.format}
                                          </span>
                                        </div>
                                        <p
                                          className={`text-[9.5px] truncate max-w-[190px] mt-0.5 ${
                                            isSelected ? "text-cinema-950/80 font-normal" : "text-cinema-400"
                                          }`}
                                          title={sub.releaseName}
                                        >
                                          {sub.releaseName}
                                        </p>
                                      </div>
                                    </div>

                                    <div className="shrink-0 flex items-center gap-1 pl-1">
                                      {isLoadingThis ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-brand" />
                                      ) : isSelected ? (
                                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                                      ) : null}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          ) : onlineSubsLoaded ? (
                            <div className="p-2.5 rounded-xl bg-cinema-800/40 border border-cinema-700/40 text-[11px] text-cinema-400 text-center">
                              Không tìm thấy phụ đề online cho tập này.
                            </div>
                          ) : null}
                        </div>

                        {/* Custom uploaded file (if any) */}
                        {customCues.length > 0 && !activeOnlineSubId && (
                          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-brand/10 border border-brand/30 text-xs">
                            <span className="text-brand truncate max-w-[190px]">📁 {customSubtitleName}</span>
                            <Check className="w-3.5 h-3.5 text-brand" />
                          </div>
                        )}

                        {/* Native embedded tracks (if any from video stream) */}
                        {subtitleTracks.length > 0 && (
                          <div className="space-y-1 pt-1 border-t border-cinema-800">
                            <div className="px-1 text-[10px] font-bold text-cinema-400 uppercase tracking-wider">
                              Phụ đề có sẵn trong luồng video
                            </div>
                            {subtitleTracks.map((track) => (
                              <button
                                key={track.id}
                                type="button"
                                onClick={() => selectSubtitle(track.id)}
                                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                                  currentSubtitleId === track.id
                                    ? "bg-brand text-cinema-950 font-bold"
                                    : "text-cinema-200 hover:bg-cinema-800"
                                }`}
                              >
                                <span className="text-xs">{track.label}</span>
                                {currentSubtitleId === track.id && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Manual File Upload Fallback */}
                        <div className="pt-1.5 border-t border-cinema-800 space-y-1">
                          <button
                            type="button"
                            onClick={() => subFileInputRef.current?.click()}
                            className="w-full flex items-center justify-center gap-1.5 p-2 rounded-xl bg-cinema-800/60 hover:bg-cinema-800 border border-cinema-700/50 text-cinema-300 font-medium text-xs transition-colors cursor-pointer"
                          >
                            <Upload className="w-3.5 h-3.5 text-cinema-400" />
                            <span>Hoặc nạp file .srt / .vtt từ máy</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Audio Boost Submenu */}
                    {activeSettingsTab === "boost" && (
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={() => setActiveSettingsTab("main")}
                          className="w-full text-left px-2 py-1 text-[11px] font-bold text-brand hover:underline flex items-center gap-1 mb-1 border-b border-cinema-800 pb-1.5"
                        >
                          ‹ Quay lại
                        </button>
                        <div className="px-2 py-0.5 text-[10px] font-bold text-cinema-400 uppercase tracking-wider">
                          Khuếch đại âm thanh (Web Audio)
                        </div>
                        <p className="px-2 text-[10.5px] text-cinema-400 leading-relaxed">
                          Tăng âm lượng vượt mức 100% khi phim có tiếng thoại quá nhỏ.
                        </p>
                        <div className="space-y-1">
                          {[
                            { lvl: 1, label: "100%", desc: "Mặc định" },
                            { lvl: 1.25, label: "125%", desc: "+25%" },
                            { lvl: 1.5, label: "150%", desc: "+50%" },
                            { lvl: 1.75, label: "175%", desc: "+75%" },
                            { lvl: 2, label: "200%", desc: "Tối đa" },
                          ].map((item) => (
                            <button
                              key={item.lvl}
                              type="button"
                              onClick={() => applyAudioBoost(item.lvl)}
                              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                                audioBoost === item.lvl
                                  ? "bg-amber-500 text-cinema-950 font-bold"
                                  : "text-cinema-200 hover:bg-cinema-800"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-mono">{item.label}</span>
                                <span className={`text-[10px] ${audioBoost === item.lvl ? "text-cinema-950/80" : "text-cinema-500"}`}>
                                  ({item.desc})
                                </span>
                              </div>
                              {audioBoost === item.lvl && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Intro Submenu */}
                    {activeSettingsTab === "intro" && (
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={() => setActiveSettingsTab("main")}
                          className="w-full text-left px-2 py-1 text-[11px] font-bold text-brand hover:underline flex items-center gap-1 mb-1 border-b border-cinema-800 pb-1.5"
                        >
                          ‹ Quay lại
                        </button>

                        <div className="px-2 py-0.5 text-[10px] font-bold text-cinema-400 uppercase tracking-wider">
                          Bỏ qua Intro
                        </div>

                        {/* Quick Skip Now button */}
                        <button
                          type="button"
                          onClick={() => {
                            handleSkipIntro(effectiveSkipDuration);
                            setShowSettings(false);
                          }}
                          className="w-full flex items-center justify-between p-2 rounded-xl bg-brand/10 hover:bg-brand/20 border border-brand/30 text-white font-semibold transition-colors"
                        >
                          <span className="flex items-center gap-2">
                            <FastForward className="w-3.5 h-3.5 text-brand" />
                            <span>Bỏ qua ngay</span>
                          </span>
                          <span className="text-brand text-xs font-mono font-bold">+{effectiveSkipDuration}s</span>
                        </button>

                        {/* Toggle Auto Skip Intro */}
                        <div className="flex items-center justify-between p-2 rounded-xl bg-cinema-800/60 border border-cinema-750">
                          <div>
                            <p className="text-xs font-semibold text-white">Tự động bỏ qua</p>
                            <p className="text-[10px] text-cinema-400">Khi phát đầu tập phim</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              updatePreferences({ autoSkipIntro: !effectiveAutoSkip });
                            }}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                              effectiveAutoSkip ? "bg-brand" : "bg-cinema-700"
                            }`}
                          >
                            <span
                              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-cinema-950 font-bold transition-transform ${
                                effectiveAutoSkip ? "translate-x-4.5" : "translate-x-0.5"
                              }`}
                            />
                          </button>
                        </div>

                        {/* Intro Duration Selection */}
                        <div className="space-y-1 pt-1">
                          <div className="text-[10px] text-cinema-400 font-semibold px-2">Thời lượng Intro:</div>
                          <div className="grid grid-cols-2 gap-1.5">
                            {[
                              { sec: 60, label: "60 giây" },
                              { sec: 85, label: "85s (Anime)" },
                              { sec: 90, label: "90 giây" },
                              { sec: 120, label: "2 phút" },
                            ].map((item) => (
                              <button
                                key={item.sec}
                                type="button"
                                onClick={() => {
                                  updatePreferences({ skipIntroDuration: item.sec });
                                }}
                                className={`px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center justify-between ${
                                  effectiveSkipDuration === item.sec
                                    ? "bg-brand text-cinema-950 font-bold"
                                    : "bg-cinema-800 text-cinema-300 hover:text-white"
                                }`}
                              >
                                <span>{item.label}</span>
                                {effectiveSkipDuration === item.sec && <Check className="w-3 h-3 stroke-[3]" />}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Theater Mode (Chế độ rạp chiếu phim) */}
              {onToggleCinemaMode && (
                <button
                  type="button"
                  onClick={onToggleCinemaMode}
                  aria-label={isCinemaMode ? "Thoát chế độ rạp chiếu phim (Phím C)" : "Chế độ rạp chiếu phim (Phím C)"}
                  className={cn(
                    "transition-colors p-2 rounded-lg hover:bg-white/10 shrink-0 hidden sm:flex items-center justify-center cursor-pointer",
                    isCinemaMode ? "text-brand" : "text-cinema-200 hover:text-white"
                  )}
                  title={isCinemaMode ? "Thoát chế độ rạp chiếu phim (Phím C)" : "Chế độ rạp chiếu phim (Phím C)"}
                >
                  {isCinemaMode ? (
                    /* Default View / Exit Cinema Mode Icon */
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden="true">
                      <path d="M19 6H5a2 2 0 00-2 2v8a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2zm0 10H5V8h14v8zM7 10h10v4H7v-4z" />
                    </svg>
                  ) : (
                    /* YouTube Theater Mode Icon */
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden="true">
                      <path d="M19 4H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zm0 12H5V6h14v10zm-9.3-6.7L7.4 11l2.3 1.7-.8 1.1L5.5 11l3.4-2.8.8 1.1zm4.6 0l.8-1.1L18.5 11l-3.4 2.8-.8-1.1 2.3-1.7-2.3-1.7zM4 19h16v1.5H4V19z" />
                    </svg>
                  )}
                </button>
              )}

              {/* Fullscreen & Rotate Button - Placed right next to Theater Mode */}
              <button
                type="button"
                onClick={toggleFullscreen}
                aria-label={isFullscreen || isCssLandscape ? "Thoát toàn màn hình" : "Toàn màn hình & Tự động xoay ngang"}
                className="text-cinema-200 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10 shrink-0 cursor-pointer"
                title="Toàn màn hình & Tự động xoay ngang (Phím F)"
              >
                {isFullscreen || isCssLandscape ? (
                  <Minimize className="w-5 h-5" />
                ) : (
                  <Maximize className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Nút Chuyển tập kế tiếp hiển thị trên màn hình khi gần hết tập phim */}
      {isSeries &&
        hasNextEpisode &&
        Boolean(onNextEpisode) &&
        hasStarted &&
        duration > 60 &&
        duration - currentTime > 0 &&
        duration - currentTime <= 55 &&
        !nextEpisodeDismissed && (
          <div
            className={cn(
              "absolute right-4 sm:right-6 z-30 transition-all duration-300 pointer-events-auto animate-in fade-in slide-in-from-right-4",
              showControls ? "bottom-20 sm:bottom-24" : "bottom-6"
            )}
          >
            <div className="flex flex-col gap-2.5 p-3 sm:p-3.5 rounded-2xl bg-black/90 hover:bg-black/95 border border-brand/50 shadow-2xl backdrop-blur-md max-w-[280px] sm:max-w-[320px] transition-all">
              {/* Header info */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-brand">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-brand"></span>
                  </span>
                  <span className="text-[10px] font-extrabold tracking-wider uppercase">
                    Tập tiếp theo
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setNextEpisodeDismissed(true)}
                  className="text-cinema-400 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
                  title="Đóng nút (tiếp tục xem hết credit)"
                  aria-label="Đóng nút chuyển tập"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Episode title & remaining notice */}
              <div>
                <p className="text-xs sm:text-sm font-bold text-white line-clamp-1">
                  {nextEpisodeTitle || "Chuyển sang tập kế tiếp"}
                </p>
                {autoNextEnabled && (
                  <p className="text-[11px] text-cinema-400 mt-0.5">
                    Tự động phát sau <strong className="text-brand font-bold font-mono">{Math.max(1, Math.ceil(duration - currentTime))}s</strong>
                  </p>
                )}
              </div>

              {/* Action button */}
              <button
                type="button"
                onClick={() => {
                  cancelAutoNext();
                  hasTriggeredAutoNextRef.current = true;
                  if (onNextEpisode) onNextEpisode();
                }}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-brand hover:bg-brand/90 active:scale-95 text-cinema-950 font-bold text-xs sm:text-sm shadow-lg shadow-brand/30 transition-all cursor-pointer"
              >
                <FastForward className="w-4 h-4 fill-current shrink-0" />
                <span>Chuyển tập ngay</span>
              </button>
            </div>
          </div>
        )}

      {/* Nút Bỏ qua phần giới thiệu (Skip Intro Button) */}
      {hasStarted && !introDismissed && duration > 180 && currentTime >= 2 && currentTime < effectiveSkipDuration && (
        <div
          className={cn(
            "absolute right-4 sm:right-6 z-30 transition-all duration-300 pointer-events-auto animate-in fade-in slide-in-from-right-4",
            showControls ? "bottom-20 sm:bottom-24" : "bottom-6"
          )}
        >
          <div className="flex items-center gap-1 p-1 rounded-xl bg-black/85 hover:bg-black/95 border border-white/20 hover:border-brand/70 shadow-2xl backdrop-blur-md transition-all group/skip">
            <button
              type="button"
              onClick={() => handleSkipIntro(effectiveSkipDuration)}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg bg-brand hover:bg-brand/90 text-cinema-950 font-bold text-xs sm:text-sm transition-all active:scale-95 shadow-lg shadow-brand/30 cursor-pointer"
              title="Bỏ qua phần giới thiệu (Phím S)"
            >
              <FastForward className="w-4 h-4 fill-current shrink-0" />
              <span>Bỏ qua giới thiệu</span>
              <span className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-black/20 text-[10px] font-mono tracking-tighter text-cinema-950 font-extrabold border border-black/10">
                S
              </span>
            </button>
            <button
              type="button"
              onClick={() => setIntroDismissed(true)}
              className="p-2 text-cinema-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              title="Đóng nút bỏ qua intro"
              aria-label="Đóng nút bỏ qua"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Toast thông báo Bỏ qua intro kèm nút Hoàn tác */}
      {skipIntroToast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 bg-cinema-950/95 text-white border border-brand/50 px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-3 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 pointer-events-auto">
          <div className="flex items-center gap-1.5 text-brand">
            <FastForward className="w-4 h-4 shrink-0" />
            <span>{skipIntroToast}</span>
          </div>
          {lastSkipPreviousTime !== null && (
            <button
              type="button"
              onClick={handleUndoSkipIntro}
              className="px-2.5 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-[11px] underline flex items-center gap-1 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Hoàn tác</span>
            </button>
          )}
        </div>
      )}

      {/* iOS Standalone PWA PiP Helper Modal */}
      {iosPipPromptOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-cinema-950 border border-brand/40 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={() => setIosPipPromptOpen(false)}
              className="absolute top-4 right-4 text-cinema-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              title="Đóng"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-14 h-14 rounded-2xl bg-brand/20 border border-brand/40 text-brand flex items-center justify-center mx-auto mb-4 shadow-lg shadow-brand/20">
              <PictureInPicture className="w-7 h-7" />
            </div>

            <h3 className="text-base font-bold text-white mb-2">Chế độ nổi (PiP) trên iPhone</h3>
            <p className="text-xs text-cinema-300 leading-relaxed mb-5">
              Apple chặn tính năng PiP chạy nền khi vuốt về Home đối với ứng dụng cài ngoài Màn hình chính. Để vừa xem vừa lướt ứng dụng khác, bạn chỉ cần mở xem trực tiếp trên <strong className="text-brand">Safari</strong>!
            </p>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={async () => {
                  try {
                    const url = new URL(window.location.href);
                    url.searchParams.set("t", String(Math.floor(currentTime)));
                    const targetUrl = url.toString();

                    if (typeof navigator !== "undefined" && navigator.share) {
                      try {
                        await navigator.share({
                          title: title || "RubbyFilm",
                          url: targetUrl,
                        });
                        setIosPipPromptOpen(false);
                        return;
                      } catch {
                        // User cancelled share dialog
                      }
                    }

                    if (navigator.clipboard) {
                      await navigator.clipboard.writeText(targetUrl);
                      setCopiedToast(true);
                      setTimeout(() => setCopiedToast(false), 3500);
                    }
                  } catch {
                    setCopiedToast(true);
                    setTimeout(() => setCopiedToast(false), 3500);
                  }
                }}
                className="w-full py-3 px-4 rounded-xl bg-brand hover:bg-brand/90 active:scale-95 text-cinema-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-brand/25 transition-all cursor-pointer"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Chia sẻ / Mở trên Safari</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  try {
                    const url = new URL(window.location.href);
                    url.searchParams.set("t", String(Math.floor(currentTime)));
                    if (navigator.clipboard) {
                      await navigator.clipboard.writeText(url.toString());
                      setCopiedToast(true);
                      setTimeout(() => setCopiedToast(false), 3500);
                    }
                  } catch {}
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-cinema-900 hover:bg-cinema-800 text-cinema-200 hover:text-white font-medium text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer border border-cinema-800 active:scale-95"
              >
                <Copy className="w-3.5 h-3.5 text-brand" />
                <span>Sao chép link xem tiếp ({formatTime(currentTime)})</span>
              </button>

              {copiedToast && (
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] leading-tight animate-in fade-in">
                  ✓ Đã sao chép link! Mở Safari và dán vào thanh tìm kiếm để tiếp tục xem kèm PiP nhé.
                </div>
              )}

              <button
                type="button"
                onClick={() => setIosPipPromptOpen(false)}
                className="w-full py-2 px-4 rounded-xl text-cinema-400 hover:text-white font-medium text-xs transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Modal */}
      {showShortcutsModal && (
        <div
          className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setShowShortcutsModal(false)}
        >
          <div
            className="bg-cinema-900 border border-cinema-700/80 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-cinema-800 pb-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-brand" />
                <h3 className="font-bold text-white text-base">Phím tắt trình phát (Shortcuts)</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowShortcutsModal(false)}
                className="p-1.5 rounded-lg text-cinema-400 hover:text-white hover:bg-cinema-800 transition-colors cursor-pointer"
                title="Đóng bảng phím tắt"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded-xl bg-cinema-950/70 border border-cinema-800/80">
                <span className="text-cinema-300">Phát / Tạm dừng</span>
                <kbd className="px-2 py-0.5 rounded-md bg-cinema-800 text-cinema-200 font-mono font-bold text-[11px] border border-cinema-700 shadow-sm">
                  Space
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-cinema-950/70 border border-cinema-800/80">
                <span className="text-cinema-300">Toàn màn hình</span>
                <kbd className="px-2 py-0.5 rounded-md bg-cinema-800 text-cinema-200 font-mono font-bold text-[11px] border border-cinema-700 shadow-sm">
                  F
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-cinema-950/70 border border-cinema-800/80">
                <span className="text-cinema-300">Tua lùi / tới 10s</span>
                <kbd className="px-2 py-0.5 rounded-md bg-cinema-800 text-cinema-200 font-mono font-bold text-[11px] border border-cinema-700 shadow-sm">
                  ← / →
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-cinema-950/70 border border-cinema-800/80">
                <span className="text-cinema-300">Tăng / giảm volume</span>
                <kbd className="px-2 py-0.5 rounded-md bg-cinema-800 text-cinema-200 font-mono font-bold text-[11px] border border-cinema-700 shadow-sm">
                  ↑ / ↓
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-cinema-950/70 border border-cinema-800/80">
                <span className="text-cinema-300">Tắt / Bật tiếng</span>
                <kbd className="px-2 py-0.5 rounded-md bg-cinema-800 text-cinema-200 font-mono font-bold text-[11px] border border-cinema-700 shadow-sm">
                  M
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-cinema-950/70 border border-cinema-800/80">
                <span className="text-cinema-300">Rạp phim (Theater)</span>
                <kbd className="px-2 py-0.5 rounded-md bg-cinema-800 text-cinema-200 font-mono font-bold text-[11px] border border-cinema-700 shadow-sm">
                  C
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-cinema-950/70 border border-cinema-800/80">
                <span className="text-cinema-300">Bỏ qua Intro</span>
                <kbd className="px-2 py-0.5 rounded-md bg-cinema-800 text-cinema-200 font-mono font-bold text-[11px] border border-cinema-700 shadow-sm">
                  S
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-cinema-950/70 border border-cinema-800/80">
                <span className="text-cinema-300">Audio Boost 200%</span>
                <kbd className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 font-mono font-bold text-[11px] border border-amber-500/30 shadow-sm">
                  B
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-cinema-950/70 border border-cinema-800/80">
                <span className="text-cinema-300">Sub sớm 0.5s</span>
                <kbd className="px-2 py-0.5 rounded-md bg-brand/20 text-brand font-mono font-bold text-[11px] border border-brand/30 shadow-sm">
                  Z
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-cinema-950/70 border border-cinema-800/80">
                <span className="text-cinema-300">Sub trễ 0.5s</span>
                <kbd className="px-2 py-0.5 rounded-md bg-brand/20 text-brand font-mono font-bold text-[11px] border border-brand/30 shadow-sm">
                  X
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-cinema-950/70 border border-cinema-800/80 col-span-2">
                <span className="text-cinema-300">Danh sách tập & Server (Binge Mode)</span>
                <kbd className="px-2 py-0.5 rounded-md bg-brand/20 text-brand font-mono font-bold text-[11px] border border-brand/30 shadow-sm">
                  E
                </kbd>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-brand/10 border border-brand/25 text-cinema-300 text-xs flex items-start gap-2.5">
              <span className="text-brand font-bold text-sm">💡</span>
              <div className="leading-relaxed">
                <strong className="text-brand">Tính năng Stremio:</strong> Bạn có thể kéo thả trực tiếp file <strong className="text-white">.srt</strong> hoặc <strong className="text-white">.vtt</strong> từ máy tính vào khung video để xem phụ đề ngay lập tức!
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BINGE MODE DRAWER (Episodes & Servers Quick Switcher) */}
      {showEpisodeDrawer && (
        <div
          className="absolute inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 pointer-events-auto"
          onClick={() => setShowEpisodeDrawer(false)}
        >
          <div
            className="w-full sm:w-[380px] md:w-[430px] h-full bg-cinema-950/95 border-l border-white/10 shadow-2xl flex flex-col backdrop-blur-2xl animate-in slide-in-from-right duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-cinema-800/80 flex items-center justify-between shrink-0 bg-cinema-900/60">
              <div className="space-y-1 pr-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-brand" />
                  </span>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-brand">
                    Binge Mode • Toàn màn hình
                  </span>
                </div>
                <h3 className="font-bold text-white text-base truncate max-w-[260px] sm:max-w-[300px]" title={title}>
                  {title}
                </h3>
                {isSeries && (
                  <p className="text-xs text-cinema-400">
                    Đang xem: <span className="text-white font-semibold">Tập {episodeNumber}</span>
                    {subtitle ? ` • ${subtitle}` : ""}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowEpisodeDrawer(false)}
                className="p-2 rounded-xl text-cinema-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                title="Đóng (Phím E hoặc Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Server Switcher Strip */}
            {sources && sources.length > 1 && (
              <div className="p-3.5 border-b border-cinema-800/70 bg-black/40 shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-cinema-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-brand" />
                    Đổi Máy chủ phát ({sources.length})
                  </span>
                  <span className="text-[10px] text-emerald-400 font-medium">Giữ nguyên giây đang xem</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {sources.map((s, idx) => {
                    const isActive = idx === activeSourceIndex;
                    return (
                      <button
                        key={`${s.serverName}-${idx}`}
                        type="button"
                        onClick={() => handleQuickSwitchServer(idx)}
                        className={cn(
                          "px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer border text-left",
                          isActive
                            ? "bg-brand text-cinema-950 font-bold border-brand shadow-md shadow-brand/20"
                            : "bg-cinema-900/80 text-cinema-300 hover:text-white hover:bg-cinema-800 border-cinema-700/50"
                        )}
                      >
                        <span className="truncate">{s.serverName || `Server #${idx + 1}`}</span>
                        {isActive && <Check className="w-3.5 h-3.5 stroke-[3] shrink-0 ml-1" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Episode List Section */}
            {isSeries && episodes && episodes.length > 0 ? (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Chunk Tabs if episodes > CHUNK_SIZE */}
                {episodeChunks.length > 1 && (
                  <div className="p-2.5 border-b border-cinema-800/70 flex items-center gap-1.5 overflow-x-auto custom-scrollbar shrink-0 bg-cinema-900/30">
                    {episodeChunks.map((chunk, cIdx) => {
                      const startEp = chunk[0].episodeNumber;
                      const endEp = chunk[chunk.length - 1].episodeNumber;
                      const isChunkActive = cIdx === drawerChunkIndex;
                      return (
                        <button
                          key={cIdx}
                          type="button"
                          onClick={() => setDrawerChunkIndex(cIdx)}
                          className={cn(
                            "px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer",
                            isChunkActive
                              ? "bg-brand text-cinema-950"
                              : "bg-cinema-800/80 text-cinema-300 hover:text-white"
                          )}
                        >
                          Tập {startEp} - {endEp}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Episodes Grid */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                    {(episodeChunks[drawerChunkIndex] || episodes).map((ep) => {
                      const isCurrent = ep.episodeNumber === episodeNumber;
                      return (
                        <button
                          key={ep.id}
                          type="button"
                          onClick={() => {
                            if (isCurrent) return;
                            onSelectEpisode?.(ep);
                            setShowEpisodeDrawer(false);
                          }}
                          className={cn(
                            "relative flex flex-col items-center justify-center p-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer group border active:scale-95",
                            isCurrent
                              ? "bg-brand text-cinema-950 border-brand shadow-lg shadow-brand/30 scale-105"
                              : "bg-cinema-900/90 text-cinema-200 border-cinema-800 hover:border-brand/50 hover:bg-cinema-800 hover:text-white"
                          )}
                          title={`Tập ${ep.episodeNumber}${ep.name ? `: ${ep.name}` : ""}`}
                        >
                          <span className="text-sm font-extrabold">{ep.episodeNumber}</span>
                          {isCurrent ? (
                            <span className="flex items-end gap-0.5 h-2.5 mt-1">
                              <span className="w-0.5 h-full bg-cinema-950 animate-pulse rounded-full" />
                              <span className="w-0.5 h-2/3 bg-cinema-950 animate-pulse delay-75 rounded-full" />
                              <span className="w-0.5 h-4/5 bg-cinema-950 animate-pulse delay-150 rounded-full" />
                            </span>
                          ) : (
                            <span className="text-[10px] text-cinema-400 group-hover:text-cinema-300 truncate max-w-full">
                              {ep.duration || "HD"}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Quick Next Episode Action Bar at Bottom */}
                {hasNextEpisode && onNextEpisode && (
                  <div className="p-3 border-t border-cinema-800 bg-cinema-900/80 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        onNextEpisode();
                        setShowEpisodeDrawer(false);
                      }}
                      className="w-full py-2.5 px-4 rounded-xl bg-brand hover:bg-brand/90 active:scale-95 text-cinema-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-brand/20 transition-all cursor-pointer"
                    >
                      <FastForward className="w-4 h-4 fill-current shrink-0" />
                      <span>Phát tập tiếp theo {nextEpisodeTitle ? `(${nextEpisodeTitle})` : ""}</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-cinema-400">
                <Tv className="w-12 h-12 text-cinema-600 mb-3" />
                <p className="text-sm font-medium text-cinema-300">Phim lẻ (Một tập duy nhất)</p>
                <p className="text-xs text-cinema-500 mt-1">
                  Bạn có thể đổi server phát nhanh ở danh sách phía trên.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

VideoPlayer.displayName = "VideoPlayer";
