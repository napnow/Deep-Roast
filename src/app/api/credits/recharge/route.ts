import { ApiError, handleRoute } from "@/server/http";

/** 模拟充值已下线 */
export const POST = handleRoute(async () => {
  throw new ApiError("充值功能已关闭，请使用每日签到获取积分", 410);
});
