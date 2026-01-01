# Puppeteer → Playwright 迁移最终方案

## 🎯 迁移策略

### 核心思路
**删除旧的，重新开始！**

1. ✅ **保留基础框架**
   - BrowserAutomationService（迁移到 Playwright）
   - PlatformAdapter 基类（迁移到 Playwright）
   - browserConfig（迁移到 Playwright）

2. ❌ **删除所有平台适配器**
   - 删除 12 个旧的适配器文件
   - 清理 AdapterRegistry 中的注册
   - 后续用 Playwright 重新制作

3. ✅ **保留其他部分**
   - Windows 登录管理器（不依赖 Puppeteer）
   - 前端页面（完整保留）
   - 数据库（无需修改）
   - 执行器和服务（迁移到 Playwright）

---

## 📋 详细实施步骤

### 阶段 1：准备工作（5分钟）

#### 1.1 更新依赖
```bash
cd server
npm uninstall puppeteer @types/puppeteer
npm install playwright
```

#### 1.2 备份现有代码
```bash
git add .
git commit -m "备份：Puppeteer 迁移前的代码"
```

---

### 阶段 2：迁移核心服务（20分钟）

#### 2.1 更新 BrowserAutomationService.ts
**文件**：`server/src/services/BrowserAutomationService.ts`

**主要变化**：
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

**新增功能**：
- 添加 `BrowserContext` 管理
- 添加 `createPageWithCookies()` 方法
- 更新 Cookie 管理逻辑

#### 2.2 更新 browserConfig.ts
**文件**：`server/src/config/browserConfig.ts`

**主要变化**：
- 调整启动选项格式（Playwright 格式）
- 移除 Puppeteer 特定的选项

#### 2.3 更新 PlatformAdapter.ts
**文件**：`server/src/services/adapters/PlatformAdapter.ts`

**主要变化**：
```typescript
// 旧代码
import { Page } from 'puppeteer';
await page.setCookie(...cookies);
await page.type(selector, text);

// 新代码
import { Page, BrowserContext } from 'playwright';
// Cookie 通过 context 设置
await page.fill(selector, text);
```

**保留的方法**：
- `cleanArticleContent()` - 清理文章内容
- `safeClick()` - 安全点击
- `waitForPageLoad()` - 等待页面加载
- `log()` - 日志记录
- 所有抽象方法定义

---

### 阶段 3：删除旧的平台适配器（5分钟）

#### 3.1 删除适配器文件
```bash
cd server/src/services/adapters
rm ToutiaoAdapter.ts
rm WechatAdapter.ts
rm DouyinAdapter.ts
rm XiaohongshuAdapter.ts
rm ZhihuAdapter.ts
rm JianshuAdapter.ts
rm SouhuAdapter.ts
rm QieAdapter.ts
rm BilibiliAdapter.ts
rm CSDNAdapter.ts
rm BaijiahaoAdapter.ts
rm WangyiAdapter.ts
```

#### 3.2 清理 AdapterRegistry.ts
**文件**：`server/src/services/adapters/AdapterRegistry.ts`

**删除所有适配器注册**：
```typescript
// 删除所有 import
// 删除所有 register() 调用
// 保留 AdapterRegistry 类的基础结构
```

**保留的代码**：
```typescript
import { PlatformAdapter } from './PlatformAdapter';

class AdapterRegistry {
  private adapters: Map<string, PlatformAdapter> = new Map();

  register(adapter: PlatformAdapter): void {
    this.adapters.set(adapter.platformId, adapter);
  }

  getAdapter(platformId: string): PlatformAdapter | undefined {
    return this.adapters.get(platformId);
  }

  getAllAdapters(): PlatformAdapter[] {
    return Array.from(this.adapters.values());
  }
}

export const adapterRegistry = new AdapterRegistry();

// 注释：适配器将在后续重新实现
// TODO: 使用 Playwright 重新实现平台适配器
```

---

### 阶段 4：更新执行器和服务（15分钟）

#### 4.1 更新 PublishingExecutor.ts
**文件**：`server/src/services/PublishingExecutor.ts`

**主要变化**：
- 更新浏览器启动调用
- 更新 Cookie 传递逻辑
- 确保使用 Playwright API

#### 4.2 更新 BatchExecutor.ts
**文件**：`server/src/services/BatchExecutor.ts`

**主要变化**：
- 更新浏览器强制关闭逻辑
- 确保 context 也被正确关闭

#### 4.3 更新 AccountService.ts
**文件**：`server/src/services/AccountService.ts`

**主要变化**：
- 更新账号登录测试功能
- 使用 Playwright API

#### 4.4 更新 ImageUploadService.ts
**文件**：`server/src/services/ImageUploadService.ts`

