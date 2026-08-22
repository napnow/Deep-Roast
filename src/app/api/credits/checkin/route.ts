import { requireActiveUser } from "@/server/auth";
import { handleRoute, jsonOk } from "@/server/http";
import {
  checkinStatusFromUser,
  getUserRow,
  performCheckin,
} from "@/server/services/credits";

// GET /api/credits/checkin — 今日是否已签 + 奖励说明
export const GET = handleRoute(async (req) => {
  const auth = await requireActiveUser(req);
  const user = await getUserRow(auth.userId);
  const status = checkinStatusFromUser(user);
  return jsonOk({
    ...status,
    credits: user.credits,
  });
});

// POST /api/credits/checkin — 执行签到
export const POST = handleRoute(async (req) => {
  const auth = await requireActiveUser(req);
  return jsonOk(await performCheckin(auth.userId));
});
