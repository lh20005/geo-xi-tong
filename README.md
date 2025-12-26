# GEO 优化系统 🚀

<div align="center">

**专业的品牌AI推荐优化工具**

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)

</div>

---

## 📖 项目简介

GEO（Generative Engine Optimization）优化系统是一个专业的品牌AI推荐优化工具，旨在帮助品牌提升在AI平台（如ChatGPT、Claude、Gemini等）的主动推荐率。

通过智能的关键词蒸馏和AI驱动的内容生成，系统能够：
- 🎯 分析关键词，生成真实用户搜索问题
- 💡 管理和优化话题内容
- ✨ 自动生成高质量SEO文章
- 🔄 支持多个AI模型灵活切换

---

## ✨ 核心功能

### 🤖 AI 集成
- DeepSeek API / Google Gemini API
- 本地 Ollama 支持（无需 API 密钥）
- 灵活切换 AI 模型

### 📝 内容生成
- 关键词蒸馏和话题管理
- AI 驱动的文章生成
- 批量文章生成任务
- 企业知识库智能引用

### 🖼️ 资源管理
- 企业图库（相册和图片管理）
- 企业知识库（文档上传和解析）
- 文章设置模板
- 转化目标管理

### 👥 用户系统
- 用户注册和登录
- 邀请码推荐系统
- 实时跨平台同步（WebSocket）
- 限流保护和安全加固

### 💳 订阅和支付
- 订阅套餐系统（体验版/专业版/企业版）
- 微信支付集成
- 订单管理
- 使用量统计

### 🔒 安全管理
- 安全仪表板和实时监控
- 审计日志和操作记录
- 细粒度权限管理（20种权限）
- 动态安全策略配置

---

## 🚀 快速开始

### 方式一：一键启动（推荐 - macOS）⚡

```bash
# 首次使用，赋予执行权限
chmod +x start.command

# 双击 start.command 文件
# 或在终端运行
./start.command
```

### 方式二：手动启动

#### 1. 安装依赖

```bash
npm run install:all
```

#### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，配置数据库和 API 密钥
```

#### 3. 创建数据库并运行迁移

```bash
createdb geo_system
cd server && npm run db:migrate
```

#### 4. 启动开发服务器

```bash
npm run dev
```

访问地址：
- 🌐 前端应用: http://localhost:5173
- 🌐 营销网站: http://localhost:8080
- 🔧 后端 API: http://localhost:3000

---

## 📁 项目结构

```
geo-optimization-system/
├── client/                    # 前端应用（React + TypeScript）
├── landing/                   # 营销网站
├── server/                    # 后端应用（Node.js + Express）
├── windows-login-manager/     # Windows 登录管理器
├── docs/                      # 📚 文档目录
│   ├── 01-快速开始/          # 新手入门
│   ├── 02-功能说明/          # 功能详细说明
│   ├── 03-部署指南/          # 生产环境部署 ⭐
│   ├── 04-安全指南/          # 安全配置 🔒
│   ├── 05-测试指南/          # 测试和诊断
│   ├── 06-问题修复/          # 问题修复记录
│   ├── 07-开发文档/          # 开发过程文档
│   ├── 08-用户界面文档/      # UI 设计文档
│   └── 09-安全评估/          # 安全评估报告
├── scripts/                   # 🔧 工具脚本
│   ├── deployment/           # 部署脚本
│   ├── testing/              # 测试脚本
│   ├── maintenance/          # 维护脚本
│   └── security/             # 安全脚本
├── config/                    # ⚙️ 配置文件
│   └── nginx/                # Nginx 配置
├── .env.example              # 环境变量模板
└── README.md                 # 本文件
```

---

## � 腾讯导云生产环境部署

### 服务器要求

**推荐配置：**
- 操作系统：Ubuntu 22.04 LTS 或 Ubuntu 20.04 LTS
- CPU：2核或以上
- 内存：4GB 或以上
- 硬盘：40GB 或以上
- 带宽：3Mbps 或以上

**为什么选择 Ubuntu？**
- ✅ 软件包最新且稳定
- ✅ 社区支持最好
- ✅ Puppeteer 依赖最容易安装
- ✅ 所有工具都有官方支持

### 系统依赖说明

本系统需要以下依赖，部署时会自动安装：

| 依赖类型 | 包名 | 用途 | 是否必需 |
|---------|------|------|---------|
| **基础工具** | curl, wget, git, unzip, tar | 下载和解压文件 | ✅ 必需 |
| **编译工具** | build-essential, python3 | 编译原生 Node.js 模块（bcrypt, pdf-parse） | ✅ 必需 |
| **运行时** | Node.js 18 | JavaScript 运行环境 | ✅ 必需 |
| **数据库** | PostgreSQL 14+ | 主数据库 | ✅ 必需 |
| **缓存** | Redis 6+ | 缓存和会话存储 | ✅ 必需 |
| **Web服务器** | Nginx | 反向代理和静态文件服务 | ✅ 必需 |
| **进程管理** | PM2 | Node.js 进程管理 | ✅ 必需 |
| **浏览器** | Google Chrome | 文章生成和自动化 | ✅ 必需 |
| **浏览器依赖** | 38个系统库 | Chrome 运行所需 | ✅ 必需 |
| **中文字体** | fonts-wqy-zenhei | 中文内容显示 | ⭐ 推荐 |
| **防火墙** | ufw | 服务器安全 | ⭐ 推荐 |
| **SSL证书** | certbot | HTTPS 支持 | ⭐ 推荐 |

### 第一步：安装系统依赖（30分钟）

```bash
# 1. 更新系统
sudo apt update && sudo apt upgrade -y

