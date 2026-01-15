# 平台适配器开发指南 (Playwright)

## 📋 概述

本指南帮助你使用 Playwright 开发新的平台适配器，实现自动登录和发布功能。

---

## 🚀 快速开始

### 1. 创建新适配器

复制模板文件并重命名：

```bash
cd server/src/services/adapters
cp AdapterTemplate.ts ToutiaoAdapter.ts
```

### 2. 修改基本信息

```typescript
export class ToutiaoAdapter extends PlatformAdapter {
  platformId = 'toutiao';  // 平台唯一标识
  platformName = '头条号';  // 平台显示名称
  
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

1. 打开平台网站
2. 右键元素 → 检查
3. 复制 CSS 选择器

```typescript
getLoginSelectors(): LoginSelectors {
  return {
    usernameInput: 'input[name="mobile"]',
    passwordInput: 'input[name="password"]',
    submitButton: 'button.btn-login',
    successIndicator: '.user-avatar'
  };
}

getPublishSelectors(): PublishSelectors {
  return {
    titleInput: 'input[placeholder*="请输入文章标题"]',
    contentEditor: '.ql-editor',
    publishButton: 'button:contains("发布")',
    successIndicator: '.publish-success'
  };
}
```

### 4. 实现登录逻辑

```typescript
async performLogin(
  page: Page,
  credentials: { username: string; password: string; cookies?: any[] }
): Promise<boolean> {
  try {
    // 1. Cookie 登录（优先）
    if (credentials.cookies && credentials.cookies.length > 0) {
      await this.log('info', '使用 Cookie 登录');
      
      // Cookie 已在 BrowserContext 中设置
      await page.goto(this.getPublishUrl(), { waitUntil: 'networkidle' });
      
      // 验证登录状态
      const currentUrl = page.url();
      if (!currentUrl.includes('login')) {
        await this.log('info', 'Cookie 登录成功');
        return true;
      }
    }
    
    // 2. 表单登录（后备）
    await this.log('info', '开始表单登录');
    await page.goto(this.getLoginUrl(), { waitUntil: 'networkidle' });
    
    const selectors = this.getLoginSelectors();
    await page.fill(selectors.usernameInput, credentials.username);
    await page.fill(selectors.passwordInput, credentials.password);
    await page.click(selectors.submitButton);
    
    await page.waitForTimeout(3000);
    
    await this.log('info', '登录成功');
    return true;
  } catch (error: any) {
    await this.log('error', '登录失败', { error: error.message });
    return false;
  }
}
```

### 5. 实现发布逻辑

```typescript
async performPublish(
  page: Page,
  article: Article,
  config: PublishingConfig
): Promise<boolean> {
  try {
    await this.log('info', '开始发布流程');
    
    // 1. 导航到发布页面
    await page.goto(this.getPublishUrl(), { waitUntil: 'networkidle' });
    
    const selectors = this.getPublishSelectors();
    
    // 2. 填写标题
    await this.log('info', '填写标题');
    await page.fill(selectors.titleInput, config.title || article.title);
    
    // 3. 填写内容
    await this.log('info', '填写内容');
    const cleanContent = this.cleanArticleContent(article.content);
    await page.fill(selectors.contentEditor, cleanContent);
    
    // 4. 点击发布
    await this.log('info', '点击发布按钮');
    await page.click(selectors.publishButton);
    
    await page.waitForTimeout(5000);
    
    await this.log('info', '发布成功');
    return true;
  } catch (error: any) {
    await this.log('error', '发布失败', { error: error.message });
    return false;
  }
}
```

### 6. 注册适配器

在 `AdapterRegistry.ts` 中注册：

```typescript
import { ToutiaoAdapter } from './ToutiaoAdapter';

private registerDefaultAdapters(): void {
  this.register(new ToutiaoAdapter());
  // 注册其他适配器...
}
```

---

## 📚 Playwright API 常用方法

### 页面导航

```typescript
// 导航到 URL
await page.goto(url, { waitUntil: 'networkidle' });

// 刷新页面
await page.reload({ waitUntil: 'networkidle' });

// 返回上一页
await page.goBack();
```

### 元素操作

```typescript
// 填充输入框（清空后输入）
await page.fill(selector, text);

// 输入文本（保留原有内容）
await page.type(selector, text, { delay: 100 });

// 点击元素
await page.click(selector);

// 双击
await page.dblclick(selector);

// 右键点击
await page.click(selector, { button: 'right' });

// 选择下拉框
await page.selectOption(selector, 'value');

// 上传文件
await page.setInputFiles(selector, 'path/to/file.jpg');

// 勾选复选框
await page.check(selector);

