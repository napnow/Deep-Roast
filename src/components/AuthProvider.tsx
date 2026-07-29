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
import { softNavigate } from "@/lib/nav-transition";

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
      <span
        className="inline-flex h-11 w-11 items-center justify-center rounded-xl font-display text-lg font-semibold"
        style={{
          background:
            "linear-gradient(145deg, var(--accent-soft), var(--accent))",
          color: "var(--accent-on)",
          boxShadow: "var(--shadow-md)",
        }}
        aria-hidden
      >
        焙
      </span>
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
  const router = useRouter();
  const pathname = usePathname();

  const refresh = useCallback(async () => {
    const u = await getAuth();
    setUser(u);
    setLoading(false);
    return u;
  }, []);

  // 只在挂载时检查一次登录态
  useEffect(() => {
    let cancelled = false;
    getAuth().then((u) => {
      if (cancelled) return;
      setUser(u);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
    await logout();
    setUser(null);
    softNavigate(router, "/login", "replace");
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
