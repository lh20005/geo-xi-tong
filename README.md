# GEO优化系统 🚀

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

## ✨ 核心功能

### 1️⃣ 多模型AI支持
- ✅ DeepSeek API集成（中文优化）
- ✅ Google Gemini API集成
- ✅ **本地Ollama支持（新增）** - 无需API密钥，数据本地化
- ✅ 灵活切换AI模型
- ✅ 统一的API管理界面
- ✅ 自动检测本地模型

### 2️⃣ 关键词蒸馏
- ✅ 智能分析关键词搜索意图
- ✅ 生成10-15个真实用户提问
- ✅ 基于真实搜索行为分析
- ✅ 支持各行业关键词

### 3️⃣ 话题管理
- ✅ 可视化话题列表
- ✅ 编辑和删除话题
- ✅ 选择话题用于文章生成
- ✅ 历史记录追踪

### 4️⃣ 文章生成
- ✅ AI驱动的内容创作
- ✅ 自定义文章生成要求
- ✅ 高质量SEO优化
- ✅ 知识库智能引用
- ✅ 一键复制和下载

### 5️⃣ 文章管理
- ✅ 文章列表和详情查看
- ✅ 文章编辑功能
- ✅ 按任务筛选
- ✅ 文章历史管理
- ✅ 批量管理功能

### 6️⃣ 文章生成任务 **（新增）**
- ✅ 批量文章生成
- ✅ 任务状态监控
- ✅ 智能选择蒸馏结果
- ✅ 任务诊断和重试
- ✅ 批量删除管理

### 7️⃣ 文章设置 **（新增）**
- ✅ 文章模板管理
- ✅ 字数和风格配置
- ✅ 自定义要求设置
- ✅ 模板复用

### 8️⃣ 转化目标 **（新增）**
- ✅ 转化目标管理
- ✅ 多种目标类型（电话、邮箱、网址、微信）
- ✅ 文章中自动嵌入
- ✅ 灵活配置

### 9️⃣ 企业图库
- ✅ 相册创建和管理
- ✅ 图片批量上传（支持JPEG、PNG、GIF、WebP）
- ✅ 图片预览和删除
- ✅ 相册编辑功能
- ✅ 文章自动配图

### 🔟 企业知识库
- ✅ 知识库分类管理
- ✅ 文档上传和解析（支持txt、md、pdf、doc、docx）
- ✅ 全文搜索功能
- ✅ AI文章生成时智能引用知识库
- ✅ 文档内容自动提取和存储

### 1️⃣1️⃣ 用户管理系统 **（新增）**
- ✅ 用户注册和登录
- ✅ 邀请码推荐系统
- ✅ 管理员用户管理界面
- ✅ 实时跨平台同步（WebSocket）
- ✅ 限流保护（防止暴力破解）
- ✅ 密码安全（bcrypt 哈希）
- ✅ JWT 令牌认证
- ✅ 会话管理和令牌失效

### 1️⃣2️⃣ 安全管理系统 **（新增）**
- ✅ **安全仪表板** - 实时安全指标监控
  - 失败登录次数统计
  - 被封禁IP数量
  - 可疑活动监控
  - 活跃异常检测
  - 安全建议和最佳实践
- ✅ **审计日志** - 完整的操作审计
  - 管理员操作记录
  - 按操作类型筛选
  - 按时间范围查询
  - 导出JSON/CSV格式
- ✅ **权限管理** - 细粒度权限控制
  - 20种预定义权限
  - 按类别分组（用户管理、配置管理、日志管理、安全管理）
  - 授予/撤销权限
  - 用户权限列表查看
- ✅ **安全配置管理** - 动态安全策略
  - 密码策略配置（长度、复杂度要求）
  - 登录限流配置（时间窗口、最大尝试次数）
  - 会话管理配置（超时时间、并发数）
  - 账户锁定策略
  - 配置版本历史
  - 配置导出/导入

### 1️⃣3️⃣ 订阅套餐系统 **（新增）**
- ✅ **套餐管理** - 灵活的订阅计划
  - 三种套餐：体验版、专业版、企业版
  - 功能配额管理（文章生成数、发布数、账号数、蒸馏数）
  - 价格和计费周期配置
  - 套餐启用/停用控制
  - 配置历史记录和回滚
- ✅ **订单管理** - 完整的订单处理流程
  - 订单创建和状态跟踪
  - 订单统计（今日/本月收入和订单数）
  - 订单筛选（按状态、日期范围）
  - 异常订单处理（手动完成、退款）
  - 待支付订单监控
- ✅ **用户订阅** - 个人中心订阅管理
  - 当前订阅信息查看
  - 使用量统计和配额监控
  - 订单历史记录
  - 套餐升级功能
  - 自动续费管理
- ✅ **支付集成** - 微信支付支持
  - 微信Native支付（扫码支付）
  - 支付回调处理
  - 订单状态同步
  - 支付安全验证

### 1️⃣4️⃣ 商品管理系统 **（新增）**
- ✅ **套餐配置管理** - 管理员专用
  - 可视化套餐列表
  - 价格和功能配额编辑
  - 价格变动二次确认（超过20%需确认）
  - 配置历史记录查看
  - 配置回滚功能
  - 套餐启用/停用控制
- ✅ **安全控制**
  - 管理员权限验证
  - 配置变更审计日志
  - IP地址和操作人记录
  - 配置变更通知

## 🛠️ 技术栈

