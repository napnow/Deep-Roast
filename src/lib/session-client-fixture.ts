/* eslint-disable @typescript-eslint/no-explicit-any -- VM module and hook boundary, test-only. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import ts from "typescript";
import { createStore, type StoreApi } from "zustand/vanilla";
import type { DeepRoastState } from "./store";
import type { AuthUser } from "./auth-client";

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

export type SessionRequest = ReturnType<typeof deferred<Response>> & {
  url: string;
  init?: RequestInit;
};

type Slot = { value?: any; deps?: readonly unknown[]; cleanup?: () => void; effect?: () => void | (() => void) };

/** Runs production TS/TSX and the real Zustand setters, without a browser/server.
 * React scheduling is deterministic; fetch/auth/navigation are strictly mocked.
 * Mock transports deliberately ignore abort, exercising identity guards as well.
 */
export function sessionFixture(options: { pathname?: string } = {}) {
  let active: SessionRunner<any> | null = null;
  const runners: SessionRunner<any>[] = [];
  const requests: SessionRequest[] = [];
  const authRequests: ReturnType<typeof deferred<AuthUser | null>>[] = [];
  const logoutRequests: ReturnType<typeof deferred<void>>[] = [];
  const notifications: unknown[][] = [];
  const navigations: string[] = [];
  const timers = new Map<number, () => void>();
  let timerId = 0;
  let randomId = 0;
  let store: StoreApi<DeepRoastState>;
  const sameDeps = (a?: readonly unknown[], b?: readonly unknown[]) =>
    !!a && !!b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));

  class SessionRunner<T> {
    slots: Slot[] = [];
    cursor = 0;
    dirty = false;
    mounted = true;
    effects: (() => void)[] = [];
    value!: T;
    unsubscribe?: () => void;
    constructor(readonly renderFn: () => T) { runners.push(this); }
    render() {
      assert.ok(this.mounted, "cannot render an unmounted fixture");
      let attempts = 0;
      do {
        assert.ok(++attempts < 20, "hook render must converge");
        this.cursor = 0; this.dirty = false; this.effects = [];
        // eslint-disable-next-line @typescript-eslint/no-this-alias -- tracks the hook owner in this VM fixture.
        active = this;
        try { this.value = this.renderFn(); } finally { active = null; }
        for (const effect of this.effects) effect();
      } while (this.dirty);
      return this.value;
    }
    unmount() {
      if (!this.mounted) return;
      this.mounted = false;
      this.unsubscribe?.();
      for (const slot of this.slots) slot.cleanup?.();
    }
    replayEffects() {
      // React StrictMode's setup -> cleanup -> setup cycle uses the same refs.
      for (const slot of this.slots) slot.cleanup?.();
      for (const slot of this.slots) if (slot.effect) slot.cleanup = slot.effect() || undefined;
    }
  }
  function nextSlot(): [SessionRunner<any>, number] {
    assert.ok(active, "hook invoked outside the session fixture renderer");
    return [active, active.cursor++];
  }
  const react = {
    useState(initial: any) {
      const [runner, index] = nextSlot();
      if (!runner.slots[index]) {
        const slot: Slot = { value: typeof initial === "function" ? initial() : initial };
        runner.slots[index] = slot;
      }
      const slot = runner.slots[index];
      return [slot.value, (next: any) => {
        const value = typeof next === "function" ? next(slot.value) : next;
        if (!Object.is(value, slot.value)) { slot.value = value; runner.dirty = true; }
      }];
    },
    useRef(initial: any) {
      const [runner, index] = nextSlot();
      runner.slots[index] ||= { value: { current: initial } };
      return runner.slots[index].value;
    },
    useCallback(fn: any, deps: readonly unknown[]) {
      const [runner, index] = nextSlot();
      if (!sameDeps(runner.slots[index]?.deps, deps)) runner.slots[index] = { value: fn, deps };
      return runner.slots[index].value;
    },
    useEffect(effect: () => void | (() => void), deps?: readonly unknown[]) {
      const [runner, index] = nextSlot();
      const previous = runner.slots[index];
      if (sameDeps(previous?.deps, deps)) return;
      const slot: Slot = { deps, effect }; runner.slots[index] = slot;
      runner.effects.push(() => { previous?.cleanup?.(); slot.cleanup = effect() || undefined; });
    },
    createContext(value: any) {
      const context: any = { current: value };
      context.Provider = { sessionContext: context };
      return context;
    },
    useContext(context: any) { return context.current; },
  };
  const jsx = (type: any, props: any) => {
    if (type?.sessionContext) type.sessionContext.current = props.value;
    return { type, props };
  };
  const router = {};
  const stubs: Record<string, any> = {
    react,
    "react/jsx-runtime": { jsx, jsxs: jsx },
    zustand: { create(initializer: any) {
      store = createStore<DeepRoastState>(initializer);
      const hook = () => {
        if (active && !active.unsubscribe) {
          const runner = active;
          runner.unsubscribe = store.subscribe(() => { runner.dirty = true; });
        }
        return store.getState();
      };
      return Object.assign(hook, store);
    } },
    "next/navigation": { useRouter: () => router, usePathname: () => options.pathname ?? "/login" },
    "@/lib/auth-client": {
      getAuth() { const request = deferred<AuthUser | null>(); authRequests.push(request); return request.promise; },
      logout() { const request = deferred<void>(); logoutRequests.push(request); return request.promise; },
    },
    "@/lib/local-preview": { isLocalMobilePreview: () => false },
    "@/lib/nav-transition": { softNavigate: (_router: unknown, url: string) => navigations.push(url) },
    "@/components/Toast": { useToast: () => ({ toast: (...args: unknown[]) => notifications.push(args) }) },
  };
  const allowed = new Set([
    "lib/store.ts", "lib/client-api.ts", "lib/image-task.ts", "types/index.ts",
    "lib/client-session-lifecycle.ts", "lib/image-model-preferences.ts",
    "lib/conversational-image-intent.ts", "components/AuthProvider.tsx",
    "hooks/useChatActions.ts", "hooks/useInitialData.ts",
    "hooks/useImageActions.ts", "lib/image-edit-feedback.ts",
  ]);
  const context = createContext({
    console, Error, Headers, AbortController, DOMException, TextDecoder, Uint8Array,
    crypto: { randomUUID: () => `session-test-${++randomId}` },
    process: { env: { NODE_ENV: "test" } },
    window: { location: { search: "" }, localStorage: { getItem: () => null } },
    setTimeout(fn: () => void) { const id = ++timerId; timers.set(id, fn); return id; },
    clearTimeout(id: number) { timers.delete(id); },
    fetch(url: string, init?: RequestInit) {
      assert.ok(url.startsWith("/api/"), "all test fetch calls must be synthetic relative API requests");
      const request = { ...deferred<Response>(), url, init };
      requests.push(request); return request.promise;
    },
  });
  const cache = new Map<string, { exports: any }>();
  function load(file: string): any {
    assert.ok(allowed.has(file), `unmocked module blocked: ${file}`);
    if (cache.has(file)) return cache.get(file)!.exports;
    const compiledModule = { exports: {} }; cache.set(file, compiledModule);
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    const compiled = ts.transpileModule(source, {
      fileName: file,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    const requireMock = (id: string) => {
      if (Object.hasOwn(stubs, id)) return stubs[id];
      if (id === "@/types") return load("types/index.ts");
      if (id === "@/components/AuthProvider") return load("components/AuthProvider.tsx");
      if (id.startsWith("@/")) return load(`${id.slice(2)}.ts`);
      if (id.startsWith("./")) return load(`lib/${id.slice(2)}.ts`);
      throw new Error(`unmocked import blocked: ${id}`);
    };
    runInContext(`(function(require,module,exports){\n${compiled}\n})`, context, { filename: file })(requireMock, compiledModule, compiledModule.exports);
    return compiledModule.exports;
  }
  load("lib/store.ts");
  const auth = load("components/AuthProvider.tsx") as typeof import("../components/AuthProvider");
  const mount = <T>(fn: () => T) => { const runner = new SessionRunner(fn); runner.render(); return runner; };
  async function flush() {
    for (let pass = 0; pass < 20; pass++) {
      await Promise.resolve();
      for (const runner of runners) if (runner.mounted && runner.dirty) runner.render();
    }
  }
  return {
    store: store!, load, requests, authRequests, logoutRequests, notifications, navigations, flush,
    mount,
    mountAuth: () => mount(() => auth.default({ children: null })),
    auth: () => auth.useAuth(),
    mountChat(loadConversations = async () => {}, loadCredits = async () => {}) {
      const { useChatActions } = load("hooks/useChatActions.ts") as typeof import("../hooks/useChatActions");
      return mount(() => useChatActions(loadConversations, loadCredits));
    },
    mountImages(loadCredits = async () => {}) {
      const { useImageActions } = load("hooks/useImageActions.ts") as typeof import("../hooks/useImageActions");
      return mount(() => useImageActions(loadCredits));
    },
    mountInitial() {
      const { useInitialData } = load("hooks/useInitialData.ts") as typeof import("../hooks/useInitialData");
      return mount(() => useInitialData());
    },
    fireTimeouts() { for (const callback of [...timers.values()]) callback(); },
    dispose() { for (const runner of runners) runner.unmount(); timers.clear(); },
  };
}

export function respond(request: SessionRequest, data: unknown, status = 200) {
  request.resolve({ ok: status < 400, status, headers: new Headers({ "Content-Type": "application/json" }),
    json: async () => data } as Response);
}

export function openSessionStream(request: SessionRequest) {
  type Chunk = ReadableStreamReadResult<Uint8Array>;
  const queue: Chunk[] = [];
  const readers: ReturnType<typeof deferred<Chunk>>[] = [];
  const push = (chunk: Chunk) => { const waiting = readers.shift(); if (waiting) waiting.resolve(chunk); else queue.push(chunk); };
  const encoder = new TextEncoder();
  request.resolve({ ok: true, status: 200, headers: new Headers({ "Content-Type": "text/event-stream" }),
    body: { getReader: () => ({
      read() { if (queue.length) return Promise.resolve(queue.shift()!); const next = deferred<Chunk>(); readers.push(next); return next.promise; },
      cancel: async () => {}, releaseLock() {},
    }) },
  } as unknown as Response);
  return {
    event: (data: unknown) => push({ done: false, value: encoder.encode(`data: ${JSON.stringify(data)}\n\n`) }),
    end: () => push({ done: true, value: undefined }),
  };
}

export const sessionUser = (id: string): AuthUser => ({ id, username: id, role: "admin" });
export const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value));
