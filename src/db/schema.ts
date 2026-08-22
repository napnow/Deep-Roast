import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  check,
  uuid,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { MessageMetadata } from "@/types";

// ── LLM Config (single row) ──
export const llmConfig = pgTable(
  "llm_config",
  {
    id: integer("id").primaryKey().default(1),
    arkApiKey: text("ark_api_key").notNull().default(""),
    baseUrl: text("base_url")
      .notNull()
      .default(""),
    textModel: text("text_model")
      .notNull()
      .default("doubao-seed-2-0-pro-260215"),
    imageModel: text("image_model")
      .notNull()
      .default("doubao-seedream-4-5-251128"),
    imageSystemPrompt: text("image_system_prompt")
      .notNull()
      .default(""),
    assistantImagePrompt: text("assistant_image_prompt")
      .notNull()
      .default(""),
    /** 图推 / 反推提示词所用的视觉模型（可在设置页从 API 目录选择；空则回落 textModel） */
    reversePromptModel: text("reverse_prompt_model")
      .notNull()
      .default(""),
    // JSON 数组字符串：用户启用的模型 id 列表（设置页勾选，顶栏只显示这些）
    enabledTextModels: text("enabled_text_models")
      .notNull()
      .default(
        '["doubao-seed-2-0-pro-260215","doubao-seed-2-0-lite-260428","grok-4.20-fast"]',
      ),
    enabledImageModels: text("enabled_image_models")
      .notNull()
      .default(
        '["doubao-seedream-4-5-251128","grok-imagine-image-lite","gpt-image-2"]',
      ),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    singleRowCheck: check("llm_config_single_row", sql`${table.id} = 1`),
  }),
);

// ── Site settings (single row): admin contact on login, etc. ──
export const siteSettings = pgTable(
  "site_settings",
  {
    id: integer("id").primaryKey().default(1),
    adminContactText: text("admin_contact_text").notNull().default(""),
    adminContactImagePath: text("admin_contact_image_path")
      .notNull()
      .default(""),
    /** 是否开放注册；关闭后 register API 与登录页注册入口不可用 */
    registrationEnabled: integer("registration_enabled").notNull().default(1), // 1=开 0=关
    /** 普通用户生图总开关；管理员不受影响 */
    imageGenerationEnabled: integer("image_generation_enabled")
      .notNull()
      .default(1),
    /** 打赏功能开关（1=开 0=关）；关闭后用户端打赏入口隐藏 */
    donationEnabled: integer("donation_enabled").notNull().default(1),
    /** 打赏收款码图片路径（public/uploads/donation/ 下） */
    donationImagePath: text("donation_image_path").notNull().default(""),
    /** 打赏弹窗展示的自定义文案，空则显示默认文案 */
    donationText: text("donation_text").notNull().default(""),
    /** 邀请功能开关（1=开 0=关） */
    invitationEnabled: integer("invitation_enabled").notNull().default(1),
    /** 每次成功邀请奖励积分，允许为 0 */
    invitationReward: integer("invitation_reward").notNull().default(200),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    singleRowCheck: check("site_settings_single_row", sql`${table.id} = 1`),
    invitationRewardNonNegative: check(
      "site_settings_invitation_reward_non_negative",
      sql`${table.invitationReward} >= 0`,
    ),
  }),
);

