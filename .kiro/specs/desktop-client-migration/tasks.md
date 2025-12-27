# 实施计划：桌面客户端迁移

## 概述

将 Web 前端（client/）完整迁移到 Windows 桌面客户端（windows-login-manager/），采用渐进式迁移策略，确保稳定性和可测试性。

## 迁移策略

**核心原则**：
1. 保留现有登录管理功能
2. 最大化代码复用
3. 增量迁移，每个阶段可测试
4. 先基础设施，后业务功能

## 任务列表

### 阶段 1: 基础设施准备

- [ ] 1. 安装和配置依赖包
  - 安装 Ant Design v5.12.2 及图标库
  - 安装 Zustand v4.4.7 状态管理
  - 安装 Tailwind CSS v3.3.6 及配置
  - 安装 ECharts v6.0.0 和 echarts-for-react
  - 安装 React Quill v2.0.0 富文本编辑器
  - 安装 react-markdown、remark-gfm、DOMPurify
  - 安装 qrcode.react、dayjs、react-resizable
  - 更新 package.json 和 tsconfig.json
  - _需求: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 2. 配置构建工具
  - 配置 Vite 支持 Electron 渲染进程
  - 配置 Tailwind CSS（复制 client/tailwind.config.js）
  - 配置 PostCSS（复制 client/postcss.config.js）
  - 更新 TypeScript 配置支持所有新依赖
  - 配置 electron-builder 打包选项
  - _需求: 3.5, 9.1, 9.2_

- [ ] 3. 检查点 - 基础设施完成
  - 确保所有依赖安装成功
  - 验证开发服务器可以启动
  - 确认 TypeScript 编译无错误
  - 如有问题请询问用户

### 阶段 2: 核心架构迁移

- [ ] 4. 复制源代码目录结构
  - 复制 client/src/api/ → windows-login-manager/src/api/
  - 复制 client/src/components/ → windows-login-manager/src/components/
  - 复制 client/src/services/ → windows-login-manager/src/services/
  - 复制 client/src/utils/ → windows-login-manager/src/utils/
  - 复制 client/src/types/ → windows-login-manager/src/types/
  - 复制 client/src/constants/ → windows-login-manager/src/constants/
  - 复制 client/src/config/ → windows-login-manager/src/config/
  - 复制 client/src/styles/ → windows-login-manager/src/styles/
  - _需求: 2.1, 2.2, 2.3_

- [ ] 5. 适配 API 层
  - 更新 API 基础配置（baseURL 等）
  - 适配 axios 拦截器（请求/响应）
  - 更新认证 token 处理逻辑
  - 实现 token 自动刷新机制
  - 添加错误处理和重试逻辑
  - _需求: 4.1, 4.2, 4.3, 4.5_

- [ ] 6. 集成 electron-store 存储
  - 创建存储管理器封装 electron-store
  - 实现 token 安全存储（加密）
  - 实现配置数据持久化
  - 实现窗口状态持久化
  - 迁移 localStorage 使用到 electron-store
  - _需求: 4.4_

- [ ] 7. 集成状态管理
  - 复制所有 Zustand stores（如果 client 有）
  - 创建 AppContext 用于全局状态
  - 实现用户状态管理
  - 实现配置状态管理
  - 与 electron-store 集成实现持久化
  - _需求: 4.1_

- [ ] 8. 检查点 - 核心架构完成
  - 验证 API 调用正常工作
  - 测试 token 存储和读取
  - 确认状态管理正常
  - 如有问题请询问用户

### 阶段 3: 布局和路由系统

- [ ] 9. 迁移布局组件
  - 复制 client/src/components/Layout/Sidebar.tsx
  - 复制 client/src/components/Layout/Header.tsx
  - 适配 Sidebar 导航菜单（添加登录管理入口）
  - 适配 Header 用户菜单和登出功能
  - 创建主 Layout 组件整合 Sidebar + Header
  - 更新样式文件（复制 client/src/index.css）
  - _需求: 2.2, 2.3, 2.5_

