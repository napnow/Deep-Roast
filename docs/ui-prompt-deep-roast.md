# 深焙 Deep Roast — UI 设计提示词

> 参考 motionsites / Velorah 的电影感单页 Hero，按深焙项目实际技术栈与设计语言改写。
> 主落地：登录页；视觉语言延伸至主应用 Header / 空状态 / 弹窗。

## 技术栈

- Next.js 16 (App Router) + React 19 + Tailwind CSS v4 + TypeScript
- 不使用 shadcn/ui；沿用项目现有模式：CSS 变量 + 语义 className（见 `src/app/globals.css`）
- 图标用内联 SVG，不引入图标库
- ⚠️ 这是改版 Next.js，写代码前查 `node_modules/next/dist/docs/`

## 落地场景

- **主落地**：`src/app/login/page.tsx`（左右分栏 → 升级为电影感 Hero 品牌舞台 + 液态玻璃登录卡）
- **视觉语言延伸**：主应用 `Header`（玻璃态导航）、对话/生图空状态、设置弹窗

## 氛围背景（用动态光斑替代视频，更轻量、贴合工坊）

深焙不依赖外部视频 CDN。用 CSS 动态氛围层：

- 全屏 `<div>` 绝对定位 `inset-0`，`z-0`，`pointer-events-none`
- 暖光斑：两层 `radial-gradient` 缓慢漂移（已有 `--glow-spot`，升级为 `@keyframes` 漂移，周期 18–24s）
- 噪声纹理：SVG `feTurbulence`，`opacity: 0.05`，`mix-blend-mode: overlay`（暗）/ `multiply`（亮）
- 暗色底：`--bg-root: #090807`（炭黑），叠加品牌舞台渐变 `linear-gradient(165deg, #2a211c, #3d2e24, #4a3428)`（登录页左栏已有）
- 可选视频：放本地 `public/roast-ambient.mp4`，`<video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover z-0 opacity-40">`，但默认走光斑方案

## 字体（项目已配，勿改）

- Google Fonts：`Fraunces`（display 衬线）+ `Manrope`（body 无衬线）
- CSS 变量：`--font-display: 'Fraunces', serif` / `--font-body: 'Manrope', sans-serif`（已在 `layout.tsx` 注入）
- body 用 `var(--font-body)`；标题用 `.font-display` 类或 `fontFamily: "var(--font-display), serif"`
- 中文回退：`'Songti SC', 'Noto Serif SC', serif`（display）/ `'PingFang SC', 'Microsoft YaHei'`（body）

## 配色（暗色为主，焦糖炭黑）

落地直接用项目现有 CSS 变量，不要硬编码 hex。

**暗色主题（默认，`html.dark`）：**
- `--bg-root: #090807`（炭黑） · `--bg-surface: #12100e` · `--bg-elevated: #1a1714`
- `--text-primary: #ede6dc`（暖白） · `--text-secondary: #a89a8a` · `--text-muted: #6e6358`
- `--accent: #d4894a`（焦糖） · `--accent-soft: #e8a56a` · `--accent-on: #1a1008`
- `--border: rgba(237,230,220,0.07)` · `--border-strong: rgba(237,230,220,0.12)`
- `--danger: #e85d55` · `--success: #6fbf83`

**浅色主题（无 `.dark`）：**
- `--bg-root: #e6e2d9`（冷石米） · `--bg-surface: #f2efe8` · `--bg-elevated: #faf8f4`
- `--text-primary: #1a1612` · `--accent: #9a5528`
- 其余见 `globals.css`

> **关键**：焦糖/炭黑是品牌识别，**不要换成海军蓝/紫**。只借 Velorah 的「玻璃态 + 电影排版 + 动效语言」，不借配色。

## 玻璃态（liquid-glass → 深焙版，升级现有 `.glass-neon`）

项目已有 `.glass-neon` / `.glass-neon-hover`。新增液态玻璃变体用于登录卡与按钮：

