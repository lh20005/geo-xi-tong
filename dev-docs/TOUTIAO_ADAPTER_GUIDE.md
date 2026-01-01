# 头条适配器使用指南

## 概述

头条适配器已成功创建，基于 Playwright 录制脚本优化，实现了自动发布文章到头条平台的功能。

## 核心特性

### 1. 人性化操作
- **随机等待时间**：每次点击和输入前后都有 3-5 秒的随机等待
- **模拟真人操作**：避免被平台识别为机器人
- **自动图片上传**：使用 fileChooser API，无需手动选择文件

### 2. 发布流程

根据录制脚本，头条发布流程包含 8 个步骤：

1. **点击"文章"链接** - 进入文章发布页面
2. **输入标题** - 填写文章标题（2-30个字）
3. **输入正文** - 填写文章正文内容
4. **上传图片** - 自动上传封面图片
5. **选择第一个复选框** - 确认相关选项
6. **选择第二个复选框** - 确认相关选项
7. **点击"预览并发布"** - 预览文章
8. **点击"确认发布"** - 最终发布

### 3. 关键技术点

#### 图片上传
```typescript
// 监听文件选择器（在点击前设置）
const fileChooserPromise = page.waitForEvent('filechooser');

// 点击上传按钮
await page.locator('.article-cover-add').click();

// 自动设置文件（不显示对话框）
const fileChooser = await fileChooserPromise;
await fileChooser.setFiles(imagePath);
```

#### 人性化等待
```typescript
// 随机等待 3-5 秒
private async randomWait(minMs: number, maxMs: number): Promise<void> {
  const waitTime = minMs + Math.random() * (maxMs - minMs);
  await new Promise(resolve => setTimeout(resolve, waitTime));
}

// 人性化点击
private async humanClick(locator: any, description: string = ''): Promise<void> {
  await this.randomWait(3000, 5000); // 点击前等待
  await locator.click();
  await this.log('info', `已点击: ${description}`);
  await this.randomWait(3000, 5000); // 点击后等待
}
```

## 文件结构

```
server/src/services/adapters/
├── ToutiaoAdapter.ts          # 头条适配器（新增）
├── DouyinAdapter.ts            # 抖音适配器（参考）
├── XiaohongshuAdapter.ts       # 小红书适配器
├── AdapterRegistry.ts          # 适配器注册表（已更新）
└── PlatformAdapter.ts          # 基础适配器类

server/
└── test-toutiao-adapter.js     # 测试脚本（新增）
```

## 使用方法

### 1. 测试适配器

```bash
# 运行测试脚本
node server/test-toutiao-adapter.js
```

测试脚本会：
- 打开浏览器窗口（非无头模式）
- 导航到头条发布页面
- 提示手动登录（如需要）
- 自动执行发布流程
- 保持浏览器打开，便于查看结果

### 2. 在系统中使用

头条适配器已自动注册到 `AdapterRegistry`，可以通过以下方式使用：

```typescript
import { adapterRegistry } from './services/adapters/AdapterRegistry';

// 获取头条适配器
const toutiaoAdapter = adapterRegistry.getAdapter('toutiao');

// 执行发布
await toutiaoAdapter.performPublish(page, article, config);
```

### 3. 准备测试数据

确保文章数据包含：
- `title`: 文章标题（2-30个字）
- `content`: 文章正文（支持 Markdown 格式）
- 至少一张图片（Markdown 或 HTML 格式）

示例：
```typescript
const article = {
  title: '装修公司怎么选？这5个关键点一定要知道',
  content: `
装修是一件大事，选择一家靠谱的装修公司至关重要。

![装修效果图](/uploads/test-image.jpg)

希望这些建议能帮到你！
  `,
  keyword: '装修公司'
};
```

## 与抖音适配器的对比

| 特性 | 头条 | 抖音 |
|------|------|------|
| 等待时间 | 3-5秒 | 0.3-1.5秒 |
| 图片上传 | 单张封面 | 单张封面 |
| 话题功能 | 无 | 有 |
| 声明功能 | 有复选框 | 有AI声明 |
| 发布按钮 | 预览并发布 → 确认发布 | 直接发布 |

## 注意事项

1. **等待时间**：头条适配器使用 3-5 秒的等待时间，比抖音更长，更像真人操作
2. **图片必需**：头条文章必须上传封面图片才能发布
3. **复选框**：发布前需要勾选两个复选框（具体含义需根据实际页面确认）
4. **Cookie 登录**：支持 Cookie 登录，避免每次都需要扫码

## 调试技巧

### 1. 查看日志
适配器会输出详细的操作日志：
```
✅ 已点击: 文章链接
✅ 已输入标题: 装修公司怎么选？
✅ 已点击: 正文编辑器
✅ 已输入正文内容
```

### 2. 错误截图
发布失败时会自动保存截图：
```
error-toutiao-{timestamp}.png
```

### 3. 调整等待时间
如果网络较慢，可以增加等待时间：
```typescript
await this.randomWait(5000, 8000); // 5-8秒
```

## 下一步

1. ✅ 创建头条适配器
2. ✅ 注册到适配器注册表
3. ✅ 创建测试脚本
4. 🔲 集成到发布系统
5. 🔲 添加更多平台适配器

## 参考资料

- 抖音适配器：`server/src/services/adapters/DouyinAdapter.ts`
- 适配器基类：`server/src/services/adapters/PlatformAdapter.ts`
- Playwright 文档：https://playwright.dev/