// ── Users ──
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"), // 'user' | 'admin'
  credits: integer("credits").notNull().default(50), // 积分余额（新用户注册赠送 50）
  /** active | banned */
  status: text("status").notNull().default("active"),
  /** 普通用户固定邀请代码；管理员保持 NULL */
  inviteCode: text("invite_code").unique(),
  /** 上次签到的 Asia/Shanghai 日历日 YYYY-MM-DD */
  lastCheckinOn: text("last_checkin_on"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ── Site announcements ──
export const announcements = pgTable("announcements", {
  id: uuid("id").defaultRandom().primaryKey(),
  body: text("body").notNull(),
  pinned: boolean("pinned").default(false).notNull(),
  createdBy: uuid("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── 注册 IP 记录：单 IP 限注册一个账号（防批量注册） ──
export const registrationRecords = pgTable("registration_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** 注册时客户端 IP（nginx 反代时应配置 X-Forwarded-For 覆盖为真实地址） */
  ip: text("ip").notNull().unique(),
  username: text("username").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── 用户邀请关系：账号删除后保留用户名快照和奖励历史 ──
export const userInvitations = pgTable(
  "user_invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    inviterId: uuid("inviter_id").references(() => users.id, {
      onDelete: "set null",
    }),
    inviteeId: uuid("invitee_id").references(() => users.id, {
      onDelete: "set null",
    }),
    inviterUsername: text("inviter_username").notNull(),
    inviteeUsername: text("invitee_username").notNull(),
    rewardAmount: integer("reward_amount").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    inviteeUnique: uniqueIndex("user_invitations_invitee_unique").on(
      table.inviteeId,
    ),
    rewardNonNegative: check(
      "user_invitations_reward_non_negative",
      sql`${table.rewardAmount} >= 0`,
    ),
  }),
);

// ── Conversations ──
export const conversations = pgTable("conversations", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull().default("新对话"),
  model: text("model").notNull().default("doubao-seed-2-0-pro-260215"),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ── Messages ──
export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // 'user' | 'assistant' | 'system'
  content: text("content").notNull(),
  metadata: jsonb("metadata")
    .$type<MessageMetadata>()
    .notNull()
    .default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── Image Generations ──
export const imageGenerations = pgTable("image_generations", {
  id: uuid("id").defaultRandom().primaryKey(),
  prompt: text("prompt").notNull(),
  model: text("model").notNull().default("doubao-seedream-4-5-251128"),
  imageUrl: text("image_url").notNull(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  size: text("size").notNull().default("1024x1024"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── 图生图风格预设（管理端维护，published=1 才对普通用户可见） ──
export const styles = pgTable("styles", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** 风格标识（英文小写连字符），前端用作风格 id，如 "zine" */
  styleKey: text("style_key").notNull().unique(),
  /** 显示名称，如 "极简 Zine 海报" */
  label: text("label").notNull(),
  /** 风格规则文本，拼接在用户描述前，含 {color}/{texture} 槽位 */
  prefix: text("prefix").notNull(),
  /** 可选强调色（JSON 数组字符串，如 ["cobalt-blue"]） */
  colors: text("colors").notNull().default("[]"),
  /** 可选纹理（JSON 数组字符串） */
  textures: text("textures").notNull().default("[]"),
  /** 1=对普通用户公开（上架） 0=仅管理端测试可见（下架） */
  published: integer("published").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ── Credit Transactions ──
export const creditTransactions = pgTable("credit_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // 'checkin' | 'recharge' | 'admin_grant' | 'admin_deduct' | 'consume' | 'signup_bonus' | 'invite_reward'
  amount: integer("amount").notNull(), // 正=增加, 负=扣除
  balanceAfter: integer("balance_after").notNull(),
  planId: text("plan_id"), // 充值档位, 仅 type=recharge 时
  note: text("note"), // 管理员备注
  createdAt: timestamp("created_at").defaultNow(),
});

// ── API Keys（中转）──
export const apiKeys = pgTable("api_keys", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /** 展示名（用户备注用途） */
  name: text("name").notNull().default(""),
  /** key 的 SHA-256 哈希（明文只在创建时展示一次） */
  keyHash: text("key_hash").notNull().unique(),
  /** 前缀（用于列表展示，如 sk-dr-a1b2…） */
  keyPrefix: text("key_prefix").notNull(),
  /** AES-256-GCM 密文；旧 Key 为空 */
  keyCiphertext: text("key_ciphertext"),
  /** AES-256-GCM 初始化向量；旧 Key 为空 */
  keyIv: text("key_iv"),
  /** AES-256-GCM 认证标签；旧 Key 为空 */
  keyAuthTag: text("key_auth_tag"),
  /** active | disabled */
  status: text("status").notNull().default("active"),
  usageCount: integer("usage_count").notNull().default(0),
  creditsConsumed: integer("credits_consumed").notNull().default(0),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── Cards（卡片功能）──
export const cards = pgTable("cards", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("未命名卡片"),
  config: jsonb("config").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
