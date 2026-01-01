# Puppeteer → Playwright 迁移方案（修订版）

## 📋 迁移范围说明

### ✅ 需要迁移的部分
**后端自动发布系统** - 从 Puppeteer 迁移到 Playwright
- 浏览器自动化服务
- 平台适配器（12个）
- 发布执行器
- 账号服务中的登录测试功能

### ✅ 保留不变的部分
**Windows 登录管理器** - 继续使用 Electron BrowserView
- `windows-login-manager/` 目录完整保留
- 使用 Electron 的 BrowserView API，不依赖 Puppeteer
- 用户通过 Windows 端登录平台账号，捕获 Cookie

**前端页面** - 完整保留
- `client/src/` 所有页面保留
- 平台账号管理页面保留
- 登录器入口保留

**数据库** - 无需修改
- 所有表结构保持不变
- Cookie 存储方式不变

---

## 🎯 迁移策略

### 核心思路
1. **Windows 端负责登录** → 捕获 Cookie → 保存到数据库
2. **后端负责发布** → 从数据库读取 Cookie → 使用 Playwright 自动发布

### 工作流程
```
用户 → Windows登录管理器(Electron) → 登录平台 → 捕获Cookie → 保存到数据库
                                                              ↓
                                                    后端读取Cookie
                                                              ↓
                                            Playwright使用Cookie自动发布
```

---

## 🗂️ 需要修改的文件清单

### 1. 后端核心服务 (server/src)

#### 核心服务（必须修改）
- ✅ `services/BrowserAutomationService.ts` - 浏览器自动化核心
  - 替换 `puppeteer` → `playwright`
  - 更新 Cookie 管理方式（`page.setCookie` → `context.addCookies`）
  - 更新页面 API 调用

- ✅ `services/adapters/PlatformAdapter.ts` - 平台适配器基类
  - 更新 `Page` 类型导入（从 `puppeteer` 改为 `playwright`）
  - 更新 `loginWithCookies` 方法（使用 Playwright 的 Cookie API）
  - 更新 `safeType`、`safeClick` 等辅助方法

- ✅ `config/browserConfig.ts` - 浏览器配置
  - 更新启动选项（Puppeteer → Playwright）

#### 平台适配器（12个，逐个迁移）
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

**修改内容**：
- 更新 `Page` 类型导入
- 更新 Puppeteer 特定的 API 调用
- Cookie 登录逻辑保持不变（只是 API 调用方式改变）

#### 执行器和服务
- ✅ `services/PublishingExecutor.ts` - 发布执行器
  - 更新浏览器启动和页面管理逻辑
  - Cookie 传递方式调整

- ✅ `services/BatchExecutor.ts` - 批量执行器
  - 更新浏览器强制关闭逻辑

- ✅ `services/AccountService.ts` - 账号服务
  - 更新账号登录测试逻辑（使用 Playwright）

- ✅ `services/ImageUploadService.ts` - 图片上传服务
  - 更新图片上传相关的 API

### 2. 配置文件

#### 依赖配置
- ✅ `server/package.json`
  - 移除 `puppeteer` 和 `@types/puppeteer`
  - 添加 `playwright`

#### TypeScript 配置
- ⚠️ `server/tsconfig.json` - 可能需要更新类型定义（视情况而定）

### 3. 前端代码 (client/src)
- ❌ **无需修改** - 完整保留所有页面和功能

### 4. Windows 登录管理器
- ❌ **无需修改** - 完整保留 `windows-login-manager/` 目录

### 5. 数据库
- ❌ **无需修改** - 表结构和数据保持不变

---

## 🔄 详细实施步骤

### 阶段 1：准备工作（10分钟）
1. ✅ 创建迁移文档
2. ✅ 备份现有代码（Git commit）
3. ✅ 更新 `server/package.json`
   - 移除 `puppeteer: ^24.33.0`
   - 移除 `@types/puppeteer: ^5.4.7`
   - 添加 `playwright: ^1.48.0`
4. ✅ 安装依赖：`cd server && npm install`

