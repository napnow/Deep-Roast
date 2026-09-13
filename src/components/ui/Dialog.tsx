"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { lockPageScroll, unlockPageScroll } from "@/lib/scroll-lock";

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

interface DialogProps {
  open: boolean;
  onClose: () => void;
  label: string;
  className?: string;
  children: ReactNode;
}

/** Native top-layer modal: the browser owns inertness, focus and Escape order. */
export default function Dialog({ open, onClose, label, className = "", children }: DialogProps) {
  const mounted = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);

  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!mounted || !open || !dialog) return;
    const previous = document.activeElement;
    dialog.showModal();
    lockPageScroll();
    return () => {
      dialog.close();
      unlockPageScroll();
      if (previous instanceof HTMLElement && previous.isConnected) {
        previous.focus({ preventScroll: true });
      }
    };
  }, [mounted, open]);

  if (!mounted || !open) return null;
  return createPortal(
    <dialog
      ref={dialogRef}
      className={`ui-modal-dialog ${className}`}
      tabIndex={-1}
      aria-label={label}
      aria-modal="true"
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        event.stopPropagation();
        const dialog = event.currentTarget;
        const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
          'button, input, select, textarea, a[href], summary, [tabindex]',
        )).filter((element) => {
          if (element.tabIndex < 0 || element.matches(":disabled") || element.closest("[inert]")) return false;
          if (!element.getClientRects().length || getComputedStyle(element).visibility === "hidden") return false;
          // Closed details can retain layout rectangles in Chromium. Only their
          // first summary participates in sequential keyboard navigation.
          for (let parent = element.parentElement; parent && parent !== dialog; parent = parent.parentElement) {
            if (parent instanceof HTMLDetailsElement && !parent.open) {
              const summary = parent.querySelector(":scope > summary");
              if (!summary?.contains(element)) return false;
            }
          }
          return true;
        });
        const first = focusable[0];
        const last = focusable.at(-1);
        if (!first || !last) {
          event.preventDefault();
          dialog.focus();
        } else if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
          event.preventDefault();
          first.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
      }}
      onClick={(event) => {
        // React portal events still bubble through their logical parent.
        event.stopPropagation();
        if (event.target === event.currentTarget) closeRef.current();
      }}
    >
      {children}
    </dialog>,
    document.body,
  );
}
