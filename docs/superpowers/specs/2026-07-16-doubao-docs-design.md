# 豆包 AI Web App — 文档补全 & 生图系统提示词 设计说明

> 日期: 2026-07-16
> 状态: 已批准

## 概述

为豆包 AI Web App 补全缺失的文档（PRD + 技术文档），并实现 AI 生图系统提示词功能。

交付物：
1. **AI 生图系统提示词**（代码）— 可配置的系统提示词 + 风格预设 + 设置页编辑
2. **PRD 产品需求文档**（文档）— `docs/PRD.md`
3. **技术文档 x3**（文档）— `docs/setup.md` / `docs/api.md` / `docs/architecture.md`

---

## 模块一：AI 生图系统提示词

### 数据库

`llm_config` 表新增字段：

```sql
image_system_prompt TEXT NOT NULL DEFAULT ''
```

对应 `schema.ts` 新增列，然后执行 `npx drizzle-kit push` 同步到 PostgreSQL。

### API

`POST /api/image` 拼接规则：

```
发送给 AI 的 prompt = image_system_prompt + "\n\n" + 用户输入的 prompt
```

`image_system_prompt` 为空时行为与现在完全一致（直接透传用户输入）。

`PUT /api/config` 和 `GET /api/config` 自动支持新字段（读写 `llm_config` 整行，无需改路由）。

### 前端

**ImageGenView.tsx 变更**：输入框上方加风格预设快捷按钮：

```
[无预设] [写实摄影] [日系动漫] [油画艺术] [电影级]
```

预设值定义在 `src/types/index.ts` 常量数组中，点击后自动填入输入框。

**SettingsModal.tsx 变更**：设置弹窗新增一个 textarea：

```
图片生成系统提示词
┌──────────────────────────────────────────┐
│ 高质量、8K分辨率、构图精美、光影自然      │
└──────────────────────────────────────────┘
```

保存时随其他设置一起 `PUT /api/config`。

### 预设内容

| 预设 | 提示词内容 |
|------|-----------|
| 无预设 | (清空) |
| 写实摄影 | 超写实摄影风格，自然光，高细节，8K超清，专业构图 |
| 日系动漫 | 日系动漫风格，新海诚画风，柔和光影，治愈系，高精细度 |
| 油画艺术 | 古典油画风格，厚涂笔触，丰富色彩层次，大师级光影 |
| 电影级 | 电影级画质，cinematic lighting，景深效果，16:9宽银幕质感 |

---

## 模块二：PRD 文档

单文件 `docs/PRD.md`，面向小团队协作。

### 章节

1. **产品概述** — 产品名「深焙」、一句话定位、核心价值主张
2. **用户画像** — 目标用户（AI 使用者、内容创作者）、使用场景
3. **功能清单** — MoSCoW 优先级矩阵
   - Must: 文生文、文生图、模型切换
   - Should: 对话管理、图片历史、设置
   - Could: 多模态、Markdown 渲染
   - Won't: 多用户/登录、计费
4. **用户流程** — 文生文流程（新建→对话→查看）、文生图流程（输入→预设→生成→下载）
5. **非功能需求** — 性能（流式 SSE）、安全（API Key 加密存储）、兼容性（Chrome/Firefox/Edge）

---

## 模块三：技术文档

`docs/` 目录下 3 个文件：

### docs/setup.md
- 环境要求（Node 18+、Docker Desktop、PostgreSQL 16）
- 依赖服务启动（docker compose up -d）
- 项目安装（npm install）
- 环境变量配置（.env.local）
- 数据库迁移（npx drizzle-kit push）
- 启动项目（npm run dev → localhost:3456）
- 常见问题排查（DB 连不上、OpenAI SDK 403、图片生成失败）

### docs/api.md
- 基础信息（Base URL、Content-Type、Streaming）
- 7 个端点完整文档：
  - `POST /api/chat` — SSE 流式聊天
  - `POST /api/image` — 文生图
  - `GET/PUT /api/config` — LLM 配置
  - `GET /api/models` — 模型列表
  - `GET/POST/DELETE /api/conversations` — 对话 CRUD
  - `GET/PATCH/DELETE /api/conversations/[id]` — 单对话
  - `GET/DELETE /api/image-history` — 图片历史

### docs/architecture.md
- 技术栈一览（Next.js 16 / React 19 / TypeScript / Tailwind v4 / Drizzle / PostgreSQL）
- ASCII 架构图（Browser → Next.js → API Routes → 中转站 → AI）
- 4 条关键决策（原生 fetch 替代 OpenAI SDK、DB→env 配置链、多中转站路由、模型过滤）
- 数据流图
- 目录结构
- 数据库 ER 图（4 张表）

---

## 实施顺序

1. **代码** — schema.ts + image/route.ts + SettingsModal + ImageGenView + types
2. **数据库迁移** — `npx drizzle-kit push`
3. **文档** — PRD.md → setup.md → api.md → architecture.md
4. **验证** — 启动项目确认生图系统提示词生效