### 前端
```
React 18          - 现代化UI框架
TypeScript        - 类型安全
Ant Design 5      - 企业级UI组件
Tailwind CSS      - 实用优先的CSS框架
React Router v6   - 路由管理
Axios             - HTTP客户端
Vite              - 极速构建工具
```

### 后端
```
Node.js           - JavaScript运行时
Express           - Web应用框架
TypeScript        - 类型安全
PostgreSQL        - 关系型数据库
pg                - PostgreSQL驱动
```

### AI集成
```
DeepSeek API      - 中文优化的AI模型
Gemini API        - Google的多模态AI
Ollama            - 本地AI模型运行（新增）
```

## 📦 系统依赖和环境要求

### 运行环境要求

#### 必需软件
- **Node.js**: 18.x 或更高版本
- **npm**: 9.x 或更高版本
- **PostgreSQL**: 12.x 或更高版本

#### 可选软件
- **Redis**: 6.x 或更高版本（用于缓存和会话管理，可选）
- **Ollama**: 最新版本（用于本地AI模型，可选）

### 系统资源要求

#### 最低配置
- CPU: 2核
- 内存: 4GB RAM
- 磁盘: 20GB 可用空间
- 网络: 稳定的互联网连接

#### 推荐配置
- CPU: 4核或更多
- 内存: 8GB RAM 或更多
- 磁盘: 50GB SSD
- 网络: 高速互联网连接

### 项目依赖清单

#### 根目录依赖 (`package.json`)
```json
{
  "devDependencies": {
    "concurrently": "^8.2.2"  // 并发运行多个命令
  }
}
```

#### 后端依赖 (`server/package.json`)

**生产依赖**
```json
{
  "dependencies": {
    // 核心框架
    "express": "^4.18.2",           // Web框架
    "cors": "^2.8.5",               // 跨域支持
    "dotenv": "^16.3.1",            // 环境变量管理
    
    // 数据库
    "pg": "^8.11.3",                // PostgreSQL客户端
    
    // 认证和安全
    "bcrypt": "^6.0.0",             // 密码哈希
    "jsonwebtoken": "^9.0.3",       // JWT令牌
    "helmet": "^8.1.0",             // 安全头部
    "validator": "^13.15.26",       // 数据验证
    "cookie-parser": "^1.4.7",      // Cookie解析
    
    // 支付
    "wechatpay-axios-plugin": "^0.9.5",  // 微信支付
    
    // 文件处理
    "multer": "^2.0.2",             // 文件上传
    "mammoth": "^1.6.0",            // Word文档解析
    "pdf-parse": "^1.1.1",          // PDF解析
    
    // 网络和爬虫
    "axios": "^1.6.2",              // HTTP客户端
    "puppeteer": "^24.33.0",        // 浏览器自动化
    
    // WebSocket
    "ws": "^8.18.3",                // WebSocket服务器
    
    // 缓存和队列
    "ioredis": "^5.8.2",            // Redis客户端
    "redis": "^5.10.0",             // Redis客户端（备选）
    
    // 定时任务
    "node-cron": "^4.2.1",          // 定时任务调度
    
    // 数据验证
    "zod": "^3.22.4",               // Schema验证
    "ajv": "^8.17.1",               // JSON Schema验证
    "ajv-formats": "^3.0.1",        // AJV格式扩展
    
    // 工具库
    "netmask": "^2.0.2"             // IP地址处理
  }
}
```

**开发依赖**
```json
{
  "devDependencies": {
    // TypeScript
    "typescript": "^5.3.3",
    "tsx": "^4.7.0",                // TypeScript执行器
    
    // 类型定义
    "@types/node": "^20.10.5",
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17",
    "@types/bcrypt": "^6.0.0",
    "@types/jsonwebtoken": "^9.0.10",
    "@types/multer": "^2.0.0",
    "@types/pg": "^8.10.9",
    "@types/ws": "^8.18.1",
    "@types/cookie-parser": "^1.4.10",
    "@types/pdf-parse": "^1.1.5",
    "@types/puppeteer": "^5.4.7",
    "@types/validator": "^13.15.10",
    "@types/netmask": "^2.0.6",
    "@types/ioredis": "^4.28.10",
    "@types/node-cron": "^3.0.11",
    
    // 测试
    "jest": "^30.2.0",
    "ts-jest": "^29.4.6",
    "@types/jest": "^30.0.0",
    "supertest": "^7.1.4",
    "@types/supertest": "^6.0.3",
    "fast-check": "^4.5.2"          // 属性测试
  }
}
```

#### 前端依赖 (`client/package.json`)

**生产依赖**
```json
{
  "dependencies": {
    // React核心
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.1",
    
    // UI组件库
    "antd": "^5.12.2",              // Ant Design
    "@ant-design/icons": "^5.2.6",  // 图标库
    
    // 状态管理
    "zustand": "^4.4.7",            // 轻量级状态管理
    
    // HTTP客户端
    "axios": "^1.6.2",
    
    // 工具库
    "dayjs": "^1.11.19",            // 日期处理
    "dompurify": "^3.3.1",          // XSS防护
    
    // 富文本编辑器
    "react-quill": "^2.0.0",
    
    // Markdown
    "react-markdown": "^10.1.0",
    "remark-gfm": "^4.0.1",         // GitHub风格Markdown
    
    // 图表
    "echarts": "^6.0.0",
    "echarts-for-react": "^3.0.5",
    
    // 布局
    "react-resizable": "^3.0.5"     // 可调整大小组件
  }
}
```

