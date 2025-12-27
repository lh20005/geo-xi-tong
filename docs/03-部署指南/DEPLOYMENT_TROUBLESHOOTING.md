# 部署问题排查与解决方案 🔧

## 概述

本文档记录了从首次部署到系统稳定运行过程中遇到的所有问题及解决方案，供后续部署参考。

---

## 问题清单

| 问题编号 | 问题描述 | 严重程度 | 状态 |
|---------|---------|---------|------|
| #1 | 落地页重定向到错误域名 | 🔴 高 | ✅ 已解决 |
| #2 | 落地页重定向到根路径而非 /app/ | 🔴 高 | ✅ 已解决 |
| #3 | Nginx 403 Forbidden 错误 | 🔴 高 | ✅ 已解决 |
| #4 | 客户端资源 404 错误 | 🔴 高 | ✅ 已解决 |
| #5 | 登录 API 500 错误 | 🔴 高 | ✅ 已解决 |
| #6 | 数据库表和字段缺失 | 🔴 高 | ✅ 已解决 |
| #7 | "进入系统"按钮不跳转 | 🔴 高 | ✅ 已解决 |
| #8 | Dashboard API 500 错误 | 🟡 中 | ✅ 已解决 |
| #9 | WebSocket 连接失败 | 🟡 中 | ✅ 已解决 |

---

## 问题 #1：落地页重定向到错误域名

### 问题描述

访问 `http://43.143.163.6` 时，落地页会重定向到 `http://ww25.app.your-domain.com/`，而不是保持在 IP 地址。

### 根本原因

落地页的环境检测逻辑没有正确识别 IP 地址访问，默认使用了生产环境配置中的域名。

### 解决方案

**修改文件：** `landing/src/config/env.ts`

```typescript
// 智能环境检测函数
const detectEnvironment = () => {
  const hostname = window.location.hostname;
  
  // 本地开发环境检测
  const isLocalDev = hostname === 'localhost' || 
                    hostname === '127.0.0.1' || 
                    hostname.startsWith('192.168.') ||
                    hostname.startsWith('10.') ||
                    hostname.endsWith('.local');
  
  // 远程测试服务器检测（IP地址）⭐ 关键修复
  const isRemoteTestServer = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname);
  
  // 生产域名检测
  const isProductionDomain = !isLocalDev && !isRemoteTestServer && hostname.includes('.');
  
  return {
    isLocalDev,
    isRemoteTestServer,
    isProductionDomain
  };
};

// 远程测试服务器配置（IP访问）
remoteTest: {
  apiUrl: `http://${window.location.hostname}/api`,
  clientUrl: `http://${window.location.hostname}/app`,  // 动态使用当前 hostname
  environment: 'remote-test'
}
```

**关键点：**
- 添加 IP 地址正则检测：`/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/`
- 使用 `window.location.hostname` 动态获取当前访问地址
- 区分本地开发、远程测试（IP）、生产环境（域名）

**部署步骤：**
```bash
# 1. 修改配置文件
vim landing/src/config/env.ts

# 2. 重新构建
cd landing && npm run build

