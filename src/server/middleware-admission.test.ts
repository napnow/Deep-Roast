import { test } from "node:test";
import assert from "node:assert/strict";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { config } from "@/middleware";

test("image upload bypasses pass-through middleware while private images and admin remain covered", () => {
  const matches = (url: string) => unstable_doesMiddlewareMatch({ config, nextConfig: {}, url });
  assert.equal(matches("/api/image-edit/batch"), false);
  assert.equal(matches("/api/image"), false);
  assert.equal(matches("/images/private.png"), true);
  assert.equal(matches("/admin"), true);
});
