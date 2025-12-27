# 🎉 GEO系统服务器部署成功

## 📋 部署信息

**部署时间**: 2025-12-27  
**服务器IP**: 43.143.163.6  
**操作系统**: Ubuntu 24.04 LTS  
**部署状态**: ✅ 成功

---

## 🚀 访问地址

| 服务 | 地址 | 状态 |
|------|------|------|
| 前端应用 | http://43.143.163.6/app/ | ✅ 运行中（已修复403错误）|
| 营销网站 | http://43.143.163.6 | ✅ 运行中（已修复重定向问题）|
| 后端API | http://43.143.163.6/api/health | ✅ 运行中 |

> **注意**: 
> 1. 如果访问营销网站时仍然跳转到 `your-domain.com`，请清除浏览器缓存或使用硬刷新（Ctrl+Shift+R / Cmd+Shift+R）。详见 [LANDING_REDIRECT_FIX.md](./LANDING_REDIRECT_FIX.md)
> 2. 前端应用路径已从根路径改为 `/app/`，详见 [LANDING_APP_PATH_FIX.md](./LANDING_APP_PATH_FIX.md)
> 3. Nginx配置已修复403错误，详见 [NGINX_403_FIX.md](./NGINX_403_FIX.md)

---

## 👤 管理员账号

```
用户名: lzc2005
密码:   jehI2oBuNMMJehMM
```

---

## 📦 已部署的服务

### 1. 后端服务 (PM2)
- **进程名**: geo-backend
- **端口**: 3000
- **状态**: online
- **自动重启**: 已启用
- **开机自启**: 已配置

### 2. Nginx
- **端口**: 80, 443
- **状态**: active (running)
- **配置文件**: /etc/nginx/sites-available/geo-system

### 3. PostgreSQL
- **版本**: 16.11
- **数据库**: geo_system
- **用户**: geo_user
- **状态**: active

### 4. Redis
- **端口**: 6379
- **状态**: active (running)

### 5. Google Chrome
- **版本**: 143.0.7499.169
- **用途**: Puppeteer浏览器自动化

---

## 🔧 部署步骤总结

1. ✅ 清理服务器已有项目
2. ✅ 安装系统依赖（Node.js, PostgreSQL, Redis, Nginx, Chrome等）
3. ✅ 配置数据库（创建用户和数据库）
4. ✅ 构建项目（前端、后端、营销网站）
5. ✅ 上传项目文件到服务器
6. ✅ 安装后端依赖
7. ✅ 运行数据库迁移
8. ✅ 配置Nginx反向代理
9. ✅ 启动PM2服务
10. ✅ 配置开机自启

---

## 📝 服务器配置

### 环境变量 (.env)
```bash
# 数据库
DATABASE_URL=postgresql://geo_user:H2SwIAkyzT1G4mAhkbtSULfG@localhost:5432/geo_system

# 服务器
PORT=3000
NODE_ENV=production

# JWT密钥（256位）
JWT_SECRET=eeca6b8fd34cc378411cee4d5d9e405ba2470f34f31f65ca42a3b2ec6c44a144
JWT_REFRESH_SECRET=fcb44972cd8b6833229122d109cf7bca8254332045fef7a683de973fd84ec392

# 管理员账号
ADMIN_USERNAME=lzc2005
ADMIN_PASSWORD=jehI2oBuNMMJehMM

# Puppeteer
PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
BROWSER_HEADLESS=true

# CORS
ALLOWED_ORIGINS=http://43.143.163.6,https://43.143.163.6
```

### 目录结构
```
/var/www/geo-system/
├── .env                    # 环境变量
├── server/                 # 后端应用
│   ├── dist/              # 编译后的代码
│   ├── node_modules/      # 依赖包
│   └── package.json
├── client/                 # 前端应用
│   └── dist/              # 构建产物
└── landing/                # 营销网站
    └── dist/              # 构建产物
```

---

## 🔍 常用运维命令

### PM2 管理
```bash
# 查看状态
pm2 status

# 查看日志
pm2 logs geo-backend

# 重启服务
pm2 restart geo-backend

# 停止服务
pm2 stop geo-backend

# 实时监控
pm2 monit
```

### Nginx 管理
```bash
# 测试配置
sudo nginx -t

# 重启服务
sudo systemctl restart nginx

# 查看日志
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### 数据库管理
```bash
# 连接数据库
PGPASSWORD='H2SwIAkyzT1G4mAhkbtSULfG' psql -U geo_user -d geo_system -h localhost

# 备份数据库
pg_dump -U geo_user geo_system > backup_$(date +%Y%m%d).sql

# 恢复数据库
psql -U geo_user geo_system < backup.sql
```

### 系统服务
```bash
# 查看所有服务状态
sudo systemctl status nginx postgresql redis

