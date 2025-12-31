# Playwright 录制脚本中的图片上传处理指南

## 问题描述

使用 Playwright 录制器录制操作时，到了上传图片的步骤：
- 录制器只能记录你点击上传按钮和选择文件的动作
- 但录制的是固定的文件路径，无法动态上传文章中的图片
- 需要改造成从文章内容中提取图片并上传

## 解决方案

### 步骤 1：正常录制（包含图片上传）

在录制时：
1. 点击上传按钮
2. **随便选择一张图片**（只是为了让录制器记录这个步骤）
3. 完成后续操作

录制器会生成类似代码：
```typescript
await page.getByRole('button', { name: 'Choose File' }).setInputFiles('C:\\Users\\xxx\\test.jpg');
```

### 步骤 2：识别上传按钮的选择器

从录制代码中提取上传按钮的选择器：
```typescript
// 可能的形式：
page.getByRole('button', { name: 'Choose File' })
page.locator('input[type="file"]')
page.getByText('上传图片')
// ... 等等
```

### 步骤 3：改造成动态上传方法

将固定路径改造成动态方法：

```typescript
/**
 * 上传图片（通用模板）
 */
private async uploadImages(page: Page, article: Article): Promise<void> {
  try {
    // 1. 从文章内容中提取图片
    const images = this.extractImagesFromContent(article.content);
    
    if (images.length === 0) {
      await this.log('warning', '文章中没有图片');
      return; // 或者 throw new Error() 如果图片是必需的
    }

    await this.log('info', `找到 ${images.length} 张图片`);

    // 2. 根据平台要求上传图片
    // 有些平台只需要一张，有些需要多张
    
    // 示例：上传第一张图片
    const imagePath = this.resolveImagePath(images[0]);
    
    // 检查文件是否存在
    if (!fs.existsSync(imagePath)) {
      throw new Error(`图片文件不存在: ${imagePath}`);
    }

    // 3. 使用录制时找到的选择器
    // 👇 这里使用你录制时得到的选择器
    const fileInput = page.getByRole('button', { name: 'Choose File' });
    
    // 4. 上传文件
    await fileInput.setInputFiles(imagePath);
    await this.log('info', '图片上传完成');
    
    // 5. 等待上传完成
    await page.waitForTimeout(2000);

  } catch (error: any) {
    await this.log('error', '图片上传失败', { error: error.message });
    throw error;
  }
}

/**
 * 从文章内容中提取图片路径
 */
private extractImagesFromContent(content: string): string[] {
  const images: string[] = [];
  
  // 匹配 Markdown 图片: ![alt](path)
  const markdownRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let match;
  
  while ((match = markdownRegex.exec(content)) !== null) {
    images.push(match[2]);
  }
  
  // 匹配 HTML 图片: <img src="path">
  const htmlRegex = /<img[^>]+src=["']([^"']+)["']/g;
  
  while ((match = htmlRegex.exec(content)) !== null) {
    images.push(match[1]);
  }
  
  return images;
}

/**
 * 解析图片路径为绝对路径
 */
private resolveImagePath(imagePath: string): string {
  // URL 不处理
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }

  // 绝对路径直接返回
  if (path.isAbsolute(imagePath)) {
    return imagePath;
  }

  // 相对路径处理（根据你的项目结构调整）
  if (imagePath.startsWith('/uploads/')) {
    return path.resolve(process.cwd(), 'server', imagePath.substring(1));
  }
  
  if (imagePath.startsWith('uploads/')) {
    return path.resolve(process.cwd(), 'server', imagePath);
  }

  return path.resolve(process.cwd(), 'server', imagePath);
}
```

### 步骤 4：在发布方法中调用

```typescript
async performPublish(page: Page, article: Article, config: PublishingConfig): Promise<boolean> {
  try {
    // ... 前面的步骤 ...
    
    // 👇 在需要上传图片的地方调用
    await this.uploadImages(page, article);
    
    // ... 后续步骤 ...
    
  } catch (error) {
    // 错误处理
  }
}
```

## 特殊情况处理

### 情况 1：需要先点击按钮再上传

有些平台需要先点击触发文件选择对话框：

```typescript
// 先点击
await page.getByRole('button', { name: 'Choose File' }).click();
await page.waitForTimeout(500);

// 再设置文件
await page.getByRole('button', { name: 'Choose File' }).setInputFiles(imagePath);
```

### 情况 2：上传多张图片

```typescript
// 方式 1：一次性上传多张
const imagePaths = images.map(img => this.resolveImagePath(img));
await fileInput.setInputFiles(imagePaths);

// 方式 2：逐张上传
for (const image of images) {
  const imagePath = this.resolveImagePath(image);
  await fileInput.setInputFiles(imagePath);
  await page.waitForTimeout(1000);
}
```

### 情况 3：隐藏的 file input

有些平台的文件上传按钮是隐藏的：

```typescript
// 直接定位 input[type="file"]
const fileInput = page.locator('input[type="file"]');
await fileInput.setInputFiles(imagePath);
```

## 调试技巧

### 1. 打印图片路径

```typescript
await this.log('info', '图片路径', { 
  original: images[0],
  resolved: imagePath,
  exists: fs.existsSync(imagePath)
});
```

### 2. 截图保存状态

```typescript
// 上传前
await page.screenshot({ path: 'before-upload.png' });

// 上传后
await page.screenshot({ path: 'after-upload.png' });
```

### 3. 检查选择器是否正确

```typescript
const fileInput = page.getByRole('button', { name: 'Choose File' });
const isVisible = await fileInput.isVisible();
await this.log('info', '上传按钮可见性', { isVisible });
```

## 完整示例：小红书图片上传

```typescript
/**
 * 上传图片到小红书
 */
private async uploadImages(page: Page, article: Article): Promise<void> {
  // 1. 提取图片
  const images = this.extractImagesFromContent(article.content);
  
  if (images.length === 0) {
    throw new Error('小红书必须上传图片');
  }

  // 2. 解析路径
  const imagePath = this.resolveImagePath(images[0]);
  
  if (!fs.existsSync(imagePath)) {
    throw new Error(`图片不存在: ${imagePath}`);
  }

  // 3. 上传（小红书需要先点击再设置）
  const fileButton = page.getByRole('button', { name: 'Choose File' });
  await fileButton.click();
  await page.waitForTimeout(500);
  await fileButton.setInputFiles(imagePath);
  
  // 4. 等待上传完成
  await page.waitForTimeout(3000);
  
  await this.log('info', '✅ 图片上传完成');
}
```

## 总结

1. **录制时**：正常操作，随便选择一张图片
2. **录制后**：提取选择器，改造成动态方法
3. **关键点**：
   - 从 `article.content` 中提取图片路径
   - 将相对路径转换为绝对路径
   - 使用 `setInputFiles()` 方法上传
   - 根据平台特性调整（是否需要先点击等）

这样，你的代码就能自动从文章内容中提取图片并上传到对应平台了！
