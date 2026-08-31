# 公告微信群二维码 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让管理员发布公告时可上传一张微信群二维码，并让用户在手机端点击箭头后查看。

**Architecture:** 在现有 announcements 表增加可空图片地址；管理员公告 POST 接口使用 multipart/form-data 并复用现有公开上传目录模式；前台 `AnnouncementList` 对带图片的公告维护展开状态，图片仅在展开时渲染。

**Tech Stack:** Next.js 16.2.10、React 19、Drizzle ORM、PostgreSQL、Tailwind CSS、Node test + tsx。

## Global Constraints

- 仅允许 PNG、JPEG、WebP；单张图片最大 2MB。
- 公告正文仍然必填，图片可选。
- 图片地址存数据库，不保存 base64，不允许 HTML 注入。
- 旧公告无图片时保持原有展示。
- 遵循项目 Next.js 16 文档和现有上传/鉴权模式。

---

### Task 1: 数据库和上传服务

**Files:**
- Modify: `src/db/schema.ts`
- Create: `drizzle/0020_announcement_image.sql`
- Modify: `src/server/services/announcements.ts`
- Test: `src/server/services/announcements-image.test.ts`

- [ ] 写失败测试：校验允许格式、2MB 上限、返回公开 URL，并要求列表/删除使用图片字段。
- [ ] 运行 `npm test -- src/server/services/announcements-image.test.ts`，确认因字段和 helper 不存在而失败。
- [ ] 增加可空 `imagePath` 字段、迁移 SQL、图片保存/删除 helper；创建公告在插入前保存文件，失败时回收文件；删除公告返回并清理图片。
- [ ] 重新运行该测试并通过。

### Task 2: 管理员 multipart 发布接口和上传控件

**Files:**
- Modify: `src/app/api/admin/announcements/route.ts`
- Modify: `src/components/Admin/AdminAnnouncementsCard.tsx`
- Test: `src/app/api/admin/announcements/route.test.ts`

- [ ] 写失败测试：POST 使用 `formData()` 读取 `body` 和 `image`，并把文件传给创建服务；管理员界面存在单文件二维码选择器。
- [ ] 运行目标测试确认失败。
- [ ] 实现 multipart 解析、错误校验、选择文件/预览/清空选择，并用 `FormData` 提交；保留纯文字公告发布路径。
- [ ] 运行目标测试和 TypeScript/ESLint 检查并通过。

### Task 3: 用户端折叠查看二维码

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/components/AnnouncementList.tsx`
- Test: `src/components/AnnouncementList.test.ts`

- [ ] 写失败测试：带 `imageUrl` 的公告默认收起，按钮有 `aria-expanded`，点击后渲染响应式图片；无图公告不出现展开按钮。
- [ ] 运行目标测试确认失败。
- [ ] 实现展开集合和可访问按钮，图片使用 `max-w-full`、`object-contain`、明确 alt 文本。
- [ ] 运行目标测试和全量测试并通过。

### Task 4: 构建、迁移和部署

**Files:**
- No additional source files.

- [ ] 运行全量测试和 `npm run build`。
- [ ] 在服务器新 release 中执行 `drizzle-kit migrate`，确认 `announcements.image_path` 存在。
- [ ] 部署新 release、重启服务、检查 HTTP 200 和服务状态。
- [ ] 用管理员接口做不带图片的回归检查，确保旧公告和原有公告操作正常。
