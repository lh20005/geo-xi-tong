# GEO优化系统 - 客户端应用

专业的品牌AI推荐优化工具的主应用界面。

## 端口配置

- **开发环境**: `http://localhost:5173`
- **后端API**: `http://localhost:3000`
- **营销网站**: `http://localhost:8080`

## 快速开始

### 1. 安装依赖

```bash
cd client
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

访问 `http://localhost:5173` 查看应用

### 3. 构建生产版本

```bash
npm run build
```

构建产物在 `dist/` 目录

## 功能特点

### 核心功能模块

1. **工作台** (`/dashboard`)
   - 系统概览和统计
   - 快速开始引导
   - 最近活动

2. **API配置** (`/config`)
   - AI模型选择（DeepSeek/Gemini/Ollama）
   - API密钥管理
   - 连接测试

3. **关键词蒸馏** (`/distillation`)
   - 关键词输入和分析
   - 话题生成
   - 历史记录

4. **话题管理** (`/topics`)
   - 话题列表和搜索
   - 话题编辑和删除
   - 批量操作

5. **文章生成** (`/article`)
   - 单篇文章生成
   - 知识库引用
   - 自定义要求

6. **文章列表** (`/articles`)
   - 文章浏览和搜索
   - 文章编辑
   - 批量管理

7. **文章生成任务** (`/article-tasks`)
   - 批量任务创建
   - 任务状态监控
   - 任务诊断

8. **企业图库** (`/gallery`)
   - 相册管理
   - 图片上传和预览
   - 图片选择

9. **企业知识库** (`/knowledge-base`)
   - 知识库管理
   - 文档上传和解析
   - 全文搜索

10. **文章设置** (`/article-settings`)
    - 模板管理
    - 字数和风格配置
    - 自定义要求

11. **转化目标** (`/conversion-goals`)
    - 目标管理
    - 多种类型支持
    - 文章嵌入

### 用户认证

- ✅ JWT令牌认证
- ✅ 自动令牌刷新
- ✅ 登录状态持久化
- ✅ 受保护路由
- ✅ WebSocket实时同步

### WebSocket集成 **（新增）**

系统集成了 WebSocket 实时同步功能，用于跨平台数据同步：

#### 功能特性
- **实时用户更新**：用户信息修改时立即同步
- **强制登出**：用户被删除时立即退出登录
- **密码变更通知**：密码修改后旧令牌失效，需重新登录
- **自动重连**：网络中断后自动重连

#### 实现位置
- `client/src/services/UserWebSocketService.ts` - WebSocket客户端服务
- `client/src/App.tsx` - WebSocket集成和事件处理

#### 事件类型
1. **user:updated** - 用户信息更新
   - 更新本地用户数据
   - 刷新UI显示

2. **user:deleted** - 用户被删除
   - 立即清除本地数据
   - 强制退出登录
   - 跳转到登录页

3. **user:password-changed** - 密码被修改
   - 使当前令牌失效
   - 显示通知
   - 跳转到登录页

## 技术栈

- **React 18** - 现代化UI框架
- **TypeScript** - 类型安全
- **Ant Design 5** - 企业级UI组件
- **Tailwind CSS** - 实用优先的CSS框架
- **React Router v6** - 路由管理
- **Axios** - HTTP客户端
- **Vite** - 极速构建工具
- **WebSocket (ws)** - 实时通信

## 项目结构

```
client/
├── src/
│   ├── components/          # 可复用组件
│   │   └── Layout/          # 布局组件
│   ├── pages/               # 页面组件
│   │   ├── Dashboard.tsx
│   │   ├── ConfigPage.tsx
│   │   ├── DistillationPage.tsx
│   │   ├── TopicsPage.tsx
│   │   ├── ArticlePage.tsx
│   │   ├── ArticleListPage.tsx
│   │   ├── GalleryPage.tsx
│   │   ├── KnowledgeBasePage.tsx
│   │   └── LoginPage.tsx
│   ├── services/            # 业务服务
│   │   ├── api.ts           # API客户端
│   │   └── UserWebSocketService.ts  # WebSocket服务
│   ├── config/              # 配置文件
│   │   └── env.ts           # 环境配置
│   ├── App.tsx              # 主应用组件
│   └── main.tsx             # 应用入口
├── public/                  # 静态资源
├── index.html               # HTML模板
├── vite.config.ts           # Vite配置
└── package.json
```

## 环境配置

创建 `.env` 文件：

```env
VITE_API_BASE_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000/ws
```

## 开发命令

```bash
# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview

# 类型检查
npm run type-check

# 代码格式化
npm run format
```

## 认证流程

```
用户从营销网站登录 (8080)
  ↓
获取JWT token
  ↓
跳转到客户端应用 (5173)
  ↓
客户端验证token
  ↓
加载用户数据
  ↓
建立WebSocket连接
  ↓
开始使用应用
```

## WebSocket连接流程

```
用户登录成功
  ↓
获取JWT token
  ↓
建立WebSocket连接（携带token）
  ↓
服务器验证token
  ↓
订阅用户事件
  ↓
接收实时更新
```

## 安全特性

- ✅ JWT令牌认证
- ✅ 自动令牌刷新
- ✅ 受保护路由
- ✅ XSS防护
- ✅ CSRF防护
- ✅ WebSocket认证
- ✅ 敏感数据加密存储

## 性能优化

- ✅ 代码分割
- ✅ 懒加载路由
- ✅ 图片懒加载
- ✅ API响应缓存
- ✅ 防抖和节流
- ✅ WebSocket自动重连

## 测试

```bash
# 运行测试
npm run test

# 测试覆盖率
npm run test:coverage
```

测试文档：
- [UI测试指南](./UI_TEST_GUIDE.md)
- [测试设置](./TEST_SETUP.md)

## 故障排除

### 1. WebSocket连接失败

**症状**：实时同步不工作

**解决方案**：
- 检查后端WebSocket服务是否运行
- 验证JWT令牌是否有效
- 检查浏览器控制台错误信息
- 确认WebSocket URL配置正确

### 2. 令牌过期

**症状**：API请求返回401错误

**解决方案**：
- 系统会自动尝试刷新令牌
- 如果刷新失败，会跳转到登录页
- 重新登录即可

### 3. 页面加载缓慢

**症状**：首次加载时间长

**解决方案**：
- 检查网络连接
- 清除浏览器缓存
- 使用生产构建版本

## 浏览器支持

- Chrome (最新版)
- Firefox (最新版)
- Safari (最新版)
- Edge (最新版)

## 相关文档

- [主README](../README.md) - 项目总览
- [用户管理功能说明](../server/docs/USER_MANAGEMENT_README.md) - 用户管理详细说明
- [用户管理API文档](../server/docs/USER_MANAGEMENT_API.md) - API接口文档

## 联系方式

如需技术支持，请联系：
- 📧 Email: support@example.com
- 🐛 Issues: [GitHub Issues](https://github.com/your-repo/issues)
