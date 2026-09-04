"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  KeyboardEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
} from "react";
import {
  clampCreationPanelWidth,
  getCreationPanelKeyboardWidth,
  type CreationPanelBounds,
} from "./creation-workbench-ui";

interface CreationPanelResizeHandleProps {
  width: number;
  bounds: CreationPanelBounds;
  containerRef: RefObject<HTMLElement | null>;
  onWidthChange: (width: number) => void;
}

export default function CreationPanelResizeHandle({
  width,
  bounds,
  containerRef,
  onWidthChange,
}: CreationPanelResizeHandleProps) {
  const [dragging, setDragging] = useState(false);
  const pointerIdRef = useRef<number | null>(null);

  const updateFromClientX = useCallback((clientX: number) => {
    const container = containerRef.current;
    if (!container) return;
    const nextWidth = clientX - container.getBoundingClientRect().left;
    onWidthChange(clampCreationPanelWidth(nextWidth, bounds));
  }, [bounds, containerRef, onWidthChange]);

  useEffect(() => {
    if (!dragging) return;

    function handlePointerMove(event: globalThis.PointerEvent) {
      if (event.pointerId !== pointerIdRef.current) return;
      updateFromClientX(event.clientX);
    }

    function handlePointerUp(event: globalThis.PointerEvent) {
      if (event.pointerId !== pointerIdRef.current) return;
      pointerIdRef.current = null;
      setDragging(false);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [dragging, updateFromClientX]);

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!event.isPrimary) return;
    pointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    updateFromClientX(event.clientX);
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerId !== pointerIdRef.current) return;
    pointerIdRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      return;
    }
    event.preventDefault();
    onWidthChange(getCreationPanelKeyboardWidth(width, event.key, bounds));
  }

  return (
    <div
      className={
        dragging
          ? "creation-panel-resize-handle is-dragging"
          : "creation-panel-resize-handle"
      }
      role="separator"
      tabIndex={0}
      aria-label="调整创作工作台宽度"
      aria-orientation="vertical"
      aria-valuemin={bounds.min}
      aria-valuemax={bounds.max}
      aria-valuenow={Math.round(width)}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      <span className="creation-panel-resize-handle__grip" aria-hidden="true" />
    </div>
  );
}
