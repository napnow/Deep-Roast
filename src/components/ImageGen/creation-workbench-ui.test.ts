import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  clampCreationPanelWidth,
  CREATION_PANEL_LAYOUT,
  getActiveEditPrompt,
  getCreationPanelBounds,
  getCreationPanelKeyboardWidth,
  getCreationSettingsSummary,
  getMobileCreationSurface,
  parseCreationPanelWidth,
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
      roomyPanel: "creation-panel--roomy",
      richPanel: "creation-panel--rich",
      step: "creation-step-card",
      statusStrip: "creation-status-strip",
      taskCard: "creation-task-card",
      settings: "creation-settings",
      mobileSheet: "mobile-creation-sheet",
    });
  });

  it("keeps a usable result canvas when calculating panel bounds", () => {
    assert.deepEqual(getCreationPanelBounds(1440), { min: 360, max: 560 });
    assert.deepEqual(getCreationPanelBounds(900), { min: 360, max: 360 });
    assert.deepEqual(getCreationPanelBounds(720), { min: 360, max: 360 });
  });

  it("clamps invalid and persisted panel widths", () => {
    const bounds = { min: 360, max: 560 };
    assert.equal(clampCreationPanelWidth(300, bounds), 360);
    assert.equal(clampCreationPanelWidth(700, bounds), 560);
    assert.equal(parseCreationPanelWidth("440", bounds), 440);
    assert.equal(parseCreationPanelWidth("not-a-number", bounds), 440);
    assert.equal(parseCreationPanelWidth(null, bounds), 440);
    assert.equal(CREATION_PANEL_LAYOUT.storageKey, "deep-roast-creation-panel-width");
  });

  it("handles keyboard panel resize commands", () => {
    const bounds = { min: 360, max: 560 };
    assert.equal(getCreationPanelKeyboardWidth(440, "ArrowLeft", bounds), 424);
    assert.equal(getCreationPanelKeyboardWidth(440, "ArrowRight", bounds), 456);
    assert.equal(getCreationPanelKeyboardWidth(440, "Home", bounds), 360);
    assert.equal(getCreationPanelKeyboardWidth(440, "End", bounds), 560);
    assert.equal(getCreationPanelKeyboardWidth(440, "Enter", bounds), 440);
  });
});
