# Nginx 配置文件说明

## 📁 文件清单

| 文件名 | 状态 | 用途 | 建议 |
|--------|------|------|------|
| **geo-system.conf** | ✅ 推荐使用 | 统一的生产环境配置 | **使用此文件** |
| nginx-fixed.conf | ✅ 当前使用 | 当前服务器配置 | 保留作为参考 |
| nginx-production.conf | ⚠️ 有问题 | 旧的生产配置 | 可以删除 |
| nginx.conf.example | ⚠️ 不完整 | 旧的配置示例 | 可以删除 |
| nginx.conf.production | ⚠️ 有问题 | 旧的生产配置 | 可以删除 |

## ✅ 推荐配置：geo-system.conf

这是最新的、经过优化的配置文件，包含：

### 特性
- ✅ 完整的路由配置（API、WebSocket、前端、营销网站）
- ✅ 静态文件部署（适合生产环境）
- ✅ 安全头配置
- ✅ Gzip压缩
- ✅ 缓存优化
- ✅ 详细的注释说明
- ✅ HTTPS配置模板（可选）

### 路由规则
```
/api/*          → 后端API (localhost:3000)
/ws             → WebSocket (localhost:3000)
/uploads/*      → 上传文件 (静态目录)
/app/*          → 前端应用 (client/dist)
/*              → 营销网站 (landing/dist)
```

## 🚀 部署步骤

### 1. 复制配置文件到服务器
```bash
sudo cp geo-system.conf /etc/nginx/sites-available/
```

### 2. 修改配置
```bash
sudo nano /etc/nginx/sites-available/geo-system.conf
# 修改 server_name 为你的域名或IP
```

### 3. 创建软链接
```bash
sudo ln -s /etc/nginx/sites-available/geo-system.conf /etc/nginx/sites-enabled/
```

### 4. 删除默认配置（如果存在）
```bash
sudo rm /etc/nginx/sites-enabled/default
```

### 5. 测试配置
```bash
sudo nginx -t
```

### 6. 重启Nginx
```bash
sudo systemctl restart nginx
```

### 7. 验证
```bash
# 检查Nginx状态
sudo systemctl status nginx

# 测试API
curl http://YOUR_IP/api/health

# 测试前端
curl http://YOUR_IP/app/

# 测试营销网站
curl http://YOUR_IP/
```

## 🔧 配置说明

### 部署目录结构
```
/var/www/geo-system/
├── client/dist/          # 前端应用构建产物
├── landing/dist/         # 营销网站构建产物
├── server/               # 后端应用
│   ├── dist/            # 后端构建产物
│   └── uploads/         # 上传文件目录
└── .env                 # 环境变量
```

### 端口说明
- **3000**: 后端API服务（Node.js + Express）
- **80**: Nginx HTTP服务
- **443**: Nginx HTTPS服务（如果配置SSL）

### 静态文件 vs 代理模式

**生产环境（推荐）：**
- 前端和营销网站使用静态文件部署
- 只有API和WebSocket使用代理

**开发环境：**
- 所有服务都使用代理模式
- 支持热重载

## 🔒 HTTPS 配置（可选）

如果需要启用HTTPS：

### 1. 申请SSL证书
- 腾讯云SSL证书：https://console.cloud.tencent.com/ssl
- Let's Encrypt免费证书：`sudo certbot --nginx`

### 2. 上传证书到服务器
```bash
sudo mkdir -p /etc/nginx/ssl
sudo cp your-domain.crt /etc/nginx/ssl/
sudo cp your-domain.key /etc/nginx/ssl/
sudo chmod 600 /etc/nginx/ssl/*
```

### 3. 修改配置
取消注释 `geo-system.conf` 中的HTTPS配置部分

### 4. 重启Nginx
```bash
sudo nginx -t
sudo systemctl restart nginx
```

## 🗑️ 清理旧配置

可以安全删除以下文件：
```bash
cd config/nginx/
rm nginx-production.conf
rm nginx.conf.example
rm nginx.conf.production
```

保留：
- ✅ `geo-system.conf` - 推荐使用的配置
- ✅ `nginx-fixed.conf` - 当前使用的配置（作为参考）
- ✅ `README.md` - 本说明文档

## 📝 常见问题

### Q1: 502 Bad Gateway
**原因**：后端服务未启动
**解决**：
```bash
cd /var/www/geo-system/server
pm2 status
pm2 restart geo-backend
```

### Q2: 404 Not Found
**原因**：静态文件路径错误
**解决**：检查 `client/dist` 和 `landing/dist` 目录是否存在

### Q3: 前端路由刷新404
**原因**：`try_files` 配置错误
**解决**：确保配置中有 `try_files $uri $uri/ /index.html;`

### Q4: WebSocket连接失败
**原因**：WebSocket配置错误
**解决**：检查 `/ws` location配置，确保有 `Upgrade` 和 `Connection` 头

## 📚 参考资料

- [Nginx官方文档](https://nginx.org/en/docs/)
- [腾讯云Nginx配置](https://cloud.tencent.com/document/product/214/8975)
- [Let's Encrypt证书](https://letsencrypt.org/)

---

**更新时间：** 2025-12-27  
**版本：** 1.0.0
