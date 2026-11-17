import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

// Only an explicitly named loopback test database may be modified by this test.
const testUrl = process.env.TEST_CANVAS_DATABASE_URL;
function assertIsolatedUrl(value: string): void {
  const url = new URL(value);
  if (!["postgres:", "postgresql:"].includes(url.protocol) ||
      !["127.0.0.1", "localhost", "::1", "[::1]"].includes(url.hostname) ||
      !url.pathname.slice(1).startsWith("deeproast_canvas_test_") || url.search || url.hash) {
    throw new Error("TEST_CANVAS_DATABASE_URL must name a loopback deeproast_canvas_test_* database");
  }
}

test("authenticated canvas routes isolate accounts, restore old items and reject stale writes", { skip: !testUrl }, async () => {
  assertIsolatedUrl(testUrl!);
  process.env.DATABASE_URL = testUrl;
  process.env.JWT_SECRET = "isolated-canvas-test-secret-not-for-production";
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: testUrl });
  const a = randomUUID(), b = randomUUID(), old = randomUUID(), child = randomUUID();
  const password = "isolated-test-password-hash";
  try {
    await pool.query("INSERT INTO users(id, username, password) VALUES ($1,$2,$3),($4,$5,$3)", [a, `canvas-${a}`, password, b, `canvas-${b}`]);
    await pool.query("INSERT INTO image_generations(id,user_id,prompt,image_url,created_at) VALUES ($1,$2,'old','/old',now()-interval '100 days')", [old, a]);
    await pool.query("INSERT INTO image_generations(id,user_id,prompt,image_url,source_image_id,version_group_id) VALUES ($1,$2,'child','/child',$3,$3)", [child, a, old]);
    await pool.query("INSERT INTO image_generations(user_id,prompt,image_url) SELECT $1,'recent','/recent' FROM generate_series(1,51)", [a]);
    const { GET, PUT, POST } = await import("./route");
    const { signToken } = await import("@/lib/auth");
    const tokenA = await signToken({ userId:a, username:`canvas-${a}`, role:"user" }, password);
    const tokenB = await signToken({ userId:b, username:`canvas-${b}`, role:"user" }, password);
    const request = (method: string, token?: string, data?: unknown) => new Request("http://localhost/api/image-canvas", {
      method, headers: { ...(token ? {cookie:`token=${token}`} : {}), ...(data ? {"content-type":"application/json"} : {}) },
      ...(data ? {body:JSON.stringify(data)} : {}),
    });
    assert.equal((await GET(request("GET"), undefined)).status, 401);
    assert.equal((await POST(request("POST",undefined,{ids:[old]}), undefined)).status,401);
    const resolved = await POST(request("POST",tokenA,{ids:[old,child,randomUUID()]}), undefined);
    assert.equal(resolved.status,200);
    const resolvedBody = await resolved.json() as {images:Array<{id:string}>};
    assert.deepEqual(new Set(resolvedBody.images.map(image=>image.id)),new Set([old,child]));
    const otherResult = await POST(request("POST",tokenB,{ids:[old]}), undefined);
    assert.deepEqual((await otherResult.json() as {images:unknown[]}).images,[]);
    assert.equal((await POST(request("POST",tokenA,{ids:["bad"]}), undefined)).status,400);
    const layout = {revision:0, nodes:[{id:old,x:123,y:456},{id:child,x:500,y:90}], hiddenIds:[], viewport:{x:10,y:20,zoom:0.8}};
    assert.equal((await PUT(request("PUT",tokenB,layout), undefined)).status,400);
    assert.equal((await PUT(request("PUT",tokenA,layout), undefined)).status,200);
    const response = await GET(request("GET",tokenA), undefined);
    assert.equal(response.status,200);
    const data = await response.json() as {layout:typeof layout,images:Array<{id:string;sourceImageId?:string}>};
    assert.equal(data.layout.nodes[0]?.x,123);
    assert.ok(data.images.some(image => image.id === old));
    assert.equal(data.images.find(image => image.id === child)?.sourceImageId,old);
    assert.equal((await PUT(request("PUT",tokenA,layout), undefined)).status,409);
    const attempts = await Promise.all([1,2].map(() => PUT(request("PUT",tokenA,{...layout,revision:1}),undefined)));
    assert.deepEqual(attempts.map(item => item.status).sort(),[200,409]);
    await pool.query("DELETE FROM image_generations WHERE id=$1 AND user_id=$2",[old,a]);
    const invalid = await PUT(request("PUT",tokenA,{...layout,revision:2}), undefined);
    assert.equal(invalid.status,400);
    assert.deepEqual((await invalid.json() as {missingIds:string[]}).missingIds,[old]);
    const after = await (await GET(request("GET",tokenA), undefined)).json() as {layout:typeof layout,images:Array<{id:string;sourceImageId?:string}>};
    assert.ok(!after.layout.nodes.some(node=>node.id===old));
    assert.equal(after.images.find(image=>image.id===child)?.sourceImageId,old);
    await pool.query("UPDATE users SET status='banned' WHERE id=$1",[b]);
    assert.equal((await GET(request("GET",tokenB),undefined)).status,403);
  } finally {
    await pool.query("DELETE FROM users WHERE id IN ($1,$2)",[a,b]);
    await pool.end();
  }
});
