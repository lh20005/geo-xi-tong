# GEO优化系统 - 宣传网站部署指南

## 📋 目录

1. [系统架构](#系统架构)
2. [端口规划](#端口规划)
3. [本地开发](#本地开发)
4. [腾讯云部署](#腾讯云部署)
5. [Nginx配置](#nginx配置)
6. [常见问题](#常见问题)

## 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                    用户浏览器                              │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Nginx (80/443)                              │
│  ┌──────────────┬──────────────┬──────────────┐        │
│  │   /          │   /app       │   /api       │        │
└──┴──────────────┴──────────────┴──────────────┴────────┘
   │              │              │
   ▼              ▼              ▼
┌──────────┐  ┌──────────┐  ┌──────────┐
│ 宣传网站  │  │ 系统应用  │  │ 后端API  │
│  :8080   │  │  :5173   │  │  :3000   │
└──────────┘  └──────────┘  └──────────┘
```

## 端口规划

| 服务 | 端口 | 说明 | 外部访问 |
|------|------|------|----------|
| Nginx | 80/443 | 反向代理 | ✅ |
| 宣传网站 | 8080 | Landing Page | ❌ (通过Nginx) |
| 系统应用 | 5173 | 主应用 | ❌ (通过Nginx) |
| 后端API | 3000 | API服务 | ❌ (通过Nginx) |

## 本地开发

### 1. 安装依赖

```bash
cd landing
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

访问 `http://localhost:8080`

### 3. 测试登录流程

1. 确保后端服务运行在 3000 端口
2. 确保系统应用运行在 5173 端口
3. 在宣传网站点击"登录"
4. 输入用户名密码（默认: admin/admin123）
5. 登录成功后自动跳转到系统应用

## 腾讯云部署

### 方案一：使用部署脚本（推荐）

```bash
# 1. 上传代码到服务器
git clone <your-repo> /var/www/geo-system
cd /var/www/geo-system/landing

# 2. 运行部署脚本
sudo ./deploy.sh
```

### 方案二：手动部署

#### 步骤1: 安装Node.js和PM2

```bash
# 安装Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装PM2
sudo npm install -g pm2
```

#### 步骤2: 构建项目

```bash
cd /var/www/geo-system/landing
npm install
npm run build
```

#### 步骤3: 启动服务

```bash
# 使用PM2启动
pm2 start npm --name geo-landing -- run preview
pm2 save
pm2 startup
```

#### 步骤4: 配置Nginx

```bash
# 复制配置文件
sudo cp nginx.conf.example /etc/nginx/sites-available/geo-system

# 编辑配置文件
sudo nano /etc/nginx/sites-available/geo-system

# 创建软链接
sudo ln -s /etc/nginx/sites-available/geo-system /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重载Nginx
sudo nginx -s reload
```

#### 步骤5: 配置SSL证书（腾讯云）

```bash
# 1. 在腾讯云SSL证书管理下载证书
# 2. 上传证书到服务器
sudo mkdir -p /etc/nginx/ssl
sudo cp your-cert.crt /etc/nginx/ssl/
sudo cp your-key.key /etc/nginx/ssl/

# 3. 修改Nginx配置中的证书路径
sudo nano /etc/nginx/sites-available/geo-system

# 4. 重载Nginx
sudo nginx -s reload
```

## Nginx配置

### 完整配置示例

参考 `landing/nginx.conf.example` 文件

### 关键配置说明

#### 1. 路径映射

```nginx
# 宣传网站 - 根路径
location / {
    proxy_pass http://localhost:8080;
}

# 系统应用 - /app路径
location /app {
    rewrite ^/app(.*)$ $1 break;
    proxy_pass http://localhost:5173;
}

# 后端API - /api路径
location /api {
    proxy_pass http://localhost:3000;
}
```

#### 2. SSL配置

```nginx
ssl_certificate /etc/nginx/ssl/your-cert.crt;
ssl_certificate_key /etc/nginx/ssl/your-key.key;
ssl_protocols TLSv1.2 TLSv1.3;
```

#### 3. 性能优化

```nginx
# Gzip压缩
gzip on;
gzip_types text/plain text/css application/json application/javascript;

# 静态资源缓存
location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
    expires 30d;
    add_header Cache-Control "public, immutable";
}
```

## 服务管理

### PM2命令

```bash
# 查看状态
pm2 status

# 查看日志
pm2 logs geo-landing

# 重启服务
pm2 restart geo-landing

# 停止服务
pm2 stop geo-landing

# 删除服务
pm2 delete geo-landing

# 监控
pm2 monit
```

### Nginx命令

```bash
# 测试配置
sudo nginx -t

# 重载配置
sudo nginx -s reload

# 重启Nginx
sudo systemctl restart nginx

# 查看状态
sudo systemctl status nginx

# 查看日志
sudo tail -f /var/log/nginx/geo-access.log
sudo tail -f /var/log/nginx/geo-error.log
```

## 域名配置

### 1. 在腾讯云DNS添加记录

```
类型: A
主机记录: @
记录值: 你的服务器IP
TTL: 600
```

### 2. 配置www子域名

```
类型: CNAME
主机记录: www
记录值: your-domain.com
TTL: 600
```

### 3. 等待DNS生效（通常5-10分钟）

```bash
# 检查DNS解析
nslookup your-domain.com
```

## 安全配置

### 1. 防火墙设置

```bash
# 允许HTTP和HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 禁止直接访问应用端口
sudo ufw deny 8080/tcp
sudo ufw deny 5173/tcp
sudo ufw deny 3000/tcp

# 启用防火墙
sudo ufw enable
```

### 2. 定期更新

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 更新Node.js依赖
cd /var/www/geo-system/landing
npm update
```

## 监控和日志

### 1. 应用日志

```bash
# PM2日志
pm2 logs geo-landing --lines 100

# 实时日志
pm2 logs geo-landing --raw
```

### 2. Nginx日志

```bash
# 访问日志
sudo tail -f /var/log/nginx/geo-access.log

# 错误日志
sudo tail -f /var/log/nginx/geo-error.log
```

### 3. 系统监控

```bash
# CPU和内存使用
pm2 monit

# 磁盘使用
df -h

# 网络连接
netstat -tulpn | grep LISTEN
```

## 常见问题

### Q1: 登录后无法跳转到系统应用

**原因**: 系统应用未启动或端口不正确

**解决**:
```bash
# 检查系统应用是否运行
pm2 list

# 检查端口占用
lsof -i :5173

# 重启系统应用
cd /var/www/geo-system/client
pm2 start npm --name geo-app -- run preview
```

### Q2: Nginx 502 Bad Gateway

**原因**: 上游服务未启动

**解决**:
```bash
# 检查所有服务状态
pm2 status

# 重启所有服务
pm2 restart all

# 检查Nginx配置
sudo nginx -t
```

### Q3: SSL证书错误

**原因**: 证书路径不正确或证书过期

**解决**:
```bash
# 检查证书文件
ls -la /etc/nginx/ssl/

# 检查证书有效期
openssl x509 -in /etc/nginx/ssl/your-cert.crt -noout -dates

# 重新配置证书路径
sudo nano /etc/nginx/sites-available/geo-system
```

### Q4: 端口被占用

**原因**: 其他进程占用了端口

**解决**:
```bash
# 查找占用进程
lsof -i :8080

# 杀死进程
kill -9 <PID>

# 或修改端口
# 编辑 landing/vite.config.ts 修改端口号
```

### Q5: 构建失败

**原因**: 依赖问题或内存不足

**解决**:
```bash
# 清除缓存
rm -rf node_modules package-lock.json
npm install

# 增加Node.js内存
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build
```

## 性能优化

### 1. 启用CDN（腾讯云CDN）

1. 在腾讯云CDN控制台添加域名
2. 配置源站为你的服务器IP
3. 开启HTTPS和HTTP/2
4. 配置缓存规则

### 2. 数据库优化

```sql
-- 添加索引
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_articles_created_at ON articles(created_at);
```

### 3. 应用优化

```bash
# 使用生产模式
NODE_ENV=production pm2 start npm --name geo-landing -- run preview

# 启用集群模式
pm2 start npm --name geo-landing -i max -- run preview
```

## 备份策略

### 1. 数据库备份

```bash
# 每日备份脚本
#!/bin/bash
DATE=$(date +%Y%m%d)
pg_dump geo_system > /backup/geo_system_$DATE.sql
```

### 2. 代码备份

```bash
# 使用Git
cd /var/www/geo-system
git add .
git commit -m "Backup $(date)"
git push origin main
```

## 联系支持

如遇到问题，请联系：
- 📧 Email: contact@example.com
- 📞 Phone: 400-xxx-xxxx
- 💬 微信: your-wechat-id
