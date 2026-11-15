const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const { chromium } = require('playwright');

(async () => {
  const entry = `
    import React, {useState} from 'react';
    import {createRoot} from 'react-dom/client';
    import ImagePreviewModal from './src/components/ImageGen/ImagePreviewModal';
    const thumb='data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="32" height="32"%3E%3Crect width="32" height="32" fill="tan"/%3E%3C/svg%3E';
    const record={id:'a',prompt:'sample',imageUrl:'/api/images/a.png',thumbUrl:thumb,size:'32x32',model:'test',createdAt:'2026-01-01'};
    function App(){const [image,setImage]=useState(record);window.__showNoThumb=()=>setImage({...record,id:'b',imageUrl:'/api/images/no-thumb.png',thumbUrl:undefined});window.__showExternal=()=>setImage({...record,id:'c',imageUrl:'https://fixture.invalid/external.png'});return <ImagePreviewModal image={image} onClose={()=>{}} onContinueEditing={()=>{}} onDelete={()=>{}}/>}
    createRoot(document.getElementById('root')).render(<App/>);
  `;
  const js = (await esbuild.build({stdin:{contents:entry,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',tsconfig:'tsconfig.json'})).outputFiles[0].text;
  const browser = await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE || undefined});
  try {
    const page = await browser.newPage();
    let directAttempts = 0;
    let externalAttempts = 0;
    await page.route('https://fixture.invalid/external.png', route => {
      externalAttempts++;
      if (externalAttempts === 1) return route.fulfill({status:503, body:''});
      return route.fulfill({status:200, contentType:'image/png', body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=','base64')});
    });
    await page.route('https://fixture.invalid/api/images/no-thumb.png', route => {
      directAttempts++;
      if (directAttempts === 1) return route.fulfill({status:503, body:''});
      return route.fulfill({status:200, contentType:'image/png', body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=','base64')});
    });
    await page.setContent('<base href="https://fixture.invalid/"><div id="root"></div>');
    await page.evaluate(() => {
      window.__attempts = 0;
      window.fetch = async () => {
        window.__attempts++;
        if (window.__attempts === 1) return new Response(null, {status:503});
        if (window.__attempts === 2) return new Response(new Blob(['broken image'], {type:'image/png'}));
        const bytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII='), c => c.charCodeAt(0));
        return new Response(new Blob([bytes], {type:'image/png'}));
      };
    });
    await page.addScriptTag({content:js});
    const retry = page.getByRole('button',{name:'重新加载原图'});
    await retry.waitFor({state:'visible',timeout:5000});
    assert.equal(await page.evaluate(()=>window.__attempts),1);
    await retry.focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => Boolean(document.activeElement?.closest('dialog[open]'))), true);
    await page.waitForFunction(() => window.__attempts === 2);
    await retry.waitFor({state:'visible',timeout:5000});
    await retry.click();
    await page.waitForFunction(() => window.__attempts === 3);
    await page.waitForFunction(() => {
      const img = document.querySelector('img[aria-hidden="true"]');
      return img && img.complete && img.naturalWidth > 0 && img.style.opacity === '1';
    });
    await retry.waitFor({state:'hidden',timeout:5000});
    await page.evaluate(() => window.__showNoThumb());
    await retry.waitFor({state:'visible',timeout:5000});
    await retry.click();
    await page.waitForFunction(() => {
      const img = document.querySelector('img[src="/api/images/no-thumb.png"]');
      return img && img.complete && img.naturalWidth > 0;
    });
    assert.equal(directAttempts, 2);
    await page.evaluate(() => window.__showExternal());
    await retry.waitFor({state:'visible',timeout:5000});
    await retry.click();
    await page.waitForFunction(() => {
      const img = document.querySelector('img[src="https://fixture.invalid/external.png"]');
      return img && img.complete && img.naturalWidth > 0 && img.style.opacity === '1';
    }, null, {timeout:5000});
    assert.equal(externalAttempts, 2);
    console.log('Original image failure and retry passed');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1});
