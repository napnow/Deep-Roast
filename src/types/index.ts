// ── Shared types for doubao-app ──

export interface ImageRecord {
  id: string;
  prompt: string;
  model: string;
  imageUrl: string;
  /** webp 缩略图（列表/历史用，预览/下载仍用原图）；旧记录可能没有 */
  thumbUrl?: string;
  size: string;
  createdAt: string;
}

// ── Credits types ──
export interface CreditTransaction {
  id: string;
  userId: string;
  username?: string;
  type:
    | "recharge"
    | "checkin"
    | "admin_grant"
    | "admin_deduct"
    | "consume"
    | "signup_bonus";
  amount: number;
  balanceAfter: number;
  planId?: string | null;
  note?: string | null;
  createdAt: string;
}

/** @deprecated 模拟充值已下线，保留类型仅兼容历史流水展示 */
export const RECHARGE_PLANS: Array<{
  planId: string;
  amount: number;
  credits: number;
  label: string;
  desc: string;
  badge?: string;
}> = [];

export const CREDIT_PER_IMAGE = 5;
export const CHECKIN_REWARD = 50;

export const CREDIT_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  recharge: { label: "历史充值", color: "#10b981" },
  checkin: { label: "每日签到", color: "#10b981" },
  admin_grant: { label: "管理加积分", color: "#3b82f6" },
  admin_deduct: { label: "管理扣积分", color: "#f97316" },
  consume: { label: "生成消耗", color: "#ef4444" },
  signup_bonus: { label: "注册赠送", color: "#6b7280" },
};

export interface Announcement {
  id: string;
  body: string;
  createdAt: string;
  createdBy?: string | null;
}

export interface Config {
  arkApiKey: string;
  baseUrl: string;
  imageModel: string;
  imageSystemPrompt: string;
  /** 图推 / 反推提示词使用的视觉模型 */
  reversePromptModel: string;
  hasApiKey?: boolean;
  /** 已配置 key 的脱敏提示，如 g2a_****xxxx；不用于回传保存 */
  apiKeyHint?: string;
  /** 管理员启用的生图模型（顶栏选择器只显示这些） */
  enabledImageModels?: string[];
}

/**
 * 图推默认模型 id。空字符串 = 未写死任何模型；
 * 运行时回落 config.textModel，仍无则要求在设置里选。
 */
export const DEFAULT_REVERSE_PROMPT_MODEL = "";

export interface ModelInfo {
  id: string;
}

// ── Admin types ──
export interface AdminUser {
  id: string;
  username: string;
  role: string;
  credits: number;
  status: string;
  conversationCount: number;
  imageCount: number;
  createdAt: string;
  lastActive: string | null;
}

// ── Default models ──
export const DEFAULT_TEXT_MODELS: ModelInfo[] = [
  { id: "doubao-seed-2-0-pro-260215" },
  { id: "doubao-seed-2-0-lite-260428" },
  { id: "doubao-seed-1-8-251228" },
  { id: "doubao-seed-1-6-251015" },
  { id: "doubao-1-5-pro-32k-250115" },
  { id: "grok-4.20-fast" },
];

export const DEFAULT_IMAGE_MODELS: ModelInfo[] = [
  { id: "doubao-seedream-4-5-251128" },
  { id: "grok-imagine-image-lite" },
  { id: "gpt-image-2" },
];

// ── Image generation style presets ──
export const IMAGE_STYLE_PRESETS = [
  { label: "无预设", prompt: "" },
  { label: "写实摄影", prompt: "超写实摄影风格，自然光，高细节，8K超清，专业构图" },
  { label: "日系动漫", prompt: "日系动漫风格，新海诚画风，柔和光影，治愈系，高精细度" },
  { label: "油画艺术", prompt: "古典油画风格，厚涂笔触，丰富色彩层次，大师级光影" },
  { label: "电影级", prompt: "电影级画质，cinematic lighting，景深效果，16:9宽银幕质感" },
];

// ── Example prompts for empty state ──
// ── Relative time formatter ──
export function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);

  if (sec < 60) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  if (hr < 24) return `${hr} 小时前`;
  if (day < 7) return `${day} 天前`;
  if (day < 30) return `${Math.floor(day / 7)} 周前`;
  return new Date(dateStr).toLocaleDateString("zh-CN");
}
