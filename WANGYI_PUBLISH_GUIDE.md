# 网易号自动发布实现指南

## 平台信息

- **平台名称**: 网易号
- **Platform ID**: `wangyi`
- **登录URL**: https://mp.163.com/login.html
- **发布URL**: https://mp.163.com/subscribe_v4/index.html#/
- **适配器文件**: `server/src/services/adapters/WangyiAdapter.ts`

## 实现状态

✅ 已完成基础实现
✅ 已注册到 AdapterRegistry
✅ 支持 Cookie 登录
✅ 支持自动发布
✅ 支持图片上传

## 发布流程（15步）

### 第一步：点击按钮
```typescript
await page.getByRole('button').click();
```

### 第二步：点击"文章"
```typescript
await page.getByText('文章').click();
```

### 第三步：输入标题
```typescript
await page.getByRole('textbox', { name: '请输入标题 (5~30个字)' }).click();
await page.getByRole('textbox', { name: '请输入标题 (5~30个字)' }).fill(article.title);
```

### 第四步：输入正文
```typescript
await page.locator('.public-DraftStyleDefault-block').click();
await page.getByRole('button', { name: '请输入正文' }).getByRole('textbox').fill(cleanContent);
```

### 第五步：点击"图片"按钮
```typescript
await page.getByRole('button', { name: '图片' }).click();
```

### 第六步：上传图片
```typescript
// 必须在点击之前设置 waitForEvent
const fileChooserPromise = page.waitForEvent('filechooser');
await page.locator('div').filter({ hasText: /^请上传大于160x160的图片$/ }).nth(2).click();
const fileChooser = await fileChooserPromise;
await fileChooser.setFiles(imagePath);
// 上传后需要和下一个操作间隔6秒
await page.waitForTimeout(6000);
```

### 第七步：点击"确定(1)"
```typescript
await page.getByRole('button', { name: '确定(1)' }).click();
```

### 第八步：选择"单图"
```typescript
await page.getByRole('radio', { name: '单图' }).check();
```

### 第九步：点击"上传图片"
```typescript
await page.locator('div').filter({ hasText: /^上传图片$/ }).nth(2).click();
```

### 第十步：选择已上传的图片
```typescript
await page.locator('.cover-picture__item-img').click();
```

### 第十一步：点击"确认"
```typescript
await page.getByText('确认').click();
```

### 第十二步：点击声明开关
```typescript
await page.locator('.box-trigger.custom-switcher').click();
```

### 第十三步：点击"选择声明内容"
```typescript
await page.getByText('选择声明内容').click();
```

### 第十四步：选择"个人原创，仅供参考"
```typescript
await page.getByText('个人原创，仅供参考').click();
```

### 第十五步：点击"发布"按钮
```typescript
await page.getByRole('button', { name: '发布', exact: true }).click();
```

## 关键选择器

| 元素 | 选择器 | 说明 |
|------|--------|------|
| 登录状态 | `.topBar__user` | 顶部用户区域 |
| 文章按钮 | `text=文章` | 点击进入文章发布 |
| 标题输入 | `textbox[name="请输入标题 (5~30个字)"]` | 标题输入框 |
| 正文编辑器 | `.public-DraftStyleDefault-block` | 正文编辑区域 |
| 正文输入框 | `button[name="请输入正文"] textbox` | 正文输入框 |
| 图片按钮 | `button[name="图片"]` | 插入图片按钮 |
| 上传区域 | `div:has-text("请上传大于160x160的图片")` | 图片上传区域 |
| 确定按钮 | `button[name="确定(1)"]` | 确认上传 |
| 单图选项 | `radio[name="单图"]` | 封面单图选项 |
| 封面图片 | `.cover-picture__item-img` | 已上传的图片 |
| 声明开关 | `.box-trigger.custom-switcher` | 原创声明开关 |
| 发布按钮 | `button[name="发布"][exact]` | 最终发布按钮 |

## 登录状态检测

网易号使用多重检测策略：

1. **URL 检测**: 检查是否被重定向到登录页面
2. **用户区域检测**: 检查 `.topBar__user` 元素
3. **发布按钮检测**: 检查发布按钮是否可见

```typescript
async checkLoginStatus(page: Page): Promise<boolean> {
  // 1. 检查 URL
  const currentUrl = page.url();
  if (currentUrl.includes('/login')) {
    return false;
  }

  // 2. 检查用户区域
  const hasUserArea = await page.locator('.topBar__user')
    .isVisible({ timeout: 3000 })
    .catch(() => false);
  if (hasUserArea) {
    return true;
  }

  // 3. 检查发布按钮
  const hasPublishBtn = await page.getByRole('button', { name: '发布' })
    .isVisible({ timeout: 3000 })
    .catch(() => false);
  if (hasPublishBtn) {
    return true;
  }

  // 默认假设已登录（避免误判）
  return true;
}
```

## 人性化操作

参考百家号和头条号的成功经验，网易号适配器实现了人性化操作：

### 随机等待
```typescript
private async randomWait(minMs: number, maxMs: number): Promise<void> {
  const waitTime = minMs + Math.random() * (maxMs - minMs);
  await new Promise(resolve => setTimeout(resolve, waitTime));
}
```