**开发依赖**
```json
{
  "devDependencies": {
    // TypeScript
    "typescript": "^5.3.3",
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "@types/dompurify": "^3.0.5",
    "@types/react-resizable": "^3.0.8",
    
    // 构建工具
    "vite": "^5.0.8",
    "@vitejs/plugin-react": "^4.2.1",
    
    // CSS
    "tailwindcss": "^3.3.6",
    "postcss": "^8.4.32",
    "autoprefixer": "^10.4.16"
  }
}
```

#### 营销网站依赖 (`landing/package.json`)

**生产依赖**
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.1",
    "axios": "^1.6.2"
  }
}
```

**开发依赖**
```json
{
  "devDependencies": {
    "typescript": "^5.3.3",
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "vite": "^5.0.8",
    "@vitejs/plugin-react": "^4.2.1",
    "tailwindcss": "^3.3.6",
    "postcss": "^8.4.32",
    "autoprefixer": "^10.4.16"
  }
}
```

### 数据库依赖

#### PostgreSQL扩展
```sql
-- 全文搜索（中文支持）
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- UUID支持
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

#### 数据库表结构
系统需要以下数据库表（通过迁移脚本自动创建）：

**核心表**
- `api_configs` - AI API配置
- `distillations` - 关键词蒸馏记录
- `topics` - 话题管理
- `articles` - 文章管理
- `article_generation_tasks` - 文章生成任务
- `article_settings` - 文章设置模板
- `conversion_targets` - 转化目标

**资源管理表**
- `albums` - 相册管理
- `images` - 图片管理
- `image_usage_tracking` - 图片使用追踪
- `knowledge_bases` - 知识库
- `knowledge_base_documents` - 知识库文档

**用户和权限表**
- `users` - 用户信息
- `invitations` - 邀请码
- `user_tokens` - 用户令牌
- `login_attempts` - 登录尝试记录
- `permissions` - 权限定义
- `user_permissions` - 用户权限关联

**订阅和支付表**
- `subscription_plans` - 订阅套餐
- `plan_features` - 套餐功能配额
- `user_subscriptions` - 用户订阅
- `orders` - 订单
- `usage_records` - 使用记录
- `product_config_history` - 商品配置历史

**安全和审计表**
- `audit_logs` - 审计日志
- `security_configs` - 安全配置
- `security_config_history` - 安全配置历史

**发布管理表**
- `platform_accounts` - 平台账号
- `publishing_tasks` - 发布任务
- `publishing_records` - 发布记录

### 系统端口占用

- **3000**: 后端API服务器
- **5173**: 前端开发服务器（Vite）
- **8080**: 营销网站开发服务器
- **5432**: PostgreSQL数据库（默认）
- **6379**: Redis缓存（可选）
- **11434**: Ollama本地AI服务（可选）

## 🚀 快速开始

### 方式一：双击启动（推荐 - macOS 用户）⚡

**最简单的启动方式！**

1. **首次使用**，在终端中运行：
   ```bash
   chmod +x start.command
   ```

2. **双击** `start.command` 文件

3. 系统会自动：
   - ✅ 检查环境配置
   - ✅ 启动前后端服务
   - ✅ 打开浏览器

4. 按 `Ctrl+C` 停止服务

**注意**：
- Windows 用户请使用方式二
- Linux 用户可以在终端运行 `./start.command`

### 方式二：手动启动

#### 前置要求

- Node.js 18+
- PostgreSQL 12+
- **以下三选一**：
  - DeepSeek API密钥
  - Gemini API密钥
  - 本地Ollama + DeepSeek模型（推荐用于隐私保护）

#### 1. 克隆项目

```bash
git clone <repository-url>
cd geo-optimization-system
```

#### 2. 安装依赖

```bash
npm run install:all
```

#### 3. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# 数据库配置
DATABASE_URL=postgresql://user:password@localhost:5432/geo_system

# JWT 密钥（生产环境请使用强密钥）
JWT_SECRET=your-secret-key-change-in-production
JWT_REFRESH_SECRET=your-refresh-secret-key-change-in-production

# 管理员账号
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123

# AI API配置（至少配置一个）
DEEPSEEK_API_KEY=your_deepseek_api_key
GEMINI_API_KEY=your_gemini_api_key

# Ollama配置（可选，用于本地AI模型）
OLLAMA_BASE_URL=http://localhost:11434

# 服务器配置
PORT=3000
NODE_ENV=development
```

#### 可选：使用本地Ollama

如果你想使用本地AI模型（无需API密钥，数据更安全）：

```bash
# 1. 安装Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# 2. 安装DeepSeek模型
ollama pull deepseek-r1:latest

# 3. 验证安装
ollama list

# 4. 修复数据库约束（重要！）
cd server
npm run db:fix:constraint
```

详细说明请查看 [Ollama集成指南](./docs/Ollama集成指南.md) 或 [快速启动](./QUICK_START_OLLAMA.md)

**⚠️ 重要提示：** 如果遇到"保存配置失败"错误，请运行：
```bash
cd server && npm run db:fix:constraint
```
详见 [修复指南](./FIX_OLLAMA_SAVE_ERROR.md)

#### 4. 创建数据库

```bash
createdb geo_system
```

#### 5. 运行数据库迁移

```bash
cd server
npm run db:migrate

# 如果需要用户管理功能，运行用户管理迁移
npm run migrate:user-management

