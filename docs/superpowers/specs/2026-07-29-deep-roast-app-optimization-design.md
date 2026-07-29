# 深焙-app 代码结构优化方案

**日期**: 2026-07-29  
**目标**: 重点提升开发者体验（代码可维护性、可读性、模块边界清晰度），减少 `page.tsx` 臃肿问题。

## 1. 核心问题诊断
- `src/app/page.tsx` 承担了几乎全部业务逻辑（聊天、图片生成、积分、模态、多个 useEffect、事件处理器）。
- 其他组件（如 ChatView、ImageGenView、Header）也耦合了较多状态和逻辑。
- 长期维护代价高：改一个地方容易影响全局。

## 2. 推荐方案（我的首选：方案 1）

### 方案 1: 组件拆分 + Zustand 全局状态管理（推荐优先级最高）
**描述**：
- 把 `page.tsx` 拆分为多个独立组件：
  - `ChatContainer.tsx`（Sidebar + ChatView + Input 组合）
  - `ImageModeContainer.tsx`
  - `HeaderContainer.tsx`
  - `ModalContainer.tsx`（积分、设置等）
- 使用 **Zustand** 管理全局状态（conversations, activeConvId, chatMessages, credits, config, streaming 等）。
- 状态逻辑尽量下沉到 `lib/store.ts` 或 `hooks/` 中。

**优点**：
- 组件边界清晰，每个组件只负责一件事。
- 状态集中管理，改动影响范围小。
- 未来加新功能（语音、历史记录分页等）更容易。

**缺点**：
- 需要额外引入 Zustand（约 5-10 分钟学习）。
- 部分逻辑需要从 client component 移动到 store。

**实施顺序**：
1. 安装 `zustand`
2. 创建 `lib/store.ts`
3. 拆分 `page.tsx` 并重构组件
4. 更新相关组件使用 store

### 方案 2: TanStack Query + 提取数据层
**描述**：
- 使用 `@tanstack/react-query` 统一管理 API 调用和缓存。
- 把 `page.tsx` 简化为“UI + 少量 store”模式。
- 提取 `lib/api.ts` 做统一 fetch。

**优点**：
- 数据获取/加载/错误处理统一，代码更简洁。
- 自动缓存和重试，性能更好。

**缺点**：
- 学习成本比 Zustand 稍高。
- 部分 streaming 逻辑仍需特殊处理。

**适用场景**：如果你更喜欢“数据驱动”的架构，而不是组件驱动。

### 方案 3: 保守重构（最小改动）
**描述**：
- 只做轻量拆分（`ChatView` 保持不动，`page.tsx` 内提取几个自定义 hook）。
- 不引入新依赖。

**优点**：
- 改动最小，几乎零侵入。
- 立即见效。

**缺点**：
- 根本问题（`page.tsx` 太大）仍未解决，长期维护压力大。

---

**我的强烈推荐**：**优先方案 1**（Zustand + 组件拆分）。它最彻底地解决了“代码臃肿”的核心问题，同时为未来扩展留出空间。

---

**下一步**：你更倾向哪个方案？  
或者告诉我你想重点拆分哪些组件/模块？我会立即给出更详细的设计文档（包含具体文件结构建议）和实现步骤。