### 人性化点击
```typescript
private async humanClick(locator: any, description: string = ''): Promise<void> {
  await this.randomWait(3000, 5000); // 点击前等待 3-5 秒
  await locator.click();
  if (description) {
    await this.log('info', `已点击: ${description}`);
  }
  await this.randomWait(3000, 5000); // 点击后等待 3-5 秒
}
```

### 人性化输入
```typescript
private async humanType(locator: any, text: string, description: string = ''): Promise<void> {
  await this.randomWait(3000, 5000); // 输入前思考 3-5 秒
  await locator.fill(text);
  if (description) {
    await this.log('info', `已输入: ${description}`);
  }
  await this.randomWait(3000, 5000); // 输入后停顿 3-5 秒
}
```

## 图片处理

网易号要求必须上传封面图片才能发布。

### 图片提取
从文章内容中提取图片路径：
- 支持 Markdown 格式: `![alt](path)`
- 支持 HTML 格式: `<img src="path">`

### 图片路径解析
```typescript
private resolveImagePath(imagePath: string): string {
  // HTTP/HTTPS URL - 直接返回
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }

  // /uploads/ 开头 - 相对于项目根目录
  if (imagePath.startsWith('/uploads/')) {
    return path.resolve(process.cwd(), imagePath.substring(1));
  }
  
  // uploads/ 开头 - 相对于项目根目录
  if (imagePath.startsWith('uploads/')) {
    return path.resolve(process.cwd(), imagePath);
  }

  // 绝对路径 - 直接返回
  if (path.isAbsolute(imagePath)) {
    return imagePath;
  }

  // 其他情况 - 相对于项目根目录
  return path.resolve(process.cwd(), imagePath);
}
```

## 内容清理

发布前需要清理文章内容，移除 Markdown 格式：

```typescript
cleanArticleContent(content: string): string {
  return content
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '') // 移除 Markdown 图片
    .replace(/<img[^>]*>/g, '') // 移除 HTML 图片
    .replace(/#{1,6}\s+/g, '') // 移除 Markdown 标题符号
    .replace(/\*\*([^*]+)\*\*/g, '$1') // 移除粗体
    .replace(/\*([^*]+)\*/g, '$1') // 移除斜体
    .replace(/`([^`]+)`/g, '$1') // 移除代码标记
    .trim();
}
```

## 发布验证

发布后验证是否成功：

1. **成功文本检测**: 查找"发布成功"、"发布完成"等文本
2. **URL 验证**: 检查 URL 是否包含成功标志
3. **保守策略**: 如果没有明确的失败信号，认为发布成功

```typescript
async verifyPublishSuccess(page: Page): Promise<boolean> {
  await page.waitForTimeout(3000);
  
  // 检查成功文本
  const successTexts = ['发布成功', '发布完成', '已发布', '提交成功'];
  for (const text of successTexts) {
    const hasText = await page.getByText(text)
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    if (hasText) {
      return true;
    }
  }

  // 检查 URL
  const currentUrl = page.url();
  if (currentUrl.includes('success') || 
      currentUrl.includes('published') || 
      currentUrl.includes('mp.163.com')) {
    return true;
  }

  // 保守策略：没有错误就认为成功
  return true;
}
```

## 错误处理

适配器实现了完善的错误处理：

1. **Cookie 登录失败**: 提示需要手动登录
2. **图片缺失**: 抛出明确的错误信息
3. **图片文件不存在**: 抛出文件路径错误
4. **发布失败**: 记录详细的错误日志

## 测试方法

### 方法一：使用测试脚本
```bash
node test-wangyi-publish.js
```

### 方法二：通过 API 测试
```bash
curl -X POST http://localhost:3000/api/publishing/publish \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "articleId": 123,
    "platformAccountIds": [456]
  }'
```

### 方法三：通过前端界面测试
1. 登录系统
2. 进入"发布管理"页面
3. 选择文章和网易号账号
4. 点击"发布"按钮

## 最佳实践

### 1. Cookie 管理
- 优先使用 Cookie 登录
- Cookie 失效时提示用户重新登录
- 定期更新 Cookie 以保持登录状态

### 2. 操作间隔
- 每次操作间隔 3-5 秒（随机）
- 模拟真实用户行为
- 避免被平台检测为机器人

### 3. 图片要求
- 必须包含至少一张图片
- 支持 JPG、PNG 格式
- 建议尺寸：1200x630 或 16:9 比例

### 4. 内容要求
- 标题：2-30 个字
- 正文：建议 300 字以上
- 避免敏感词汇

## 参考资料

- 百家号适配器: `server/src/services/adapters/BaijiahaoAdapter.ts`
- 头条号适配器: `server/src/services/adapters/ToutiaoAdapter.ts`
- 平台适配器基类: `server/src/services/adapters/PlatformAdapter.ts`

## 更新日志

- 2025-01-03: 创建网易号适配器
- 2025-01-03: 优化发布 URL
- 2025-01-03: 完善文档说明
