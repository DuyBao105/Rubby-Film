"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const SESSION_STORAGE_KEY = "rubbyfilm_presence_session";

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!id) {
      id = `rf_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
      sessionStorage.setItem(SESSION_STORAGE_KEY, id);
    }
    return id;
  } catch {
    return `rf_temp_${Date.now()}`;
  }
}

function detectDevice(): "mobile" | "desktop" {
  if (typeof window === "undefined") return "desktop";
  const ua = navigator.userAgent;
  const isMobileUa = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isSmallScreen = window.innerWidth <= 768;
  return isMobileUa || isSmallScreen ? "mobile" : "desktop";
}

export function AnalyticsHeartbeat() {
  const pathname = usePathname();
  const sessionIdRef = useRef<string>("");

  useEffect(() => {
    sessionIdRef.current = getOrCreateSessionId();
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;

    const device = detectDevice();

    const sendHeartbeat = () => {
      // Don't send if tab is hidden to save client & server resources
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }

      const payload = JSON.stringify({
        sessionId,
        page: pathname || window.location.pathname || "/",
        title: typeof document !== "undefined" ? document.title : undefined,
        device,
      });

      fetch("/api/analytics/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    };

    // 1. Send immediately upon navigation / mount
    sendHeartbeat();

    // 2. High-frequency live heartbeat (every 12s)
    const interval = setInterval(sendHeartbeat, 12000);

    // 3. Send heartbeat immediately when user switches back to tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        sendHeartbeat();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // 4. Send leave signal immediately when closing tab or navigating away
    const handleLeave = () => {
      const payload = JSON.stringify({ sessionId });
      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon("/api/analytics/heartbeat?action=leave", blob);
      } else {
        fetch("/api/analytics/heartbeat?action=leave", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    };

    window.addEventListener("pagehide", handleLeave);
    window.addEventListener("beforeunload", handleLeave);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handleLeave);
      window.removeEventListener("beforeunload", handleLeave);
    };
  }, [pathname]);

  return null;
}
