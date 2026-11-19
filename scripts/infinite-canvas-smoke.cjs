const esbuild = require('esbuild');
const fs = require('node:fs');
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const a = '149e2eee-409f-4480-bba3-68da18847df7';
  const b = '249e2eee-409f-4480-bba3-68da18847df7';
  const img = id => ({ id, prompt:'画面 '+id, model:'test', size:'1024x1024', createdAt:'2026-01-01', imageUrl:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>', thumbUrl:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="tan"/></svg>', ...(id === b ? { sourceImageId:a } : {}) });
  const queueB = '349e2eee-409f-4480-bba3-68da18847df7';
  const queueC = '449e2eee-409f-4480-bba3-68da18847df7';
  const imgs = process.env.CANVAS_CAPACITY_TEST
    ? Array.from({length:501}, (_, index) => img(`149e2eee-409f-4480-bba3-${String(index).padStart(12,'0')}`))
    : process.env.CANVAS_QUEUE_TEST
      ? [img(a), img(queueB), img(queueC)]
      : [img(a), img(b)];
  const propImages = process.env.CANVAS_OLD_TARGET_TEST ? imgs.slice(0, 1) : imgs;
  const queueMode = Boolean(process.env.CANVAS_QUEUE_TEST);
  const entry = `import React from 'react'; import {createRoot} from 'react-dom/client'; import InfiniteImageCanvas from './src/components/ImageGen/InfiniteImageCanvas';
  window.calls=[]; window.pending=new Map(); window.abortedIds=[]; window.ignoreAbort=new Set(); window.queueMode=${queueMode};
  const root=createRoot(document.getElementById('root')); window.mount=()=>root.render(<InfiniteImageCanvas accountId="fixture-account" images={${JSON.stringify(propImages)}} onSelect={i=>window.calls.push('select:'+i.id)} onPreview={i=>window.calls.push('preview:'+i.id)} onEdit={i=>window.calls.push('edit:'+i.id)} onGenerate={(id,prompt,references,settings,target,ctx)=>{window.calls.push({kind:'generate',id,prompt,targetId:target?.id||null}); ctx?.signal?.addEventListener('abort',()=>{window.abortedIds.push(id); if(!window.ignoreAbort.has(id)){window.pending.get(id)?.reject(Object.assign(new Error('图片生成已取消'),{name:'AbortError'}));}},{once:true}); if(window.queueMode){return new Promise((resolve,reject)=>{window.pending.set(id,{resolve,reject});});} return undefined;}}/>); window.clear=()=>root.render(null); window.mount();`;
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
  async function dragFirstNodeRight(page, distance = 30) {
    const box=await page.locator('.infinite-image-node__handle').first().boundingBox();
    assert.ok(box);
    const x=box.x+box.width/2;
    const y=box.y+box.height/2;
    await page.mouse.move(x,y);
    await page.mouse.down();
    await page.mouse.move(x+distance,y,{steps:5});
    await page.mouse.up();
  }
  async function connectNodes(page, fromIndex, toIndex) {
    const source=await page.locator('.react-flow__node').nth(fromIndex).locator('.react-flow__handle.source').boundingBox();
    const target=await page.locator('.react-flow__node').nth(toIndex).locator('.react-flow__handle.target').boundingBox();
    assert.ok(source); assert.ok(target);
    await page.mouse.move(source.x+source.width/2,source.y+source.height/2);
    await page.mouse.down();
    await page.mouse.move(target.x+target.width/2,target.y+target.height/2,{steps:8});
    await page.locator('.canvas-manual-connection').waitFor();
    assert.equal(await page.locator('.canvas-manual-connection').count(),1);
    await page.mouse.up();
  }
  async function keyboardConnectNodes(page, fromIndex, toIndex) {
    const nodes=page.locator('.react-flow__node');
    const source=nodes.nth(fromIndex);
    const targetText=await nodes.nth(toIndex).locator('.infinite-image-node__footer>span').innerText();
    await source.getByRole('button',{name:'选择右侧连线端点'}).focus();
    await page.keyboard.press('Enter');
    const dialog=page.getByRole('dialog',{name:'选择连线目标节点'});
    await dialog.waitFor();
    await dialog.getByRole('button').filter({hasText:targetText}).click();
    await dialog.waitFor({state:'detached'});
  }
  const first=await open(); const page=first.page;
  if (process.env.CANVAS_OLD_TARGET_TEST) {
    const oldNode=page.locator('.react-flow__node').filter({hasText:'画面 '+b});
    await oldNode.getByRole('button',{name:'继续修改'}).click();
    await page.getByRole('textbox',{name:'节点提示词'}).fill('继续修改旧作品');
    await page.getByRole('button',{name:'生成变体'}).click();
    await page.waitForFunction(() => window.calls.some(call => call?.kind === 'generate'));
    const generateCall=await page.evaluate(() => window.calls.find(call => call?.kind === 'generate'));
    assert.equal(generateCall.targetId,b);
    assert.deepEqual(first.errors,[]);
    await browser.close(); console.log('canvas old target resolution passed'); return;
  }
  if (process.env.CANVAS_CAPACITY_TEST) {
    await page.getByText('画布最多显示 500 张', {exact:false}).waitFor();
    assert.match(await page.locator('.infinite-image-canvas__notice').innerText(), /还有 1 张作品/);
    await page.getByRole('button',{name:/移出画布：画面/}).first().click();
    await page.getByText('画布已同步', {exact:false}).waitFor();
    assert.equal(saved.nodes.length,500);
    assert.equal(saved.hiddenIds.length,1);
    assert.ok(saved.nodes.some(node => node.id.endsWith('000000000000')));
    assert.equal(saved.nodes.find(node => node.id.endsWith('000000000500')).x,1234);
    assert.deepEqual(first.errors,[]);
    await browser.close(); console.log('canvas capacity notice and replacement passed'); return;
  }
  if (process.env.CANVAS_QUEUE_TEST) {
    assert.equal(await page.locator('.react-flow__node').count(),3);
    const submit = async (promptText) => {
      await page.locator('.react-flow__node').filter({hasText:promptText}).getByRole('button',{name:'继续修改'}).click();
      await page.getByRole('textbox',{name:'节点提示词'}).fill(promptText + ' 变体');
      await page.getByRole('button',{name:'生成变体'}).click();
      await page.locator('.canvas-prompt-panel').waitFor({state:'detached'});
    };
    const queueToggle = page.locator('.canvas-generation-queue__toggle');
    // One node beyond the concurrency limit (2) stays queued.
    await submit('画面 ' + a);
    await submit('画面 ' + queueB);
    await submit('画面 ' + queueC);
    await page.waitForFunction(() => window.pending.size === 2);
    assert.equal(await page.locator('.canvas-generation-status.is-generating').count(),2);
    assert.equal(await page.locator('.canvas-generation-status.is-queued').count(),1);
    assert.match(await queueToggle.innerText(), /正在生成 2 个/);
    assert.match(await queueToggle.innerText(), /排队 1 个/);
    // Cancelling a queued node never starts its request.
    await page.getByRole('status',{name:`画面 ${queueC}生成状态`}).getByRole('button',{name:'停止生成'}).click();
    await page.waitForFunction(() => document.querySelectorAll('.canvas-generation-status.is-queued').length === 0);
    assert.equal(await page.evaluate(() => window.pending.size),2);
    // Cancelling an active node aborts its own signal and frees its slot.
    await page.getByRole('status',{name:`画面 ${a}生成状态`}).getByRole('button',{name:'停止生成'}).click();
    await page.waitForFunction(id => window.abortedIds.includes(id), a);
    await page.waitForFunction(() => document.querySelectorAll('.canvas-generation-status.is-generating').length === 1);
    // Deleting a generating node must discard its late result instead of recreating a node or edge.
    await page.evaluate(id => window.ignoreAbort.add(id), queueB);
    if (await page.locator('.canvas-prompt-panel').count()) {
      await page.keyboard.press('Escape');
      await page.locator('.canvas-prompt-panel').waitFor({state:'detached'});
    }
    await page.locator('.react-flow__node').filter({hasText:'画面 ' + queueB}).getByRole('button',{name:/移出画布/}).click();
    await page.waitForFunction(() => document.querySelectorAll('.react-flow__node').length === 2);
    await page.waitForFunction(id => window.abortedIds.includes(id), queueB);
    await page.getByText('画布已同步').first().waitFor();
    await page.evaluate(([nodeId, result]) => { window.pending.get(nodeId).resolve([result]); }, [queueB, a]);
    await page.waitForTimeout(400);
    assert.equal((saved.connections || []).some(connection => connection.source === queueB),false);
    assert.equal((saved.nodes || []).some(node => node.id === queueB),false);
    assert.equal(await page.locator('.react-flow__node').count(),2);
    // A failed task can be retried independently of the others.
    const generateCallsBefore = await page.evaluate(() => window.calls.filter(call => call.kind === 'generate').length);
    await submit('画面 ' + a);
    await page.waitForFunction(count => window.calls.filter(call => call.kind === 'generate').length > count, generateCallsBefore);
    await page.evaluate(id => { window.pending.get(id).reject(new Error('上游超时')); }, a);
    await page.waitForFunction(() => document.querySelectorAll('.canvas-generation-status.is-error').length === 1);
    assert.match(await queueToggle.innerText(), /失败 1 个/);
    await page.getByRole('status',{name:`画面 ${a}生成状态`}).getByRole('button',{name:'重新生成'}).click();
    await page.waitForFunction(() => document.querySelectorAll('.canvas-generation-status.is-generating').length === 1);
    assert.deepEqual(first.errors,[]);
    await browser.close(); console.log('canvas queue states passed'); return;
  }
  assert.equal(await page.locator('.react-flow__node').count(),2);
  await page.locator('.react-flow__edge').waitFor({ state: "attached" });
  assert.equal(await page.locator('.react-flow__edge').count(),1);
  await page.getByRole('button',{name:'继续修改'}).first().click();
  await page.locator('.canvas-prompt-panel').waitFor();
  assert.deepEqual(await page.evaluate(()=>window.calls),[]);
  assert.equal(await page.getByRole('button',{name:'平移画布'}).getAttribute('aria-pressed'),'true');
  await page.getByRole('button',{name:'选择节点'}).click();
  assert.equal(await page.getByRole('button',{name:'选择节点'}).getAttribute('aria-pressed'),'true');
  await page.getByRole('button',{name:'平移画布'}).click();
  await page.getByRole('button',{name:'关闭提示词面板'}).click();
  await page.locator('.canvas-prompt-panel').waitFor({ state: 'detached' });
  await page.waitForTimeout(120);
  await keyboardConnectNodes(page,1,0);
  await page.waitForFunction(() => document.querySelectorAll('.react-flow__edge').length === 2);
  await page.getByText('画布已同步').waitFor();
  assert.deepEqual(saved.connections.map(({source,target})=>({source,target})),[{source:b,target:a}]);
  await dragFirstNodeRight(page);
  await page.getByText('画布已同步').waitFor();
  assert.deepEqual(saved.connections.map(({source,target})=>({source,target})),[{source:b,target:a}]);
  const firstX=saved.nodes.find(n=>n.id===a).x;
  assert.ok(firstX>0);
  const second=await open();
  await second.page.getByText('画布已同步').waitFor();
  await second.page.waitForTimeout(150);
  assert.equal(await second.page.locator('.react-flow__edge').count(),2);
  assert.match(await second.page.locator('.react-flow__node').first().getAttribute('style'), new RegExp(`translate\\(${firstX}px`));
  await second.page.getByRole('button',{name:'移出画布：画面 '+b}).click();
  await second.page.getByText('画布已同步').waitFor();
  assert.deepEqual(saved.hiddenIds,[b]);
  assert.deepEqual(saved.connections,[]);
  await dragFirstNodeRight(page);
  await page.getByText('其他设备更新了画布，本机改动尚未保存。').waitFor();
  await page.getByRole('button',{name:'加载云端画布'}).click();
  await page.getByText('画布已同步').waitFor();
  assert.equal(await page.locator('.react-flow__node').count(),1);
  await page.getByText('已移出画布（1）').click();
  await page.getByRole('button',{name:'加回：画面 '+b}).click();
  await page.getByText('画布已同步').waitFor();
  assert.equal(await page.locator('.react-flow__node').count(),2);
  assert.deepEqual(saved.hiddenIds,[]);
  await connectNodes(page,1,0);
  await page.getByText('画布已同步').waitFor();
  assert.deepEqual(saved.connections.map(({source,target})=>({source,target})),[{source:b,target:a}]);
  // Another device deletes b without updating this page. Keep a's new position.
  removed.add(b);
  await dragFirstNodeRight(page);
  await page.waitForFunction(() => document.querySelectorAll('.react-flow__node').length === 1);
  await page.getByText('画布已同步').waitFor();
  assert.equal(saved.nodes.some(node => node.id === b), false);
  assert.deepEqual(saved.connections,[]);
  const secondX=saved.nodes.find(node => node.id === a).x;
  assert.ok(secondX>firstX);
  // Leaving a client-side route before the debounce must not lose the drag.
  await dragFirstNodeRight(page);
  await page.evaluate(() => window.clear());
  await page.waitForSelector('.react-flow__node',{state:'detached'});
  // Cloud changes while the local unsaved draft is away.
  saved={...saved,revision:saved.revision+1,nodes:saved.nodes.map(node=>node.id===a?{...node,x:500}:node)};
  await page.evaluate(() => window.mount());
  await page.waitForSelector('.react-flow__node');
  await page.getByText('其他设备更新了画布，本机改动尚未保存。').waitFor();
  const localStyle=await page.locator('.react-flow__node').first().getAttribute('style');
  const localX=Number(/translate\(([-\d.]+)px/.exec(localStyle || '')?.[1]);
  assert.ok(localX>secondX);
  await page.getByRole('button',{name:'保留本机布局'}).click();
  await page.getByText('画布已同步').waitFor();
  assert.equal(saved.nodes.find(node => node.id === a).x,localX);
  await page.getByRole('button',{name:/^\+ 文本节点/}).click();
  const textNode=page.locator('.infinite-text-node');
  await textNode.waitFor();
  await textNode.getByRole('textbox',{name:'文本节点内容'}).fill('最终提示词');
  await page.getByText('画布已同步').waitFor();
  const textLayout=saved.nodes.find(node=>node.kind==='text');
  assert.ok(textLayout);
  assert.equal(textLayout.text,'最终提示词');
  const third=await open();
  await third.page.locator('.infinite-text-node').waitFor();
  assert.equal(await third.page.getByRole('textbox',{name:'文本节点内容'}).inputValue(),'最终提示词');
  assert.deepEqual(first.errors,[]); assert.deepEqual(second.errors,[]); assert.deepEqual(third.errors,[]);
  await third.page.getByRole('button',{name:/^\+ 文本节点/}).click();
  const sourceBox = await third.page.locator('.infinite-text-node').last().locator('.react-flow__handle.source').boundingBox();
  assert.ok(sourceBox);
  await third.page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await third.page.mouse.down();
  await third.page.mouse.move(980, 650, { steps: 8 });
  await third.page.mouse.up();
  await third.page.getByRole('menu', { name:'从连接处创建节点' }).waitFor();
  await third.page.getByRole('menuitem', { name:/文本节点/ }).click();
  await third.page.locator('.infinite-text-node').nth(1).waitFor();
  assert.equal(await third.page.locator('.react-flow__edge').count(), 1);
  if (process.env.CANVAS_SCREENSHOT) await page.screenshot({path:process.env.CANVAS_SCREENSHOT});
  await browser.close(); console.log('canvas persistence, conflicts and interactions passed');
})().catch(e=>{console.error(e); process.exitCode=1});
