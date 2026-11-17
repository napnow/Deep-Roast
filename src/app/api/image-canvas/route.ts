import { z } from "zod";
import { listOwnedImagesById } from "@/server/services/image";
import { ApiError } from "@/server/http";
import { requireActiveUser } from "@/server/auth";
import { handleRoute, jsonOk, privateNoStore, readJson } from "@/server/http";
import { loadCanvas, MissingCanvasImagesError, saveCanvas } from "@/server/services/image-canvas";

export const GET = handleRoute(async req => {
  const { userId } = await requireActiveUser(req);
  return privateNoStore(jsonOk(await loadCanvas(userId)));
});

export const PUT = handleRoute(async req => {
  const { userId } = await requireActiveUser(req);
  const body = await readJson(req, { maxBytes: 128 * 1024 });
  try {
    return privateNoStore(jsonOk(await saveCanvas(userId, body)));
  } catch (error) {
    if (error instanceof MissingCanvasImagesError) {
      return privateNoStore(Response.json({ error: error.message, code: error.code, missingIds: error.missingIds }, { status: error.status }));
    }
    throw error;
  }
});

// Resolve untrusted IDs against the current account before rendering cached history.
export const POST = handleRoute(async req => {
  const { userId } = await requireActiveUser(req);
  const body = await readJson(req, { maxBytes: 128 * 1024 });
  const parsed = z.object({ ids: z.array(z.string().uuid()).max(2500) }).strict().safeParse(body);
  if (!parsed.success) throw new ApiError("作品列表无效", 400, "INVALID_CANVAS_IMAGES");
  return privateNoStore(jsonOk({ images: await listOwnedImagesById(userId, [...new Set(parsed.data.ids)]) }));
});
