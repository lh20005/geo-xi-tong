# Network Error 修复总结

## 问题描述

桌面客户端在运行时出现大量 Network Error 和 CORS 错误，导致多个页面白屏。

## 根本原因

### 1. API 基础 URL 配置错误 ✅ **已修复**

**问题**: `.env` 文件中的 `VITE_API_BASE_URL` 指向远程服务器 `http://43.143.163.6`，而不是本地服务器。

**影响**: 所有 API 请求都发送到远程服务器，导致：
- CORS 错误（跨域请求被阻止）
- 500 Internal Server Error
- ERR_EMPTY_RESPONSE

**修复**:
```bash
# windows-login-manager/.env
VITE_API_BASE_URL=http://localhost:3000  # 改为本地服务器
VITE_WS_BASE_URL=ws://localhost:3000     # 改为本地 WebSocket
```

### 2. CORS 配置缺少 Electron 端口 ✅ **已修复**

**问题**: 后端 CORS 配置只允许 `http://localhost:5173`，但 Electron 的 Vite 开发服务器运行在 `http://localhost:5174`。

**错误信息**:
```
Access to XMLHttpRequest at 'http://localhost:3000/api/...' from origin 'http://localhost:5174' 
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present
```

**修复**: 在后端 CORS 配置中添加 `http://localhost:5174`

**文件**: `server/src/index.ts`

```typescript
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',  // ✅ 新增：Electron Vite dev server
  'http://localhost:8080',
  // ...
];
```

### 3. Content Security Policy (CSP) 过于严格 ✅ **已修复**

**问题**: CSP 配置阻止了对 `http://localhost:3000` 的连接。

**修复**: 在开发环境中完全禁用 CSP，避免任何连接限制。

**文件**: `windows-login-manager/electron/security/csp.ts`

```typescript
public configure(): void {
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  
  if (isDev) {
    // 开发环境：完全禁用 CSP
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      const responseHeaders = { ...details.responseHeaders };
      delete responseHeaders['Content-Security-Policy'];
      delete responseHeaders['content-security-policy'];
      callback({ responseHeaders });
    });
  } else {
    // 生产环境：启用严格的 CSP
    // ...
  }
}
```

### 3. 部分页面使用原始 axios ⚠️ **待修复**

**问题**: 一些页面直接导入 `axios` 而不是使用 `apiClient`，导致：
- 缺少自动 token 注入
- 缺少统一错误处理
- 可能的 Network Error

**已修复的页面**:
- ✅ ArticleGenerationPage.tsx - 添加了空值检查
- ✅ DistillationPage.tsx - 替换为 apiClient
- ✅ GalleryPage.tsx - 替换为 apiClient

**仍需修复的页面**:
- ⚠️ PaymentPage.tsx
- ⚠️ UserCenterPage.tsx
- ⚠️ TopicsPage.tsx
- ⚠️ ArticlePage.tsx
- ⚠️ PermissionsPage.tsx
- ⚠️ ConversionTargetPage.tsx
- ⚠️ OrderManagementPage.tsx
- ⚠️ AlbumDetailPage.tsx
- ⚠️ DistillationHistoryEnhancedPage.tsx
- ⚠️ SecurityConfigPage.tsx
- ⚠️ SecurityDashboardPage.tsx
- ⚠️ ProductManagementPage.tsx
- ⚠️ AuditLogsPage.tsx

**修复模式**:
```typescript
// ❌ 错误：直接使用 axios
import axios from 'axios';
const response = await axios.get('/api/some-endpoint');

// ✅ 正确：使用 apiClient
import { apiClient } from '../api/client';
const response = await apiClient.get('/some-endpoint'); // 注意：不需要 /api 前缀
```

## 当前状态

### ✅ 正常工作
- 后端服务器运行在 `http://localhost:3000`
- 桌面客户端运行在 `http://localhost:5174`
- Dashboard 页面所有 API 调用正常（200 响应）
- CSP 在开发环境中已禁用
- API 请求指向正确的本地服务器

### ⚠️ 需要测试
请测试以下页面，确认是否还有白屏：

1. **内容管理**
   - 关键词蒸馏 (/distillation) - 已修复
   - 蒸馏结果 (/distillation-results)
   - 文章列表 (/articles)
   - 文章生成任务 (/article-generation)

2. **平台管理**
   - 平台管理 (/platform-management)
   - 发布任务 (/publishing-tasks)
   - 发布记录 (/publishing-records)

3. **其他**
   - 企业图库 (/gallery)
   - 用户中心 (/user-center)
   - 转化目标 (/conversion-targets)

## 测试步骤

1. 确保后端服务器运行：`npm run server:dev`
2. 启动桌面客户端：`cd windows-login-manager && npm run electron:dev`
3. 登录系统（用户名：lzc2005）
4. 逐个点击左侧菜单，测试每个页面
5. 打开开发者工具（Cmd+Option+I），查看 Console
6. 记录任何**红色错误**（忽略黄色警告）

## 非关键警告（可忽略）

以下警告不会导致白屏，可以忽略：

1. **Electron Security Warning** - 开发环境警告，打包后消失
2. **ECharts TypeError** - React Strict Mode 导致，不影响功能
3. **Ant Design Warnings** - deprecated 属性警告（如 `bordered`）
4. **React Router Warnings** - v7 升级提示

## 下一步

如果某个页面仍然白屏：

1. 打开开发者工具（Cmd+Option+I）
2. 点击白屏的页面
3. 查看 Console 中的**红色错误**
4. 提供错误信息，我会继续修复

## 服务器状态

- **后端服务器**: ProcessId 8, 运行在 http://localhost:3000
- **桌面客户端**: ProcessId 12, 运行在 http://localhost:5174
- **WebSocket**: ws://localhost:3000/ws

## 修复文件列表

1. `windows-login-manager/.env` - 修改 API URL 为 localhost
2. `server/src/index.ts` - 添加 http://localhost:5174 到 CORS 允许列表
3. `windows-login-manager/electron/security/csp.ts` - 禁用开发环境 CSP
4. `windows-login-manager/src/pages/DistillationPage.tsx` - 替换为 apiClient
5. `windows-login-manager/src/pages/GalleryPage.tsx` - 替换为 apiClient
6. `windows-login-manager/src/pages/ArticleGenerationPage.tsx` - 添加空值检查

---

**最后更新**: 2025-12-28 01:20
**状态**: CORS 问题已修复，后端服务器已重启，等待用户测试反馈
