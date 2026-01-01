# 搜狐号自动发布适配器

## 功能特点

✅ 基于 Playwright 录制脚本优化  
✅ 模拟人类操作，每步等待 3-5 秒  
✅ 自动上传封面图片（不弹出对话框）  
✅ 支持 Cookie 登录  
✅ 完整的错误处理和日志记录

## 发布流程

适配器按照以下步骤自动发布文章：

1. **点击"发布内容"按钮** - 进入发布页面
2. **输入标题** - 点击标题输入框并填写文章标题
3. **输入正文** - 点击正文编辑器并填写文章内容
4. **点击封面按钮** - 打开封面上传对话框
5. **点击本地上传** - 选择本地上传方式
6. **上传图片** - 自动设置图片文件（不显示对话框）
7. **点击确定** - 确认图片上传
8. **点击发布** - 提交文章发布

## 使用方法

### 1. 文章格式要求

文章必须包含至少一张图片（作为封面），支持以下格式：

**Markdown 格式：**
```markdown
![图片描述](/uploads/images/cover.jpg)
```

**HTML 格式：**
```html
<img src="/uploads/images/cover.jpg" alt="图片描述">
```

### 2. 调用示例

```typescript
import { adapterRegistry } from './adapters/AdapterRegistry';

// 获取搜狐号适配器
const adapter = adapterRegistry.getAdapter('sohu');

// 准备文章数据
const article = {
  title: '装修设计的5个技巧',
  content: '![封面图](/uploads/images/cover.jpg)\n\n这是文章正文...',
  keyword: '装修设计'
};

// 发布文章
const success = await adapter.performPublish(page, article, config);
```

## 技术细节

### 人性化操作

每个操作都模拟人类行为：
- 点击前等待 3-5 秒（思考时间）
- 点击后等待 3-5 秒（反应时间）
- 输入前等待 3-5 秒（准备时间）
- 输入后等待 3-5 秒（检查时间）

### 图片上传

使用 Playwright 的 `waitForEvent('filechooser')` 和 `fileChooser.setFiles()` 方法：
- 不会弹出系统文件选择对话框
- 直接设置文件路径
- 自动等待上传完成

### 错误处理

- 自动检查图片是否存在
- 验证发布结果（多种方式）
- 详细的日志记录
- 失败时提供明确的错误信息

## 注意事项

1. **图片必需**：搜狐号要求文章必须有封面图片
2. **图片路径**：支持相对路径（/uploads/）和绝对路径
3. **登录方式**：优先使用 Cookie 登录，失败则需要手动登录
4. **等待时间**：每步操作都有 3-5 秒的随机等待，总发布时间约 1-2 分钟

## 已注册平台

当前系统已注册以下平台适配器：
- 小红书 (xiaohongshu)
- 抖音 (douyin)
- 头条 (toutiao)
- 搜狐号 (sohu) ✨ 新增

## 参考资料

- 参考 `ToutiaoAdapter.ts` 了解类似的实现
- 参考 `XiaohongshuAdapter.ts` 了解图片上传处理
- 查看 `PlatformAdapter.ts` 了解基类接口
