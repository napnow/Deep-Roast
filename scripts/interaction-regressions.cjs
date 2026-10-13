/* eslint-disable @typescript-eslint/no-require-imports -- Standalone local browser regression CLI. */
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const REPO = path.resolve(__dirname, "..");
const OUTPUT =
  process.env.INTERACTION_TEST_OUTPUT ||
  path.join(REPO, ".uiux-test-results", "interactions");
const esbuild = require("esbuild");
const tailwind = require("@tailwindcss/node");
const { chromium } = require("playwright");
const entry =
  "\nimport React,{useState} from 'react';import {createRoot} from 'react-dom/client';\nimport AssetInspector from '@/components/ImageGen/AssetInspector';\nimport ImagePreviewModal from '@/components/ImageGen/ImagePreviewModal';\nimport ResultCanvas from '@/components/ImageGen/ResultCanvas';import ChatView from '@/components/Chat/ChatView';\nimport CreditWalletModal from '@/components/CreditWalletModal';import SettingsModal from '@/components/Settings/SettingsModal';\nimport ApiKeysModal from '@/components/ApiKeysModal';import DonationModal from '@/components/DonationModal';\nimport ImageActionMenu from '@/components/ImageGen/ImageActionMenu';import {ToastProvider,useToast} from '@/components/Toast';\nimport {useDeepRoastStore} from '@/lib/store';\nconst pixel='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=';\nconst image={id:'fixture-image',prompt:'温暖的陶瓷杯',imageUrl:'data:image/png;base64,'+pixel,size:'1024x1024',model:'gpt-image-2',createdAt:'2026-09-13T01:00:00Z'};\nconst config={baseUrl:'',arkApiKey:'',hasApiKey:false,textModel:'fixture-text',imageModel:'gpt-image-2',channels:[],imageSystemPrompt:'',assistantImagePrompt:'',reversePromptModel:''};\nwindow.__donationFails=false;window.__walletRecords=[];window.__walletPending=[];window.__walletDeferred=false;window.__calls=[];window.__downloads=[];window.__unexpected=[];window.__copyMode='pending';window.__downloadMode='pending';\nwindow.__store=useDeepRoastStore;useDeepRoastStore.getState().setUserSession('fixture-A');\nObject.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>new Promise((resolve,reject)=>{window.__resolveCopy=resolve;window.__rejectCopy=()=>reject(new Error('clipboard denied'));if(window.__copyMode==='success')resolve();})}});\nHTMLAnchorElement.prototype.click=function(){window.__downloads.push(this.download);};\nwindow.fetch=async(input,init={})=>{\n const url=String(input);\n if(url===image.imageUrl)return new Promise(resolve=>{window.__resolveDownload=(status=200,mislabeled=false)=>resolve(new Response(status===200&&!mislabeled?Uint8Array.from(atob(pixel),c=>c.charCodeAt(0)):JSON.stringify({error:'denied'}),{status,headers:{'Content-Type':status===200?'image/png':'application/json'}}));});\n if(url==='/api/credits/transactions'){if(window.__walletDeferred)return new Promise(resolve=>window.__walletPending.push((note)=>resolve(Response.json([{id:note,type:'consume',amount:-1,note}]))));return Response.json(window.__walletRecords);}\n if(url==='/api/public/donation')return window.__donationFails?Response.json({error:'optional unavailable'},{status:503}):Response.json({enabled:true,text:'演示支持信息',imageUrl:null});\n if(url==='/api/user/invitations')return Response.json({eligible:false});\n if(url==='/api/user/api-keys')return Response.json({keys:[]});\n if(url.includes('/styles'))return Response.json([]);\n window.__unexpected.push(url);throw Error('Unexpected fixture request: '+url);\n};\nfunction Harness(){\n const [mode,setMode]=useState('result'),[open,setOpen]=useState(false),[stream,setStream]=useState(''),[conversation,setConversation]=useState('first');\n window.__mode=setMode;window.__stream=setStream;window.__conversation=setConversation;window.__open=setOpen;\n const {toast}=useToast();window.__toast=toast;\n const task=mode==='credits'?{status:'error',startedAt:null,request:null,resultIds:[],error:{kind:'credits',message:'积分不足'}}:{status:'success',startedAt:null,request:null,resultIds:[image.id],error:null};\n const messages=Array.from({length:40},(_,i)=>({id:String(i),role:i%2?'assistant':'user',content:('第'+i+'条历史消息，保留阅读位置。').repeat(10),createdAt:'2026-09-13'}));\n return <div style={{height:'100dvh',display:'flex',flexDirection:'column'}}><button id=\"outside\">测试外部按钮</button>\n {['result','credits'].includes(mode)&&<ResultCanvas task={task} activeImage={image} results={[image]} elapsedSeconds={0} lastGenTime={null} onPreview={()=>{}} onContinueEditing={()=>{}} onRetry={()=>window.__calls.push('retry')} onStop={()=>{}} onClose={()=>window.__calls.push('close')} onWalletClick={()=>window.__calls.push('wallet')}/>}\n {mode==='chat'&&<ChatView conversationId={conversation} messages={messages} streaming={!!stream} streamingText={stream} onSend={text=>window.__calls.push(text)} onStop={()=>window.__calls.push('stop')}/>}\n {mode==='assets'&&<AssetInspector forceExpanded history={[image]} activeImage={image} onSelect={()=>{}} onContinueEditing={()=>{}} onDelete={id=>window.__calls.push(['delete',id])}/>}\n {mode==='menu'&&<div style={{margin:40}}><ImageActionMenu onDelete={()=>window.__calls.push('delete')}/></div>}\n {['wallet','settings','keys','donation','preview'].includes(mode)&&<button id=\"open-modal\" onClick={()=>setOpen(true)}>打开面板</button>}\n <ImagePreviewModal image={mode==='preview'&&open?image:null} onClose={()=>setOpen(false)} onDelete={()=>{}} onContinueEditing={()=>{}}/>\n <CreditWalletModal open={mode==='wallet'&&open} onClose={()=>setOpen(false)} credits={50} role=\"user\" imageModel=\"gpt-image-2\" imageModelCosts={{'gpt-image-2':12}} checkinReward={1} checkinEligible={false} todayChecked onCheckinClick={()=>{}}/>\n <SettingsModal open={mode==='settings'&&open} onClose={()=>setOpen(false)} config={config} onSave={async()=>{window.__calls.push('save');}}/>\n <ApiKeysModal open={mode==='keys'&&open} onClose={()=>setOpen(false)}/>\n <DonationModal open={mode==='donation'&&open} onClose={()=>setOpen(false)}/>\n </div>;\n}\nconst root=createRoot(document.getElementById('root'));window.__unmount=()=>root.render(null);root.render(<ToastProvider><Harness/></ToastProvider>);\n";
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
            if (args.path === "src/components/AuthProvider.tsx")
              return {
                contents:
                  "export const useAuth=()=>({user:{id:'fixture-A',role:'user',username:'fixture'},loading:false});",
                loader: "tsx",
              };
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

