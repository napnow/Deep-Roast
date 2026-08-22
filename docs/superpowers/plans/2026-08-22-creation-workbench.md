# 深焙创作控制台重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变对话功能、图像编辑协议和后端行为的前提下，完成桌面三栏创作工作台、移动端图生图底部抽屉和统一视觉层级。

**Architecture:** 保留 `ImageGenView` 作为图像工作区编排器，保留 `ChatView` 作为独立对话工作区；桌面端由 `CreationPanel`、`ResultCanvas`、`AssetInspector` 组成三栏，移动端由 `ImageMobileBar` 承担固定工具栏和图生图抽屉。图生图请求继续通过现有 `buildImageEditRequest` 生成 `ImageEditRequest`。

**Tech Stack:** Next.js 16.2.10 App Router, React 19.2.4 Client Components, TypeScript 5, Tailwind CSS 4, `src/app/globals.css`, Node test runner via `tsx`。

## Global Constraints

- 不修改 `ImageEditRequest`、图生图 API、代理协议或服务端路由。
- 不删除或替换 `ChatView`、`TextModePanel` 或现有对话入口。
- 参考图最多 5 张；分别修改和参考修改的结构化语义保持不变。
- 移动端抽屉适配 `visualViewport`、`env(safe-area-inset-bottom)` 和现有滚动锁定函数。
- 触控目标最小 44px；普通桌面按钮最小 36px。
- 新增生产逻辑前先写测试并观察测试按预期失败；每个任务完成后运行相关测试。
- 不引入 UI 框架或大型依赖，不提交效果图示例图片。

---

### Task 1: 建立创作工作台纯逻辑契约

**Files:**
- Create: `src/components/ImageGen/creation-workbench-ui.ts`
- Test: `src/components/ImageGen/creation-workbench-ui.test.ts`

**Interfaces:**
- Produces `CreationSettingsInput`、`getCreationSettingsSummary()`、`WORKBENCH_CLASS_NAMES` 和 `getMobileCreationSurface()`。
- Consumes模式、风格标签、比例标签、批量数量和移动端工具状态，不持有 React 状态。

- [ ] **Step 1: Write the failing test**

为默认设置、选中风格、空标签过滤、图生图抽屉打开、对话入口保留分别写断言。期望结果为：默认返回 `["1:1", "1 张"]`；风格和数量返回 `["赛博朋克", "16:9", "3 张"]`；空输入返回 `[]`；图生图返回 `{ sheetOpen: true, appMode: "image" }`；对话返回 `{ sheetOpen: false, appMode: "chat" }`。

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/ImageGen/creation-workbench-ui.test.ts`

Expected: FAIL because the new module and exports do not exist.

- [ ] **Step 3: Write minimal implementation**

实现纯函数：`getCreationSettingsSummary` 只返回非空的风格、比例、数量标签；`getMobileCreationSurface` 只根据 `img2img` 或 `chat` 返回抽屉状态与应用模式；`WORKBENCH_CLASS_NAMES` 固定为 `creation-panel`、`creation-settings`、`mobile-creation-sheet`。

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/ImageGen/creation-workbench-ui.test.ts`

Expected: all new tests pass。

- [ ] **Step 5: Commit**

`git add src/components/ImageGen/creation-workbench-ui.ts src/components/ImageGen/creation-workbench-ui.test.ts && git commit -m "feat: add creation workbench ui contracts"`

### Task 2: 重构图生图素材轨道和单一指令编辑

**Files:**
- Modify: `src/components/ImageGen/Img2ImgPanel.tsx`
- Modify: `src/components/ImageGen/image-edit-ui.test.ts`
- Modify: `src/components/ImageGen/creation-workbench-ui.ts`

**Interfaces:**
- 保持现有 `onEditImage(request, size)` 和 `onEditImageBatch(request, size, count)` 签名。
- 继续使用 `buildImageEditRequest`、`perImagePrompts`、`targetIndex` 和 `referenceIndexes`。
- Produces `getActiveEditPrompt(prompts, index)`，供分别修改模式的唯一主输入框读取当前图片指令。

- [ ] **Step 1: Write the failing behavior test**

先为 `getActiveEditPrompt(prompts, index)` 写测试：有效索引返回对应 prompt，缺失索引返回空字符串；同时保留现有 `image-edit-ui.test.ts` 中的目标/参考过滤测试作为请求构建回归护栏。

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/ImageGen/creation-workbench-ui.test.ts`

Expected: `getActiveEditPrompt` 相关断言先失败；现有 `image-edit-ui.test.ts` 保持绿色，证明请求协议没有被本次 UI 设计改坏。

- [ ] **Step 3: Implement the minimal UI change**

保留当前文件上传、压缩、生成、停止和清理逻辑，只替换 JSX：参考图改为带编号的素材轨道和固定“添加参考图”卡片；删除每张缩略图下方的窄 textarea；分别修改模式只渲染“当前编辑：图片 N”与一条主 textarea，切换图片只改变 `targetIndex` 并用 `getActiveEditPrompt` 读取对应值；参考修改模式渲染目标图选择和参考图多选；风格、比例、数量收进 `details.creation-settings`，并用 `getCreationSettingsSummary` 显示摘要。

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test -- src/components/ImageGen/image-edit-ui.test.ts && npx tsc --noEmit`

Expected: image-edit tests and TypeScript pass。

- [ ] **Step 5: Commit**

