import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  timestamp,
  check,
  uuid,
} from "drizzle-orm/pg-core";

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
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    singleRowCheck: check("site_settings_single_row", sql`${table.id} = 1`),
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
  /** 上次签到的 Asia/Shanghai 日历日 YYYY-MM-DD */
  lastCheckinOn: text("last_checkin_on"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ── Site announcements ──
export const announcements = pgTable("announcements", {
  id: uuid("id").defaultRandom().primaryKey(),
  body: text("body").notNull(),
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
  type: text("type").notNull(), // 'checkin' | 'recharge' | 'admin_grant' | 'admin_deduct' | 'consume' | 'signup_bonus'
  amount: integer("amount").notNull(), // 正=增加, 负=扣除
  balanceAfter: integer("balance_after").notNull(),
  planId: text("plan_id"), // 充值档位, 仅 type=recharge 时
  note: text("note"), // 管理员备注
  createdAt: timestamp("created_at").defaultNow(),
});
