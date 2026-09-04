import { requireActiveAdmin } from "@/server/auth";
import { handleRoute, jsonOk, readJson } from "@/server/http";
import {
  deleteUserApiKeyForAdmin,
  normalizeApiKeyStatus,
  updateUserApiKeyStatusForAdmin,
} from "@/server/services/api-keys";

type Context = { params: Promise<{ id: string; keyId: string }> };

export const PATCH = handleRoute(async (req, context: Context) => {
  await requireActiveAdmin(req);
  const { id, keyId } = await context.params;
  const body = await readJson<{ status?: unknown }>(req);
  return jsonOk(
    await updateUserApiKeyStatusForAdmin(
      id,
      keyId,
      normalizeApiKeyStatus(body.status),
    ),
  );
});

export const DELETE = handleRoute(async (req, context: Context) => {
  await requireActiveAdmin(req);
  const { id, keyId } = await context.params;
  await deleteUserApiKeyForAdmin(id, keyId);
  return jsonOk({ success: true });
});
