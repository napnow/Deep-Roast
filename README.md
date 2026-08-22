# 深焙 Deep Roast

深焙（Deep Roast）是一个面向个人和小团队的自托管 AI 创作工作台，支持文生图、图生图、反推提示词、对话和图库管理。

项目地址：[github.com/napnow/Deep-Roast](https://github.com/napnow/Deep-Roast)

## 功能

- 文生图：提示词、风格预设、尺寸、批量生成
- 图生图：
  - 逐图编辑：每张输入图可以使用独立修改提示词
  - 参考图模式：一张目标图配合一张或多张参考图
  - 最多 5 张输入图，批量输出最多 5 张
  - 参考图模式目前仅支持 gpt-image-2
- 反推提示词：从图片生成可编辑的提示词
- 图库：缩略图、原图预览、下载、删除和历史记录
- 对话：流式聊天和会话历史
- 积分：签到、消费记录和管理员调配
- 管理后台：用户、图片、公告、风格、站点设置和 API Key 管理
- 安全保护：密码策略、登录失败锁定、IP/用户限流、API Key 加密存储
- OpenAI 兼容上游：可接入豆包、Grok、GPT Image、Gemini 以及其他兼容网关

> 项目默认按单实例、小团队场景设计。图像推理由外部 API 或网关完成，服务器不需要 GPU。

## 技术栈

- Next.js App Router
- React
- TypeScript
- PostgreSQL
- Drizzle ORM
- Node.js
- 可选 Redis（多实例部署时共享限流计数）

## 环境要求

| 依赖 | 要求 |
| --- | --- |
| Node.js | 18+，推荐 20 LTS |
| npm | 9+ |
| PostgreSQL | 14+ |
| Redis | 可选；多实例部署建议配置 |

## 快速开始

### 1. 安装项目

~~bash
git clone https://github.com/napnow/Deep-Roast.git
cd Deep-Roast
npm install
~~

### 2. 配置环境变量

~~bash
cp .env.example .env.local
~~

至少配置：

~~env
DATABASE_URL=postgres://USER:PASSWORD@localhost:5432/deep_roast
JWT_SECRET=replace-with-a-long-random-string
ADMIN_PASSWORD=replace-with-a-strong-password
~~

生成随机密钥示例：

~~bash
openssl rand -base64 32
~~

### 3. 初始化数据库

创建 PostgreSQL 数据库后执行：

~~bash
npm run db:migrate
npm run db:seed
~~

首次 seed 创建管理员时，必须设置 ADMIN_PASSWORD。项目不会使用 admin123 等默认密码；如果管理员账号已经存在，后续 seed 不会修改现有密码。

默认管理员用户名为：

~~text
admin
~~

### 4. 启动开发环境

~~bash
npm run dev
~~

打开 <http://localhost:3000>。

### 5. 构建生产环境

~~bash
npm run build
npm start
~~

生产环境建议使用 systemd、Docker 或其他进程管理器，并在前面配置 HTTPS 反向代理。

## 环境变量

### 核心配置

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| DATABASE_URL | 是 | PostgreSQL 连接串 |
| JWT_SECRET | 是 | JWT 签名密钥，生产环境必须使用强随机值 |
| ADMIN_PASSWORD | 首次 seed 时 | 新建管理员时使用；已有管理员不会被修改 |
| API_KEY_ENCRYPTION_KEY | 使用 API Key 功能时 | 32 字节 Base64 密钥，用于 AES-256-GCM 加密 |
| PUBLIC_APP_URL | API 网关/邀请链接时 | HTTPS 根域名，例如 https://example.com |
| REGISTRATION_BYPASS_IPS | 否 | 允许单 IP 注册多个账号的 IP，逗号分隔 |

### 限流与上游服务

| 变量 | 说明 |
| --- | --- |
| REDIS_URL | 可选。配置后使用 Redis 共享限流；未配置时单实例自动使用内存限流 |
| ARK_API_KEY | 通用 OpenAI 兼容模型密钥 |
| GROK_API_KEY / GROK_BASE_URL | Grok 上游配置 |
| GPT_IMAGE_KEY / GPT_IMAGE_BASE_URL | GPT Image 上游配置 |
| GEMINI_API_KEY / GEMINI_BASE_URL | Gemini 上游配置 |
| TELEGRAM_BOT_TOKEN | 可选，Telegram 相关功能使用 |

LLM 和图像上游也可以在应用管理设置中配置。生产环境不要把真实密钥提交到 Git。

## 图生图 API

单图编辑：

~~http
POST /api/image-edit
~~

逐图编辑示例：

~~json
{
  "mode": "per-image",
  "items": [
    {
      "image": "data:image/png;base64,...",
      "prompt": "把背景改成黄昏海边",
      "targetIndex": 0
    }
  ],
  "model": "gpt-image-2",
  "size": "1024x1024"
}
~~

目标图 + 参考图示例：

~~json
{
  "mode": "reference",
  "targetImage": "data:image/png;base64,...",
  "referenceImages": [
    "data:image/png;base64,..."
  ],
  "prompt": "参考参考图的色彩和构图修改目标图",
  "model": "gpt-image-2",
  "size": "1024x1024"
}
~~

批量图生图：

~~http
POST /api/image-edit/batch
~~

批量接口返回 images、total、succeeded、failed 和 lastError，支持部分成功结果。上游 5xx 详情不会直接返回给客户端。

其他常用接口：

| 接口 | 用途 |
| --- | --- |
| POST /api/image | 文生图 |
| POST /api/reverse-prompt | 图片反推提示词 |
| POST /api/v1/images/generations | OpenAI 兼容文生图网关 |
| GET /api/image-history | 当前用户图库历史 |

默认保护限制包括：普通生图每用户每分钟 10 次、图生图每分钟 10 次、批量图生图每分钟 3 次、反推提示词每分钟 10 次。具体业务限制以后端实现为准。

## 常用命令

| 命令 | 说明 |
| --- | --- |
| npm run dev | 启动开发服务器 |
| npm run build | 构建生产版本 |
| npm start | 启动生产服务器 |
| npm test | 运行测试 |
| npm run lint | 运行 ESLint |
| npm run db:generate | 根据 schema 生成迁移 |
| npm run db:migrate | 执行数据库迁移 |
| npm run db:seed | 初始化默认配置和管理员 |
| npm run db:studio | 打开 Drizzle Studio |

提交修改前建议至少运行：

~~bash
npm test
npx tsc --noEmit
npm run lint
~~

## 生产安全清单

- 使用强随机 JWT_SECRET
- 新数据库首次 seed 时设置强 ADMIN_PASSWORD
- 不要把 .env.local、.env.production、API Key 或用户图片提交到仓库
- API_KEY_ENCRYPTION_KEY 必须长期保存，轮换前先规划旧数据迁移
- 公开部署前评估是否关闭开放注册
- 使用 HTTPS，并正确设置 PUBLIC_APP_URL
- 单实例可以使用内存限流；多实例部署应配置 Redis
- 定期备份 PostgreSQL 和 public/images
- 为磁盘、内存、Swap、上游错误和请求延迟设置监控

## License

[MIT](./LICENSE)
