"use client";

/**
 * 登录页开屏动画（深焙版蓝图线稿，改编自 ljj-world HomeEntryIntro）
 * 在 ljj 蓝图结构的基础上加入深焙特色：
 *  - 蒸汽：mark 下方升起两缕「烘焙热气」
 *  - 焦糖填充：蓝图登录卡画完后被焦糖色「着色」（图纸烘焙定型）
 *  - 烘焙曲线：底部信号条换成深焙的烘焙温度曲线符号
 * 所有视觉动画由 CSS / SVG 时间轴驱动（与开屏同步，不依赖 JS 时序）。
 */

import { useCallback, useEffect, useRef } from "react";
import type { CSSProperties } from "react";

const VERTICAL_LINES = Array.from({ length: 49 }, (_, i) => i);
const HORIZONTAL_LINES = Array.from({ length: 28 }, (_, i) => i);

/** 落定瞬间散落的余烬粒子（dx/dy 相对 mark 中心，delay ms） */
const EMBERS: Array<{ dx: number; dy: number; delay: number }> = [
  { dx: -70, dy: -52, delay: 0 },
  { dx: 82, dy: -36, delay: 70 },
  { dx: -58, dy: 58, delay: 130 },
  { dx: 76, dy: 46, delay: 190 },
  { dx: 12, dy: -84, delay: 100 },
];

let hasPlayedIntro = false;

export default function LoginIntro({
  onReady,
  onSkipped,
}: {
  /** 开屏正常播放（挂载完成），页面以此时刻为基准编排后续入场动画 */
  onReady?: () => void;
  /** 开屏被跳过（reduced-motion / 会话内已播过），页面应让内容立即出现 */
  onSkipped?: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(false);
  const startedRef = useRef(false);

  // 所有视觉动画均由 CSS/SVG 时间轴驱动（与开屏同步，不依赖 JS 时序）。
  // 这个 timer 只负责在动画结束后隐藏透明层（清理 DOM，不影响视觉）。
  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    const el = rootRef.current;
    if (!el) return;
    el.classList.add("is-finished");
    window.setTimeout(() => {
      el.style.display = "none";
    }, 500);
  }, []);

  useEffect(() => {
    // StrictMode 会挂载→卸载→再挂载，effect 会被执行两次；
    // 用 ref 保证初始化逻辑只跑一次，避免定时器被 cleanup 清掉导致开屏卡死
    if (startedRef.current) return;
    startedRef.current = true;

    const reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || hasPlayedIntro) {
      hasPlayedIntro = true;
      // 跳过播放：直接隐藏（操作 DOM，不触发 React 重渲染）
      const el = rootRef.current;
      if (el) el.style.display = "none";
      onSkipped?.();
      return;
    }
    hasPlayedIntro = true;
    // 挂载即通知页面：标题/口号/按钮以此刻为基准编排动画，与开屏同步
    onReady?.();
    // 2.5s：开屏全部动画播完，瞬时隐藏，随后标题点燃登场
    window.setTimeout(finish, 2500);
    // 有意不清理定时器：StrictMode 的 cleanup 会把它们清掉；
    // 组件真实卸载后定时器回调访问 rootRef.current 为 null，无副作用。
    return () => {};
  }, [finish, onReady, onSkipped]);

  /** 线条延迟（ljj 同款错开节奏）：与 mark 同时开始，从左上向右下蔓延 */
  const lineStyle = (index: number, total: number, offset: number): CSSProperties => {
    void total;
    return {
      "--line-index": index,
      "--line-delay": `${360 + ((index * 7 + offset) % 13) * 18}ms`,
    } as CSSProperties;
  };

  return (
    <div ref={rootRef} className="login-intro" aria-hidden="true">
      <div className="login-intro-mark">
        <div className="login-intro-word">
          {"Deep Roast".split("").map((ch, ci) => (
            <i
              key={ci}
              className="login-intro-char"
              style={{ "--char-delay": `${700 + ci * 55}ms` } as CSSProperties}
            >
              {ch === " " ? "\u00A0" : ch}
            </i>
          ))}
        </div>
        <em className="login-intro-dot" />
        {EMBERS.map((e, i) => (
          <span
            key={i}
            className="login-intro-ember"
            style={
              {
                "--dx": `${e.dx}px`,
                "--dy": `${e.dy}px`,
                "--ember-delay": `${e.delay}ms`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      {/* 网格线（与 mark 同时，从边缘向内部蔓延，在 mark 背后 z-index 1） */}
      <div className="login-intro-grid">
        {VERTICAL_LINES.map((index) => (
          <i
            key={`li-v-${index}`}
            className={`login-intro-line is-vertical${index % 2 ? " is-reverse" : ""}`}
            style={lineStyle(index, VERTICAL_LINES.length, 0)}
          />
        ))}
        {HORIZONTAL_LINES.map((index) => (
          <i
            key={`li-h-${index}`}
            className={`login-intro-line is-horizontal${index % 2 ? " is-reverse" : ""}`}
            style={lineStyle(index, HORIZONTAL_LINES.length, 5)}
          />
        ))}
      </div>
    </div>
  );
}
