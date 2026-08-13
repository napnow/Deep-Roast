import { requireActiveAdmin } from "@/server/auth";
import { handleRoute, jsonOk, readJson } from "@/server/http";
import {
  createStyle,
  listAllStyles,
  type StyleInput,
} from "@/server/services/styles";

export const GET = handleRoute(async (req) => {
  await requireActiveAdmin(req);
  return jsonOk({ styles: await listAllStyles() });
});

export const POST = handleRoute(async (req) => {
  await requireActiveAdmin(req);
  const body = await readJson<StyleInput>(req);
  return jsonOk(await createStyle(body));
});
