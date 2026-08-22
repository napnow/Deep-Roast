"use client";

import type { AnimationEvent } from "react";

/**
 * App Router template：每次路由切换会 remount，
 * 配合 .page-shell 入场动画，让 login / 主站 / admin 跳转更丝滑。
 */
export default function Template({
  children,
}: {
  children: React.ReactNode;
}) {
  const onPageEnterEnd = (e: AnimationEvent<HTMLDivElement>) => {
    if (e.animationName !== "page-enter") return;
    // 动画结束后移除 animation：fill-mode 会保留终帧的 transform/filter
    // （即使 to 帧未声明），残留的 filter/transform 会成为 fixed 子元素
    // 的包含块，导致开屏动画等 fixed 定位元素错乱（如偏移一屏高度）。
    e.currentTarget.style.animation = "none";
  };

  return (
    <div className="page-shell h-full" onAnimationEnd={onPageEnterEnd}>
      {children}
    </div>
  );
}
