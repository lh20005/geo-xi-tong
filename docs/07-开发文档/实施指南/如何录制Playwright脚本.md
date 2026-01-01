# 🎬 如何录制 Playwright 脚本

## ✅ 前提条件

你的项目已经安装了 Playwright（版本 1.57.0）。

### 首次使用需要安装浏览器

```bash
# 安装 Chromium 浏览器（只需运行一次）
npx playwright install chromium
```

安装完成后就可以开始录制了！

---

## 🚀 快速开始

### 方法 1：录制任意网站

```bash
# 在项目根目录执行
npx playwright codegen https://mp.toutiao.com
```

这会打开：
1. **浏览器窗口** - 你在这里操作
2. **Playwright Inspector** - 自动生成代码

### 方法 2：录制特定平台

```bash
# 头条号
npx playwright codegen https://mp.toutiao.com

# 微信公众号
npx playwright codegen https://mp.weixin.qq.com

# 小红书
npx playwright codegen https://creator.xiaohongshu.com

# 知乎
npx playwright codegen https://zhuanlan.zhihu.com

# 简书
npx playwright codegen https://www.jianshu.com/writer
```

---

## 📝 录制步骤

### 1. 启动录制器

```bash
npx playwright codegen https://mp.toutiao.com
```

### 2. 在浏览器中操作

- ✅ 点击按钮
- ✅ 填写表单
- ✅ 导航页面
- ✅ 选择下拉菜单
- ✅ 上传文件

**所有操作都会被自动记录！**

### 3. 查看生成的代码

Playwright Inspector 会实时显示代码：

```typescript
import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  // 导航到页面
  await page.goto('https://mp.toutiao.com/');
  
  // 点击登录按钮
  await page.getByRole('button', { name: '登录' }).click();
  
  // 填写用户名
  await page.getByPlaceholder('请输入手机号').fill('13800138000');
  
  // 填写密码
  await page.getByPlaceholder('请输入密码').fill('password123');
  
  // 点击提交
  await page.getByRole('button', { name: '登录' }).click();
});
```

### 4. 复制代码

- 点击 Inspector 右上角的 **复制** 按钮
- 或者直接选中代码复制

---

## 🎯 实际示例

### 示例 1：录制头条号发布流程

```bash
# 启动录制
npx playwright codegen https://mp.toutiao.com/profile_v4/graphic/publish
```

**你的操作：**
1. 手动登录（如果需要）
2. 点击"新建文章"
3. 填写标题："测试标题"
4. 填写内容："测试内容"
5. 点击"发布"

**生成的代码：**
```typescript
await page.goto('https://mp.toutiao.com/profile_v4/graphic/publish');

// 填写标题
await page.getByPlaceholder('请输入文章标题').click();
await page.getByPlaceholder('请输入文章标题').fill('测试标题');

// 填写内容
await page.locator('.ProseMirror').click();
await page.locator('.ProseMirror').fill('测试内容');

// 点击发布
await page.getByRole('button', { name: '发布' }).click();
```

### 示例 2：录制微信公众号登录

```bash
npx playwright codegen https://mp.weixin.qq.com
```

**你的操作：**
1. 扫码登录
2. 等待登录成功

**生成的代码：**
```typescript
await page.goto('https://mp.weixin.qq.com/');

// 等待登录成功的标志
await page.waitForSelector('.weui-desktop_name');

// 获取用户信息
const userName = await page.textContent('.weui-desktop_name');
console.log('用户名:', userName);
```

---

## 🔧 高级用法

### 1. 指定浏览器

```bash
# 使用 Chrome
npx playwright codegen --browser=chromium https://example.com

# 使用 Firefox
npx playwright codegen --browser=firefox https://example.com

# 使用 Safari
npx playwright codegen --browser=webkit https://example.com
```

### 2. 保存浏览器状态（Cookie）

```bash
# 录制并保存登录状态
npx playwright codegen --save-storage=auth.json https://mp.toutiao.com

# 使用已保存的登录状态
npx playwright codegen --load-storage=auth.json https://mp.toutiao.com
```

### 3. 模拟移动设备

```bash
# 模拟 iPhone
npx playwright codegen --device="iPhone 13" https://example.com

# 模拟 iPad
npx playwright codegen --device="iPad Pro" https://example.com

# 模拟 Android
npx playwright codegen --device="Pixel 5" https://example.com
```

### 4. 设置视口大小

```bash
# 自定义窗口大小
npx playwright codegen --viewport-size=1280,720 https://example.com
```

### 5. 设置超时时间

```bash
# 设置 60 秒超时
npx playwright codegen --timeout=60000 https://example.com
```

---

## 💡 录制技巧

### 1. 暂停和继续

在 Playwright Inspector 中：
- 点击 **Pause** 暂停录制
- 点击 **Resume** 继续录制
- 点击 **Record** 开始新的录制

### 2. 查看元素选择器

录制时，Playwright Inspector 会显示多种选择器：

```typescript
// CSS 选择器
await page.click('.submit-button');

// Text 选择器
await page.click('text=提交');

// Role 选择器（推荐）
await page.getByRole('button', { name: '提交' }).click();

// Placeholder 选择器
await page.getByPlaceholder('请输入标题').fill('标题');
```

### 3. 编辑生成的代码

你可以在 Inspector 中：
- ✅ 删除不需要的步骤
- ✅ 修改选择器
- ✅ 添加等待时间
- ✅ 添加断言

### 4. 截图调试

在录制过程中添加截图：

```typescript
// 在关键步骤截图
await page.screenshot({ path: 'step1-login.png' });
await page.screenshot({ path: 'step2-publish.png' });
```

---

## 📋 将录制的代码用于适配器

### 步骤 1：录制操作

```bash
npx playwright codegen https://mp.toutiao.com
```