**主要变化**：
- 更新图片上传相关的页面操作
- 使用 Playwright API

---

### 阶段 5：创建适配器模板（10分钟）

#### 5.1 创建适配器模板文件
**文件**：`server/src/services/adapters/AdapterTemplate.ts`

```typescript
import { Page } from 'playwright';
import {
  PlatformAdapter,
  LoginSelectors,
  PublishSelectors,
  Article,
  PublishingConfig
} from './PlatformAdapter';

/**
 * 平台适配器模板
 * 使用 Playwright 实现
 * 
 * 使用方法：
 * 1. 复制此文件并重命名（如 ToutiaoAdapter.ts）
 * 2. 修改类名和平台信息
 * 3. 实现登录和发布逻辑
 * 4. 在 AdapterRegistry.ts 中注册
 */
export class TemplateAdapter extends PlatformAdapter {
  platformId = 'template';
  platformName = '模板平台';

  getLoginUrl(): string {
    return 'https://example.com/login';
  }

  getPublishUrl(): string {
    return 'https://example.com/publish';
  }

  getLoginSelectors(): LoginSelectors {
    return {
      usernameInput: 'input[name="username"]',
      passwordInput: 'input[name="password"]',
      submitButton: 'button[type="submit"]',
      successIndicator: '.user-avatar'
    };
  }

  getPublishSelectors(): PublishSelectors {
    return {
      titleInput: 'input[name="title"]',
      contentEditor: '.editor',
      publishButton: 'button.publish',
      successIndicator: '.success-message'
    };
  }

  /**
   * 执行登录流程
   * 优先使用 Cookie 登录，失败则使用表单登录
   */
  async performLogin(
    page: Page,
    credentials: { username: string; password: string; cookies?: any[] }
  ): Promise<boolean> {
    try {
      await this.log('info', '开始登录流程');

      // 1. 优先使用 Cookie 登录
      if (credentials.cookies && credentials.cookies.length > 0) {
        await this.log('info', '使用 Cookie 登录');
        
        // Cookie 已在 BrowserAutomationService 中设置
        // 这里只需要验证登录状态
        await page.goto(this.getPublishUrl(), { waitUntil: 'networkidle' });
        
        const currentUrl = page.url();
        if (!currentUrl.includes('login')) {
          await this.log('info', 'Cookie 登录成功');
          return true;
        }
        
        await this.log('warning', 'Cookie 登录失败，尝试表单登录');
      }

      // 2. 表单登录（后备方案）
      await this.log('info', '开始表单登录');
      await page.goto(this.getLoginUrl(), { waitUntil: 'networkidle' });
      
      const selectors = this.getLoginSelectors();
      
      // 填写用户名
      await page.waitForSelector(selectors.usernameInput);
      await page.fill(selectors.usernameInput, credentials.username);
      
      // 填写密码
      await page.fill(selectors.passwordInput, credentials.password);
      
      // 点击登录按钮
      await page.click(selectors.submitButton);
      
      // 等待登录完成
      await page.waitForTimeout(3000);
      
      await this.log('info', '表单登录成功');
      return true;
    } catch (error: any) {
      await this.log('error', '登录失败', { error: error.message });
      return false;
    }
  }

  /**
   * 执行发布流程
   */
  async performPublish(
    page: Page,
    article: Article,
    config: PublishingConfig
  ): Promise<boolean> {
    try {
      await this.log('info', '开始发布流程');
      await this.log('info', `文章标题: ${article.title}`);

      // 1. 导航到发布页面
      await page.goto(this.getPublishUrl(), { waitUntil: 'networkidle' });
      
      const selectors = this.getPublishSelectors();

      // 2. 填写标题
      await this.log('info', '填写标题');
      await page.waitForSelector(selectors.titleInput);
      await page.fill(selectors.titleInput, config.title || article.title);

      // 3. 填写内容
      await this.log('info', '填写内容');
      await page.waitForSelector(selectors.contentEditor);
      
      // 清理内容（移除 HTML 和图片标记）
      const cleanContent = this.cleanArticleContent(article.content);
      await page.fill(selectors.contentEditor, cleanContent);

      // 4. 点击发布按钮
      await this.log('info', '点击发布按钮');
      await page.click(selectors.publishButton);

      // 5. 等待发布完成
      await page.waitForTimeout(5000);

      await this.log('info', '发布成功');
      return true;
    } catch (error: any) {
      await this.log('error', '发布失败', { error: error.message });
      return false;
    }
  }

  /**
   * 验证发布成功
   */
  async verifyPublishSuccess(page: Page): Promise<boolean> {
    try {
      const selectors = this.getPublishSelectors();
      if (selectors.successIndicator) {
        await page.waitForSelector(selectors.successIndicator, { timeout: 10000 });
        return true;
      }
      return true;
    } catch (error) {
      return false;
    }
  }
}
```

