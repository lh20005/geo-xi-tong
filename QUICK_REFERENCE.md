# 快速参考卡片 🚀

## 数据库迁移系统

### 常用命令

```bash
# 查看迁移状态
cd server && npm run db:status

# 执行所有待迁移
npm run db:migrate

# 回滚最后一次迁移
npm run db:rollback

# 创建新迁移
npm run db:create -- add_new_feature

# 一键部署到生产
./scripts/deployment/deploy-migrations.sh
```

### 创建新迁移的完整流程

```bash
# 1. 创建迁移文件
cd server
npm run db:create -- add_email_to_users

# 2. 编辑生成的文件
# server/src/db/migrations/003_add_email_to_users.sql

# 3. 执行迁移
npm run db:migrate

# 4. 验证结果
npm run db:status

# 5. 提交代码
git add server/src/db/migrations/003_add_email_to_users.sql
git commit -m "feat: add email field to users"
```

### 生产环境部署

```bash
# 方法1：自动化脚本（推荐）
./scripts/deployment/deploy-migrations.sh

# 方法2：手动部署
# 1. 备份数据库
ssh ubuntu@server "pg_dump geo_system > backup.sql"

# 2. 上传迁移文件
scp -r server/src/db/migrations ubuntu@server:/var/www/geo-system/server/src/db/

# 3. 执行迁移
ssh ubuntu@server "cd /var/www/geo-system/server && npm run db:migrate"

# 4. 验证
ssh ubuntu@server "cd /var/www/geo-system/server && npm run db:status"
```

### 故障恢复

```bash
# 迁移失败 - PostgreSQL 会自动回滚，修复后重新执行
npm run db:migrate

# 需要回滚
npm run db:rollback

# 查看错误日志
pm2 logs geo-backend
```

---

## 服务器管理

### PM2 进程管理

```bash
# 查看状态
pm2 status

# 查看日志
pm2 logs geo-backend

# 重启服务
pm2 restart geo-backend

# 停止服务
pm2 stop geo-backend

# 启动服务
pm2 start geo-backend
```

### 数据库管理

```bash
# 连接数据库
psql -U geo_user -d geo_system -h localhost

# 备份数据库
pg_dump -U geo_user geo_system > backup_$(date +%Y%m%d).sql

# 恢复数据库
psql -U geo_user -d geo_system < backup.sql

# 查看表列表
\dt

# 查看表结构
\d table_name

# 退出
\q
```

### Nginx 管理

```bash
# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx

# 查看状态
sudo systemctl status nginx

# 查看日志
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

---

## 常见问题快速解决

### API 返回 500 错误

```bash
# 1. 查看后端日志
pm2 logs geo-backend --lines 50

# 2. 检查数据库连接
psql -U geo_user -d geo_system -h localhost

# 3. 检查迁移状态
cd /var/www/geo-system/server && npm run db:status

# 4. 重启服务
pm2 restart geo-backend
```

### 前端无法访问

```bash
# 1. 检查 Nginx 状态
sudo systemctl status nginx

# 2. 检查 Nginx 配置
sudo nginx -t

# 3. 查看 Nginx 日志
sudo tail -f /var/log/nginx/error.log

# 4. 重启 Nginx
sudo systemctl restart nginx
```

### 数据库连接失败

```bash
# 1. 检查 PostgreSQL 状态
sudo systemctl status postgresql

# 2. 检查数据库是否存在
sudo -u postgres psql -l | grep geo_system

# 3. 测试连接
psql -U geo_user -d geo_system -h localhost

# 4. 重启 PostgreSQL
sudo systemctl restart postgresql
```

---

## 安全检查清单

```bash
# 1. 检查 .env 文件权限
ls -la /var/www/geo-system/.env
# 应该是：-rw------- 1 ubuntu ubuntu

# 2. 检查防火墙
sudo ufw status
# 应该开放：22, 80, 443

# 3. 检查敏感文件是否可访问
curl http://YOUR_SERVER_IP/.env  # 应该 404
curl http://YOUR_SERVER_IP/.git/config  # 应该 404

# 4. 检查所有服务状态
sudo systemctl status postgresql
sudo systemctl status redis
sudo systemctl status nginx
pm2 status
```

---

## 性能监控

```bash
# 系统资源使用
htop

# 磁盘使用
df -h

# 内存使用
free -h

# 数据库大小
psql -U geo_user -d geo_system -c "
  SELECT pg_size_pretty(pg_database_size('geo_system'));
"

# PM2 监控
pm2 monit
```

---

## 文档快速链接

- 📖 [数据库迁移使用指南](./DATABASE_MIGRATION_GUIDE.md)
- 📖 [迁移系统总结](./MIGRATION_SYSTEM_SUMMARY.md)
- 📖 [部署指南](./docs/03-部署指南/腾讯云快速部署指南.md)
- 📖 [安全指南](./docs/04-安全指南/)
- 📖 [测试指南](./docs/05-测试指南/)

---

## 紧急联系

如遇紧急问题：
1. 查看相关文档
2. 运行诊断脚本：`./scripts/testing/部署前最终检查.sh`
3. 查看系统日志
4. 联系技术支持

---

**提示**：将此文件保存到书签或打印出来，方便随时查阅！
