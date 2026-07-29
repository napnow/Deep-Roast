# 积分充值系统 — 设计文档

## 概述

为"深焙"添加积分系统：用户充值获积分、生成图片消耗积分、管理员可调配积分并查看流水。

- 1 张图 = 20 积分
- 新用户注册赠送 100 积分（5 张图体验额度）
- 支付宝模拟支付（仪式感确认式）

---

## 数据库变更

### users 表加列

```sql
ALTER TABLE users ADD COLUMN credits integer NOT NULL DEFAULT 100;
```

### 新增表: credit_transactions

```sql
CREATE TABLE credit_transactions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          text NOT NULL,  -- 'recharge' | 'admin_grant' | 'admin_deduct' | 'consume' | 'signup_bonus'
  amount        integer NOT NULL,   -- 正=增加, 负=扣除
  balance_after integer NOT NULL,
  plan_id       text,           -- 充值档位, 仅 type=recharge 时
  note          text,           -- 管理员备注
  created_at    timestamp DEFAULT now()
);
```

### 充值档位定义（前端常量）

| planId | 金额 | 积分 | 张数 |
|--------|------|------|------|
| plan_10  | ¥10  | 200  | 10 张 |
| plan_30  | ¥30  | 600  | 30 张 |
| plan_50  | ¥50  | 1200 | 50 张（送 200）|
| plan_100 | ¥100 | 3000 | 100 张（送 1000）|

---

## API 设计

### POST /api/credits/recharge

用户充值。

- Body: `{ planId: string }`
- 验证 planId 有效 → 查询对应积分 → 插入 credit_transactions (type=recharge) → 更新 users.credits
- 返回: `{ balance: number, transaction: {...} }`

### GET /api/credits/transactions

用户查看自己的积分流水（最近 50 条），按时间倒序。

- 从 `x-user-id` header 取 userId
- 返回: `CreditTransaction[]`

### GET /api/admin/credits

管理员查看所有用户积分流水（最近 200 条），按时间倒序。

- 返回: `CreditTransaction[]`（含 username）

### POST /api/admin/credits

管理员手动调配用户积分。

- Body: `{ userId: string, amount: number, note: string }`
- amount 可为正（grant）或负（deduct）
- 写 credit_transactions（type=admin_grant/admin_deduct）→ 更新 users.credits
- 返回: `{ balance: number }`

### POST /api/image（修改）

生成图片时集成积分检查：

1. 查询用户 credits
2. 若 < 20，返回 `{ error: "积分不足，请充值", code: "INSUFFICIENT_CREDITS" }`，状态码 402
3. 生成成功后，扣 20 积分，写 consume 流水

### 注册逻辑（修改）

`POST /api/auth/register` 创建用户时 `credits = 100`，写 signup_bonus 流水。

---

## 前端页面

### 1. 积分显示 + 充值入口

右上角 user 区添加积分标签按钮：
```
[💰 100 积分] [test]
```
点击弹出充值 Modal。

### 2. 充值 Modal (`CreditRechargeModal`)

**档位选择界面：**
- 4 张档位卡片，显示金额、积分、张数
- 推荐档位（¥50）高亮标记"最划算"

**模拟支付界面：**
- 商户名：深焙AI
- 订单号（自动生成）
- 金额
- 假的二维码图（CSS 绘制或静态 SVG）
- "支付中…" 倒计时 3 秒 + 进度条
- 支付成功动画（✅ + "充值成功"）
- 显示新余额
- "确认支付" / "取消" 按钮

### 3. 文生图扣费

ImageGenView 中：
- 生成按钮旁显示 "消耗 20 积分"
- 余额不足时按钮置灰，显示 "积分不足，请充值"
- 点击跳转充值 Modal

### 4. 管理面板

**用户列表增强：**
- 每个用户卡片显示 `💰 {credits} 积分`

**用户详情新增"积分流水"section：**
- 表格：时间、类型（标签色）、金额、余额、备注
- 类型标签映射：充值=绿, 消费=红, 管理调配=蓝, 注册赠送=灰

**手动调配：**
- 输入框 + 正负选择 + 备注 → "确认调配"按钮

**账户总流水 tab：**
- 所有充值记录汇总额
- 显示总充值金额、总赠送积分、总消费积分

---

## 积分类型枚举

| type | 说明 | 颜色 |
|------|------|------|
| signup_bonus | 注册赠送 | 灰 |
| recharge | 充值 | 绿 |
| consume | 生成消耗 | 红 |
| admin_grant | 管理加积分 | 蓝 |
| admin_deduct | 管理扣积分 | 橙 |

---

## 待确认项

- [x] 充值档位: 固定 4 档 (¥10/¥30/¥50/¥100)
- [x] 新用户赠送: 100 积分
- [x] 支付模拟: 仪式感确认式 (倒计时 3 秒)
- [x] 管理面板: 完整版（流水 + 调配 + 审计）
- [x] 积分比例: 1 张图 = 20 积分
