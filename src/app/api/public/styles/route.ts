import { handleRoute, jsonOk } from "@/server/http";
import { listPublishedStyles } from "@/server/services/styles";

export const GET = handleRoute(async () => {
  return jsonOk({ styles: await listPublishedStyles() });
});
