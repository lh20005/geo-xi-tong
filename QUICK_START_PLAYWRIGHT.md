# 🚀 Playwright 适配器快速开始

## 📝 5 分钟创建一个新适配器

### 1. 复制模板（10秒）

```bash
cd server/src/services/adapters
cp AdapterTemplate.ts ToutiaoAdapter.ts
```

### 2. 修改类名和平台信息（30秒）

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

### 3. 配置选择器（2分钟）

打开浏览器开发者工具，复制选择器：

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
    titleInput: 'textarea[placeholder*="请输入文章标题"]',
    contentEditor: '.ProseMirror',
    publishButton: 'button:has-text("发布")',
    successIndicator: '.success-message'
  };
}
```

### 4. 实现登录（1分钟）

```typescript
async performLogin(page: Page, credentials: any): Promise<boolean> {
  try {
    // Cookie 登录
    if (credentials.cookies && credentials.cookies.length > 0) {
      await page.goto(this.getPublishUrl());
      if (!page.url().includes('login')) {
        return true;
      }
    }
    
    // 表单登录
    await page.goto(this.getLoginUrl());
    await page.fill('input[name="mobile"]', credentials.username);
    await page.fill('input[name="password"]', credentials.password);
    await page.click('button.btn-login');
    await page.waitForTimeout(3000);
    
    return true;
  } catch (error: any) {
    await this.log('error', '登录失败', { error: error.message });
    return false;
  }
}
```

### 5. 实现发布（1分钟）

```typescript
async performPublish(page: Page, article: Article, config: PublishingConfig): Promise<boolean> {
  try {
    await page.goto(this.getPublishUrl());
    
    // 填写标题
    await page.fill('textarea[placeholder*="请输入文章标题"]', article.title);
    
    // 填写内容
    const cleanContent = this.cleanArticleContent(article.content);
    await page.fill('.ProseMirror', cleanContent);
    
    // 点击发布
    await page.click('button:has-text("发布")');
    await page.waitForTimeout(5000);
    
    return true;
  } catch (error: any) {
    await this.log('error', '发布失败', { error: error.message });
    return false;
  }
}
```

### 6. 注册适配器（30秒）

在 `AdapterRegistry.ts` 中：

```typescript
import { ToutiaoAdapter } from './ToutiaoAdapter';

private registerDefaultAdapters(): void {
  this.register(new ToutiaoAdapter());
}
```

---

## 🎯 常用 Playwright API

### 页面操作
```typescript
await page.goto(url);                          // 导航
await page.fill(selector, text);               // 填充输入框
await page.click(selector);                    // 点击
await page.waitForSelector(selector);          // 等待元素
await page.waitForTimeout(3000);               // 等待时间
await page.screenshot({ path: 'debug.png' }); // 截图
```

### 元素定位
```typescript
await page.waitForSelector('.editor');         // 等待元素出现
await page.isVisible('.button');               // 检查可见性
await page.textContent('.title');              // 获取文本
await page.getAttribute('.input', 'value');    // 获取属性
```

### 等待策略
```typescript
await page.goto(url, { waitUntil: 'networkidle' });  // 等待网络空闲
await page.goto(url, { waitUntil: 'domcontentloaded' }); // 等待 DOM
await page.goto(url, { waitUntil: 'load' });         // 等待完全加载
```

---

## 💡 调试技巧

### 1. 可视化模式
```json
{ "headless": false }
```

### 2. 截图调试
```typescript
await page.screenshot({ path: `step-${Date.now()}.png` });
```

### 3. 暂停执行
```typescript
await page.pause();
```

### 4. 打印日志
```typescript
await this.log('info', '当前步骤');
await this.log('warning', '警告信息');
await this.log('error', '错误信息', { error: error.message });
```

---

## 📚 完整文档

- [AdapterTemplate.ts](server/src/services/adapters/AdapterTemplate.ts) - 完整模板
- [README.md](server/src/services/adapters/README.md) - 详细指南
- [Playwright 官方文档](https://playwright.dev/)

---

## ✅ 检查清单

- [ ] 复制模板
- [ ] 修改类名和平台信息
- [ ] 配置选择器
- [ ] 实现登录逻辑
- [ ] 实现发布逻辑
- [ ] 注册适配器
- [ ] 测试验证

---

**5 分钟创建，立即可用！🎉**