- [ ] 10. 设置路由系统
  - 安装 react-router-dom v6.20.1
  - 创建路由配置文件（定义所有路由）
  - 实现 ProtectedRoute 组件（需要登录）
  - 实现 AdminRoute 组件（需要管理员权限）
  - 配置路由懒加载（React.lazy + Suspense）
  - _需求: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 11. 更新 App.tsx
  - 集成 Router 和 Layout
  - 实现认证检查逻辑
  - 添加登录/登出处理
  - 配置所有页面路由
  - 添加 404 页面处理
  - _需求: 2.1, 2.4, 6.1_

- [ ] 12. 检查点 - 布局和路由完成
  - 验证布局正确渲染
  - 测试路由导航功能
  - 确认路由保护生效
  - 如有问题请询问用户

### 阶段 4: 页面迁移（第 1 批：核心页面）

- [ ] 13. 迁移仪表板和用户中心
  - 复制 client/src/pages/Dashboard.tsx
  - 复制 client/src/pages/UserCenterPage.tsx
  - 复制 client/src/pages/UserManualPage.tsx
  - 更新数据获取逻辑
  - 测试页面渲染和交互
  - _需求: 2.1, 2.4_

- [ ] 14. 迁移内容管理页面
  - 复制 client/src/pages/DistillationPage.tsx
  - 复制 client/src/pages/DistillationResultsPage.tsx
  - 复制 client/src/pages/TopicsPage.tsx
  - 复制 client/src/pages/ArticlePage.tsx
  - 复制 client/src/pages/ArticleListPage.tsx
  - 复制 client/src/pages/ArticleSettingsPage.tsx
  - 复制 client/src/pages/ArticleGenerationPage.tsx
  - 更新数据获取和状态管理
  - _需求: 2.1, 2.4_

- [ ] 15. 迁移图库和知识库页面
  - 复制 client/src/pages/GalleryPage.tsx
  - 复制 client/src/pages/AlbumDetailPage.tsx
  - 复制 client/src/pages/KnowledgeBasePage.tsx
  - 复制 client/src/pages/KnowledgeBaseDetailPage.tsx
  - 实现图片上传和显示
  - _需求: 2.1, 2.4_

- [ ] 16. 检查点 - 第 1 批页面完成
  - 测试所有已迁移页面
  - 验证数据加载正常
  - 确认页面交互正常
  - 如有问题请询问用户

### 阶段 5: 页面迁移（第 2 批：平台和发布）

- [ ] 17. 迁移平台管理页面
  - 复制 client/src/pages/PlatformManagementPage.tsx
  - 复制 client/src/pages/ConversionTargetPage.tsx
  - 与现有登录管理器功能集成
  - 添加平台账号管理功能
  - _需求: 2.1, 2.4_

- [ ] 18. 迁移发布管理页面
  - 复制 client/src/pages/PublishingTasksPage.tsx
  - 复制 client/src/pages/PublishingRecordsPage.tsx
  - 实现任务状态实时更新
  - 添加任务操作功能
  - _需求: 2.1, 2.4_

- [ ] 19. 检查点 - 第 2 批页面完成
  - 测试平台管理功能
  - 验证发布任务功能
  - 确认与登录管理器集成
  - 如有问题请询问用户

### 阶段 6: 页面迁移（第 3 批：管理员页面）

- [ ] 20. 迁移系统配置页面
  - 复制 client/src/pages/ConfigPage.tsx
  - 实现配置保存和加载
  - 添加桌面特定配置项
  - _需求: 2.1, 6.2, 6.3_

- [ ] 21. 迁移安全管理页面
  - 复制 client/src/pages/SecurityDashboardPage.tsx
  - 复制 client/src/pages/AuditLogsPage.tsx
  - 复制 client/src/pages/IPWhitelistPage.tsx
  - 复制 client/src/pages/PermissionsPage.tsx
  - 复制 client/src/pages/SecurityConfigPage.tsx
  - 实现管理员权限检查
  - _需求: 2.1, 6.2, 6.3_

- [ ] 22. 迁移产品和订单管理页面
  - 复制 client/src/pages/ProductManagementPage.tsx
  - 复制 client/src/pages/OrderManagementPage.tsx
  - 复制 client/src/pages/PaymentPage.tsx
  - 实现支付相关功能
  - _需求: 2.1, 6.2, 6.3_

