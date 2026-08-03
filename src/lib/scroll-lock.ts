"use client";

/** 全局共享的滚动锁状态：多个输入组件可能同时聚焦，用计数防止提前解锁 */
let lockCount = 0;

/** 锁定页面滚动（键盘弹出/自动 scrollIntoView 时防止整页上顶） */
export function lockPageScroll() {
  lockCount += 1;
  if (lockCount > 1) return; // 已锁
  const de = document.documentElement;
  const b = document.body;
  de.style.overflow = "hidden";
  b.style.overflow = "hidden";
  b.style.position = "fixed";
  b.style.left = "0";
  b.style.top = "0";
  b.style.right = "0";
  b.style.width = "100%";
}

/** 解锁页面滚动（引用计数归零才真正解锁） */
export function unlockPageScroll() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount > 0) return; // 还有其他输入聚焦中
  const de = document.documentElement;
  const b = document.body;
  de.style.overflow = "";
  b.style.overflow = "";
  b.style.position = "";
  b.style.left = "";
  b.style.top = "";
  b.style.right = "";
  b.style.width = "";
}
