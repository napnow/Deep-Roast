"use client";

import { useDeepRoastStore } from "./store";

export type UserSessionToken = number;

export function captureUserSession(): UserSessionToken {
  return useDeepRoastStore.getState().userSessionVersion;
}

export function isUserSessionCurrent(token: UserSessionToken): boolean {
  return captureUserSession() === token;
}

/** Each lane has one owner; abort is only transport cleanup, not the identity check. */
export function createClientSessionLifecycle(getSession = captureUserSession) {
  let active = true;
  type Request = {
    signal: AbortSignal;
    isCurrent: () => boolean;
    abort: () => void;
    finish: () => void;
  };
  const requests = new Map<string, Request>();
  const isActive = (session = getSession()) => active && getSession() === session;
  const cancel = (key: string) => {
    const request = requests.get(key);
    requests.delete(key); // Revoke ownership before abort can deliver a callback.
    request?.abort();
  };
  const invalidate = () => {
    for (const key of requests.keys()) cancel(key);
  };
  return {
    isActive,
    activate: () => { active = true; },
    cancel,
    invalidate,
    dispose: () => { active = false; invalidate(); },
    hasCurrent: (key: string) => requests.get(key)?.isCurrent() ?? false,
    start(key: string, session = getSession()): Request | null {
      if (!isActive(session)) return null;
      cancel(key);
      const controller = new AbortController();
      const request: Request = {
        signal: controller.signal,
        // An owned timeout may abort its transport and still report its error.
        isCurrent: () => isActive(session) && requests.get(key) === request,
        abort: () => controller.abort(),
        finish: () => {
          if (requests.get(key) === request) requests.delete(key);
        },
      };
      requests.set(key, request);
      return request;
    },
  };
}