# 2. 安装基础工具
sudo apt install -y curl wget git unzip tar

# 3. 安装编译工具（必需，用于编译 bcrypt、pdf-parse 等原生模块）
sudo apt install -y build-essential python3 python3-pip

# 4. 安装 Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo bash -
sudo apt install -y nodejs

# 5. 安装 PostgreSQL
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql

# 6. 安装 Redis
sudo apt install -y redis-server
sudo systemctl enable redis
sudo systemctl start redis

# 7. 安装 Nginx
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx

# 8. 安装 PM2（进程管理器）
sudo npm install -g pm2

# 9. 安装 Puppeteer 依赖（用于文章生成和浏览器自动化）
sudo apt install -y \
  ca-certificates \
  fonts-liberation \
  libappindicator3-1 \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libc6 \
  libcairo2 \
  libcups2 \
  libdbus-1-3 \
  libexpat1 \
  libfontconfig1 \
  libgbm1 \
  libgcc1 \
  libglib2.0-0 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libpango-1.0-0 \
  libpangocairo-1.0-0 \
  libstdc++6 \
  libx11-6 \
  libx11-xcb1 \
  libxcb1 \
  libxcomposite1 \
  libxcursor1 \
  libxdamage1 \
  libxext6 \
  libxfixes3 \
  libxi6 \
  libxrandr2 \
  libxrender1 \
  libxss1 \
  libxtst6 \
  lsb-release \
  xdg-utils

# 10. 安装中文字体（支持中文内容显示）
sudo apt install -y fonts-wqy-zenhei fonts-wqy-microhei

# 11. 安装 Google Chrome（推荐，比 Chromium 更稳定）
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo dpkg -i google-chrome-stable_current_amd64.deb
sudo apt install -f -y  # 修复依赖问题
rm google-chrome-stable_current_amd64.deb

# 12. 配置防火墙（可选但推荐）
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw --force enable

# 验证安装
node -v
npm -v
psql --version
redis-cli --version
nginx -v
google-chrome --version
pm2 --version
git --version
```

### 第二步：配置数据库（10分钟）

```bash
# 创建数据库和用户
sudo -u postgres psql << EOF
CREATE DATABASE geo_system;
CREATE USER geo_user WITH PASSWORD 'H2SwIAkyzT1G4mAhkbtSULfG';
GRANT ALL PRIVILEGES ON DATABASE geo_system TO geo_user;
\q
EOF

# 验证连接
psql -U geo_user -d geo_system -h localhost -W
```

### 第三步：上传代码（15分钟）

```bash
# 在服务器上创建目录
sudo mkdir -p /var/www/geo-system
sudo chown -R $USER:$USER /var/www/geo-system

