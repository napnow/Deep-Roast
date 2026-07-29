# 积分签到 · 用户治理 · 全站公告 — 设计规格

> 日期：2026-07-29  
> 状态：已确认（brainstorming）  
> 分支建议：`feat/credits-checkin-user-admin`（或当前功能分支续做）  
> 范围：去掉模拟充值；每日签到；生图 5 分；软封禁/删除；关注册；管理流水与统计；全站公告  

---

## 1. 背景与目标

深焙面向小范围自托管用户。现有「积分商城模拟支付」不适合真实运营；需要：

1. 用 **每日签到** 替代模拟充值作为普通用户主要积分来源  
2. 生图成本调整为 **5 积分/张**；管理员生图 **不扣积分**、**无签到**  
3. 管理员可 **看流水、加减积分、封禁/解封、删除用户、关闭注册**  
4. 同期上线最简 **全站公告**（登录页 + 站内可看，管理端发/删）

### 1.1 已确认决策

| 项 | 决定 |
|----|------|
| 充值商城 | 移除 UI + `POST /api/credits/recharge` + `RECHARGE_PLANS` 产品入口 |
| 签到奖励 | +50 / 自然日 |
| 日界 | **Asia/Shanghai** 日历日，北京时间 0 点刷新 |
| 签到对象 | 仅 `role=user` 且未封禁 |
| 生图单价 | `CREDIT_PER_IMAGE = 5` |
| 管理员生图 | 不扣积分（方案 A） |
| 封禁 | 软封禁 `status=banned`，可解封 |
| 删除 | 硬删用户；DB cascade 清会话/消息/图记录/流水；磁盘文件尽力删、失败不阻断 |
| 管管账号 | **禁止**封禁/删除任何 `role=admin`（含自己） |
| 管理流水 | 用户详情内按 userId 看流水 + 调配；仪表盘改为签到/消耗口径 |
| 公告 | 同一期；纯文本多条；发/删；不做编辑/富文本/已读 |

### 1.2 非目标（本期不做）

- 真实支付 / 微信支付宝  
- 连续签到加成、补签  
- 公告编辑、置顶、定时、富文本、已读状态  
- 封禁后仍可登录只读  
- 文生文扣积分  
- 多租户 / 按用户独立 LLM 配置  

---

## 2. 架构概览

```
普通用户
  ├─ 签到 POST /api/credits/checkin     → +50 + 流水 checkin
  ├─ 生图 POST /api/image               → -5  + 流水 consume
  ├─ 钱包流水 GET /api/credits/transactions
  └─ 公告  公开或登录 GET

管理员
  ├─ 生图免扣
  ├─ 无签到入口（或 API 403）
  ├─ 加减积分 / 流水（已有增强）
  ├─ 封禁·解封·删除用户
  ├─ 关注册（site_settings）
  └─ 公告 CRUD（创建/删除/列表）

登录 / 中间件
  └─ banned → 拒绝发 token / 拒绝业务 API
注册
  └─ registration_enabled=false → 403；登录页藏注册
```

实现风格：沿用现有 `src/server/services/*` + `handleRoute` + Drizzle 迁移；UI 用现有 Admin / Header / 登录页模式。

**推荐实现路线：方案 1（最小改动）**  
- 用户字段防重签到 + 流水记 `checkin`  
- 不新建独立签到表（除非实现中发现并发必须唯一约束再补）

---

## 3. 数据模型

### 3.1 `users` 扩展

| 列 | 类型 | 默认 | 说明 |
|----|------|------|------|
| `status` | text | `'active'` | `active` \| `banned` |
| `last_checkin_on` | text 可空 | null | `YYYY-MM-DD`（上海时区日历日） |

现有：`credits` 默认 100、`role` 等不变。

### 3.2 `site_settings` 扩展

| 列 | 类型 | 默认 | 说明 |
|----|------|------|------|
| `registration_enabled` | boolean 或 int 0/1 | true / 1 | 是否开放注册 |

保留现有 `admin_contact_*`。

### 3.3 新表 `announcements`

| 列 | 类型 | 说明 |
|----|------|------|
| `id` | uuid PK | |
| `body` | text not null | 纯文本，服务端校验非空、长度 ≤ 2000 |
| `created_at` | timestamp | 默认 now |
| `created_by` | uuid 可空 FK users | on delete set null |

索引：`created_at desc` 便于列表。

### 3.4 流水 `credit_transactions.type`

新增产品类型：

- `checkin` — 每日签到  

