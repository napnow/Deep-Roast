import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const chatSource = readFileSync("src/server/services/chat.ts", "utf8");

describe("chat credit policy", () => {
  it("keeps the message limit and sanitized streaming error", async () => {
    const chat = await import("./chat");

    assert.equal(chat.MAX_CHAT_MESSAGE_LENGTH, 20_000);
    assert.match(chatSource, /对话服务暂时不可用，请稍后重试/);
  });

  it("reserves before the upstream chat request and never double-charges", () => {
    const reservePosition = chatSource.indexOf("await reserveCredits(");
    const fetchPosition = chatSource.indexOf("const apiRes = enforcePublicHttps");

    assert.notEqual(reservePosition, -1);
    assert.notEqual(fetchPosition, -1);
    assert.ok(reservePosition < fetchPosition);
    assert.equal(chatSource.includes("assertEnoughCredits"), false);
    assert.equal(chatSource.includes("consumeCredits"), false);
  });

  it("refunds a failed reservation at most once before content", async () => {
    const { createChatChargeState } = await import("./chat");
    assert.equal(typeof createChatChargeState, "function");
    if (typeof createChatChargeState !== "function") return;

    const refunds: string[] = [];
    const state = createChatChargeState({
      refund: async (note: string) => {
        refunds.push(note);
      },
    });

    await state.failBeforeContent("上游失败");
    await state.failBeforeContent("重复失败");

    assert.deepEqual(refunds, ["上游失败"]);
  });

  it("keeps a reservation after content has been emitted", async () => {
    const { createChatChargeState } = await import("./chat");
    assert.equal(typeof createChatChargeState, "function");
    if (typeof createChatChargeState !== "function") return;

    const charged = createChatChargeState({
      refund: async () => {
        throw new Error("must not refund");
      },
    });

    charged.markContent();
    await charged.failBeforeContent("late stream failure");

    assert.equal(charged.hasContent(), true);
  });

  it("keeps the stream timeout active through body consumption and redacts upstream bodies", () => {
    const timeoutStart = chatSource.indexOf("timeout = setTimeout");
    const bodyEnd = chatSource.indexOf("    cancel()", timeoutStart);
    assert.ok(timeoutStart >= 0 && bodyEnd > timeoutStart);
    const streamAttempt = chatSource.slice(timeoutStart, bodyEnd);
    assert.match(streamAttempt, /finally\s*\{[\s\S]*clearTimeout\(timeout\)/);
    assert.doesNotMatch(
      chatSource,
      /console\.error\("Chat upstream error:", apiRes\.status, errText\)/,
    );
  });
});
