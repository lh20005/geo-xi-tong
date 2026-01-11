---
inclusion: manual
---

# 服务器 SSH 配置

## 生产服务器 (43.143.163.6)

| 项目 | 值 |
|------|-----|
| Host | 43.143.163.6 |
| User | ubuntu |
| Private Key | /Users/lzc/.ssh/kiro_geo.pem |
| 项目路径 | /var/www/geo-system |
| 数据库 | PostgreSQL (geo_system) |
| 数据库用户 | geo_user |

## MCP SSH 工具调用参数

```
host: 43.143.163.6
user: ubuntu
privateKeyPath: /Users/lzc/.ssh/kiro_geo.pem
```

## 服务信息

| 服务 | 路径/命令 |
|------|----------|
| PM2 进程 | geo-api |
| 后端 API | http://localhost:3000 |
| 前端静态文件 | /var/www/geo-system/client/dist/ |
| 落地页静态文件 | /var/www/geo-system/landing/dist/ |
| 后端代码 | /var/www/geo-system/server/dist/ |
| 上传目录 | /var/www/geo-system/server/uploads/ |
| Nginx 配置 | /etc/nginx/sites-available/geo-system |
| 环境配置 | /var/www/geo-system/server/.env |

## 常用命令

```bash
# 查看服务状态
pm2 status

# 查看日志
pm2 logs geo-api --lines 50

# 重启服务
pm2 restart geo-api

# 数据库迁移
cd /var/www/geo-system/server && npm run db:migrate

# 健康检查
curl http://localhost:3000/api/health
```

## 部署

详细部署文档见: `config/server-deploy/README.md`

快速部署命令:
```bash
# 增量更新
./scripts/deploy-to-server.sh update

# 全新部署
./scripts/deploy-to-server.sh full
```
