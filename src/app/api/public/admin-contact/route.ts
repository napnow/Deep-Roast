import { handleRoute, jsonOk } from "@/server/http";
import { getPublicAdminContact } from "@/server/services/site-settings";

export const GET = handleRoute(async () => {
  return jsonOk(await getPublicAdminContact());
});