### 步骤 2：复制生成的代码

从 Inspector 复制：
```typescript
await page.goto('https://mp.toutiao.com/profile_v4/graphic/publish');
await page.getByPlaceholder('请输入文章标题').fill('标题');
await page.locator('.ProseMirror').fill('内容');
await page.getByRole('button', { name: '发布' }).click();
```

### 步骤 3：粘贴到适配器

```typescript
// server/src/services/adapters/ToutiaoAdapter.ts
import { Page } from 'playwright';
import { PlatformAdapter } from './PlatformAdapter';

export class ToutiaoAdapter extends PlatformAdapter {
  platformId = 'toutiao';
  platformName = '头条号';
  
  async performPublish(page: Page, article: any, config: any): Promise<boolean> {
    try {
      // 粘贴录制的代码
      await page.goto('https://mp.toutiao.com/profile_v4/graphic/publish');
      
      // 填写标题（使用实际的文章数据）
      await page.getByPlaceholder('请输入文章标题').fill(article.title);
      
      // 填写内容
      const cleanContent = this.cleanArticleContent(article.content);
      await page.locator('.ProseMirror').fill(cleanContent);
      
      // 点击发布
      await page.getByRole('button', { name: '发布' }).click();
      
      // 等待发布完成
      await page.waitForTimeout(3000);
      
      await this.log('info', '发布成功');
      return true;
    } catch (error: any) {
      await this.log('error', '发布失败', { error: error.message });
      return false;
    }
  }
}
```

---

## 🐛 常见问题

### Q1: 录制的代码太长怎么办？

**A:** 只保留关键步骤，删除不必要的操作：

```typescript
// ❌ 删除这些
await page.click('.some-element');
await page.waitForTimeout(100);
await page.hover('.menu');

// ✅ 只保留核心操作
await page.fill('#title', article.title);
await page.click('button:has-text("发布")');
```

### Q2: 选择器不稳定怎么办？

**A:** 使用更稳定的选择器：

```typescript
// ❌ 不稳定（依赖动态 class）
await page.click('.css-1234567-button');

// ✅ 更稳定（使用 text）
await page.click('text=发布');

// ✅ 最稳定（使用 role）
await page.getByRole('button', { name: '发布' }).click();
```

### Q3: 如何处理动态内容？

**A:** 添加等待：

```typescript
// 等待元素出现
await page.waitForSelector('.editor');

// 等待网络空闲
await page.goto(url, { waitUntil: 'networkidle' });

// 等待特定时间
await page.waitForTimeout(2000);
```

### Q4: 如何处理弹窗？

**A:** 监听对话框事件：

```typescript
// 自动接受确认框
page.on('dialog', dialog => dialog.accept());

// 自动拒绝确认框
page.on('dialog', dialog => dialog.dismiss());
```

### Q5: 如何处理文件上传？

**A:** 使用 setInputFiles：

```typescript
// 上传单个文件
await page.setInputFiles('input[type="file"]', 'path/to/file.jpg');

// 上传多个文件
await page.setInputFiles('input[type="file"]', [
  'path/to/file1.jpg',
  'path/to/file2.jpg'
]);
```

---

## 🎓 最佳实践

### 1. 先录制，后优化

```typescript
// 第一步：使用录制器生成基础代码
// 第二步：手动优化选择器和等待时间
// 第三步：添加错误处理和日志
```

### 2. 使用稳定的选择器

```typescript
// 优先级：
// 1. Role 选择器（最稳定）
await page.getByRole('button', { name: '发布' }).click();

// 2. Text 选择器
await page.click('text=发布');

// 3. Placeholder 选择器
await page.getByPlaceholder('请输入标题').fill('标题');

// 4. CSS 选择器（最后选择）
await page.click('.submit-button');
```

### 3. 添加适当的等待

```typescript
// ❌ 不要过度使用固定等待
await page.waitForTimeout(5000);

// ✅ 使用智能等待
await page.waitForSelector('.success-message');
await page.waitForLoadState('networkidle');
```

### 4. 处理错误

```typescript
try {
  await page.click('button:has-text("发布")');
} catch (error) {
  // 截图保存错误状态
  await page.screenshot({ path: 'error.png' });
  
  // 记录详细日志
  await this.log('error', '点击发布按钮失败', { 
    error: error.message,
    url: page.url()
  });
  
  throw error;
}
```

### 5. 添加日志

```typescript
await this.log('info', '开始发布文章');
await this.log('info', '填写标题', { title: article.title });
await this.log('info', '填写内容');
await this.log('info', '点击发布按钮');
await this.log('success', '发布成功');
```

---

## 📚 相关资源

- [Playwright 官方文档](https://playwright.dev/)
- [Playwright Codegen 文档](https://playwright.dev/docs/codegen)
- [Playwright 选择器文档](https://playwright.dev/docs/selectors)
- [项目中的 Playwright 迁移文档](./PLAYWRIGHT_MIGRATION_COMPLETED.md)
- [适配器开发快速指南](./QUICK_START_PLAYWRIGHT.md)

---

## ✅ 快速命令参考

```bash
# 基础录制
npx playwright codegen https://example.com

# 指定浏览器
npx playwright codegen --browser=chromium https://example.com

# 保存登录状态
npx playwright codegen --save-storage=auth.json https://example.com

# 使用登录状态
npx playwright codegen --load-storage=auth.json https://example.com

# 模拟设备
npx playwright codegen --device="iPhone 13" https://example.com

# 自定义视口
npx playwright codegen --viewport-size=1280,720 https://example.com
```

---

## 🎉 开始录制

现在你可以开始录制 Playwright 脚本了！

```bash
# 选择一个平台开始
npx playwright codegen https://mp.toutiao.com
```

**祝你录制愉快！** 🚀
