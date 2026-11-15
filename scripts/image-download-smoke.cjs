const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const esbuild = require('esbuild');

(async () => {
  const js = (await esbuild.build({ stdin: { contents: `import {downloadImage} from './src/components/ImageGen/imageUtils'; import {getSessionImage} from './src/lib/image-transfer'; window.__preload=()=>getSessionImage('/api/images/test.png'); document.querySelector('#go').onclick=()=>downloadImage({id:'fixture',imageUrl:'/api/images/test.png',prompt:'test'}).catch(e=>document.querySelector('#error').textContent=e.message)`, resolveDir: process.cwd(), loader: 'ts' }, bundle:true, write:false, platform:'browser', format:'iife', tsconfig:'tsconfig.json' })).outputFiles[0].text;
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=', 'base64');
  let denied = false, downloads = 0;
  const server = http.createServer((req,res) => {
    if (req.url === '/') {res.setHeader('Content-Type','text/html'); return res.end('<button id="go">下载</button><span id="error"></span><script src="/fixture.js"></script>');}
    if (req.url === '/fixture.js') {res.setHeader('Content-Type','text/javascript'); return res.end(js);}
    if (req.url === '/api/images/test.png?download=check') {res.writeHead(denied ? 403 : 204, {'Cache-Control':'private, no-store'}); return res.end();}
    if (req.url === '/api/images/test.png') { downloads++; res.writeHead(200, {'Content-Type':'image/png'}); return res.end(png); }
    res.writeHead(404); res.end();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  const browser = await chromium.launch({headless:true, ...(executablePath ? {executablePath} : {})});
  try {
    const page = await browser.newPage({acceptDownloads:true});
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.evaluate(() => window.__preload());
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#go').click()]);
    assert.equal(download.suggestedFilename(),'DeepRoast-fixture.png');
    assert.equal(await download.failure(), null);
    assert.equal(downloads, 1);
    denied = true;
    await page.locator('#go').click();
    await page.waitForFunction(() => document.querySelector('#error').textContent.includes('权限'));
    assert.equal(downloads, 1);
    console.log('browser download and denied preflight passed');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
