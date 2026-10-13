import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createContext, runInContext } from "node:vm";
import type { ComponentProps } from "react";
import ts from "typescript";

import type Img2ImgPanel from "./Img2ImgPanel";
import type { ImageEditRequest } from "@/lib/image-edit-contract";
import { DEFAULT_IMAGE_MODEL_CREDIT_COST } from "@/types";
import * as imageEditUi from "./image-edit-ui";
import * as draftUi from "./image-to-image-draft";
import * as workbenchUi from "./creation-workbench-ui";
import * as customRatio from "@/lib/custom-image-ratio";
import * as editStyles from "./editStyles";
import { formatTime } from "./imageUtils";

// Adapted from the offline concurrency review. Execute the actual panel and pure
// request/draft helpers, but never load business hooks, a store, or real HTTP.
type PanelProps = ComponentProps<typeof Img2ImgPanel>;
type Cleanup = () => void;
type Effect = () => void | Cleanup;
type Slot =
  | { kind: "state"; value: unknown; set: (next: unknown) => void }
  | { kind: "ref"; current: unknown }
  | { kind: "memo"; value: unknown; deps?: readonly unknown[] }
  | { kind: "effect"; effect: Effect; cleanup?: Cleanup; deps?: readonly unknown[] };

interface Element {
  type: unknown;
  props: Record<string, unknown>;
}

export interface UploadSubmission {
  kind: "single" | "batch";
  request: ImageEditRequest;
  size: string;
  count: number;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function nodes(tree: unknown, predicate: (node: Element) => boolean): Element[] {
  if (Array.isArray(tree)) return tree.flatMap((child) => nodes(child, predicate));
  if (!tree || typeof tree !== "object" || !("props" in tree)) return [];
  const node = tree as Element;
  return [...(predicate(node) ? [node] : []), ...nodes(node.props.children, predicate)];
}

function text(tree: unknown): string {
  if (tree == null || typeof tree === "boolean") return "";
  if (Array.isArray(tree)) return tree.map(text).join("");
  if (typeof tree === "object" && "props" in tree) return text((tree as Element).props.children);
  return String(tree);
}

const panelUrl = new URL("./Img2ImgPanel.tsx", import.meta.url);
const compiledPanel = ts.transpileModule(readFileSync(panelUrl, "utf8"), {
  fileName: fileURLToPath(panelUrl),
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX,
  },
}).outputText;

