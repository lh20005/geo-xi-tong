# GEO系统服务器部署指南

## 服务器信息

| 项目 | 值 |
|------|-----|
| IP | 43.143.163.6 |
| 用户 | ubuntu |
| SSH密钥 | ~/.ssh/kiro_geo.pem |
| 项目路径 | /var/www/geo-system |
| 数据库 | PostgreSQL (geo_system) |
| 数据库用户 | geo_user |

## 快速部署

### 方式一：使用部署脚本（推荐）

```bash
# 增量更新（只更新代码）
./scripts/deploy-to-server.sh update

# 全新部署（清理服务器后部署）
./scripts/deploy-to-server.sh full
```

### 方式二：手动部署

#### 1. 本地构建

```bash
# 构建所有项目
npm run build

# 或分别构建
cd client && npm run build && cd ..
cd server && npm run build && cd ..
cd landing && npm run build && cd ..
```

#### 2. 打包上传

```bash
# 打包
tar -czf geo-system.tar.gz \
  client/dist \
  server/dist \
  server/node_modules \
  server/package.json \
  landing/dist

# 上传
scp -i ~/.ssh/kiro_geo.pem geo-system.tar.gz ubuntu@43.143.163.6:/tmp/
```

#### 3. 服务器部署

```bash
# SSH登录
ssh -i ~/.ssh/kiro_geo.pem ubuntu@43.143.163.6

# 解压部署
sudo mkdir -p /var/www/geo-system
cd /var/www/geo-system
sudo tar -xzf /tmp/geo-system.tar.gz
sudo chown -R ubuntu:ubuntu /var/www/geo-system

# 配置环境变量
cp config/server-deploy/server.env.production server/.env
# 编辑 .env 文件，填入实际配置

# 运行迁移
cd server && npm run db:migrate

# 配置Nginx
sudo cp config/server-deploy/nginx-geo-system.conf /etc/nginx/sites-available/geo-system
sudo ln -sf /etc/nginx/sites-available/geo-system /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 启动服务
pm2 start dist/index.js --name geo-api
pm2 save
```

## 配置文件说明

| 文件 | 说明 |
|------|------|
| `nginx-geo-system.conf` | Nginx配置，处理静态文件和API代理 |
| `server.env.production` | 后端环境变量模板 |
| `pm2.config.js` | PM2进程管理配置 |

## 目录结构（服务器）

```
/var/www/geo-system/
├── client/
│   └── dist/          # 前端构建产物
├── server/
│   ├── dist/          # 后端构建产物
│   ├── node_modules/  # 依赖
│   ├── uploads/       # 上传文件
│   └── .env           # 环境配置
└── landing/
    └── dist/          # 落地页构建产物
```

## 常用运维命令

```bash
# 查看服务状态
pm2 status

# 查看日志
pm2 logs geo-api

# 重启服务
pm2 restart geo-api

# 查看Nginx状态
sudo systemctl status nginx

# 重载Nginx配置
sudo nginx -t && sudo systemctl reload nginx

# 数据库迁移
cd /var/www/geo-system/server && npm run db:migrate

# 查看迁移状态
cd /var/www/geo-system/server && npm run db:status
```

## 数据库管理

```bash
# 连接数据库
PGPASSWORD='GeoSystem2026!' psql -U geo_user -d geo_system -h localhost

# 备份数据库
pg_dump -U geo_user -h localhost geo_system > backup.sql

# 恢复数据库
psql -U geo_user -h localhost geo_system < backup.sql
```

## 故障排查

### 1. API返回500错误

```bash
# 查看错误日志
pm2 logs geo-api --err --lines 50

# 检查数据库连接
cd /var/www/geo-system/server
node -e "require('./dist/db/database').pool.query('SELECT 1')"
```

### 2. 静态资源404

```bash
# 检查文件是否存在
ls -la /var/www/geo-system/client/dist/assets/

# 检查Nginx配置
sudo nginx -t
cat /etc/nginx/sites-enabled/geo-system
```

### 3. WebSocket连接失败

```bash
# 检查Nginx WebSocket配置
grep -A5 "location /ws" /etc/nginx/sites-enabled/geo-system

# 检查后端WebSocket服务
pm2 logs geo-api | grep WebSocket
```

## 更新日志

- 2026-01-11: 初始部署配置
  - 修复 publishing_tasks 表缺少 user_id 列问题
  - 修复 Nginx /app/assets 路径配置
  - 添加 CORS 配置支持服务器IP