async function run() {
  fs.mkdirSync(OUTPUT, { recursive: true });
  const bundle = await build();
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_EXECUTABLE,
  });
  const results = [];
  async function check(name, fn, width = 1024) {
    const context = await browser.newContext({
      viewport: { width, height: 800 },
      reducedMotion: "reduce",
      serviceWorkers: "block",
    });
    const real = [];
    await context.route("**/*", (r) => {
      real.push(r.request().url());
      return r.abort();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(2000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    try {
      await page.setContent(
        '<html lang="zh-CN"><head></head><body><div id="root"></div></body></html>',
      );
      await page.addStyleTag({ content: bundle.css });
      await page.addScriptTag({ content: bundle.js });
      await page.locator("#outside").waitFor();
      await fn(page);
      assert.deepEqual(real, []);
      assert.deepEqual(await page.evaluate(() => window.__unexpected), []);
      assert.deepEqual(errors, []);
      results.push({ name, passed: true });
    } catch (e) {
      results.push({
        name,
        passed: false,
        error: e.message,
        pageErrors: errors,
      });
      await page.screenshot({ path: path.join(OUTPUT, name + ".png") });
    } finally {
      await context.close();
    }
  }
  const mode = async (page, value) => {
    await page.evaluate((m) => window.__mode(m), value);
    await page.waitForTimeout(60);
  };
  await check("copy-awaits-result", async (p) => {
    await p.getByRole("button", { name: "复制提示词", exact: true }).click();
    assert.equal(
      await p.getByRole("button", { name: "已复制", exact: true }).count(),
      0,
    );
    await p.evaluate(() => window.__resolveCopy());
    await p.getByRole("button", { name: "已复制", exact: true }).waitFor();
  });
  await check("copy-rejection-is-not-success", async (p) => {
    await p.getByRole("button", { name: "复制提示词", exact: true }).click();
    await p.evaluate(() => window.__rejectCopy());
    await p.getByRole("alert").waitFor();
    assert.equal(
      await p.getByRole("button", { name: "已复制", exact: true }).count(),
      0,
    );
  });
  await check("download-awaits-http-success", async (p) => {
    await p.getByRole("button", { name: "下载图片", exact: true }).click();
    assert.equal(
      await p.getByRole("button", { name: "已下载", exact: true }).count(),
      0,
    );
    assert.deepEqual(await p.evaluate(() => window.__downloads), []);
    await p.evaluate(() => window.__resolveDownload(401));
    await p.getByRole("alert").waitFor();
    assert.deepEqual(await p.evaluate(() => window.__downloads), []);
  });
  await check("download-honest-success-label", async (p) => {
    await p.getByRole("button", { name: "下载图片", exact: true }).click();
    await p.evaluate(() => window.__resolveDownload(200));
    await p.getByText("已发起下载", { exact: true }).first().waitFor();
    assert.equal((await p.evaluate(() => window.__downloads)).length, 1);
  });
  await check("copy-session-invalidation", async (p) => {
    await p.getByRole("button", { name: "复制提示词", exact: true }).click();
    await p.evaluate(() => {
      window.__store.getState().setUserSession("fixture-B");
      window.__resolveCopy();
    });
    await p.waitForTimeout(80);
    assert.equal(
      await p.getByRole("button", { name: "已复制", exact: true }).count(),
      0,
    );
    assert.equal(await p.getByText("提示词已复制", { exact: true }).count(), 0);
  });
  await check("ime-enter-does-not-send", async (p) => {
    await mode(p, "chat");
    const field = p.locator("textarea");
    await field.fill("中文输入中");
    await field.dispatchEvent("compositionstart");
    await field.dispatchEvent("keydown", {
      key: "Enter",
      code: "Enter",
      keyCode: 229,
      isComposing: true,
    });
    assert.deepEqual(await p.evaluate(() => window.__calls), []);
    await field.dispatchEvent("compositionend");
    await field.press("Enter");
    assert.deepEqual(await p.evaluate(() => window.__calls), ["中文输入中"]);
  });
  await check("reader-keeps-history-position", async (p) => {
    await mode(p, "chat");
    const scroll = p.locator(".overflow-y-auto").first();
    await scroll.evaluate((e) => {
      e.scrollTop = 0;
      e.dispatchEvent(new Event("scroll"));
    });
    await p.evaluate(() => window.__stream("新增回复正在流式输出"));
    await p.waitForTimeout(400);
    assert.ok(
      (await scroll.evaluate((e) => e.scrollTop)) < 30,
      "Streaming pulled reader away from history",
    );
    await p.getByRole("button", { name: "回到最新消息" }).click();
    await p.waitForTimeout(80);
    assert.ok(
      (await scroll.evaluate(
        (e) => e.scrollHeight - e.clientHeight - e.scrollTop,
      )) < 80,
    );
    await p.evaluate(() => window.__conversation("second"));
  });
  for (const action of ["escape", "outside"])
    await check("menu-close-" + action, async (p) => {
      await mode(p, "menu");
      const trigger = p.getByRole("button", { name: "更多图片操作" });
      await trigger.click();
      await p.getByRole("button", { name: "删除图片" }).waitFor();
      if (action === "escape") await p.keyboard.press("Escape");
      else await p.locator("#outside").click();
      assert.equal(
        await p.getByRole("button", { name: "删除图片" }).count(),
        0,
      );
      if (action === "escape")
        assert.ok(await trigger.evaluate((e) => e === document.activeElement));
    });
  for (const kind of ["wallet", "settings", "keys", "donation"])
    await check(
      "modal-escape-" + kind,
      async (p) => {
        await mode(p, kind);
        await p.locator("#open-modal").click();
        await p.waitForTimeout(60);
        assert.equal(await p.locator("dialog[open]").count(), 1);
        await p.keyboard.press("Escape");
        assert.equal(await p.locator("dialog[open]").count(), 0);
        assert.ok(
          await p
            .locator("#open-modal")
            .evaluate((e) => e === document.activeElement),
        );
        assert.equal(await p.evaluate(() => document.body.style.position), "");
      },
      390,
    );
  await check("settings-discard-confirmation", async (p) => {
    await mode(p, "settings");
    await p.locator("#open-modal").click();
    await p.locator("textarea").first().fill("未保存的改动");
    await p.keyboard.press("Escape");
    await p.getByRole("dialog", { name: "放弃未保存的修改？" }).waitFor();
    await p.getByRole("button", { name: "继续编辑", exact: true }).click();
    assert.equal(
      await p.locator("textarea").first().inputValue(),
      "未保存的改动",
    );
    await p.keyboard.press("Escape");
    await p.getByRole("button", { name: "放弃修改", exact: true }).click();
    assert.equal(await p.locator("dialog[open]").count(), 0);
  });
  await check(
    "toast-visible-in-active-dialog",
    async (p) => {
      await mode(p, "wallet");
      await p.locator("#open-modal").click();
      await p.evaluate(() => window.__toast("需要读完的错误消息", "error"));
      await p.getByText("需要读完的错误消息").waitFor();
      assert.ok(
        await p
          .getByText("需要读完的错误消息")
          .evaluate((e) => !!e.closest("dialog[open]")),
      );
      await p.waitForTimeout(3300);
      await p.getByText("需要读完的错误消息").waitFor();
      await p.getByRole("button", { name: "关闭通知" }).click();
    },
    390,
  );
  await check("credits-error-has-recovery-action", async (p) => {
    await mode(p, "credits");
    await p.getByRole("button", { name: "查看积分", exact: true }).click();
    assert.deepEqual(await p.evaluate(() => window.__calls), ["wallet"]);
    assert.equal(
      await p.getByRole("button", { name: "重新生成", exact: true }).count(),
      0,
    );
  });

  await check("wallet-ignores-late-closed-response", async (p) => {
    await mode(p, "wallet");
    await p.evaluate(() => (window.__walletDeferred = true));
    await p.locator("#open-modal").click();
    await p.waitForFunction(() => window.__walletPending.length === 1);
    await p.keyboard.press("Escape");
    await p.locator("#open-modal").click();
    await p.waitForFunction(() => window.__walletPending.length === 2);
    await p.evaluate(() => window.__walletPending[1]("本次打开记录"));
    await p.getByText("本次打开记录").waitFor();
    await p.evaluate(() => window.__walletPending[0]("旧窗口迟到记录"));
    await p.waitForTimeout(100);
    assert.equal(await p.getByText("旧窗口迟到记录").count(), 0);
  });
  await check("asset-delete-uses-native-confirmation", async (p) => {
    await mode(p, "assets");
    await p.getByRole("button", { name: "删除图片：温暖的陶瓷杯" }).click();
    await p.getByRole("dialog", { name: "删除图片", exact: true }).waitFor();
    await p.getByRole("button", { name: "取消", exact: true }).click();
    assert.deepEqual(await p.evaluate(() => window.__calls), []);
  });
  await check("chat-shift-enter-preserves-newline", async (p) => {
    await mode(p, "chat");
    const field = p.locator("textarea");
    await field.fill("第一行");
    await field.press("Shift+Enter");
    await field.press("a");
    assert.deepEqual(await p.evaluate(() => window.__calls), []);
    assert.ok((await field.inputValue()).includes("\n"));
  });
  await check("menu-keyboard-focus", async (p) => {
    await mode(p, "menu");
    const trigger = p.getByRole("button", { name: "更多图片操作" });
    await trigger.focus();
    await p.keyboard.press("ArrowDown");
    await p.waitForTimeout(50);
    assert.ok(
      await p
        .getByRole("button", { name: "删除图片" })
        .evaluate((e) => e === document.activeElement),
    );
    await p.keyboard.press("Escape");
    assert.ok(await trigger.evaluate((e) => e === document.activeElement));
  });

  await check("preview-reopen-resets-pending-download", async (p) => {
    await mode(p, "preview");
    await p.locator("#open-modal").click();
    await p.getByRole("button", { name: "下载", exact: true }).click();
    await p.keyboard.press("Escape");
    await p.locator("#open-modal").click();
    assert.equal(
      await p.getByRole("button", { name: "下载", exact: true }).isEnabled(),
      true,
    );
  });
  await check("returning-conversation-resets-copy", async (p) => {
    await mode(p, "chat");
    await p.getByRole("button", { name: "复制", exact: true }).last().click();
    await p.evaluate(() => window.__conversation("second"));
    await p.waitForTimeout(30);
    await p.evaluate(() => window.__conversation("first"));
    await p.waitForTimeout(30);
    assert.equal(
      await p
        .getByRole("button", { name: "复制", exact: true })
        .last()
        .isEnabled(),
      true,
    );
  });
  await check("mislabeled-error-body-is-not-an-image", async (p) => {
    await p.getByRole("button", { name: "下载图片", exact: true }).click();
    await p.evaluate(() => window.__resolveDownload(200, true));
    await p.locator(".ui-toast[role=alert]").waitFor();
    assert.deepEqual(await p.evaluate(() => window.__downloads), []);
  });

  await check("api-copy-fallback-is-inside-dialog", async (p) => {
    await mode(p, "keys");
    await p.locator("#open-modal").click();
    await p.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: undefined,
      });
      document.execCommand = () => {
        const e = document.activeElement;
        window.__fallbackInDialog =
          !!e?.closest("dialog[open]") &&
          e.tagName === "TEXTAREA" &&
          e.selectionEnd > e.selectionStart;
        return window.__fallbackInDialog;
      };
    });
    await p.getByRole("button", { name: "复制示例", exact: true }).click();
    assert.equal(await p.evaluate(() => window.__fallbackInDialog), true);
  });
  await check("api-backdrop-dismisses", async (p) => {
    await mode(p, "keys");
    await p.locator("#open-modal").click();
    await p.mouse.click(4, 4);
    assert.equal(await p.locator("dialog[open]").count(), 0);
  });
  await check("optional-wallet-fetch-does-not-hide-records", async (p) => {
    await mode(p, "wallet");
    await p.evaluate(() => {
      window.__donationFails = true;
      window.__walletRecords = [
        { id: "record", type: "consume", amount: -1, note: "有效积分流水" },
      ];
    });
    await p.locator("#open-modal").click();
    await p.getByText("有效积分流水", { exact: true }).waitFor();
  });
  await check("unread-error-survives-later-notices", async (p) => {
    await p.evaluate(() => window.__toast("必须保留的错误", "error"));
    await p.getByText("必须保留的错误").waitFor();
    await p.evaluate(() => {
      for (let i = 0; i < 4; i++) window.__toast("后续成功" + i, "success");
    });
    await p.waitForTimeout(60);
    await p.getByText("必须保留的错误").waitFor();
  });

  await browser.close();
  fs.writeFileSync(
    path.join(OUTPUT, "results.json"),
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results, null, 2));
  if (results.some((x) => !x.passed)) process.exitCode = 1;
}
run().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
