"use client";

import * as React from "react";

const TROLL_URL =
  "https://www.youtube.com/watch?v=L6JJgJzVkJs&list=RDL6JJgJzVkJs&start_radio=1";

export function AntiDevtools() {
  React.useEffect(() => {
    // Bỏ qua hoàn toàn trên điện thoại / máy tính bảng vì không có phím F12
    if (typeof window === "undefined") return;

    const isTouchOrMobile =
      "ontouchstart" in window ||
      navigator.maxTouchPoints > 0 ||
      /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent || ""
      );

    if (isTouchOrMobile) {
      return;
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
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, []);

  return null;
}
