# AI 生图系统提示词 — 功能文档

> 版本：v1.0 | 日期：2026-07-16 | 项目：深焙 (doubao-app)

---

## 一、PRD（产品需求文档）

### 1.1 需求背景

用户每次文生图时，需要手动在 prompt 中加入重复的质量控制词（如"8K分辨率、光影精美、构图专业"等），操作繁琐且容易遗漏，导致出图质量不稳定。

### 1.2 产品目标

管理员可在系统设置中预设一段"图片生成系统提示词"，该提示词将**自动附加到所有用户输入的 prompt 前面**，实现统一的质量控制和风格管理，减少用户重复输入。

### 1.3 目标用户

- **管理员**：配置系统提示词
- **普通用户**：无感知，输入 prompt 即可享受附加效果

### 1.4 核心流程

```
用户输入: "一只猫"
    ↓
系统拼接:  {系统提示词} + "\n\n" + "一只猫"
    ↓
发送给 AI 模型生成图片
```

### 1.5 功能需求

| 编号 | 功能 | 说明 |
|------|------|------|
| F1 | 系统提示词配置 | 管理员在设置面板中输入/修改提示词 |
| F2 | 自动拼接 | 每次生图请求自动将系统提示词附加到用户 prompt 前 |
| F3 | 空值兼容 | 系统提示词为空时直接透传用户输入，行为不变 |
| F4 | 实时生效 | 修改后下一次生成立即应用新提示词 |

### 1.6 非功能需求

- 提示词长度限制：无硬性限制（TEXT 字段）
- 响应时间：拼接操作在服务端完成，对用户无感知
- 兼容性：对现有生图流程零影响（默认值为空字符串）

---

## 二、技术设计

### 2.1 架构概览

```
┌─────────────────┐    ┌──────────────┐    ┌─────────────┐
│  SettingsModal   │───▶│ PUT /api/     │───▶│ PostgreSQL   │
│  (前端配置面板)   │    │ config        │    │ llm_config   │
└─────────────────┘    └──────────────┘    │ image_system │
                                           │ _prompt      │
                                           └──────┬───────┘
                                                  │
┌─────────────────┐    ┌──────────────┐           │
│  ImageGenView   │───▶│ POST /api/   │◀──────────┘
│  (用户生图界面)   │    │ image        │  getConfig() 读取
└─────────────────┘    └──────────────┘
                        │
                        │ finalPrompt = imageSystemPrompt
                        │            + "\n\n" + userPrompt
                        ▼
                  ┌───────────┐
                  │  AI 模型   │
                  │  (豆包/    │
                  │  Grok等)   │
                  └───────────┘
```

### 2.2 数据库设计

**表名**: `llm_config`（已有，单行配置表）

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `image_system_prompt` | TEXT | `''` | 图片生成系统提示词 |

```sql
-- 新增字段（已通过 Drizzle migration 完成）
ALTER TABLE llm_config ADD COLUMN image_system_prompt TEXT DEFAULT '' NOT NULL;
```

### 2.3 关键代码

**配置读取** (`src/lib/config.ts`):
```typescript
export async function getConfig() {
  // 从 llm_config 表读取单行配置，包含 imageSystemPrompt 字段
}
```

**系统提示词拼接** (`src/app/api/image/route.ts:46-47`):
```typescript
const systemPrompt = config?.imageSystemPrompt || "";
const finalPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
```

**配置更新** (`src/app/api/config/route.ts:36`):
```typescript
if (body.imageSystemPrompt !== undefined) {
  updates.imageSystemPrompt = body.imageSystemPrompt;
}
```

### 2.4 前端 UI

**位置**: 设置面板 → 文生图模型下方

- **组件**: `src/components/Settings/SettingsModal.tsx`
- **标签**: "图片生成系统提示词"
- **说明**: "将在每次生图时自动附加到用户输入的提示词前面"
- **输入框**: 多行文本框（3行），placeholder: `例如：高质量、8K分辨率、构图精美、光影自然`

### 2.5 涉及的 API

| API | 方法 | 说明 |
|-----|------|------|
| `/api/config` | GET | 返回当前配置（含 `imageSystemPrompt`） |
| `/api/config` | PUT | 更新配置（可更新 `imageSystemPrompt` 字段） |
| `/api/image` | POST | 生图时读取配置并拼接 prompt |

### 2.6 TypeScript 类型

```typescript
// src/types/index.ts
export interface Config {
  arkApiKey: string;
  baseUrl: string;
  textModel: string;
  imageModel: string;
  imageSystemPrompt: string;   // ← 新增字段
  hasApiKey?: boolean;
}
```

---

## 三、测试用例

### 3.1 功能测试

| 编号 | 场景 | 操作 | 预期结果 |
|------|------|------|----------|
| TC1 | 系统提示词为空（默认） | 设置中不填任何内容，生成图片 | 直接透传用户输入的 prompt，行为与之前完全一致 |
| TC2 | 设置系统提示词 | 设置中填入 "8K高清，光影精细" | 发给 AI 的 prompt = "8K高清，光影精细\n\n用户输入" |
| TC3 | 修改系统提示词 | 从 "8K高清" 改为 "电影级画质" | 下一次生成立即使用 "电影级画质" |
| TC4 | 清空系统提示词 | 已有提示词 → 清空 → 保存 | 恢复为透传用户输入 |
| TC5 | 多行提示词 | 输入包含换行的提示词 | 正常拼接，换行保留 |
| TC6 | 与模型切换组合 | 切换生图模型（doubao/Grok/GPT-Image） | 所有模型均正确拼接系统提示词 |

### 3.2 边界测试

| 编号 | 场景 | 预期结果 |
|------|------|----------|
| TC7 | 系统提示词包含特殊字符（emoji、Unicode） | 正常拼接，不报错 |
| TC8 | 提示词超长（2000+ 字符） | 正常拼接，由 AI 模型侧处理长度限制 |
| TC9 | 未登录用户直接调 API | 返回 401，不执行拼接逻辑 |

### 3.3 回归测试

| 编号 | 场景 | 预期结果 |
|------|------|----------|
| TC10 | 积分扣除 | 系统提示词不影响积分扣除逻辑（每张图仍扣 20 积分） |
| TC11 | 积分流水记录 | 流水 note 中记录的是用户原始 prompt（不含系统提示词） |
| TC12 | 历史记录 | 管理端查看图片详情显示用户原始 prompt |

---

## 四、部署说明

### 4.1 数据库迁移

```bash
# 迁移文件已生成
drizzle/0000_loose_sumo.sql  →  image_system_prompt 字段

# 执行迁移
source .env.local && npx drizzle-kit push
```

### 4.2 影响范围

- ✅ **向后兼容**：默认值为空字符串，不影响现有用户
- ✅ **无需刷新缓存**：每次请求实时读取数据库配置
- ✅ **无需重启服务**：前端调用 PUT /api/config 即时生效

### 4.3 回滚方案

如需回滚，将 `image_system_prompt` 字段值设为空字符串即可，无需删表或改代码。

---

## 五、相关文件清单

| 文件 | 说明 |
|------|------|
| `src/types/index.ts` | Config 类型定义 |
| `src/db/schema.ts` | 数据库 schema（llm_config 表） |
| `drizzle/0000_loose_sumo.sql` | 数据库迁移 SQL |
| `src/app/api/config/route.ts` | 配置读写 API |
| `src/app/api/image/route.ts` | 生图 API（含 prompt 拼接逻辑） |
| `src/lib/config.ts` | 配置读取工具函数 |
| `src/components/Settings/SettingsModal.tsx` | 设置面板 UI |
