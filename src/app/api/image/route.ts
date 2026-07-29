import { requireActiveUser } from "@/server/auth";
import { handleRoute, jsonOk, readJson } from "@/server/http";
import { generateImage } from "@/server/services/image";

// POST /api/image — generate image from text prompt
export const POST = handleRoute(async (req) => {
  const user = await requireActiveUser(req);
  const body = await readJson<{
    prompt?: string;
    model?: string;
    size?: string;
  }>(req);

  const result = await generateImage({
    userId: user.userId,
    role: user.role,
    prompt: body.prompt || "",
    modelOverride: body.model,
    size: body.size,
  });
  return jsonOk(result);
});
