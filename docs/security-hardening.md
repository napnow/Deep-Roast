# Deep Roast 安全加固说明

更新时间：2026-09-02

本次修改针对服务器 `/opt/deeproast` 的生产分支完成，并与上游 [napnow/Deep-Roast](https://github.com/napnow/Deep-Roast) 的 `origin/master` 做了对比。上游分支与服务器当前业务线存在较大历史差异，因此保留服务器现有 UI、模型目录和部署改动，只将安全修复作为独立提交叠加，没有直接合并上游全部内容。

## 问题闭环

| 风险 | 处理结果 |
| --- | --- |
| `next.config.ts` 暴露 `JWT_SECRET` | 已确认当前配置不再写入 `env`；JWT 只在 Node route 内读取。若历史版本曾部署过该配置，必须轮换 JWT_SECRET。 |
| `PUT /api/config` 缺少 `await requireAdmin` | 已修复并保留管理员校验。 |
| `/api/models` 任意 `baseUrl` 搭配服务端 Key 造成 SSRF | 已要求管理员操作；自定义地址必须是公开 HTTPS，且必须显式提供本次请求的 Key，不复用数据库 Key。 |
| 扣积分与流水不在同一事务 | 已统一使用数据库事务；预扣、退款和流水带有唯一 reservation identity。 |
| 模型调用、图片落盘、数据库和扣费缺少幂等 | 已增加持久化 `request_idempotency` 表。聊天、文生图、图生图、批量图生图和 v1 生图接口支持 `Idempotency-Key`；上游请求也会收到稳定的幂等键。 |
| 图片位于 `public/images` | 新图片写入 `DEEPROAST_DATA_DIR/images`，通过 `/api/images/[key]` 按用户归属或签名 token 读取；middleware 拒绝 `/images/*` 直出。旧记录保留兼容读取，但旧静态路径也被阻断。 |
| 模型请求无超时 | 已保留并统一使用上游请求超时、响应体上限和流式聊天最长生命周期。 |
| LLM API Key 明文写入 PostgreSQL | 新配置使用 AES-256-GCM 字段；迁移脚本会在事务中加密旧 `ark_api_key` 并清空明文。 |

## 关键配置

生产环境至少需要：

- `JWT_SECRET`：JWT 签名密钥。
- `API_KEY_ENCRYPTION_KEY`：32 字节 Base64；用于用户 API Key 和管理员 LLM Key。
- `DEEPROAST_DATA_DIR`：`public/` 之外的可读写目录，例如 `/var/lib/deeproast`。
- `IMAGE_URL_SIGNING_KEY`：建议设置为独立随机密钥；未设置时暂回退到 `JWT_SECRET`。

不要把上述值写进 `next.config.ts` 的 `env`、`NEXT_PUBLIC_*` 或前端代码。

## API 客户端约定

对会产生上游调用或扣费的请求，客户端应发送唯一且稳定的 `Idempotency-Key`。同一业务重试必须复用同一个键；新的业务操作必须生成新键。未提供该 header 的旧客户端仍可运行，但服务端会为该次请求生成一次性键，无法跨网络重试去重。

## 数据库迁移

迁移文件：

- `drizzle/0018_request_idempotency_and_private_images.sql`
- `drizzle/0019_encrypt_llm_config_key.sql`

先备份数据库，再运行：

```bash
npm run db:migrate
npx tsx scripts/migrate-llm-config-key.ts
```

第二条命令要求 `API_KEY_ENCRYPTION_KEY` 已配置。脚本不会输出 Key 内容；若发现同一行同时存在密文和非空旧明文，会停止并要求人工处理。

## 回滚与兼容

- 旧图片记录没有 `storage_key` 时仍可由受保护 API 读取；不要把旧文件重新暴露为静态资源。
- 新图片目录应纳入备份，并与数据库备份保持一致。
- 密钥迁移前不要删除 `API_KEY_ENCRYPTION_KEY`；更换该密钥前必须先完成专门的数据重加密流程。

## 本次服务器执行结果

- 已在服务器数据库 `mydb` 应用上述两条 additive migration。
- 已执行 `scripts/migrate-llm-config-key.ts`；旧明文字段已清空，密文、IV 和认证标签均已写入。
- 已创建 release /opt/deeproast-releases/20260903-security-hardening，并将 deeproast.service 原子切换到该版本；本次仅重启应用服务，没有重启服务器。
- 已在服务器运行配置中启用持久化目录 /opt/deeproast-data 和独立图片签名密钥，旧图库与上传文件均保留。
- Caddy 已禁止 /images/* 静态直出；图片统一通过 /api/images/[key] 做登录、用户归属和路径校验。
