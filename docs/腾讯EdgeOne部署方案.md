# GEO优化系统 - 腾讯EdgeOne云部署方案

## 一、EdgeOne云平台概述

腾讯EdgeOne是腾讯云推出的边缘计算平台，提供：
- 全球边缘节点加速
- 静态资源CDN分发
- 边缘函数计算
- DDoS防护和WAF
- 智能路由和负载均衡

## 二、架构适配性分析

### 2.1 当前架构评估

**✅ 适合EdgeOne的特性：**
1. **前后端分离架构** - 前端可部署到EdgeOne CDN，后端独立部署
2. **RESTful API设计** - 标准HTTP接口，易于边缘加速
3. **无状态后端** - 便于水平扩展和边缘部署
4. **PostgreSQL数据库** - 可使用腾讯云数据库服务
5. **静态资源构建** - Vite构建的SPA应用，完美适配CDN

**⚠️ 需要调整的部分：**
1. **环境变量管理** - 需要适配EdgeOne的配置方式
2. **API路由** - 需要配置EdgeOne的回源规则
3. **CORS配置** - 需要适配EdgeOne的域名
4. **文件上传** - 如需要，需使用对象存储

### 2.2 推荐部署架构

```
┌─────────────────────────────────────────────────────────┐
│              腾讯EdgeOne边缘网络                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │  全球边缘节点 (CDN + 边缘函数)                   │   │
│  │  - 静态资源加速                                  │   │
│  │  - 智能路由                                      │   │
│  │  - DDoS防护                                      │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                    前端层                                │
│  ┌──────────────────────────────────────────────────┐   │
│  │  EdgeOne CDN (静态资源)                          │   │
│  │  - React SPA应用                                 │   │
│  │  - 全球加速分发                                  │   │
│  │  - 自动HTTPS                                     │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                          ↓ API请求
┌─────────────────────────────────────────────────────────┐
│                    后端层                                │
│  ┌──────────────────────────────────────────────────┐   │
│  │  腾讯云轻量应用服务器 / 云服务器CVM              │   │
│  │  - Node.js + Express                             │   │
│  │  - PM2进程管理                                   │   │
│  │  - Nginx反向代理                                 │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                   数据层                                 │
│  ┌──────────────────────────────────────────────────┐   │
│  │  腾讯云数据库 PostgreSQL                         │   │
│  │  - 主从复制                                      │   │
│  │  - 自动备份                                      │   │
│  │  - 高可用                                        │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                  外部服务                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ DeepSeek API │  │  Gemini API  │  │  Ollama本地  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## 三、详细部署步骤

### 3.1 前置准备

#### 1. 注册腾讯云账号
- 访问 https://cloud.tencent.com
- 完成实名认证
- 开通EdgeOne服务

#### 2. 准备域名
- 购买域名（如已有可跳过）
- 将域名NS记录指向EdgeOne
- 等待DNS生效（通常1-24小时）

#### 3. 创建EdgeOne站点
```bash
# 登录腾讯云控制台
# 进入EdgeOne产品页
# 点击"添加站点"
# 输入域名：example.com
# 选择套餐：标准版或企业版
```

### 3.2 前端部署到EdgeOne CDN

#### 步骤1：构建前端应用

```bash
cd client

# 安装依赖
npm install

# 构建生产版本
npm run build

# 构建产物在 dist 目录
```

#### 步骤2：配置环境变量

创建 `client/.env.production`:

```env
# API地址（使用EdgeOne加速的后端域名）
VITE_API_URL=https://api.your-domain.com

# 其他配置
VITE_APP_NAME=GEO优化系统
VITE_APP_VERSION=1.0.0
```

重新构建：

```bash
npm run build
```

#### 步骤3：上传到腾讯云对象存储COS

```bash
# 安装腾讯云CLI
npm install -g @tencent-cloud/cli

# 配置凭证
tccli configure

# 创建COS存储桶
tccli cos CreateBucket \
  --Bucket geo-system-1234567890 \
  --Region ap-guangzhou

# 上传文件
tccli cos PutObject \
  --Bucket geo-system-1234567890 \
  --Region ap-guangzhou \
  --Key index.html \
  --Body ./dist/index.html

