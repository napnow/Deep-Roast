"use client";

/**
 * App Router template：每次路由切换会 remount，
 * 配合 .page-shell 入场动画，让 login / 主站 / admin 跳转更丝滑。
 */
export default function Template({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="page-shell h-full">{children}</div>;
}
