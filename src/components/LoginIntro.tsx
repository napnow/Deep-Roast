"use client";

import { useCallback, useEffect, useRef } from "react";
import type { CSSProperties } from "react";

const VERTICAL_LINES = Array.from({ length: 49 }, (_, i) => i);
const HORIZONTAL_LINES = Array.from({ length: 28 }, (_, i) => i);
const INTRO_SESSION_KEY = "deeproast:intro-played";

const EMBERS: Array<{ dx: number; dy: number; delay: number }> = [
  { dx: -70, dy: -52, delay: 0 },
  { dx: 82, dy: -36, delay: 70 },
  { dx: -58, dy: 58, delay: 130 },
  { dx: 76, dy: 46, delay: 190 },
  { dx: 12, dy: -84, delay: 100 },
];

let hasPlayedIntro = false;

function markIntroPlayed() {
  hasPlayedIntro = true;
  try {
    window.sessionStorage.setItem(INTRO_SESSION_KEY, "1");
  } catch {
    // ignore storage restrictions
  }
}

function wasIntroPlayed(): boolean {
  if (hasPlayedIntro) return true;
  try {
    return window.sessionStorage.getItem(INTRO_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export default function LoginIntro({
  onReady,
  onSkipped,
}: {
  onReady?: () => void;
  onSkipped?: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(false);
  const startedRef = useRef(false);

  const finish = useCallback(
    (skipped = false) => {
      if (doneRef.current) return;
      doneRef.current = true;
      markIntroPlayed();
      const el = rootRef.current;
      if (!el) return;
      if (skipped) {
        el.style.display = "none";
        onSkipped?.();
        return;
      }
      el.classList.add("is-finished");
      window.setTimeout(() => {
        el.style.display = "none";
      }, 420);
    },
    [onSkipped],
  );

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || wasIntroPlayed()) {
      markIntroPlayed();
      const el = rootRef.current;
      if (el) el.style.display = "none";
      onSkipped?.();
      return;
    }
    markIntroPlayed();
    onReady?.();
    const timer = window.setTimeout(() => finish(false), 1850);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Enter" || event.key === " ") {
        window.clearTimeout(timer);
        finish(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [finish, onReady, onSkipped]);

  const lineStyle = (index: number, total: number, offset: number): CSSProperties => {
    void total;
    return {
      "--line-index": index,
      "--line-delay": `${240 + ((index * 7 + offset) % 13) * 15}ms`,
    } as CSSProperties;
  };

  return (
    <div
      ref={rootRef}
      className="login-intro"
      aria-hidden="true"
      onClick={() => finish(true)}
      title="点击跳过动画"
    >
      <div className="login-intro-mark">
        <div className="login-intro-word">
          {"Deep Roast".split("").map((ch, ci) => (
            <i
              key={ci}
              className="login-intro-char"
              style={{ "--char-delay": `${480 + ci * 42}ms` } as CSSProperties}
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
