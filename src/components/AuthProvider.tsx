"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { getAuth, logout } from "@/lib/auth-client";
import type { AuthUser } from "@/lib/auth-client";
import { isLocalMobilePreview } from "@/lib/local-preview";
import { softNavigate } from "@/lib/nav-transition";
import { useDeepRoastStore } from "@/lib/store";
import { createClientSessionLifecycle } from "@/lib/client-session-lifecycle";

const LOCAL_PREVIEW_USER: AuthUser = {
  id: "local-mobile-preview",
  username: "本地预览",
  role: "admin",
};

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  logout: () => Promise<void>;
  /** 重新拉取 /api/auth/me（登录成功后用，避免整页刷新） */
  refresh: () => Promise<AuthUser | null>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => {},
  refresh: async () => null,
});

export function useAuth() {
  return useContext(AuthContext);
}

function AuthBootScreen({ label }: { label: string }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-4 animate-fade-in"
      style={{ background: "var(--bg-root)", color: "var(--text-muted)" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand-mark.png"
        alt=""
        width={44}
        height={44}
        draggable={false}
        className="h-11 w-11 rounded-xl object-cover"
        style={{
          boxShadow: "0 0 0 1px var(--border-strong), var(--shadow-md)",
        }}
      />
      <p className="text-xs tracking-[0.14em] uppercase">{label}</p>
    </div>
  );
}

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  // Auth determines user identity, so sequence these requests independently of it.
  const [authRequests] = useState(() => createClientSessionLifecycle(() => 0));
  const router = useRouter();
  const pathname = usePathname();
  const localPreview =
    typeof window !== "undefined" &&
    isLocalMobilePreview(window.location.search, process.env.NODE_ENV);

  const publishUser = useCallback((next: AuthUser | null) => {
    // Invalidate private work and clear the store before exposing the new user.
    const store = useDeepRoastStore.getState();
    store.setUserSession(next?.id ?? null);
    if (next) {
      if (typeof next.credits === "number") {
        store.setCredits(next.credits);
      }
      if (next.checkin) {
        store.setCheckinStatus({
          eligible: !!next.checkin.eligible,
          todayChecked: !!next.checkin.todayChecked,
          reward: next.checkin.reward,
        });
      }
    }
    setUser(next);
    setLoading(false);
  }, []);

  const refresh = useCallback(async () => {
    const request = authRequests.start("auth");
    if (!request) return null;
    try {
      const next = localPreview ? LOCAL_PREVIEW_USER : await getAuth();
      if (!request.isCurrent()) return null;
      publishUser(next);
      return next;
    } finally {
      request.finish();
    }
  }, [authRequests, localPreview, publishUser]);

  useEffect(() => {
    authRequests.activate();
    void refresh();
    return () => authRequests.dispose();
  }, [authRequests, refresh]);

  // 根据登录态做跳转（带过渡）
  useEffect(() => {
    if (loading) return;

    if (!user && pathname !== "/login") {
      softNavigate(router, "/login", "replace");
    } else if (user && pathname === "/login") {
      softNavigate(router, "/", "replace");
    }
  }, [loading, user, pathname, router]);

  async function handleLogout() {
    if (localPreview) return;
    const request = authRequests.start("auth");
    if (!request) return;
    publishUser(null);
    // Clear private state immediately, but do not expose login until logout settles.
    setLoading(true);
    try {
      await logout();
      if (request.isCurrent()) softNavigate(router, "/login", "replace");
    } finally {
      if (request.isCurrent()) setLoading(false);
      request.finish();
    }
  }

  const value: AuthContextType = {
    user,
    loading,
    logout: handleLogout,
    refresh,
  };

  // 登录页：始终渲染表单，已登录时由上面的 effect 跳转
  if (pathname === "/login") {
    return (
      <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
  }

  if (loading) {
    return (
      <AuthContext.Provider value={value}>
        <AuthBootScreen label="加载中" />
      </AuthContext.Provider>
    );
  }

  if (!user) {
    return (
      <AuthContext.Provider value={value}>
        <AuthBootScreen label="前往登录" />
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={{ ...value, loading: false }}>
      {children}
    </AuthContext.Provider>
  );
}
