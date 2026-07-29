# 用户管理系统 — 设计文档

**日期**: 2026-07-16  
**项目**: doubao-app  
**目标**: 为现有豆包 AI 对话应用添加多用户系统和管理员数据面板

---

## 1. 概述

### 1.1 当前状态

doubao-app 是一个单用户 AI 对话工具（文生文 + 文生图），无任何身份认证。任何人打开页面就能使用，所有对话和图片数据共享。

### 1.2 目标

- 多用户：每个用户注册登录后拥有独立的对话和图片记录
- 管理员面板：admin 角色可在 `/admin` 页面查看所有用户的使用数据

### 1.3 范围

- 用户名 + 密码注册登录（简单方案，无邮箱验证）
- 两个角色：user（普通用户）、admin（管理员）
- 管理员面板展示：用户列表、对话记录、消息内容、图片生成记录
- 现有功能对普通用户保持不变，只叠加用户隔离

---

## 2. 认证方案

**选择：手动 JWT + httpOnly Cookie**

- 依赖：`jose`（轻量 JWT 签名/验证）、`bcryptjs`（密码哈希）
- JWT 存在 httpOnly + secure + sameSite=lax cookie，有效期 7 天
- Next.js Middleware 统一拦截校验

---

## 3. 数据库设计

### 3.1 新增 `users` 表

| 列 | 类型 | 约束 |
|----|------|------|
| id | uuid | PK, defaultRandom |
| username | text | UNIQUE, NOT NULL |
| password | text | NOT NULL（bcrypt hash） |
| role | text | NOT NULL, default 'user'（'user' \| 'admin'） |
| createdAt | timestamp | defaultNow |
| updatedAt | timestamp | defaultNow |

### 3.2 修改现有表

**conversations** 新增：
- `userId` uuid REFERENCES users(id) ON DELETE CASCADE

**image_generations** 新增：
- `userId` uuid REFERENCES users(id) ON DELETE CASCADE

### 3.3 种子数据

`seed.ts` 新增逻辑：
```
1. 检查 users 表是否有 admin 角色
2. 如果没有，创建默认 admin 账号
   - username: "admin"
   - password: 环境变量 ADMIN_PASSWORD 或随机生成并打印到控制台
```

### 3.4 迁移

- 用 Drizzle Kit 生成迁移文件
- 生产环境注意：给现有数据的 `userId` 设一个默认值（比如关联到 admin）

---

## 4. API 设计

### 4.1 认证 API（`/api/auth`）

| 方法 | 路径 | 功能 | 鉴权 |
|------|------|------|------|
| POST | /api/auth/register | 注册（username, password） | 无 |
| POST | /api/auth/login | 登录，设 cookie | 无 |
| POST | /api/auth/logout | 清除 cookie | 需登录 |
| GET | /api/auth/me | 返回当前用户 {id, username, role} | 需登录 |

- 密码用 bcryptjs hash，注册时用户名重复返回 409
- JWT payload: `{ userId, username, role }`，用 jose SignJWT 签发
- Cookie: `token=xxx; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`

### 4.2 管理员 API（`/api/admin`）

所有接口需 admin role，Middleware 层校验。

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | /api/admin/users | 用户列表（含统计：对话数、图片数、注册时间） |
| GET | /api/admin/users/:id/conversations | 某用户的对话列表 |
| GET | /api/admin/users/:id/conversations/:cid/messages | 某对话的全部消息 |
| GET | /api/admin/users/:id/images | 某用户的图片生成记录 |

- 对话数、图片数用 Drizzle count 聚合，不额外建表
- 最后活跃时间取 conversations 和 image_generations 中最新的 createdAt

### 4.3 修改现有 API

所有现有数据 API（conversations、image-history）加上 `userId` 过滤：

- 从 cookie JWT 中解出 userId
- 查询时加 `eq(schema.xxx.userId, userId)`
- chat 路由创建对话时写入 userId

---

## 5. Middleware 鉴权

`src/middleware.ts`：

```
/api/admin/*    → 校验 JWT 且 role === 'admin'，否则 403
/api/auth/*     → 放行（register/login 无需鉴权）
/api/*          → 校验 JWT 存在，否则 401
/               → 页面路由不拦截（组件内用 useAuth 兜底）
```

匹配规则用 Next.js matcher config。

---

## 6. 前端设计

### 6.1 路由

| 路径 | 访问要求 | 说明 |
|------|----------|------|
| /login | 公开 | 登录/注册页 |
| / | 需登录 | 首页，现有功能不变 |
| /admin | 需 admin | 管理员面板 |

### 6.2 登录/注册页（`/login`）

- 居中卡片，顶部 Login / Register Tab 切换
- 表单：用户名 + 密码，提交按钮
- 错误信息显示在表单顶部（红色提示）
- 成功后自动跳转到首页 `/`
- 已登录用户访问此页 → 重定向到 `/`

### 6.3 Header 改造

在现有 Header 右侧新增用户区域：
- 显示当前用户名
- admin 用户显示「管理面板」链接按钮
- 「退出」按钮

### 6.4 管理员面板（`/admin`）

左右分栏布局：
- **左侧面板**：用户列表表格
  - 列：用户名、角色、对话数、图片数、注册时间、最后活跃
  - 点击某行选中
- **右侧面板**：选中用户的详情
  - 对话列表（标题、消息数、时间）
  - 展开对话可查看完整消息内容
  - 图片生成记录（缩略图 + prompt + 模型 + 时间）

### 6.5 状态管理

- 用户信息通过 `useAuth()` hook 获取（调用 `/api/auth/me`）
- 未登录状态 → 显示加载或重定向
- 页面路由保护：`layout.tsx` 或各页面组件中用 `useAuth` 检查 + `router.push('/login')`

---

## 7. 实施步骤

按依赖关系分为 6 步：

### Step 1: 数据层
- 新增 `users` 表到 `schema.ts`
- 给 `conversations` 和 `image_generations` 加 `userId` 字段
- 重新生成 Drizzle 迁移
- 更新 `seed.ts` 创建默认 admin

### Step 2: 认证 API
- `POST /api/auth/register`、`/api/auth/login`、`/api/auth/logout`、`GET /api/auth/me`
- bcrypt hash + jose JWT + httpOnly cookie
- `src/lib/auth.ts` 提取公共鉴权函数（`signToken`, `verifyToken`, `getCurrentUser`）

### Step 3: Middleware
- `src/middleware.ts` 统一拦截 API 路由

### Step 4: 改造现有 API
- conversations、image-history 路由加 `userId` 过滤
- chat 路由创建对话时关联当前用户

### Step 5: 前端 — 登录注册 + Header
- `/login` 页面
- `useAuth` hook
- Header 用户区域改造

### Step 6: 管理员面板
- `/admin` 页面（用户列表 + 用户详情）
- 管理员 API 对接

---

## 8. 依赖

新增 npm 包：
- `jose` — JWT 签名与验证
- `bcryptjs` — 密码哈希（纯 JS，无需编译）
- `@types/bcryptjs` — 类型定义

---

## 9. 安全考虑

- 密码 bcrypt hash，永不明文存储
- JWT 在 httpOnly cookie 中，JS 不可访问，防 XSS
- Cookie secure flag（生产环境 HTTPS）
- SameSite=Lax 防 CSRF
- Middleware 层统一鉴权，不遗漏接口
- admin API 双重校验（cookie JWT role 检查）
