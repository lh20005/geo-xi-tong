# 简书新标签页处理修复

## 问题描述

简书点击"写文章"按钮会打开新标签页，需要正确处理页面切换。

## 解决方案

### 第一步：等待并捕获新标签页

```typescript
// 第一步：点击"写文章"并等待新标签页打开
await this.log('info', '第一步：点击写文章按钮（会打开新标签页）');
await this.standardWait(); // 点击前等待 3-5秒

const page1Promise = page.waitForEvent('popup');
await page.getByRole('link', { name: '写文章' }).click();
await this.log('info', '已点击: 写文章按钮');

const page1 = await page1Promise;
await this.log('info', '新标签页已打开，切换到编辑器页面');
await this.standardWait(); // 等待新页面加载 3-5秒

// 后续操作都在新页面 page1 上进行
page = page1;
```

### 关键技术点

1. **waitForEvent('popup')**：在点击前设置监听器，等待新标签页打开
2. **getByRole('link', { name: '写文章' })**：使用语义化选择器定位链接
3. **页面切换**：将 page 变量指向新打开的 page1，后续操作都在新页面上进行

### 完整流程

1. **第一步**：点击"写文章"并等待新标签页打开（3-5秒）
2. **第二步**：填写标题（3-5秒）
3. **第三步**：填写正文（3-5秒）
4. **第四步**：上传图片（如果有）（3-5秒）
5. **第五步**：点击发布按钮（3-5秒）
6. **第六步**：处理发布设置弹窗（3-5秒）

### 发布页面URL

- **getPublishUrl()**：返回 `https://www.jianshu.com/`（首页）
- 从首页点击"写文章"进入编辑器（新标签页）

## Playwright 新标签页处理最佳实践

### 方法1：使用 waitForEvent('popup')（推荐）

```typescript
const popupPromise = page.waitForEvent('popup');
await page.click('selector');
const newPage = await popupPromise;
```

**优点**：
- 可靠性高，不会错过新标签页
- 代码简洁清晰
- 自动等待新页面加载

### 方法2：使用 context.waitForEvent('page')

```typescript
const [newPage] = await Promise.all([
  context.waitForEvent('page'),
  page.click('selector')
]);
```

**优点**：
- 可以同时处理多个新标签页
- 适合复杂场景

### 方法3：使用 page.context().pages()

```typescript
await page.click('selector');
await page.waitForTimeout(1000);
const pages = page.context().pages();
const newPage = pages[pages.length - 1];
```

**缺点**：
- 需要手动等待
- 可能不够可靠
- 不推荐使用

## 注意事项

1. **必须在点击前设置监听器**：`waitForEvent('popup')` 必须在 `click()` 之前调用
2. **等待页面加载**：新标签页打开后需要等待 3-5秒让页面完全加载
3. **页面切换**：后续所有操作都要在新页面上进行
4. **保持节奏**：每个操作间隔 3-5秒，模拟真实人类行为

## 测试建议

1. 验证新标签页是否正确打开
2. 验证页面切换是否成功
3. 验证后续操作是否在新页面上执行
4. 验证发布流程是否完整

## 参考资料

- [Playwright 官方文档 - Pages](https://playwright.dev/docs/pages)
- [Playwright 官方文档 - Multi-page scenarios](https://playwright.dev/docs/multi-pages)