// 取消勾选
await page.uncheck(selector);
```

### 元素定位

```typescript
// 等待元素出现
await page.waitForSelector(selector, { timeout: 10000 });

// 等待元素消失
await page.waitForSelector(selector, { state: 'hidden' });

// 检查元素是否可见
const isVisible = await page.isVisible(selector);

// 检查元素是否存在
const exists = await page.$(selector) !== null;

// 获取元素文本
const text = await page.textContent(selector);

// 获取元素属性
const value = await page.getAttribute(selector, 'value');
```

### 等待策略

```typescript
// 等待网络空闲
await page.goto(url, { waitUntil: 'networkidle' });

// 等待 DOM 加载
await page.goto(url, { waitUntil: 'domcontentloaded' });

// 等待页面完全加载
await page.goto(url, { waitUntil: 'load' });

// 等待指定时间
await page.waitForTimeout(3000);

// 等待 URL 变化
await page.waitForURL('**/success');

// 等待函数返回 true
await page.waitForFunction(() => document.title === 'Success');
```

### 执行 JavaScript

```typescript
// 执行脚本
await page.evaluate(() => {
  document.querySelector('.editor').innerHTML = '<p>Hello</p>';
});

// 传递参数
await page.evaluate((text) => {
  document.querySelector('.editor').textContent = text;
}, 'Hello World');

// 返回值
const title = await page.evaluate(() => document.title);
```

### 截图和调试

```typescript
// 截图
await page.screenshot({ path: 'screenshot.png' });

// 截取元素
await page.locator(selector).screenshot({ path: 'element.png' });

// 暂停执行（调试用）
await page.pause();
```

---

## 🎯 最佳实践

### 1. 使用 Cookie 登录

**优先使用 Cookie，避免频繁登录**

```typescript
// Cookie 由 Windows 登录管理器捕获
// 在 BrowserContext 层面设置
// 适配器只需验证登录状态

if (credentials.cookies && credentials.cookies.length > 0) {
  await page.goto(this.getPublishUrl());
  
  // 检查是否已登录
  const currentUrl = page.url();
  if (!currentUrl.includes('login')) {
    return true; // 登录成功
  }
}
```

### 2. 添加详细日志

**使用 `this.log()` 记录关键步骤**

```typescript
await this.log('info', '开始填写标题');
await this.log('info', `标题内容: ${title}`);
await this.log('warning', '未找到分类选择器，跳过');
await this.log('error', '发布失败', { error: error.message });
```

### 3. 错误处理

**使用 try-catch 捕获异常**

```typescript
try {
  await page.click(selector);
} catch (error: any) {
  await this.log('error', '点击失败', { error: error.message });
  
  // 尝试备用方案
  await page.evaluate(() => {
    document.querySelector(selector).click();
  });
}
```

### 4. 等待时间

**优先使用 `waitForSelector`，避免固定延迟**

```typescript
// ✅ 好的做法
await page.waitForSelector('.publish-button');
await page.click('.publish-button');

// ❌ 不好的做法
await page.waitForTimeout(5000);
await page.click('.publish-button');
```

### 5. 选择器策略

**优先使用稳定的选择器**

```typescript
// ✅ 好的选择器（稳定）
'input[name="title"]'
'.editor-content'
'button[type="submit"]'

// ❌ 不好的选择器（容易变化）
'#root > div > div:nth-child(3) > button'
'body > div:nth-child(5) > span'
```

### 6. 内容清理

**使用基类提供的 `cleanArticleContent()` 方法**

```typescript
// 自动移除 HTML 标签和图片标记
const cleanContent = this.cleanArticleContent(article.content);
await page.fill(selectors.contentEditor, cleanContent);
```

---

## 🔧 调试技巧

### 1. 可视化模式

在任务配置中设置 `headless: false`：

```json
{
  "headless": false
}
```

### 2. 截图调试

在关键步骤截图：

```typescript
await page.screenshot({ path: `debug-step-${Date.now()}.png` });
```

### 3. 暂停执行

使用 `page.pause()` 暂停：

```typescript
await page.pause(); // 浏览器会暂停，等待你手动继续
```

### 4. 查看元素

打印元素信息：

```typescript
const element = await page.$(selector);
if (element) {
  const text = await element.textContent();
  const html = await element.innerHTML();
  console.log('元素文本:', text);
  console.log('元素HTML:', html);
}
```

---

## 📝 完整示例

### 头条号适配器（简化版）

```typescript
import { Page } from 'playwright';
import {
  PlatformAdapter,
  LoginSelectors,
  PublishSelectors,
  Article,
  PublishingConfig
} from './PlatformAdapter';