### 阶段 2：核心服务迁移（30分钟）

#### 2.1 更新 BrowserAutomationService.ts
```typescript
// 旧代码
import puppeteer, { Browser, Page } from 'puppeteer';
this.browser = await puppeteer.launch(launchOptions);
const page = await this.browser.newPage();

// 新代码
import { chromium, Browser, Page, BrowserContext } from 'playwright';
this.browser = await chromium.launch(launchOptions);
this.context = await this.browser.newContext();
const page = await this.context.newPage();
```

**关键变化**：
- 引入 `BrowserContext` 概念
- Cookie 管理移到 context 层面
- 页面创建需要通过 context

#### 2.2 更新 browserConfig.ts
```typescript
// 调整启动选项格式
export interface BrowserLaunchOptions {
  headless?: boolean;
  executablePath?: string;
  args?: string[];
  timeout?: number;
}
```

#### 2.3 更新 PlatformAdapter.ts
```typescript
// 旧代码
import { Page } from 'puppeteer';
await page.setCookie(...cookies);
await page.type(selector, text);

// 新代码
import { Page } from 'playwright';
// Cookie 通过 context 设置（在 BrowserAutomationService 中处理）
await page.fill(selector, text); // 或 page.type()
```

### 阶段 3：平台适配器迁移（60分钟）

#### 逐个迁移 12 个适配器

**每个适配器的修改步骤**：
1. 更新导入语句：`import { Page } from 'playwright';`
2. 检查并更新 API 调用：
   - `page.type()` → `page.fill()` 或保持 `page.type()`
   - `page.click()` → 保持不变（兼容）
   - `page.waitForSelector()` → 保持不变（兼容）
   - `page.evaluate()` → 保持不变（兼容）
   - `page.goto()` → 保持不变（兼容）
3. 更新 Cookie 登录逻辑（如果有特殊处理）

**优先级顺序**（按使用频率）：
1. ToutiaoAdapter（头条号）- 最常用
2. WechatAdapter（微信公众号）
3. XiaohongshuAdapter（小红书）
4. DouyinAdapter（抖音）
5. ZhihuAdapter（知乎）
6. QieAdapter（企鹅号）
7. JianshuAdapter（简书）
8. SouhuAdapter（搜狐号）
9. BilibiliAdapter（哔哩哔哩）
10. CSDNAdapter（CSDN）
11. BaijiahaoAdapter（百家号）
12. WangyiAdapter（网易号）

### 阶段 4：执行器和服务迁移（30分钟）

#### 4.1 更新 PublishingExecutor.ts
- 更新浏览器启动调用
- 确保 Cookie 正确传递到 context
- 更新页面创建逻辑

#### 4.2 更新 BatchExecutor.ts
- 更新浏览器强制关闭逻辑
- 确保 context 也被正确关闭

#### 4.3 更新 AccountService.ts
- 更新账号登录测试功能
- 使用 Playwright API

#### 4.4 更新 ImageUploadService.ts
- 更新图片上传相关的页面操作

### 阶段 5：测试验证（30分钟）

#### 5.1 单元测试
- 测试 BrowserAutomationService 启动和关闭
- 测试页面创建和导航

#### 5.2 集成测试
- 测试 Cookie 登录流程
- 测试单个平台发布

#### 5.3 端到端测试
- 完整流程：Windows 登录 → 捕获 Cookie → 后端发布
- 测试所有 12 个平台

---

## 📝 关键 API 映射表

### Cookie 管理
| Puppeteer | Playwright |
|-----------|-----------|
| `await page.setCookie(...cookies)` | `await context.addCookies(cookies)` |
| `await page.cookies()` | `await context.cookies()` |

### 页面操作
| Puppeteer | Playwright | 说明 |
|-----------|-----------|------|
| `await page.type(selector, text)` | `await page.fill(selector, text)` | fill 更快，type 保留输入延迟 |
| `await page.click(selector)` | `await page.click(selector)` | ✅ 兼容 |
| `await page.waitForSelector(selector)` | `await page.waitForSelector(selector)` | ✅ 兼容 |
| `await page.evaluate(fn)` | `await page.evaluate(fn)` | ✅ 兼容 |
| `await page.goto(url)` | `await page.goto(url)` | ✅ 兼容 |

