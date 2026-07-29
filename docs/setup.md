# 环境搭建与运行指南

## 环境要求

| 依赖 | 版本要求 | 说明 |
|------|----------|------|
| Node.js | ≥ 18 | 推荐 20 LTS |
| npm | ≥ 9 | 随 Node.js 自带 |
| PostgreSQL | ≥ 14 | 本地安装或 Docker 均可 |
| Git | 任意 | 可选 |

## 项目结构（节选）

```
deep-roast/
├── src/               # 源代码
├── public/            # 静态资源（images/uploads 运行时生成，不入库）
├── docs/              # 文档
├── drizzle/           # 数据库迁移
├── .env.example       # 环境变量模板
├── .env.local         # 本地密钥（勿提交）
├── drizzle.config.ts
└── package.json
```

## 1. 数据库

任选其一：

**Docker 示例（仅 Postgres）：**

```bash
docker run -d --name deep-roast-pg \
  -e POSTGRES_USER=roaster \
  -e POSTGRES_PASSWORD=replace_me \
  -e POSTGRES_DB=deep_roast \
  -p 5432:5432 \
  postgres:16
```

连接串示例：

```
DATABASE_URL=postgres://roaster:replace_me@localhost:5432/deep_roast
```

> 请使用你自己的用户名/密码，不要使用文档里的示例口令上生产。

## 2. 环境变量

```bash
cp .env.example .env.local
```

必填：

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | Postgres URL |
| `JWT_SECRET` | 签名密钥；生产必须设置 |

推荐：

| 变量 | 说明 |
|------|------|
| `ADMIN_PASSWORD` | `npm run db:seed` 时创建 admin 的密码 |

可选上游（也可用应用内设置覆盖）：

- `ARK_API_KEY` / 设置页 Base URL + Key  
- `GROK_API_KEY`、`GROK_BASE_URL`  
- `GPT_IMAGE_KEY`、`GPT_IMAGE_BASE_URL`  
- `GEMINI_API_KEY`、`GEMINI_BASE_URL`  

完整模板见仓库根目录 `.env.example`。

## 3. 安装与迁移

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

浏览器打开 [http://localhost:3000](http://localhost:3000)，使用 admin 登录后：

1. 修改密码（用户菜单）  
2. 设置 → 填写 API Base URL 与 Key，拉取并启用模型  

## 4. 生产构建

```bash
npm run build
npm start
```

确保生产环境已设置 `JWT_SECRET`、`DATABASE_URL`，且 `NODE_ENV=production`（cookie 会启用 `secure`）。

## 5. 给一部分用户用的生产部署（概要）

本应用**不在本机跑大模型**，只跑 Next.js + PostgreSQL，并把请求转发到你配置的 OpenAI 兼容上游。因此：

- **不需要 GPU**
- 需要稳定的 **出网 HTTPS**（访问上游 API）
- 需要 **持久磁盘**（生成图默认写在 `public/images/`）

### 5.1 推荐最小规格（约 5～30 人轻度使用）

| 组件 | 建议 | 说明 |
|------|------|------|
| 应用机 | 2 vCPU / 2～4 GB RAM / 40 GB+ SSD | 跑 `next start`（或 PM2 / systemd / Docker） |
| 数据库 | 托管 Postgres 或同机 1～2 GB 级实例 | 会话、用户、积分、配置；务必备份 |
| 带宽 | 普通云主机即可 | 生图结果多为本机静态文件；上游流量在服务端 |
| 系统 | Ubuntu 22.04+ / Debian 12+ | Node.js 20 LTS |

再小（1 vCPU / 1 GB）可以个人试用，但同机跑 Postgres + 构建时容易内存紧张，建议至少 **2 GB**。

用户变多、生图频繁时，优先加 **磁盘**（图会堆）和 **Postgres 备份**，而不是盲目加 CPU。

### 5.2 必配环境变量（生产）

| 变量 | 要求 |
|------|------|
| `DATABASE_URL` | 生产库连接串（勿用文档示例口令） |
| `JWT_SECRET` | 长随机串；**不设则生产无法正常签发 token** |
| `ADMIN_PASSWORD` | 仅首次 `db:seed` 建议设置；之后立刻改密 |
| `NODE_ENV` | `production`（cookie `secure` 等） |

上游 Key 可写在设置页，或用 `.env` 中的 `ARK_API_KEY` 等（见 `.env.example`）。

### 5.3 进程与反代示例

```bash
npm ci
npm run db:migrate
npm run db:seed    # 仅首次
npm run build
npm start          # 默认 3000；可用 PORT=3000
```

前面建议加 **Nginx / Caddy** 做 HTTPS 反代到 `127.0.0.1:3000`，并限制上传体积。  
进程守护可用 **systemd** 或 **PM2**。

### 5.4 多用户时建议立刻做的

1. **改掉** seed 出来的 admin 默认密码  
2. 评估是否 **关闭公开注册**（当前默认开放；公网请改代码或反代限制）  
3. 定期备份 Postgres +（可选）`public/images`、`public/uploads`  
4. 监控磁盘：生图按张落盘，无自动清理  
5. 上游 Key 配额与费用：用量主要在第三方 API，不在你这台机的 GPU  

单机「应用 + Postgres」可以起步；用户与数据重要后再把数据库拆到托管 RDS。

## 6. 常见问题

**未配置 API Key**  
顶栏会提示；在设置中保存即可（写入数据库，优先于部分 env）。

**迁移失败**  
检查 `DATABASE_URL` 与 Postgres 是否可达；确认 `drizzle/` 目录已随仓库提供。

**生成图磁盘占用**  
图片落在 `public/images/`，已 gitignore；部署时请自行备份或改对象存储（未内置）。
