# 系统架构文档

## 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 框架 | Next.js (App Router) | 16.2.10 |
| UI 库 | React | 19.2.4 |
| 语言 | TypeScript | 5.x |
| 样式 | Tailwind CSS | 4.x |
| ORM | Drizzle ORM | 0.45.2 |
| 数据库 | PostgreSQL | 14+（推荐 16） |
| 状态 | Zustand | 5.x |
| 认证 | jose (JWT Cookie) + bcryptjs | — |

> 早期草案曾依赖 Redis / MinIO；当前开源版以 **PostgreSQL + 本地 `public/images`** 为主，无需额外对象存储即可跑通。

## 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                       Browser                           │
│         http://localhost:3000                           │
└──────────┬──────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────┐
│                 Next.js App Router                       │
│                                                         │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ page.tsx │  │ components/  │  │    globals.css    │  │
│  │ (主编排)  │  │ Chat/        │  │  Deep Roast       │  │
│  │          │  │ ImageGen/    │  │  Atelier tokens   │  │
│  │          │  │ Settings/    │  │                   │  │
│  │          │  │ Header/      │  │                   │  │
│  │          │  │ Sidebar/     │  │                   │  │
│  └──────────┘  └──────────────┘  └───────────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │                  API Routes                       │   │
│  │                                                   │   │
│  │  /api/chat        → SSE 流式 → OpenAI 兼容上游    │   │
│  │  /api/image       → 原生 fetch → 按模型解析端点    │   │
│  │  /api/reverse-prompt → vision 模型反推/图析        │   │
│  │  /api/config      → GET/PUT → PostgreSQL          │   │
│  │  /api/models      → GET|POST → 上游 /models 分类   │   │
│  │  /api/credits/*   → 签到 / 流水（充值已 410）      │   │
│  │  /api/conversations → CRUD → PostgreSQL           │   │
│  │  /api/image-history → CRUD → PostgreSQL + fs      │   │
│  │  /api/auth/*      → 登录 / 注册 / 改密             │   │
│  │  /api/admin/*     → 管理后台（需 admin 角色）       │   │
│  │  /api/public/*    → 登录页联系方式 / 公告          │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │                  Data Layer                       │   │
│  │  src/db/schema.ts  (users / conversations / …)    │   │
│  │  src/db/index.ts   (Drizzle client)               │   │
│  │  src/lib/config.ts (DB → env fallback)            │   │
│  └──────────────────────────────────────────────────┘   │
└──────────┬──────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────┐
│                    External Services                     │
│                                                         │
│  任意 OpenAI 兼容网关（自配 Base URL + API Key）         │
│  可选：按模型分流到不同 env（GROK_* / GPT_IMAGE_* 等）   │
│                                                         │
│  PostgreSQL（必填）                                      │
└─────────────────────────────────────────────────────────┘
```

## 关键架构决策

### 1. 服务端代理上游，浏览器不直连 Key

**决策**: 聊天与生图均由 `src/app/api/*` 在服务端调用上游；API Key 只存在 DB / 环境变量。

**原因**: 避免 Key 泄露到前端；统一处理流式 SSE、重试与错误文案。

**影响范围**:
- `src/app/api/chat` — SSE / ReadableStream
- `src/app/api/image` — 下载或解码后写入 `public/images/`
- `src/server/providers/llm.ts` — 按模型解析 endpoint

### 2. 配置读取链：DB → 环境变量

**决策**: `getConfig()` 先读 PostgreSQL `llm_config`；Key 为空时再 fallback 到 `.env.local`。

**原因**: 设置页可改配置并持久化，同时保留 env 作为初始/部署注入方式。

```typescript
const apiKey = config.arkApiKey || process.env.ARK_API_KEY || "";
```

### 3. 按模型解析上游端点（无硬编码第三方默认地址）

**决策**: `resolveChatEndpoint` / `resolveImageEndpoint` 根据模型 id 前缀选择 Key / Base URL 来源（设置页优先，其次 env）。**不内置**任何商业中转默认 URL。

**常见分流**（均可在 env 覆盖）:
- `grok-*` → `GROK_API_KEY` / `GROK_BASE_URL`（生图可多一次重试）
- `gpt-image-2` → `GPT_IMAGE_KEY` / `GPT_IMAGE_BASE_URL`
- 其他 → 设置页 `baseUrl` + `arkApiKey` / `ARK_API_KEY`

### 4. 模型列表：上游全量 + 本地分类

**决策**: `GET|POST /api/models` 请求上游 `/models`，再按 id 模式分为文生文 / 文生图（如 seedream / imagine / dall / flux / `gpt-image-2` 等）。设置页可对文/图勾选启用列表；**图推模型**为单选，从文本/多模态目录点选，写入 `llm_config.reverse_prompt_model`（空则运行时回落 `textModel`）。

**原因**: 不同网关返回的模型集合差异大；产品侧用规则归类，并允许设置页启用子集；图推不写死某一 vision 模型 id。

### 5. config 表 `updatedAt` 必须是 Date 对象

**教训**: Drizzle 的 timestamp 列不接受 string，必须传 `new Date()`。传 string 会导致 500。

### 6. 生产必须设置 `JWT_SECRET`

**决策**: `src/lib/auth.ts` 与 `src/middleware.ts` 在 `NODE_ENV=production` 且未设置 `JWT_SECRET` 时直接失败。

**原因**: 避免静默使用开发弱密钥上线。

## 数据流

### 文生文流程

```
用户输入消息
  → 前端 action / store
  → POST /api/chat
  → getConfig() + 对话历史
  → resolveChatEndpoint(model)
  → fetch(上游 /chat/completions, { stream: true })
  → SSE 推送 token
  → 结束后写入 messages 表
```

### 文生图流程

```
用户输入 prompt（可选风格预设）
  → POST /api/image
  → getConfig() + imageSystemPrompt
  → resolveImageEndpoint(model)
  → fetch(上游 /images/generations)
  → url 下载 或 b64_json 解码 → public/images/<uuid>.png
  → 插入 image_generations
  → 返回 imageUrl 供前端历史面板
```

## 目录要点

| 路径 | 职责 |
|------|------|
| `src/app/api/` | HTTP 边界 |
| `src/server/services/` | 业务逻辑 |
| `src/server/providers/` | 上游 LLM 解析 |
| `src/db/` | schema / seed / client |
| `src/components/` | UI |
| `src/lib/` | 客户端 store、config 辅助、auth |
| `drizzle/` | SQL 迁移 |
| `docs/setup.md` | 部署说明 |

## 安全注意

- 不要提交 `.env.local`、用户上传图、生成图
- 公网开放注册前评估滥用与积分策略
- 首次 seed 后立即修改管理员密码（或设置 `ADMIN_PASSWORD`）
