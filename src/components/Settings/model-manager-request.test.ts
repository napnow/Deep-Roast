import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { decideModelCatalogRequest } from "./model-manager-request";

describe("model catalog request decision", () => {
  it("uses the saved catalog when the key is blank and the Base URL is unchanged", () => {
    assert.deepEqual(
      decideModelCatalogRequest({
        baseUrl: " https://saved.example/v1 ",
        savedBaseUrl: "https://saved.example/v1",
        apiKey: " ",
        hasSavedApiKey: true,
      }),
      { kind: "request", method: "GET" },
    );
  });

  it("posts an explicit API key with the current Base URL", () => {
    assert.deepEqual(
      decideModelCatalogRequest({
        baseUrl: " https://custom.example/v1 ",
        savedBaseUrl: "https://saved.example/v1",
        apiKey: " explicit-key ",
        hasSavedApiKey: true,
      }),
      {
        kind: "request",
        method: "POST",
        body: {
          baseUrl: "https://custom.example/v1",
          apiKey: "explicit-key",
        },
      },
    );
  });

  it("requires the API key again when the Base URL changes", () => {
    assert.deepEqual(
      decideModelCatalogRequest({
        baseUrl: "https://changed.example/v1",
        savedBaseUrl: "https://saved.example/v1",
        apiKey: "",
        hasSavedApiKey: true,
      }),
      {
        kind: "error",
        message: "修改 Base URL 时请重新输入 API Key",
      },
    );
  });

  it("keeps the existing missing-key error when no key is saved", () => {
    assert.deepEqual(
      decideModelCatalogRequest({
        baseUrl: "https://saved.example/v1",
        savedBaseUrl: "https://saved.example/v1",
        apiKey: "",
        hasSavedApiKey: false,
      }),
      { kind: "error", message: "请先在上方填写 API Key" },
    );
  });

  it("reuses the credential-safe decision in the reverse prompt picker", () => {
    const settingsDir = join(process.cwd(), "src", "components", "Settings");
    const pickerSource = readFileSync(
      join(settingsDir, "ReversePromptModelPicker.tsx"),
      "utf8",
    );
    const modalSource = readFileSync(
      join(settingsDir, "SettingsModal.tsx"),
      "utf8",
    );

    assert.match(
      pickerSource,
      /import \{ decideModelCatalogRequest \} from "\.\/model-manager-request";/,
    );
    assert.match(pickerSource, /savedBaseUrl: string;/);
    assert.match(
      pickerSource,
      /const decision = decideModelCatalogRequest\(\{[\s\S]*?savedBaseUrl,[\s\S]*?hasSavedApiKey: !!hasSavedApiKey,[\s\S]*?\}\);/,
    );
    assert.match(pickerSource, /decision\.method === "GET"/);
    assert.match(pickerSource, /JSON\.stringify\(decision\.body\)/);
    assert.match(
      modalSource,
      /<ReversePromptModelPicker[\s\S]*?savedBaseUrl=\{config\.baseUrl\}/,
    );
  });
});