# 在本地打包代码
cd server && tar -czf server-dist.tar.gz dist package.json package-lock.json
cd ../client && tar -czf client-dist.tar.gz dist
cd ../landing && tar -czf landing-dist.tar.gz dist

# 上传到服务器（替换 YOUR_SERVER_IP）
scp server/server-dist.tar.gz ubuntu@YOUR_SERVER_IP:/var/www/geo-system/
scp client/client-dist.tar.gz ubuntu@YOUR_SERVER_IP:/var/www/geo-system/
scp landing/landing-dist.tar.gz ubuntu@YOUR_SERVER_IP:/var/www/geo-system/

# 在服务器上解压
cd /var/www/geo-system
tar -xzf server-dist.tar.gz -C server/
tar -xzf client-dist.tar.gz -C client/
tar -xzf landing-dist.tar.gz -C landing/
```

### 第四步：配置环境变量（10分钟）⭐ 重要

在服务器上创建 `/var/www/geo-system/.env` 文件：

```bash
# ==================== 数据库配置 ====================
DATABASE_URL=postgresql://geo_user:H2SwIAkyzT1G4mAhkbtSULfG@localhost:5432/geo_system

# ==================== AI API配置 ====================
# 替换为你的真实 API Key
DEEPSEEK_API_KEY=sk-your-real-deepseek-key
GEMINI_API_KEY=AIzaSy-your-real-gemini-key

# Ollama配置（可选，用于本地AI模型）
OLLAMA_BASE_URL=http://localhost:11434

# ==================== 服务器配置 ====================
PORT=3000
NODE_ENV=production

# ==================== 🔒 强密钥配置（必须使用） ====================
# JWT 访问令牌密钥（256位随机字符串）
JWT_SECRET=eeca6b8fd34cc378411cee4d5d9e405ba2470f34f31f65ca42a3b2ec6c44a144

# JWT 刷新令牌密钥（256位随机字符串）
JWT_REFRESH_SECRET=fcb44972cd8b6833229122d109cf7bca8254332045fef7a683de973fd84ec392

# 令牌过期时间
JWT_EXPIRES_IN=1h
REFRESH_TOKEN_EXPIRES_IN=7d

# WebSocket配置
WEBSOCKET_PORT=8080

# ==================== 🔒 管理员账号（必须修改） ====================
ADMIN_USERNAME=lzc2005
ADMIN_PASSWORD=jehI2oBuNMMJehMM

# ==================== Puppeteer 浏览器配置 ====================
# Chrome 可执行文件路径
PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome

# 跳过 Chromium 下载（使用系统 Chrome）
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# 浏览器模式（服务器环境必须使用 headless）
BROWSER_HEADLESS=true

# 浏览器超时时间（毫秒）
BROWSER_TIMEOUT=60000

# ==================== 限流配置 ====================
# 登录限流：5次/15分钟（防暴力破解）
LOGIN_RATE_LIMIT=5
LOGIN_RATE_WINDOW_MINUTES=15

# 注册限流：3次/1小时（防恶意注册）
REGISTRATION_RATE_LIMIT=3
REGISTRATION_RATE_WINDOW_HOURS=1

# API 全局限流：500次/分钟（生产环境）
# 说明：
# - 单用户正常使用：约70次/分钟
# - 500次/分钟可支持10人同时使用
# - 既保护服务器又不影响正常使用
# - 开发环境自动调整为1000次/分钟

# ==================== 🔒 CORS 配置 ====================
# 允许的来源（替换为你的域名，逗号分隔）
ALLOWED_ORIGINS=http://YOUR_SERVER_IP,https://your-domain.com

# ==================== 微信支付配置（可选） ====================
WECHAT_PAY_APP_ID=wx1234567890abcdef
WECHAT_PAY_MCH_ID=1234567890
WECHAT_PAY_API_V3_KEY=your_32_character_api_v3_key_here
WECHAT_PAY_SERIAL_NO=1234567890ABCDEF1234567890ABCDEF12345678
WECHAT_PAY_PRIVATE_KEY_PATH=/var/www/geo-system/certs/apiclient_key.pem
WECHAT_PAY_NOTIFY_URL=https://your-domain.com/api/payment/wechat/notify

