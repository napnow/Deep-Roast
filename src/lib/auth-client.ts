"use client";

export interface AuthUser {
  id: string;
  username: string;
  role: string;
}

export async function getAuth(): Promise<AuthUser | null> {
  try {
    const res = await fetch("/api/auth/me");
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function login(
  username: string,
  password: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error || "登录失败" };
    return { success: true };
  } catch {
    return { success: false, error: "网络错误" };
  }
}

export async function register(
  username: string,
  password: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error || "注册失败" };
    return { success: true };
  } catch {
    return { success: false, error: "网络错误" };
  }
}

export async function logout(): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {
    // ignore
  }
}
