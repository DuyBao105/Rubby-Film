"use client";

import * as React from "react";

const TROLL_URL =
  "https://www.youtube.com/watch?v=L6JJgJzVkJs&list=RDL6JJgJzVkJs&start_radio=1";

export function AntiDevtools() {
  React.useEffect(() => {
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

    // 1. Chặn phím tắt: F12, Ctrl+Shift+I/J/C, Ctrl+U, Cmd+Option+I/J/C/U
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

      // Ctrl + Shift + I/J/C hoặc Cmd + Alt + I/J/C (Mở Inspect / Console)
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

      // Ctrl + U hoặc Cmd + U (View Source trang web)
      if (isCmdOrCtrl && (e.key === "U" || e.key === "u")) {
        e.preventDefault();
        e.stopPropagation();
        triggerRedirect();
        return false;
      }
    };

    // 2. Phát hiện khi DevTools được mở dạng Docked (qua Menu trình duyệt)
    const checkDevToolsSize = () => {
      const threshold = 160;
      const widthDiff = window.outerWidth - window.innerWidth > threshold;
      const heightDiff = window.outerHeight - window.innerHeight > threshold;

      if (widthDiff || heightDiff) {
        triggerRedirect();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("resize", checkDevToolsSize, { passive: true });

    // Kiểm tra ngay sau khi load
    const timer = setTimeout(checkDevToolsSize, 1200);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("resize", checkDevToolsSize);
      clearTimeout(timer);
    };
  }, []);

  return null;
}
