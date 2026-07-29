# 深焙 Deep Roast

自托管的 **文生文 · 文生图** 工作台：深度思考、慢焙出好答案。

- Next.js App Router + React 19  
- PostgreSQL + Drizzle ORM  
- Cookie JWT 登录、积分、管理后台  
- OpenAI 兼容上游（自配 Base URL / API Key）

> 适合个人或小团队自托管。默认偏单租户：全局 LLM 配置在库中，公网开放注册前请自行评估风险。

## 功能一览

- 文生文流式对话、会话历史  
- 文生图、风格预设、反推提示词、图生图  
- 普通用户每日签到得积分；文生图按次扣积分（管理员免费）  
- 管理员：用户封禁/删除、积分流水与调配、注册开关、站点公告与联系方式  

## 环境要求

| 依赖 | 版本 |
|------|------|
| Node.js | ≥ 18（推荐 20 LTS） |
| PostgreSQL | ≥ 14 |
| npm | ≥ 9 |

## 快速开始

### 1. 克隆与安装

```bash
git clone <your-repo-url> deep-roast
cd deep-roast
npm install
```

### 2. 环境变量

```bash
cp .env.example .env.local
```

编辑 `.env.local`，至少设置：

- `DATABASE_URL` — Postgres 连接串  
- `JWT_SECRET` — 长随机串（**生产必填**）  
- `ADMIN_PASSWORD` — 首次 seed 的管理员密码（推荐）  

### 3. 数据库

准备好空库后：

```bash
npm run db:migrate
npm run db:seed
```

默认管理员用户名：`admin`（密码来自 `ADMIN_PASSWORD`，未设置时仅本地弱默认并警告）。

### 4. 开发 / 生产

```bash
npm run dev      # http://localhost:3000
npm run build && npm start
```

登录后在 **设置** 中填写 API Base URL 与 Key，并启用模型。

## 常用脚本

| 脚本 | 说明 |
|------|------|
| `npm run dev` | 开发服务器 |
| `npm run build` / `start` | 生产构建与启动 |
| `npm run lint` | ESLint |
| `npm run db:generate` | 根据 schema 生成迁移 |
| `npm run db:migrate` | 执行迁移 |
| `npm run db:seed` | 写入默认配置与管理员 |
| `npm run db:studio` | Drizzle Studio（可选） |

## 安全提示

- **不要**把 `.env.local`、真实 Key、用户生成图提交进仓库  
- 生产必须设置强 `JWT_SECRET`；未设置时生产环境会拒绝签发 token  
- 公开部署时：考虑关闭注册、轮换默认 admin 密码、限制上传与积分刷量  
- `public/images`、`public/uploads` 为运行时内容，已在 `.gitignore` 中忽略  

## 文档

| 文档 | 说明 |
|------|------|
| [环境与运行](docs/setup.md) | 安装、迁移、环境变量 |
| [产品范围](docs/PRD.md) | 功能与非目标 |
| [API 概要](docs/api.md) | 主要路由约定 |
| [架构说明](docs/architecture.md) | 技术栈与数据流 |
| [文生图系统提示词](docs/image-system-prompt.md) | 全局生图前缀说明 |

## 小范围部署提示

自托管给少数用户时，通常需要：**1 台可跑 Node 的机器 + PostgreSQL + 磁盘存图 + 你自己的上游 API Key**。  
不必自备 GPU（推理在外部网关）。生产务必设置强 `JWT_SECRET`、改掉默认 admin 密码，并评估是否开放注册。详见 [docs/setup.md](docs/setup.md)。

## License

[MIT](./LICENSE)
