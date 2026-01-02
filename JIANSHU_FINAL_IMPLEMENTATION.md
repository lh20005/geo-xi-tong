# 简书适配器最终实现

## 完整发布流程（8步）

### 第一步：点击"写文章"并等待新标签页打开

```typescript
const page1Promise = page.waitForEvent('popup');
await page.getByRole('link', { name: '写文章' }).click();
const page1 = await page1Promise;
```

**说明**：
- 从简书首页点击"写文章"链接
- 会打开新标签页
- 使用 `waitForEvent('popup')` 捕获新标签页
- 后续操作都在 `page1` 上进行

**等待时间**：点击前 3-5秒，打开后 3-5秒

---

### 第二步：新建文章

```typescript
await page1.getByText('新建文章', { exact: true }).click();
```

**说明**：
- 在编辑器页面点击"新建文章"按钮
- 使用 `exact: true` 精确匹配文本

**等待时间**：点击前 3-5秒，点击后 3-5秒

---

### 第三步：点击标题输入框

```typescript
await page1.getByRole('textbox').nth(1).click();
```

**说明**：
- 定位到第二个文本框（索引为1）
- 第一个文本框（索引0）可能是其他输入框

**等待时间**：点击前 3-5秒，点击后 3-5秒

---

### 第四步：删除原有文字并填写标题

```typescript
await page1.getByRole('textbox').nth(1).fill('');
await page1.waitForTimeout(1000);
await page1.getByRole('textbox').nth(1).fill(article.title);
```

**说明**：
- 先清空原有文字（可能有默认标题）
- 短暂等待 1秒
- 填写文章标题

**等待时间**：操作前 3-5秒，输入后 3-5秒

---

### 第五步：点击正文输入框并填写内容

```typescript
await page1.locator('.kalamu-area').click();
await page1.keyboard.type(cleanContent, { delay: 50 });
```

**说明**：
- 点击正文编辑器（`.kalamu-area`）
- 使用 `keyboard.type` 模拟真实输入
- 每个字符间隔 50ms

**等待时间**：点击前 3-5秒，点击后 3-5秒，输入后 3-5秒

---

### 第六步：点击图片上传按钮

```typescript
await page1.locator('.fa.fa-picture-o').click();
```

**说明**：
- 点击图片上传图标（Font Awesome 图标）
- 只有在文章有图片时才执行此步骤

**等待时间**：点击前 3-5秒，点击后 3-5秒

---

### 第七步：上传图片（不弹出对话框）

```typescript
const fileChooserPromise = page.waitForEvent('filechooser');
await page.getByText('点击上传（可多张）').click();
const fileChooser = await fileChooserPromise;
await fileChooser.setFiles(fullPath);
```

**说明**：
- **必须在点击之前**设置 `waitForEvent('filechooser')`
- 点击"点击上传（可多张）"按钮
- 点击后立即等待 `fileChooserPromise`
- 使用 `fileChooser.setFiles()` 设置文件
- **对话框不会显示给用户**（自动处理）

**等待时间**：点击前 3-5秒，上传后 3-5秒

---

### 第八步：点击发布文章

```typescript
await page1.getByText('发布文章').click();
```

**说明**：
- 点击"发布文章"按钮完成发布
- 等待发布结果验证

**等待时间**：点击前 3-5秒，点击后 3-5秒

---

## 关键技术点

### 1. 新标签页处理

```typescript
// ✅ 正确方式
const page1Promise = page.waitForEvent('popup');
await page.click('selector');
const page1 = await page1Promise;
```

**要点**：
- 必须在点击前设置监听器
- 使用 `waitForEvent('popup')` 捕获新标签页
- 后续操作都在新页面上进行

### 2. 文件上传（不弹出对话框）

```typescript
// ✅ 正确方式
const fileChooserPromise = page.waitForEvent('filechooser');
await page.click('upload-button');
const fileChooser = await fileChooserPromise;
await fileChooser.setFiles(filePath);
```

**要点**：
- 必须在点击前设置 `waitForEvent('filechooser')`
- 点击后立即等待 `fileChooserPromise`
- 使用 `fileChooser.setFiles()` 设置文件
- 对话框不会显示，自动处理

### 3. 精确文本匹配

```typescript
// ✅ 使用 exact: true 精确匹配
await page.getByText('新建文章', { exact: true }).click();
```