cd ..
```

#### 6. 启动开发服务器

```bash
npm run dev
```

访问地址：
- 🌐 前端应用: http://localhost:5173
- 🌐 营销网站: http://localhost:8080
- 🔧 后端 API: http://localhost:3000

## 📁 项目结构

```
geo-optimization-system/
│
├── client/                    # 前端应用
│   ├── src/
│   │   ├── components/        # React组件
│   │   │   └── Layout/        # 布局组件
│   │   ├── pages/             # 页面组件
│   │   │   ├── Dashboard.tsx                  # 工作台
│   │   │   ├── ConfigPage.tsx                 # API配置
│   │   │   ├── DistillationPage.tsx           # 关键词蒸馏
│   │   │   ├── TopicsPage.tsx                 # 话题管理
│   │   │   ├── ArticlePage.tsx                # 文章生成
│   │   │   ├── ArticleListPage.tsx            # 文章列表
│   │   │   ├── GalleryPage.tsx                # 企业图库
│   │   │   ├── AlbumDetailPage.tsx            # 相册详情
│   │   │   ├── KnowledgeBasePage.tsx          # 企业知识库
│   │   │   ├── KnowledgeBaseDetailPage.tsx    # 知识库详情
│   │   │   ├── LoginPage.tsx                  # 登录页面
│   │   │   ├── ProductManagementPage.tsx      # 商品管理（管理员）
│   │   │   ├── OrderManagementPage.tsx        # 订单管理（管理员）
│   │   │   └── UserCenterPage.tsx             # 个人中心
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── package.json
│
├── landing/                   # 营销网站
│   ├── src/
│   │   ├── pages/             # 页面组件
│   │   │   ├── HomePage.tsx               # 首页
│   │   │   ├── LoginPage.tsx              # 登录页
│   │   │   ├── RegistrationPage.tsx       # 注册页
│   │   │   ├── ProfilePage.tsx            # 个人资料
│   │   │   └── UserManagementPage.tsx     # 用户管理（管理员）
│   │   ├── components/        # 组件
│   │   │   ├── UserDetailModal.tsx        # 用户详情弹窗
│   │   │   └── ChangePasswordModal.tsx    # 修改密码弹窗
│   │   └── api/               # API客户端
│   │       ├── auth.ts                    # 认证API
│   │       ├── admin.ts                   # 管理员API
│   │       └── invitations.ts             # 邀请API
│   └── package.json
│
├── server/                    # 后端应用
│   ├── src/
│   │   ├── routes/            # API路由
│   │   │   ├── config.ts              # API配置
│   │   │   ├── distillation.ts        # 关键词蒸馏
│   │   │   ├── topic.ts               # 话题管理
│   │   │   ├── article.ts             # 文章管理
│   │   │   ├── gallery.ts             # 企业图库
│   │   │   ├── knowledgeBase.ts       # 企业知识库
│   │   │   ├── auth.ts                # 认证路由
│   │   │   ├── users.ts               # 用户路由
│   │   │   ├── admin.ts               # 管理员路由
│   │   │   ├── invitations.ts         # 邀请路由
│   │   │   ├── subscription.ts        # 订阅路由
│   │   │   ├── payment.ts             # 支付路由
│   │   │   ├── orders.ts              # 订单路由
│   │   │   └── admin/                 # 管理员子路由
│   │   │       ├── products.ts        # 商品管理
│   │   │       └── orders.ts          # 订单管理
│   │   ├── services/          # 业务服务
│   │   │   ├── aiService.ts           # AI服务集成
│   │   │   ├── documentParser.ts      # 文档解析
│   │   │   ├── knowledgeBaseService.ts # 知识库服务
│   │   │   ├── AuthService.ts         # 认证服务
│   │   │   ├── UserService.ts         # 用户服务
│   │   │   ├── InvitationService.ts   # 邀请服务
│   │   │   ├── TokenService.ts        # 令牌服务
│   │   │   ├── RateLimitService.ts    # 限流服务
│   │   │   ├── WebSocketService.ts    # WebSocket服务
│   │   │   ├── SubscriptionService.ts # 订阅服务
│   │   │   ├── PaymentService.ts      # 支付服务
│   │   │   ├── OrderService.ts        # 订单服务
│   │   │   └── ProductService.ts      # 商品服务
│   │   ├── middleware/        # 中间件
│   │   │   ├── adminAuth.ts           # 管理员认证
│   │   │   ├── rateLimit.ts           # 限流中间件
│   │   │   └── sanitizeResponse.ts    # 响应清理
│   │   ├── db/                # 数据库
│   │   │   ├── database.ts
│   │   │   ├── schema.sql
│   │   │   └── migrate.ts
│   │   ├── docs/              # 后端文档
│   │   │   ├── USER_MANAGEMENT_API.md         # 用户管理API文档
│   │   │   ├── USER_MANAGEMENT_README.md      # 用户管理功能说明
│   │   │   ├── DATABASE_MIGRATION_GUIDE.md    # 数据库迁移指南
│   │   │   └── PASSWORD_SECURITY_AUDIT.md     # 密码安全审计
│   │   └── index.ts
│   └── package.json
│
├── docs/                      # 📚 正式文档（面向用户）
│   ├── 系统设计文档.md
│   ├── UI设计说明.md
│   ├── 快速开始.md
│   └── 项目总览.md
│
├── dev-docs/                  # 🔧 开发文档（开发过程记录）
│   ├── README.md              # 开发文档说明
│   ├── 功能实现总结/          # 各功能模块的实现总结
│   ├── 使用指南/              # 快速启动和使用指南
│   ├── 问题修复/              # Bug修复记录
│   └── 测试文档/              # 测试脚本和清单
│
├── scripts/                   # 🛠️ 工具脚本
│   ├── diagnose.sh            # 系统诊断脚本
│   └── check-database.sh      # 数据库检查脚本
│
├── .env.example               # 环境变量模板
├── .gitignore
├── package.json
├── start.command              # 一键启动脚本（macOS）
└── README.md
```

## 🎨 界面预览

### 工作台
- 渐变色统计卡片
- 快速开始引导
- 系统特点展示

### 关键词蒸馏
- 简洁的输入界面
- 实时蒸馏结果展示
- 历史记录管理

### 话题管理
- 可视化话题列表
- 便捷的编辑功能
- 批量选择操作

### 文章生成
- 自定义要求输入
- 实时生成进度
- 一键复制下载

## 📚 文档

### 📖 正式文档（docs/）
面向最终用户的正式文档：

- [� 系统设计文档]/(./docs/系统设计文档.md) - 完整的技术架构和设计
- [🎨 UI设计说明](./docs/UI设计说明.md) - 详细的UI设计规范
- [🚀 快速开始](./docs/快速开始.md) - 安装和使用指南
- [📋 项目总览](./docs/项目总览.md) - 项目概览和特性
- [☁️ 腾讯EdgeOne部署方案](./docs/腾讯EdgeOne部署方案.md) - EdgeOne云平台部署指南
- [📊 EdgeOne架构适配性评估](./docs/EdgeOne架构适配性评估.md) - 架构评估和优化建议
- [🚀 部署指南](./docs/部署指南.md) - 通用部署方案和最佳实践
- [📖 Ollama集成指南](./docs/Ollama集成指南.md) - 完整的使用指南

### 🔐 用户管理文档（server/docs/）
用户管理和安全功能文档：

- [📖 用户管理功能说明](./server/docs/USER_MANAGEMENT_README.md) - 完整的功能说明和使用指南
- [📡 用户管理API文档](./server/docs/USER_MANAGEMENT_API.md) - 详细的API接口文档
- [🗄️ 数据库迁移指南](./server/docs/DATABASE_MIGRATION_GUIDE.md) - 数据库迁移步骤
- [🔒 密码安全审计](./server/docs/PASSWORD_SECURITY_AUDIT.md) - 安全审计报告

### 🛡️ 安全管理文档
安全管理系统使用指南：

- [🔐 安全管理功能说明](./SECURITY_IMPLEMENTATION_COMPLETE.md) - 安全管理系统完整说明
- [🔍 安全配置指南](./SECURITY_CONFIG_GUIDE.md) - 安全配置详细指南
- [📊 安全最佳实践](./SECURITY_BEST_PRACTICES.md) - 安全使用建议
- [🚨 安全故障排除](./SECURITY_TROUBLESHOOTING.md) - 常见问题解决

### 💳 订阅和支付文档
订阅套餐和支付系统使用指南：

- [📦 订阅系统设计](./PRODUCT_SUBSCRIPTION_DESIGN.md) - 订阅系统架构和设计
- [🔒 商品配置安全](./PRODUCT_CONFIG_SECURITY.md) - 商品管理安全机制
- [🚀 订阅系统快速开始](./QUICK_START_SUBSCRIPTION.md) - 快速上手指南
- [✅ 订阅系统完成报告](./SUBSCRIPTION_SYSTEM_FINAL.md) - 功能完成情况

### 🔧 开发文档（dev-docs/）
开发过程中的记录和参考文档：

- [� 开发文档(说明](./dev-docs/README.md) - 开发文档索引和说明
- 功能实现总结 - 各模块的完整实现记录
- 快速启动指南 - 各功能的快速上手指南
- 问题修复记录 - Bug修复和解决方案
- 测试文档 - 测试脚本和验证清单

**注意**：开发文档主要用于开发团队内部参考，包含了开发过程中的详细记录、问题排查和测试文档。

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

# Ollama支持迁移（如果已有数据库）
cd server && npm run db:migrate:ollama
```

