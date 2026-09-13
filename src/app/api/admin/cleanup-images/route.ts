import { requireActiveAdmin } from "@/server/auth";
import { handleRoute, jsonOk } from "@/server/http";
import {
  cleanupImages,
  previewImageCleanup,
} from "@/server/services/admin-image-cleanup";

export const GET = handleRoute(async (req) => {
  await requireActiveAdmin(req);
  return jsonOk(await previewImageCleanup());
});

export const POST = handleRoute(async (req) => {
  await requireActiveAdmin(req);
  return jsonOk(await cleanupImages());
});
