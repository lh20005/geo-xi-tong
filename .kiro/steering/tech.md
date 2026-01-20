# 技术栈与构建系统

## 语言与框架

### 前端 (client/)
- **React 18** + TypeScript
- **Vite** 构建工具
- **Ant Design 5** UI 组件库
- **Tailwind CSS** 样式框架
- **React Router v6** 路由
- **Zustand** 状态管理
- **ECharts** 数据可视化

### 后端 (server/)
- **Node.js** + Express
- **TypeScript**（编译为 CommonJS）
- **PostgreSQL** 主数据库
- **Redis** 缓存和会话
- **WebSocket (ws)** 实时同步

### 落地页 (landing/)
- React + TypeScript + Vite
- Tailwind CSS
- 运行端口：8080

### Windows 登录管理器 (windows-login-manager/)
- **Electron** 桌面应用
- React + TypeScript + Vite
- **Playwright** 浏览器自动化（本地发布执行）
- 功能：平台账号登录管理 + 本地发布执行

## 关键依赖

### 服务器端
- `wechatpay-axios-plugin` - 微信支付集成
- `jsonwebtoken` + `bcrypt` - 认证
- `zod` - Schema 验证
- `mammoth` + `pdf-parse` - 文档解析
- `helmet` + `express-rate-limit` - 安全防护

### Electron 端
- `playwright` - 浏览器自动化，用于本地发布执行

## 常用命令

```bash
# 开发
npm run dev              # 启动前端 + 后端
npm run dev:all          # 启动所有服务（前端、后端、落地页、Windows应用）
npm run client:dev       # 仅前端（端口 5173）
npm run server:dev       # 仅后端（端口 3000）
npm run landing:dev      # 落地页（端口 8080）

# 构建
npm run build            # 构建全部（前端、后端、落地页）
npm run client:build     # 构建前端
npm run server:build     # 构建后端（tsc）

# 数据库
cd server
npm run db:status        # 查看迁移状态
npm run db:migrate       # 执行待迁移
npm run db:rollback      # 回滚上次迁移
npm run db:create -- <名称>  # 创建新迁移

# 测试
cd server && npm test    # 运行 Jest 测试

# 工具
npm run install:all      # 安装所有依赖
npm run security:verify  # 验证安全配置
npm run status           # 检查服务状态
```

## TypeScript 配置

- **目标**：ES2020
- **严格模式**：已启用
- **前端**：ESNext 模块，bundler 解析
- **后端**：CommonJS 模块，node 解析

## 环境变量

通过各项目根目录的 `.env` 文件配置：

### 服务器 (server/.env)
- 数据库：`DATABASE_URL`
- AI API：`DEEPSEEK_API_KEY`、`GEMINI_API_KEY`、`OLLAMA_BASE_URL`
- 认证：`JWT_SECRET`、`JWT_REFRESH_SECRET`
- 支付：`WECHAT_PAY_*` 系列变量

### Electron 应用 (windows-login-manager/.env)
- 服务器地址：`VITE_API_URL`
- 浏览器配置：`BROWSER_HEADLESS`（是否无头模式）

## 端口分配

- 3000：后端 API
- 5173：前端（Vite 开发服务器）
- 5174：Windows 登录管理器（Vite 开发服务器）
- 8080：落地页

## 前端 API 配置规范（重要）

### 配置文件说明

前端 API URL 配置涉及两个文件，必须保持一致：

1. **`client/.env.production`** - 环境变量
   ```bash
   # 不要在 VITE_API_URL 后面加 /api，env.ts 会自动添加
   VITE_API_URL=https://www.jzgeo.cc
   VITE_WS_URL=wss://www.jzgeo.cc/ws
   VITE_LANDING_URL=https://www.jzgeo.cc
   ```

2. **`client/src/config/env.ts`** - 统一配置中心
   ```typescript
   // 自动在 VITE_API_URL 后面添加 /api
   apiUrl: import.meta.env.VITE_API_URL 
     ? `${import.meta.env.VITE_API_URL}/api`
     : (isProduction ? '/api' : 'http://localhost:3000/api'),
   ```

3. **`client/src/api/client.ts`** - API 客户端
   ```typescript
   // 必须使用 API_BASE_URL，不要直接使用 VITE_API_URL
   import { API_BASE_URL } from '../config/env';
   export const apiClient = axios.create({
     baseURL: API_BASE_URL,  // 正确：使用统一配置
     // baseURL: import.meta.env.VITE_API_URL,  // 错误：会缺少 /api
   });
   ```

### 常见错误

| 错误配置 | 结果 | 正确配置 |
|---------|------|---------|
| `VITE_API_URL=https://www.jzgeo.cc/api` | 请求变成 `/api/api/xxx` | `VITE_API_URL=https://www.jzgeo.cc` |
| `apiClient` 直接用 `VITE_API_URL` | 请求缺少 `/api` 前缀 | 使用 `API_BASE_URL` |

### 验证方法

构建后检查请求路径应该是：`https://www.jzgeo.cc/api/xxx`

## 部署规则（强制）

### 服务器目录结构

**重要：服务器上的目录结构与本地不同！**