#### 5.2 创建适配器开发指南
**文件**：`server/src/services/adapters/README.md`

```markdown
# 平台适配器开发指南

## 使用 Playwright 开发新适配器

### 1. 创建新适配器

复制 `AdapterTemplate.ts` 并重命名：
```bash
cp AdapterTemplate.ts ToutiaoAdapter.ts
```

### 2. 修改基本信息

```typescript
export class ToutiaoAdapter extends PlatformAdapter {
  platformId = 'toutiao';
  platformName = '头条号';
  
  getLoginUrl(): string {
    return 'https://mp.toutiao.com/auth/page/login';
  }
  
  getPublishUrl(): string {
    return 'https://mp.toutiao.com/profile_v4/graphic/publish';
  }
}
```

### 3. 配置选择器

使用浏览器开发者工具获取选择器：
- 右键元素 → 检查
- 复制 CSS 选择器

### 4. 实现登录逻辑

```typescript
async performLogin(page: Page, credentials: any): Promise<boolean> {
  // 1. Cookie 登录（优先）
  if (credentials.cookies) {
    // Cookie 已在 context 中设置
    await page.goto(this.getPublishUrl());
    // 验证登录状态
  }
  
  // 2. 表单登录（后备）
  await page.goto(this.getLoginUrl());
  await page.fill('input[name="username"]', credentials.username);
  await page.fill('input[name="password"]', credentials.password);
  await page.click('button[type="submit"]');
}
```

### 5. 实现发布逻辑

```typescript
async performPublish(page: Page, article: Article, config: PublishingConfig): Promise<boolean> {
  // 1. 导航到发布页面
  await page.goto(this.getPublishUrl());
  
  // 2. 填写标题
  await page.fill('.title-input', article.title);
  
  // 3. 填写内容
  const cleanContent = this.cleanArticleContent(article.content);
  await page.fill('.content-editor', cleanContent);
  
  // 4. 点击发布
  await page.click('.publish-button');
}
```

### 6. 注册适配器

在 `AdapterRegistry.ts` 中注册：
```typescript
import { ToutiaoAdapter } from './ToutiaoAdapter';

adapterRegistry.register(new ToutiaoAdapter());
```

## Playwright API 常用方法

### 页面操作
- `page.goto(url)` - 导航到 URL
- `page.fill(selector, text)` - 填充输入框
- `page.click(selector)` - 点击元素
- `page.waitForSelector(selector)` - 等待元素出现
- `page.waitForTimeout(ms)` - 等待指定时间

### 元素定位
- `page.locator(selector)` - 定位元素（推荐）
- `page.$(selector)` - 查询单个元素
- `page.$$(selector)` - 查询多个元素

### 等待策略
- `waitUntil: 'networkidle'` - 等待网络空闲
- `waitUntil: 'domcontentloaded'` - 等待 DOM 加载
- `waitUntil: 'load'` - 等待页面完全加载

### 调试技巧
- 使用 `headless: false` 查看浏览器操作
- 使用 `page.screenshot()` 截图调试
- 使用 `page.pause()` 暂停执行

## 最佳实践

1. **使用 Cookie 登录**
   - 优先使用 Cookie，避免频繁登录
   - Cookie 由 Windows 登录管理器捕获

2. **添加日志**
   - 使用 `this.log()` 记录关键步骤
   - 便于调试和监控

3. **错误处理**
   - 使用 try-catch 捕获异常
   - 提供有意义的错误信息

4. **等待时间**
   - 使用 `waitForSelector` 而不是固定延迟
   - 必要时使用 `waitForTimeout`

5. **选择器策略**
   - 优先使用稳定的选择器（id, class）
   - 避免使用过于具体的路径选择器
```

---

### 阶段 6：更新文档（5分钟）

#### 6.1 更新主 README
添加 Playwright 迁移说明

#### 6.2 创建迁移完成文档
记录迁移过程和注意事项

---

## 📊 文件清单

### 需要修改的文件

#### 核心服务（迁移到 Playwright）
- ✅ `server/src/services/BrowserAutomationService.ts`
- ✅ `server/src/config/browserConfig.ts`
- ✅ `server/src/services/adapters/PlatformAdapter.ts`

#### 执行器和服务（迁移到 Playwright）
- ✅ `server/src/services/PublishingExecutor.ts`
- ✅ `server/src/services/BatchExecutor.ts`
- ✅ `server/src/services/AccountService.ts`
- ✅ `server/src/services/ImageUploadService.ts`

