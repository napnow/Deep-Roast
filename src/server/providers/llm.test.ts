import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveChatEndpoint,
  resolveImageEndpoint,
  resolveVisionEndpoint,
} from "./llm";

const ENV_KEYS = [
  "ARK_API_KEY",
  "GROK_API_KEY",
  "GROK_BASE_URL",
  "GPT_IMAGE_KEY",
  "GPT_IMAGE_BASE_URL",
  "GEMINI_API_KEY",
  "GEMINI_BASE_URL",
] as const;

function withProviderEnv(run: () => void) {
  const previous = Object.fromEntries(
    ENV_KEYS.map((key) => [key, process.env[key]]),
  ) as Record<(typeof ENV_KEYS)[number], string | undefined>;

  Object.assign(process.env, {
    ARK_API_KEY: "ark-env",
    GROK_API_KEY: "grok-env",
    GROK_BASE_URL: "https://grok.example/v1",
    GPT_IMAGE_KEY: "gpt-image-env",
    GPT_IMAGE_BASE_URL: "https://gpt-image.example/v1",
    GEMINI_API_KEY: "gemini-env",
    GEMINI_BASE_URL: "https://gemini.example/v1",
  });

  try {
    run();
  } finally {
    for (const key of ENV_KEYS) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const adminArkConfig = {
  arkApiKey: "ark-admin",
  baseUrl: "https://ark.example/v1",
};

test("provider-specific credentials are not shadowed by admin Ark config", () => {
  withProviderEnv(() => {
    assert.deepEqual(resolveChatEndpoint("grok-4.20-fast", adminArkConfig), {
      apiKey: "grok-env",
      baseUrl: "https://grok.example/v1",
      maxRetries: 1,
    });

    assert.deepEqual(
      resolveImageEndpoint("grok-imagine-image-lite", adminArkConfig),
      {
        apiKey: "grok-env",
        baseUrl: "https://grok.example/v1",
        maxRetries: 3,
      },
    );

    assert.deepEqual(resolveImageEndpoint("gpt-image-2", adminArkConfig), {
      apiKey: "gpt-image-env",
      baseUrl: "https://gpt-image.example/v1",
      maxRetries: 1,
    });

    assert.deepEqual(
      resolveVisionEndpoint("gemini-2.5-flash", adminArkConfig),
      {
        apiKey: "gemini-env",
        baseUrl: "https://gemini.example/v1",
        maxRetries: 1,
      },
    );
  });
});

test("generic models continue to use the admin-configured Ark endpoint", () => {
  withProviderEnv(() => {
    assert.deepEqual(
      resolveChatEndpoint("doubao-seed-2-0-pro-260215", adminArkConfig),
      {
        apiKey: "ark-admin",
        baseUrl: "https://ark.example/v1",
        maxRetries: 1,
      },
    );
    assert.deepEqual(
      resolveImageEndpoint("doubao-seedream-4-5-251128", adminArkConfig),
      {
        apiKey: "ark-admin",
        baseUrl: "https://ark.example/v1",
        maxRetries: 1,
      },
    );
  });
});
