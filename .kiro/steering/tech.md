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
- **Playwright** 浏览器自动化（用于发布）
- **WebSocket (ws)** 实时同步

### 落地页 (landing/)
- React + TypeScript + Vite
- Tailwind CSS
- 运行端口：8080

### Windows 登录管理器 (windows-login-manager/)
- **Electron** 桌面应用
- React + TypeScript + Vite
- 用于平台账号登录管理

## 关键依赖

- `playwright` - 浏览器自动化，用于多平台发布
- `wechatpay-axios-plugin` - 微信支付集成
- `jsonwebtoken` + `bcrypt` - 认证
- `zod` - Schema 验证
- `mammoth` + `pdf-parse` - 文档解析
- `helmet` + `express-rate-limit` - 安全防护

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
- 数据库：`DATABASE_URL`
- AI API：`DEEPSEEK_API_KEY`、`GEMINI_API_KEY`、`OLLAMA_BASE_URL`
- 认证：`JWT_SECRET`、`JWT_REFRESH_SECRET`
- 浏览器：`PUPPETEER_EXECUTABLE_PATH`、`BROWSER_HEADLESS`
- 支付：`WECHAT_PAY_*` 系列变量

## 端口分配

- 3000：后端 API
- 5173：前端（Vite 开发服务器）
- 5174：Windows 登录管理器（Vite 开发服务器）
- 8080：落地页
