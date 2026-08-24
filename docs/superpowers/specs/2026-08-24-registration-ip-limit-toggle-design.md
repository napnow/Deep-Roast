# 注册 IP 限制可配置开关

## 目标

临时关闭“同一公网 IP 只能注册一个账号”的业务限制，让共享网络、移动网络或 VPN 出口下的新用户可以注册；保留用户名唯一性、密码强度校验和请求频率限制。

## 方案

在注册接口增加环境变量 `REGISTRATION_IP_LIMIT_ENABLED`：

- 未设置或值为 `true` 时，保持现有行为：检查 `registration_records`，成功注册后写入 IP 记录。
- 值为 `false` 时，跳过单 IP 注册检查和 `registration_records` 写入。
- 该开关不影响用户名唯一约束、邀请逻辑、密码校验、Cloudflare 回源限制以及每小时 10 次的注册请求限流。

生产环境先设置为 `false`，验证目标用户可以注册；需要恢复时改为 `true` 并重启服务即可。现有 `registration_records` 数据保留，不做删除。

## 测试与验证

新增纯函数/配置行为测试，覆盖：

1. 未设置配置时单 IP 限制默认开启。
2. 配置为 `false` 时单 IP 限制关闭。
3. 配置为 `true` 时单 IP 限制开启。

部署后进行以下检查：

- 类型检查、相关单元测试和生产构建通过。
- 服务重启后保持 active。
- 注册接口不再因已有 `registration_records` 拒绝新用户名。
- 用户名重复仍返回“用户名已存在”。
- 登录、Cloudflare-only 回源和现有 API 不受影响。

## 回滚

将 `REGISTRATION_IP_LIMIT_ENABLED` 改回 `true`，重启 `deeproast` 服务即可恢复单 IP 注册限制；不需要回滚数据库迁移，也不删除既有记录。