```css
.liquid-glass {
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(8px) saturate(1.2);
  -webkit-backdrop-filter: blur(8px) saturate(1.2);
  border: none;
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.08), var(--shadow-md);
  position: relative;
  overflow: hidden;
}
.liquid-glass::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1.4px;
  background: linear-gradient(180deg,
    rgba(212,137,74,0.45) 0%, rgba(212,137,74,0.12) 20%,
    rgba(255,255,255,0) 40%, rgba(255,255,255,0) 60%,
    rgba(212,137,74,0.12) 80%, rgba(212,137,74,0.45) 100%);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
}
```

> 与 Velorah 的差异：边框流光用焦糖色而非纯白；blur 加到 8px（深焙暗底需更强毛玻璃）；保留内阴影 + 项目 `--shadow-md`。

## 导航 / 品牌字标

- **登录页**：左上品牌字标「深焙」+ 小标 `Deep Roast`；窄屏顶栏同（已有）
- **主应用 Header**：`relative z-20` + `dr-header-bar`（已有 `backdrop-blur(12px)`）
  - 左：logo「焙」渐变方块 + 「深焙 Deep Roast」
  - 中：文生文 / 文生图 segmented
  - 右：模型选择 / 公告铃铛 / 设置 / 积分 / 用户
- 链接 hover：`transition-colors`，`--text-muted` → `--text-primary`

## Hero / 品牌舞台（登录页左栏升级）

- 容器：`relative z-10 flex flex-col justify-center px-10 lg:px-14`（已有）
- 顶部小标：`Deep Roast`，`text-[11px] font-semibold tracking-[0.22em] uppercase`，焦糖色
- H1：`深焙`，`font-display text-5xl lg:text-[3.5rem] font-semibold tracking-tight leading-none`
  - 可选电影感副行：`Where slow thoughts rise through the roast.`，用 `<em className="not-italic text-muted">` 包裹 `through the roast.` 做色阶对比（对应 Velorah 的 em 手法）
- 分隔线：`mt-5 h-px w-12`，焦糖半透明（已有）
- Slogan：`深度思考，慢焙出好答案。`，`text-[15px] leading-[1.7]`，暖白 82% 透明
- 三条要点：`STAGE_BULLETS`，每条前置焦糖短横线（已有）
- 底部脚注：`自托管 · 积分可控 · 慢即是快`（已有）

## 动画（对应 Velorah fade-rise，复用项目已有 keyframes）

项目已有 `@keyframes fade-up` / `steam-rise` / `bake-done`。分级延迟：

```css
.animate-fade-rise         { animation: fade-up 0.8s cubic-bezier(0.16,1,0.3,1) both; }
.animate-fade-rise-delay   { animation: fade-up 0.8s cubic-bezier(0.16,1,0.3,1) 0.2s both; }
.animate-fade-rise-delay-2 { animation: fade-up 0.8s cubic-bezier(0.16,1,0.3,1) 0.4s both; }
```

- H1 / 品牌字标 → `animate-fade-rise`
- Slogan / 要点 → `animate-fade-rise-delay`
- 登录卡 / CTA → `animate-fade-rise-delay-2`
- 全部受 `prefers-reduced-motion: reduce` 降级（项目已有该媒体查询，自动生效）

## 登录卡（右侧凭证区升级为液态玻璃卡）

- 容器：`max-w-[22rem]`，加 `.liquid-glass`，`rounded-2xl p-8`
- 标题：`欢迎回来` / `创建账户`，`font-display text-2xl font-semibold`
- 登录/注册 segmented：保留现有
- 输入框：`--bg-root` 底 + `--border-strong` 边，focus 时 `box-shadow: 0 0 0 3px var(--accent-glow)`（已有 focus 风格）
- 提交按钮：`--accent` 实底 + `--accent-on` 文字，`active:scale-[0.98]`，可加 `hover:scale-[1.01]`

## 约束

- 无装饰性 blob / 多余径向渐变 / 紫色霓虹。氛围由光斑 + 噪声（+ 可选视频）提供
- 动效克制：光斑漂移周期 ≥ 18s，hover 缩放 ≤ 1.03，不喧宾夺主（工作台要专注）
- 焦糖/炭黑配色不可替换；只升级玻璃态、排版、动效
- 双主题必须同时工作（暗色默认，浅色可用）；所有玻璃态/光斑用 CSS 变量，不要硬编码只适配暗色
- 遵守 `prefers-reduced-motion`
