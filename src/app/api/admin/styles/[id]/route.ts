import { requireActiveAdmin } from "@/server/auth";
import { handleRoute, jsonOk, readJson } from "@/server/http";
import {
  deleteStyle,
  updateStyle,
  type StyleInput,
} from "@/server/services/styles";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handleRoute(async (req, _ctx) => {
  await requireActiveAdmin(req);
  const { id } = await (_ctx as Ctx).params;
  const body = await readJson<StyleInput>(req);
  return jsonOk(await updateStyle(id, body));
});

export const DELETE = handleRoute(async (req, _ctx) => {
  await requireActiveAdmin(req);
  const { id } = await (_ctx as Ctx).params;
  return jsonOk(await deleteStyle(id));
});
