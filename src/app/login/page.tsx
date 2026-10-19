"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  LogIn,
  Check,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/lib/hooks/use-auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { SocialAuthButtons } from "@/components/auth/social-auth-buttons";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/profile";

  const { login, isAuthenticated, isLoading: isAuthLoading } = useAuth();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [rememberMe, setRememberMe] = React.useState(true);
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<{ email?: string; password?: string }>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Catch OAuth redirect errors and display clear Vietnamese messages
  React.useEffect(() => {
    const oauthError = searchParams.get("error");
    const provider = searchParams.get("provider");
    const providerName =
      provider === "google" ? "Google" : provider === "facebook" ? "Facebook" : "Mạng xã hội";

    if (oauthError === "OAUTH_NOT_CONFIGURED") {
      setError(
        `Tính năng đăng nhập qua ${providerName} chưa được cấu hình Client ID / Secret trên môi trường máy chủ.`
      );
    } else if (oauthError === "OAUTH_CANCELLED") {
      setError(`Bạn đã hủy quá trình đăng nhập qua ${providerName}.`);
    } else if (oauthError === "OAUTH_STATE_MISMATCH") {
      setError("Phiên xác thực bảo mật không hợp lệ (State mismatch). Vui lòng thử lại.");
    } else if (oauthError === "OAUTH_EXCHANGE_ERROR" || oauthError === "OAUTH_FAILED") {
      setError(`Không thể kết nối và xác thực tài khoản ${providerName}. Vui lòng thử lại sau.`);
    } else if (oauthError === "SERVER_ERROR") {
      setError("Máy chủ hoặc cơ sở dữ liệu tạm thời bận. Vui lòng thử lại sau.");
    }
  }, [searchParams]);

  // Automatically redirect to homepage and open login modal popup
  React.useEffect(() => {
    if (!isAuthLoading) {
      if (isAuthenticated) {
        router.replace(callbackUrl);
      } else {
        const err = searchParams.get("error");
        const prov = searchParams.get("provider");
        if (err) {
          router.replace(
            `/?auth=login&error=${encodeURIComponent(err)}${prov ? `&provider=${encodeURIComponent(prov)}` : ""}`
          );
        } else {
          router.replace("/?auth=login");
        }
      }
    }
  }, [isAuthenticated, isAuthLoading, router, callbackUrl, searchParams]);

  const validateForm = () => {
    const errors: { email?: string; password?: string } = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email.trim()) {
      errors.email = "Vui lòng nhập địa chỉ email.";
    } else if (!emailRegex.test(email.trim())) {
      errors.email = "Địa chỉ email không đúng định dạng.";
    }

    if (!password) {
      errors.password = "Vui lòng nhập mật khẩu.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    const res = await login({ email: email.trim(), password });
    setIsSubmitting(false);

    if (res.success) {
      if (typeof window !== "undefined" && rememberMe) {
        localStorage.setItem("rubbyfilm_remember_email", email.trim());
      }
      router.push(callbackUrl);
    } else {
      setError(res.error || "Email hoặc mật khẩu không chính xác. Vui lòng thử lại.");
    }
  };

  // Pre-fill remembered email if available
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const savedEmail = localStorage.getItem("rubbyfilm_remember_email");
      if (savedEmail) {
        setEmail(savedEmail);
      }
    }
  }, []);

  const handleFillDemo = () => {
    setEmail("demo@rubyfilm.vn");
    setPassword("Demo@123456");
    setError("");
    setFieldErrors({});
  };

  return (
    <AuthShell
      title="Đăng Nhập"
      subtitle="Nhập email và mật khẩu của bạn để tiếp tục thưởng thức."
    >
      {/* Top Error Alert */}
      {error && (
        <div
          role="alert"
          className="mb-4 p-3 rounded-xl bg-[#E50000]/15 border border-[#E50000]/30 flex items-start gap-2.5 text-[#FFA3A3] text-xs animate-in fade-in duration-200"
        >
          <AlertCircle className="w-4 h-4 text-[#E50000] shrink-0 mt-0.5" />
          <span className="font-medium leading-relaxed">{error}</span>
        </div>
      )}

      {/* Main Email & Password Form */}
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Email Field */}
        <div>
          <label
            htmlFor="login-email"
            className="block text-xs font-semibold text-[#D1D5DB] mb-1.5"
          >
            Email
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#71717A]">
              <Mail className="w-4 h-4" />
            </div>
            <input
              id="login-email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
              }}
              placeholder="name@example.com"
              autoComplete="email"
              required
              aria-invalid={Boolean(fieldErrors.email)}
              className={`w-full pl-10 pr-4 py-3 bg-[#181818] border rounded-xl text-[#F9FAFB] placeholder-[#52525B] text-sm transition-all outline-none ${
                fieldErrors.email
                  ? "border-[#E50000] focus:ring-1 focus:ring-[#E50000]"
                  : "border-white/[0.08] hover:border-white/[0.16] focus:border-[#E50000] focus:ring-1 focus:ring-[#E50000]"
              }`}
            />
          </div>
          {fieldErrors.email && (
            <p className="mt-1 text-xs text-[#FF6B6B] animate-in fade-in">
              {fieldErrors.email}
            </p>
          )}
        </div>

        {/* Password Field */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="login-password"
              className="block text-xs font-semibold text-[#D1D5DB]"
            >
              Mật khẩu
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-[#FECF59] hover:underline font-medium transition-colors"
            >
              Quên mật khẩu?
            </Link>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#71717A]">
              <Lock className="w-4 h-4" />
            </div>
            <input
              id="login-password"
              name="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
              }}
              placeholder="••••••••"
              autoComplete="current-password"
              required
              aria-invalid={Boolean(fieldErrors.password)}
              className={`w-full pl-10 pr-11 py-3 bg-[#181818] border rounded-xl text-[#F9FAFB] placeholder-[#52525B] text-sm transition-all outline-none ${
                fieldErrors.password
                  ? "border-[#E50000] focus:ring-1 focus:ring-[#E50000]"
                  : "border-white/[0.08] hover:border-white/[0.16] focus:border-[#E50000] focus:ring-1 focus:ring-[#E50000]"
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#71717A] hover:text-[#F9FAFB] transition-colors cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {fieldErrors.password && (
            <p className="mt-1 text-xs text-[#FF6B6B] animate-in fade-in">
              {fieldErrors.password}
            </p>
          )}
        </div>

        {/* Remember Me Checkbox */}
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
                className={`w-4 h-4 rounded border transition-colors flex items-center justify-center ${
                  rememberMe
                    ? "bg-[#E50000] border-[#E50000] text-white"
                    : "border-white/20 bg-[#181818] group-hover:border-white/40"
                }`}
              >
                {rememberMe && <Check className="w-3 h-3 stroke-[3]" />}
              </div>
            </div>
            <span className="text-xs text-[#9CA3AF] group-hover:text-[#D1D5DB] transition-colors">
              Ghi nhớ tài khoản trên thiết bị này
            </span>
          </label>
        </div>

        {/* Primary Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3.5 rounded-xl font-extrabold text-sm text-white bg-[#E50000] hover:bg-[#FF1A1A] shadow-lg shadow-[#E50000]/25 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 select-none cursor-pointer mt-2 disabled:opacity-50 disabled:pointer-events-none"
        >
          {isSubmitting ? (
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

      {/* Quick Demo VIP Pill */}
      <div className="mt-4 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between text-xs text-[#9CA3AF]">
        <span className="flex items-center gap-1.5 truncate">
          <Sparkles className="w-3.5 h-3.5 text-[#FECF59] shrink-0" />
          <span>Tài khoản VIP: <strong className="text-[#D1D5DB] font-mono">demo@rubyfilm.vn</strong></span>
        </span>
        <button
          type="button"
          onClick={handleFillDemo}
          className="text-[#FECF59] font-bold hover:underline shrink-0 ml-2 cursor-pointer"
        >
          Điền nhanh
        </button>
      </div>

      {/* Social OAuth Sign-In (Google & Facebook) */}
      <SocialAuthButtons callbackUrl={callbackUrl} disabled={isSubmitting} dividerText="HOẶC ĐĂNG NHẬP VỚI" />

      {/* Switch to Register */}
      <div className="mt-5 text-center text-xs text-[#9CA3AF]">
        Bạn chưa có tài khoản?{" "}
        <Link
          href={`/register${callbackUrl !== "/profile" ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`}
          className="font-bold text-[#F9FAFB] hover:text-[#FECF59] hover:underline ml-1"
        >
          Đăng ký ngay
        </Link>
      </div>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-[#E50000] border-t-transparent animate-spin" />
        </div>
      }
    >
      <LoginForm />
    </React.Suspense>
  );
}
