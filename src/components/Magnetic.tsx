"use client";

/**
 * 无依赖磁吸组件（rAF 弹簧模拟，参考 ljj.world 的 Magnetic）。
 * 桌面端鼠标靠近时元素被吸向光标，离开时弹簧回弹；
 * 触摸设备自动禁用（避免干扰滚动）。
 */

import { useCallback, useRef } from "react";
import type { PointerEvent, ReactNode } from "react";

interface MagneticProps {
  children: ReactNode;
  className?: string;
  strength?: number;
}

export default function Magnetic({
  children,
  className = "",
  strength = 0.18,
}: MagneticProps) {
  const ref = useRef<HTMLDivElement>(null);
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });
  const raf = useRef(0);

  const tick = useCallback(function loop() {
    const cur = current.current;
    const tgt = target.current;
    cur.x += (tgt.x - cur.x) * 0.16;
    cur.y += (tgt.y - cur.y) * 0.16;
    const el = ref.current;
    if (el) {
      el.style.transform = `translate3d(${cur.x.toFixed(2)}px, ${cur.y.toFixed(2)}px, 0)`;
    }
    if (Math.abs(cur.x - tgt.x) > 0.1 || Math.abs(cur.y - tgt.y) > 0.1) {
      raf.current = requestAnimationFrame(loop);
    } else {
      raf.current = 0;
    }
  }, []);

  const start = useCallback(() => {
    if (!raf.current) raf.current = requestAnimationFrame(tick);
  }, [tick]);

  const handlePointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === "touch" || !ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      target.current = {
        x: (e.clientX - rect.left - rect.width / 2) * strength,
        y: (e.clientY - rect.top - rect.height / 2) * strength,
      };
      start();
    },
    [strength, start],
  );

  const reset = useCallback(() => {
    target.current = { x: 0, y: 0 };
    start();
  }, [start]);

  return (
    <div
      ref={ref}
      className={className}
      style={{ display: "inline-block", willChange: "transform" }}
      onPointerMove={handlePointerMove}
      onPointerLeave={reset}
      onBlur={reset}
    >
      {children}
    </div>
  );
}
