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
  credits: integer("credits").notNull().default(100), // 积分余额
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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

// ── Credit Transactions ──
export const creditTransactions = pgTable("credit_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // 'recharge' | 'admin_grant' | 'admin_deduct' | 'consume' | 'signup_bonus'
  amount: integer("amount").notNull(), // 正=增加, 负=扣除
  balanceAfter: integer("balance_after").notNull(),
  planId: text("plan_id"), // 充值档位, 仅 type=recharge 时
  note: text("note"), // 管理员备注
  createdAt: timestamp("created_at").defaultNow(),
});