`git add src/components/ImageGen/Img2ImgPanel.tsx src/components/ImageGen/image-edit-ui.test.ts src/components/ImageGen/creation-workbench-ui.ts && git commit -m "feat: simplify multi-image edit workspace"`

### Task 3: 统一桌面三栏工作台和设置层级

**Files:**
- Modify: `src/components/ImageGen/CreationPanel.tsx`
- Modify: `src/components/ImageGen/TextToImageForm.tsx`
- Modify: `src/components/ImageGen/ResultCanvas.tsx`
- Modify: `src/components/ImageGen/AssetInspector.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- 不改变 `CreationPanelProps`、`TextToImageDraft`、`ResultCanvasProps`、`AssetInspector` 的数据接口。
- 只增加工作台语义 class 和视觉层级，不改变结果、图库、删除、预览业务。

- [ ] **Step 1: Run the existing UI contract tests before the JSX change**

Run: `npm test -- src/components/ImageGen/creation-workbench-ui.test.ts`

Expected: Task 1 的纯逻辑契约保持绿色；本任务的可见性通过后续 TypeScript、lint、build 和代码审查检查，不重复伪造已经存在的 class 测试。

- [ ] **Step 2: Implement the desktop shell**

`CreationPanel` 保持左侧固定宽度、可滚动 body 和固定 footer；模式 tabs 只负责模式切换。`TextToImageForm` 使用主 composer、设置摘要和折叠高级设置。`ResultCanvas` 与 `AssetInspector` 只补充三栏视觉语义 class。`globals.css` 统一暖象牙背景、纸张内容面、陶土选中态、边框、圆角、间距和暗色变量，移除同一层级的重复大卡片感。

- [ ] **Step 3: Run tests, lint, and build**

Run: `npm test && npm run lint && npm run build`

Expected: tests、lint 和 Next build 全部成功。

- [ ] **Step 4: Commit**

`git add src/components/ImageGen/CreationPanel.tsx src/components/ImageGen/TextToImageForm.tsx src/components/ImageGen/ResultCanvas.tsx src/components/ImageGen/AssetInspector.tsx src/app/globals.css src/components/ImageGen/creation-workbench-ui.ts src/components/ImageGen/creation-workbench-ui.test.ts && git commit -m "feat: refine desktop creation workbench"`

### Task 4: 实现移动端图生图底部抽屉并保留对话

**Files:**
- Modify: `src/components/ImageGen/ImageMobileBar.tsx`
- Modify: `src/components/ImageGen/ImageGenView.tsx`
- Modify: `src/components/ImageGen/MobileDrawer.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- 保持 `mobileTab`、`onEditImage`、`onEditImageBatch`、`onSwitchChat` 和 `onSelectImageTab` 回调不变。
- 产出移动端可访问的 `role="dialog" aria-modal="true"` 抽屉。

- [ ] **Step 1: Run the existing mobile state contract tests before the JSX change**

Run: `npm test -- src/components/ImageGen/creation-workbench-ui.test.ts`

Expected: Task 1 已覆盖图生图抽屉与对话模式的状态契约；本任务重点验证抽屉 DOM、滚动锁定、键盘安全区和导航回调。

- [ ] **Step 2: Implement the mobile surface**

`ImageMobileBar` 保留反推、图生图、比例快捷栏；图生图打开时渲染遮罩、拖拽手柄和独立滚动的 `mobile-creation-sheet`，抽屉底部固定生成按钮并使用 `env(safe-area-inset-bottom)`。打开/关闭时调用滚动锁定；抽屉打开时隐藏重复的主输入框。`ImageGenView` 继续区分生成、图库、公告；`MobileDrawer` 保留对话菜单，不把 ChatView 放进图生图抽屉。

- [ ] **Step 3: Run tests, lint, and build**

Run: `npm test && npm run lint && npm run build`

Expected: tests、lint 和 build 全部成功，聊天与图像回调类型不变。

- [ ] **Step 4: Commit**

`git add src/components/ImageGen/ImageMobileBar.tsx src/components/ImageGen/ImageGenView.tsx src/components/ImageGen/MobileDrawer.tsx src/app/globals.css src/components/ImageGen/creation-workbench-ui.ts src/components/ImageGen/creation-workbench-ui.test.ts && git commit -m "feat: add mobile creation drawer"`

### Task 5: 回归检查、代码审查、部署验证

**Files:**
- Modify only files identified by failing tests or review findings。
- Test: all existing `src/**/*.test.ts` files。

- [ ] **Step 1: Run complete local verification**

Run: `npm test && npm run lint && npm run build`

Expected: all tests pass, lint exits 0, build exits 0。

- [ ] **Step 2: Request code review**

Review `git diff` against the design spec. Confirm `ChatView` and `MobileDrawer` 对话入口未删除，图生图仍调用 `buildImageEditRequest`，移动端只有一个主输入框，生成中/错误/余额状态仍可见，CSS 没有依赖效果图资源。

- [ ] **Step 3: Deploy safely**

使用现有服务器 `20.41.121.31`、用户 `GGG`、部署目录 `/opt/deeproast`；先创建 timestamp backup，再同步本次 UI 文件，不覆盖 `.env`、数据库和用户生成文件。重启 `deeproast.service` 后检查 active、`/login` 200、`/v1/models` 200、未认证 `/api/image-edit` 401。

- [ ] **Step 4: Report**

最终报告包含本地测试结果、部署 commit、服务器 backup 路径和线上 endpoint 检查结果。
