"use client";

import * as React from "react";
import { LogOut, X } from "lucide-react";
import { useAuth } from "@/lib/auth/authContext";

export function LogoutConfirmModal() {
  const { isLogoutConfirmOpen, closeLogoutConfirm, confirmLogout } = useAuth();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Close on Escape key
  React.useEffect(() => {
    if (!isLogoutConfirmOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeLogoutConfirm();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLogoutConfirmOpen, closeLogoutConfirm]);

  if (!isLogoutConfirmOpen) return null;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await confirmLogout();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="fixed inset-0 cursor-pointer"
        onClick={closeLogoutConfirm}
      />

      {/* Modal Dialog Card */}
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-[#141414] border border-[#282828] p-6 sm:p-7 shadow-2xl shadow-black/80 flex flex-col items-center text-center">
        {/* Close Button */}
        <button
          type="button"
          onClick={closeLogoutConfirm}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-[#888] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="Đóng"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Warning Icon Badge */}
        <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-500 mb-4 shadow-lg shadow-red-500/10">
          <LogOut className="w-6 h-6 stroke-[2.2]" />
        </div>

        {/* Title & Description */}
        <h3 className="text-lg font-bold text-white mb-2 tracking-tight">
          Xác Nhận Đăng Xuất
        </h3>
        <p className="text-xs text-[#9CA3AF] leading-relaxed mb-6">
          Bạn có chắc chắn muốn đăng xuất khỏi tài khoản RubyFilm không?
        </p>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 w-full">
          <button
            type="button"
            onClick={closeLogoutConfirm}
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-[#D1D5DB] hover:text-white bg-[#1F1F1F] hover:bg-[#282828] border border-[#333] transition-colors cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-[#E50000] hover:bg-[#FF1A1A] transition-all shadow-md shadow-[#E50000]/30 cursor-pointer flex items-center justify-center gap-1.5 active:scale-[0.98]"
          >
            {isSubmitting ? (
              <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            ) : (
              <span>Đăng xuất</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
