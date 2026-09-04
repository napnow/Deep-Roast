import assert from "node:assert/strict";
import test from "node:test";

import { hydrateImg2ImgDraft } from "./image-to-image-draft";

test("将续作草稿写入图生图面板的本地素材与编辑状态", () => {
  const draft = {
    prompt: "保留人物姿势，把背景改为海边日落",
    size: "1024x1536",
    count: 2,
    styleId: "watercolor",
    styleColor: "blue",
    styleTexture: "paper",
    refs: [{ preview: "https://example.com/image.webp", base64: "https://example.com/image.webp" }],
  };

  assert.deepEqual(hydrateImg2ImgDraft(draft), {
    refs: draft.refs,
    edit: draft.prompt,
    perImagePrompts: [draft.prompt],
    editMode: "per-image",
    targetIndex: 0,
    referenceIndexes: [],
    editSize: draft.size,
    batchCount: draft.count,
    styleId: draft.styleId,
    styleColor: draft.styleColor,
    styleTexture: draft.styleTexture,
  });
});
