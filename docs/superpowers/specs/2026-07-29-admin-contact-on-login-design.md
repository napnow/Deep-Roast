# 登录页管理员联系方式 — 设计规格

> 日期：2026-07-29  
> 状态：待用户确认 spec 后进入实现计划  
> 背景：忘记密码需联系管理员；当前仅有静态文案，无法展示可配置的联系信息与交流群二维码

## 1. 问题与目标

### 问题
- 登录页仅显示「忘记密码？请联系管理员重置」，用户不知道如何联系。
- 管理员无法在系统内维护联系文案或交流群图片。

### 目标
1. 登录页提供可点击入口，打开**小弹层**展示管理员配置的联系信息。
2. 管理后台可编辑**自由文本**联系方式，并**上传本地图片**（如交流群二维码）。
3. 未登录用户可读取联系信息（公开只读接口）。
4. 未配置时有明确空状态，不报错。

### 非目标
- 邮箱/短信找回密码
- 多联系人、多图、Markdown、灯箱放大
- CDN / 对象存储
- 非 admin 修改联系方式

## 2. 方案选择

| 方案 | 说明 | 结论 |
|------|------|------|
| 塞进 `llm_config` | 与 LLM 密钥混表 | 否 |
| 仅 env/文件 | 后台不可配 | 否 |
| **新建 `site_settings` 单行表** | 文字 + 图片路径，公开读 / 管理写 | **采用** |

## 3. 数据模型

表名：`site_settings`（单行，`id = 1`，check 约束同 `llm_config` 风格）

| 列 | 类型 | 默认 | 说明 |
|----|------|------|------|
| `id` | integer PK | 1 | 单行 |
| `admin_contact_text` | text | `''` | 多行自由文本 |
| `admin_contact_image_path` | text | `''` | 浏览器可访问路径，如 `/uploads/admin-contact/xxx.png`；空表示无图 |
| `updated_at` | timestamp | now | 更新时间 |

**图片存储**
- 目录：`public/uploads/admin-contact/`
- 允许 MIME：`image/png`、`image/jpeg`、`image/webp`
- 大小上限：**2MB**
- 上传覆盖或新文件名（实现可用时间戳/uuid 文件名，更新 path 后可删旧文件，可选）

**迁移**：Drizzle schema + 手工/SQL 确保表存在（与项目现有 migration 习惯一致）。

## 4. API

### 4.1 公开读取（登录页）

`GET /api/public/admin-contact`

- **鉴权**：无。中间件必须对 `/api/public/*` **放行**（否则未登录 401）。
- **成功 200**：
  ```json
  {
    "text": "string",
    "imageUrl": "string | null"
  }
  ```
  - `text`：库中文案（可为空串）
  - `imageUrl`：有 path 时返回该 path（或同源绝对 path）；无则为 `null`
- **失败**：仅在服务异常时 500；空配置仍 200。

### 4.2 管理读取

`GET /api/admin/site-settings`

- **鉴权**：admin（现有 `/api/admin/*` 中间件 + 可选 `requireAdmin`）
- **成功**：
  ```json
  {
    "adminContactText": "string",
    "adminContactImagePath": "string",
    "updatedAt": "..."
  }
  ```

### 4.3 更新文案

`PUT /api/admin/site-settings`

- **Body**：
  ```json
  {
    "adminContactText": "string",
    "clearImage": false
  }
  ```
- `adminContactText` 可选；若提供则写入（允许空串清空文案）。
- `clearImage: true` 时清空 `admin_contact_image_path`（可选删除磁盘文件）。
- **成功**：返回与 GET 相同形状的最新设置。

### 4.4 上传图片

`POST /api/admin/site-settings/contact-image`

- **Content-Type**：`multipart/form-data`，字段名 `file`（或 `image`，实现时固定一种并写进 plan）
- 校验类型与大小；写入 `public/uploads/admin-contact/`；更新 path。
- **成功**：`{ "adminContactImagePath": "/uploads/admin-contact/..." }`
- **失败**：400 类型/过大；403 非 admin。

## 5. UI

### 5.1 登录页

- 将静态句改为可点击控件，例如：  
  `忘记密码？` + 按钮/链接 **「联系管理员」**。
- 点击打开小弹层（`AdminContactModal` 或等价）：
  - 标题：联系管理员
  - 加载：`GET /api/public/admin-contact`
  - 有 `text`：`whitespace-pre-wrap` 展示
  - 有 `imageUrl`：下方 `<img>`，限制 max-width（如 12–16rem），alt「交流群」或「联系二维码」
  - 二者皆空：`管理员暂未填写联系方式，请稍后再试或通过其他渠道联系。`
  - 请求失败：`获取失败，请稍后重试`
  - 关闭：✕、遮罩点击

### 5.2 管理后台

- 位置：`/admin` **未选中用户**时的概览区增加「站点设置 · 联系方式」卡片（或独立小节，避免埋进用户详情）。
- 控件：
  - 多行 textarea：联系文案
  - 当前图片预览（若有）
  - 「上传图片」file input
  - 「清除图片」
  - 「保存文案」
- 上传可即时调用 upload API；文案保存调用 PUT。
- 成功/失败用现有 toast 或 alert（与 admin 页现有风格一致即可）。

## 6. 中间件

`src/middleware.ts`：

```ts
if (pathname.startsWith("/api/public/")) {
  return NextResponse.next();
}
```

放在 auth 校验之前（与 `/api/auth/` 同级）。

## 7. 安全

- 公开接口**只读**联系文案与图片 URL，不泄露用户表、积分、密钥。
- 写与上传仅 admin。
- 上传：MIME + 扩展名双检、大小限制；文件名不使用用户原始名（防路径穿越）。
- 文案不做 HTML 渲染（纯文本 + `pre-wrap`），防 XSS。
- 图片以静态文件服务，不经过 HTML 注入。

## 8. 测试要点

| # | 场景 | 期望 |
|---|------|------|
| 1 | 未配置时 GET public | 200，text `""`，imageUrl null |
| 2 | admin 保存文案后 public | 登录弹层显示对应文字 |
| 3 | admin 上传 png | path 更新，登录弹层显示图 |
| 4 | clearImage | 图消失 |
| 5 | 非 admin PUT/POST | 403 |
| 6 | 未登录访问 public | 200（不被 middleware 拦） |
| 7 | 上传 3MB 或非图片 | 400 |
| 8 | 文案含换行 | 弹层保留换行 |

手动 + 可选 curl；无强制测试框架。

## 9. 实现顺序

1. Schema + migration / 建表  
2. Middleware 放行 `/api/public/*`  
3. Service + public GET + admin GET/PUT + upload  
4. 登录页弹层  
5. Admin 站点设置 UI  
6. 手测清单  

## 10. 成功标准

- 用户在登录页一点即可看到管理员维护的文字与可选交流群图。
- 管理员可在后台改文案、上传/清除图片，无需改代码或 env。
- 未配置与失败状态对用户可读、不白屏。
