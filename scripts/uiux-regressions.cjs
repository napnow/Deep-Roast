/* eslint-disable @typescript-eslint/no-require-imports -- Portable Node CLI and testable CommonJS entry. */
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { createRequire } = require("node:module");
const REPO = path.resolve(__dirname, "..");
const OUTPUT =
  process.env.UIUX_TEST_OUTPUT || path.join(REPO, ".uiux-test-results");
const localRequire = createRequire(path.join(REPO, "package.json"));
const esbuild = localRequire("esbuild");
const tailwind = localRequire("@tailwindcss/node");
const { chromium } = require("playwright");
// No env files, DB connections, dev server, real identities, or external requests.
process.env.DATABASE_URL =
  "postgresql://frontend_review:dummy@127.0.0.1:1/frontend_review";
const entry = `
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import ImageGenView from '@/components/ImageGen/ImageGenView';
import ChangePasswordModal from '@/components/Auth/ChangePasswordModal';
import {useDeepRoastStore} from '@/lib/store';
const fixture = {id:'fixture-image',prompt:'Synthetic warm ceramic cup',model:'gpt-image-2',size:'1024x1024',imageUrl:'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="tan" width="100" height="100"/%3E%3C/svg%3E',createdAt:'2026-09-13T01:00:00Z',sourceMode:'text'};
window.__calls = []; window.__fetches = [];
window.fetch = async (input, init={}) => {
  const url = String(input); window.__fetches.push(url);
  if (url === '/api/reverse-prompt') return new Promise(resolve => {
    window.__resolveReverse = () => resolve(new Response(JSON.stringify({prompt:'User A image description'}),{status:200,headers:{'Content-Type':'application/json'}}));
    window.__reverseSignal = init.signal;
  });
  if (url.includes('/styles')) return new Response(JSON.stringify({styles:[]}),{status:200});
  throw new Error('Unexpected fetch blocked: '+url);
};
window.__store = useDeepRoastStore;
window.__setUser = (id) => {
  useDeepRoastStore.getState().setUserSession(id);
  useDeepRoastStore.getState().setConfig({imageModel:'gpt-image-2',imageGenerationEnabled:true,imageModelCosts:{'gpt-image-2':12},reversePromptModel:'synthetic-vision'});
  useDeepRoastStore.getState().setImageModels([{id:'gpt-image-2',name:'GPT Image 2'}]);
  useDeepRoastStore.getState().setSelectedImageModel('gpt-image-2');
};
window.__setUser('A');
function App() {
  const state = useDeepRoastStore();
  const [active,setActive] = useState(fixture);
  const [pw,setPw] = useState(false);
  return <div style={{height:'100dvh',display:'flex',flexDirection:'column'}}>
    <button type="button" id="password-opener" onClick={()=>setPw(true)}>Password test</button>
    <ImageGenView model="gpt-image-2" generating={state.generating} history={[fixture]} activeImage={active}
      onActiveImageChange={setActive} onGenerate={(...args)=>window.__calls.push(['generate',...args])}
      onEditImage={(...args)=>window.__calls.push(['edit',...args])} onEditImageBatch={(...args)=>window.__calls.push(['editBatch',...args])}
      onStopGenerate={()=>window.__calls.push(['stop'])} onRetryGenerate={()=>{}}
      onDeleteImage={(id)=>window.__calls.push(['delete',id])} credits={500} isAdmin={false}
      mobileTab="generate" onMobileGenerateTab={()=>{}} keyboardInset={0} keyboardOpen={false}/>
    <ChangePasswordModal open={pw} onClose={()=>setPw(false)}/>
  </div>;
}
const root = createRoot(document.getElementById('root'));
window.__unmount = () => root.render(null);
window.__mount = () => root.render(<App/>);
window.__mount();
`;
async function build() {
  const tree = new Set(
    fs
      .readdirSync(path.join(REPO, "src"), { recursive: true })
      .filter((name) => /\.tsx?$/.test(name))
      .map((name) => "src/" + name.replaceAll("\\", "/")),
  );
  const sources = new Map();
  const resolvePinned = (name) =>
    [
      name,
      name + ".tsx",
      name + ".ts",
      name + "/index.tsx",
      name + "/index.ts",
    ].find((p) => tree.has(p));
  const result = await esbuild.build({
    stdin: {
      contents: entry,
      loader: "tsx",
      resolveDir: REPO,
      sourcefile: "review-entry.tsx",
    },
    bundle: true,
    write: false,
    platform: "browser",
    format: "iife",
    jsx: "automatic",
    outfile: path.join(__dirname, "in-memory-only.js"),
    define: { "process.env.NODE_ENV": '"development"' },
    logLevel: "silent",
    plugins: [
      {
        name: "read-pinned-git-source",
        setup(build) {
          build.onResolve({ filter: /^@\// }, (args) => {
            const file = resolvePinned("src/" + args.path.slice(2));
            if (!file) throw new Error("Missing pinned source " + args.path);
            return { path: file, namespace: "pinned" };
          });
          build.onResolve({ filter: /^\./, namespace: "pinned" }, (args) => {
            const file = resolvePinned(
              path.posix.normalize(
                path.posix.join(path.posix.dirname(args.importer), args.path),
              ),
            );
            if (!file)
              throw new Error("Missing relative pinned source " + args.path);
            return { path: file, namespace: "pinned" };
          });
          build.onLoad({ filter: /.*/, namespace: "pinned" }, (args) => {
            const contents = fs.readFileSync(
              path.join(REPO, args.path),
              "utf8",
            );
            sources.set(args.path, contents);
            return {
              contents,
              loader: args.path.endsWith(".tsx") ? "tsx" : "ts",
              resolveDir: path.join(REPO, path.posix.dirname(args.path)),
            };
          });
        },
      },
    ],
  });
  const rawCss = fs.readFileSync(
    path.join(REPO, "src/app/globals.css"),
    "utf8",
  );
  const compiled = await tailwind.compile(rawCss, {
    base: REPO,
    onDependency: () => {},
  });
  const candidates = [
    ...new Set(
      [entry, ...sources.values()].flatMap((s) => s.split(/[\s"'\x60<>{}=]+/)),
    ),
  ];
  return {
    js: result.outputFiles.find((f) => f.path.endsWith(".js")).text,
    css: compiled.build(candidates),
    files: sources.size,
  };
}
const pixel = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=",
  "base64",
);
const snapshot = (page) =>
  page.evaluate(() => ({
    dialogs: document.querySelectorAll("dialog[open]").length,
    position: document.body.style.position,
    bodyOverflow: document.body.style.overflow,
    htmlOverflow: document.documentElement.style.overflow,
    focus: {
      inModal: !!document.activeElement?.closest("dialog[open]"),
      documentFocused: document.hasFocus(),
      tag: document.activeElement?.tagName,
      text: document.activeElement?.textContent?.trim().slice(0, 70),
      class: document.activeElement?.className,
    },
  }));
async function run() {
  const builds = { head: await build() };
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_EXECUTABLE || undefined,
    args: ["--disable-background-networking"],
  });
  const results = [];
  async function check(name, version, width, fn) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
      serviceWorkers: "block",
    });
    const requests = [];
    await context.route("**/*", (route) => {
      requests.push(route.request().url());
      return route.abort();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    try {
      await page.setContent(
        '<!doctype html><html><head></head><body><div id="root"></div></body></html>',
      );
      await page.addStyleTag({ content: builds[version].css });
      await page.addScriptTag({ content: builds[version].js });
      await page
        .locator(".image-workspace-desktop")
        .waitFor({ state: "attached" });
      await page.waitForTimeout(60);
      const evidence = await fn(page);
      assert.deepEqual(errors, []);
      assert.deepEqual(requests, [], "No real network requests are allowed");
      if (name === "desktop-continue-editing") {
        assert.equal(evidence.openNativeDialogs, 0);
        assert.equal(evidence.desktopMode, "edit");
      } else if (name === "late-reverse-result-after-account-remount") {
        assert.equal(evidence.after, "User B draft");
        assert.equal(evidence.requestAborted, true);
      } else if (name === "escape-while-editor-focused") {
        for (const key of ["position", "bodyOverflow", "htmlOverflow"])
          assert.equal(evidence.after[key], evidence.before[key]);
      } else if (name === "tab-to-edit-settings-before-upload") {
        assert.equal(evidence.focusStayedInModal, true);
      } else if (name === "nested-confirm-cancel-and-delete") {
        assert.equal(evidence.focusReturned, true);
        assert.equal(evidence.calls.filter((c) => c[0] === "delete").length, 1);
      } else if (name === "password-html-labels-and-escape") {
        assert.equal(evidence.fieldFocused, true);
        assert.equal(evidence.focusReturned, true);
        assert.equal(evidence.labels.length, 3);
        assert.ok(
          evidence.labels.every((label) => label.controlType === "password"),
        );
      }
      results.push({ name, version, evidence });
    } catch (error) {
      results.push({
        name,
        version,
        harnessError: error.stack,
        errors,
        requests,
      });
    } finally {
      await context.close();
    }
  }
  for (const version of ["head"]) {
    await check("desktop-continue-editing", version, 1440, async (page) => {
      await page
        .locator(".image-workspace-desktop")
        .getByRole("button", { name: "继续修改", exact: true })
        .click();
      await page.waitForTimeout(80);
      return page.evaluate(() => ({
        openNativeDialogs: document.querySelectorAll("dialog[open]").length,
        mobileComposerDisplay: getComputedStyle(
          document.querySelector(".mobile-composer-shell"),
        ).display,
        mobileSheetVisible: !!document
          .querySelector(".mobile-creation-sheet")
          ?.getClientRects().length,
        topLayerMobileSheet: !!document.querySelector(
          "dialog:modal .mobile-creation-sheet",
        ),
        desktopMode: window.__store.getState().imageCreationMode,
      }));
    });
    await check(
      "late-reverse-result-after-account-remount",
      version,
      390,
      async (page) => {
        await page
          .locator(".mobile-composer-tools")
          .getByRole("button", { name: /^\u53cd\u63a8/ })
          .click();
        await page
          .locator(".mobile-creation-sheet input[type=file]")
          .setInputFiles({
            name: "synthetic.png",
            mimeType: "image/png",
            buffer: pixel,
          });
        await page
          .locator(".mobile-creation-sheet")
          .getByRole("button", { name: /\u5206\u6790\u56fe\u7247/ })
          .click();
        await page.waitForFunction(
          () => typeof window.__resolveReverse === "function",
        );
        await page.locator(".mobile-creation-sheet__close").click();
        await page.evaluate(() => {
          window.__setUser(null);
          window.__unmount();
        });
        await page.waitForFunction(
          () => document.getElementById("root").childElementCount === 0,
        );
        await page.evaluate(() => {
          window.__setUser("B");
          window.__mount();
        });
        const input = page.locator(".mobile-composer-input textarea");
        await input.fill("User B draft");
        const before = await input.inputValue();
        await page.evaluate(() => window.__resolveReverse());
        await page.waitForTimeout(100);
        return {
          before,
          after: await input.inputValue(),
          session: await page.evaluate(
            () => window.__store.getState().userSessionId,
          ),
          requestAborted: await page.evaluate(
            () => window.__reverseSignal.aborted,
          ),
        };
      },
    );
  }
  await check("escape-while-editor-focused", "head", 390, async (page) => {
    const before = await snapshot(page);
    await page
      .locator(".mobile-composer-tools")
      .getByRole("button", { name: "图生图", exact: true })
      .click();
    await page.locator("dialog .creation-composer__input").focus();
    const focused = await snapshot(page);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("dialog[open]"));
    return { before, focused, after: await snapshot(page) };
  });
  await check(
    "tab-to-edit-settings-before-upload",
    "head",
    390,
    async (page) => {
      await page
        .locator(".mobile-composer-tools")
        .getByRole("button", { name: "图生图", exact: true })
        .click();
      await page.locator("dialog .creation-composer__input").focus();
      const summary = await page
        .locator("dialog .creation-settings > summary")
        .evaluate((e) => ({
          tabIndex: e.tabIndex,
          visible: !!e.getClientRects().length,
        }));
      const matching = await page.locator("dialog").evaluate((dialog) =>
        Array.from(
          dialog.querySelectorAll(
            'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
          ),
        )
          .filter(
            (e) =>
              e.getClientRects().length > 0 &&
              getComputedStyle(e).visibility !== "hidden",
          )
          .map((e) => ({
            tag: e.tagName,
            text: e.textContent.trim().slice(0, 45),
            inClosedDetails: !!e.closest("details:not([open])"),
          })),
      );
      await page.locator("dialog .mobile-creation-sheet__close").focus();
      await page.keyboard.press("Shift+Tab");
      const shiftTabFromFirst = (await snapshot(page)).focus;
      await page.locator("dialog .creation-composer__input").focus();
      const cycle = [];
      for (let i = 0; i < 8; i++) {
        await page.keyboard.press("Tab");
        cycle.push((await snapshot(page)).focus);
      }
      return {
        summary,
        matching,
        shiftTabFromFirst,
        cycle,
        focusStayedInModal: cycle.every((e) => e.inModal),
      };
    },
  );
  await check(
    "nested-confirm-cancel-and-delete",
    "head",
    1440,
    async (page) => {
      const opener = page
        .locator(".image-workspace-desktop")
        .getByRole("button", { name: "查看大图", exact: true });
      await opener.click();
      await page
        .locator(".image-preview-modal")
        .getByRole("button", { name: "删除", exact: true })
        .click();
      assert.equal(await page.locator("dialog[open]").count(), 2);
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("dialog[open]").count(), 1);
      const focusAfterCancel = (await snapshot(page)).focus;
      await page
        .locator(".image-preview-modal")
        .getByRole("button", { name: "删除", exact: true })
        .click();
      await page
        .getByRole("dialog", { name: "删除图片", exact: true })
        .getByRole("button", { name: "删除", exact: true })
        .click();
      await page.waitForFunction(() => !document.querySelector("dialog[open]"));
      return {
        focusAfterCancel,
        calls: await page.evaluate(() => window.__calls),
        focusReturned: await opener.evaluate(
          (e) => document.activeElement === e,
        ),
        scroll: await snapshot(page),
      };
    },
  );
  await check("password-html-labels-and-escape", "head", 1440, async (page) => {
    await page.locator("#password-opener").click();
    const labels = await page
      .locator("dialog label")
      .evaluateAll((labels) =>
        labels.map((label) => ({
          text: label.textContent,
          for: label.htmlFor,
          controlType: label.control?.type,
        })),
      );
    await page.locator("dialog label").first().click();
    const fieldFocused = await page
      .locator("dialog input")
      .first()
      .evaluate((e) => document.activeElement === e);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("dialog[open]"));
    return {
      labels,
      fieldFocused,
      focusReturned: await page
        .locator("#password-opener")
        .evaluate((e) => document.activeElement === e),
    };
  });
  for (const width of [360, 390, 768, 900, 1024, 1280, 1440]) {
    await check("usable-layout-" + width, "head", width, async (page) => {
      const metrics = await page.evaluate(() => ({
        viewport: innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        canvas: [...document.querySelectorAll(".result-canvas")]
          .find((e) => e.getBoundingClientRect().width > 0)
          ?.getBoundingClientRect().width,
      }));
      assert.ok(metrics.documentWidth <= width);
      if (width >= 768) assert.ok(metrics.canvas >= 420);
      return metrics;
    });
  }
  await check("shared-draft-and-style", "head", 390, async (page) => {
    await page.locator(".mobile-composer-input textarea").fill("Shared draft");
    await page.setViewportSize({ width: 1024, height: 900 });
    assert.equal(
      await page.locator(".creation-composer__input").first().inputValue(),
      "Shared draft",
    );
    await page.evaluate(() =>
      window.__store
        .getState()
        .setTextToImageDraft({ count: 3, stylePrompt: "Editorial style" }),
    );
    await page.setViewportSize({ width: 390, height: 900 });
    await page.locator(".mobile-composer-submit").click();
    assert.equal(
      await page.locator(".mobile-composer-input textarea").inputValue(),
      "Shared draft",
    );
    const call = await page.evaluate(() =>
      window.__calls.find((c) => c[0] === "generate"),
    );
    assert.equal(call[1], "Editorial style\n\nShared draft");
    assert.equal(call[3], 3);
    return { draftRetained: true, count: call[3] };
  });
  await browser.close();
  const report = { sourceFiles: builds.head.files, results };
  fs.mkdirSync(OUTPUT, { recursive: true });
  fs.writeFileSync(
    path.join(OUTPUT, "uiux-regressions.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify(
      results.map(({ name, harnessError }) => ({
        name,
        status: harnessError ? "failed" : "passed",
        error: harnessError,
      })),
      null,
      2,
    ),
  );
  if (results.some((r) => r.harnessError)) process.exitCode = 1;
}
run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
