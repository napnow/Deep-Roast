"use client";

import { useEffect, useState } from "react";
import { getViewportOcclusion } from "./mobile-viewport-metrics";

export interface MobileViewportState {
  keyboardInset: number;
  keyboardOpen: boolean;
  keyboardOffset: number;
  visibleHeight: number;
}

const KEYBOARD_OPEN_THRESHOLD = 120;

export function useMobileViewport(): MobileViewportState {
  const [viewport, setViewport] = useState<MobileViewportState>({
    keyboardInset: 0,
    keyboardOpen: false,
    keyboardOffset: 0,
    visibleHeight: 0,
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
        keyboardOffset: getViewportOcclusion(window.innerHeight, visualViewport.height, visualViewport.offsetTop),
        visibleHeight: visualViewport.height,
      });
    };

    const resetOrientation = () => {
      largestHeight = visualViewport.height;
      update();
    };

    update();
    visualViewport.addEventListener("resize", update);
    visualViewport.addEventListener("scroll", update);
    window.screen.orientation?.addEventListener("change", resetOrientation);

    return () => {
      visualViewport.removeEventListener("resize", update);
      visualViewport.removeEventListener("scroll", update);
      window.screen.orientation?.removeEventListener("change", resetOrientation);
    };
  }, []);

  return viewport;
}