保留只读历史：`recharge`（旧模拟充值）、`admin_grant`、`admin_deduct`、`consume`、`signup_bonus`。

`CREDIT_TYPE_LABELS` 增加 `checkin: 签到`；`recharge` 仍可显示「历史充值」以免旧数据空白。

### 3.5 常量（`src/types` 或 `src/server` 共享）

```ts
export const CREDIT_PER_IMAGE = 5;
export const CHECKIN_REWARD = 50;
// 上海日历日工具：formatCheckinDate(d = new Date()) => "YYYY-MM-DD"
```

---

## 4. 业务规则

### 4.1 签到

1. 鉴权用户必须存在且 `status=active`  
2. `role !== 'user'` → **403**「管理员无需签到」  
3. 计算 `today = Asia/Shanghai` 的 `YYYY-MM-DD`  
4. 若 `last_checkin_on === today` → **409**「今日已签到」  
5. 否则：`credits += 50`，插入流水 `type=checkin, amount=50`，`last_checkin_on = today`  
6. 建议单事务，避免并发双签（小流量下字段判断 + 事务足够）

### 4.2 生图扣费

- 在现有 `assertEnoughCredits` / `consumeCredits` 调用处：若 `role === 'admin'` **跳过**  
- 普通用户：`cost = 5`；不足 → 402，`INSUFFICIENT_CREDITS`，文案：**「积分不足，请先签到或联系管理员」**（去掉「请充值」）  
- 前端展示「5 积分/张」

### 4.3 封禁 / 解封

- `POST` 类接口：`{ status: 'banned' | 'active' }` 或独立 ban/unban  
- 目标 `role=admin` → **403**  
- 登录：密码正确但 `banned` → **403**「账号已被封禁，请联系管理员」（勿与密码错误混淆，便于用户理解；若担心枚举可统一文案，**本期优先明确封禁提示**）  
- 已持有 JWT：middleware 或 `/api/auth/me` 与关键业务入口校验 `status`；banned → 401/403 并清 cookie 更佳  
- 列表展示「已封禁」标签  

### 4.4 删除用户

- `DELETE /api/admin/users/[id]`  
- 目标 admin → 403  
- DB：依赖现有 `onDelete: 'cascade'`  
- 可选：查询其 `image_generations.image_url` 删 `public/images` 文件；失败 log，不 500  
- 删除前 UI **二次确认**（确认框即可；不强制输入用户名，除非实现很方便）

### 4.5 关闭注册

- `registration_enabled === false` 时 `POST /api/auth/register` → 403  
- 公开配置（可并入 `GET /api/public/admin-contact` 扩展字段，或 `GET /api/public/site`）返回 `registrationEnabled`  
- 登录页：关闭时不展示注册切换  

### 4.6 公告

- 创建：admin，body trim 非空 ≤ 2000  
- 删除：admin，按 id  
- 列表：按 `created_at desc`；公开最近 **20** 条  
- 展示时间：格式化为北京时间 `YYYY-MM-DD HH:mm`  
- **无编辑**：改内容 = 删除后新建  

---

## 5. API 一览

### 5.1 用户积分

| 方法 | 路径 | 说明 |
|------|------|------|
| ~~POST~~ | ~~/api/credits/recharge~~ | **删除** |
| POST | `/api/credits/checkin` | 签到；返回 `{ credits, checkinOn, reward }` |
| GET | `/api/credits/checkin` 或挂在 `/api/auth/me` | 可选：`todayChecked`、`checkinReward`，减少前端猜 |
| GET | `/api/credits/transactions` | 保留自己的流水 |

### 5.2 管理 · 用户

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/users` | 列表含 `status`、`credits` |
| PATCH | `/api/admin/users/[id]` | `{ status: 'active' \| 'banned' }` 和/或既有字段 |
| DELETE | `/api/admin/users/[id]` | 硬删 |
| GET/POST | `/api/admin/credits` | 保留；流水筛选 `userId`；统计改签到/消耗 |

### 5.3 管理 · 站点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/PUT | `/api/admin/site-settings` | 增加 `registrationEnabled` |
| GET | `/api/public/...` | 返回 `registrationEnabled` + 原联系方式 |

### 5.4 公告

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/public/announcements` | 公开最近 20 条（登录页） |
| GET | `/api/announcements` | 登录用户（可与公开同 handler） |
| POST | `/api/admin/announcements` | `{ body }` |
| DELETE | `/api/admin/announcements/[id]` | 删除 |
| GET | `/api/admin/announcements` | 管理列表（可与公开相同数据） |

