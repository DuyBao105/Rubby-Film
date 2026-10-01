"use client";

import * as React from "react";
import { AlertCircle, RotateCcw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("Global application error caught:", error);
    // Attempt automatic cache purge on root exception
    if (typeof window !== "undefined" && "caches" in window) {
      caches.keys().then((keys) => {
        keys.forEach((k) => caches.delete(k));
      });
    }
  }, [error]);

  const handleHardReload = () => {
    try {
      const win = typeof window !== "undefined" ? (window as Window) : null;
      if (win) {
        if ("caches" in win && (win as any).caches) {
          (win as any).caches.keys().then((keys: string[]) => {
            keys.forEach((k) => (win as any).caches.delete(k));
            win.location.reload();
          }).catch(() => {
            win.location.reload();
          });
          return;
        }
        win.location.reload();
        return;
      }
    } catch {}
    reset();
  };

  return (
    <html lang="vi" className="dark">
      <body className="min-h-screen flex flex-col items-center justify-center bg-[#0D0F12] text-white p-6 font-sans">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-brand/10 border border-brand/30 text-brand flex items-center justify-center mx-auto shadow-xl shadow-brand/20">
            <AlertCircle className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Đã Xảy Ra Sự Cố Kết Nối
            </h1>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Trang web vừa có bản cập nhật mới trên máy chủ. Vui lòng bấm làm mới để tải phiên bản mới nhất.
            </p>
          </div>

          <button
            type="button"
            onClick={handleHardReload}
            className="w-full py-3.5 px-6 rounded-xl bg-[#E50000] hover:bg-[#CC0000] active:scale-98 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#E50000]/30 transition-all cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Tải Lại Trang Ngay</span>
          </button>
        </div>
      </body>
    </html>
  );
}
