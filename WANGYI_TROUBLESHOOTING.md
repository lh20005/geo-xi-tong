# 网易号发布问题排查指南

## 当前问题

### 错误信息
```
第五步：点击图片按钮
ERROR 发布失败
{
  "error": "locator.click: Timeout 30000ms exceeded.
  Call log:
  - waiting for getByRole('button', { name: '图片' })"
}
```

### 问题分析
在第五步尝试点击"图片"按钮时超时，说明页面上找不到这个按钮，可能的原因：

1. **按钮还未加载**: 页面加载较慢，按钮还没有出现
2. **选择器不匹配**: 按钮的实际属性与选择器不符
3. **按钮被隐藏**: 按钮存在但不可见
4. **页面结构变化**: 网易号更新了页面结构

## 排查步骤

### 步骤1: 运行调试脚本

```bash
node scripts/debug-wangyi-step-by-step.js
```

这个脚本会：
- 在每一步截图
- 尝试多种方式查找"图片"按钮
- 列出页面上所有可见的按钮

### 步骤2: 检查截图

查看生成的截图文件：
```
wangyi-debug-screenshots/
├── step-0-initial.png          # 初始页面
├── step-0-after-login.png      # 登录后
├── step-1-clicked-button.png   # 点击第一个按钮后
├── step-2-clicked-article.png  # 点击"文章"后
├── step-3-filled-title.png     # 输入标题后
├── step-4-filled-content.png   # 输入正文后
├── step-5-before-image-button.png  # 查找图片按钮前
└── step-5-after-image-button.png   # 查找图片按钮后
```

### 步骤3: 分析按钮列表

调试脚本会输出页面上所有可见按钮的文本，例如：
```
📋 列出页面上所有按钮:
  [0] "发布"
  [1] "保存草稿"
  [2] "图片"
  [3] "视频"
  ...
```

找到"图片"按钮的实际文本和位置。

## 可能的解决方案

### 方案1: 增加等待时间

如果按钮加载较慢，增加等待时间：

```typescript
// 在第四步和第五步之间增加等待
await page.waitForTimeout(5000); // 等待5秒

// 然后再查找按钮
await page.getByRole('button', { name: '图片' }).click();
```

### 方案2: 使用备用选择器

如果 `getByRole` 不工作，尝试其他选择器：

```typescript
// 方法1: 使用文本选择器
await page.getByText('图片', { exact: true }).click();

// 方法2: 使用 locator
await page.locator('button:has-text("图片")').first().click();

// 方法3: 使用 CSS 选择器
await page.locator('button[title="图片"]').click();

// 方法4: 使用 XPath
await page.locator('//button[contains(text(), "图片")]').click();
```

### 方案3: 等待按钮可见

确保按钮可见后再点击：

```typescript
const imageButton = page.getByRole('button', { name: '图片' });
await imageButton.waitFor({ state: 'visible', timeout: 15000 });
await imageButton.click();
```

### 方案4: 使用容错机制

尝试多种方法，直到成功：

```typescript
async function clickImageButton(page) {
  const methods = [
    () => page.getByRole('button', { name: '图片' }).click(),
    () => page.getByText('图片', { exact: true }).click(),
    () => page.locator('button:has-text("图片")').first().click(),
    () => page.locator('[title="图片"]').click(),
  ];

  for (let i = 0; i < methods.length; i++) {
    try {
      await methods[i]();
      console.log(`✅ 方法${i + 1}成功`);
      return true;
    } catch (error) {
      console.log(`⚠️ 方法${i + 1}失败: ${error.message}`);
    }
  }

  throw new Error('所有方法都失败了');
}
```

## 已实施的修复

当前代码已经实施了容错机制：

```typescript
// 第五步：点击"图片"按钮
await this.log('info', '第五步：点击图片按钮');
await page.waitForTimeout(2000); // 等待页面稳定

try {
  // 方法1: 使用 getByRole
  const imageButton = page.getByRole('button', { name: '图片' });
  await imageButton.waitFor({ state: 'visible', timeout: 10000 });
  await imageButton.click();
  await this.log('info', '已点击: 图片按钮');
} catch (error) {
  await this.log('warning', '方法1失败，尝试备用选择器');
  try {
    // 方法2: 使用 getByText
    await page.getByText('图片', { exact: true }).click();
    await this.log('info', '已点击: 图片按钮（备用方式1）');
  } catch (error2) {
    await this.log('warning', '方法2失败，尝试第三种方式');
    // 方法3: 使用 locator
    await page.locator('button:has-text("图片")').first().click();
    await this.log('info', '已点击: 图片按钮（备用方式2）');
  }
}
```

## 下一步行动

1. **运行调试脚本**: `node scripts/debug-wangyi-step-by-step.js`
2. **查看截图**: 检查 `wangyi-debug-screenshots/` 目录
3. **分析按钮列表**: 找到"图片"按钮的实际文本
4. **更新选择器**: 根据实际情况更新代码中的选择器
5. **重新测试**: 运行完整的发布测试

## 常见问题

### Q: 为什么会超时？
A: Playwright 默认等待30秒，如果在这个时间内找不到元素就会超时。

### Q: 如何增加超时时间？
A: 在选择器后添加 `{ timeout: 60000 }` 参数：
```typescript
await page.getByRole('button', { name: '图片' }).click({ timeout: 60000 });
```

### Q: 如何查看页面的实际HTML？
A: 在调试脚本中添加：
```typescript
const html = await page.content();
console.log(html);
```

### Q: 如何在浏览器中手动测试选择器？
A: 在浏览器控制台中运行：
```javascript
// 测试选择器是否能找到元素
document.querySelectorAll('button:has-text("图片")');
```

## 联系支持

如果问题仍然存在，请提供：
1. 调试脚本的完整输出
2. 所有截图文件
3. 按钮列表输出
4. 错误日志

---

**创建日期**: 2025-01-03  
**最后更新**: 2025-01-03  
**状态**: 🔍 排查中
