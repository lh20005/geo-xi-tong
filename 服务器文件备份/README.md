# 服务器文件备份说明

**备份日期**: 2026-01-17  
**备份原因**: Windows 端 PostgreSQL 迁移完成，删除服务器端已迁移的表和代码

---

## 备份内容

### 1. 服务层文件 (services/)

| 文件名 | 大小 | 说明 | 状态 |
|--------|------|------|------|
| ~~AccountService.js~~ | - | 平台账号管理服务 | ❌ 服务器上不存在 |
| PublishingService.js | 22KB | 发布任务管理服务 | ✅ 已备份 |

**注意**：服务器上没有 `AccountService.js`，可能已被删除或从未部署。

### 2. 路由文件 (routes/)

| 文件名 | 大小 | 说明 | 状态 |
|--------|------|------|------|
| platformAccounts.js | 13KB | 平台账号 API | ✅ 已备份 |
| publishingTasks.js | 37KB | 发布任务 API | ✅ 已备份 |
| distillation.js | 33KB | 蒸馏任务 API | ✅ 已备份 |
| topic.js | 6KB | 话题管理 API | ✅ 已备份 |
| articleSettings.js | 7KB | 文章设置 API | ✅ 已备份 |

### 3. 数据库备份 (database/)

| 文件名 | 大小 | 说明 |
|--------|------|------|
| backup_deleted_tables_20260117.sql | 1.6MB | 17 个表的完整数据备份 |

**备份的表**（17 个）:
- articles - 文章
- platform_accounts - 平台账号
- publishing_tasks - 发布任务
- publishing_records - 发布记录
- publishing_logs - 发布日志
- knowledge_bases - 知识库
- knowledge_documents - 知识库文档
- albums - 图库相册
- images - 图片
- distillations - 蒸馏任务
- topics - 话题
- conversion_targets - 转化目标
- article_settings - 文章设置
- distillation_config - 蒸馏配置
- image_usage - 图片使用记录
- distillation_usage - 蒸馏使用记录
- topic_usage - 话题使用记录

---

## 恢复方法

### 恢复代码文件

```bash
# 恢复服务层文件
scp -i "私钥路径" 服务器文件备份/services/*.js ubuntu@124.221.247.107:/var/www/geo-system/server/services/

# 恢复路由文件
scp -i "私钥路径" 服务器文件备份/routes/*.js ubuntu@124.221.247.107:/var/www/geo-system/server/routes/
```

### 恢复数据库表

```bash
# 1. 上传备份文件到服务器
scp -i "私钥路径" 服务器文件备份/database/backup_deleted_tables_20260117.sql ubuntu@124.221.247.107:/tmp/

# 2. 在服务器上恢复
ssh -i "私钥路径" ubuntu@124.221.247.107
sudo -u postgres psql -d geo_system -f /tmp/backup_deleted_tables_20260117.sql
```

---

## 注意事项

1. **不要删除此备份目录**，至少保留 3 个月
2. **恢复前先停止服务**：`pm2 stop geo-server`
3. **恢复后重启服务**：`pm2 restart geo-server`
4. **验证功能**：确保恢复后功能正常

---

## 删除记录

### 服务器端已删除的文件

**服务层**:
- ✅ /var/www/geo-system/server/services/AccountService.js
- ✅ /var/www/geo-system/server/services/PublishingService.js

**路由层**:
- ✅ /var/www/geo-system/server/routes/platformAccounts.js
- ✅ /var/www/geo-system/server/routes/publishingTasks.js
- ✅ /var/www/geo-system/server/routes/distillation.js
- ✅ /var/www/geo-system/server/routes/topic.js
- ✅ /var/www/geo-system/server/routes/articleSettings.js

**数据库表**:
- ⏳ 待删除（建议观察一段时间后再删除）

---

## 相关文档

- [服务器端表清理计划](../../docs/07-开发文档/服务器端表清理计划.md)
- [PostgreSQL 迁移完成报告](../../docs/07-开发文档/PostgreSQL迁移-项目最终交付报告.md)
