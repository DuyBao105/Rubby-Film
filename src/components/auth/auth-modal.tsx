"use client";

import * as React from "react";
import Link from "next/link";
import {
  X,
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  AlertCircle,
  LogIn,
  UserPlus,
  Check,
  CheckCircle2,
  XCircle,
  Sparkles,
  ShieldCheck,
  ArrowLeft,
  KeyRound,
} from "lucide-react";
import { useAuth } from "@/lib/auth/authContext";
import { SocialAuthButtons } from "./social-auth-buttons";

export function AuthModal() {
  const {
    isAuthModalOpen,
    authModalMode,
    closeAuthModal,
    setAuthModalMode,
    login,
    register,
  } = useAuth();

  // Login form states
  const [loginEmail, setLoginEmail] = React.useState("");
  const [loginPassword, setLoginPassword] = React.useState("");
  const [rememberMe, setRememberMe] = React.useState(true);
  const [showLoginPassword, setShowLoginPassword] = React.useState(false);
  const [loginError, setLoginError] = React.useState("");
  const [loginFieldErrors, setLoginFieldErrors] = React.useState<{ email?: string; password?: string }>({});
  const [isLoginSubmitting, setIsLoginSubmitting] = React.useState(false);

  // Register form states
  const [regName, setRegName] = React.useState("");
  const [regEmail, setRegEmail] = React.useState("");
  const [regPassword, setRegPassword] = React.useState("");
  const [regConfirmPassword, setRegConfirmPassword] = React.useState("");
  const [agreeTerms, setAgreeTerms] = React.useState(true);
  const [showRegPassword, setShowRegPassword] = React.useState(false);
  const [regError, setRegError] = React.useState("");
  const [regFieldErrors, setRegFieldErrors] = React.useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    agreeTerms?: string;
  }>({});
  const [isRegSubmitting, setIsRegSubmitting] = React.useState(false);

  // Forgot password modal states
  const [forgotStep, setForgotStep] = React.useState<"email" | "reset" | "success">("email");
  const [forgotEmail, setForgotEmail] = React.useState("");
  const [forgotAccountName, setForgotAccountName] = React.useState("");
  const [forgotPassword, setForgotPassword] = React.useState("");
  const [forgotConfirmPassword, setForgotConfirmPassword] = React.useState("");
  const [showForgotPassword, setShowForgotPassword] = React.useState(false);
  const [showForgotConfirmPassword, setShowForgotConfirmPassword] = React.useState(false);
  const [forgotError, setForgotError] = React.useState("");
  const [isForgotSubmitting, setIsForgotSubmitting] = React.useState(false);

  // Catch OAuth redirect errors and display in modal
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const url = new URL(window.location.href);
      const oauthError = url.searchParams.get("error");
      const provider = url.searchParams.get("provider");
      const providerName =
        provider === "google" ? "Google" : provider === "facebook" ? "Facebook" : "Mạng xã hội";

      if (oauthError) {
        let msg = `Đăng nhập qua ${providerName} thất bại.`;
        if (oauthError === "OAUTH_NOT_CONFIGURED") {
          msg = `Tính năng đăng nhập qua ${providerName} chưa được cấu hình Client ID / Secret trên máy chủ.`;
        } else if (oauthError === "OAUTH_CANCELLED") {
          msg = `Bạn đã hủy quá trình đăng nhập qua ${providerName}.`;
        } else if (oauthError === "OAUTH_STATE_MISMATCH") {
          msg = "Phiên xác thực bảo mật không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.";
        } else if (oauthError === "OAUTH_EXCHANGE_ERROR" || oauthError === "OAUTH_FAILED") {
          msg = `Không thể kết nối và trao đổi xác thực với ${providerName}. Vui lòng thử lại.`;
        }
        setLoginError(msg);
        setRegError(msg);
      }
    } catch {}
  }, [isAuthModalOpen]);

  const handleVerifyForgotEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError("");
    const clean = forgotEmail.trim();
    if (!clean) {
      setForgotError("Vui lòng nhập địa chỉ email của bạn.");
      return;
    }
    setIsForgotSubmitting(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: clean }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setForgotError(data?.error?.message || "Không tìm thấy tài khoản với email này.");
        return;
      }
      setForgotAccountName(data.data?.name || "Bạn");
      setForgotStep("reset");
    } catch {
      setForgotError("Không thể kết nối đến máy chủ.");
    } finally {
      setIsForgotSubmitting(false);
    }
  };

  const handleResetForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError("");
    if (!forgotPassword || forgotPassword.length < 6) {
      setForgotError("Mật khẩu mới phải có tối thiểu 6 ký tự.");
      return;
    }
    if (forgotPassword !== forgotConfirmPassword) {
      setForgotError("Mật khẩu xác nhận không khớp.");
      return;
    }
    setIsForgotSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail.trim(), password: forgotPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setForgotError(data?.error?.message || "Đặt lại mật khẩu thất bại.");
        return;
      }
      setLoginEmail(forgotEmail.trim());
      setForgotStep("success");
    } catch {
      setForgotError("Không thể kết nối đến máy chủ.");
    } finally {
      setIsForgotSubmitting(false);
    }
  };

  // Close on Escape key
  React.useEffect(() => {
    if (!isAuthModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeAuthModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAuthModalOpen, closeAuthModal]);

  // Lock background scroll when modal is open
  React.useEffect(() => {
    if (isAuthModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isAuthModalOpen]);

  // Pre-fill remembered email
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("rubbyfilm_remember_email");
      if (saved) {
        setLoginEmail(saved);
      }
    }
  }, []);

  // Password strength calculation
  const passwordStrength = React.useMemo(() => {
    if (!regPassword) return { level: 0, text: "", color: "bg-zinc-700", textColor: "text-zinc-400" };
    let score = 0;
    if (regPassword.length >= 6) score += 1;
    if (regPassword.length >= 8) score += 1;
    if (/[A-Z]/.test(regPassword) || /[0-9]/.test(regPassword)) score += 1;
    if (/[^A-Za-z0-9]/.test(regPassword)) score += 1;

    if (regPassword.length < 6) {
      return { level: 1, text: "Tối thiểu 6 ký tự", color: "bg-red-500", textColor: "text-red-400" };
    }
    if (score <= 2) {
      return { level: 1, text: "Yếu", color: "bg-amber-500", textColor: "text-amber-400" };
    }
    if (score === 3) {
      return { level: 2, text: "Trung bình", color: "bg-amber-400", textColor: "text-amber-300" };
    }
    return { level: 3, text: "Mạnh", color: "bg-emerald-500", textColor: "text-emerald-400" };
  }, [regPassword]);

  // Live password matching check
  const isPasswordMatch = React.useMemo(() => {
    if (!regConfirmPassword) return null;
    return regPassword === regConfirmPassword;
  }, [regPassword, regConfirmPassword]);

  if (!isAuthModalOpen) return null;

  // Handlers
  const handleFillDemo = () => {
    setLoginEmail("demo@rubyfilm.vn");
    setLoginPassword("Demo@123456");
    setLoginError("");
    setLoginFieldErrors({});
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    const errors: { email?: string; password?: string } = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!loginEmail.trim()) {
      errors.email = "Vui lòng nhập email.";
    } else if (!emailRegex.test(loginEmail.trim())) {
      errors.email = "Email không đúng định dạng.";
    }

    if (!loginPassword) {
      errors.password = "Vui lòng nhập mật khẩu.";
    }

    setLoginFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsLoginSubmitting(true);
    const res = await login({ email: loginEmail.trim(), password: loginPassword });
    setIsLoginSubmitting(false);

    if (res.success) {
      if (typeof window !== "undefined" && rememberMe) {
        localStorage.setItem("rubbyfilm_remember_email", loginEmail.trim());
      }
      closeAuthModal();
    } else {
      setLoginError(res.error || "Email hoặc mật khẩu không chính xác.");
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError("");
    const errors: {
      name?: string;
      email?: string;
      password?: string;
      confirmPassword?: string;
      agreeTerms?: string;
    } = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!regName.trim()) {
      errors.name = "Vui lòng nhập họ và tên.";
    }

    if (!regEmail.trim()) {
      errors.email = "Vui lòng nhập địa chỉ email.";
    } else if (!emailRegex.test(regEmail.trim())) {
      errors.email = "Email không đúng định dạng.";
    }

    if (regPassword.length < 6) {
      errors.password = "Mật khẩu phải từ 6 ký tự.";
    }

    if (regPassword !== regConfirmPassword) {
      errors.confirmPassword = "Mật khẩu xác nhận không khớp.";
    }

    if (!agreeTerms) {
      errors.agreeTerms = "Bạn cần đồng ý với Điều khoản dịch vụ.";
    }

    setRegFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsRegSubmitting(true);
    const res = await register({
      name: regName.trim(),
      email: regEmail.trim(),
      password: regPassword,
    });
    setIsRegSubmitting(false);

    if (res.success) {
      closeAuthModal();
    } else {
      setRegError(res.error || "Đăng ký không thành công. Vui lòng thử lại.");
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cửa sổ Đăng nhập / Đăng ký"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          closeAuthModal();
        }
      }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
    >
      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-[430px] bg-[#121212]/98 border border-white/[0.12] rounded-3xl p-6 sm:p-8 shadow-[0_25px_70px_rgba(0,0,0,0.95)] overflow-hidden my-auto animate-in zoom-in-95 duration-200">
        {/* Subtle Crimson Top Edge Glow */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#E50000] to-transparent opacity-90" />

        {/* Ambient Red Glow in Background */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-32 bg-[#E50000]/12 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          type="button"
          onClick={closeAuthModal}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.14] border border-white/10 text-[#9CA3AF] hover:text-white flex items-center justify-center transition-all cursor-pointer z-10"
          aria-label="Đóng cửa sổ"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Brand Logo Centered */}
        <div className="text-center mb-5 select-none pt-1">
          <div className="inline-flex items-baseline">
            <span suppressHydrationWarning className="font-black text-2xl tracking-[-0.03em] text-[#F9FAFB]">
              RUBY
            </span>
            <span suppressHydrationWarning className="font-extrabold text-xs tracking-widest text-[#E50000] ml-1.5 uppercase">
              FILM
            </span>
          </div>
        </div>

        {/* Segmented Switcher */}
        {authModalMode === "forgot" ? (
          <div className="flex items-center justify-between p-1 bg-[#1A1A1A] rounded-2xl mb-5 border border-white/[0.06] px-3.5 py-2">
            <button
              type="button"
              onClick={() => setAuthModalMode("login")}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#FECF59] hover:underline cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Quay lại Đăng Nhập</span>
            </button>
            <span className="text-xs font-bold text-white/80">Khôi phục mật khẩu</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 p-1 bg-[#1A1A1A] rounded-2xl mb-5 border border-white/[0.06]">
            <button
              type="button"
              onClick={() => setAuthModalMode("login")}
              className={`py-2 text-center text-xs font-bold rounded-xl transition-all cursor-pointer ${
                authModalMode === "login"
                  ? "bg-[#E50000] text-white shadow-md shadow-[#E50000]/30"
                  : "text-[#9CA3AF] hover:text-[#F9FAFB] hover:bg-white/[0.04]"
              }`}
            >
              Đăng Nhập
            </button>
            <button
              type="button"
              onClick={() => setAuthModalMode("register")}
              className={`py-2 text-center text-xs font-bold rounded-xl transition-all cursor-pointer ${
                authModalMode === "register"
                  ? "bg-[#E50000] text-white shadow-md shadow-[#E50000]/30"
                  : "text-[#9CA3AF] hover:text-[#F9FAFB] hover:bg-white/[0.04]"
              }`}
            >
              Đăng Ký
            </button>
          </div>
        )}

        {/* MODE: LOGIN */}
        {authModalMode === "login" ? (
          <div>
            <div className="mb-5 text-center">
              <h2 className="text-xl sm:text-2xl font-black text-[#F9FAFB] tracking-tight">
                Chào mừng trở lại
              </h2>
              <p className="text-xs text-[#9CA3AF] mt-1 leading-relaxed">
                Đăng nhập ngay để cày tiếp phim hay và lưu giữ những tác phẩm bạn yêu thích.
              </p>
            </div>

            {/* Error Message */}
            {loginError && (
              <div
                role="alert"
                className="mb-4 p-3 rounded-xl bg-[#E50000]/15 border border-[#E50000]/30 flex items-start gap-2 text-[#FFA3A3] text-xs animate-in fade-in"
              >
                <AlertCircle className="w-4 h-4 text-[#E50000] shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleLoginSubmit} noValidate className="space-y-3.5">
              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-[#D1D5DB] mb-1">
                  Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#71717A]">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => {
                      setLoginEmail(e.target.value);
                      if (loginFieldErrors.email) {
                        setLoginFieldErrors((prev) => ({ ...prev, email: undefined }));
                      }
                    }}
                    placeholder="name@example.com"
                    autoComplete="email"
                    required
                    className={`w-full pl-10 pr-4 py-2.5 bg-[#181818] border rounded-xl text-[#F9FAFB] placeholder-[#52525B] text-sm outline-none transition-all ${
                      loginFieldErrors.email
                        ? "border-[#E50000] focus:ring-1 focus:ring-[#E50000]"
                        : "border-white/[0.08] hover:border-white/[0.16] focus:border-[#E50000] focus:ring-1 focus:ring-[#E50000]"
                    }`}
                  />
                </div>
                {loginFieldErrors.email && (
                  <p className="mt-1 text-xs text-[#FF6B6B]">{loginFieldErrors.email}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-[#D1D5DB]">
                    Mật khẩu
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotError("");
                      setForgotStep("email");
                      setForgotEmail(loginEmail || "");
                      setAuthModalMode("forgot");
                    }}
                    className="text-xs text-[#FECF59] hover:underline font-medium cursor-pointer"
                  >
                    Quên mật khẩu?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#71717A]">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showLoginPassword ? "text" : "password"}
                    value={loginPassword}
                    onChange={(e) => {
                      setLoginPassword(e.target.value);
                      if (loginFieldErrors.password) {
                        setLoginFieldErrors((prev) => ({ ...prev, password: undefined }));
                      }
                    }}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    className={`w-full pl-10 pr-10 py-2.5 bg-[#181818] border rounded-xl text-[#F9FAFB] placeholder-[#52525B] text-sm outline-none transition-all ${loginFieldErrors.password
                      ? "border-[#E50000] focus:ring-1 focus:ring-[#E50000]"
                      : "border-white/[0.08] hover:border-white/[0.16] focus:border-[#E50000] focus:ring-1 focus:ring-[#E50000]"
                      }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#71717A] hover:text-[#F9FAFB] cursor-pointer"
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {loginFieldErrors.password && (
                  <p className="mt-1 text-xs text-[#FF6B6B]">{loginFieldErrors.password}</p>
                )}
              </div>

              {/* Remember Me */}
              <div className="flex items-center pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer select-none group">
                  <div className="relative flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="sr-only"
                    />
                    <div
                      className={`w-4 h-4 rounded border transition-colors flex items-center justify-center ${rememberMe
                        ? "bg-[#E50000] border-[#E50000] text-white"
                        : "border-white/20 bg-[#181818] group-hover:border-white/40"
                        }`}
                    >
                      {rememberMe && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </div>
                  <span className="text-xs text-[#9CA3AF] group-hover:text-[#D1D5DB] transition-colors">
                    Ghi nhớ đăng nhập
                  </span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoginSubmitting}
                className="w-full py-3 rounded-xl font-extrabold text-sm text-white bg-[#E50000] hover:bg-[#FF1A1A] shadow-lg shadow-[#E50000]/25 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoginSubmitting ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    <span>Đang đăng nhập...</span>
                  </div>
                ) : (
                  <>
                    <LogIn className="w-4 h-4 stroke-[2.5]" />
                    <span>Đăng Nhập</span>
                  </>
                )}
              </button>
            </form>


            {/* Social Logins */}
            <SocialAuthButtons disabled={isLoginSubmitting} dividerText="HOẶC TIẾP TỤC VỚI" />

            {/* Switch Footer */}
            <div className="mt-4 text-center text-xs text-[#9CA3AF]">
              Chưa có tài khoản?{" "}
              <button
                type="button"
                onClick={() => setAuthModalMode("register")}
                className="font-bold text-[#F9FAFB] hover:text-[#FECF59] hover:underline cursor-pointer"
              >
                Đăng ký ngay
              </button>
            </div>
          </div>
        ) : authModalMode === "register" ? (
          /* MODE: REGISTER */
          <div>
            <div className="mb-5 text-center">
              <h2 className="text-xl sm:text-2xl font-black text-[#F9FAFB] tracking-tight">
                Gia nhập hội mọt phim!
              </h2>
              <p className="text-xs text-[#9CA3AF] mt-1 leading-relaxed">
                Chỉ mất 1 phút tạo tài khoản, có ngay rạp chiếu phim xịn sò thu nhỏ trong túi của bạn.
              </p>
            </div>

            {/* Error Message */}
            {regError && (
              <div
                role="alert"
                className="mb-4 p-3 rounded-xl bg-[#E50000]/15 border border-[#E50000]/30 flex items-start gap-2 text-[#FFA3A3] text-xs animate-in fade-in"
              >
                <AlertCircle className="w-4 h-4 text-[#E50000] shrink-0 mt-0.5" />
                <span>{regError}</span>
              </div>
            )}

            <form onSubmit={handleRegisterSubmit} noValidate className="space-y-3">
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-[#D1D5DB] mb-1">
                  Họ và tên
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#71717A]">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={regName}
                    onChange={(e) => {
                      setRegName(e.target.value);
                      if (regFieldErrors.name) setRegFieldErrors((prev) => ({ ...prev, name: undefined }));
                    }}
                    placeholder="Nguyễn Văn A"
                    autoComplete="name"
                    required
                    className={`w-full pl-10 pr-4 py-2 bg-[#181818] border rounded-xl text-[#F9FAFB] placeholder-[#52525B] text-sm outline-none transition-all ${regFieldErrors.name
                      ? "border-[#E50000] focus:ring-1 focus:ring-[#E50000]"
                      : "border-white/[0.08] hover:border-white/[0.16] focus:border-[#E50000] focus:ring-1 focus:ring-[#E50000]"
                      }`}
                  />
                </div>
                {regFieldErrors.name && (
                  <p className="mt-1 text-xs text-[#FF6B6B]">{regFieldErrors.name}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-[#D1D5DB] mb-1">
                  Địa chỉ Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#71717A]">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => {
                      setRegEmail(e.target.value);
                      if (regFieldErrors.email) setRegFieldErrors((prev) => ({ ...prev, email: undefined }));
                    }}
                    placeholder="name@example.com"
                    autoComplete="email"
                    required
                    className={`w-full pl-10 pr-4 py-2 bg-[#181818] border rounded-xl text-[#F9FAFB] placeholder-[#52525B] text-sm outline-none transition-all ${regFieldErrors.email
                      ? "border-[#E50000] focus:ring-1 focus:ring-[#E50000]"
                      : "border-white/[0.08] hover:border-white/[0.16] focus:border-[#E50000] focus:ring-1 focus:ring-[#E50000]"
                      }`}
                  />
                </div>
                {regFieldErrors.email && (
                  <p className="mt-1 text-xs text-[#FF6B6B]">{regFieldErrors.email}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-[#D1D5DB] mb-1">
                  Mật khẩu
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#71717A]">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showRegPassword ? "text" : "password"}
                    value={regPassword}
                    onChange={(e) => {
                      setRegPassword(e.target.value);
                      if (regFieldErrors.password) {
                        setRegFieldErrors((prev) => ({ ...prev, password: undefined }));
                      }
                    }}
                    placeholder="Tối thiểu 6 ký tự"
                    autoComplete="new-password"
                    required
                    className={`w-full pl-10 pr-10 py-2 bg-[#181818] border rounded-xl text-[#F9FAFB] placeholder-[#52525B] text-sm outline-none transition-all ${regFieldErrors.password
                      ? "border-[#E50000] focus:ring-1 focus:ring-[#E50000]"
                      : "border-white/[0.08] hover:border-white/[0.16] focus:border-[#E50000] focus:ring-1 focus:ring-[#E50000]"
                      }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#71717A] hover:text-[#F9FAFB] cursor-pointer"
                  >
                    {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {regFieldErrors.password && (
                  <p className="mt-1 text-xs text-[#FF6B6B]">{regFieldErrors.password}</p>
                )}

                {/* Password Strength */}
                {regPassword && (
                  <div className="mt-1.5 space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-[#71717A]">Độ mạnh:</span>
                      <span className={`font-semibold ${passwordStrength.textColor}`}>
                        {passwordStrength.text}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 h-1 rounded-full overflow-hidden bg-[#262626]">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${passwordStrength.level >= 1 ? passwordStrength.color : "bg-transparent"
                          }`}
                      />
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${passwordStrength.level >= 2 ? passwordStrength.color : "bg-transparent"
                          }`}
                      />
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${passwordStrength.level >= 3 ? passwordStrength.color : "bg-transparent"
                          }`}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-[#D1D5DB]">
                    Xác nhận mật khẩu
                  </label>
                  {isPasswordMatch !== null && (
                    <span
                      className={`text-[10px] font-semibold flex items-center gap-1 ${isPasswordMatch ? "text-emerald-400" : "text-[#FF6B6B]"
                        }`}
                    >
                      {isPasswordMatch ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Khớp</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3" />
                          <span>Chưa khớp</span>
                        </>
                      )}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#71717A]">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showRegPassword ? "text" : "password"}
                    value={regConfirmPassword}
                    onChange={(e) => {
                      setRegConfirmPassword(e.target.value);
                      if (regFieldErrors.confirmPassword) {
                        setRegFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                      }
                    }}
                    placeholder="Nhập lại mật khẩu"
                    autoComplete="new-password"
                    required
                    className={`w-full pl-10 pr-4 py-2 bg-[#181818] border rounded-xl text-[#F9FAFB] placeholder-[#52525B] text-sm outline-none transition-all ${regFieldErrors.confirmPassword || (isPasswordMatch === false && regConfirmPassword.length > 0)
                      ? "border-[#E50000] focus:ring-1 focus:ring-[#E50000]"
                      : isPasswordMatch
                        ? "border-emerald-500/50 focus:ring-1 focus:ring-emerald-500"
                        : "border-white/[0.08] hover:border-white/[0.16] focus:border-[#E50000] focus:ring-1 focus:ring-[#E50000]"
                      }`}
                  />
                </div>
                {regFieldErrors.confirmPassword && (
                  <p className="mt-1 text-xs text-[#FF6B6B]">{regFieldErrors.confirmPassword}</p>
                )}
              </div>

              {/* Agree Terms */}
              <div className="pt-0.5">
                <label className="flex items-start gap-2 cursor-pointer select-none group">
                  <div className="relative flex items-center justify-center mt-0.5">
                    <input
                      type="checkbox"
                      checked={agreeTerms}
                      onChange={(e) => {
                        setAgreeTerms(e.target.checked);
                        if (regFieldErrors.agreeTerms) {
                          setRegFieldErrors((prev) => ({ ...prev, agreeTerms: undefined }));
                        }
                      }}
                      className="sr-only"
                    />
                    <div
                      className={`w-4 h-4 rounded border transition-colors flex items-center justify-center shrink-0 ${agreeTerms
                        ? "bg-[#E50000] border-[#E50000] text-white"
                        : "border-white/20 bg-[#181818] group-hover:border-white/40"
                        }`}
                    >
                      {agreeTerms && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </div>
                  <span className="text-[11px] text-[#9CA3AF] leading-tight group-hover:text-[#D1D5DB] transition-colors">
                    Đồng ý với{" "}
                    <span className="text-[#FECF59] font-medium">Điều khoản</span> và{" "}
                    <span className="text-[#FECF59] font-medium">Chính sách riêng tư</span>.
                  </span>
                </label>
                {regFieldErrors.agreeTerms && (
                  <p className="mt-1 text-xs text-[#FF6B6B]">{regFieldErrors.agreeTerms}</p>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isRegSubmitting}
                className="w-full py-3 rounded-xl font-extrabold text-sm text-white bg-[#E50000] hover:bg-[#FF1A1A] shadow-lg shadow-[#E50000]/25 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-1"
              >
                {isRegSubmitting ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    <span>Đang tạo tài khoản...</span>
                  </div>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 stroke-[2.5]" />
                    <span>Tạo Tài Khoản</span>
                  </>
                )}
              </button>
            </form>

            {/* Social Logins */}
            <div className="mt-4">
              <SocialAuthButtons disabled={isRegSubmitting} dividerText="HOẶC ĐĂNG KÝ VỚI" />
            </div>

            {/* Switch Footer */}
            <div className="mt-5 text-center text-xs text-[#9CA3AF]">
              Đã có tài khoản?{" "}
              <button
                type="button"
                onClick={() => setAuthModalMode("login")}
                className="font-bold text-[#F9FAFB] hover:text-[#FECF59] hover:underline cursor-pointer"
              >
                Đăng nhập ngay
              </button>
            </div>
          </div>
        ) : (
          /* MODE: FORGOT PASSWORD */
          <div>
            <div className="mb-5 text-center">
              <h2 className="text-xl sm:text-2xl font-black text-[#F9FAFB] tracking-tight">
                {forgotStep === "email"
                  ? "Khôi phục mật khẩu"
                  : forgotStep === "reset"
                  ? "Đặt mật khẩu mới"
                  : "Cập nhật thành công!"}
              </h2>
              <p className="text-xs text-[#9CA3AF] mt-1 leading-relaxed">
                {forgotStep === "email"
                  ? "Nhập email tài khoản để đặt lại mật khẩu mới ngay lập tức."
                  : forgotStep === "reset"
                  ? `Xin chào ${forgotAccountName}, hãy nhập mật khẩu mới an toàn cho tài khoản.`
                  : "Mật khẩu của bạn đã được cập nhật thành công."}
              </p>
            </div>

            {forgotError && (
              <div
                role="alert"
                className="mb-4 p-3 rounded-xl bg-[#E50000]/15 border border-[#E50000]/30 flex items-start gap-2 text-[#FFA3A3] text-xs animate-in fade-in"
              >
                <AlertCircle className="w-4 h-4 text-[#E50000] shrink-0 mt-0.5" />
                <span>{forgotError}</span>
              </div>
            )}

            {/* Step 1: Verify Email */}
            {forgotStep === "email" && (
              <form onSubmit={handleVerifyForgotEmail} noValidate className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[#D1D5DB] mb-1">
                    Email tài khoản
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#71717A]">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => {
                        setForgotEmail(e.target.value);
                        if (forgotError) setForgotError("");
                      }}
                      placeholder="name@example.com"
                      autoComplete="email"
                      required
                      autoFocus
                      className="w-full pl-10 pr-4 py-2.5 bg-[#181818] border border-white/[0.08] hover:border-white/[0.16] focus:border-[#E50000] focus:ring-1 focus:ring-[#E50000] rounded-xl text-[#F9FAFB] placeholder-[#52525B] text-sm outline-none transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isForgotSubmitting}
                  className="w-full py-3 rounded-xl font-black text-xs sm:text-sm text-white bg-gradient-to-r from-[#E50000] to-[#B30000] hover:from-red-600 hover:to-red-800 shadow-lg shadow-[#E50000]/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                >
                  {isForgotSubmitting ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      <span>Đang kiểm tra tài khoản...</span>
                    </div>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      <span>Tiếp Tục Đặt Lại Mật Khẩu</span>
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Step 2: Set New Password */}
            {forgotStep === "reset" && (
              <form onSubmit={handleResetForgotSubmit} noValidate className="space-y-3.5">
                <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Tài khoản:</span>
                  <span className="font-bold text-white truncate max-w-[200px]">{forgotEmail}</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#D1D5DB] mb-1">
                    Mật khẩu mới
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#71717A]">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showForgotPassword ? "text" : "password"}
                      value={forgotPassword}
                      onChange={(e) => {
                        setForgotPassword(e.target.value);
                        if (forgotError) setForgotError("");
                      }}
                      placeholder="Tối thiểu 6 ký tự"
                      required
                      autoFocus
                      className="w-full pl-10 pr-10 py-2.5 bg-[#181818] border border-white/[0.08] hover:border-white/[0.16] focus:border-[#E50000] focus:ring-1 focus:ring-[#E50000] rounded-xl text-[#F9FAFB] placeholder-[#52525B] text-sm outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(!showForgotPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#71717A] hover:text-white transition-colors cursor-pointer"
                    >
                      {showForgotPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#D1D5DB] mb-1">
                    Xác nhận mật khẩu mới
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#71717A]">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <input
                      type={showForgotConfirmPassword ? "text" : "password"}
                      value={forgotConfirmPassword}
                      onChange={(e) => {
                        setForgotConfirmPassword(e.target.value);
                        if (forgotError) setForgotError("");
                      }}
                      placeholder="Nhập lại mật khẩu mới"
                      required
                      className="w-full pl-10 pr-10 py-2.5 bg-[#181818] border border-white/[0.08] hover:border-white/[0.16] focus:border-[#E50000] focus:ring-1 focus:ring-[#E50000] rounded-xl text-[#F9FAFB] placeholder-[#52525B] text-sm outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowForgotConfirmPassword(!showForgotConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#71717A] hover:text-white transition-colors cursor-pointer"
                    >
                      {showForgotConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isForgotSubmitting}
                  className="w-full py-3 rounded-xl font-black text-xs sm:text-sm text-white bg-gradient-to-r from-[#E50000] to-[#B30000] hover:from-red-600 hover:to-red-800 shadow-lg shadow-[#E50000]/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                >
                  {isForgotSubmitting ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      <span>Đang lưu mật khẩu...</span>
                    </div>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      <span>Lưu & Đổi Mật Khẩu</span>
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Step 3: Success */}
            {forgotStep === "success" && (
              <div className="py-3 text-center space-y-4 animate-in fade-in">
                <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Mật khẩu đã đổi thành công!</h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Bây giờ bạn có thể đăng nhập ngay với mật khẩu mới.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAuthModalMode("login");
                    setForgotStep("email");
                  }}
                  className="w-full py-3 rounded-xl font-black text-xs sm:text-sm text-white bg-gradient-to-r from-[#E50000] to-[#B30000] hover:from-red-600 hover:to-red-800 shadow-lg shadow-[#E50000]/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Đăng Nhập Ngay Bằng Mật Khẩu Mới</span>
                  <LogIn className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Footer */}
            <div className="mt-5 text-center text-xs text-[#9CA3AF]">
              <button
                type="button"
                onClick={() => setAuthModalMode("login")}
                className="font-bold text-[#F9FAFB] hover:text-[#FECF59] hover:underline cursor-pointer inline-flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Quay lại trang Đăng nhập</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
