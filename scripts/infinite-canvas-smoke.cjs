const esbuild = require('esbuild');
const fs = require('node:fs');
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const a = '149e2eee-409f-4480-bba3-68da18847df7';
  const b = '249e2eee-409f-4480-bba3-68da18847df7';
  const img = id => ({ id, prompt:'画面 '+id, model:'test', size:'1024x1024', createdAt:'2026-01-01', imageUrl:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>', thumbUrl:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="tan"/></svg>', ...(id === b ? { sourceImageId:a } : {}) });
  const imgs = process.env.CANVAS_CAPACITY_TEST
    ? Array.from({length:501}, (_, index) => img(`149e2eee-409f-4480-bba3-${String(index).padStart(12,'0')}`))
    : [img(a), img(b)];
  const entry = `import React from 'react'; import {createRoot} from 'react-dom/client'; import InfiniteImageCanvas from './src/components/ImageGen/InfiniteImageCanvas';
  window.calls=[]; const root=createRoot(document.getElementById('root')); window.mount=()=>root.render(<InfiniteImageCanvas accountId="fixture-account" images={${JSON.stringify(imgs)}} onSelect={i=>window.calls.push('select:'+i.id)} onPreview={i=>window.calls.push('preview:'+i.id)} onEdit={i=>window.calls.push('edit:'+i.id)}/>); window.clear=()=>root.render(null); window.mount();`;
  const out = await esbuild.build({stdin:{contents:entry,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',outdir:'out',jsx:'automatic'});
  const js=out.outputFiles.find(f=>f.path.endsWith('.js')).text;
  const css=fs.readFileSync('node_modules/@xyflow/react/dist/style.css','utf8') + (out.outputFiles.find(f=>f.path.endsWith('.css'))?.text ?? '') + fs.readFileSync('src/app/studio-preview.css','utf8');
  const browser=await chromium.launch({headless:true, executablePath:process.env.BROWSER_EXECUTABLE || undefined});
  const context=await browser.newContext({viewport:{width:1400,height:900}});
  let saved=process.env.CANVAS_CAPACITY_TEST ? {revision:1, nodes:imgs.slice(1).map((image,index)=>({id:image.id,x:index===499?1234:(index%25)*400,y:Math.floor(index/25)*500})), hiddenIds:[], viewport:{x:0,y:0,zoom:1}} : null;
  const removed = new Set();
  let delayNextGet = false;
  await context.route('http://canvas.test/**', async route => {
    const request=route.request();
    if (request.url().endsWith('/api/image-canvas')) {
      if (request.method()==='GET') {
        if (delayNextGet) { delayNextGet=false; await new Promise(resolve=>setTimeout(resolve,700)); }
        return route.fulfill({json:{layout:saved,images:imgs.filter(image => !removed.has(image.id))}});
      }
      if (request.method()==='POST') return route.fulfill({json:{images:imgs.filter(image => request.postDataJSON().ids.includes(image.id) && !removed.has(image.id))}});
      const body=request.postDataJSON();
      const missingIds = [...body.nodes.map(node => node.id), ...body.hiddenIds].filter(id => removed.has(id));
      if (missingIds.length) return route.fulfill({status:400,json:{error:'missing',code:'INVALID_CANVAS_IMAGE',missingIds}});
      if (body.revision !== (saved?.revision || 0)) return route.fulfill({status:409,json:{error:'conflict',code:'CANVAS_CONFLICT'}});
      saved={...body,revision:body.revision+1};
      return route.fulfill({json:{revision:saved.revision}});
    }
    return route.fulfill({contentType:'text/html',body:'<style>html,body,#root{height:100%;margin:0}</style><div id="root"></div>'});
  });
  async function open() {
    const page=await context.newPage();
    const errors=[]; page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://canvas.test/');
    await page.addStyleTag({content:css}); await page.addScriptTag({content:js});
    await page.waitForSelector('.react-flow__node');
    return {page,errors};
  }
  const first=await open(); const page=first.page;
  if (process.env.CANVAS_CAPACITY_TEST) {
    await page.getByText('画布最多显示 500 张', {exact:false}).waitFor();
    assert.match(await page.locator('.infinite-image-canvas__status').innerText(), /还有 1 张作品/);
    await page.getByRole('button',{name:/移出画布：画面/}).first().click();
    await page.getByText('画布已同步', {exact:false}).waitFor();
    assert.equal(saved.nodes.length,500);
    assert.equal(saved.hiddenIds.length,1);
    assert.ok(saved.nodes.some(node => node.id.endsWith('000000000000')));
    assert.equal(saved.nodes.find(node => node.id.endsWith('000000000500')).x,1234);
    assert.deepEqual(first.errors,[]);
    await browser.close(); console.log('canvas capacity notice and replacement passed'); return;
  }
  assert.equal(await page.locator('.react-flow__node').count(),2);
  await page.locator('.react-flow__edge').waitFor({ state: "attached" });
  assert.equal(await page.locator('.react-flow__edge').count(),1);
  await page.getByRole('button',{name:'继续修改'}).first().click();
  assert.deepEqual(await page.evaluate(()=>window.calls),['edit:'+a]);
  const node=page.locator('.react-flow__node').first(); const before=await node.getAttribute('style');
  await page.getByRole('button',{name:'向右移动作品'}).first().click();
  await page.waitForFunction(old => document.querySelector('.react-flow__node')?.getAttribute('style') !== old,before);
  await page.getByText('画布已同步').waitFor();
  assert.equal(saved.nodes.find(n=>n.id===a).x,30);
  const second=await open();
  assert.match(await second.page.locator('.react-flow__node').first().getAttribute('style'), /translate\(30px/);
  await second.page.getByRole('button',{name:'移出画布：画面 '+b}).click();
  await second.page.getByText('画布已同步').waitFor();
  assert.deepEqual(saved.hiddenIds,[b]);
  await page.getByRole('button',{name:'向右移动作品'}).first().click();
  await page.getByText('其他设备更新了画布，本机改动尚未保存。').waitFor();
  await page.getByRole('button',{name:'放弃本机更改并加载其他设备画布'}).click();
  await page.getByText('画布已同步').waitFor();
  assert.equal(await page.locator('.react-flow__node').count(),1);
  await page.getByText('已移出画布（1）').click();
  await page.getByRole('button',{name:'加回：画面 '+b}).click();
  await page.getByText('画布已同步').waitFor();
  assert.equal(await page.locator('.react-flow__node').count(),2);
  assert.deepEqual(saved.hiddenIds,[]);
  // Another device deletes b without updating this page. Keep a's new position.
  removed.add(b);
  await page.getByRole('button',{name:'向右移动作品'}).first().click();
  await page.waitForFunction(() => document.querySelectorAll('.react-flow__node').length === 1);
  await page.getByText('画布已同步').waitFor();
  assert.equal(saved.nodes.some(node => node.id === b), false);
  assert.equal(saved.nodes.find(node => node.id === a).x,60);
  // Leaving a client-side route before the debounce must not lose the drag.
  await page.getByRole('button',{name:'向右移动作品'}).first().click();
  await page.evaluate(() => window.clear());
  await page.waitForSelector('.react-flow__node',{state:'detached'});
  // Cloud changes while the local unsaved draft is away.
  saved={...saved,revision:saved.revision+1,nodes:saved.nodes.map(node=>node.id===a?{...node,x:500}:node)};
  await page.evaluate(() => window.mount());
  await page.waitForSelector('.react-flow__node');
  await page.getByText('其他设备更新了画布，本机改动尚未保存。').waitFor();
  assert.match(await page.locator('.react-flow__node').first().getAttribute('style'), /translate\(90px/);
  await page.getByRole('button',{name:'保留本机布局并覆盖云端'}).click();
  await page.getByText('画布已同步').waitFor();
  assert.equal(saved.nodes.find(node => node.id === a).x,90);
  assert.deepEqual(first.errors,[]); assert.deepEqual(second.errors,[]);
  if (process.env.CANVAS_SCREENSHOT) await page.screenshot({path:process.env.CANVAS_SCREENSHOT});
  await browser.close(); console.log('canvas persistence, conflicts and interactions passed');
})().catch(e=>{console.error(e); process.exitCode=1});
