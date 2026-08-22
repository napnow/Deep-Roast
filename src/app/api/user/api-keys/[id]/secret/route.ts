import { requireActiveUser } from "@/server/auth";
import { handleRoute, jsonOk, privateNoStore } from "@/server/http";
import { getApiKeySecret } from "@/server/services/api-keys";

type Context = { params: Promise<{ id: string }> };

const secretHandler = handleRoute(async (req, context: Context) => {
  const user = await requireActiveUser(req);
  const { id } = await context.params;
  return jsonOk(await getApiKeySecret(user.userId, id), 200, {
    "Cache-Control": "private, no-store",
  });
});

export async function GET(req: Request, context: Context) {
  return privateNoStore(await secretHandler(req, context));
}
