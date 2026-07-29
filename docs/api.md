# API 文档

基础路径：同源 `/api/*`。除特别标注外，需登录（Cookie JWT）。  
管理接口需 `role=admin`。

错误响应通用形状：

```json
{ "error": "人类可读说明" }
```

---

## 1. 认证

### POST /api/auth/login

**公开**。请求体：`{ "username", "password" }`。成功设置 HttpOnly Cookie。

### POST /api/auth/register

**公开**（若部署关闭注册请自行改代码或反代）。创建用户并登录。

### POST /api/auth/logout

清除会话 Cookie。

### GET /api/auth/me

当前用户：`{ id, username, role, credits, ... }`。

### POST /api/auth/change-password

已登录用户修改自己的密码。请求体：`{ "currentPassword", "newPassword" }`。

---

## 2. 对话

### GET /api/conversations

当前用户会话列表。

### POST /api/conversations

创建会话。

### GET|PATCH|DELETE /api/conversations/[id]

单会话读写删（含消息，以实现为准）。

### POST /api/chat

流式文生文（SSE）。服务端读取历史、解析上游后推送 token。

---

## 3. 文生图

### POST /api/image

请求体示例：

```json
{
  "prompt": "一杯深焙咖啡，电影光",
  "model": "doubao-seedream-4-5-251128",
  "size": "1024x1024"
}
```

成功时返回本地可访问的 `imageUrl`（写入 `public/images/`）及元数据。

常见错误：

```json
{ "error": "图片生成出错: 429 Too Many Requests" }
```

**端点解析**（见 `src/server/providers/llm.ts`）:

| 模型 | 配置来源（设置页优先） | 备注 |
|------|------------------------|------|
| `grok-*` | `GROK_*` / 全局 config | 生图可多轮重试 |
| `gpt-image-2` | `GPT_IMAGE_*` / 全局 config | 部分网关有限流 |
| 其他 | 全局 `baseUrl` + Key | OpenAI 兼容 |

**返回格式兼容**:
- `url`：下载后存本地
- `b64_json`：解码后存本地

### GET|DELETE /api/image-history …

图片历史列表与删除（实现以路由为准）。

### POST /api/reverse-prompt

图生文 / 反推提示词（需上游 vision 能力）。

---

## 4. LLM 配置

### GET /api/config

获取当前配置（API Key **已脱敏**，不会返回完整密钥）。

**响应示例**:

```json
{
  "id": 1,
  "arkApiKey": "",
  "baseUrl": "https://api.example.com/v1",
  "textModel": "doubao-seed-2-0-pro-260215",
  "imageModel": "doubao-seedream-4-5-251128",
  "imageSystemPrompt": "",
  "hasApiKey": true,
  "apiKeyHint": "sk-a****wxyz",
  "enabledTextModels": ["doubao-seed-2-0-pro-260215"],
  "enabledImageModels": ["doubao-seedream-4-5-251128"],
  "updatedAt": "2026-07-29T00:00:00.000Z"
}
```

### PUT /api/config

部分更新。若 `arkApiKey` 含 `****` 掩码则**跳过**更新密钥（避免把脱敏串写回库）。

```json
{
  "baseUrl": "https://api.example.com/v1",
  "textModel": "doubao-seed-2-0-pro-260215",
  "enabledImageModels": ["doubao-seedream-4-5-251128", "gpt-image-2"]
}
```

### GET /api/models

拉取上游模型列表并分类为 text / image（依赖已配置的 Base URL + Key）。

---

## 5. 积分

### GET /api/credits …

余额与流水（以实现为准）。

管理端：`/api/admin/credits/*` 发放 / 扣减。

---

## 6. 管理后台

前缀 `/api/admin/*`，中间件校验 `role === "admin"`。

- 用户列表、会话/图片/消息审计
- 重置用户密码：`POST /api/admin/users/[id]/reset-password`
- 站点设置：登录页管理员联系方式文字与二维码  
  - `GET|PUT /api/admin/site-settings`  
  - `POST /api/admin/site-settings/contact-image`

### GET /api/public/admin-contact

**公开**。登录页展示用的联系文案与图片路径（无敏感字段）。

---

## 7. 约定

- 鉴权：Cookie `token`（JWT）；生产必须设置 `JWT_SECRET`
- 时区 / 时间：ISO 8601 字符串或 Date 序列化
- 图片静态路径：`/images/<file>`（对应 `public/images`，**不入库 git**）
