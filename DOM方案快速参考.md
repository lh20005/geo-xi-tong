# DOM方案快速参考

## 🎯 核心概念

**DOM直接操作** = 绕过剪贴板，直接修改页面HTML结构

## 📦 两个核心方法

### 1. buildHtmlWithImages()
**作用**：将Markdown内容转换为包含base64图片的HTML

```typescript
const serverBasePath = path.join(__dirname, '../../../');
const htmlContent = await this.buildHtmlWithImages(article, serverBasePath);
```

**输入**：
```markdown
第一段文字

![图片](/ uploads/gallery/image.png)

第二段文字
```

**输出**：
```html
<p>第一段文字</p>
<p><img src="data:image/png;base64,iVBORw0KG..." /></p>
<p>第二段文字</p>
```

### 2. setEditorContentWithDOM()
**作用**：直接设置编辑器的innerHTML

```typescript
const contentSet = await this.setEditorContentWithDOM(
  page,
  '.editor-selector',
  htmlContent
);
```

**原理**：
```typescript
await page.evaluate((selector, html) => {
  const editor = document.querySelector(selector);
  editor.innerHTML = html;
  editor.dispatchEvent(new Event('input', { bubbles: true }));
}, selector, html);
```

## 🔧 标准实现模板

```typescript
async performPublish(page: Page, article: Article, config: PublishingConfig): Promise<boolean> {
  try {
    const path = require('path');
    const selectors = this.getPublishSelectors();
    
    // 步骤1：填写标题
    await page.waitForSelector(selectors.titleInput, { timeout: 10000 });
    const title = config.title || article.title;
    await this.safeType(page, selectors.titleInput, title, { delay: 50 });
    console.log(`[平台名] ✅ 标题已填写: ${title}`);

    // 步骤2：使用DOM方案填写内容
    await page.waitForSelector(selectors.contentEditor);
    const serverBasePath = path.join(__dirname, '../../../');
    const htmlContent = await this.buildHtmlWithImages(article, serverBasePath);
    const contentSet = await this.setEditorContentWithDOM(
      page,
      selectors.contentEditor,
      htmlContent
    );
    
    // 步骤3：后备方案
    if (!contentSet) {
      console.log('[平台名] ⚠️ DOM方案失败，使用纯文本后备方案');
      await page.click(selectors.contentEditor);
      const plainContent = article.content.replace(/<[^>]*>/g, '\n').trim();
      await page.keyboard.type(plainContent, { delay: 10 });
    }

    // 步骤4：其他配置（可选）
    if (config.tags && selectors.tagsInput) {
      for (const tag of config.tags) {
        await this.safeType(page, selectors.tagsInput, tag);
        await page.keyboard.press('Enter');
      }
    }

    // 步骤5：发布
    await this.waitForPageLoad(page, 2000);
    await this.safeClick(page, selectors.publishButton);

    // 步骤6：验证
    const success = await this.verifyPublishSuccess(page);
    if (success) {
      console.log('✅ [平台名]文章发布成功');
    }
    return success;
  } catch (error: any) {
    console.error('❌ [平台名]文章发布失败:', error.message);
    return false;
  }
}
```

## 🎨 特殊情况处理

### iframe编辑器（如微信公众号）

```typescript
const iframeElement = await page.$(selectors.contentEditor);
if (iframeElement) {
  const frame = await iframeElement.contentFrame();
  if (frame) {
    const serverBasePath = path.join(__dirname, '../../../');
    const htmlContent = await this.buildHtmlWithImages(article, serverBasePath);
    
    await frame.evaluate((html: string) => {
      const body = document.body;
      if (body) {
        body.innerHTML = html;
        body.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, htmlContent);
  }
}
```

### 富文本编辑器（如Quill）

```typescript
// 选择器通常是 .ql-editor
const selectors = {
  contentEditor: '.ql-editor'
};

// 使用标准DOM方案即可
await this.setEditorContentWithDOM(page, '.ql-editor', htmlContent);
```

### ProseMirror编辑器（如头条号）

```typescript
// 选择器通常是 .ProseMirror
const selectors = {
  contentEditor: '.ProseMirror'
};

// 使用标准DOM方案即可
await this.setEditorContentWithDOM(page, '.ProseMirror', htmlContent);
```

## 🐛 调试技巧

### 1. 查看生成的HTML

```typescript
console.log('[DEBUG] HTML内容:', htmlContent.substring(0, 500));
```

### 2. 验证选择器

```typescript
const exists = await page.$(selector);
console.log(`[DEBUG] 选择器 ${selector} 存在:`, !!exists);
```

### 3. 截图保存

```typescript
await page.screenshot({ 
  path: `debug-${Date.now()}.png`,
  fullPage: true 
});
```

### 4. 查看实际内容

```typescript
const actualContent = await page.evaluate((sel) => {
  const editor = document.querySelector(sel);
  return editor ? editor.innerHTML : null;
}, selector);
console.log('[DEBUG] 实际内容:', actualContent);
```

## ⚡ 性能优化

### 1. 图片大小限制

```typescript
// 在 buildHtmlWithImages 中添加
const stats = await fs.stat(fullPath);
if (stats.size > 5 * 1024 * 1024) { // 5MB
  console.warn(`图片过大，跳过: ${imagePath}`);
  continue;
}
```

### 2. 并发处理

```typescript
// 如果有多张图片，可以并发读取
const imagePromises = images.map(async (imagePath) => {
  const buffer = await fs.readFile(imagePath);
  return buffer.toString('base64');
});
const base64Images = await Promise.all(imagePromises);
```

### 3. 缓存base64

```typescript
// 如果同一图片多次使用，可以缓存
const imageCache = new Map<string, string>();
```

## 📋 检查清单

新平台接入时的检查项：

- [ ] 获取正确的登录URL
- [ ] 获取正确的发布页面URL
- [ ] 确认标题输入框选择器
- [ ] 确认内容编辑器选择器（最重要！）
- [ ] 确认发布按钮选择器
- [ ] 测试Cookie登录
- [ ] 测试标题填写
- [ ] 测试DOM内容设置
- [ ] 测试图片显示
- [ ] 测试发布流程
- [ ] 验证发布成功

## 🎓 关键要点

1. **选择器是关键**：90%的问题都是选择器不正确
2. **等待很重要**：给页面足够的加载时间
3. **事件必须触发**：`input` 和 `change` 事件让编辑器知道内容变化
4. **后备方案**：DOM失败时有纯文本方案
5. **日志详细**：每步都记录，便于排查问题

## 🔗 相关文件

- `server/src/services/adapters/PlatformAdapter.ts` - 基类实现
- `server/src/services/adapters/ToutiaoAdapter.ts` - 完整参考
- `头条号自动发布-经验总结.md` - 详细技术文档

## 💡 成功案例

头条号实现证明了DOM方案的可行性：
- ✅ 4MB PNG图片成功转换为5.5MB base64
- ✅ 图片在编辑器中正常显示
- ✅ 完整的11步发布流程全部自动化
- ✅ 绕过了所有剪贴板限制

这个方案现在已应用到所有12个平台！
