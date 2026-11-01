import { requireActiveUser } from "@/server/auth";
import { handleRoute, jsonOk, readJson } from "@/server/http";
import { changeOwnPassword } from "@/server/services/auth-password";

export const POST = handleRoute(async (req) => {
  const user = await requireActiveUser(req);

  const body = await readJson<{ oldPassword?: string; newPassword?: string }>(
    req,
  );
  await changeOwnPassword(
    user.userId,
    body.oldPassword || "",
    body.newPassword || "",
  );
  return jsonOk({ success: true });
});
