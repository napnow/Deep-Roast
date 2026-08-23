import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    root: __dirname,
  },
  // 允许局域网 IP 访问 dev 资源（否则手机通过 http://192.168.x.x:3000
  // 访问时，dev 的 HMR/chunk 会被当作跨域请求拦截，导致 React 无法挂载、
  // 按钮点击全部失效）
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "127.0.0.1"],
  // 隐藏 dev 模式右下角的 Next.js 悬浮球
  devIndicators: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