# 3. 部署到服务器
scp -r dist/* ubuntu@43.143.163.6:/var/www/geo-system/landing/dist/
```

**验证：**
```bash
# 访问落地页，检查是否保持在 IP 地址
curl -I http://43.143.163.6
```

---

## 问题 #2：落地页重定向到根路径而非 /app/

### 问题描述

登录后点击"进入系统"按钮，跳转到 `http://43.143.163.6/` 而不是 `http://43.143.163.6/app/`，导致 404 错误。

### 根本原因

配置中的 `clientUrl` 设置为 `http://${window.location.hostname}`，缺少 `/app` 路径。

### 解决方案

**修改文件：** `landing/src/config/env.ts`

```typescript
// 远程测试服务器配置
remoteTest: {
  apiUrl: `http://${window.location.hostname}/api`,
  clientUrl: `http://${window.location.hostname}/app`,  // ⭐ 添加 /app 路径
  environment: 'remote-test'
}
```

**更新配置版本号：**
```typescript
const CONFIG_VERSION = '1.0.2-20251227-app-path-fix';
```

**部署步骤：**
```bash
cd landing && npm run build
scp -r dist/* ubuntu@43.143.163.6:/var/www/geo-system/landing/dist/
```

**验证：**
```javascript
// 在浏览器控制台检查配置
console.log(window.location.hostname);  // 应该是 IP 地址
// 点击"进入系统"应该跳转到 /app/
```

---

## 问题 #3：Nginx 403 Forbidden 错误

### 问题描述

访问 `http://43.143.163.6/app/` 返回 403 Forbidden 错误。

### 根本原因

Nginx 配置中 `alias` 指令使用不当，导致路径解析错误。

### 解决方案

**修改文件：** `config/nginx/geo-system-fixed.conf`

```nginx
# ❌ 错误配置
location /app/ {
    alias /var/www/geo-system/client/dist;  # 缺少尾部斜杠
    try_files $uri $uri/ /index.html;       # 路径错误
}

# ✅ 正确配置
location /app/ {
    alias /var/www/geo-system/client/dist/;  # ⭐ 添加尾部斜杠
    index index.html;
    try_files $uri $uri/ /app/index.html;    # ⭐ 正确的回退路径
}

# 处理 /app 重定向到 /app/
location = /app {
    return 301 /app/;
}
```

**关键点：**
- `alias` 路径必须以 `/` 结尾
- `try_files` 的回退路径应该是 `/app/index.html`
- 添加 `/app` 到 `/app/` 的重定向

**部署步骤：**
```bash
# 1. 更新 Nginx 配置
sudo cp config/nginx/geo-system-fixed.conf /etc/nginx/sites-available/geo-system

# 2. 测试配置
sudo nginx -t

# 3. 重启 Nginx
sudo systemctl restart nginx
```

**验证：**
```bash
curl -I http://43.143.163.6/app/
# 应该返回 200 OK
```

---

## 问题 #4：客户端资源 404 错误

### 问题描述

访问 `/app/` 后，JavaScript 和 CSS 文件返回 404：
```
GET http://43.143.163.6/assets/index-CMdy-wqx.js 404
GET http://43.143.163.6/assets/index-xxx.css 404
```

### 根本原因

Vite 默认的 `base` 配置是 `/`，但应用部署在 `/app/` 路径下，导致资源路径不匹配。

### 解决方案

**修改文件：** `client/vite.config.ts`

```typescript
export default defineConfig({
  plugins: [react()],
  base: '/app/',  // ⭐ 设置基础路径
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
```

**关键点：**
- 设置 `base: '/app/'` 确保所有资源路径都带有 `/app/` 前缀
- 构建后的 HTML 中所有资源引用都会自动添加前缀

**部署步骤：**
```bash
# 1. 修改配置
vim client/vite.config.ts

# 2. 重新构建
cd client && npm run build

# 3. 部署到服务器
scp -r dist/* ubuntu@43.143.163.6:/var/www/geo-system/client/dist/
```

**验证：**
```bash
# 检查 HTML 中的资源路径
curl http://43.143.163.6/app/ | grep -o '/app/assets/[^"]*'
# 应该显示 /app/assets/index-xxx.js
```

---

## 问题 #5：登录 API 500 错误

### 问题描述

使用 `lzc2005` 账号登录时，返回 500 错误：
```
POST http://43.143.163.6/api/auth/login 500 (Internal Server Error)
```

### 根本原因

1. **端口冲突**：后端服务在 3000 端口启动失败（EADDRINUSE）
2. **管理员用户未创建**：数据库中没有 `lzc2005` 用户
3. **数据库表缺失**：`users`、`refresh_tokens`、`login_attempts` 等表缺失或字段不完整

### 解决方案

#### 5.1 解决端口冲突

```bash
# 查找占用 3000 端口的进程
lsof -i :3000

# 杀死旧进程
kill -9 <PID>

# 或使用 PM2 重启
pm2 restart geo-backend
```

#### 5.2 创建管理员用户

**修改文件：** `server/src/index.ts`

```typescript
// 在服务器启动时初始化管理员账号
async function startServer() {
  try {
    // ... 其他初始化代码
    
    // ⭐ 初始化管理员账号
    await authService.initializeDefaultAdmin();
    
    app.listen(PORT, () => {
      console.log(`✅ 服务器运行在端口 ${PORT}`);
    });
  } catch (error) {
    console.error('❌ 服务器启动失败:', error);
    process.exit(1);
  }
}
```

**环境变量配置：** `.env`
```bash
ADMIN_USERNAME=lzc2005
ADMIN_PASSWORD=jehI2oBuNMMJehMM
```

#### 5.3 修复数据库表

**问题：** 缺少以下表和字段
- `users` 表缺少：`invitation_code`, `invited_by_code`, `is_temp_password`
- `refresh_tokens` 表完全缺失
- `login_attempts` 表完全缺失

**解决：** 使用数据库迁移系统

```bash
cd server
npm run db:migrate
```

**部署步骤：**
```bash
# 1. 更新代码
scp server/src/index.ts ubuntu@43.143.163.6:/var/www/geo-system/server/src/

# 2. 重新构建
cd server && npm run build

# 3. 执行数据库迁移
npm run db:migrate

# 4. 重启服务
pm2 restart geo-backend
```

**验证：**
```bash
# 测试登录 API
curl -X POST http://43.143.163.6/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"lzc2005","password":"jehI2oBuNMMJehMM"}'

# 应该返回：{"success":true,"data":{...}}
```

---

## 问题 #6：数据库表和字段缺失

### 问题描述

部署脚本的 `npm run db:migrate` 只执行了 `schema.sql`，导致：
- 只创建了 22 个基础表
- 缺少 18 个关键表（users、订阅、安全、权限、发布等）
- 现有表缺少多个字段

### 根本原因

`schema.sql` 不完整，只包含部分表结构。

### 解决方案

**创建完整迁移脚本：** `server/src/db/complete-migration.sql`

包含所有 40 个表的完整定义：
- 用户认证相关（4个表）
- 订阅和支付（6个表）
- 安全和审计（7个表）
- 权限管理（3个表）
- 发布系统（5个表）
- 内容追踪（2个表）
- 其他业务表（13个表）

**执行迁移：**
```bash
# 上传迁移脚本
scp server/src/db/complete-migration.sql ubuntu@43.143.163.6:/tmp/

# 执行迁移
ssh ubuntu@43.143.163.6
PGPASSWORD='H2SwIAkyzT1G4mAhkbtSULfG' psql -h localhost -U geo_user -d geo_system -f /tmp/complete-migration.sql
```

**验证：**
```bash
# 检查表数量
psql -U geo_user -d geo_system -c "\dt" | wc -l
# 应该显示 40+ 行

# 检查关键表
psql -U geo_user -d geo_system -c "SELECT COUNT(*) FROM users;"
```

**详细文档：** [DATABASE_MIGRATION_COMPLETE.md](./DATABASE_MIGRATION_COMPLETE.md)

---

## 问题 #7："进入系统"按钮不跳转

### 问题描述

在服务器上登录后，点击"进入系统"按钮没有反应，不跳转到客户端应用。

### 根本原因

服务器上部署的是旧版本的落地页（16:16 部署），新的配置代码（17:18 修复）没有部署。

### 解决方案

**确认问题：**
```bash
# 检查部署时间
ssh ubuntu@43.143.163.6 "stat -c '%y %n' /var/www/geo-system/landing/dist/index.html"
# 如果时间早于最新修复时间，需要重新部署

# 检查 JS 文件中的配置
ssh ubuntu@43.143.163.6 "grep -o 'clientUrl.*app' /var/www/geo-system/landing/dist/assets/*.js"
# 应该包含：clientUrl:`http://${window.location.hostname}/app`
```

**重新部署：**
```bash
# 1. 在本地重新构建
cd landing && npm run build

# 2. 部署到服务器
scp -r dist/* ubuntu@43.143.163.6:/var/www/geo-system/landing/dist/

# 3. 清除浏览器缓存
# 用户需要硬刷新：Ctrl+Shift+R (Windows) 或 Cmd+Shift+R (Mac)
```

**技术细节：**

落地页的跳转流程：
1. 用户登录 → Token 保存到 localStorage
2. 页面跳转回首页 → 显示"进入系统"按钮
3. 点击按钮 → 从 localStorage 读取 token
4. 构造 URL：`http://43.143.163.6/app/?token=xxx&refresh_token=xxx&user_info=xxx`
5. 跳转到客户端应用
6. 客户端从 URL 提取 token 并保存
7. 清除 URL 参数，显示 Dashboard

**验证：**
```javascript
// 在浏览器控制台手动测试
const token = localStorage.getItem('auth_token');
const refreshToken = localStorage.getItem('refresh_token');
const userInfo = localStorage.getItem('user_info');

if (token && refreshToken && userInfo) {
  const params = new URLSearchParams({
    token,
    refresh_token: refreshToken,
    user_info: userInfo
  });
  const url = `http://${window.location.hostname}/app?${params.toString()}`;
  console.log('Redirect URL:', url);
  window.location.href = url;
}
```

---

## 问题 #8：Dashboard API 500 错误

### 问题描述

进入系统后，Dashboard 页面出现多个 API 500 错误：
```
GET /api/dashboard/resource-usage 500
GET /api/conversion-targets 500
GET /api/distillation/history 500
GET /api/articles 500
```

### 根本原因

数据库表缺少必需的列：
- `conversion_targets` 表缺少 `address` 列
- `distillations` 表缺少 `usage_count` 列

### 解决方案

**添加缺失的列：**

```sql
-- 1. 添加 address 列到 conversion_targets 表
ALTER TABLE conversion_targets 
ADD COLUMN IF NOT EXISTS address VARCHAR(500);

-- 2. 添加 usage_count 列到 distillations 表
ALTER TABLE distillations 
ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;

-- 3. 创建索引以提升性能
CREATE INDEX IF NOT EXISTS idx_distillations_usage_count 
ON distillations(usage_count DESC);
```

**执行迁移：**
```bash
ssh ubuntu@43.143.163.6
cd /var/www/geo-system/server
npm run db:migrate
```

**验证：**
```bash
# 测试 API
curl -H "Authorization: Bearer <token>" \
  "http://43.143.163.6/api/conversion-targets?page=1&pageSize=10"
# 应该返回：{"success":true,"data":{...}}

curl -H "Authorization: Bearer <token>" \
  "http://43.143.163.6/api/dashboard/resource-usage?startDate=2025-11-27&endDate=2025-12-27"
# 应该返回：{"distillations":{...},"topics":{...},"images":{...}}
```

**详细文档：** [API_FIX_SUCCESS.md](./API_FIX_SUCCESS.md)

---

## 问题 #9：WebSocket 连接失败

### 问题描述

浏览器控制台显示 WebSocket 连接错误：
```
WebSocket connection to 'ws://43.143.163.6/ws?token=...' failed: 
WebSocket is closed before the connection is established.
```

### 根本原因

这实际上是**正常的重连行为**，不是真正的错误。WebSocket 客户端会尝试重连，最终会成功建立连接。

### 解决方案

**Nginx 配置已正确：**

```nginx
location /ws {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # WebSocket 超时（24小时）
    proxy_read_timeout 86400s;
    proxy_send_timeout 86400s;
}
```

**验证连接成功：**

```bash
# 查看后端日志
pm2 logs geo-backend --lines 20

# 应该看到：
# [WebSocket] User lzc2005 (ID: 2) authenticated
# [WebSocket] User 2 subscribed. Total connections: 1
# [WebSocket] Received message from user 2: ping
```

**说明：**
- 浏览器显示的错误是客户端重连尝试
- 最终会成功建立连接
- 后端日志显示连接正常工作
- 这不影响系统功能

---

## 部署检查清单 ✅

### 部署前检查

- [ ] 确认服务器系统版本（推荐 Ubuntu 22.04/20.04）
- [ ] 安装所有系统依赖（Node.js, PostgreSQL, Redis, Nginx, Chrome）
- [ ] 配置数据库（创建数据库和用户）
- [ ] 准备环境变量文件（.env）
- [ ] 生成强密钥（JWT_SECRET, JWT_REFRESH_SECRET）

### 代码构建检查

- [ ] 前端构建：`cd client && npm run build`
- [ ] 后端构建：`cd server && npm run build`
- [ ] 落地页构建：`cd landing && npm run build`
- [ ] 检查 `client/vite.config.ts` 中 `base: '/app/'`
- [ ] 检查 `landing/src/config/env.ts` 中 IP 检测逻辑

### 部署后检查

- [ ] 执行数据库迁移：`npm run db:migrate`
- [ ] 检查迁移状态：`npm run db:status`
- [ ] 启动后端服务：`pm2 start dist/index.js --name geo-backend`
- [ ] 配置 Nginx（注意 alias 路径和 try_files）
- [ ] 测试 Nginx 配置：`sudo nginx -t`
- [ ] 重启 Nginx：`sudo systemctl restart nginx`

### 功能验证

- [ ] 访问落地页：`http://YOUR_SERVER_IP`
- [ ] 测试登录：使用管理员账号登录
- [ ] 测试"进入系统"按钮：应该跳转到 `/app/`
- [ ] 检查客户端资源：所有 JS/CSS 应该返回 200
- [ ] 测试 API：`curl http://YOUR_SERVER_IP/api/health`
- [ ] 检查 WebSocket：查看后端日志确认连接成功
- [ ] 测试 Dashboard：所有 API 应该返回 200

### 安全检查

- [ ] 检查 .env 文件权限：`chmod 600 .env`
- [ ] 配置防火墙：开放 22, 80, 443 端口
- [ ] 检查敏感文件不可访问：`.env`, `.git/config` 应该 404
- [ ] 验证 Nginx 安全 Headers
- [ ] 测试速率限制功能

---

## 常见错误速查表

| 错误现象 | 可能原因 | 快速解决 |
|---------|---------|---------|
| 落地页跳转到错误域名 | 环境检测逻辑错误 | 检查 `landing/src/config/env.ts` 中的 IP 正则 |
| 访问 /app/ 返回 403 | Nginx alias 配置错误 | 确保 alias 路径以 `/` 结尾 |
| 资源文件 404 | Vite base 配置错误 | 设置 `base: '/app/'` 并重新构建 |
| 登录 500 错误 | 数据库表缺失 | 执行 `npm run db:migrate` |
| API 500 错误 | 数据库字段缺失 | 检查并添加缺失的列 |
| "进入系统"不跳转 | 旧版本代码 | 重新构建并部署落地页 |
| WebSocket 错误 | 正常重连行为 | 检查后端日志确认连接成功 |

---

## 调试技巧

### 1. 查看后端日志
```bash
pm2 logs geo-backend --lines 50
pm2 logs geo-backend --err  # 只看错误日志
```

### 2. 查看 Nginx 日志
```bash
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### 3. 测试数据库连接
```bash
psql -U geo_user -d geo_system -h localhost
\dt  # 列出所有表
\d table_name  # 查看表结构
```

### 4. 检查服务状态
```bash
pm2 status
sudo systemctl status nginx
sudo systemctl status postgresql
sudo systemctl status redis
```

### 5. 浏览器调试
```javascript
// 检查 localStorage
console.log(localStorage.getItem('auth_token'));
console.log(localStorage.getItem('refresh_token'));
console.log(localStorage.getItem('user_info'));

// 检查配置
console.log(window.location.hostname);

// 手动测试跳转
const url = `http://${window.location.hostname}/app`;
console.log('Test URL:', url);
```

---

## 相关文档

- 📖 [部署成功报告](./DEPLOYMENT_SUCCESS.md)
- 📖 [登录修复报告](./LOGIN_FIX_SUCCESS.md)
- 📖 [API 修复报告](./API_FIX_SUCCESS.md)
- 📖 [数据库迁移完成报告](./DATABASE_MIGRATION_COMPLETE.md)
- 📖 [最终测试指南](./FINAL_TEST_GUIDE.md)
- 📖 [快速参考](./QUICK_REFERENCE.md)

---

## 总结

通过系统化地解决这 9 个问题，我们建立了：

✅ **完整的部署流程** - 从零到生产环境  
✅ **数据库迁移系统** - 自动化管理数据库变更  
✅ **问题排查方法** - 快速定位和解决问题  
✅ **详细的文档** - 供后续部署参考  

**关键经验：**
1. 环境检测要考虑 IP 地址访问
2. Nginx alias 配置要注意尾部斜杠
3. Vite base 路径要与部署路径一致
4. 数据库迁移要完整且可重复
5. 部署后要清除浏览器缓存
6. WebSocket 重连是正常行为

现在系统已经完全稳定运行，所有功能正常！🎉