**要点**：
- 避免匹配到包含该文本的其他元素
- 确保点击正确的按钮

### 4. 索引定位

```typescript
// ✅ 使用 nth() 定位特定元素
await page.getByRole('textbox').nth(1).click();
```

**要点**：
- 索引从 0 开始
- `nth(1)` 表示第二个元素

### 5. 人性化操作间隔

```typescript
// ✅ 每个操作前后都有 3-5秒等待
await this.standardWait(); // 3-5秒
await page.click('selector');
await this.standardWait(); // 3-5秒
```

**要点**：
- 模拟真实人类操作
- 避免被检测为机器人
- 给页面足够的响应时间

## 完整代码结构

```typescript
async performPublish(page: Page, article: Article, config: PublishingConfig): Promise<boolean> {
  try {
    // 第一步：打开新标签页
    const page1Promise = page.waitForEvent('popup');
    await page.getByRole('link', { name: '写文章' }).click();
    const page1 = await page1Promise;
    
    // 第二步：新建文章
    await page1.getByText('新建文章', { exact: true }).click();
    
    // 第三步：点击标题
    await page1.getByRole('textbox').nth(1).click();
    
    // 第四步：填写标题
    await page1.getByRole('textbox').nth(1).fill('');
    await page1.getByRole('textbox').nth(1).fill(article.title);
    
    // 第五步：填写正文
    await page1.locator('.kalamu-area').click();
    await page1.keyboard.type(cleanContent, { delay: 50 });
    
    // 第六步：点击图片上传
    await page1.locator('.fa.fa-picture-o').click();
    
    // 第七步：上传图片
    const fileChooserPromise = page1.waitForEvent('filechooser');
    await page1.getByText('点击上传（可多张）').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(fullPath);
    
    // 第八步：发布文章
    await page1.getByText('发布文章').click();
    
    return true;
  } catch (error) {
    return false;
  }
}
```

## 错误处理

### 1. 图片上传失败

```typescript
try {
  const images = this.extractImagesFromContent(article.content);
  if (images.length > 0) {
    await this.uploadImageWithFileChooser(page1, images[0]);
  } else {
    await this.log('info', '文章中没有图片，跳过第六步和第七步');
  }
} catch (error: any) {
  await this.log('warning', '图片上传失败，继续发布流程', { error: error.message });
}
```

**策略**：
- 图片上传失败不影响发布流程
- 记录警告日志
- 继续执行后续步骤

### 2. 文件不存在

```typescript
if (!fs.existsSync(fullPath)) {
  await this.log('warning', '图片文件不存在', { path: fullPath });
  return;
}
```

**策略**：
- 检查文件是否存在
- 不存在则跳过上传
- 不抛出错误

## 测试建议

### 1. 正常流程测试

- ✅ 新标签页是否正确打开
- ✅ 标题是否正确填写
- ✅ 正文是否正确填写
- ✅ 图片是否成功上传
- ✅ 文章是否成功发布

### 2. 边界情况测试

- ✅ 没有图片的文章
- ✅ 图片文件不存在
- ✅ 标题过长
- ✅ 正文过长
- ✅ 网络延迟

### 3. 错误恢复测试

- ✅ 图片上传失败后继续发布
- ✅ 页面加载慢的情况
- ✅ 元素未找到的情况

## 与其他平台的对比

### 小红书
- 直接在当前页面操作
- 不需要新标签页

### 抖音
- 直接在当前页面操作
- 使用文件选择器上传图片

### 简书（本实现）
- 需要打开新标签页
- 需要点击"新建文章"
- 需要清空默认标题
- 使用 fileChooser 上传图片

## 总结

### 核心特点

1. **8步流程**：从打开新标签页到发布文章
2. **新标签页处理**：正确捕获和切换到新页面
3. **文件上传**：使用 fileChooser 不弹出对话框
4. **人性化间隔**：每个操作间隔 3-5秒
5. **错误容错**：图片上传失败不影响发布

### 关键技术

- `waitForEvent('popup')` - 捕获新标签页
- `waitForEvent('filechooser')` - 处理文件上传
- `getByText(..., { exact: true })` - 精确文本匹配
- `nth(index)` - 索引定位
- `keyboard.type(..., { delay: 50 })` - 模拟真实输入

### 成功要素

- 准确的选择器
- 正确的操作顺序
- 合理的等待时间
- 完善的错误处理
- 详细的日志记录