## 🌟 使用示例

### 1. 配置AI服务

**选项A：使用云端API**
```
1. 进入"API配置"页面
2. 选择AI模型（DeepSeek/Gemini）
3. 输入API Key
4. 保存配置
```

**选项B：使用本地Ollama（推荐）**
```
1. 确保Ollama已安装并运行
2. 进入"API配置"页面
3. 选择"本地Ollama"
4. 系统自动检测已安装的模型
5. 选择模型并测试连接
6. 保存配置
```

### 2. 关键词蒸馏
```
1. 进入"关键词蒸馏"页面
2. 输入关键词，如"英国留学"
3. 点击"开始蒸馏"
4. 查看生成的话题列表
```

### 3. 创建企业资源（推荐）

**企业图库**
```
1. 进入"企业图库"页面
2. 创建相册
3. 上传图片（支持批量，最多20张）
4. 管理和组织图片资源
```

**企业知识库**
```
1. 进入"企业知识库"页面
2. 创建知识库
3. 上传文档（txt、md、pdf、doc、docx）
4. 系统自动提取文本内容
5. 支持全文搜索
```

**文章设置**
```
1. 进入"文章设置"页面
2. 创建设置模板
3. 配置字数、风格、要求
4. 保存模板供后续使用
```

**转化目标（可选）**
```
1. 进入"转化目标"页面
2. 创建转化目标
3. 配置类型和内容（电话、邮箱、网址等）
4. 在文章中自动嵌入
```

### 4. 批量生成文章（推荐）
```
1. 进入"文章生成任务"页面
2. 点击"创建任务"
3. 选择蒸馏历史、图库、知识库、文章设置
4. 可选择转化目标
5. 设置文章数量（1-100）
6. 系统后台自动生成
7. 查看任务状态和生成的文章
```

