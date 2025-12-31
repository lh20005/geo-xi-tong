# Puppeteer → Playwright 迁移实施方案

## 📋 迁移概述

**目标**：将 GEO 系统从 Puppeteer 迁移到 Playwright，提升自动发布的稳定性和性能

**策略**：
1. 删除 Windows 登录管理器（降低转换难度）
2. 迁移后端自动发布系统到 Playwright
3. 更新所有相关代码和配置
4. 清理数据库和前端相关功能

---

## 🗂️ 需要修改的文件清单

### 1. 后端核心服务 (server/src)

#### 核心服务（必须修改）
- ✅ `services/BrowserAutomationService.ts` - 浏览器自动化核心
- ✅ `services/adapters/PlatformAdapter.ts` - 平台适配器基类
- ✅ `config/browserConfig.ts` - 浏览器配置

#### 平台适配器（12个）
- ✅ `services/adapters/ToutiaoAdapter.ts` - 头条号
- ✅ `services/adapters/WechatAdapter.ts` - 微信公众号
- ✅ `services/adapters/DouyinAdapter.ts` - 抖音
- ✅ `services/adapters/XiaohongshuAdapter.ts` - 小红书
- ✅ `services/adapters/ZhihuAdapter.ts` - 知乎
- ✅ `services/adapters/JianshuAdapter.ts` - 简书
- ✅ `services/adapters/SouhuAdapter.ts` - 搜狐号
- ✅ `services/adapters/QieAdapter.ts` - 企鹅号
- ✅ `services/adapters/BilibiliAdapter.ts` - 哔哩哔哩
- ✅ `services/adapters/CSDNAdapter.ts` - CSDN
- ✅ `services/adapters/BaijiahaoAdapter.ts` - 百家号
- ✅ `services/adapters/WangyiAdapter.ts` - 网易号

#### 执行器和服务
- ✅ `services/PublishingExecutor.ts` - 发布执行器
- ✅ `services/BatchExecutor.ts` - 批量执行器
- ✅ `services/AccountService.ts` - 账号服务
- ✅ `services/ImageUploadService.ts` - 图片上传服务

### 2. 配置文件

#### 依赖配置
- ✅ `server/package.json` - 替换 puppeteer → playwright

#### TypeScript 配置
- ✅ `server/tsconfig.json` - 更新类型定义（如需要）

### 3. 前端代码 (client/src)

#### 删除登录器相关页面
- ❌ 删除 Windows 登录管理器相关的前端代码
- ✅ 更新平台账号管理页面（移除登录器入口）

### 4. Windows 登录管理器

#### 完全删除
- ❌ `windows-login-manager/` - 整个目录删除

### 5. 数据库

#### 清理登录器相关数据
- ✅ 创建迁移脚本清理登录器相关配置

---

## 🔄 实施步骤

### 阶段 1：准备工作
1. ✅ 创建迁移文档
2. ✅ 备份现有代码
3. ✅ 安装 Playwright 依赖

### 阶段 2：核心服务迁移
1. ✅ 更新 BrowserAutomationService
2. ✅ 更新 PlatformAdapter 基类
3. ✅ 更新 browserConfig

### 阶段 3：平台适配器迁移
1. ✅ 逐个迁移 12 个平台适配器
2. ✅ 更新 Cookie 管理逻辑
3. ✅ 更新选择器和等待逻辑

### 阶段 4：执行器和服务迁移
1. ✅ 更新 PublishingExecutor
2. ✅ 更新 BatchExecutor
3. ✅ 更新 AccountService
4. ✅ 更新 ImageUploadService

### 阶段 5：删除登录管理器
1. ✅ 删除 windows-login-manager 目录
2. ✅ 更新前端代码（移除登录器入口）
3. ✅ 清理数据库相关数据

### 阶段 6：测试和验证
1. ✅ 单元测试
2. ✅ 集成测试
3. ✅ 端到端测试

---

## 📝 关键 API 映射

### Cookie 管理
```typescript
// Puppeteer
await page.setCookie(...cookies);
const cookies = await page.cookies();

// Playwright
await context.addCookies(cookies);
const cookies = await context.cookies();
```

### 页面操作
```typescript
// Puppeteer
await page.type(selector, text);
await page.click(selector);

// Playwright
await page.fill(selector, text);  // 或 page.type()
await page.click(selector);
```

### 等待和选择器
```typescript
// Puppeteer
await page.waitForSelector(selector);
await page.waitForXPath(xpath);

// Playwright
await page.waitForSelector(selector);
await page.locator(xpath).waitFor();
```

---

## ⚠️ 注意事项

1. **Cookie 管理变化**
   - Playwright 使用 BrowserContext 管理 Cookie
   - 需要在创建页面时传递 context

2. **页面生命周期**
   - Playwright 的页面管理更严格
   - 需要显式管理 context

3. **选择器策略**
   - Playwright 推荐使用 locator API
   - 更好的自动等待机制

4. **错误处理**
   - Playwright 的错误信息更详细
   - 需要更新错误处理逻辑

---

## 🎯 预期收益

1. **性能提升**
   - Playwright 通常比 Puppeteer 快 20-30%
   - 更好的并发处理能力

2. **稳定性提升**
   - 更好的自动等待机制
   - 更少的超时错误

3. **维护性提升**
   - 更现代的 API 设计
   - 更好的文档和社区支持

4. **功能增强**
   - 支持多浏览器（Chromium, Firefox, WebKit）
   - 更好的调试工具

---

## 📅 时间估算

- 阶段 1：准备工作 - 30分钟
- 阶段 2：核心服务迁移 - 1小时
- 阶段 3：平台适配器迁移 - 2小时
- 阶段 4：执行器和服务迁移 - 1小时
- 阶段 5：删除登录管理器 - 30分钟
- 阶段 6：测试和验证 - 1小时

**总计**：约 6 小时

---

## ✅ 完成标准

1. 所有 Puppeteer 依赖已移除
2. 所有平台适配器使用 Playwright
3. Windows 登录管理器已删除
4. 前端登录器入口已移除
5. 所有测试通过
6. 文档已更新

---

开始时间：2025-12-31
预计完成：2025-12-31
