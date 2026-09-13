import assert from "node:assert/strict";
import { test } from "node:test";
import { plain, respond, sessionFixture, sessionUser, type SessionRequest } from "./session-client-fixture";
import type { DeepRoastState } from "./store";

const userKeys = [
  "activeMode", "imageCreationMode", "inspectorTab", "inspectorCollapsed", "activeImageId",
  "textToImageDraft", "imageToImageDraft", "reversePromptDraft", "config", "imageModels", "selectedImageModel",
  "conversations", "activeConvId", "chatMessages", "streaming", "streamingText", "imageHistory", "generating", "imageTask",
  "credits", "checkinReward", "checkinEligible", "todayChecked", "settingsOpen", "walletOpen", "pwOpen", "apiOpen",
] as const;
const userState = (state: DeepRoastState) => plain(Object.fromEntries(userKeys.map((key) => [key, state[key]])));

function seedUserState(state: DeepRoastState) {
  state.setActiveMode("chat"); state.setImageCreationMode("edit"); state.setInspectorCollapsed(true);
  state.setActiveImageId("A-image");
  state.setTextToImageDraft({ prompt: "A private text" });
  state.setImageToImageDraft({ prompt: "A private edit", refs: [{ preview: "mock:A", base64: "mock:A" }] });
  state.setReversePromptDraft({ image: "mock:A", resultPrompt: "A private reverse" });
  state.setConfig({ textModel: "A-model", imageModel: "A-image-model", hasApiKey: true, apiKeyHint: "mock hint" });
  state.setImageModels([{ id: "A-image-model" }]); state.setSelectedImageModel("A-image-model");
  state.setConversations([{ id: "A", title: "A private conversation", model: "A-model", createdAt: "mock-time", updatedAt: "mock-time", messageCount: 1 }]);
  state.setActiveConvId("A"); state.setChatMessages([{ role: "user", content: "A private message" }]);
  state.setStreaming(true); state.setStreamingText("A partial");
  state.setImageHistory([{ id: "A-image", prompt: "A private image", model: "A-model", imageUrl: "mock:A", size: "1:1", createdAt: "mock-time" }]);
  state.setGenerating(true); state.startImageTask({ mode: "edit", prompt: "A private task", size: "1:1", count: 3, images: ["mock:A"] });
  state.setCredits(777); state.setCheckinStatus({ eligible: true, todayChecked: true, reward: 999 });
  state.setSettingsOpen(true); state.setWalletOpen(true); state.setPwOpen(true); state.setApiOpen(true);
}

async function loggedInFixture() {
  const env = sessionFixture();
  const defaults = userState(env.store.getState());
  const provider = env.mountAuth();
  env.authRequests[0].resolve(sessionUser("A")); await env.flush();
  return { env, provider, defaults };
}

function respondInitial(requests: SessionRequest[], owner: string) {
  for (const request of requests) {
    if (request.url === "/api/config") respond(request, { imageModel: `${owner}-model`, textModel: `${owner}-text`, enabledImageModels: [`${owner}-model`] });
    else if (request.url === "/api/auth/me") respond(request, { credits: owner === "B" ? 20 : 10, checkin: { eligible: owner === "B", todayChecked: false, reward: owner === "B" ? 25 : 99 } });
    else if (request.url === "/api/image-history") respond(request, [{ id: `${owner}-image` }]);
    else if (request.url === "/api/conversations") respond(request, [{ id: `${owner}-conversation` }]);
    else throw new Error(`unexpected mocked initial URL: ${request.url}`);
  }
}

test("session logout: clears every user-owned store field before waiting for the logout request", async (t) => {
  const { env, defaults } = await loggedInFixture(); t.after(() => env.dispose());
  seedUserState(env.store.getState()); await env.flush();
  const pendingLogout = env.auth().logout();
  try { assert.deepEqual(userState(env.store.getState()), defaults); }
  finally { env.logoutRequests[0].resolve(); await pendingLogout; await env.flush(); }
  assert.equal(env.auth().user, null);
});

test("session identity switch: publishing B resets A data even without a prior logout", async (t) => {
  const { env, defaults } = await loggedInFixture(); t.after(() => env.dispose());
  seedUserState(env.store.getState()); await env.flush();
  const refresh = env.auth().refresh(); env.authRequests[1].resolve(sessionUser("B")); await refresh; await env.flush();
  assert.equal(env.auth().user?.id, "B");
  assert.deepEqual(userState(env.store.getState()), defaults);
});

test("session same-user refresh: does not discard an active workspace", async (t) => {
  const { env } = await loggedInFixture(); t.after(() => env.dispose());
  seedUserState(env.store.getState()); const before = userState(env.store.getState());
  const refresh = env.auth().refresh(); env.authRequests[1].resolve(sessionUser("A")); await refresh; await env.flush();
  assert.deepEqual(userState(env.store.getState()), before);
});

test("session auth: a late refresh cannot resurrect A after logout", async (t) => {
  const { env } = await loggedInFixture(); t.after(() => env.dispose());
  const stale = env.auth().refresh();
  const logout = env.auth().logout(); env.logoutRequests[0].resolve(); await logout; await env.flush();
  env.authRequests[1].resolve(sessionUser("A")); await stale; await env.flush();
  assert.equal(env.auth().user, null);
});

test("session auth: late initial auth cannot replace the result of a newer refresh", async (t) => {
  const env = sessionFixture(); t.after(() => env.dispose()); env.mountAuth();
  const refresh = env.auth().refresh(); env.authRequests[1].resolve(sessionUser("B")); await refresh; await env.flush();
  env.authRequests[0].resolve(sessionUser("A")); await env.flush();
  assert.equal(env.auth().user?.id, "B");
});