# 重启服务
sudo systemctl restart nginx
sudo systemctl restart postgresql
sudo systemctl restart redis
```

---

## 🔒 安全配置

### 已实施的安全措施

1. ✅ **强密钥保护**
   - JWT密钥：256位随机字符串
   - 管理员密码：强密码策略

2. ✅ **环境变量保护**
   - .env文件权限：600（仅所有者可读写）
   - 敏感信息不提交到代码仓库

3. ✅ **速率限制**
   - 登录限流：5次/15分钟
   - 注册限流：3次/1小时
   - API限流：500次/分钟

4. ✅ **防火墙配置**
   - 开放端口：22 (SSH), 80 (HTTP), 443 (HTTPS)
   - 其他端口：已关闭

5. ✅ **Nginx安全Headers**
   - X-Frame-Options: SAMEORIGIN
   - X-Content-Type-Options: nosniff
   - X-XSS-Protection: 1; mode=block

6. ✅ **数据库安全**
   - 独立用户权限
   - 密码认证
   - 本地连接限制

---

## 📊 系统监控

### 健康检查
```bash
# API健康检查
curl http://43.143.163.6/api/health

# 预期响应
{"status":"ok","message":"GEO优化系统运行正常"}
```

### 服务状态
```bash
# 检查所有服务
pm2 status
sudo systemctl status nginx postgresql redis
```

---

## 🐛 故障排查

### Landing页面重定向问题

**症状**: 访问 `http://43.143.163.6` 时跳转到 `your-domain.com`

**原因**: 浏览器缓存了旧版本的JavaScript文件

**解决方案**:
1. **硬刷新**（推荐）
   - Windows/Linux: `Ctrl + Shift + R`
   - macOS: `Cmd + Shift + R`

2. **清除浏览器缓存**
   - Chrome: 设置 → 隐私和安全 → 清除浏览数据
   - Firefox: 设置 → 隐私与安全 → 清除数据
   - Safari: 开发 → 清空缓存

3. **验证修复**
   - 打开开发者工具 (F12)
   - 查看 Console 标签
   - 应该看到: `configVersion: "1.0.1-20251227"`
   - 应该看到: `isRemoteTestServer: true`
   - 应该看到: `clientUrl: "http://43.143.163.6"`

详细信息请查看: [LANDING_REDIRECT_FIX.md](./LANDING_REDIRECT_FIX.md)

### 后端服务无法启动
```bash
# 查看PM2日志
pm2 logs geo-backend --lines 50

# 检查环境变量
cat /var/www/geo-system/.env

# 检查数据库连接
PGPASSWORD='H2SwIAkyzT1G4mAhkbtSULfG' psql -U geo_user -d geo_system -h localhost -c "SELECT 1;"
```

### Nginx 502错误
```bash
# 检查后端是否运行
pm2 status

# 检查端口占用
sudo lsof -i :3000

# 查看Nginx错误日志
sudo tail -f /var/log/nginx/error.log
```

### 数据库连接失败
```bash
# 检查PostgreSQL状态
sudo systemctl status postgresql

# 检查数据库用户
sudo -u postgres psql -c "\du"

# 测试连接
PGPASSWORD='H2SwIAkyzT1G4mAhkbtSULfG' psql -U geo_user -d geo_system -h localhost
```

---

## 📈 性能优化建议

### 1. 数据库优化
- 定期执行 VACUUM ANALYZE
- 监控慢查询日志
- 适当增加连接池大小

### 2. Redis缓存
- 配置合适的内存限制
- 设置过期策略
- 监控内存使用

### 3. Nginx优化
- 启用gzip压缩
- 配置静态文件缓存
- 调整worker进程数

### 4. PM2优化
- 根据CPU核心数配置cluster模式
- 设置内存限制和自动重启
- 启用日志轮转

---

## 🔄 更新部署流程

### 1. 本地构建
```bash
# 在本地项目目录
npm run build
```

### 2. 打包上传
```bash
# 打包
tar -czf server.tar.gz -C server dist package.json package-lock.json src/db/*.sql
tar -czf client.tar.gz -C client dist
tar -czf landing.tar.gz -C landing dist

# 上传
sshpass -p "Woaini7758521@" scp server.tar.gz client.tar.gz landing.tar.gz ubuntu@43.143.163.6:/tmp/
```

### 3. 服务器部署
```bash
# SSH登录
ssh ubuntu@43.143.163.6

# 解压
cd /var/www/geo-system
tar -xzf /tmp/server.tar.gz -C server/
tar -xzf /tmp/client.tar.gz -C client/
tar -xzf /tmp/landing.tar.gz -C landing/

# 复制SQL文件
cp server/src/db/*.sql server/dist/db/

# 重启服务
pm2 restart geo-backend
```

---

## 📞 技术支持

### 服务器信息
- **IP**: 43.143.163.6
- **SSH用户**: ubuntu
- **SSH密码**: Woaini7758521@

### 数据库信息
- **主机**: localhost
- **端口**: 5432
- **数据库**: geo_system
- **用户**: geo_user
- **密码**: H2SwIAkyzT1G4mAhkbtSULfG

---

## ✅ 部署检查清单

- [x] 服务器依赖安装完成
- [x] 数据库创建并配置
- [x] 项目文件上传成功
- [x] 后端依赖安装完成
- [x] 数据库迁移执行成功
- [x] Nginx配置正确
- [x] PM2服务运行正常
- [x] 开机自启配置完成
- [x] API健康检查通过
- [x] 前端页面可访问
- [x] 安全配置已实施

---

**部署完成时间**: 2025-12-27 15:58  
**部署状态**: ✅ 成功  
**系统版本**: v1.0.0