| 本地路径 | 服务器路径 | 说明 |
|---------|-----------|------|
| `server/dist/` | `/var/www/geo-system/server/` | 后端代码 |
| `server/dist/services/` | `/var/www/geo-system/server/services/` | 服务层 |
| `server/dist/routes/` | `/var/www/geo-system/server/routes/` | 路由层 |
| `client/dist/` | `/var/www/geo-system/client/dist/` | 主前端应用 |
| `landing/dist/` | `/var/www/geo-system/landing/` | **落地页（注意：不是 landing/dist/）** |
| `landing/dist/assets/` | `/var/www/geo-system/landing/assets/` | 落地页静态资源 |

### 落地页部署步骤（重要）

**Nginx 的 root 指向 `/var/www/geo-system/landing/`（不是 `landing/dist/`），因此需要同步文件：**

1. **本地构建**：`npm run landing:build`
2. **上传并同步文件**：
   ```bash
   # 上传到 dist 目录
   scp -i "私钥路径" -r landing/dist/* ubuntu@124.221.247.107:/var/www/geo-system/landing/dist/
   
   # 同步到 Nginx root 目录（关键步骤！）
   ssh -i "私钥路径" ubuntu@124.221.247.107 "cp /var/www/geo-system/landing/dist/index.html /var/www/geo-system/landing/ && cp -r /var/www/geo-system/landing/dist/assets/* /var/www/geo-system/landing/assets/"
   ```

### 后端部署步骤

1. **本地编译**：`npm run server:build`
2. **上传文件**：将 `server/dist/` 下的文件上传到 `/var/www/geo-system/server/`
   ```bash
   # 示例：部署单个服务文件
   scp -i "私钥路径" server/dist/services/XXX.js ubuntu@124.221.247.107:/var/www/geo-system/server/services/
   
   # 示例：部署路由文件
   scp -i "私钥路径" server/dist/routes/XXX.js ubuntu@124.221.247.107:/var/www/geo-system/server/routes/
   ```
3. **重启服务**：`pm2 restart geo-server`

### 常见错误

- ❌ 错误：上传到 `/var/www/geo-system/server/dist/services/`
- ✅ 正确：上传到 `/var/www/geo-system/server/services/`

- ❌ 错误：落地页只上传到 `/var/www/geo-system/landing/dist/`
- ✅ 正确：落地页需要同步 `index.html` 和 `assets/` 到 `/var/www/geo-system/landing/`

### PM2 进程名称

- 服务器上的 PM2 进程名是 `geo-server`（不是 `geo-api`）
- 入口文件：`/var/www/geo-system/server/index.js`

### 部署验证

部署后必须验证：
1. `pm2 status` 确认服务在线
2. `curl http://localhost:3000/api/health` 确认健康检查通过

## Nginx 配置规范（重要）

### 服务器 Nginx 配置路径

- 配置文件：`/etc/nginx/sites-available/geo-system`
- 本地参考：`config/nginx/geo-system.conf`

### 关键路径映射

**注意：服务器上前端文件直接放在 `/var/www/geo-system/client/`，不是 `client/dist/`！**

| Nginx location | alias/root 路径 | 说明 |
|----------------|-----------------|------|
| `/` | `/var/www/geo-system/landing` | 落地页（营销页面） |
| `/app` | `/var/www/geo-system/client` | 主前端应用 |
| `/app/assets/` | `/var/www/geo-system/client/assets/` | 前端静态资源 |
| `/api` | `proxy_pass http://127.0.0.1:3000` | 后端 API |
| `/ws` | `proxy_pass http://127.0.0.1:3000` | WebSocket |
| `/uploads/` | `/var/www/geo-system/uploads/` | 上传文件 |

### 前端部署步骤（client）

```bash
# 1. 本地构建
npm run client:build

# 2. 上传静态资源到 /var/www/geo-system/client/assets/
scp -i "私钥路径" -r client/dist/assets/* ubuntu@124.221.247.107:/var/www/geo-system/client/assets/

# 3. 上传 index.html 到 /var/www/geo-system/client/
scp -i "私钥路径" client/dist/index.html ubuntu@124.221.247.107:/var/www/geo-system/client/
```

### 常见 Nginx 配置错误

| 错误 | 正确 |
|------|------|
| `alias /var/www/geo-system/client/dist;` | `alias /var/www/geo-system/client;` |
| `alias /var/www/geo-system/client/dist/assets/;` | `alias /var/www/geo-system/client/assets/;` |
| 上传到 `client/dist/` 目录 | 上传到 `client/` 目录（assets 和 index.html） |

### 当前服务器 Nginx 关键配置

```nginx
# 前端应用静态资源
location ^~ /app/assets/ {
    alias /var/www/geo-system/client/assets/;
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# 前端应用
location /app {
    alias /var/www/geo-system/client;
    index index.html;
    try_files $uri $uri/ /app/index.html;
}

# 落地页
location / {
    root /var/www/geo-system/landing;
    try_files $uri $uri/ /index.html;
}
```

### 修改 Nginx 配置后

```bash
# 测试配置
sudo nginx -t

# 重载配置
sudo systemctl reload nginx
```

## 部署后清理旧文件（强制）

每次部署前端或落地页后，删除旧的静态资源文件，只保留本次部署的文件。

### 清理方法

部署新文件后，根据 `index.html` 引用的文件名，删除 assets 目录中不再使用的旧文件：

```bash
# 前端：删除 /var/www/geo-system/client/assets/js/ 和 css/ 中的旧文件
# 落地页：删除 /var/www/geo-system/landing/assets/ 中的旧文件
```

保留当前 `index.html` 引用的文件，删除其他带 hash 的 js/css 文件即可。