# ==================== Redis配置 ====================
REDIS_URL=redis://:your_redis_password@localhost:6379
```

**设置文件权限（重要）：**

```bash
# 设置 .env 文件权限为 600（只有所有者可读写）
chmod 600 /var/www/geo-system/.env

# 验证权限
ls -la /var/www/geo-system/.env
# 应该显示：-rw------- 1 ubuntu ubuntu
```

### 第五步：安装依赖并启动（10分钟）

```bash
# 安装后端依赖
cd /var/www/geo-system/server
npm ci --production

# 运行数据库迁移
npm run db:migrate

# 使用 PM2 启动后端服务
pm2 start dist/index.js --name geo-backend

# 设置开机自启
pm2 startup
pm2 save

# 查看状态
pm2 status
pm2 logs geo-backend
```

### 第六步：配置 Nginx（15分钟）

创建 `/etc/nginx/sites-available/geo-system`：

```nginx
server {
    listen 80;
    server_name YOUR_SERVER_IP;  # 替换为你的 IP 或域名
    
    # 安全 Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # 禁止访问敏感文件
    location ~ /\. { deny all; return 404; }
    location ~ ^/(src|server|node_modules) { deny all; return 404; }
    location ~ \.(env|json|yml|yaml|config|ts|map)$ { deny all; return 404; }
    
    # 前端主应用
    location / {
        root /var/www/geo-system/client/dist;
        try_files $uri $uri/ /index.html;
        
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # Landing 页
    location /landing {
        alias /var/www/geo-system/landing/dist;
        try_files $uri $uri/ /landing/index.html;
    }
    
    # 后端 API
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
    }
    
    # 上传文件
    location /uploads {
        alias /var/www/geo-system/server/uploads;
        expires 30d;
        add_header Cache-Control "public";
    }
}
```

**启用配置：**

```bash
# 创建软链接
sudo ln -s /etc/nginx/sites-available/geo-system /etc/nginx/sites-enabled/

# 删除默认配置
sudo rm /etc/nginx/sites-enabled/default

# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx
```

### 第七步：验证部署（5分钟）

```bash
# 检查服务状态
pm2 status
sudo systemctl status nginx
sudo systemctl status postgresql
sudo systemctl status redis

# 测试 API
curl http://localhost:3000/api/health

# 浏览器访问
# 前端：http://YOUR_SERVER_IP
# API：http://YOUR_SERVER_IP/api/health
```

### 🎉 部署完成！

访问 `http://YOUR_SERVER_IP` 使用以下账号登录：
- 用户名：`lzc2005`
- 密码：`jehI2oBuNMMJehMM`

---

## 🔒 安全配置说明

### 强密钥说明

系统使用以下强密钥保护安全：

1. **JWT_SECRET**（256位）
   - 用于加密用户登录令牌
   - 破解时间：数十亿年
   - 必须保密，不能泄露

2. **JWT_REFRESH_SECRET**（256位）
   - 用于加密刷新令牌
   - 允许用户保持登录状态
   - 必须与 JWT_SECRET 不同

3. **ADMIN_PASSWORD**（强密码）
   - 管理员登录密码
   - 包含大小写字母和数字
   - 建议定期更换

### 速率限制说明

系统实现了智能速率限制：

- **生产环境**：500次/分钟
  - 单用户正常使用：约70次/分钟
  - 可支持10人同时使用
  - 有效防止暴力攻击

- **开发环境**：1000次/分钟
  - 方便调试和测试
  - 自动根据 NODE_ENV 切换

- **登录限流**：5次/15分钟
  - 防止暴力破解密码
  - 按 IP + 用户名限制

- **注册限流**：3次/1小时
  - 防止恶意注册
  - 按 IP 地址限制

### 安全检查清单

部署后必须检查：

