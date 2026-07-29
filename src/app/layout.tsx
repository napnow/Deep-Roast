import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import { ToastProvider } from "@/components/Toast";
import AuthProvider from "@/components/AuthProvider";
import "./globals.css";

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
});

const body = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "深焙 — 文生文 · 文生图",
  description: "深焙 — 深度思考，慢焙出好答案",
};

const themeScript = `
  (() => {
    const t = localStorage.getItem('theme');
    if (t === 'dark' || (!t && matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else if (!t) {
      /* 无偏好时默认深色：更贴合「深焙工坊」 */
      document.documentElement.classList.add('dark');
    }
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className={`${display.variable} ${body.variable} h-full antialiased`}
      >
        <ToastProvider>
          <AuthProvider>
            <div className="dr-app h-full">{children}</div>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
