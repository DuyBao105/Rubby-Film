"use client";

import * as React from "react";
import { AuthUser, LoginInput, RegisterInput } from "./authTypes";

import { watchHistoryService } from "@/lib/services/watchHistoryService";
import { myListService } from "@/lib/services/myListService";
import { searchHistoryService } from "@/lib/services/searchHistoryService";
import { userPreferenceService } from "@/lib/services/userPreferenceService";
import { useToast } from "@/components/ui/toast";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (input: LoginInput) => Promise<{ success: boolean; error?: string }>;
  register: (input: RegisterInput) => Promise<{ success: boolean; error?: string }>;
  unlinkProvider: (provider: "google" | "facebook" | "credentials") => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  updateProfile: (updates: { name?: string; avatarUrl?: string }) => Promise<{ success: boolean; error?: string }>;
  isAuthModalOpen: boolean;
  authModalMode: "login" | "register" | "forgot";
  openAuthModal: (mode?: "login" | "register" | "forgot") => void;
  closeAuthModal: () => void;
  setAuthModalMode: (mode: "login" | "register" | "forgot") => void;
  isLogoutConfirmOpen: boolean;
  openLogoutConfirm: () => void;
  closeLogoutConfirm: () => void;
  confirmLogout: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

function getUserFromHint(): AuthUser | null {
  if (typeof document === "undefined") return null;
  try {
    const match = document.cookie.match(new RegExp("(^|;\\s*)rubbyfilm_user_hint=([^;]+)"));
    if (match && match[2]) {
      const decodedStr = Buffer.from(match[2], "base64url").toString("utf-8");
      const decoded = JSON.parse(decodedStr);
      if (decoded && decoded.id && decoded.name) {
        return decoded as AuthUser;
      }
    }
  } catch {}
  return null;
}

/**
 * Trích xuất tên hiển thị tốt nhất từ thông tin tài khoản đã xác thực:
 * 1. Ưu tiên display name (user.name)
 * 2. Nếu không có, dùng username hoặc tên tài khoản từ email (phần trước @)
 * 3. Nếu không có hoặc ở chế độ khách, trả về chuỗi rỗng để dùng nội dung dự phòng
 */