```bash
# 1. 检查 .env 文件权限
ls -la /var/www/geo-system/.env
# 应该是：-rw------- 1 ubuntu ubuntu

# 2. 检查敏感文件是否可访问
curl http://YOUR_SERVER_IP/.env  # 应该 404
curl http://YOUR_SERVER_IP/.git/config  # 应该 404

# 3. 检查 HTTP Headers
curl -I http://YOUR_SERVER_IP
# 应该包含安全 headers

# 4. 检查防火墙
sudo ufw status
# 应该显示：Status: active
# 应该开放：22, 80, 443 端口

# 5. 检查服务状态
sudo systemctl status postgresql
sudo systemctl status redis
sudo systemctl status nginx
pm2 status
```

---

## ❓ 常见部署问题

### Q1: npm install 失败（bcrypt 编译错误）

**错误信息**：
```
gyp ERR! build error
gyp ERR! stack Error: `make` failed with exit code: 2
```

**原因**：缺少编译工具

**解决方案**：
```bash
# 安装编译工具
sudo apt install -y build-essential python3 python3-pip

# 重新安装依赖
cd /var/www/geo-system/server
rm -rf node_modules package-lock.json
npm install
```

### Q2: Chrome 启动失败

**错误信息**：
```
Failed to launch chrome!
```

**解决方案**：
```bash
# 检查 Chrome 是否安装
google-chrome --version

# 检查缺少的依赖
ldd /usr/bin/google-chrome | grep "not found"

# 重新安装 Puppeteer 依赖
sudo apt install -y ca-certificates fonts-liberation libappindicator3-1 \
  libasound2 libatk-bridge2.0-0 libatk1.0-0 libgbm1 libgtk-3-0 \
  libnss3 libxss1 fonts-wqy-zenhei fonts-wqy-microhei
```

### Q3: 数据库连接失败

**错误信息**：
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**解决方案**：
```bash
# 检查 PostgreSQL 状态
sudo systemctl status postgresql

# 启动 PostgreSQL
sudo systemctl start postgresql

# 检查数据库是否存在
sudo -u postgres psql -l | grep geo_system
```

### Q4: 端口被占用

**错误信息**：
```
Error: listen EADDRINUSE: address already in use :::3000
```

**解决方案**：
```bash
# 查找占用端口的进程
sudo lsof -i :3000

# 杀死进程
sudo kill -9 <PID>

# 或修改 .env 中的端口
PORT=3001
```

### Q5: 防火墙阻止访问

**症状**：本地可以访问，外网无法访问

**解决方案**：
```bash
# 检查防火墙状态
sudo ufw status

# 开放必要端口
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 检查腾讯云安全组
# 登录腾讯云控制台 → 服务器 → 防火墙 → 添加规则
```

### Q6: Redis 连接失败

**解决方案**：
```bash
# 检查 Redis 状态
sudo systemctl status redis

# 启动 Redis
sudo systemctl start redis

# 测试连接
redis-cli ping
# 应该返回：PONG
```

### Q7: Nginx 配置错误

**解决方案**：
```bash
# 测试 Nginx 配置
sudo nginx -t

# 查看错误日志
sudo tail -f /var/log/nginx/error.log

# 重新加载配置
sudo systemctl reload nginx
```

---

## 🔧 常用运维命令

### PM2 管理

```bash
pm2 status              # 查看状态
pm2 logs geo-backend    # 查看日志
pm2 restart geo-backend # 重启服务
pm2 stop geo-backend    # 停止服务
pm2 monit               # 实时监控
```

### Nginx 管理

```bash
sudo nginx -t                              # 测试配置
sudo systemctl restart nginx               # 重启 Nginx
sudo tail -f /var/log/nginx/access.log    # 查看访问日志
sudo tail -f /var/log/nginx/error.log     # 查看错误日志
```

### 数据库管理

```bash
# 连接数据库
psql -U geo_user -d geo_system -h localhost

# 备份数据库
pg_dump -U geo_user geo_system > backup.sql

# 恢复数据库
psql -U geo_user geo_system < backup.sql
```

---

## 📚 文档导航

### 🚀 新手入门
- [快速开始](./docs/01-快速开始/) - 快速上手指南
- [测试账号说明](./docs/01-快速开始/测试账号说明.md)
- [如何访问个人中心](./docs/01-快速开始/如何访问个人中心.md)

