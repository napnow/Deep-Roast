# 修改密码 + 管理员重置密码 — 设计规格

> 日期：2026-07-29  
> 状态：待用户确认 spec 后进入实现计划  
> 背景：用户无邮箱；忘记密码采用管理员重置；已登录可自助改密

## 1. 问题与目标

### 问题
- 登录仅支持 `username + password`，无邮箱/手机，无法做邮件找回。
- 用户忘记密码后没有官方路径，只能改库，体验与安全都差。
- 已登录用户无法在 UI 内更换密码。

### 目标
1. **已登录用户**可自助修改密码（校验旧密码）。
2. **管理员**可在后台为任意用户重置密码（用户无法登录时的出路）。
3. **登录页**明确告知：忘记密码请联系管理员。
4. 统一密码最小长度策略为 **8** 位。

### 非目标（本轮不做）
- 邮箱 / 短信 / 魔法链接找回
- 「下次登录必须改密」强制流与会话吊销表
- 多设备会话失效
- GitHub 开源清洁、全局 LLM 配置 per-user 隔离
- 支付或积分相关改动

## 2. 方案选择

| 方案 | 说明 | 结论 |
|------|------|------|
| 邮件重置 | 需邮箱 + SMTP | 当前无邮箱字段，不做 |
| 仅管理员重置 | 锁死可救，日常改密不便 | 不够 |
| 仅自助改密 | 忘密码仍无解 | 不够 |
| **自助改密 + 管理员重置** | 覆盖日常与锁死 | **采用** |

管理员重置采用：**手填新密码** 或 **一键生成临时密码（仅展示一次）**。

## 3. 架构与数据流

```text
[已登录]
  UserMenu「修改密码」
    → ChangePasswordModal
    → POST /api/auth/change-password { oldPassword, newPassword }
    → 校验旧密码 → bcrypt 更新 users.password

[无法登录]
  登录页文案「请联系管理员」
    → Admin 用户列表「重置密码」
    → ResetPasswordModal（手填或生成）
    → POST /api/admin/users/:id/reset-password
    → requireAdmin → bcrypt 更新 → 可选返回 temporaryPassword
```

### 数据模型
- **不修改** `users` 表结构。
- 仍使用现有 `password`（bcrypt hash）与 `updatedAt`。
- 不新增 token / reset 表（管理员即时写入新 hash，无需邮件 token）。

## 4. API 设计

### 4.1 自助改密

`POST /api/auth/change-password`

- **鉴权**：已登录（middleware 注入的用户；与其它 `/api/*` 一致）。
- **Body**：
  ```json
  { "oldPassword": "string", "newPassword": "string" }
  ```
- **规则**：
  - `oldPassword`、`newPassword` 必填
  - `newPassword.length >= 8`
  - `newPassword !== oldPassword`
  - `comparePassword(oldPassword, user.password)` 必须通过
- **成功**：`200 { "success": true }`
- **失败**：
  - `400` 参数/长度/新旧相同
  - `401` 未登录或旧密码错误（旧密码错误文案：「旧密码不正确」）
  - `404` 用户不存在（极端）
- **会话**：成功后保持当前 cookie，不强制重新登录。

### 4.2 管理员重置

`POST /api/admin/users/[id]/reset-password`

- **鉴权**：`role === admin`（现有 admin API 模式）。
- **Body**（二选一）：
  ```json
  { "password": "string" }
  ```
  或
  ```json
  { "generate": true }
  ```
- **规则**：
  - 目标用户必须存在
  - 手填时 `password.length >= 8`
  - `generate: true` 时服务端生成 **12 位** 密码（字母+数字，排除易混字符 `0OIl1` 可选，默认字母数字即可）
- **成功**：
  ```json
  {
    "success": true,
    "username": "alice",
    "temporaryPassword": "仅 generate 时返回"
  }
  ```
  手填模式**不**在响应中回显密码。
- **失败**：`400` / `403` / `404`

### 4.3 注册策略对齐

`POST /api/auth/register`：密码最小长度由 **4 改为 8**，错误文案同步。

## 5. UI 设计

### 5.1 用户菜单 — 修改密码
- 文件：`Header/UserMenu.tsx` 增加菜单项「修改密码」。
- 新组件：`ChangePasswordModal`（或 `components/Auth/ChangePasswordModal.tsx`）。
- 字段：旧密码、新密码、确认新密码；提交前前端校验一致与长度。
- 成功：toast + 关弹窗；失败：展示服务端 `error`。

### 5.2 管理后台 — 重置密码
- 用户列表操作列增加「重置密码」。
- 弹层：
  - 默认：新密码 + 确认；或
  - 按钮「生成随机密码」调用 `generate: true`，成功后只读展示 `temporaryPassword` + 一键复制。
- 文案提示：请妥善告知用户；生成密码仅显示一次。

### 5.3 登录页
- 登录 Tab 下方：
  > 忘记密码？请联系管理员重置
- 灰色小字，无独立路由。

## 6. 服务端实现要点

- 复用 `src/lib/auth.ts` 的 `hashPassword` / `comparePassword`。
- 业务逻辑可放在 `src/server/services/auth-password.ts`（或等价），route 保持薄。
- Admin 路由与现有 `src/app/api/admin/users/...` 风格一致：`handleRoute` + `requireAdmin`（若 admin 路由当前手写校验，跟随现有模式，不强行大重构）。
- 生成密码：`crypto.randomBytes` 映射到安全字符集，长度 12。

## 7. 安全

- 改密必须验证旧密码，防 cookie 被盗后静默设弱密之外的额外门槛（仍建议后续加 CSRF/同源；本轮依赖现有 cookie 同源策略）。
- 重置仅 admin；禁止通过改密接口改他人密码（只操 `x-user-id` 对应用户）。
- 错误信息：登录类继续模糊「用户名或密码错误」；改密旧密码错误可明确（已证明持有会话）。
- 不在日志中打印明文密码。
- 本轮不实现「重置后吊销所有会话」（无会话表）；接受持有旧 cookie 的会话在 JWT 过期前仍有效。若 JWT 为短期，风险可接受；若过长，可在实现计划中注明后续用 `passwordUpdatedAt` 校验（**本轮不做**，避免 scope creep）。

## 8. 测试要点

| # | 场景 | 期望 |
|---|------|------|
| 1 | 改密：旧密码错误 | 401，密码未变 |
| 2 | 改密：新密码 &lt; 8 | 400 |
| 3 | 改密：成功 | 新密码可登录，旧密码不可 |
| 4 | 非 admin 调 reset | 403 |
| 5 | admin generate | 返回 temporaryPassword，可登录 |
| 6 | admin 手填 | 不回显密码，新密码可登录 |
| 7 | 注册密码 7 位 | 400 |
| 8 | 未登录调 change-password | 401 |

手动验收即可；自动化测试本轮不强制（仓库暂无测试框架），实现计划可附 curl 清单。

## 9. 实现顺序（供计划拆分）

1. 密码策略常量 + register 对齐 ≥8  
2. `change-password` API + 服务函数  
3. `ChangePasswordModal` + UserMenu 入口  
4. `reset-password` admin API  
5. Admin UI 重置弹层  
6. 登录页文案  
7. 按第 8 节手测  

## 10. 成功标准

- 普通用户能在菜单内改密并立即用新密码登录。
- 管理员能在后台重置任意用户密码（含生成临时密码）。
- 忘记密码的用户在登录页能看到联系管理员的指引。
- 全站新设密码均 ≥ 8 位。