export function createUploadHarness(initialProps: Partial<PanelProps> = {}) {
  const slots: Slot[] = [];
  const submissions: UploadSubmission[] = [];
  const compression = new Map<string, ReturnType<typeof deferred<string>>>();
  const readers: MockFileReader[] = [];
  const intervals = new Set<number>();
  const blockedFetches: unknown[] = [];
  let nextTimer = 0;
  let cursor = 0;
  let rendering = false;
  let dirty = false;
  let mounted = true;
  let writesAfterUnmount = 0;
  let effects: Cleanup[] = [];
  let tree: unknown;

  function nextSlot() {
    assert.ok(rendering, "hooks must run inside the fixture renderer");
    return cursor++;
  }
  function equalDeps(a?: readonly unknown[], b?: readonly unknown[]) {
    return a !== undefined && b !== undefined && a.length === b.length &&
      a.every((value, index) => Object.is(value, b[index]));
  }
  const react = {
    useState(initial: unknown) {
      const index = nextSlot();
      if (!slots[index]) {
        const cell: Extract<Slot, { kind: "state" }> = {
          kind: "state",
          value: typeof initial === "function" ? initial() : initial,
          set(next) {
            // Record even attempted writes: React silently ignoring a setter on
            // an unmounted component must not hide a missing lifecycle guard.
            if (!mounted) { writesAfterUnmount++; return; }
            const value = typeof next === "function" ? next(cell.value) : next;
            if (!Object.is(value, cell.value)) { cell.value = value; dirty = true; }
          },
        };
        slots[index] = cell;
      }
      const cell = slots[index];
      assert.equal(cell.kind, "state");
      return [cell.value, cell.set];
    },
    useRef(initial: unknown) {
      const index = nextSlot();
      return slots[index] ||= { kind: "ref", current: initial };
    },
    useCallback(fn: unknown, deps?: readonly unknown[]) {
      const index = nextSlot();
      const old = slots[index];
      if (!old || old.kind !== "memo" || !equalDeps(old.deps, deps)) {
        slots[index] = { kind: "memo", value: fn, deps };
      }
      const cell = slots[index];
      assert.equal(cell.kind, "memo");
      return cell.value;
    },
    useEffect(effect: Effect, deps?: readonly unknown[]) {
      const index = nextSlot();
      const old = slots[index];
      if (old?.kind === "effect" && equalDeps(old.deps, deps)) return;
      const cell: Extract<Slot, { kind: "effect" }> = { kind: "effect", effect, deps };
      slots[index] = cell;
      effects.push(() => {
        if (old?.kind === "effect") old.cleanup?.();
        cell.cleanup = effect() || undefined;
      });
    },
  };

  class MockFileReader {
    static readonly EMPTY = 0;
    static readonly LOADING = 1;
    static readonly DONE = 2;
    readyState: number = MockFileReader.EMPTY;
    result: string | null = null;
    file!: File;
    abortCalls = 0;
    onload: Cleanup | null = null;
    onerror: Cleanup | null = null;
    onabort: Cleanup | null = null;

    readAsDataURL(file: File) {
      this.file = file;
      this.readyState = MockFileReader.LOADING;
      readers.push(this);
    }
    abort() {
      this.abortCalls++;
      if (this.readyState === MockFileReader.LOADING) {
        this.readyState = MockFileReader.DONE;
        this.result = null;
        this.onabort?.();
      }
    }
    finish() {
      assert.equal(this.readyState, MockFileReader.LOADING);
      this.readyState = MockFileReader.DONE;
      this.result = `preview:${this.file.name}`;
      this.onload?.();
    }
    fail() {
      assert.equal(this.readyState, MockFileReader.LOADING);
      this.readyState = MockFileReader.DONE;
      this.onerror?.();
    }
  }

  const jsx = (type: unknown, props: Record<string, unknown> | null) => ({ type, props: props || {} });
  const stubs: Record<string, unknown> = {
    react,
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: Symbol("Fragment") },
    "@/types": { DEFAULT_IMAGE_MODEL_CREDIT_COST },
    "@/lib/scroll-lock": { lockPageScroll() {}, unlockPageScroll() {} },
    "./imageUtils": {
      formatTime,
      compressImageFile(file: File) {
        const pending = deferred<string>();
        compression.set(file.name, pending);
        return pending.promise;
      },
    },
    "./ImageRatioPicker": { default: () => null },
    "@/lib/custom-image-ratio": customRatio,
    "./image-edit-ui": imageEditUi,
    "./image-to-image-draft": draftUi,
    "./creation-workbench-ui": workbenchUi,
    "./editStyles": editStyles,
  };
  const context = createContext({
    Error,
    AbortController,
    FileReader: MockFileReader,
    fetch(url: unknown) {
      if (url !== "/api/public/styles") {
        blockedFetches.push(url);
        throw new Error(`Real/unexpected HTTP blocked: ${String(url)}`);
      }
      return Promise.resolve({ json: async () => ({ styles: [] }) });
    },
    setInterval() { const id = ++nextTimer; intervals.add(id); return id; },
    clearInterval(id: number) { intervals.delete(id); },
  });
  const compiledModule = { exports: {} as { default: (props: PanelProps) => unknown } };
  runInContext(`(function(require, module, exports) {\n${compiledPanel}\n})`, context, {
    filename: fileURLToPath(panelUrl),
  })((name: string) => {
    assert.ok(Object.hasOwn(stubs, name), `Unmocked module blocked: ${name}`);
    return stubs[name];
  }, compiledModule, compiledModule.exports);

  function submit(kind: UploadSubmission["kind"], request: ImageEditRequest, size: string, count: number) {
    // Normalize VM-realm arrays before node:assert's prototype-sensitive checks.
    submissions.push({ kind, request: structuredClone(request), size, count });
  }
  let props: PanelProps = {
    size: "1024x1024",
    generating: false,
    onGenerate() { assert.fail("The legacy generation path must not run"); },
    onEditImage: (request, size) => submit("single", request, size, 1),
    onEditImageBatch: (request, size, count) => submit("batch", request, size, count),
    onStopGenerate() {},
    ...initialProps,
  };
  function render(nextProps: Partial<PanelProps> = {}) {
    assert.ok(mounted, "cannot render an unmounted panel");
    props = { ...props, ...nextProps };
    let passes = 0;
    do {
      assert.ok(++passes < 20, "fixture render must converge");
      dirty = false;
      cursor = 0;
      effects = [];
      rendering = true;
      try { tree = compiledModule.exports.default(props); } finally { rendering = false; }
      for (const effect of effects) effect();
    } while (dirty);
  }
  function unique(predicate: (node: Element) => boolean, label: string) {
    const found = nodes(tree, predicate);
    assert.equal(found.length, 1, `${label} must be unique`);
    return found[0]!;
  }
  function button(label: string) {
    return unique((node) => node.type === "button" &&
      (node.props["aria-label"] === label || text(node) === label), `button ${label}`);
  }
  function click(label: string) {
    const node = button(label);
    assert.ok(!node.props.disabled, `button ${label} must be enabled`);
    assert.ok(typeof node.props.onClick === "function");
    const result = node.props.onClick();
    render();
    return result;
  }
  function editor() {
    return unique((node) => node.type === "textarea" &&
      node.props.className === "creation-composer__input", "current prompt editor");
  }
  async function flush() {
    // Drain the bounded FileReader -> compression.then -> catch microtask chain;
    // no wall-clock sleeps, real timers, image decoder, or service is involved.
    for (let i = 0; i < 12; i++) await Promise.resolve();
    if (mounted) render();
  }
  function pendingCompression(name: string) {
    const pending = compression.get(name);
    assert.ok(pending, `compression must have started for ${name}`);
    return pending;
  }
  function unmount() {
    if (!mounted) return;
    mounted = false;
    for (const slot of slots) if (slot.kind === "effect") slot.cleanup?.();
    assert.equal(intervals.size, 0, "component timers must be cleaned up");
    assert.deepEqual(blockedFetches, [], "no business HTTP may be attempted");
  }
  render();

  return {
    render, click, button, flush, unmount,
    get submissions() { return submissions; },
    get writesAfterUnmount() { return writesAfterUnmount; },
    previews: () => nodes(tree, (node) => node.type === "img").map((node) => node.props.src),
    errors: () => nodes(tree, (node) => node.props.role === "alert").map(text),
    prompt: () => editor().props.value,
    setPrompt(value: string) {
      const node = editor();
      assert.ok(!node.props.disabled, "prompt editor must be enabled");
      assert.ok(typeof node.props.onChange === "function");
      node.props.onChange({ target: { value } });
      render();
    },
    upload(names: string[], read = true) {
      const input = unique((node) => node.type === "input" && node.props.type === "file", "file input");
      assert.ok(typeof input.props.onChange === "function");
      const target = { files: names.map((name) => ({ name })), value: "mock-selection" };
      const start = readers.length;
      input.props.onChange({ target });
      assert.equal(target.value, "", "file selection must reset for re-upload");
      const picked = readers.slice(start);
      if (read) for (const reader of picked) reader.finish();
      render();
      return picked;
    },
    hasCompression: (name: string) => compression.has(name),
    async finishCompression(name: string) {
      pendingCompression(name).resolve(`data:image/png;base64,${name}`);
      await flush();
    },
    async failCompression(name: string) {
      pendingCompression(name).reject(new Error(`synthetic compression failure: ${name}`));
      await flush();
    },
    replayEffects() {
      // React Strict Mode replays mount effects without replacing component refs.
      for (const slot of slots) if (slot.kind === "effect") slot.cleanup?.();
      for (const slot of slots) if (slot.kind === "effect") slot.cleanup = slot.effect() || undefined;
      render();
    },
  };
}
