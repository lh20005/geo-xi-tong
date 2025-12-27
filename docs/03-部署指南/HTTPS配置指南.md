# HTTPS配置指南

## 📋 概述

本指南详细说明如何为GEO系统配置HTTPS，提升生产环境安全性。

**当前状态**：系统默认禁用HSTS，可直接使用HTTP访问，避免部署时的强制跳转问题。

## 🔒 为什么需要HTTPS？

### 安全风险分析

**不使用HTTPS的风险：**
- ⚠️ **API密钥泄露**：DeepSeek、Gemini API密钥明文传输
- ⚠️ **支付数据风险**：微信支付相关数据可能被截获
- ⚠️ **用户凭证泄露**：JWT令牌、密码等敏感信息暴露
- ⚠️ **企业数据风险**：知识库、图片等数据可能被窃取
- ⚠️ **中间人攻击**：数据可能被篡改或劫持

### HTTPS的好处

- ✅ **数据加密**：所有传输数据加密保护
- ✅ **身份验证**：确保连接到正确的服务器
- ✅ **数据完整性**：防止数据被篡改
- ✅ **SEO优势**：搜索引擎更偏爱HTTPS网站
- ✅ **用户信任**：浏览器显示安全锁图标
- ✅ **合规要求**：支付功能通常要求HTTPS

## 🚀 配置步骤

### 步骤1：申请SSL证书

#### 方案一：Let's Encrypt免费证书（推荐）

```bash
# 安装Certbot
sudo apt update
sudo apt install certbot python3-certbot-nginx

# 申请证书（替换your-domain.com为你的域名）
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# 测试自动续期
sudo certbot renew --dry-run

# 设置自动续期
sudo crontab -e
# 添加以下行：
0 12 * * * /usr/bin/certbot renew --quiet
```

#### 方案二：购买商业证书

如果需要更高级的证书（如EV证书），可以购买商业证书：

1. 从证书颁发机构购买证书
2. 下载证书文件（.crt和.key）
3. 上传到服务器：`/etc/ssl/certs/`
4. 配置Nginx（参考下面的配置）

### 步骤2：配置Nginx

Certbot会自动修改Nginx配置，但你也可以手动配置：

```nginx
# /etc/nginx/sites-available/geo-system
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    
    # HTTP重定向到HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;
    
    # SSL证书配置
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    # SSL安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # 安全Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # 其余配置与HTTP版本相同...
    # 前端主应用
    location / {
        root /var/www/geo-system/client/dist;
        try_files $uri $uri/ /index.html;
        
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # 后端API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_hide_header X-Powered-By;
    }
    
    # WebSocket
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # 上传文件
    location /uploads {
        alias /var/www/geo-system/server/uploads;
        expires 30d;
        add_header Cache-Control "public";
    }
}
```

### 步骤3：启用HSTS

配置HTTPS后，可以启用HSTS增强安全性：

#### 3.1 修改后端代码

**修改 `server/src/index.ts`：**
```typescript
// 找到这行：
hsts: false

// 改为：
hsts: {
  maxAge: 31536000, // 1 year
  includeSubDomains: true,
  preload: true
}
```

**修改 `server/src/middleware/securityHeaders.ts`：**
```typescript
// 找到这行：
hsts: false,

// 改为：
hsts: {
  maxAge: 31536000, // 1 year
  includeSubDomains: true,
  preload: true
},
```

#### 3.2 更新环境变量

```bash
# 编辑.env文件
nano /var/www/geo-system/.env

# 更新CORS配置
ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com
```

#### 3.3 重启服务

```bash
# 测试Nginx配置
sudo nginx -t

# 重启Nginx
sudo systemctl restart nginx

# 重启后端服务
pm2 restart geo-backend

# 查看状态
pm2 status
sudo systemctl status nginx
```

### 步骤4：验证HTTPS配置

```bash
# 测试HTTPS连接
curl -I https://your-domain.com

# 检查SSL证书
openssl s_client -connect your-domain.com:443 -servername your-domain.com

# 在线SSL测试（推荐）
# 访问：https://www.ssllabs.com/ssltest/
# 输入你的域名进行全面测试
```

## 🔧 故障排除

### 问题1：证书申请失败

**错误信息**：
```
Failed authorization procedure
```

**解决方案**：
```bash
# 检查域名解析
nslookup your-domain.com

# 检查防火墙
sudo ufw status
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 检查Nginx配置
sudo nginx -t

# 停止Nginx重新申请
sudo systemctl stop nginx
sudo certbot certonly --standalone -d your-domain.com
sudo systemctl start nginx
```

### 问题2：混合内容警告

**症状**：HTTPS页面加载HTTP资源被阻止

**解决方案**：
```bash
# 检查前端代码中的HTTP链接
grep -r "http://" /var/www/geo-system/client/dist/

# 更新API基础URL
# 确保前端使用相对路径或HTTPS URL
```

### 问题3：WebSocket连接失败

**解决方案**：
```javascript
// 前端WebSocket连接改为：
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = `${protocol}//${window.location.host}/ws`;
```

### 问题4：证书过期

**解决方案**：
```bash
# 手动续期
sudo certbot renew

# 检查自动续期
sudo systemctl status certbot.timer

# 如果没有自动续期，添加cron任务
sudo crontab -e
# 添加：0 12 * * * /usr/bin/certbot renew --quiet
```

## 📊 安全等级对比

| 配置 | 安全等级 | 适用场景 | 风险 |
|------|----------|----------|------|
| **HTTP** | 🔴 低 | 开发测试 | 数据明文传输 |
| **HTTPS** | 🟡 中 | 基础生产 | 相对安全 |
| **HTTPS + HSTS** | 🟢 高 | 企业生产 | 强制加密传输 |
| **HTTPS + HSTS + CSP** | 🟢 很高 | 金融级 | 全面安全防护 |

## 🎯 最佳实践

### 生产环境推荐配置

1. **使用HTTPS**：必须配置SSL证书
2. **启用HSTS**：防止协议降级攻击
3. **配置CSP**：防止XSS攻击
4. **定期更新证书**：设置自动续期
5. **监控SSL状态**：定期检查证书有效性

### 开发环境配置

1. **使用HTTP**：简化开发流程
2. **禁用HSTS**：避免强制跳转
3. **本地证书**：可选，用于测试HTTPS功能

## 📝 配置检查清单

部署HTTPS后必须检查：

- [ ] SSL证书有效且未过期
- [ ] HTTP自动重定向到HTTPS
- [ ] HSTS头正确设置
- [ ] WebSocket连接正常
- [ ] API调用使用HTTPS
- [ ] 静态资源使用HTTPS
- [ ] 支付功能正常工作
- [ ] 自动续期配置正确

## 🔗 相关文档

- [腾讯云快速部署指南](./腾讯云快速部署指南.md)
- [安全配置优化建议](../04-安全指南/安全配置优化建议.md)
- [强密钥配置说明](../04-安全指南/强密钥配置说明.md)

---

**配置HTTPS是生产环境的重要安全措施，强烈建议在正式上线前完成配置！**