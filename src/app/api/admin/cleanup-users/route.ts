import { requireActiveAdmin } from "@/server/auth";
import { handleRoute, jsonOk } from "@/server/http";
import {
  cleanupStaleUsers,
  previewStaleUsers,
} from "@/server/services/stale-user-cleanup";

export const GET = handleRoute(async (req) => {
  await requireActiveAdmin(req);
  return jsonOk(await previewStaleUsers());
});

export const POST = handleRoute(async (req) => {
  await requireActiveAdmin(req);
  return jsonOk(await cleanupStaleUsers());
});
