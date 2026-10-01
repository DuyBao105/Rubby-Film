"use client";

import * as React from "react";
import Image from "next/image";
import {
  Download,
  Share2,
  PlusSquare,
  X,
  CheckCircle2,
  Smartphone,
  MoreVertical,
} from "lucide-react";

const STORAGE_KEY = "rubyfilm_pwa_dismissed_until";
const DISMISS_DAYS = 5; // Remind after 5 days if dismissed

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

export function triggerPwaInstall() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("rubyfilm-open-install"));
  }
}

export function PwaInstallPrompt() {
  const [mounted, setMounted] = React.useState(false);
  const [deferredPrompt, setDeferredPrompt] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [activeTab, setActiveTab] = React.useState<"ios" | "android">("ios");
  const [isStandalone, setIsStandalone] = React.useState(false);
  const [isVisible, setIsVisible] = React.useState(false);
  const [showGuideModal, setShowGuideModal] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);

    // Register PWA Service Worker
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => {
            console.log("[PWA] Service worker registered successfully:", reg.scope);
          })
          .catch((err) => {
            console.warn("[PWA] Service worker registration error:", err);
          });
      });
    }

    const nav = window.navigator as NavigatorWithStandalone;
    const isStandaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      nav.standalone === true ||
      window.matchMedia("(display-mode: window-controls-overlay)").matches;

    if (isStandaloneMode) {
      setIsStandalone(true);
      return;
    }

    const ua = window.navigator.userAgent || "";
    const isIOSDevice =
      (/iPad|iPhone|iPod/.test(ua) && !("MSStream" in window)) ||
      (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);

    const initialTab: "ios" | "android" = isIOSDevice ? "ios" : "android";
    setActiveTab(initialTab);

    const dismissedUntil = Number(localStorage.getItem(STORAGE_KEY) || 0);
    const hasDismissed = Date.now() < dismissedUntil;

    let autoShowTimer: number | undefined;

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      if (!hasDismissed) {
        autoShowTimer = window.setTimeout(() => setIsVisible(true), 2500);
      }
    };

    const handleAppInstalled = () => {
      setIsVisible(false);
      setShowGuideModal(false);
      setDeferredPrompt(null);
      try {
        localStorage.setItem(STORAGE_KEY, String(Date.now() + 365 * 24 * 60 * 60 * 1000));
      } catch {}
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    if (isIOSDevice && !hasDismissed) {
      autoShowTimer = window.setTimeout(() => setIsVisible(true), 3500);
    }

    const handleManualOpen = () => {
      setIsVisible(true);
      if (!deferredPrompt || isIOSDevice) {
        setShowGuideModal(true);
      } else {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
          if (choiceResult.outcome === "accepted") {
            setIsVisible(false);
          }
        });
      }
    };

    window.addEventListener("rubyfilm-open-install", handleManualOpen);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      window.removeEventListener("rubyfilm-open-install", handleManualOpen);
      if (autoShowTimer) window.clearTimeout(autoShowTimer);
    };
  }, [deferredPrompt]);

  const handleDismiss = () => {
    setIsVisible(false);
    setShowGuideModal(false);
    try {
      const dismissUntil = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000;
      localStorage.setItem(STORAGE_KEY, String(dismissUntil));
    } catch {}
  };

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult.outcome === "accepted") {
          setIsVisible(false);
          try {
            localStorage.setItem(STORAGE_KEY, String(Date.now() + 365 * 24 * 60 * 60 * 1000));
          } catch {}
        }
        setDeferredPrompt(null);
      } catch {
        setShowGuideModal(true);
      }
    } else {
      setShowGuideModal(true);
    }
  };

  if (!mounted || isStandalone) return null;

  return (
    <>
      {/* Floating Bottom Prompt Bar (Mobile Only) */}
      {isVisible && !showGuideModal && (
        <div className="md:hidden fixed bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] left-3 right-3 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="bg-[#121212]/95 backdrop-blur-2xl border border-[#2A2A2A] rounded-2xl p-3.5 shadow-2xl shadow-black/80 flex items-center justify-between gap-3 text-white">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative w-11 h-11 rounded-xl overflow-hidden shrink-0 border border-white/10 shadow-md">
                <Image
                  src="/icon-192x192.png"
                  alt="RubyFilm Icon"
                  width={44}
                  height={44}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs font-bold text-white tracking-wide truncate">
                    Cài RubyFilm vào máy
                  </h4>
                  <span className="inline-flex items-center px-1.5 py-0.2 text-[9px] font-semibold bg-[#E50000]/20 text-[#FF4D4D] border border-[#E50000]/30 rounded">
                    App
                  </span>
                </div>
                <p className="text-[11px] text-[#A3A3A3] truncate mt-0.5">
                  Trải nghiệm tràn viền, mượt mà như app gốc
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleInstallClick}
                className="px-3 py-1.5 bg-[#E50000] hover:bg-[#CC0000] active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-[#E50000]/25 flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Cài đặt</span>
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="p-1.5 text-[#888] hover:text-white rounded-lg transition-colors cursor-pointer"
                title="Đóng thông báo"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cross-Platform Installation Guide Modal */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#141414] border border-[#2E2E2E] rounded-3xl p-5 sm:p-6 w-full max-w-sm sm:max-w-md shadow-2xl relative text-white animate-in zoom-in-95 duration-200">
            {/* Close Button */}
            <button
              type="button"
              onClick={handleDismiss}
              className="absolute top-4 right-4 p-2 text-[#999] hover:text-white rounded-full bg-white/5 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3.5 mb-4">
              <div className="relative w-12 h-12 rounded-2xl overflow-hidden shrink-0 border border-white/10 shadow-lg">
                <Image
                  src="/icon-192x192.png"
                  alt="RubyFilm Icon"
                  width={48}
                  height={48}
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Cài đặt RubyFilm App
                </h3>
                <p className="text-xs text-[#9CA3AF]">
                  Khởi động tức thì từ màn hình chính thiết bị
                </p>
              </div>
            </div>

            {/* Platform Selection Tabs (iPhone / Android) */}
            <div className="flex items-center gap-1.5 p-1 bg-[#0A0A0A] rounded-xl border border-[#222] mb-4">
              <button
                type="button"
                onClick={() => setActiveTab("ios")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === "ios"
                    ? "bg-[#E50000] text-white shadow-sm"
                    : "text-[#888] hover:text-white"
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>iPhone / iPad</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("android")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === "android"
                    ? "bg-[#E50000] text-white shadow-sm"
                    : "text-[#888] hover:text-white"
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Android</span>
              </button>
            </div>

            {/* Steps Guide Content */}
            <div className="space-y-3 bg-[#0A0A0A] p-4 rounded-2xl border border-[#222]">
              {activeTab === "ios" && (
                <>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-[#E50000]/20 text-[#FF4D4D] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </div>
                    <div className="text-xs text-[#D1D5DB] leading-relaxed">
                      Nhấn vào nút <strong className="text-white">Chia sẻ</strong>{" "}
                      <Share2 className="w-3.5 h-3.5 inline mx-1 text-[#3B82F6]" />{" "}
                      (ở thanh dưới cùng của Safari, hoặc bên phải thanh địa chỉ / menu 3 chấm của Chrome).
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-[#E50000]/20 text-[#FF4D4D] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </div>
                    <div className="text-xs text-[#D1D5DB] leading-relaxed">
                      Cuộn xuống danh sách tùy chọn và chọn mục{" "}
                      <strong className="text-white">&ldquo;Thêm vào MH chính&rdquo;</strong> (Add to Home Screen){" "}
                      <PlusSquare className="w-3.5 h-3.5 inline mx-1 text-emerald-400" />.
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-[#E50000]/20 text-[#FF4D4D] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      3
                    </div>
                    <div className="text-xs text-[#D1D5DB] leading-relaxed">
                      Nhấn <strong className="text-white">&ldquo;Thêm&rdquo; (Add)</strong> ở góc trên bên phải màn hình để hoàn tất.
                    </div>
                  </div>
                </>
              )}

              {activeTab === "android" && (
                <>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-[#E50000]/20 text-[#FF4D4D] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </div>
                    <div className="text-xs text-[#D1D5DB] leading-relaxed">
                      Nhấn vào biểu tượng <strong className="text-white">Menu 3 chấm</strong>{" "}
                      <MoreVertical className="w-3.5 h-3.5 inline mx-1 text-[#FECF59]" />{" "}
                      ở góc trên bên phải trình duyệt Chrome / Cốc Cốc.
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-[#E50000]/20 text-[#FF4D4D] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </div>
                    <div className="text-xs text-[#D1D5DB] leading-relaxed">
                      Chọn mục <strong className="text-white">&ldquo;Cài đặt ứng dụng&rdquo;</strong> hoặc{" "}
                      <strong className="text-white">&ldquo;Thêm vào Màn hình chính&rdquo;</strong>.
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-[#E50000]/20 text-[#FF4D4D] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      3
                    </div>
                    <div className="text-xs text-[#D1D5DB] leading-relaxed">
                      Bấm xác nhận <strong className="text-white">&ldquo;Cài đặt&rdquo;</strong> để đưa RubyFilm ra màn hình chính.
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Success message / tip */}
            <div className="mt-4 flex items-center gap-2 text-[11px] text-[#9CA3AF] px-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Khởi chạy từ icon màn hình chính sẽ tràn viền và tải phim nhanh hơn!</span>
            </div>

            {/* Understood Button */}
            <div className="mt-5">
              <button
                type="button"
                onClick={handleDismiss}
                className="w-full py-2.5 bg-[#E50000] hover:bg-[#CC0000] active:scale-[0.99] text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-[#E50000]/25 cursor-pointer"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
