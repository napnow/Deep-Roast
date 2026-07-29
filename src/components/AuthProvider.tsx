"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getAuth, logout } from "@/lib/auth-client";
import type { AuthUser } from "@/lib/auth-client";

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
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
  const checkedRef = useRef(false);

  // 只在挂载时检查一次登录态，避免 pathname 变化反复 setLoading 导致白屏/闪烁
  useEffect(() => {
    let cancelled = false;

    getAuth().then((u) => {
      if (cancelled) return;
      setUser(u);
      setLoading(false);
      checkedRef.current = true;
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // 根据登录态做跳转（与鉴权请求解耦，避免循环刷新）
  useEffect(() => {
    if (loading) return;

    if (!user && pathname !== "/login") {
      router.replace("/login");
    } else if (user && pathname === "/login") {
      router.replace("/");
    }
  }, [loading, user, pathname, router]);

  async function handleLogout() {
    await logout();
    setUser(null);
    router.replace("/login");
  }

  // 登录页：始终渲染表单，已登录时由上面的 effect 跳转
  if (pathname === "/login") {
    return (
      <AuthContext.Provider value={{ user, loading, logout: handleLogout }}>
        {children}
      </AuthContext.Provider>
    );
  }

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--bg-root)", color: "var(--text-muted)" }}
      >
        <p className="text-sm animate-pulse">加载中...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--bg-root)", color: "var(--text-muted)" }}
      >
        <p className="text-sm">跳转中...</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading: false, logout: handleLogout }}>
      {children}
    </AuthContext.Provider>
  );
}
