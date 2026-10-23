"use client";

import * as React from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: ToastItem[];
  showToast: (toast: Omit<ToastItem, "id">) => string;
  dismissToast: (id: string) => void;
  success: (title: string, message?: string) => string;
  error: (title: string, message?: string) => string;
  warning: (title: string, message?: string) => string;
  info: (title: string, message?: string) => string;
}

const ToastContext = React.createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const dismissToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = React.useCallback(
    ({ type = "info", title, message, duration = 4000 }: Omit<ToastItem, "id">) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newToast: ToastItem = { id, type, title, message, duration };

      setToasts((prev) => [...prev.slice(-3), newToast]); // keep max 4 toasts

      if (duration > 0) {
        setTimeout(() => {
          dismissToast(id);
        }, duration);
      }
      return id;
    },
    [dismissToast]
  );

  // Check for pending toast queued before hard navigation/redirect
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const pending = sessionStorage.getItem("rubbyfilm_pending_toast");
      if (pending) {
        sessionStorage.removeItem("rubbyfilm_pending_toast");
        const parsed = JSON.parse(pending);
        if (parsed && parsed.title) {
          showToast(parsed);
        }
      }
    } catch {}
  }, [showToast]);

  const success = React.useCallback(
    (title: string, message?: string) => showToast({ type: "success", title, message }),
    [showToast]
  );

  const error = React.useCallback(
    (title: string, message?: string) => showToast({ type: "error", title, message }),
    [showToast]
  );

  const warning = React.useCallback(
    (title: string, message?: string) => showToast({ type: "warning", title, message }),
    [showToast]
  );

  const info = React.useCallback(
    (title: string, message?: string) => showToast({ type: "info", title, message }),
    [showToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast, success, error, warning, info }}>
      {children}
      {/* Toast Container */}
      <div
        className="fixed top-4 right-4 left-4 sm:left-auto sm:w-96 z-[9999] flex flex-col gap-2.5 pointer-events-none"
        aria-live="polite"
      >
        {toasts.map((toast) => {
          const isSuccess = toast.type === "success";
          const isError = toast.type === "error";
          const isWarning = toast.type === "warning";
          const isInfo = toast.type === "info";

          return (
            <div
              key={toast.id}
              className={cn(
                "pointer-events-auto rounded-2xl p-4 shadow-2xl backdrop-blur-xl border transition-all duration-300 animate-in fade-in slide-in-from-top-4",
                isSuccess &&
                  "bg-[#141414]/95 border-emerald-500/40 text-emerald-300 shadow-emerald-500/10",
                isError &&
                  "bg-[#141414]/95 border-red-500/40 text-red-300 shadow-red-500/10",
                isWarning &&
                  "bg-[#141414]/95 border-amber-500/40 text-amber-300 shadow-amber-500/10",
                isInfo &&
                  "bg-[#141414]/95 border-[#2E2E2E] text-[#F9FAFB] shadow-black/40"
              )}
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className="shrink-0 mt-0.5">
                  {isSuccess && (
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  )}
                  {isError && (
                    <div className="w-8 h-8 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
                      <AlertCircle className="w-4 h-4" />
                    </div>
                  )}
                  {isWarning && (
                    <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                      <AlertCircle className="w-4 h-4" />
                    </div>
                  )}
                  {isInfo && (
                    <div className="w-8 h-8 rounded-xl bg-[#FECF59]/15 border border-[#FECF59]/30 flex items-center justify-center text-[#FECF59]">
                      <Info className="w-4 h-4" />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[#F9FAFB] leading-snug">{toast.title}</p>
                  {toast.message && (
                    <p className="text-xs text-[#9CA3AF] mt-0.5 leading-relaxed">{toast.message}</p>
                  )}
                </div>

                {/* Dismiss button */}
                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  className="shrink-0 p-1 rounded-lg text-[#9CA3AF] hover:text-[#F9FAFB] hover:bg-white/10 transition-colors cursor-pointer"
                  aria-label="Đóng thông báo"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

export function setPendingToast(toast: Omit<ToastItem, "id">) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem("rubbyfilm_pending_toast", JSON.stringify(toast));
  } catch {}
}