### 等待和导航
| Puppeteer | Playwright |
|-----------|-----------|
| `waitUntil: 'networkidle2'` | `waitUntil: 'networkidle'` |
| `waitUntil: 'domcontentloaded'` | `waitUntil: 'domcontentloaded'` ✅ |

### 浏览器管理
| Puppeteer | Playwright |
|-----------|-----------|
| `puppeteer.launch()` | `chromium.launch()` |
| `browser.newPage()` | `context.newPage()` |
| `browser.close()` | `browser.close()` + `context.close()` |

---

## ⚠️ 关键注意事项

### 1. Cookie 管理变化
**Puppeteer**：
```typescript
await page.setCookie(...cookies);
```

**Playwright**：
```typescript
// 在 BrowserAutomationService 中
const context = await browser.newContext();
await context.addCookies(cookies);
const page = await context.newPage();
```

**影响**：
- Cookie 需要在创建页面前设置
- 需要在 `BrowserAutomationService` 中添加 Cookie 管理方法
- 平台适配器中的 `loginWithCookies` 方法需要调整

### 2. BrowserContext 概念
- Playwright 引入了 `BrowserContext` 层
- 每个 context 是独立的浏览器会话
- Cookie、Storage 等都在 context 层面管理

### 3. 页面生命周期
- 必须先创建 context，再创建 page
- 关闭时需要同时关闭 context 和 browser

### 4. API 兼容性
- 大部分 API 是兼容的（click, waitForSelector, evaluate, goto）
- 主要差异在 Cookie 管理和浏览器启动

### 5. Windows 登录管理器
- **完全不受影响**
- 继续使用 Electron BrowserView
- Cookie 格式保持不变
- 数据库交互保持不变

---

## 🎯 预期收益

### 1. 性能提升
- Playwright 通常比 Puppeteer 快 20-30%
- 更好的并发处理能力
- 更少的内存占用

### 2. 稳定性提升
- 更好的自动等待机制（减少 timeout 错误）
- 更可靠的元素定位
- 更好的错误恢复

### 3. 维护性提升
- 更现代的 API 设计
- 更好的文档和社区支持
- 更活跃的开发和更新

### 4. 功能增强
- 支持多浏览器（Chromium, Firefox, WebKit）
- 更好的调试工具
- 更强大的网络拦截功能

---

## 📅 时间估算

| 阶段 | 任务 | 预计时间 |
|------|------|---------|
| 1 | 准备工作 | 10分钟 |
| 2 | 核心服务迁移 | 30分钟 |
| 3 | 平台适配器迁移 | 60分钟 |
| 4 | 执行器和服务迁移 | 30分钟 |
| 5 | 测试验证 | 30分钟 |
| **总计** | | **2.5小时** |

---

## ✅ 完成标准

### 代码层面
- [ ] 所有 Puppeteer 依赖已移除
- [ ] 所有平台适配器使用 Playwright
- [ ] BrowserAutomationService 完全迁移
- [ ] 所有执行器和服务已更新

### 功能层面
- [ ] Windows 登录管理器正常工作
- [ ] Cookie 捕获和保存正常
- [ ] 后端能正确读取 Cookie
- [ ] 所有 12 个平台能正常发布

### 测试层面
- [ ] 单元测试通过
- [ ] 集成测试通过
- [ ] 端到端测试通过
- [ ] 所有平台发布测试通过

### 文档层面
- [ ] 迁移文档完整
- [ ] API 变更记录清晰
- [ ] 测试报告完整

---

## 🚀 开始执行

**当前状态**：等待确认

**下一步**：
1. 确认方案无误
2. 开始执行阶段 1（准备工作）
3. 逐步完成各阶段任务

---

**创建时间**：2025-12-31
**预计完成**：2025-12-31（当天完成）
**负责人**：Kiro AI Assistant
