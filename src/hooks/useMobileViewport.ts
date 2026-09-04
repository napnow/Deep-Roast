"use client";

import { useEffect, useState } from "react";

export interface MobileViewportState {
  keyboardInset: number;
  keyboardOpen: boolean;
}

const KEYBOARD_OPEN_THRESHOLD = 120;

export function useMobileViewport(): MobileViewportState {
  const [viewport, setViewport] = useState<MobileViewportState>({
    keyboardInset: 0,
    keyboardOpen: false,
  });

  useEffect(() => {
    const visualViewport = window.visualViewport;
    if (!visualViewport) return;

    let largestHeight = visualViewport.height;
    const update = () => {
      largestHeight = Math.max(largestHeight, visualViewport.height);
      const keyboardInset = Math.max(0, largestHeight - visualViewport.height);
      setViewport({
        keyboardInset,
        keyboardOpen: keyboardInset > KEYBOARD_OPEN_THRESHOLD,
      });
    };

    update();
    visualViewport.addEventListener("resize", update);
    visualViewport.addEventListener("scroll", update);

    return () => {
      visualViewport.removeEventListener("resize", update);
      visualViewport.removeEventListener("scroll", update);
    };
  }, []);

  return viewport;
}
