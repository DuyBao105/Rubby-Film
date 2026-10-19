"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  UserPlus,
  Check,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/lib/hooks/use-auth";
import { AuthShell } from "@/components/auth/auth-shell";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/profile";

  const { register, isAuthenticated, isLoading: isAuthLoading } = useAuth();

  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [agreeTerms, setAgreeTerms] = React.useState(true);
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    agreeTerms?: string;
  }>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Catch OAuth redirect errors and display clear Vietnamese messages
  React.useEffect(() => {
    const oauthError = searchParams.get("error");
    const provider = searchParams.get("provider");
    const providerName =
      provider === "google" ? "Google" : provider === "facebook" ? "Facebook" : "Mạng xã hội";

    if (oauthError === "OAUTH_NOT_CONFIGURED") {
      setError(
        `Tính năng đăng ký qua ${providerName} chưa được cấu hình Client ID / Secret trên máy chủ.`
      );
    } else if (oauthError === "OAUTH_CANCELLED") {
      setError(`Bạn đã hủy quá trình đăng ký qua ${providerName}.`);
    } else if (oauthError === "OAUTH_STATE_MISMATCH") {
      setError("Phiên xác thực bảo mật không hợp lệ (State mismatch). Vui lòng thử lại.");
    } else if (oauthError === "OAUTH_EXCHANGE_ERROR" || oauthError === "OAUTH_FAILED") {
      setError(`Không thể kết nối và xác thực tài khoản ${providerName}. Vui lòng thử lại sau.`);
    } else if (oauthError === "SERVER_ERROR") {
      setError("Máy chủ hoặc cơ sở dữ liệu tạm thời bận. Vui lòng thử lại sau.");
    }
  }, [searchParams]);

  // Automatically redirect to homepage and open register modal popup
  React.useEffect(() => {
    if (!isAuthLoading) {
      if (isAuthenticated) {
        router.replace(callbackUrl);
      } else {
        const err = searchParams.get("error");
        const prov = searchParams.get("provider");
        if (err) {
          router.replace(
            `/?auth=register&error=${encodeURIComponent(err)}${prov ? `&provider=${encodeURIComponent(prov)}` : ""}`
          );
        } else {
          router.replace("/?auth=register");
        }
      }
    }
  }, [isAuthenticated, isAuthLoading, router, callbackUrl, searchParams]);

  // Password strength calculation
  const passwordStrength = React.useMemo(() => {
    if (!password) return { level: 0, text: "", color: "bg-zinc-700", textColor: "text-zinc-400" };
    let score = 0;
    if (password.length >= 6) score += 1;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password) || /[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    if (password.length < 6) {
      return { level: 1, text: "Tối thiểu 6 ký tự", color: "bg-red-500", textColor: "text-red-400" };
    }
    if (score <= 2) {
      return { level: 1, text: "Yếu", color: "bg-amber-500", textColor: "text-amber-400" };
    }
    if (score === 3) {
      return { level: 2, text: "Trung bình", color: "bg-amber-400", textColor: "text-amber-300" };
    }
    return { level: 3, text: "Mạnh", color: "bg-emerald-500", textColor: "text-emerald-400" };
  }, [password]);

  // Realtime password match status
  const isPasswordMatch = React.useMemo(() => {
    if (!confirmPassword) return null;
    return password === confirmPassword;
  }, [password, confirmPassword]);

  const validateForm = () => {
    const errors: {
      name?: string;
      email?: string;
      password?: string;
      confirmPassword?: string;
      agreeTerms?: string;
    } = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!name.trim()) {
      errors.name = "Vui lòng nhập họ và tên của bạn.";
    }

    if (!email.trim()) {
      errors.email = "Vui lòng nhập địa chỉ email.";
    } else if (!emailRegex.test(email.trim())) {
      errors.email = "Địa chỉ email không đúng định dạng.";
    }

    if (password.length < 6) {
      errors.password = "Mật khẩu phải chứa ít nhất 6 ký tự.";
    }

    if (password !== confirmPassword) {
      errors.confirmPassword = "Mật khẩu xác nhận không khớp.";
    }

    if (!agreeTerms) {
      errors.agreeTerms = "Bạn cần đồng ý với Điều khoản dịch vụ để tiếp tục.";
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
    const res = await register({
      name: name.trim(),
      email: email.trim(),
      password,
    });
    setIsSubmitting(false);

    if (res.success) {
      router.push(callbackUrl);
    } else {
      setError(res.error || "Đăng ký không thành công. Vui lòng thử lại.");
    }
  };

  return (
    <AuthShell
      title="Tạo Tài Khoản"
      subtitle="Đăng ký miễn phí để lưu phim yêu thích và đồng bộ trên mọi thiết bị."
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

      {/* Main Registration Form */}
      <form onSubmit={handleSubmit} noValidate className="space-y-3.5">
        {/* Full Name Field */}
        <div>
          <label
            htmlFor="register-name"
            className="block text-xs font-semibold text-[#D1D5DB] mb-1.5"
          >
            Họ và tên
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#71717A]">
              <User className="w-4 h-4" />
            </div>
            <input
              id="register-name"
              name="name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: undefined }));
              }}
              placeholder="Nguyễn Văn A"
              autoComplete="name"
              required
              aria-invalid={Boolean(fieldErrors.name)}
              className={`w-full pl-10 pr-4 py-2.5 sm:py-3 bg-[#181818] border rounded-xl text-[#F9FAFB] placeholder-[#52525B] text-sm transition-all outline-none ${
                fieldErrors.name
                  ? "border-[#E50000] focus:ring-1 focus:ring-[#E50000]"
                  : "border-white/[0.08] hover:border-white/[0.16] focus:border-[#E50000] focus:ring-1 focus:ring-[#E50000]"
              }`}
            />
          </div>
          {fieldErrors.name && (
            <p className="mt-1 text-xs text-[#FF6B6B] animate-in fade-in">
              {fieldErrors.name}
            </p>
          )}
        </div>

        {/* Email Field */}
        <div>
          <label
            htmlFor="register-email"
            className="block text-xs font-semibold text-[#D1D5DB] mb-1.5"
          >
            Địa chỉ Email
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#71717A]">
              <Mail className="w-4 h-4" />
            </div>
            <input
              id="register-email"
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
              className={`w-full pl-10 pr-4 py-2.5 sm:py-3 bg-[#181818] border rounded-xl text-[#F9FAFB] placeholder-[#52525B] text-sm transition-all outline-none ${
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
          <label
            htmlFor="register-password"
            className="block text-xs font-semibold text-[#D1D5DB] mb-1.5"
          >
            Mật khẩu
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#71717A]">
              <Lock className="w-4 h-4" />
            </div>
            <input
              id="register-password"
              name="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
              }}
              placeholder="Tối thiểu 6 ký tự"
              autoComplete="new-password"
              required
              aria-invalid={Boolean(fieldErrors.password)}
              className={`w-full pl-10 pr-11 py-2.5 sm:py-3 bg-[#181818] border rounded-xl text-[#F9FAFB] placeholder-[#52525B] text-sm transition-all outline-none ${
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

          {/* Password Strength Indicator */}
          {password && (
            <div className="mt-1.5 space-y-1 animate-in fade-in duration-200">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#71717A]">Độ mạnh:</span>
                <span className={`font-semibold ${passwordStrength.textColor}`}>
                  {passwordStrength.text}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 h-1 rounded-full overflow-hidden bg-[#262626]">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    passwordStrength.level >= 1 ? passwordStrength.color : "bg-transparent"
                  }`}
                />
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    passwordStrength.level >= 2 ? passwordStrength.color : "bg-transparent"
                  }`}
                />
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    passwordStrength.level >= 3 ? passwordStrength.color : "bg-transparent"
                  }`}
                />
              </div>
            </div>
          )}
        </div>

        {/* Confirm Password Field */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="register-confirm-password"
              className="block text-xs font-semibold text-[#D1D5DB]"
            >
              Xác nhận mật khẩu
            </label>
            {isPasswordMatch !== null && (
              <span
                className={`text-[11px] font-semibold flex items-center gap-1 ${
                  isPasswordMatch ? "text-emerald-400" : "text-[#FF6B6B]"
                }`}
              >
                {isPasswordMatch ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Khớp</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-3.5 h-3.5" />
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
              id="register-confirm-password"
              name="confirmPassword"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (fieldErrors.confirmPassword) {
                  setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                }
              }}
              placeholder="Nhập lại mật khẩu"
              autoComplete="new-password"
              required
              aria-invalid={Boolean(fieldErrors.confirmPassword)}
              className={`w-full pl-10 pr-4 py-2.5 sm:py-3 bg-[#181818] border rounded-xl text-[#F9FAFB] placeholder-[#52525B] text-sm transition-all outline-none ${
                fieldErrors.confirmPassword || (isPasswordMatch === false && confirmPassword.length > 0)
                  ? "border-[#E50000] focus:ring-1 focus:ring-[#E50000]"
                  : isPasswordMatch
                  ? "border-emerald-500/50 focus:ring-1 focus:ring-emerald-500"
                  : "border-white/[0.08] hover:border-white/[0.16] focus:border-[#E50000] focus:ring-1 focus:ring-[#E50000]"
              }`}
            />
          </div>
          {fieldErrors.confirmPassword && (
            <p className="mt-1 text-xs text-[#FF6B6B] animate-in fade-in">
              {fieldErrors.confirmPassword}
            </p>
          )}
        </div>

        {/* Terms of Service Checkbox */}
        <div className="pt-0.5">
          <label className="flex items-start gap-2.5 cursor-pointer select-none group">
            <div className="relative flex items-center justify-center mt-0.5">
              <input
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => {
                  setAgreeTerms(e.target.checked);
                  if (fieldErrors.agreeTerms) {
                    setFieldErrors((prev) => ({ ...prev, agreeTerms: undefined }));
                  }
                }}
                className="sr-only"
              />
              <div
                className={`w-4 h-4 rounded border transition-colors flex items-center justify-center shrink-0 ${
                  agreeTerms
                    ? "bg-[#E50000] border-[#E50000] text-white"
                    : "border-white/20 bg-[#181818] group-hover:border-white/40"
                }`}
              >
                {agreeTerms && <Check className="w-3 h-3 stroke-[3]" />}
              </div>
            </div>
            <span className="text-xs text-[#9CA3AF] leading-snug group-hover:text-[#D1D5DB] transition-colors">
              Tôi đồng ý với{" "}
              <span className="text-[#FECF59] font-medium hover:underline">Điều khoản dịch vụ</span>{" "}
              và{" "}
              <span className="text-[#FECF59] font-medium hover:underline">Chính sách riêng tư</span>.
            </span>
          </label>
          {fieldErrors.agreeTerms && (
            <p className="mt-1 text-xs text-[#FF6B6B] animate-in fade-in">
              {fieldErrors.agreeTerms}
            </p>
          )}
        </div>

        {/* Primary Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3.5 rounded-xl font-extrabold text-sm text-white bg-[#E50000] hover:bg-[#FF1A1A] shadow-lg shadow-[#E50000]/25 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 select-none cursor-pointer mt-3 disabled:opacity-50 disabled:pointer-events-none"
        >
          {isSubmitting ? (
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

      {/* Switch to Login */}
      <div className="mt-6 text-center text-xs text-[#9CA3AF]">
        Đã có tài khoản?{" "}
        <Link
          href={`/login${callbackUrl !== "/profile" ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`}
          className="font-bold text-[#F9FAFB] hover:text-[#FECF59] hover:underline ml-1"
        >
          Đăng nhập ngay
        </Link>
      </div>
    </AuthShell>
  );
}

export default function RegisterPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-[#E50000] border-t-transparent animate-spin" />
        </div>
      }
    >
      <RegisterForm />
    </React.Suspense>
  );
}
