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
} from "lucide-react";
import Hls from "hls.js";
import { VideoSource } from "@/types/movie";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { decryptStreamUrl } from "@/lib/utils/streamSecurity";

interface QualityOption {
  index: number; // -1 for Auto
  label: string;
  height: number;
}

interface VideoPlayerProps {
  source: VideoSource;
  sources?: VideoSource[];
  activeSourceIndex?: number;
  onSelectSourceIndex?: (index: number) => void;
  title: string;
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
  onSwitchServer?: () => void;
  isCinemaMode?: boolean;
  onToggleCinemaMode?: () => void;
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
      onSwitchServer,
      isCinemaMode = false,
      onToggleCinemaMode,
    },
    ref
  ) {
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const progressBarRef = React.useRef<HTMLDivElement>(null);
    const hlsRef = React.useRef<Hls | null>(null);

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
  const [activeSettingsTab, setActiveSettingsTab] = React.useState<"main" | "speed" | "quality" | "subtitle" | "audio">("main");
  const [videoFit, setVideoFit] = React.useState<"contain" | "cover" | "fill">("contain");
  const [isLoading, setIsLoading] = React.useState(false);
  const [hasError, setHasError] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState("");
  const [autoNextCountdown, setAutoNextCountdown] = React.useState<number | null>(null);
  const [isCssLandscape, setIsCssLandscape] = React.useState(false);
  const [isIosStandalone, setIsIosStandalone] = React.useState(false);
  const [iosPipPromptOpen, setIosPipPromptOpen] = React.useState(false);

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

  // Subtitle tracks
  const [subtitleTracks, setSubtitleTracks] = React.useState<{ id: number; label: string }[]>([]);
  const [currentSubtitleId, setCurrentSubtitleId] = React.useState<number>(-1); // -1 = off

  // Picture in picture support
  const [isPipSupported, setIsPipSupported] = React.useState(false);

  // Refs to prevent re-initializing playback or re-seeking during active playback
  const initialTimeRef = React.useRef(initialTime);
  const hasAppliedInitialTimeRef = React.useRef(false);
  const hasStartedRef = React.useRef(hasStarted);

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
  }, [source.url]);

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
    if (
      video &&
      (video as any).webkitSupportsPresentationMode &&
      typeof (video as any).webkitSupportsPresentationMode === "function" &&
      (video as any).webkitSupportsPresentationMode("picture-in-picture")
    ) {
      setIsPipSupported(true);
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

  // Clean up Hls instance
  const destroyHls = () => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  };

  // Initialize playback or Hls stream
  const initPlayer = React.useCallback(() => {
    setHasError(false);
    setErrorMessage("");
    setIsLoading(true);
    setQualities([]);
    destroyHls();

    const video = videoRef.current;
    if (!video) return;

    const rawStreamUrl = decryptStreamUrl(source.url);
    const isHls =
      source.type === "hls" ||
      (rawStreamUrl && (rawStreamUrl.includes(".m3u8") || rawStreamUrl.includes("hls")));

    if (isHls) {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 60,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          maxBufferSize: 60 * 1000 * 1000,
          startLevel: -1,
          capLevelToPlayerSize: true,
        });
        hlsRef.current = hls;

        hls.loadSource(rawStreamUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsLoading(false);

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
          }
        });

        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.warn("HLS network error, recovering...", data);
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.warn("HLS media error, recovering...", data);
                hls.recoverMediaError();
                break;
              default:
                destroyHls();
                setHasError(true);
                setErrorMessage("Không thể tải luồng video HLS này. Vui lòng thử lại hoặc đổi server.");
                setIsLoading(false);
                break;
            }
          }
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        // Native Safari HLS
        video.src = rawStreamUrl;
        if (!hasAppliedInitialTimeRef.current && initialTimeRef.current > 0) {
          attemptSeekToInitialTime();
        }
      } else {
        setHasError(true);
        setErrorMessage("Trình duyệt không hỗ trợ giải mã định dạng video HLS.");
        setIsLoading(false);
      }
    } else {
      // Direct MP4 or video source
      video.src = rawStreamUrl;
      if (!hasAppliedInitialTimeRef.current && initialTimeRef.current > 0) {
        attemptSeekToInitialTime();
      }
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

  // Keyboard controls
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

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
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    setHasStarted(true);

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
        .catch(() => {
          setIsPlaying(false);
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

  const skipTime = (seconds: number) => {
    if (videoRef.current) {
      const nextTime = Math.max(0, Math.min(duration || 10000, currentTime + seconds));
      videoRef.current.currentTime = nextTime;
      setCurrentTime(nextTime);
      triggerSeekFeedback(seconds > 0 ? "forward" : "rewind", seconds);
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

    if (isIosStandalone) {
      setIosPipPromptOpen(true);
      return;
    }

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (video.requestPictureInPicture) {
        await video.requestPictureInPicture();
      } else if (
        (video as any).webkitSupportsPresentationMode &&
        typeof (video as any).webkitSetPresentationMode === "function"
      ) {
        const currentMode = (video as any).webkitPresentationMode;
        (video as any).webkitSetPresentationMode(
          currentMode === "picture-in-picture" ? "inline" : "picture-in-picture"
        );
      } else {
        const isIOSDevice =
          typeof navigator !== "undefined" &&
          (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
            (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
        if (isIOSDevice) {
          setIosPipPromptOpen(true);
        }
      }
    } catch (err) {
      console.warn("PiP error:", err);
      const isIOSDevice =
        typeof navigator !== "undefined" &&
        (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
          (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
      if (isIOSDevice) {
        setIosPipPromptOpen(true);
      }
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
    const video = videoRef.current;
    if (!video) return;
    Array.from(video.textTracks || []).forEach((t, idx) => {
      t.mode = idx === id ? "showing" : "disabled";
    });
    setCurrentSubtitleId(id);
    setShowSettings(false);
    setActiveSettingsTab("main");
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
      setAutoNextCountdown(5);
      let count = 5;
      autoNextTimerRef.current = setInterval(() => {
        count -= 1;
        if (count <= 0) {
          if (autoNextTimerRef.current) clearInterval(autoNextTimerRef.current);
          setAutoNextCountdown(null);
          onNextEpisode();
        } else {
          setAutoNextCountdown(count);
        }
      }, 1000);
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
    if (lower.includes("vietsub")) return "Vietsub";
    return "Vietsub";
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
        <iframe
          src={decryptStreamUrl(source.url)}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
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
        {...({
          "webkit-playsinline": "true",
          autoPictureInPicture: true,
          "x-webkit-airplay": "allow",
        } as any)}
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
        }}
        onWaiting={() => setIsLoading(true)}
        onPlaying={() => {
          setIsLoading(false);
          setIsPlaying(true);
          setHasStarted(true);
        }}
        onPause={() => {
          setIsPlaying(false);
          if (onPause) onPause();
        }}
        onEnded={handleEnded}
        onError={() => {
          setHasError(true);
          setErrorMessage("Không thể phát video này. Định dạng hoặc đường truyền gặp sự cố.");
          setIsLoading(false);
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
              className="w-20 h-20 rounded-full bg-brand text-cinema-950 flex items-center justify-center shadow-2xl shadow-brand/40 transition-transform hover:scale-110 active:scale-95 mb-4 group/play"
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
            {errorMessage || "Unable to play this video. Vui lòng tải lại hoặc chọn nguồn phát khác."}
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
            {onSwitchServer && (
              <Button
                variant="secondary"
                onClick={onSwitchServer}
                className="gap-2"
              >
                <Server className="w-4 h-4 text-brand" />
                <span>Đổi Server</span>
              </Button>
            )}
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
            {/* Hover Tooltip Timestamp */}
            {hoverTime !== null && (
              <div
                className="absolute -top-8 px-2 py-0.5 rounded bg-black/90 border border-cinema-700 text-[11px] font-mono text-white pointer-events-none -translate-x-1/2 shadow-lg"
                style={{ left: `${hoverPercent}%` }}
              >
                {formatTime(hoverTime)}
              </div>
            )}

            {/* Background track */}
            <div className="relative w-full h-2 group-hover/bar:h-2.5 rounded-full bg-cinema-800/80 overflow-hidden transition-all">
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

            {/* Scrub thumb */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-white rounded-full shadow-lg opacity-100 sm:opacity-0 sm:group-hover/bar:opacity-100 transition-opacity pointer-events-none"
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
                  title="Cài đặt (Tốc độ, Chất lượng)"
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

                        {/* Subtitles Entry (only show if real tracks exist) */}
                        {subtitleTracks.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setActiveSettingsTab("subtitle")}
                            className="w-full flex items-center justify-between p-2 rounded-xl text-cinema-200 hover:bg-cinema-800 hover:text-white transition-colors"
                          >
                            <span className="flex items-center gap-2">
                              <Subtitles className="w-3.5 h-3.5 text-brand" />
                              <span>Phụ đề</span>
                            </span>
                            <span className="text-cinema-400 font-semibold">
                              {currentSubtitleId === -1 ? "Tắt" : subtitleTracks.find(t => t.id === currentSubtitleId)?.label} ›
                            </span>
                          </button>
                        )}
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
                          Nguồn phát / Bản dịch
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
                                    if (onSelectSourceIndex) onSelectSourceIndex(idx);
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
                              <span>Bản Vietsub chuẩn Full HD</span>
                            </div>
                            <p className="text-[11px] text-cinema-400 leading-relaxed">
                              Bản phim mặc định có phụ đề tiếng Việt chính thức.
                            </p>
                          </div>
                        )}

                        <div className="p-2 rounded-lg bg-cinema-900/90 border border-cinema-800 text-[10.5px] text-cinema-400 leading-snug">
                          <span className="text-zinc-300 font-semibold">Lưu ý:</span> Phụ đề Vietsub được tích hợp sẵn trực tiếp trong video (Hardsub) để đảm bảo độ nét và tốc độ cao, không thể tắt riêng hoặc đổi song ngữ.
                        </div>
                      </div>
                    )}

                    {/* Subtitle Submenu */}
                    {activeSettingsTab === "subtitle" && (
                      <div className="space-y-1">
                        <button
                          type="button"
                          onClick={() => setActiveSettingsTab("main")}
                          className="w-full text-left px-2 py-1 text-[11px] font-bold text-brand hover:underline flex items-center gap-1 mb-1 border-b border-cinema-800 pb-1.5"
                        >
                          ‹ Quay lại
                        </button>
                        <button
                          type="button"
                          onClick={() => selectSubtitle(-1)}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors ${
                            currentSubtitleId === -1
                              ? "bg-brand text-cinema-950 font-bold"
                              : "text-cinema-200 hover:bg-cinema-800"
                          }`}
                        >
                          <span>Tắt phụ đề</span>
                          {currentSubtitleId === -1 && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </button>
                        {subtitleTracks.map((track) => (
                          <button
                            key={track.id}
                            type="button"
                            onClick={() => selectSubtitle(track.id)}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors ${
                              currentSubtitleId === track.id
                                ? "bg-brand text-cinema-950 font-bold"
                                : "text-cinema-200 hover:bg-cinema-800"
                            }`}
                          >
                            <span>{track.label}</span>
                            {currentSubtitleId === track.id && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </button>
                        ))}
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
            <p className="text-xs text-cinema-300 leading-relaxed mb-6">
              Hệ điều hành iOS của Apple chặn chế độ nổi PiP khi mở từ App cài trên màn hình chính. Để vừa xem phim thu nhỏ vừa lướt app khác, bạn hãy chuyển sang trình duyệt Safari!
            </p>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  try {
                    const url = new URL(window.location.href);
                    url.searchParams.set("t", String(Math.floor(currentTime)));
                    const safariUrl = url.toString().replace(/^https?:\/\//i, "x-safari-https://");
                    window.location.href = safariUrl;
                    setTimeout(() => {
                      window.open(url.toString(), "_blank");
                    }, 400);
                  } catch {
                    window.open(window.location.href, "_blank");
                  }
                  setIosPipPromptOpen(false);
                }}
                className="w-full py-3 px-4 rounded-xl bg-brand hover:bg-brand/90 active:scale-95 text-cinema-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-brand/25 transition-all cursor-pointer"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Mở trên Safari để dùng PiP</span>
              </button>

              <button
                type="button"
                onClick={() => setIosPipPromptOpen(false)}
                className="w-full py-2.5 px-4 rounded-xl bg-cinema-900 hover:bg-cinema-800 text-cinema-300 hover:text-white font-medium text-xs transition-colors cursor-pointer border border-cinema-800"
              >
                Để sau
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

VideoPlayer.displayName = "VideoPlayer";