# 或使用COS控制台批量上传
```

**推荐：使用COSBrowser工具**
1. 下载COSBrowser：https://cloud.tencent.com/document/product/436/11366
2. 登录并选择存储桶
3. 将 `dist` 目录下所有文件上传到根目录

#### 步骤4：配置EdgeOne CDN

**在EdgeOne控制台：**

1. **添加源站**
   - 源站类型：对象存储COS
   - 选择刚创建的存储桶
   - 回源协议：HTTPS

2. **配置缓存规则**
   ```
   规则1：HTML文件
   - 匹配：*.html
   - 缓存时间：10分钟
   - 浏览器缓存：不缓存
   
   规则2：JS/CSS文件
   - 匹配：*.js, *.css
   - 缓存时间：30天
   - 浏览器缓存：30天
   
   规则3：图片文件
   - 匹配：*.png, *.jpg, *.svg, *.ico
   - 缓存时间：30天
   - 浏览器缓存：30天
   
   规则4：字体文件
   - 匹配：*.woff, *.woff2, *.ttf
   - 缓存时间：365天
   - 浏览器缓存：365天
   ```

3. **配置HTTPS**
   - 申请免费SSL证书
   - 或上传已有证书
   - 强制HTTPS跳转：开启

4. **配置SPA路由**
   - 错误页面配置
   - 404错误 → 返回 /index.html
   - 状态码：200

5. **配置API代理**
   ```
   路径：/api/*
   目标：https://your-backend-server.com/api/*
   回源协议：HTTPS
   回源Host：your-backend-server.com
   ```

### 3.3 后端部署到腾讯云服务器

#### 步骤1：购买云服务器

**推荐配置：**
- 实例类型：标准型S5
- CPU：2核
- 内存：4GB
- 系统盘：50GB SSD
- 带宽：5Mbps
- 操作系统：Ubuntu 22.04 LTS

#### 步骤2：配置服务器

```bash
# SSH连接服务器
ssh ubuntu@your-server-ip

# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 安装PM2
sudo npm install -g pm2

# 安装Nginx
sudo apt install -y nginx

# 安装Git
sudo apt install -y git
```

#### 步骤3：部署应用

```bash
# 创建应用目录
sudo mkdir -p /var/www/geo-system
sudo chown -R $USER:$USER /var/www/geo-system

# 克隆代码
cd /var/www/geo-system
git clone <your-repo-url> .

# 安装依赖
cd server
npm install --production

# 构建
npm run build
```

#### 步骤4：配置环境变量

创建 `/var/www/geo-system/server/.env`:

```env
NODE_ENV=production
PORT=3000

# 数据库（使用腾讯云数据库）
DATABASE_URL=postgresql://username:password@your-db-host:5432/geo_system

# AI API密钥
DEEPSEEK_API_KEY=your_deepseek_key
GEMINI_API_KEY=your_gemini_key

# Ollama配置（如果使用）
OLLAMA_BASE_URL=http://localhost:11434

# 安全配置
JWT_SECRET=your_jwt_secret_here

# CORS配置（EdgeOne域名）
FRONTEND_URL=https://your-domain.com
```

#### 步骤5：配置Nginx

创建 `/etc/nginx/sites-available/geo-system`:

```nginx
server {
    listen 80;
    server_name api.your-domain.com;
    
    # 重定向到HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.your-domain.com;
    
    # SSL证书（使用腾讯云SSL证书）
    ssl_certificate /etc/nginx/ssl/your-domain.crt;
    ssl_certificate_key /etc/nginx/ssl/your-domain.key;
    
    # SSL配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # 日志
    access_log /var/log/nginx/geo-system-access.log;
    error_log /var/log/nginx/geo-system-error.log;
    
    # 代理到Node.js应用
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # 健康检查
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

启用配置：

```bash
# 创建SSL证书目录
sudo mkdir -p /etc/nginx/ssl

# 上传SSL证书到该目录

# 创建软链接
sudo ln -s /etc/nginx/sites-available/geo-system /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重启Nginx
sudo systemctl restart nginx
```

#### 步骤6：使用PM2启动应用

创建 `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'geo-system',
    script: './dist/index.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
    autorestart: true,
    max_memory_restart: '1G',
    watch: false
  }]
};
```

启动应用：

```bash
# 创建日志目录
mkdir -p logs

# 启动应用
pm2 start ecosystem.config.js

# 保存PM2配置
pm2 save

# 设置开机自启
pm2 startup
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp /home/$USER
```

### 3.4 数据库部署

#### 方案1：使用腾讯云数据库PostgreSQL（推荐）

**优势：**
- 自动备份和恢复
- 高可用主从架构
- 自动监控和告警
- 按需扩容

**步骤：**

1. **购买数据库实例**
   - 登录腾讯云控制台
   - 选择"云数据库 PostgreSQL"
   - 选择配置：
     - 版本：PostgreSQL 14
     - 规格：2核4GB（可按需调整）
     - 存储：50GB SSD
     - 网络：VPC（与云服务器同一VPC）

2. **初始化数据库**
   ```bash
   # 连接数据库
   psql -h your-db-host -U postgres -d postgres
   
   # 创建数据库
   CREATE DATABASE geo_system;
   
   # 创建用户
   CREATE USER geo_user WITH ENCRYPTED PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE geo_system TO geo_user;
   ```

3. **运行迁移**
   ```bash
   cd /var/www/geo-system/server
   npm run db:migrate
   npm run db:migrate:ollama
   ```

4. **配置自动备份**
   - 在控制台设置每日自动备份
   - 保留7天备份
   - 配置备份时间（建议凌晨）

#### 方案2：自建PostgreSQL

如果选择自建，参考 `docs/部署指南.md` 中的数据库部署章节。

### 3.5 配置EdgeOne安全防护

#### 1. DDoS防护

```
在EdgeOne控制台：
- 安全防护 → DDoS防护
- 开启DDoS防护
- 设置防护等级：中等
```

#### 2. Web应用防护（WAF）

```
规则配置：
1. SQL注入防护：开启
2. XSS攻击防护：开启
3. 文件上传防护：开启
4. 恶意爬虫防护：开启
5. CC攻击防护：开启（阈值：1000请求/分钟）
```

#### 3. 访问控制

```
IP黑白名单：
- 白名单：允许特定IP访问管理接口
- 黑名单：屏蔽恶意IP

地域访问控制：
- 允许：中国大陆、香港、美国、欧洲
- 拒绝：其他地区（可选）
```

#### 4. 速率限制

```
API限流规则：
- 路径：/api/*
- 限制：100请求/分钟/IP
- 超限响应：429 Too Many Requests
```

## 四、性能优化配置

### 4.1 EdgeOne性能优化

#### 1. 智能压缩

```
在EdgeOne控制台：
- 性能优化 → 智能压缩
- 开启Gzip压缩
- 开启Brotli压缩
- 压缩类型：text/*, application/javascript, application/json
```

#### 2. HTTP/2和HTTP/3

```
- 开启HTTP/2
- 开启HTTP/3 (QUIC)
- 提升传输性能
```

#### 3. 图片优化

```
- 开启WebP自动转换
- 开启图片压缩
- 质量：80%
```

### 4.2 后端性能优化

#### 1. Node.js优化

```javascript
// server/src/index.ts
import compression from 'compression';
import helmet from 'helmet';

// Gzip压缩
app.use(compression());

// 安全头
app.use(helmet());

// 连接池优化
const pool = new Pool({
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

#### 2. 数据库优化

```sql
-- 创建索引
CREATE INDEX CONCURRENTLY idx_distillations_keyword ON distillations(keyword);
CREATE INDEX CONCURRENTLY idx_distillations_created ON distillations(created_at DESC);
CREATE INDEX CONCURRENTLY idx_topics_distillation ON topics(distillation_id);
CREATE INDEX CONCURRENTLY idx_articles_keyword ON articles(keyword);
CREATE INDEX CONCURRENTLY idx_articles_created ON articles(created_at DESC);

-- 分析表
ANALYZE distillations;
ANALYZE topics;
ANALYZE articles;
```

## 五、监控和运维

### 5.1 EdgeOne监控

```
在EdgeOne控制台查看：
- 请求量统计
- 带宽使用
- 状态码分布
- 响应时间
- 缓存命中率
```

### 5.2 应用监控

#### 1. PM2监控

```bash
# 查看状态
pm2 status

# 查看日志
pm2 logs

# 监控面板
pm2 monit

# 重启应用
pm2 restart geo-system

# 查看详细信息
pm2 show geo-system
```

#### 2. 腾讯云监控

```
在云监控控制台：
- 添加云服务器监控
- 配置告警策略：
  - CPU使用率 > 80%
  - 内存使用率 > 85%
  - 磁盘使用率 > 80%
  - 网络流量异常
```

### 5.3 日志管理

#### 1. 应用日志

```bash
# 查看PM2日志
pm2 logs geo-system --lines 100

# 查看Nginx日志
sudo tail -f /var/log/nginx/geo-system-access.log
sudo tail -f /var/log/nginx/geo-system-error.log
```

#### 2. 日志轮转

创建 `/etc/logrotate.d/geo-system`:

```
/var/www/geo-system/server/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 ubuntu ubuntu
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

## 六、成本估算

### 6.1 EdgeOne费用

```
标准版套餐：
- 基础费用：¥99/月
- 流量费用：¥0.18/GB（中国大陆）
- 请求费用：¥0.02/万次

预估（中小型应用）：
- 月流量：100GB
- 月请求：500万次
- 总费用：¥99 + ¥18 + ¥10 = ¥127/月
```

### 6.2 云服务器费用

```
轻量应用服务器：
- 2核4GB：¥112/月
- 5Mbps带宽
- 50GB SSD

或云服务器CVM：
- 2核4GB：¥150/月
- 按量计费带宽
```

### 6.3 数据库费用

```
云数据库PostgreSQL：
- 2核4GB：¥280/月
- 50GB存储
- 自动备份

或自建数据库：
- 无额外费用（使用云服务器）
```

### 6.4 总成本

```
方案1（使用云数据库）：
EdgeOne: ¥127/月
云服务器: ¥112/月
云数据库: ¥280/月
总计: ¥519/月

方案2（自建数据库）：
EdgeOne: ¥127/月
云服务器: ¥150/月（配置稍高）
总计: ¥277/月
```

## 七、CI/CD自动化部署

### 7.1 使用GitHub Actions

创建 `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Tencent Cloud

on:
  push:
    branches: [ main ]

jobs:
  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Build Frontend
        run: |
          cd client
          npm install
          npm run build
      
      - name: Upload to COS
        uses: TencentCloud/cos-action@v1
        with:
          secret_id: ${{ secrets.TENCENT_CLOUD_SECRET_ID }}
          secret_key: ${{ secrets.TENCENT_CLOUD_SECRET_KEY }}
          cos_bucket: ${{ secrets.COS_BUCKET }}
          cos_region: ap-guangzhou
          local_path: client/dist
          remote_path: /
          clean: true
      
      - name: Purge EdgeOne Cache
        run: |
          # 调用EdgeOne API清除缓存
          curl -X POST "https://edgeone.tencentcloudapi.com/" \
            -H "Content-Type: application/json" \
            -d '{
              "Action": "PurgeUrlsCache",
              "Version": "2022-09-01",
              "Urls": ["https://your-domain.com/*"]
            }'

  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to Server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          script: |
            cd /var/www/geo-system
            git pull origin main
            cd server
            npm install --production
            npm run build
            pm2 restart geo-system
```

### 7.2 配置Secrets

在GitHub仓库设置中添加：
- `TENCENT_CLOUD_SECRET_ID`
- `TENCENT_CLOUD_SECRET_KEY`
- `COS_BUCKET`
- `SERVER_HOST`
- `SERVER_USER`
- `SERVER_SSH_KEY`

## 八、故障排查

### 8.1 常见问题

#### 1. EdgeOne缓存问题

```bash
# 清除EdgeOne缓存
# 在EdgeOne控制台 → 缓存配置 → 缓存刷新
# 输入URL或目录进行刷新
```

#### 2. API跨域问题

```typescript
// server/src/index.ts
app.use(cors({
  origin: [
    'https://your-domain.com',
    'https://www.your-domain.com'
  ],
  credentials: true
}));
```

#### 3. 数据库连接问题

```bash
# 检查安全组规则
# 确保云服务器可以访问数据库端口5432

# 测试连接
psql -h your-db-host -U geo_user -d geo_system
```

## 九、安全加固

### 9.1 服务器安全

```bash
# 配置防火墙
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# 禁用root登录
sudo nano /etc/ssh/sshd_config
# 设置: PermitRootLogin no
sudo systemctl restart sshd

# 安装fail2ban
sudo apt install fail2ban
sudo systemctl enable fail2ban
```

### 9.2 应用安全

```typescript
// 安装安全中间件
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

app.use(helmet());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);
```

## 十、总结

### 10.1 部署检查清单

- [ ] EdgeOne站点已创建并配置
- [ ] 前端已构建并上传到COS
- [ ] CDN缓存规则已配置
- [ ] HTTPS证书已配置
- [ ] 云服务器已购买并配置
- [ ] 后端应用已部署
- [ ] Nginx已配置
- [ ] PM2已启动应用
- [ ] 数据库已创建并迁移
- [ ] 环境变量已配置
- [ ] 安全防护已开启
- [ ] 监控告警已配置
- [ ] 备份策略已设置
- [ ] CI/CD已配置（可选）

### 10.2 优势总结

**使用腾讯EdgeOne的优势：**
1. ✅ 全球CDN加速，访问速度快
2. ✅ 自动DDoS防护和WAF
3. ✅ 智能路由和负载均衡
4. ✅ 免费SSL证书
5. ✅ 简化运维管理
6. ✅ 按需付费，成本可控
7. ✅ 与腾讯云生态无缝集成

### 10.3 后续优化

1. **性能优化**
   - 启用HTTP/3
   - 配置智能压缩
   - 优化数据库查询

2. **功能扩展**
   - 添加用户认证
   - 实现文件上传（使用COS）
   - 添加实时通知

3. **运维提升**
   - 完善监控告警
   - 自动化运维脚本
   - 灾备方案

---

**部署完成后，您的GEO优化系统将运行在腾讯EdgeOne云平台上，享受全球加速和安全防护！** 🚀
