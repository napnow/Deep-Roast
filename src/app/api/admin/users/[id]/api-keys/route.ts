import { requireActiveAdmin } from "@/server/auth";
import { ApiError, handleRoute, jsonOk, readJson } from "@/server/http";
import {
  createUserApiKeyForAdmin,
  listUserApiKeysForAdmin,
} from "@/server/services/api-keys";

type Context = { params: Promise<{ id: string }> };

export const GET = handleRoute(async (req, context: Context) => {
  await requireActiveAdmin(req);
  const { id } = await context.params;
  return jsonOk({ keys: await listUserApiKeysForAdmin(id) });
});

export const POST = handleRoute(async (req, context: Context) => {
  await requireActiveAdmin(req);
  const { id } = await context.params;
  const body = await readJson<{ name?: string }>(req);
  const name = (body.name || "").trim();
  if (!name) throw new ApiError("请输入 Key 名称", 400);
  return jsonOk(await createUserApiKeyForAdmin(id, name), 201, {
    "Cache-Control": "private, no-store",
  });
});
