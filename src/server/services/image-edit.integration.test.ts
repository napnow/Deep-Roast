import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const testUrl = process.env.TEST_CANVAS_DATABASE_URL;
test("real edit workflow snapshots an authorized parent and persists both branches", { skip: !testUrl }, async () => {
  const url = new URL(testUrl!);
  assert.ok(["postgres:", "postgresql:"].includes(url.protocol) && ["127.0.0.1", "localhost", "::1", "[::1]"].includes(url.hostname) && url.pathname.slice(1).startsWith("deeproast_canvas_test_") && !url.search && !url.hash);
  process.env.DATABASE_URL = testUrl;
  process.env.GPT_IMAGE_KEY = "synthetic-only";
  process.env.GPT_IMAGE_BASE_URL = "https://upstream.invalid/v1";
  const root = await mkdtemp(path.join(process.cwd(), ".release-work", "canvas-edit-test-"));
  process.env.DEEPROAST_DATA_DIR = root;
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: testUrl });
  const previousFetch = globalThis.fetch;
  const owner = randomUUID(), other = randomUUID(), parent = randomUUID(), key = `${randomUUID()}.png`;
  let insertedConfig = false;
  try {
    assert.equal(Number((await pool.query("SELECT count(*) FROM llm_config")).rows[0].count), 0);
    assert.equal(Number((await pool.query("SELECT count(*) FROM llm_channels")).rows[0].count), 0);
    await pool.query("INSERT INTO llm_config(id) VALUES (1)");
    insertedConfig = true;
    await pool.query("INSERT INTO users(id,username,password) VALUES ($1,$2,'fixture'),($3,$4,'fixture')", [owner, `edit-${owner}`, other, `edit-${other}`]);
    const sharp = (await import("sharp")).default;
    const png = await sharp({create:{width:32,height:32,channels:3,background:"#865b44"}}).png().toBuffer();
    await mkdir(path.join(root,"images"), {recursive:true});
    await writeFile(path.join(root,"images",key),png);
    const imageUrl = `/api/images/${key}`;
    await pool.query("INSERT INTO image_generations(id,user_id,prompt,image_url,storage_key) VALUES ($1,$2,'parent',$3,$4)",[parent,owner,imageUrl,key]);
    let calls = 0;
    globalThis.fetch = async (input, init) => {
      assert.equal(String(input), "https://upstream.invalid/v1/images/edits");
      const payload = JSON.parse(String(init?.body)) as {image:string};
      assert.ok(payload.image.startsWith("data:image/png;base64,"));
      calls++;
      if (calls === 1) {
        await pool.query("DELETE FROM image_generations WHERE id=$1",[parent]);
        await rm(path.join(root,"images",key));
      }
      return Response.json({data:[{b64_json:png.toString("base64")}]});
    };
    const { runImageEditTasks } = await import("./image");
    const request = { mode:"per-image" as const, items:[{image:imageUrl, sourceImageId:parent, prompt:"make a variation"}] };
    await assert.rejects(() => runImageEditTasks({userId:other,role:"admin",request}), /来源作品不可用/);
    assert.equal(calls,0);
    const result = await runImageEditTasks({userId:owner,role:"admin",request,count:2});
    assert.equal(result.succeeded,2);
    assert.equal(calls,2);
    const rows = await pool.query("SELECT source_image_id,version_group_id FROM image_generations WHERE user_id=$1",[owner]);
    assert.equal(rows.rowCount,2);
    for (const row of rows.rows) { assert.equal(row.source_image_id,parent); assert.equal(row.version_group_id,parent); }
  } finally {
    globalThis.fetch = previousFetch;
    await pool.query("DELETE FROM users WHERE id IN ($1,$2)",[owner,other]);
    if (insertedConfig) await pool.query("DELETE FROM llm_config WHERE id=1");
    await pool.end();
    await rm(root,{recursive:true,force:true});
  }
});