test("session initial data: all four loaders reload for B and reject A's late responses", async (t) => {
  const { env } = await loggedInFixture(); t.after(() => env.dispose());
  const initial = env.mountInitial(); const oldCallbacks = initial.value;
  const oldRequests = [...env.requests]; assert.equal(oldRequests.length, 4);
  const refresh = env.auth().refresh(); env.authRequests[1].resolve(sessionUser("B")); await refresh; await env.flush();
  const newRequests = env.requests.slice(4);
  assert.equal(newRequests.length, 4, "same mounted hook must reload on account identity change");
  respondInitial(newRequests, "B"); await env.flush();
  const before = userState(env.store.getState());
  respondInitial(oldRequests, "A"); await env.flush();
  assert.deepEqual(userState(env.store.getState()), before);
  assert.equal(env.store.getState().config.imageModel, "B-model");
  assert.equal(env.store.getState().credits, 20);
  assert.ok(oldRequests.every((request) => request.init?.signal?.aborted));
  const count = env.requests.length;
  await oldCallbacks.loadCredits(); await oldCallbacks.loadConfig();
  assert.equal(env.requests.length, count, "callbacks retained by an old user operation cannot start a new user's load");
});

test("session initial unmount: late responses cannot overwrite a remounted workspace", async (t) => {
  const { env } = await loggedInFixture(); t.after(() => env.dispose());
  const initial = env.mountInitial(); const old = [...env.requests]; initial.unmount(); env.mountInitial();
  respondInitial(env.requests.slice(4), "B"); await env.flush();
  const before = userState(env.store.getState()); respondInitial(old, "A"); await env.flush();
  assert.deepEqual(userState(env.store.getState()), before);
  assert.ok(old.every((request) => request.init?.signal?.aborted));
});

test("session initial refresh: newest credits request wins within one account", async (t) => {
  const { env } = await loggedInFixture(); t.after(() => env.dispose());
  const initial = env.mountInitial(); respondInitial(env.requests, "A"); await env.flush();
  const first = initial.value.loadCredits(); const second = initial.value.loadCredits();
  respond(env.requests[5], { credits: 20 }); await second;
  respond(env.requests[4], { credits: 10 }); await first;
  assert.equal(env.store.getState().credits, 20);
});

test("session StrictMode effect replay: remount setup remains usable, old work stays invalid", async (t) => {
  const { env } = await loggedInFixture(); t.after(() => env.dispose());
  const initial = env.mountInitial(); const first = [...env.requests]; initial.replayEffects();
  respondInitial(env.requests.slice(4), "B"); await env.flush();
  respondInitial(first, "A"); await env.flush();
  assert.equal(env.store.getState().credits, 20);
  assert.equal(env.store.getState().config.imageModel, "B-model");
});


test("session logout navigation: wait for logout completion before exposing login", async (t) => {
  const env = sessionFixture({ pathname: "/" }); t.after(() => env.dispose()); env.mountAuth();
  env.authRequests[0].resolve(sessionUser("A")); await env.flush();
  const pending = env.auth().logout(); await env.flush();
  try {
    assert.equal(env.navigations.length, 0, "do not expose login while logout is still pending");
    assert.equal(env.auth().loading, true);
  } finally { env.logoutRequests[0].resolve(); await pending; await env.flush(); }
  assert.equal(env.auth().loading, false);
  assert.ok(env.navigations.includes("/login"));
});

test("session public token: same-user refresh keeps it, logout and re-login invalidate it", async (t) => {
  const { env } = await loggedInFixture(); t.after(() => env.dispose());
  const lifecycle = env.load("lib/client-session-lifecycle.ts") as typeof import("./client-session-lifecycle");
  const token = lifecycle.captureUserSession();
  const refresh = env.auth().refresh(); env.authRequests[1].resolve(sessionUser("A")); await refresh;
  assert.equal(lifecycle.isUserSessionCurrent(token), true);
  const logout = env.auth().logout();
  assert.equal(lifecycle.isUserSessionCurrent(token), false);
  env.logoutRequests[0].resolve(); await logout; await env.flush();
  const loginAgain = env.auth().refresh(); env.authRequests[2].resolve(sessionUser("A")); await loginAgain; await env.flush();
  assert.equal(lifecycle.isUserSessionCurrent(token), false);
  assert.ok(lifecycle.captureUserSession() > token);
  assert.equal(lifecycle.isUserSessionCurrent(lifecycle.captureUserSession()), true);
});

test("session auth unmount: retained refresh cannot publish into a new provider", async (t) => {
  const { env, provider } = await loggedInFixture(); t.after(() => env.dispose());
  const stale = env.auth().refresh(); provider.unmount();
  env.mountAuth(); env.authRequests[2].resolve(sessionUser("B")); await env.flush();
  env.store.getState().setCredits(20);
  env.authRequests[1].resolve(sessionUser("A")); await stale; await env.flush();
  assert.equal(env.auth().user?.id, "B");
  assert.equal(env.store.getState().credits, 20);
});


test("session initial logout: a still-mounted hook must not start anonymous replacement loads", async (t) => {
  const { env, defaults } = await loggedInFixture(); t.after(() => env.dispose());
  env.mountInitial(); const old = [...env.requests];
  const logout = env.auth().logout(); await env.flush();
  try {
    assert.equal(env.requests.length, 4, "logout must not fetch with the old cookie under a new anonymous epoch");
    respondInitial(old, "A"); await env.flush();
    assert.deepEqual(userState(env.store.getState()), defaults);
  } finally { env.logoutRequests[0].resolve(); await logout; await env.flush(); }
});