- [ ] 23. 检查点 - 所有页面迁移完成
  - 验证所有 30+ 页面可访问
  - 测试管理员权限控制
  - 确认所有功能正常
  - 如有问题请询问用户

### 阶段 7: 特殊功能集成

- [ ] 24. 集成富文本编辑器
  - 配置 React Quill 编辑器
  - 复制编辑器配置和工具栏设置
  - 实现图片上传功能
  - 测试编辑器功能
  - _需求: 8.1, 8.4, 8.5_

- [ ] 25. 集成 Markdown 渲染
  - 配置 react-markdown 和 remark-gfm
  - 集成 DOMPurify 内容清理
  - 测试 Markdown 渲染
  - _需求: 8.2, 8.3_

- [ ] 26. 集成数据可视化
  - 配置 ECharts 和 echarts-for-react
  - 复制所有图表组件
  - 实现图表数据绑定
  - 测试图表交互和响应式
  - _需求: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 27. 集成 WebSocket 实时通信
  - 复制 client/src/services/UserWebSocketService.ts
  - 实现 WebSocket 连接管理
  - 添加事件处理器（user:updated, user:deleted, user:password-changed）
  - 实现实时通知显示
  - 测试 WebSocket 功能
  - _需求: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 28. 集成其他功能
  - 集成 qrcode.react 二维码生成
  - 集成 dayjs 日期处理
  - 集成 react-resizable 可调整大小组件
  - 测试所有集成功能
  - _需求: 2.4_

- [ ] 29. 检查点 - 特殊功能完成
  - 测试富文本编辑
  - 验证图表显示
  - 确认 WebSocket 实时更新
  - 如有问题请询问用户

### 阶段 8: 优化和完善

- [ ] 30. 性能优化
  - 实现路由懒加载（已在路由配置中）
  - 优化打包配置（tree-shaking、代码压缩）
  - 添加 API 响应缓存
  - 优化图片加载和显示
  - 测试应用性能指标
  - _需求: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ] 31. 错误处理和日志
  - 添加全局错误边界
  - 实现错误通知系统
  - 配置 electron-log 日志记录
  - 添加关键操作日志
  - _需求: 4.5_

- [ ] 32. 窗口管理完善
  - 实现窗口大小和位置持久化
  - 添加最小化、最大化、关闭处理
  - 支持多显示器
  - 测试窗口状态恢复
  - _需求: 4.4_

- [ ] 33. 检查点 - 优化完成
  - 验证性能指标达标
  - 测试错误处理
  - 确认窗口管理正常
  - 如有问题请询问用户

### 阶段 9: 构建和测试

- [ ] 34. 配置生产构建
  - 更新 electron-builder 配置
  - 配置 Windows 安装程序选项
  - 设置应用图标和元数据
  - 配置自动更新（electron-updater）
  - _需求: 9.1, 9.2, 9.3, 9.5_

- [ ] 35. 测试生产构建
  - 构建生产版本（npm run build）
  - 打包 Windows 安装程序（npm run build:win）
  - 安装并测试打包后的应用
  - 验证所有功能在生产环境正常
  - 测试应用大小和性能
  - _需求: 9.1, 9.2, 9.3, 9.4_

- [ ] 36. 全面测试
  - 测试所有页面和功能
  - 测试认证和权限控制
  - 测试 WebSocket 实时更新
  - 测试数据持久化
  - 测试错误处理
  - 测试性能指标
  - _需求: 所有需求_

- [ ] 37. 最终检查点
  - 确认所有功能正常
  - 验证性能达标
  - 确认打包成功
  - 准备发布

## 注意事项

1. **保留现有功能**: 不要删除或修改现有的登录管理器功能
2. **增量测试**: 每完成一个阶段都要测试，确保没有破坏现有功能
3. **代码复用**: 尽可能直接复制 Web 端代码，减少适配工作
4. **性能关注**: 注意打包大小和运行性能
5. **用户体验**: 确保界面和交互与 Web 端一致

## 预期时间

- 阶段 1-2: 2-3 天（基础设施和核心架构）
- 阶段 3-6: 5-7 天（布局、路由和页面迁移）
- 阶段 7-8: 3-4 天（特殊功能和优化）
- 阶段 9: 2-3 天（构建和测试）

**总计**: 约 12-17 天（根据实际情况可能调整）
