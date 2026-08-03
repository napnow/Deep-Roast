import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // 关键：middleware 运行在 Edge Runtime，构建时不会自动注入非
  // NEXT_PUBLIC_ 环境变量，导致 jwtVerify 拿不到 JWT_SECRET 而全部 401
  // （"登录已过期"）。此处显式注入，使 edge bundle 与 Node route 用同一密钥。
  env: {
    JWT_SECRET: process.env.JWT_SECRET || "",
  },
  // 允许局域网 IP 访问 dev 资源（否则手机通过 http://192.168.x.x:3000
  // 访问时，dev 的 HMR/chunk 会被当作跨域请求拦截，导致 React 无法挂载、
  // 按钮点击全部失效）
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "127.0.0.1"],
  // 隐藏 dev 模式右下角的 Next.js 悬浮球
  devIndicators: false,
};

export default nextConfig;
