import { createReadStream, statSync } from "node:fs";
import { Readable } from "node:stream";
import { readJson, IMAGE_EDIT_JSON_MAX_BYTES } from "@/server/http";
import { normalizeReferenceImages, readUpstreamImage, preserveOrCropImage } from "@/server/services/image";
import { executeImageEditTasks } from "@/server/services/image-edit-runner";
import type { ImageEditRequest, ImageEditTask } from "@/lib/image-edit-contract";
import sharp from "sharp";

async function main() {
  if (process.argv.includes("--small-cache")) { sharp.cache({ memory: 0, files: 0, items: 0 }); sharp.concurrency(1); }
  const sample = (stage: string) => console.log(JSON.stringify({ stage, rss_mib: Math.round(process.memoryUsage().rss / 1048576), peak_mib: Math.round(process.resourceUsage().maxRSS / 1024) }));
  sample("start");
  const filename = process.argv[2]!;
  const stream = Readable.toWeb(createReadStream(filename));
  const request = new Request("http://localhost/test", { method: "POST", body: stream as ReadableStream, duplex: "half", headers: { "content-length": String(statSync(filename).size) } } as RequestInit & { duplex: "half" });
  const body = await readJson<ImageEditRequest>(request, { maxBytes: IMAGE_EDIT_JSON_MAX_BYTES });
  sample("read");
  const task: ImageEditTask = { mode: "reference", targetImage: body.targetImage!, referenceImages: body.referenceImages!, prompt: body.prompt!, targetIndex: 0 };
  let active = 0, maxActive = 0;
  const outcome = await executeImageEditTasks([task], 2, async (item) => {
    active++; maxActive = Math.max(maxActive, active);
    try {
      if (item.mode !== "reference") throw new Error("unexpected mode");
      const images = await normalizeReferenceImages([item.targetImage, ...item.referenceImages]);
      sample("normalized");
      const payload = JSON.stringify({ model: "test", image: images });
      sample("serialized");
      if (!payload.length) throw new Error("empty payload");
      const result = await readUpstreamImage({ b64_json: item.targetImage.split(",")[1] }, "https://example.invalid");
      sample("result_loaded");
      await preserveOrCropImage(result, "1024x1024", true);
      sample("processed");
      return true;
    } finally { active--; }
  });
  console.log(JSON.stringify({ max_active: maxActive, succeeded: outcome.succeeded, max_rss_mib: Math.round(process.resourceUsage().maxRSS / 1024) }));
  if (outcome.succeeded !== 2 || maxActive !== 1 || process.resourceUsage().maxRSS > 280 * 1024) process.exitCode = 1;
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
