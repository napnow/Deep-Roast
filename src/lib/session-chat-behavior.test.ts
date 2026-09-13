import assert from "node:assert/strict";
import { test } from "node:test";
import { openSessionStream, plain, respond, sessionFixture } from "./session-client-fixture";

const message = (content: string) => ({ role: "assistant" as const, content });

function chatFixture() {
  const env = sessionFixture();
  env.store.getState().setCredits(100);
  env.store.getState().setActiveConvId("A");
  const chat = env.mountChat();
  return { env, chat };
}

test("session history: late A must not overwrite the selected B", async (t) => {
  const { env, chat } = chatFixture(); t.after(() => env.dispose());
  const a = chat.value.handleSelectConversation("A");
  const b = chat.value.handleSelectConversation("B");
  respond(env.requests[1], { messages: [message("B history")] }); await b;
  respond(env.requests[0], { messages: [message("A history")] }); await a;
  assert.equal(env.store.getState().activeConvId, "B");
  assert.deepEqual(plain(env.store.getState().chatMessages), [message("B history")]);
  assert.equal(env.requests[0].init?.signal?.aborted, true);
});

test("session history: A -> B -> A still rejects the first A response", async (t) => {
  const { env, chat } = chatFixture(); t.after(() => env.dispose());
  const firstA = chat.value.handleSelectConversation("A");
  const b = chat.value.handleSelectConversation("B");
  const latestA = chat.value.handleSelectConversation("A");
  respond(env.requests[2], { messages: [message("new A")] }); await latestA;
  respond(env.requests[1], { messages: [message("B")] }); await b;
  respond(env.requests[0], { messages: [message("old A")] }); await firstA;
  assert.deepEqual(plain(env.store.getState().chatMessages), [message("new A")]);
});

test("session SSE: old tokens, completion and finally cannot affect B's running request", async (t) => {
  const { env, chat } = chatFixture(); t.after(() => env.dispose());
  const a = chat.value.handleSendMessage("question A");
  const streamA = openSessionStream(env.requests[0]); await env.flush();
  const selectB = chat.value.handleSelectConversation("B");
  respond(env.requests[1], { messages: [message("B history")] }); await selectB; await env.flush();
  const b = chat.value.handleSendMessage("question B");
  const streamB = openSessionStream(env.requests[2]); await env.flush();
  try {
    streamB.event({ type: "token", text: "B partial" }); await env.flush();
    streamA.event({ type: "token", text: "A answer" }); streamA.end(); await a; await env.flush();
    const state = env.store.getState();
    assert.equal(state.streamingText, "B partial");
    assert.equal(state.streaming, true, "old finally must not release the new request's lock");
    assert.deepEqual(plain(state.chatMessages), [message("B history"), { role: "user", content: "question B" }]);
    assert.equal(env.requests[0].init?.signal?.aborted, true);
  } finally { streamB.end(); await b; }
});

test("session stop: late image completion and finally cannot replace a newly started image", async (t) => {
  const { env, chat } = chatFixture(); t.after(() => env.dispose());
  const a = chat.value.handleSendMessage("first image");
  const streamA = openSessionStream(env.requests[0]); await env.flush();
  streamA.event({ type: "image_started", prompt: "old image" }); await env.flush();
  chat.value.handleStopChat(); await env.flush();
  const b = chat.value.handleSendMessage("second image");
  const streamB = openSessionStream(env.requests[1]); await env.flush();
  try {
    streamB.event({ type: "image_started", prompt: "new image" }); await env.flush();
    streamA.event({ type: "image_done", message: { ...message("old image result"),
      metadata: { image: { status: "success", prompt: "old image", imageUrl: "mock:old" } } } });
    streamA.end(); await a; await env.flush();
    const state = env.store.getState();
    assert.equal(state.streaming, true);
    assert.equal(state.chatMessages.at(-1)?.metadata?.image?.status, "pending");
    assert.equal(state.chatMessages.at(-1)?.metadata?.image?.prompt, "new image");
    assert.equal(env.requests[0].init?.signal?.aborted, true);
  } finally { streamB.end(); await b; }
});

test("session unmount: history and stream callbacks are invalidated and requests aborted", async (t) => {
  const { env, chat } = chatFixture(); t.after(() => env.dispose());
  const a = chat.value.handleSendMessage("question A");
  const streamA = openSessionStream(env.requests[0]); await env.flush();
  chat.unmount();
  env.store.getState().setActiveConvId("B");
  env.store.getState().setChatMessages([message("B history")]);
  env.store.getState().setStreaming(true);
  env.store.getState().setStreamingText("B partial");
  streamA.event({ type: "error", text: "old error" }); streamA.end(); await a;
  assert.deepEqual(plain(env.store.getState().chatMessages), [message("B history")]);
  assert.equal(env.store.getState().streaming, true);
  assert.equal(env.store.getState().streamingText, "B partial");
  assert.equal(env.requests[0].init?.signal?.aborted, true);
  const count = env.requests.length;
  await chat.value.handleSelectConversation("old callback");
  assert.equal(env.requests.length, count, "retained callbacks cannot start work after unmount");
});

test("session history: unmounted history response is ignored", async (t) => {
  const { env, chat } = chatFixture(); t.after(() => env.dispose());
  const history = chat.value.handleSelectConversation("A"); chat.unmount();
  env.store.getState().setChatMessages([message("new view")]);
  respond(env.requests[0], { messages: [message("old view")] }); await history;
  assert.deepEqual(plain(env.store.getState().chatMessages), [message("new view")]);
});

test("session history: an outstanding load cannot erase a newly submitted message", async (t) => {
  const { env, chat } = chatFixture(); t.after(() => env.dispose());
  const history = chat.value.handleSelectConversation("A");
  const send = chat.value.handleSendMessage("new question");
  const stream = openSessionStream(env.requests[1]); await env.flush();
  respond(env.requests[0], { messages: [message("old snapshot")] }); await history;
  try { assert.ok(env.store.getState().chatMessages.some((entry) => entry.content === "new question")); }
  finally { stream.event({ type: "token", text: "answer" }); stream.end(); await send; }
});

test("session normal chat: tokens, reasoning, completion and refreshes still work", async (t) => {
  const env = sessionFixture(); t.after(() => env.dispose());
  env.store.getState().setCredits(100); env.store.getState().setActiveConvId("A");
  let lists = 0; let credits = 0;
  const chat = env.mountChat(async () => { lists++; }, async () => { credits++; });
  const sent = chat.value.handleSendMessage("question");
  const stream = openSessionStream(env.requests[0]); await env.flush();
  stream.event({ type: "reasoning", text: "reason" });
  stream.event({ type: "token", text: "answer" }); stream.end(); await sent;
  assert.deepEqual(plain(env.store.getState().chatMessages), [
    { role: "user", content: "question" }, { ...message("answer"), reasoning: "reason" },
  ]);
  assert.equal(env.store.getState().streaming, false);
  assert.equal(lists, 1); assert.equal(credits, 1);
});

test("session timeout: an owned timeout still reports failure and releases streaming", async (t) => {
  const { env, chat } = chatFixture(); t.after(() => env.dispose());
  const sent = chat.value.handleSendMessage("question");
  env.fireTimeouts();
  env.requests[0].reject(new DOMException("test timeout", "AbortError")); await sent;
  assert.match(env.store.getState().chatMessages.at(-1)?.content || "", /请求超时/);
  assert.equal(env.store.getState().streaming, false);
});
