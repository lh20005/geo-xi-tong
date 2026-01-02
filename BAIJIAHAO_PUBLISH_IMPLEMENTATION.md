# 百家号自动发布实现

## 实现日期
2026-01-02

## 实现概述
基于 Playwright 录制脚本和成功平台（抖音、小红书）的经验，实现了百家号的自动发布功能。

## 发布流程（9个步骤）

### 第一步：点击"发布图文"
```typescript
page.locator('div').filter({ hasText: /^发布图文$/ }).first().click()
```

### 第二步：点击图文类型按钮
```typescript
page.getByRole('button').filter({ hasText: /^$/ }).click()
```

### 第三步：输入标题
```typescript
// 点击标题输入框
page.getByRole('paragraph').filter({ hasText: /^$/ }).click()
// 输入标题
page.locator('._9ddb7e475b559749-editor').fill('标题内容')
```

### 第四步：输入正文
```typescript
// 点击正文编辑器
page.locator('p[data-diagnose-id="3c01dbc2027f6e9cc949f4602ccb4271"]').click()
// 输入正文
page.locator('p[data-diagnose-id="3c01dbc2027f6e9cc949f4602ccb4271"]').fill('正文内容')
```

### 第五步：点击"选择封面"
```typescript
page.locator('div').filter({ hasText: /^选择封面$/ }).nth(5).click()
```

### 第六步：上传图片
```typescript
// 在点击之前设置 fileChooser 监听
const fileChooserPromise = page.waitForEvent('filechooser')
// 点击上传按钮
page.getByText('点击本地上传').click()
// 立即等待并设置文件
const fileChooser = await fileChooserPromise
await fileChooser.setFiles(imagePath)
```

### 第七步：点击确定按钮
```typescript
page.getByRole('button', { name: '确定 (1)' }).click()
```

### 第八步：勾选"AI创作声明"
```typescript
page.getByRole('checkbox', { name: 'AI创作声明' }).check()
```

### 第九步：点击发布按钮
```typescript
page.getByRole('button', { name: '发布', exact: true }).click()
```

## 关键特性

### 1. 人性化操作间隔
- 每个操作之间等待 3-5 秒（随机）
- 模拟真人操作节奏
- 避免被平台检测为机器人

### 2. 图片上传处理
- 使用 `waitForEvent('filechooser')` 监听文件选择器
- 点击后立即等待 `fileChooserPromise`
- 使用 `fileChooser.setFiles()` 自动设置文件
- 不会显示文件选择对话框给用户

### 3. 内容清理
- 自动清理 Markdown 格式
- 移除图片标签
- 保留纯文本内容

### 4. 图片路径解析
- 支持相对路径（`uploads/`、`/uploads/`）
- 支持绝对路径
- 支持 HTTP/HTTPS URL
- 自动解析为系统绝对路径

### 5. 发布结果验证
- 检查成功提示文本（发布成功、发布完成等）
- 检查 URL 变化
- 多重验证机制
- 容错处理

## 参考的成功平台经验

### 抖音适配器
- ✅ 人性化操作间隔（3-5秒随机等待）
- ✅ fileChooser 图片上传方式
- ✅ 多步骤发布流程
- ✅ 详细的日志记录

### 小红书适配器
- ✅ 图片路径解析逻辑
- ✅ 内容清理方法
- ✅ 发布结果验证机制

## 代码位置
`server/src/services/adapters/BaijiahaoAdapter.ts`

## 测试建议

1. **登录测试**
   - 使用 Cookie 登录
   - 验证登录状态检查

2. **发布测试**
   - 测试完整的 9 步发布流程
   - 验证每个步骤的等待时间
   - 检查图片上传是否成功

3. **错误处理测试**
   - 测试无图片文章的错误提示
   - 测试图片文件不存在的情况
   - 测试网络异常情况

## 注意事项

1. **必须上传图片**：百家号文章必须包含图片才能发布
2. **AI 声明**：自动勾选"AI创作声明"复选框
3. **操作间隔**：每个操作之间有 3-5 秒随机等待
4. **选择器稳定性**：使用了特定的 CSS 选择器，如果百家号更新界面可能需要调整

## 优化建议

1. 如果百家号界面更新，可能需要更新选择器
2. 可以考虑添加更多的错误重试机制
3. 可以添加截图功能用于调试
4. 可以优化等待时间的策略（根据网络状况动态调整）
