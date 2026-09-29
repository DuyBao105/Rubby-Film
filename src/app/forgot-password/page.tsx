"use client";

import * as React from "react";
import Link from "next/link";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";

export default function ForgotPasswordPage() {
  const [step, setStep] = React.useState<"email" | "reset" | "success">("email");
  const [email, setEmail] = React.useState("");
  const [accountName, setAccountName] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");

  // Step 1: Verify Email
  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const cleanEmail = email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail) {
      setError("Vui lòng nhập địa chỉ email của bạn.");
      return;
    }

    if (!emailRegex.test(cleanEmail)) {
      setError("Địa chỉ email không đúng định dạng. Vui lòng kiểm tra lại.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data?.error?.message || "Không tìm thấy tài khoản với email này.");
        return;
      }

      setAccountName(data.data?.name || "Bạn");
      setStep("reset");
    } catch (err: any) {
      setError("Không thể kết nối đến máy chủ. Vui lòng thử lại sau.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 2: Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!password) {
      setError("Vui lòng nhập mật khẩu mới.");
      return;
    }

    if (password.length < 6) {
      setError("Mật khẩu mới phải có tối thiểu 6 ký tự.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp. Vui lòng kiểm tra lại.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data?.error?.message || "Đặt lại mật khẩu thất bại. Vui lòng thử lại.");
        return;
      }

      try {
        localStorage.setItem("rubbyfilm_remember_email", email.trim());
      } catch {}

      setStep("success");
    } catch (err: any) {
      setError("Không thể kết nối đến máy chủ. Vui lòng thử lại sau.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      title={
        step === "email"
          ? "Khôi Phục Mật Khẩu"
          : step === "reset"
          ? "Thiết Lập Mật Khẩu Mới"
          : "Cập Nhật Thành Công!"
      }
      subtitle={
        step === "email"
          ? "Nhập email đăng ký tài khoản để bắt đầu đặt lại mật khẩu mới."
          : step === "reset"
          ? `Xin chào ${accountName}, hãy nhập mật khẩu mới an toàn cho tài khoản.`
          : "Mật khẩu của bạn đã được đặt lại thành công."
      }
      badge="Bảo Mật Tài Khoản"
    >
      {/* Error Banner */}
      {error && (
        <div
          role="alert"
          className="mb-4 p-3.5 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-start gap-2.5 text-red-300 text-xs sm:text-sm animate-in fade-in duration-200"
        >
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* STEP 1: VERIFY EMAIL */}
      {step === "email" && (
        <form onSubmit={handleVerifyEmail} noValidate className="space-y-4">
          <div>
            <label
              htmlFor="forgot-email"
              className="block text-xs font-bold text-zinc-300 mb-1.5 uppercase tracking-wider"
            >
              Địa Chỉ Email Tài Khoản
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                id="forgot-email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError("");
                }}
                placeholder="name@example.com"
                autoComplete="email"
                required
                className="w-full pl-10 pr-4 py-3 bg-cinema-950/80 border border-white/10 hover:border-white/20 focus:border-[#E50000] focus:ring-2 focus:ring-[#E50000]/25 rounded-xl text-white placeholder-zinc-500 text-sm transition-all shadow-inner outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 rounded-xl font-black text-sm text-white bg-gradient-to-r from-[#E50000] via-red-600 to-[#B30000] hover:from-red-500 hover:to-red-700 shadow-xl shadow-red-900/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 select-none cursor-pointer mt-2 disabled:opacity-50 disabled:pointer-events-none"
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                <span>Đang kiểm tra tài khoản...</span>
              </div>
            ) : (
              <>
                <KeyRound className="w-4 h-4 stroke-[2.5]" />
                <span>Tiếp Tục Đặt Lại Mật Khẩu</span>
              </>
            )}
          </button>

          <div className="mt-5 pt-4 border-t border-white/[0.08] text-center">
            <Link
              href="/?auth=login"
              className="text-xs text-zinc-300 hover:text-white inline-flex items-center gap-1.5 font-semibold transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Quay lại đăng nhập</span>
            </Link>
          </div>
        </form>
      )}

      {/* STEP 2: ENTER NEW PASSWORD */}
      {step === "reset" && (
        <form onSubmit={handleResetPassword} noValidate className="space-y-4">
          <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-between text-xs text-zinc-300">
            <span className="truncate max-w-[200px] text-zinc-400 font-medium">Tài khoản:</span>
            <span className="font-bold text-white truncate max-w-[180px]">{email}</span>
          </div>

          <div>
            <label
              htmlFor="new-password"
              className="block text-xs font-bold text-zinc-300 mb-1.5 uppercase tracking-wider"
            >
              Mật Khẩu Mới
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="new-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError("");
                }}
                placeholder="Tối thiểu 6 ký tự"
                required
                autoFocus
                className="w-full pl-10 pr-10 py-3 bg-cinema-950/80 border border-white/10 hover:border-white/20 focus:border-[#E50000] focus:ring-2 focus:ring-[#E50000]/25 rounded-xl text-white placeholder-zinc-500 text-sm transition-all shadow-inner outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-400 hover:text-white transition-colors cursor-pointer"
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="confirm-password"
              className="block text-xs font-bold text-zinc-300 mb-1.5 uppercase tracking-wider"
            >
              Xác Nhận Mật Khẩu Mới
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <input
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (error) setError("");
                }}
                placeholder="Nhập lại mật khẩu mới"
                required
                className="w-full pl-10 pr-10 py-3 bg-cinema-950/80 border border-white/10 hover:border-white/20 focus:border-[#E50000] focus:ring-2 focus:ring-[#E50000]/25 rounded-xl text-white placeholder-zinc-500 text-sm transition-all shadow-inner outline-none"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-400 hover:text-white transition-colors cursor-pointer"
                aria-label={showConfirmPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 rounded-xl font-black text-sm text-white bg-gradient-to-r from-[#E50000] via-red-600 to-[#B30000] hover:from-red-500 hover:to-red-700 shadow-xl shadow-red-900/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 select-none cursor-pointer mt-2 disabled:opacity-50 disabled:pointer-events-none"
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                <span>Đang cập nhật mật khẩu...</span>
              </div>
            ) : (
              <>
                <KeyRound className="w-4 h-4 stroke-[2.5]" />
                <span>Lưu & Đổi Mật Khẩu Mới</span>
              </>
            )}
          </button>

          <div className="mt-5 pt-4 border-t border-white/[0.08] flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => {
                setError("");
                setStep("email");
              }}
              className="text-zinc-400 hover:text-white inline-flex items-center gap-1.5 font-semibold transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Đổi email khác</span>
            </button>
            <Link
              href="/"
              className="text-zinc-400 hover:text-white font-semibold transition-colors"
            >
              Hủy bỏ
            </Link>
          </div>
        </form>
      )}

      {/* STEP 3: SUCCESS CONFIRMATION */}
      {step === "success" && (
        <div className="py-2 text-center space-y-4 animate-in fade-in duration-300">
          <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Đặt lại mật khẩu thành công!
            </h3>
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed max-w-sm mx-auto">
              Mật khẩu mới của bạn đã có hiệu lực ngay lập tức. Bây giờ bạn có thể đăng nhập vào RubyFilm với mật khẩu mới.
            </p>
            <div className="inline-block px-3 py-1.5 rounded-xl bg-white/[0.05] border border-white/10 text-xs sm:text-sm font-bold text-emerald-400">
              {email}
            </div>
          </div>

          {/* Action */}
          <div className="pt-4 border-t border-white/[0.08]">
            <Link
              href="/?auth=login"
              className="w-full py-3.5 rounded-xl font-black text-sm text-white bg-gradient-to-r from-[#E50000] to-[#B30000] hover:from-red-500 hover:to-red-700 shadow-xl shadow-red-900/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 select-none"
            >
              <span>Đăng Nhập Ngay</span>
              <ArrowLeft className="w-4 h-4 rotate-180" />
            </Link>
          </div>
        </div>
      )}
    </AuthShell>
  );
}