### 5. 单篇生成文章
```
1. 在话题列表中选择话题
2. 点击"生成文章"
3. 选择要使用的知识库（可选）
4. 输入文章要求
5. AI基于知识库生成专业文章
6. 复制或下载文章
```

### 6. 订阅和支付
```
查看订阅信息：
1. 登录用户账号
2. 进入"个人中心"
3. 查看当前订阅套餐和到期时间
4. 查看使用量统计（文章生成、发布等）
5. 查看订单历史

升级套餐：
1. 在个人中心点击"升级套餐"
2. 选择目标套餐
3. 确认订单信息
4. 使用微信扫码支付
5. 支付成功后自动激活

管理订单（管理员）：
1. 登录管理员账号
2. 进入"订单管理"
3. 查看订单统计（今日/本月收入和订单数）
4. 筛选订单（按状态、日期）
5. 处理异常订单（手动完成、退款）

管理商品（管理员）：
1. 进入"商品管理"
2. 查看所有套餐配置
3. 编辑套餐价格和功能配额
4. 启用/停用套餐
5. 查看配置历史和回滚
```

### 7. 安全管理（管理员）
```
安全仪表板：
1. 登录管理员账号
2. 进入"安全管理" → "安全仪表板"
3. 查看实时安全指标
4. 监控失败登录、可疑活动等
5. 查看安全建议

审计日志：
1. 进入"安全管理" → "审计日志"
2. 按操作类型、时间范围筛选
3. 查看详细操作记录
4. 导出日志（JSON/CSV格式）

权限管理：
1. 进入"安全管理" → "权限管理"
2. 选择用户
3. 授予或撤销特定权限
4. 查看用户权限列表

安全配置：
1. 进入"安全管理" → "安全配置管理"
2. 调整密码策略（长度、复杂度）
3. 配置登录限流（时间窗口、最大尝试次数）
4. 设置会话超时时间
5. 查看配置历史版本
6. 导出/导入配置
```

## 🔐 安全特性

### 认证与授权
- ✅ JWT令牌认证（访问令牌 + 刷新令牌）
- ✅ 密码bcrypt哈希（10轮盐）
- ✅ 基于角色的访问控制（RBAC）
- ✅ 细粒度权限管理（20种预定义权限）
- ✅ 会话管理和令牌失效

### 限流保护
- ✅ **登录限流**：每个"IP+用户名"组合 5分钟内最多5次尝试
- ✅ **注册限流**：每个IP地址每小时最多3次注册
- ✅ **API限流**：每个IP地址每分钟最多100次请求
- ✅ **管理员操作限流**：每个管理员每分钟最多50次操作
- ✅ 滑动窗口算法实现

### 安全监控
- ✅ 实时安全指标监控（失败登录、可疑活动、异常检测）
- ✅ 完整的审计日志（所有管理员操作记录）
- ✅ 安全事件追踪和告警
- ✅ 自动安全检查（每日凌晨2点）

### 数据安全
- ✅ API密钥加密存储
- ✅ 环境变量管理敏感信息
- ✅ SQL注入防护
- ✅ XSS攻击防护
- ✅ CORS安全配置
- ✅ 响应数据清理（不暴露敏感信息）

### 密码安全
- ✅ 可配置的密码策略（最小长度、复杂度要求）
- ✅ 密码历史记录（防止重复使用）
- ✅ 账户锁定机制（多次失败后锁定）
- ✅ 临时密码支持（管理员重置）

## 📈 性能优化

- ✅ 数据库索引优化
- ✅ 前端代码分割
- ✅ API响应缓存
- ✅ 图片懒加载
- ✅ Gzip压缩

## 🎯 应用场景

- **品牌营销**: 提升品牌在AI平台的曝光率
- **SEO优化**: 生成高质量SEO优化文章
- **内容创作**: 快速生成专业内容，引用企业知识库
- **批量生产**: 通过任务系统批量生成文章，提高效率
- **市场研究**: 分析用户搜索意图
- **知识管理**: 系统化管理企业知识资产
- **资源管理**: 统一管理企业图片和文档资源
- **转化优化**: 在文章中自然嵌入转化目标

## 🔮 未来规划

### 已完成 ✅
- [x] 本地Ollama模型支持
- [x] 腾讯EdgeOne云部署方案
- [x] 架构适配性评估
- [x] 文章生成任务系统
- [x] 文章设置模板管理
- [x] 转化目标管理
- [x] 企业图库和知识库
- [x] 批量文章生成
- [x] 任务监控和诊断
- [x] 用户认证和权限管理
- [x] 邀请码推荐系统
- [x] 实时跨平台同步（WebSocket）
- [x] 限流保护和安全加固
- [x] 订阅套餐系统
- [x] 商品管理系统
- [x] 订单管理系统
- [x] 微信支付集成
- [x] 用户个人中心

### 进行中 🚧
- [ ] 完整文档系统
- [ ] 性能监控和优化
- [ ] 安全加固

### 计划中 📋
- [ ] 文章质量评分系统
- [ ] 任务优先级管理
- [ ] 数据分析面板
- [ ] 多语言支持
- [ ] 移动端应用
- [ ] 更多AI模型集成（Claude、LLaMA等）
- [ ] CI/CD自动化部署
- [ ] 微服务架构升级
- [ ] 邮箱验证和密码找回
- [ ] 双因素认证（2FA）
- [ ] 社交登录（OAuth）

## 🔧 故障排除

### 快速诊断