export function getAuthDisplayName(
  candidate?: { name?: string | null; email?: string | null; username?: string | null } | null
): string {
  if (!candidate) return "";

  // 1. Display name
  const rawName = typeof candidate.name === "string" ? candidate.name.trim() : "";
  if (rawName && rawName.toLowerCase() !== "null" && rawName.toLowerCase() !== "undefined") {
    return rawName;
  }

  // 2. Username nếu có
  const rawUsername = typeof candidate.username === "string" ? candidate.username.trim() : "";
  if (rawUsername && rawUsername.toLowerCase() !== "null" && rawUsername.toLowerCase() !== "undefined") {
    return rawUsername;
  }

  // 3. Tên tài khoản từ email (trước @)
  const email = typeof candidate.email === "string" ? candidate.email.trim() : "";
  if (email && email.includes("@")) {
    const localPart = email.split("@")[0].trim();
    if (localPart && localPart.toLowerCase() !== "null" && localPart.toLowerCase() !== "undefined") {
      return localPart;
    }
  }

  return "";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const toast = useToast();
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = React.useState(false);
  const [authModalMode, setAuthModalMode] = React.useState<"login" | "register" | "forgot">("login");
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = React.useState(false);

  const openLogoutConfirm = React.useCallback(() => {
    setIsLogoutConfirmOpen(true);
  }, []);

  const closeLogoutConfirm = React.useCallback(() => {
    setIsLogoutConfirmOpen(false);
  }, []);
  const openAuthModal = React.useCallback((mode: "login" | "register" | "forgot" = "login") => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  }, []);

  const closeAuthModal = React.useCallback(() => {
    setIsAuthModalOpen(false);
  }, []);

  const fetchSession = React.useCallback(async () => {
    try {
      const headers: Record<string, string> = {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
      };
      try {
        const token = localStorage.getItem("rubbyfilm_token");
        if (token) headers["Authorization"] = `Bearer ${token}`;
      } catch {}

      const res = await fetch(`/api/auth/me?_t=${Date.now()}`, {
        cache: "no-store",
        credentials: "include",
        headers,
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.authenticated && json.data?.user) {
          setUser(json.data.user);
          try {
            localStorage.setItem("rubbyfilm_cached_user", JSON.stringify(json.data.user));
            if (json.data.token) {
              localStorage.setItem("rubbyfilm_token", json.data.token);
            }
          } catch {}
        } else {
          // Only clear user if no hint cookie is active
          const hint = getUserFromHint();
          if (!hint) {
            setUser(null);
            try {
              localStorage.removeItem("rubbyfilm_cached_user");
            } catch {}
          }
        }
      } else {
        const hint = getUserFromHint();
        if (!hint) {
          setUser(null);
          try {
            localStorage.removeItem("rubbyfilm_cached_user");
          } catch {}
        }
      }
    } catch (e) {
      console.warn("Failed to check auth session:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    // 1. Try reading client user hint cookie first for immediate flash-free display
    const hint = getUserFromHint();
    if (hint) {
      setUser(hint);
    } else {
      try {
        const cached = localStorage.getItem("rubbyfilm_cached_user");
        if (cached) {
          setUser(JSON.parse(cached));
        }
      } catch {}
    }
    fetchSession();
  }, [fetchSession]);

  // Listen for OAuth authentication success callback parameter and ?auth= trigger
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const url = new URL(window.location.href);

      const authMode = url.searchParams.get("auth");
      if (authMode === "login" || authMode === "register" || authMode === "forgot") {
        openAuthModal(authMode);
        url.searchParams.delete("auth");
        const cleanUrl = url.pathname + (url.search ? url.search : "") + url.hash;
        window.history.replaceState({}, "", cleanUrl);
      }

      const authSuccess = url.searchParams.get("auth_success");
      if (authSuccess) {
        // Read immediately from cookie hint if available
        const hint = getUserFromHint();
        if (hint) {
          setUser(hint);
          try {
            localStorage.setItem("rubbyfilm_cached_user", JSON.stringify(hint));
          } catch {}
        }

        fetchSession();
        const displayName = getAuthDisplayName(hint);
        const message = displayName
          ? `Xin chào, ${displayName}! Chào mừng bạn quay trở lại.`
          : "Chào mừng bạn quay trở lại RubyFilm.";
        toast.success("Đăng nhập thành công", message);
        url.searchParams.delete("auth_success");
        const cleanUrl = url.pathname + (url.search ? url.search : "") + url.hash;
        window.history.replaceState({}, "", cleanUrl);
      }

      const authError = url.searchParams.get("error");
      const errorProvider = url.searchParams.get("provider");
      if (authError) {
        const pName =
          errorProvider === "google"
            ? "Google"
            : errorProvider === "facebook"
            ? "Facebook"
            : "tài khoản";
        let msg = `Đăng nhập qua ${pName} không thành công.`;
        if (authError === "OAUTH_CANCELLED") {
          msg = `Bạn đã hủy yêu cầu đăng nhập qua ${pName}.`;
        } else if (authError === "OAUTH_NOT_CONFIGURED") {
          msg = `Tính năng đăng nhập qua ${pName} chưa được cấu hình API keys.`;
        } else if (authError === "OAUTH_STATE_MISMATCH") {
          msg = "Phiên xác thực bảo mật không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.";
        } else if (authError === "OAUTH_EXCHANGE_ERROR" || authError === "OAUTH_FAILED") {
          msg = `Không thể trao đổi xác thực với ${pName}. Vui lòng thử lại.`;
        } else if (authError === "SERVER_ERROR") {
          msg = "Máy chủ hoặc cơ sở dữ liệu tạm thời bận. Vui lòng thử lại sau.";
        }
        toast.error("Lỗi đăng nhập", msg);
        url.searchParams.delete("error");
        if (errorProvider) url.searchParams.delete("provider");
        const cleanUrl = url.pathname + (url.search ? url.search : "") + url.hash;
        window.history.replaceState({}, "", cleanUrl);
      }
    } catch {}
  }, [toast, openAuthModal, fetchSession]);

  const login = async (input: LoginInput) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        const errorMsg = json?.error?.message || "Email hoặc mật khẩu không chính xác.";
        toast.error("Đăng nhập thất bại", errorMsg);
        return {
          success: false,
          error: errorMsg,
        };
      }

      const userData = json.data?.user || json.data;
      setUser(userData);
      try {
        localStorage.setItem("rubbyfilm_cached_user", JSON.stringify(userData));
        if (json.data?.token) {
          localStorage.setItem("rubbyfilm_token", json.data.token);
        }
      } catch {}

      // Lấy tên từ thông tin tài khoản đã xác thực (ưu tiên display name > tên tài khoản)
      const displayName = getAuthDisplayName(userData);
      const message = displayName
        ? `Xin chào, ${displayName}! Chào mừng bạn quay trở lại.`
        : "Chào mừng bạn quay trở lại RubyFilm.";

      toast.success("Đăng nhập thành công", message);
      return { success: true };
    } catch (e: any) {
      const errorMsg = "Lỗi kết nối máy chủ. Vui lòng thử lại sau.";
      toast.error("Đăng nhập thất bại", errorMsg);
      return { success: false, error: errorMsg };
    }
  };

  const register = async (input: RegisterInput) => {
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        const errorMsg = json?.error?.message || "Đăng ký không thành công. Vui lòng thử lại.";
        toast.error("Đăng ký thất bại", errorMsg);
        return {
          success: false,
          error: errorMsg,
        };
      }

      const userData = json.data?.user || json.data;
      setUser(userData);
      try {
        localStorage.setItem("rubbyfilm_cached_user", JSON.stringify(userData));
        if (json.data?.token) {
          localStorage.setItem("rubbyfilm_token", json.data.token);
        }
      } catch {}

      const displayName = getAuthDisplayName(userData);
      const message = displayName
        ? `Xin chào, ${displayName}! Chào mừng bạn gia nhập RubyFilm.`
        : "Chào mừng bạn gia nhập RubyFilm.";

      toast.success("Đăng ký thành công", message);
      return { success: true };
    } catch (e: any) {
      const errorMsg = "Lỗi kết nối máy chủ. Vui lòng thử lại sau.";
      toast.error("Đăng ký thất bại", errorMsg);
      return { success: false, error: errorMsg };
    }
  };

  const unlinkProvider = async (provider: "google" | "facebook" | "credentials") => {
    try {
      const res = await fetch("/api/auth/providers/unlink", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        return {
          success: false,
          error: json?.error?.message || "Không thể hủy liên kết tài khoản.",
        };
      }
      if (json.data?.user) {
        setUser(json.data.user);
        try {
          localStorage.setItem("rubbyfilm_cached_user", JSON.stringify(json.data.user));
        } catch {}
      } else {
        await fetchSession();
      }
      toast.info("Hủy liên kết thành công", "Thông tin đăng nhập của bạn đã được cập nhật.");
      return { success: true };
    } catch (e: any) {
      return { success: false, error: "Lỗi kết nối máy chủ khi hủy liên kết." };
    }
  };

  // Keep watchHistoryService, myListService, searchHistoryService, and userPreferenceService strictly synchronized with active user
  React.useEffect(() => {
    const userId = user?.id ?? null;
    watchHistoryService.setUser(userId);
    myListService.setUser(userId);
    searchHistoryService.setUser(userId);
    userPreferenceService.setUser(userId);
  }, [user]);

  const logout = React.useCallback(async () => {
    setIsLogoutConfirmOpen(true);
  }, []);

  const confirmLogout = React.useCallback(async () => {
    setIsLogoutConfirmOpen(false);

    // 1. Lưu lại tên hiển thị của tài khoản hiện tại trong bộ nhớ tạm đủ để tạo thông báo trước khi xóa trạng thái tài khoản khỏi giao diện
    const currentUser = user || getUserFromHint();
    const isGuest = !currentUser;
    const displayName = isGuest ? "" : getAuthDisplayName(currentUser);

    // 2. Gọi API đăng xuất trên máy chủ
    let logoutSucceeded = false;
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        logoutSucceeded = true;
      }
    } catch (err) {
      console.warn("Logout request failed:", err);
    }

    // 3. Xử lý trường hợp đặc biệt: Đăng xuất thất bại
    if (!logoutSucceeded) {
      toast.error("Đăng xuất thất bại", "Máy chủ không thể hoàn tất thao tác đăng xuất. Vui lòng thử lại.");
      return;
    }

    // 4. Xóa trạng thái tài khoản khỏi giao diện và bộ nhớ client
    setUser(null);
    try {
      localStorage.removeItem("rubbyfilm_cached_user");
      localStorage.removeItem("rubbyfilm_token");
      localStorage.removeItem("rubbyfilm_user_profile");
      document.cookie = "rubbyfilm_user_hint=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    } catch {}

    // 5. Đưa các service độc lập về trạng thái khách (guest)
    watchHistoryService.setUser(null);
    myListService.setUser(null);
    searchHistoryService.setUser(null);
    userPreferenceService.setUser(null);

    // 6. Hiển thị thông báo đăng xuất thành công có tên người dùng
    const message = displayName
      ? `Tạm biệt ${displayName}! Hẹn gặp lại bạn.`
      : "Hẹn gặp lại bạn sớm tại RubyFilm!";

    toast.success("Đăng xuất thành công", message);
  }, [user, toast]);
  const updateProfile = React.useCallback(
    async (updates: { name?: string; avatarUrl?: string }) => {
      // 1. Instantly update local React state & cached user for immediate UI reflection
      setUser((prev) => {
        const base = prev || {
          id: "usr_active",
          name: updates.name || "Thành Viên RubyFilm",
          email: "user@rubyfilm.vn",
          role: "user" as const,
          providers: ["credentials" as const],
          createdAt: Date.now(),
        };
        const next = { ...base, ...updates };
        try {
          localStorage.setItem("rubbyfilm_cached_user", JSON.stringify(next));
        } catch {}
        return next;
      });

      // 2. Synchronize to isolated user preference service
      try {
        userPreferenceService.updateUser(updates);
      } catch {}

      // 3. Sync to server session if available
      try {
        const res = await fetch("/api/auth/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        const json = await res.json();
        if (res.ok && json.success && json.data?.user) {
          setUser(json.data.user);
          try {
            localStorage.setItem("rubbyfilm_cached_user", JSON.stringify(json.data.user));
          } catch {}
          return { success: true };
        }
      } catch (e: any) {
        console.warn("Could not sync profile to backend session:", e);
      }
      return { success: true };
    },
    []
  );

  const value: AuthContextValue = {
    user,
    isLoading,
    isAuthenticated: Boolean(user),
    login,
    register,
    unlinkProvider,
    logout,
    confirmLogout,
    isLogoutConfirmOpen,
    openLogoutConfirm,
    closeLogoutConfirm,
    refresh: fetchSession,
    updateProfile,
    isAuthModalOpen,
    authModalMode,
    openAuthModal,
    closeAuthModal,
    setAuthModalMode,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

const DEFAULT_AUTH_CONTEXT: AuthContextValue = {
  user: null,
  isLoading: false,
  isAuthenticated: false,
  login: async () => ({ success: false, error: "Not initialized" }),
  register: async () => ({ success: false, error: "Not initialized" }),
  unlinkProvider: async () => ({ success: false, error: "Not initialized" }),
  logout: async () => {},
  refresh: async () => {},
  updateProfile: async () => ({ success: false, error: "Not initialized" }),
  isAuthModalOpen: false,
  authModalMode: "login",
  openAuthModal: () => {},
  closeAuthModal: () => {},
  setAuthModalMode: () => {},
  isLogoutConfirmOpen: false,
  openLogoutConfirm: () => {},
  closeLogoutConfirm: () => {},
  confirmLogout: async () => {},
};

export function useAuth(): AuthContextValue {
  const context = React.useContext(AuthContext);
  return context || DEFAULT_AUTH_CONTEXT;
}
