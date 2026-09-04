import { requireActiveUser } from "@/server/auth";
import { handleRoute, jsonOk, privateNoStore } from "@/server/http";
import { enforceRateLimit } from "@/server/rate-limit";
import { rotateApiKey } from "@/server/services/api-keys";

type Context = { params: Promise<{ id: string }> };

const rotateHandler = handleRoute(async (req, context: Context) => {
  const user = await requireActiveUser(req);
  await enforceRateLimit("api-key-rotate", user.userId, 10, 60 * 60);
  const { id } = await context.params;
  return jsonOk(await rotateApiKey(user.userId, id), 200, {
    "Cache-Control": "private, no-store",
  });
});

export async function POST(req: Request, context: Context) {
  return privateNoStore(await rotateHandler(req, context));
}