---

## 6. UI 变更

### 6.1 去掉充值

- 删除或停用：`CreditRechargeModal`、`Credits/Recharge*` 三相、Header/UserMenu「充值」入口、`rechargeOpen` store  
- `AppModals` 等引用清理  

### 6.2 签到与钱包

- Header 原充值位 → **签到**按钮（仅 `role=user` 显示）  
  - 未签：可点，成功 toast + 刷新积分  
  - 已签：禁用文案「今日已签」  
- `CreditWalletModal`：流水类型显示签到；去掉充值引导  
- 生图区：单价文案 5 分；不足引导签到  

### 6.3 管理端

- **仪表盘**：去掉「总充值/人均充值」；改为例如：总签到积分、总消耗积分、用户数、生图数（字段名以实现为准）  
- **用户列表**：`status` 标签；操作：封禁/解封、删除（确认）  
- **用户详情 · 积分 Tab**：调配 + **仅该用户**流水（`userId` 筛选，进入详情时自动带上）  
- **站点设置卡**：注册开关 + 原联系方式；其下或旁 **公告** 发帖与列表删除  
- 管理员自己的前台：**不显示**签到  

### 6.4 登录页

- 读 `registrationEnabled` 控制注册  
- 公告只读区块（最近若干条 + 时间）  
- 封禁用户登录错误文案  

---

## 7. 错误与安全

| 场景 | 行为 |
|------|------|
| 重复签到 | 409 |
| 管理员签到 | 403 |
| 积分不足 | 402 + 新文案 |
| 封禁用户登录 | 403 明确文案 |
| 操作 admin 用户 | 403 |
| 注册关闭 | 403 |
| 公告空/超长 | 400 |
| 非 admin 管理接口 | 现有 403 |

- 所有写操作服务端鉴权，不信任前端藏按钮  
- 生产 `JWT_SECRET` 等既有要求不变  

---

## 8. 迁移与兼容

1. Drizzle migration：`users.status`、`users.last_checkin_on`、`site_settings.registration_enabled`、`announcements` 表  
2. 旧 `recharge` 流水保留只读  
3. 默认 `registration_enabled=true`、`status=active`，现有用户无感  
4. 部署后：`db:migrate`；无需强制清积分  

---

## 9. 测试要点

**签到**  
- 用户当日首次 +50 且流水  
- 二次 409  
- 管理员 403  
- 模拟跨日（改 `last_checkin_on` 或 mock 日期）可再签  

**生图**  
- 用户 5 分扣除；余额 4 拒绝  
- 管理员余额不变  

**封禁**  
- 无法登录；解封后可登录  
- 不能封 admin  

**删除**  
- 用户及关联行消失；不能删 admin  

**注册**  
- 关闭后 API + UI  

**公告**  
- 公开可见；删除后列表无；非 admin 不能 POST  

---

## 10. 文件触点（实现时预期）

| 区域 | 路径（示意） |
|------|----------------|
| Schema / 迁移 | `src/db/schema.ts`，`drizzle/*` |
| 积分 | `src/server/services/credits.ts`，`src/types` 常量 |
| 签到 API | `src/app/api/credits/checkin/route.ts` |
| 生图 | `src/server/services/image.ts` |
| 用户管理 | `src/server/services/admin.ts`，`api/admin/users/*` |
| 站点 | `site-settings` service + public API |
| 公告 | 新 service + `api/public/announcements` + admin routes |
| 登录/注册 | `api/auth/login`、`register`，`login/page.tsx` |
| 中间件/me | `middleware.ts` 或 me + 关键 API 校验 banned |
| UI | Header、Wallet、Admin*、去掉 Recharge* |

---

## 11. 成功标准

- [ ] 普通用户只能通过签到（及管理员调配/注册赠送）获得积分，无模拟支付入口  
- [ ] 北京时间每日一次签到 +50；生图 5 分/张；admin 免扣、无签到  
- [ ] 管理员可封禁/解封/删除普通用户，可开关注册，可看流水与调配积分  
- [ ] 公告可发可删，登录页与站内可见并显示时间  
- [ ] `tsc` / build 通过；关键路径有手测或单测覆盖纯函数（日期、常量）  

---

## 12. 规格自检

- 无 TBD 占位；日界/权限/cascade 已写死  
- 公告与积分同属一期但表与 API 分离，边界清晰  
- 与「开源不硬编码中转」无关，本规格不引入密钥  
