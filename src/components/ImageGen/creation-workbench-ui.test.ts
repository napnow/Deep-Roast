import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getActiveEditPrompt,
  getCreationSettingsSummary,
  getMobileCreationSurface,
  WORKBENCH_CLASS_NAMES,
} from "./creation-workbench-ui";

describe("creation workbench UI contracts", () => {
  it("summarizes only the active settings", () => {
    assert.deepEqual(
      getCreationSettingsSummary({ sizeLabel: "1:1", batchCount: 1 }),
      ["1:1", "1 张"],
    );
    assert.deepEqual(
      getCreationSettingsSummary({
        styleLabel: "赛博朋克",
        sizeLabel: "16:9",
        batchCount: 3,
      }),
      ["赛博朋克", "16:9", "3 张"],
    );
    assert.deepEqual(
      getCreationSettingsSummary({ sizeLabel: "", batchCount: 0 }),
      [],
    );
  });

  it("reads the prompt for the selected image without creating a slot", () => {
    assert.equal(getActiveEditPrompt(["改成夜景", "", "保留人物"], 0), "改成夜景");
    assert.equal(getActiveEditPrompt(["改成夜景", "", "保留人物"], 1), "");
    assert.equal(getActiveEditPrompt(["改成夜景"], 9), "");
  });

  it("keeps image creation and chat as separate mobile surfaces", () => {
    assert.deepEqual(getMobileCreationSurface("img2img", "image"), {
      sheetOpen: true,
      appMode: "image",
    });
    assert.deepEqual(getMobileCreationSurface("chat", "chat"), {
      sheetOpen: false,
      appMode: "chat",
    });
  });

  it("exposes stable class names for the shared workbench surfaces", () => {
    assert.deepEqual(WORKBENCH_CLASS_NAMES, {
      panel: "creation-panel",
      settings: "creation-settings",
      mobileSheet: "mobile-creation-sheet",
    });
  });
});
