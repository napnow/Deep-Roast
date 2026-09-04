# 2026-09-04 完整生产版本恢复说明

## 目标与结论

本次恢复以服务器当前安全版本 `fce9589` 为安全基线，以封存的原生产源码为功能基线。结果不是回退安全修复，也不是直接覆盖整个目录，而是逐个子系统合并：恢复原生产功能，同时保留已经上线的安全、数据一致性和运维能力。

恢复完成后，GitHub `master`、服务器 `/opt/deeproast` 与 `/opt/deeproast-current` 应指向同一个提交。发布前后必须用 `git rev-parse HEAD` 和当前 release 的版本文件核对，不允许再次用未提交的部署目录替代 Git 历史。

## 原因

此前安全发布错误地把不完整的 Git 快照当成了完整生产源码。原生产环境中的部分界面和功能只存在于工作区或后续 release 目录，没有全部进入该快照。安全修复虽然生效，但手机管理端、注册 IP 开关、模型通道、API Key 入口和公告二维码等功能因此被旧文件覆盖。

本次已把完整原版单独封存，并在独立恢复分支中按测试契约合并。原始工作区没有被改写。

## 恢复的功能

- 手机端四入口工作台、移动抽屉、聊天历史、签到和 API Key 入口。
- 完整手机管理端用户选择与用户详情功能。
- 管理端“同一 IP 注册限制”开关；默认开启，关闭时只跳过单 IP 唯一限制，不关闭注册频率限制。
- 用户和管理员 API Key 管理、查看一次性密钥、轮换、禁用和删除。
- 多模型通道、默认模型绑定、模型目录与聊天/生图/图推路由。
- 公告二维码图片上传、折叠展示和删除清理。
- 邀请、打赏、签到、图生图续作、移动端图生图等原生产交互。

## 保留并扩展的安全控制

- `PUT /api/config` 必须等待管理员校验完成。
- 自定义模型目录和模型通道 Base URL 必须是可解析到公网地址的 HTTPS URL，禁止内网、环回、凭据 URL 和跳转绕过。
- 普通用户只能调用管理员启用的模型；模型通道只使用该通道自己的密钥，不借用其他通道或旧配置密钥。
- 聊天、生图、图生图和 v1 生图保留请求幂等、上游幂等键、超时、响应体上限和错误脱敏。
- 积分预扣、流水和退款保留数据库事务及 reservation 唯一约束。
- 新图片保存在 `DEEPROAST_DATA_DIR/images`，经 `/api/images/[key]` 鉴权读取；管理员查看其他用户图片时使用 owner-scoped URL。
- 用户 API Key、主 LLM API Key、模型通道 API Key 均使用 `API_KEY_ENCRYPTION_KEY` 做 AES-256-GCM 加密存储。
- 公告二维码只接受 PNG、JPEG、WebP，校验文件签名且最大 2 MiB。

## 数据库迁移

迁移全部为 additive/idempotent，不包含 `DROP TABLE` 或 `DROP COLUMN`：

1. `0018_request_idempotency_and_private_images.sql`
2. `0019_encrypt_llm_config_key.sql`
3. `0020_registration_ip_limit.sql`
4. `0021_model_channels.sql`
5. `0022_announcement_qr_image.sql`

`0021` 会保留线上已有模型通道，只在缺少表/字段时创建或补齐，并新增通道密钥的 ciphertext、IV、auth tag 字段。SQL 迁移完成后必须运行通道密钥迁移脚本；脚本在单个数据库事务中处理所有通道，只有成功生成密文后才清空旧明文，重复执行不会重复加密。

生产执行顺序：

```bash
npm run db:migrate
npx tsx scripts/migrate-llm-config-key.ts
npm run db:migrate-channel-keys
```

三条命令都要求服务环境中存在同一个 `API_KEY_ENCRYPTION_KEY`。不得输出、复制或提交该值。迁移后检查时只统计空/非空字段，禁止查询 Key 内容。

## 发布流程

1. 备份 PostgreSQL、`DEEPROAST_DATA_DIR` 和当前 release 路径。
2. 从已提交的恢复版本创建新的不可变 release 目录。
3. 使用 lockfile 安装依赖并运行完整验证。
4. 运行数据库迁移和两项密钥迁移。
5. 在新 release 内完成 `npm run build`。
6. 原子切换 `/opt/deeproast-current`，重启 `deeproast`，不重启整台服务器。
7. 验证服务、匿名权限边界、数据库字段和 Git 提交一致性后再推送/确认 `master`。

验证命令：

```bash
npm test
npx tsc --noEmit --incremental false
npm run lint
npm run build
systemctl is-active deeproast caddy
curl -fsS http://127.0.0.1:3000/ >/dev/null
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/api/admin/site-settings
```

预期：测试、类型、Lint、构建通过；两个服务均为 `active`；首页为 200；匿名访问管理员接口为 401。

## 发布后功能核对

- 手机宽度打开首页，底部工作台导航和移动抽屉可用。
- 手机宽度打开管理端，可选择用户并进入图片、对话、积分和 API Key 功能。
- “站点与内容 → 站点设置”可见注册 IP 限制开关。
- “AI 能力”可管理多个模型通道；聊天、生图、图推使用选定默认通道。
- 管理员能查看其他用户的新私有图片和受保护的旧图片，匿名用户不能直接访问。
- 公告可上传二维码，用户端默认折叠并可展开。

## 回滚

代码回滚只需把 `/opt/deeproast-current` 原子切回上一 release 并重启 `deeproast`。本次迁移只加表和字段，旧代码会忽略它们，因此一般不回滚数据库结构。

如果密钥迁移后回滚到不支持加密通道 Key 的旧代码，该旧代码将无法读取已清空的 `api_key` 明文字段；此时应继续使用本恢复版本，或先部署兼容读取密文字段的版本。不得把密钥解密回数据库明文作为常规回滚手段。

回滚后仍需验证首页、匿名管理员接口、服务状态和数据库连接。当前 release、上一 release、数据库备份和数据目录备份在稳定观察期结束前都应保留。