如果遇到问题，首先运行系统诊断脚本：

```bash
./scripts/diagnose.sh
```

该脚本会自动检查：
- Node.js 和 npm 安装状态
- PostgreSQL 数据库状态
- 端口占用情况
- 配置文件完整性
- 项目依赖安装状态
- 数据库连接和表结构

### 常见问题

#### 1. 数据库连接失败

**症状**：启动时提示数据库连接错误，API调用失败

**原因**：PostgreSQL 服务未运行

**解决方案**：
```bash
# macOS (Homebrew)
brew services start postgresql@14

# Linux (systemd)
sudo systemctl start postgresql

# 验证数据库状态
pg_isready -h localhost -p 5432
```

**说明**：`start.command` 脚本已集成自动检查和启动功能，会在启动时自动检测并尝试启动 PostgreSQL。

#### 2. 端口被占用

**症状**：启动失败，提示端口 3000 或 5173 被占用

**解决方案**：
```bash
# 查看占用进程
lsof -i :3000
lsof -i :5173

# 停止占用进程
kill -9 <PID>
```

#### 3. 依赖安装问题

**症状**：启动时提示模块未找到

**解决方案**：
```bash
# 重新安装所有依赖
npm run install:all

# 或清除缓存后重装
rm -rf node_modules server/node_modules client/node_modules
npm run install:all
```

#### 4. 数据库表不存在

**症状**：API调用返回表不存在错误

**解决方案**：
```bash
# 运行数据库迁移
cd server
npm run migrate
```

### 诊断工具

项目提供了两个诊断脚本：

1. **系统诊断** (`scripts/diagnose.sh`)
   - 全面检查系统状态
   - 识别常见问题
   - 提供修复建议

2. **数据库检查** (`scripts/check-database.sh`)
   - 详细检查数据库状态
   - 验证数据库连接
   - 列出数据库表结构

更多详情请查看 [scripts/README.md](scripts/README.md)

---

## ☁️ 腾讯云部署指南

### 部署前准备

#### 1. 服务器要求
- **操作系统**: Ubuntu 20.04 LTS 或 CentOS 8+
- **配置**: 至少2核4GB（推荐4核8GB）
- **磁盘**: 至少50GB SSD
- **网络**: 公网IP和域名

#### 2. 安装基础软件

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y  # Ubuntu
# 或
sudo yum update -y  # CentOS

# 安装Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs  # Ubuntu
# 或
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs  # CentOS

# 验证安装
node --version  # 应显示 v18.x.x
npm --version   # 应显示 9.x.x

# 安装PostgreSQL 14
sudo apt install -y postgresql postgresql-contrib  # Ubuntu
# 或
sudo yum install -y postgresql14-server postgresql14-contrib  # CentOS

# 启动PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# 安装Nginx（用于反向代理）
sudo apt install -y nginx  # Ubuntu
# 或
sudo yum install -y nginx  # CentOS

# 安装PM2（进程管理器）
sudo npm install -g pm2

# 安装Git
sudo apt install -y git  # Ubuntu
# 或
sudo yum install -y git  # CentOS
```

#### 3. 配置PostgreSQL

```bash
# 切换到postgres用户
sudo -u postgres psql

# 在PostgreSQL中执行
CREATE DATABASE geo_system;
CREATE USER geo_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE geo_system TO geo_user;
\q

# 配置PostgreSQL允许远程连接（如需要）
sudo nano /etc/postgresql/14/main/postgresql.conf
# 修改: listen_addresses = '*'

sudo nano /etc/postgresql/14/main/pg_hba.conf
# 添加: host all all 0.0.0.0/0 md5

# 重启PostgreSQL
sudo systemctl restart postgresql
```

### 部署步骤

#### 1. 克隆项目

```bash
# 创建项目目录
sudo mkdir -p /var/www
cd /var/www

# 克隆代码
sudo git clone <your-repository-url> geo-system
cd geo-system

# 设置权限
sudo chown -R $USER:$USER /var/www/geo-system
```

#### 2. 安装依赖

```bash
# 安装所有依赖
npm run install:all

# 如果遇到权限问题
sudo npm run install:all --unsafe-perm
```

#### 3. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑环境变量
nano .env
```

**生产环境配置示例**：
```env
# 数据库配置
DATABASE_URL=postgresql://geo_user:your_secure_password@localhost:5432/geo_system

# JWT密钥（使用强密钥）
JWT_SECRET=your-very-strong-secret-key-change-this-in-production
JWT_REFRESH_SECRET=your-very-strong-refresh-secret-key-change-this

# 管理员账号
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-strong-admin-password

# AI API配置
DEEPSEEK_API_KEY=your_deepseek_api_key
GEMINI_API_KEY=your_gemini_api_key

# 微信支付配置
WECHAT_PAY_MCHID=your_merchant_id
WECHAT_PAY_SERIAL_NO=your_certificate_serial_number
WECHAT_PAY_PRIVATE_KEY_PATH=/path/to/apiclient_key.pem
WECHAT_PAY_APIV3_KEY=your_apiv3_key

# 服务器配置
PORT=3000
NODE_ENV=production

# 域名配置
CLIENT_URL=https://your-domain.com
LANDING_URL=https://your-domain.com
```

#### 4. 运行数据库迁移

```bash
cd server
npm run db:migrate
cd ..
```

#### 5. 构建项目

```bash
# 构建前端
cd client
npm run build
cd ..

# 构建营销网站
cd landing
npm run build
cd ..

# 构建后端
cd server
npm run build
cd ..
```

