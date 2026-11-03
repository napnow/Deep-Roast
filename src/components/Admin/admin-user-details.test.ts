import { strict as assert } from "node:assert";
import { test } from "node:test";
import { loadAdminUserDetails } from "./admin-user-details";

test("user detail requests fail instead of treating an error response as empty data", async () => {
  const fetcher: typeof fetch = async () => new Response(JSON.stringify({ error: "unavailable" }), { status: 503 });
  await assert.rejects(loadAdminUserDetails("abc", new AbortController().signal, fetcher), /503/);
});

test("detail requests use the selected user and one shared cancellation signal", async () => {
  const calls: { url: string; signal: AbortSignal | null | undefined }[] = [];
  const controller = new AbortController();
  const fetcher: typeof fetch = async (url, options) => {
    calls.push({ url: String(url), signal: options?.signal });
    return Response.json(String(url).includes("credits?") ? { transactions: [] } : []);
  };
  const result = await loadAdminUserDetails("user-1", controller.signal, fetcher);
  assert.equal(calls.length, 3);
  assert.ok(calls.every((call) => call.url.includes("user-1") && call.signal === controller.signal));
  assert.deepEqual(result, { images: [], transactions: [], conversations: [] });
});
