const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

(async () => {
  const css = fs.readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
  const previewCss = [
    ...css.matchAll(/^\.preview-image-container[^}]*}|^\.preview-progressive-image(?: img)?[^}]*}|^\.image-preview-modal__stage img[^}]*}/gm),
  ].map((match) => match[0]).join("\n");
  assert.match(previewCss, /preview-image-container/);
  assert.match(previewCss, /image-preview-modal__stage img/);

  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 700 } });
    await page.setContent(`<!doctype html><html><head><style>
      * { box-sizing: border-box; }
      body { margin: 0; }
      .stage { width: 100vw; height: 600px; display: flex; align-items: center; justify-content: center; }
      .w-full { width: 100%; }
      .h-full { height: 100%; }
      ${previewCss}
    </style></head><body><div class="stage">
      <div class="preview-image-container">
        <div class="preview-progressive-image">
          <img class="w-full h-full" alt="" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024'%3E%3Crect width='1024' height='1024' fill='%23c66'/%3E%3C/svg%3E">
        </div>
      </div>
    </div></body></html>`);
    const result = await page.locator("img").evaluate((image) => {
      const rect = image.getBoundingClientRect();
      return { left: rect.left, width: rect.width, height: rect.height, objectFit: getComputedStyle(image).objectFit };
    });
    assert.equal(result.objectFit, "contain");
    assert.ok(Math.abs(result.width - 1600) <= 1, `image element width ${result.width}`);
    assert.ok(Math.abs(result.height - 600) <= 1, `image element height ${result.height}`);
    assert.ok(Math.abs(result.left) <= 1, `image element left ${result.left}`);
    console.log("desktop preview image is centered through a full-stage contain box");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
