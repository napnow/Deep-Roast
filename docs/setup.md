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

## 5. 常见问题

**未配置 API Key**  
顶栏会提示；在设置中保存即可（写入数据库，优先于部分 env）。

**迁移失败**  
检查 `DATABASE_URL` 与 Postgres 是否可达；确认 `drizzle/` 目录已随仓库提供。

**生成图磁盘占用**  
图片落在 `public/images/`，已 gitignore；部署时请自行备份或改对象存储（未内置）。
