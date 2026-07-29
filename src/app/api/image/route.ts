import { getRequestUser } from "@/server/auth";
import { handleRoute, jsonOk, readJson } from "@/server/http";
import { generateImage } from "@/server/services/image";

// POST /api/image — generate image from text prompt
export const POST = handleRoute(async (req) => {
  const user = getRequestUser(req);
  const body = await readJson<{
    prompt?: string;
    model?: string;
    size?: string;
  }>(req);

  const result = await generateImage({
    userId: user?.userId || "",
    prompt: body.prompt || "",
    modelOverride: body.model,
    size: body.size,
  });
  return jsonOk(result);
});
