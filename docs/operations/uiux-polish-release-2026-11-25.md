# 2026-11-25 UI/UX 打磨发布记录

## 版本

| 项 | 值 |
| --- | --- |
| 当前线上 | `/opt/deeproast-releases/20261125-uiux-polish-v2` |
| BUILD_ID | `SocmThaY5YN_4ySqoQRDT` |
| 包 SHA256 | `7f46d5cd4dd82b423804d339b1a464825a237bc961871a6be4dba95e0ec3db67` |
| 上一版（回滚目标） | `20261125-uiux-polish`（BUILD_ID `uw2qwS7KwNjDs4vR363CG`） |
| 再上一版 | `20261124-image26-ratio` |
| 数据库迁移 | 无 |

## 发布方式

1. 本地 `npm test` → `npm run build`。
2. 打包 `.next`（排除 `cache`/`dev`）、`public`（排除运行时 `images/`、`uploads/` 内容）、`src`、`drizzle`、`package*.json`、`next.config.ts`、`tsconfig.json`、`postcss.config.mjs`、`eslint.config.mjs`。
3. 服务器脚本 `/home/GGG/deploy-uiux-20261125-v2.sh`：
   - 校验 SHA256 → 新建 release 目录 → `cp -al` 硬链接复用 `node_modules` → 解包；
   - 硬链接保留旧版 `public/images`、`public/uploads`；
   - `chown deeproast:deeproast` → 原子 `mv -Tf` 切换 `/opt/deeproast-current` → `systemctl restart deeproast`；
   - 健康检查 `/login`=200、`/api/config`=401，失败自动回滚（`trap rollback ERR`）。
4. 旧 release 由 `deeproast-prune-releases.timer` 自动清理（保留当前 + 最近 1 个），**不要手动删除**。

## 手动回滚

```bash
sudo ln -sfn /opt/deeproast-releases/20261125-uiux-polish /opt/.deeproast-rollback
sudo mv -Tf /opt/.deeproast-rollback /opt/deeproast-current
sudo systemctl restart deeproast
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/login   # 期望 200
```

## 发布后验证

- `https://deeproast.sryze.cc`：favicon `?v=puppy` 全部 200；创作台浅/深色切换正常；风格菜单仅一个“无预设”；
  `gpt-image-2.6-sunburst` 长模型名下生成按钮在 1280px / 820px 均位于输入框内。
- `/studio/canvas`：小狗品牌顶栏、积分胶囊、主题切换正常，无“提示词库”入口。
- `/admin`：小狗品牌侧栏、统一顶栏、深浅色数据卡正常。
- 移动端 390px：底部四栏导航正常，灵感示例卡片已隐藏。
- 控制台 0 报错，服务 `NRestarts=0`，内存约 220 MB（上限 300M）。