### 📖 功能说明
- [功能说明](./docs/02-功能说明/) - 详细功能介绍
- [商品订单系统设计](./docs/02-功能说明/商品订单系统完整设计说明.md)
- [微信支付配置指南](./docs/02-功能说明/微信支付配置获取详细指南.md)

### 🚀 部署指南 ⭐ 重要
- [腾讯云快速部署指南](./docs/03-部署指南/腾讯云快速部署指南.md) ⭐ 推荐
- [腾讯云服务器镜像选择](./docs/03-部署指南/腾讯云服务器镜像选择指南.md)
- [部署方式对比](./docs/03-部署指南/部署方式对比指南.md)

### 🔒 安全指南 ⭐ 重要
- [代码保护完成报告](./docs/04-安全指南/代码保护完成报告.md) ⭐
- [强密钥配置说明](./docs/04-安全指南/强密钥配置说明.md) ⭐
- [速率限制配置说明](./docs/04-安全指南/速率限制配置说明.md) ⭐
- [云端部署源代码安全指南](./docs/04-安全指南/云端部署源代码安全指南.md)
- [安全最佳实践](./docs/04-安全指南/SECURITY_BEST_PRACTICES.md)

### 🧪 测试和诊断
- [测试指南](./docs/05-测试指南/) - 测试文档
- [系统诊断](./docs/05-测试指南/SYSTEM_DIAGNOSIS.md)
- [前端问题诊断](./docs/05-测试指南/前端问题诊断指南.md)

### 📝 完整文档
查看 [docs/README.md](./docs/README.md) 获取完整文档索引

---

## 🛠️ 技术栈

### 前端
- React 18 + TypeScript
- Ant Design 5
- Tailwind CSS
- React Router v6
- Vite

### 后端
- Node.js + Express
- TypeScript
- PostgreSQL
- Redis（可选）
- WebSocket

### AI 集成
- DeepSeek API
- Google Gemini API
- Ollama（本地模型）

---

## 🔧 开发命令

```bash
# 启动开发服务器（前端+后端）
npm run dev

# 仅启动前端
npm run client:dev

# 仅启动后端
npm run server:dev

# 构建生产版本
npm run build

# 数据库迁移
cd server && npm run db:migrate

# 运行测试
npm test
```

---

## 🔐 安全特性

- ✅ JWT 令牌认证（访问令牌 + 刷新令牌）
- ✅ 密码 bcrypt 哈希（10轮盐）
- ✅ 基于角色的访问控制（RBAC）
- ✅ 细粒度权限管理（20种权限）
- ✅ 登录限流保护（防暴力破解）
- ✅ 实时安全监控和审计日志
- ✅ 动态安全策略配置
- ✅ API 密钥加密存储

---

## 📈 系统状态

- **项目状态**: ✅ 生产就绪
- **安全等级**: 🟢 高
- **文档完整度**: 100%
- **代码保护**: ✅ 已完成

---

## 🎯 应用场景

- **品牌营销**: 提升品牌在 AI 平台的曝光率
- **SEO 优化**: 生成高质量 SEO 优化文章
- **内容创作**: 快速生成专业内容
- **批量生产**: 批量生成文章，提高效率
- **知识管理**: 系统化管理企业知识资产

---

## 🔮 未来规划

### 已完成 ✅
- [x] 本地 Ollama 模型支持
- [x] 文章生成任务系统
- [x] 企业图库和知识库
- [x] 用户认证和权限管理
- [x] 订阅套餐系统
- [x] 微信支付集成
- [x] 安全管理系统

### 计划中 📋
- [ ] 文章质量评分系统
- [ ] 数据分析面板
- [ ] 多语言支持
- [ ] 移动端应用
- [ ] 更多 AI 模型集成

---

## 📞 支持

如遇问题，请查看：
1. [测试指南](./docs/05-测试指南/) - 诊断和测试
2. [问题修复](./docs/06-问题修复/) - 已知问题解决方案
3. 运行诊断脚本：`./scripts/testing/部署前最终检查.sh`

---

## 📄 许可证

本项目采用 MIT 许可证

---

<div align="center">

**Made with ❤️ by GEO Team**

[文档](./docs/) · [部署指南](./docs/03-部署指南/) · [安全指南](./docs/04-安全指南/)

</div>
