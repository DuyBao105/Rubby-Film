"use client";

import * as React from "react";

const TROLL_URL =
  "https://www.youtube.com/watch?v=L6JJgJzVkJs&list=RDL6JJgJzVkJs&start_radio=1";

// Sensitive keywords to prevent leaking in DevTools console
const BLOCKED_CONSOLE_PATTERNS = [
  "kvp726",
  "phimapi",
  "nguonc",
  "streamc",
  "opstream",
  "artplayer",
  "webextension",
  "ERR_BLOCKED_BY_CLIENT",
  "run-ad-auction",
  "attribution-reporting",
  "private-aggregation",
  "join-ad-interest-group",
  "Could not establish connection",
  "Receiving end does not exist",
  "Permissions-Policy",
];

export function AntiDevtools() {
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Global Console Sanitizer & Third-Party Shield
    // Silences noisy third-party ad scripts, browser extensions, and upstream domains
    const originalError = console.error;
    const originalWarn = console.warn;

    const shouldSuppress = (args: any[]): boolean => {
      try {
        const text = args
          .map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg) || String(arg)))
          .join(" ");
        return BLOCKED_CONSOLE_PATTERNS.some((pattern) =>
          text.toLowerCase().includes(pattern.toLowerCase())
        );
      } catch {
        return false;
      }
    };

    console.error = function (...args: any[]) {
      if (shouldSuppress(args)) return;
      originalError.apply(console, args);
    };

    console.warn = function (...args: any[]) {
      if (shouldSuppress(args)) return;
      originalWarn.apply(console, args);
    };

    const handleWindowError = (e: ErrorEvent) => {
      const filename = e.filename || "";
      const msg = e.message || "";
      if (
        filename.includes("webextension") ||
        filename.includes("extension") ||
        BLOCKED_CONSOLE_PATTERNS.some((p) => msg.toLowerCase().includes(p.toLowerCase()))
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return true;
      }
    };

    const handleUnhandledRejection = (e: PromiseRejectionEvent) => {
      const reasonStr = String(e.reason || "");
      if (BLOCKED_CONSOLE_PATTERNS.some((p) => reasonStr.toLowerCase().includes(p.toLowerCase()))) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };

    window.addEventListener("error", handleWindowError, true);
    window.addEventListener("unhandledrejection", handleUnhandledRejection, true);

    // 2. Anti-Inspection Shortcuts (production desktop only)
    if (process.env.NODE_ENV === "development") {
      return () => {
        console.error = originalError;
        console.warn = originalWarn;
        window.removeEventListener("error", handleWindowError, true);
        window.removeEventListener("unhandledrejection", handleUnhandledRejection, true);
      };
    }

    const isTouchOrMobile =
      "ontouchstart" in window ||
      navigator.maxTouchPoints > 0 ||
      /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent || ""
      );

    if (isTouchOrMobile) {
      return () => {
        console.error = originalError;
        console.warn = originalWarn;
        window.removeEventListener("error", handleWindowError, true);
        window.removeEventListener("unhandledrejection", handleUnhandledRejection, true);
      };
    }

    let isRedirecting = false;

    const triggerRedirect = () => {
      if (isRedirecting) return;
      isRedirecting = true;
      try {
        window.location.replace(TROLL_URL);
      } catch {
        window.location.href = TROLL_URL;
      }
    };

    // Chỉ chặn các phím tắt bấm F12 / Inspect trên bàn phím máy tính
    const handleKeyDown = (e: KeyboardEvent) => {
      // Phím F12
      if (e.key === "F12" || e.keyCode === 123) {
        e.preventDefault();
        e.stopPropagation();
        triggerRedirect();
        return false;
      }

      const isCmdOrCtrl = e.ctrlKey || e.metaKey;
      const isShiftOrAlt = e.shiftKey || e.altKey;

      // Ctrl + Shift + I/J/C hoặc Cmd + Alt + I/J/C (Inspect / Console)
      if (
        isCmdOrCtrl &&
        isShiftOrAlt &&
        ["I", "i", "J", "j", "C", "c"].includes(e.key)
      ) {
        e.preventDefault();
        e.stopPropagation();
        triggerRedirect();
        return false;
      }

      // Ctrl + U hoặc Cmd + U (View Source)
      if (isCmdOrCtrl && (e.key === "U" || e.key === "u")) {
        e.preventDefault();
        e.stopPropagation();
        triggerRedirect();
        return false;
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      console.error = originalError;
      console.warn = originalWarn;
      window.removeEventListener("error", handleWindowError, true);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection, true);
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, []);

  return null;
}
