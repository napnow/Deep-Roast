const sharp = require('sharp');
const { randomBytes } = require('node:crypto');
const { writeFile } = require('node:fs/promises');
(async () => {
  const image = await sharp(randomBytes(1536 * 1536 * 3), { raw: { width: 1536, height: 1536, channels: 3 } }).png().toBuffer();
  const data = 'data:image/png;base64,' + image.toString('base64');
  const body = JSON.stringify({ mode: 'reference', targetImage: data, referenceImages: [data, data], prompt: 'synthetic', count: 2 });
  if (Buffer.byteLength(body) > 30 * 1024 * 1024) throw new Error('fixture exceeds HTTP limit');
  await writeFile(process.argv[2], body);
  console.log(JSON.stringify({ fixture_bytes: Buffer.byteLength(body) }));
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
