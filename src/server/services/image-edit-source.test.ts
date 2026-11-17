import assert from "node:assert/strict";
import test from "node:test";
import { resolveImageEditSource, snapshotImageEditSources } from "./image-edit-source";

const id = "149e2eee-409f-4480-bba3-68da18847df7";
const parent = { id, userId: "owner", imageUrl: "/images/old.png", storageKey: "149e2eee-409f-4480-bba3-68da18847df7.png", versionGroupId: null };
const lookup = async (userId: string, imageId: string) => userId === parent.userId && imageId === id ? parent : undefined;

test("authorizes only the owner's actual target and derives old-image group", async () => {
  assert.deepEqual(await resolveImageEditSource("owner", id, "/api/images/149e2eee-409f-4480-bba3-68da18847df7.png", lookup), { sourceImageId: id, versionGroupId: id, image: "/api/images/149e2eee-409f-4480-bba3-68da18847df7.png" });
  await assert.rejects(() => resolveImageEditSource("other", id, "/api/images/149e2eee-409f-4480-bba3-68da18847df7.png", lookup), /来源作品不可用/);
  await assert.rejects(() => resolveImageEditSource("owner", id, "/api/images/other.png", lookup), /目标图片与来源作品不一致/);
  await assert.rejects(() => resolveImageEditSource("owner", "invalid", "/api/images/149e2eee-409f-4480-bba3-68da18847df7.png", lookup), /来源作品标识无效/);
});
test("preserves an existing version group and allows an upload without a source", async () => {
  const group = "ada31342-ae8e-4acd-9f8a-d18b7955186e";
  assert.equal((await resolveImageEditSource("owner", id, "/api/images/149e2eee-409f-4480-bba3-68da18847df7.png", async () => ({ ...parent, versionGroupId: group })))?.versionGroupId, group);
  assert.equal(await resolveImageEditSource("owner", undefined, "data:image/png;base64,abc", lookup), null);
});


test("snapshots each authorized source independently and retains task association", async () => {
  const first = {sourceImageId: id, versionGroupId: id, image: "/images/first.png"};
  const second = {...first, image: "/images/second.png"};
  const calls: string[][] = [];
  const result = await snapshotImageEditSources([first, null, second], async values => {
    calls.push(values);
    return values.map((_, index) => `data:${index === 0 && calls.length === 1 ? "first" : "second"}`);
  });
  assert.deepEqual(calls, [[first.image], [second.image]]);
  assert.deepEqual(result.map(source => source?.image ?? null), ["data:first", null, "data:second"]);
});