#### 适配器注册（清理）
- ✅ `server/src/services/adapters/AdapterRegistry.ts`

#### 配置文件
- ✅ `server/package.json`

### 需要删除的文件

#### 平台适配器（12个）
- ❌ `server/src/services/adapters/ToutiaoAdapter.ts`
- ❌ `server/src/services/adapters/WechatAdapter.ts`
- ❌ `server/src/services/adapters/DouyinAdapter.ts`
- ❌ `server/src/services/adapters/XiaohongshuAdapter.ts`
- ❌ `server/src/services/adapters/ZhihuAdapter.ts`
- ❌ `server/src/services/adapters/JianshuAdapter.ts`
- ❌ `server/src/services/adapters/SouhuAdapter.ts`
- ❌ `server/src/services/adapters/QieAdapter.ts`
- ❌ `server/src/services/adapters/BilibiliAdapter.ts`
- ❌ `server/src/services/adapters/CSDNAdapter.ts`
- ❌ `server/src/services/adapters/BaijiahaoAdapter.ts`
- ❌ `server/src/services/adapters/WangyiAdapter.ts`

### 需要创建的文件

#### 模板和文档
- ✅ `server/src/services/adapters/AdapterTemplate.ts`
- ✅ `server/src/services/adapters/README.md`

---

## ⚠️ 注意事项

### 1. Cookie 管理变化
- Puppeteer: `page.setCookie()`
- Playwright: `context.addCookies()`
- 在 BrowserAutomationService 中统一处理

### 2. 页面创建流程
```typescript
// Puppeteer
const page = await browser.newPage();

// Playwright
const context = await browser.newContext();
const page = await context.newPage();
```

### 3. API 差异
- `page.type()` → `page.fill()` 或 `page.type()`
- `waitUntil: 'networkidle2'` → `waitUntil: 'networkidle'`
- `page.setCookie()` → `context.addCookies()`

### 4. Windows 登录管理器
- **完全不受影响**
- 继续使用 Electron BrowserView
- Cookie 格式保持不变

---

## 🎯 预期结果

### 迁移完成后的状态

1. ✅ **核心框架已迁移到 Playwright**
   - BrowserAutomationService 使用 Playwright
   - PlatformAdapter 基类使用 Playwright
   - 所有辅助方法已更新

2. ✅ **旧适配器已删除**
   - 12 个旧适配器文件已删除
   - AdapterRegistry 已清理

3. ✅ **提供开发模板**
   - AdapterTemplate.ts 可直接使用
   - README.md 提供详细指南

4. ✅ **系统可运行**
   - 核心服务正常工作
   - 可以启动浏览器
   - 可以创建页面
   - 只是没有具体的平台适配器

### 后续工作

**你需要做的**：
1. 使用 AdapterTemplate.ts 创建新适配器
2. 实现各平台的登录和发布逻辑
3. 在 AdapterRegistry.ts 中注册
4. 测试验证

**优势**：
- 全新的代码，更干净
- 使用 Playwright 最佳实践
- 有完整的模板和文档
- 可以逐个平台实现

---

## 📅 时间估算

| 阶段 | 任务 | 预计时间 |
|------|------|---------|
| 1 | 准备工作 | 5分钟 |
| 2 | 迁移核心服务 | 20分钟 |
| 3 | 删除旧适配器 | 5分钟 |
| 4 | 更新执行器和服务 | 15分钟 |
| 5 | 创建模板和文档 | 10分钟 |
| 6 | 更新文档 | 5分钟 |
| **总计** | | **1小时** |

---

## ✅ 完成标准

### 代码层面
- [ ] Puppeteer 依赖已移除
- [ ] Playwright 依赖已安装
- [ ] 核心服务已迁移到 Playwright
- [ ] 旧适配器已删除
- [ ] 模板和文档已创建

### 功能层面
- [ ] 浏览器可以正常启动
- [ ] 页面可以正常创建
- [ ] Cookie 管理正常工作
- [ ] Windows 登录管理器正常工作

### 文档层面
- [ ] 迁移文档完整
- [ ] 开发指南清晰
- [ ] 模板可用

---

## 🚀 准备开始

**当前状态**：等待确认

**确认后将执行**：
1. 安装 Playwright，卸载 Puppeteer
2. 迁移核心服务到 Playwright
3. 删除所有旧适配器
4. 创建开发模板和文档
5. 提供一个干净的、基于 Playwright 的框架

**你将获得**：
- 全新的 Playwright 框架
- 完整的开发模板
- 详细的开发指南
- 可以重新开始制作适配器

---

**创建时间**：2025-12-31
**预计完成**：2025-12-31（1小时内）
**负责人**：Kiro AI Assistant