export class ToutiaoAdapter extends PlatformAdapter {
  platformId = 'toutiao';
  platformName = '头条号';

  getLoginUrl(): string {
    return 'https://mp.toutiao.com/auth/page/login';
  }

  getPublishUrl(): string {
    return 'https://mp.toutiao.com/profile_v4/graphic/publish';
  }

  getLoginSelectors(): LoginSelectors {
    return {
      usernameInput: 'input[name="mobile"]',
      passwordInput: 'input[name="password"]',
      submitButton: 'button.btn-login',
      successIndicator: '.user-avatar'
    };
  }

  getPublishSelectors(): PublishSelectors {
    return {
      titleInput: 'textarea[placeholder*="请输入文章标题"]',
      contentEditor: '.ProseMirror',
      publishButton: 'button:has-text("预览并发布")',
      successIndicator: '.publish-success'
    };
  }

  async performLogin(
    page: Page,
    credentials: { username: string; password: string; cookies?: any[] }
  ): Promise<boolean> {
    try {
      // Cookie 登录
      if (credentials.cookies && credentials.cookies.length > 0) {
        await this.log('info', '使用 Cookie 登录');
        await page.goto(this.getPublishUrl(), { waitUntil: 'networkidle' });
        
        const currentUrl = page.url();
        if (!currentUrl.includes('login')) {
          await this.log('info', 'Cookie 登录成功');
          return true;
        }
      }
      
      // 表单登录
      await this.log('info', '开始表单登录');
      await page.goto(this.getLoginUrl(), { waitUntil: 'networkidle' });
      
      const selectors = this.getLoginSelectors();
      await page.fill(selectors.usernameInput, credentials.username);
      await page.fill(selectors.passwordInput, credentials.password);
      await page.click(selectors.submitButton);
      
      await page.waitForTimeout(3000);
      
      await this.log('info', '登录成功');
      return true;
    } catch (error: any) {
      await this.log('error', '登录失败', { error: error.message });
      return false;
    }
  }

  async performPublish(
    page: Page,
    article: Article,
    config: PublishingConfig
  ): Promise<boolean> {
    try {
      await this.log('info', '开始发布流程');
      
      // 导航到发布页面
      await page.goto(this.getPublishUrl(), { waitUntil: 'networkidle' });
      
      const selectors = this.getPublishSelectors();
      
      // 填写标题
      await this.log('info', '填写标题');
      await page.waitForSelector(selectors.titleInput);
      await page.fill(selectors.titleInput, config.title || article.title);
      
      // 填写内容
      await this.log('info', '填写内容');
      await page.waitForSelector(selectors.contentEditor);
      const cleanContent = this.cleanArticleContent(article.content);
      await page.fill(selectors.contentEditor, cleanContent);
      
      // 点击发布
      await this.log('info', '点击发布按钮');
      await page.click(selectors.publishButton);
      
      await page.waitForTimeout(5000);
      
      await this.log('info', '发布成功');
      return true;
    } catch (error: any) {
      await this.log('error', '发布失败', { error: error.message });
      return false;
    }
  }

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

---

## 🔗 相关资源

- [Playwright 官方文档](https://playwright.dev/)
- [Playwright API 参考](https://playwright.dev/docs/api/class-page)
- [CSS 选择器参考](https://developer.mozilla.org/zh-CN/docs/Web/CSS/CSS_Selectors)
- [AdapterTemplate.ts](./AdapterTemplate.ts) - 适配器模板
- [PlatformAdapter.ts](./PlatformAdapter.ts) - 基类文档

---

## ❓ 常见问题

### Q: Cookie 登录失败怎么办？

A: 检查以下几点：
1. Cookie 是否已过期
2. Cookie 的 domain 是否正确
3. 是否需要特定的 Cookie（如 session_id）

### Q: 选择器找不到元素？

A: 尝试以下方法：
1. 使用 `page.waitForSelector()` 等待元素加载
2. 检查元素是否在 iframe 中
3. 使用更简单的选择器
4. 使用 `page.locator()` API

### Q: 如何处理动态内容？

A: 使用 Playwright 的自动等待机制：
```typescript
await page.waitForSelector(selector);
await page.waitForLoadState('networkidle');
```

### Q: 如何处理弹窗？

A: 监听 dialog 事件：
```typescript
page.on('dialog', async dialog => {
  await dialog.accept();
});
```

---

## 📞 获取帮助

如果遇到问题，请：
1. 查看 Playwright 官方文档
2. 使用可视化模式调试
3. 添加详细日志
4. 截图保存关键步骤

---

**祝你开发顺利！🎉**
