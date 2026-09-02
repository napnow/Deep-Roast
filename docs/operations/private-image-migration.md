# 私有图片与 LLM Key 上线操作

## 1. 预检查

以 systemd 运行用户确认目录权限：

```bash
sudo install -d -o deeproast -g deeproast -m 750 /var/lib/deeproast/images
```

在 `/opt/deeproast/.env.production` 中设置并保护：

```dotenv
DEEPROAST_DATA_DIR=/var/lib/deeproast
API_KEY_ENCRYPTION_KEY=<32-byte-base64>
IMAGE_URL_SIGNING_KEY=<long-random-value>
```

确认 `API_KEY_ENCRYPTION_KEY` 在所有应用实例一致；不要把真实值提交到 Git。

## 2. 数据库迁移与密钥迁移

```bash
cd /opt/deeproast
cp .env.production /root/deeproast.env.production.backup
DATABASE_URL="..." npm run db:migrate
npx tsx scripts/migrate-llm-config-key.ts
```

如果项目使用 systemd 的 `EnvironmentFile`，先让当前 shell 通过受保护方式加载同一组变量，或直接在服务维护窗口执行。命令成功后，应用读取 LLM 配置时会从密文解密，数据库中的 `ark_api_key` 应为空字符串。

## 3. 发布与验证

```bash
systemctl restart deeproast.service
systemctl --no-pager status deeproast.service
curl -fsS https://<domain>/api/health
```

用登录会话生成一张图片，确认返回值为 `/api/images/<uuid>.<ext>`，而不是 `/images/...`。未登录直接访问该地址应返回 401/403；其他用户访问应返回 404 或 403。

生产构建应在干净发布目录执行。不要把 `.deploy/backups` 放在 Next.js 构建根目录；如果必须保留在项目目录，应保证构建用户至少能遍历目录，且环境文件仍只对服务用户/专用组可读。

## 4. 旧图片处理

本次不移动或删除旧图片。旧数据库记录由受保护 API 兼容读取，`/images/*` 静态路径由 middleware 阻断。确认所有客户端切换到新 URL 后，再按备份策略将旧文件迁移到 `DEEPROAST_DATA_DIR/images`，并回填 `image_generations.storage_key`；迁移前请先做数据库和图片目录双重备份。
