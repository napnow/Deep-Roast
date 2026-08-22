/**
 * Asia/Shanghai 日历日工具（签到日界）。
 * 不依赖系统本地时区：用 Intl 格式化为 en-CA 得到 YYYY-MM-DD。
 */

const SHANGHAI = "Asia/Shanghai";

/** 返回上海时区下的日历日 `YYYY-MM-DD` */
export function shanghaiToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SHANGHAI,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** 上海时区日期时间展示 `YYYY-MM-DD HH:mm` */
export function formatShanghaiDateTime(input: Date | string | null | undefined): string {
  if (!input) return "";
  const d = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SHANGHAI,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}