#### 6. 配置Nginx

```bash
# 创建Nginx配置
sudo nano /etc/nginx/sites-available/geo-system
```

**Nginx配置示例**：
```nginx
# 后端API服务器
upstream api_backend {
    server 127.0.0.1:3000;
}

# 主站点配置
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # 强制HTTPS（生产环境推荐）
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    # SSL证书配置（使用腾讯云SSL证书）
    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # 安全头部
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # 客户端最大上传大小
    client_max_body_size 50M;

    # 营销网站（根路径）
    location / {
        root /var/www/geo-system/landing/dist;
        try_files $uri $uri/ /index.html;
        
        # 缓存静态资源
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # 客户端应用（/app路径）
    location /app {
        alias /var/www/geo-system/client/dist;
        try_files $uri $uri/ /app/index.html;
        
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # API代理
    location /api {
        proxy_pass http://api_backend;
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

    # WebSocket支持
    location /ws {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket超时
        proxy_read_timeout 86400;
    }

    # 上传文件路径
    location /uploads {
        alias /var/www/geo-system/server/uploads;
        
        location ~* \.(jpg|jpeg|png|gif|ico|svg|webp)$ {
            expires 30d;
            add_header Cache-Control "public, immutable";
        }
    }

    # 日志
    access_log /var/log/nginx/geo-system-access.log;
    error_log /var/log/nginx/geo-system-error.log;
}
```

```bash
# 启用站点
sudo ln -s /etc/nginx/sites-available/geo-system /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重启Nginx
sudo systemctl restart nginx
```

#### 7. 使用PM2启动应用

```bash
# 创建PM2配置文件
nano ecosystem.config.js
```

**PM2配置示例**：
```javascript
module.exports = {
  apps: [{
    name: 'geo-api',
    script: './server/dist/index.js',
    cwd: '/var/www/geo-system',
    instances: 2,  // 使用2个实例（根据CPU核心数调整）
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/api-error.log',
    out_file: './logs/api-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_memory_restart: '1G',
    watch: false
  }]
};
```

```bash
# 创建日志目录
mkdir -p logs

# 启动应用
pm2 start ecosystem.config.js

# 查看状态
pm2 status

# 查看日志
pm2 logs geo-api

# 设置开机自启
pm2 startup
pm2 save
```

#### 8. 配置防火墙

```bash
# Ubuntu (UFW)
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

# CentOS (firewalld)
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

#### 9. 配置SSL证书（推荐）

使用腾讯云SSL证书或Let's Encrypt：

```bash
# 使用Let's Encrypt（免费）
sudo apt install certbot python3-certbot-nginx  # Ubuntu
# 或
sudo yum install certbot python3-certbot-nginx  # CentOS

# 获取证书
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# 自动续期
sudo certbot renew --dry-run
```

### 部署后检查

```bash
# 1. 检查服务状态
pm2 status
sudo systemctl status nginx
sudo systemctl status postgresql

# 2. 检查端口监听
sudo netstat -tlnp | grep -E ':(80|443|3000|5432)'

# 3. 检查日志
pm2 logs geo-api --lines 50
sudo tail -f /var/log/nginx/geo-system-error.log

# 4. 测试API
curl http://localhost:3000/api/health

# 5. 测试前端
curl -I https://your-domain.com
```

### 常用运维命令

```bash
# PM2管理
pm2 restart geo-api      # 重启应用
pm2 stop geo-api         # 停止应用
pm2 delete geo-api       # 删除应用
pm2 logs geo-api         # 查看日志
pm2 monit                # 监控面板

# Nginx管理
sudo systemctl restart nginx    # 重启Nginx
sudo systemctl reload nginx     # 重新加载配置
sudo nginx -t                   # 测试配置

# 数据库备份
pg_dump -U geo_user geo_system > backup_$(date +%Y%m%d).sql

# 数据库恢复
psql -U geo_user geo_system < backup_20240101.sql

# 更新代码
cd /var/www/geo-system
git pull
npm run install:all
npm run build
pm2 restart geo-api
```

### 监控和日志

```bash
# 安装监控工具
pm2 install pm2-logrotate  # 日志轮转

# 配置日志轮转
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30

# 查看系统资源
pm2 monit
htop
```

### 性能优化建议

1. **启用Gzip压缩**（Nginx配置）
2. **配置CDN**（腾讯云CDN）
3. **数据库索引优化**
4. **Redis缓存**（可选）
5. **定期备份数据库**
6. **监控系统资源**

### 安全加固

1. **定期更新系统和依赖**
2. **配置防火墙规则**
3. **使用强密码**
4. **启用HTTPS**
5. **定期审查日志**
6. **限制SSH访问**
7. **配置fail2ban**（防止暴力破解）

更多详细信息请参考：
- [腾讯EdgeOne部署方案](./docs/腾讯EdgeOne部署方案.md)
- [部署指南](./docs/部署指南.md)

---

## 🤝 贡献

欢迎贡献代码、报告问题或提出建议！

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 💬 联系方式

- 📧 Email: your-email@example.com
- 🐛 Issues: [GitHub Issues](https://github.com/your-repo/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/your-repo/discussions)

## 🙏 致谢

感谢以下开源项目：
- [React](https://reactjs.org/)
- [Ant Design](https://ant.design/)
- [Express](https://expressjs.com/)
- [PostgreSQL](https://www.postgresql.org/)

---

<div align="center">

**GEO优化系统** - 让您的品牌在AI时代脱颖而出 🚀

Made with ❤️ by Your Team

</div>
