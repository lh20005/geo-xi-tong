# Chrome DevTools MCP 自动发布方案

## 方案概述

使用 Chrome DevTools MCP 替换当前的 Puppeteer 方案，实现更强大、更灵活的自动发布功能。

## 核心优势

### 1. 直接使用录制脚本
- ✅ 你已经用 Chrome DevTools Recorder 录制了企鹅号的操作
- ✅ Chrome DevTools MCP 可以直接执行这些录制
- ✅ 无需手动编写选择器和操作逻辑

### 2. 更强大的功能
- ✅ 支持所有 Chrome DevTools Protocol 功能
- ✅ 可以录制、回放、调试
- ✅ 支持网络拦截、性能分析
- ✅ 支持截图、PDF生成

### 3. 更好的维护性
- ✅ 录制脚本可视化，易于理解
- ✅ 修改脚本无需编程知识
- ✅ 可以快速适应平台变化

## 技术架构

### 当前架构（Puppeteer）
```
发布任务 → PublishingExecutor → Puppeteer → 浏览器
                                    ↓
                            手写的适配器代码
                            (选择器、操作逻辑)
```

### 新架构（Chrome DevTools MCP）
```
发布任务 → PublishingExecutor → Chrome DevTools MCP → 浏览器
                                         ↓
                                  录制的脚本文件
                                  (自动生成的操作)
```

## 实施步骤

### 步骤1: 安装 Chrome DevTools MCP

```bash
# 安装 MCP 服务器
npm install -g @modelcontextprotocol/server-puppeteer

# 或者使用 uvx（推荐）
uvx @modelcontextprotocol/server-puppeteer
```

### 步骤2: 配置 MCP 服务器

创建 `.kiro/settings/mcp.json`:
```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "uvx",
      "args": ["@modelcontextprotocol/server-puppeteer@latest"],
      "env": {
        "PUPPETEER_EXECUTABLE_PATH": "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
      },
      "disabled": false,
      "autoApprove": [
        "puppeteer_navigate",
        "puppeteer_click",
        "puppeteer_fill",
        "puppeteer_select",
        "puppeteer_screenshot"
      ]
    }
  }
}
```

### 步骤3: 保存录制脚本

将你录制的脚本保存到项目中：
```
server/src/publishing-scripts/
├── qie.json          # 企鹅号录制脚本
├── toutiao.json      # 头条号录制脚本
├── xiaohongshu.json  # 小红书录制脚本
└── ...
```

### 步骤4: 创建脚本执行服务

```typescript
// server/src/services/RecordingExecutor.ts
import { readFileSync } from 'fs';
import { join } from 'path';

export class RecordingExecutor {
  /**
   * 执行录制脚本
   */
  async executeRecording(
    platformId: string,
    article: Article,
    config: PublishingConfig
  ): Promise<boolean> {
    // 1. 加载录制脚本
    const scriptPath = join(__dirname, '../publishing-scripts', `${platformId}.json`);
    const recording = JSON.parse(readFileSync(scriptPath, 'utf-8'));
    
    // 2. 替换脚本中的占位符
    const modifiedRecording = this.replaceVariables(recording, {
      title: article.title,
      content: article.content,
      images: this.extractImages(article.content)
    });
    
    // 3. 使用 Chrome DevTools MCP 执行
    const result = await this.mcpClient.executeRecording(modifiedRecording);
    
    return result.success;
  }
  
  /**
   * 替换脚本中的变量
   */
  private replaceVariables(recording: any, variables: any): any {
    // 遍历录制步骤，替换占位符
    // 例如：将 "这是输入标题" 替换为实际的文章标题
    return recording;
  }
}
```

### 步骤5: 修改 PublishingExecutor

```typescript
// server/src/services/PublishingExecutor.ts
import { recordingExecutor } from './RecordingExecutor';

async performPublish(taskId: number, task: any): Promise<any> {
  // ... 登录逻辑 ...
  
  // 使用录制脚本执行发布
  const success = await recordingExecutor.executeRecording(
    task.platform_id,
    article,
    task.config
  );
  
  return success;
}
```

## 录制脚本格式

### 企鹅号录制脚本示例

```json
{
  "title": "企鹅号自动发布",
  "steps": [
    {
      "type": "navigate",
      "url": "https://om.qq.com/main"
    },
    {
      "type": "click",
      "selectors": ["div.hello-clsnTcoH > button"],
      "description": "点击开始创作"
    },
    {
      "type": "fill",
      "selectors": ["div.omui-articletitle__title1 span"],
      "value": "{{TITLE}}",
      "description": "填写标题"
    },
    {
      "type": "fill",
      "selectors": ["section.editor_container-cls1yCMh > div"],
      "value": "{{CONTENT}}",
      "description": "填写正文"
    },
    {
      "type": "upload",
      "selectors": ["input[type=file]"],
      "files": "{{IMAGES}}",
      "description": "上传图片"
    },
    {
      "type": "click",
      "selectors": ["li:nth-of-type(2) span"],
      "description": "点击发布"
    }
  ]
}
```

### 变量替换规则

- `{{TITLE}}` → 文章标题
- `{{CONTENT}}` → 文章内容
- `{{IMAGES}}` → 图片路径数组
- `{{COVER}}` → 封面图片路径

## 优势对比

| 特性 | Puppeteer方案 | Chrome DevTools MCP方案 |
|------|--------------|------------------------|
| 开发难度 | 高（需要编写代码） | 低（录制即可） |
| 维护成本 | 高（选择器变化需改代码） | 低（重新录制即可） |
| 调试难度 | 中（需要看日志） | 低（可视化调试） |
| 灵活性 | 中（受代码限制） | 高（CDP全功能） |
| 学习曲线 | 陡（需要学Puppeteer） | 平（会录制即可） |
| 适应变化 | 慢（需要改代码） | 快（重新录制） |

## 实施建议

### 阶段1: 试点（1-2天）
1. 安装配置 Chrome DevTools MCP
2. 将企鹅号录制脚本转换为可执行格式
3. 测试企鹅号自动发布

### 阶段2: 扩展（3-5天）
1. 录制其他平台的操作流程
2. 创建统一的脚本执行框架
3. 测试所有平台

### 阶段3: 优化（2-3天）
1. 添加错误处理和重试机制
2. 优化变量替换逻辑
3. 添加日志和监控

## 快速开始

### 1. 测试 Chrome DevTools MCP

```bash
# 安装
uvx @modelcontextprotocol/server-puppeteer

# 测试连接
# 在 Kiro 中打开 MCP 面板，查看是否连接成功
```

### 2. 转换现有录制脚本

将你的 `qi'e.js` 转换为 JSON 格式：
```bash
# 创建脚本目录
mkdir -p server/src/publishing-scripts

# 转换脚本（手动或使用工具）
# 将 Puppeteer 代码转换为 JSON 配置
```

### 3. 创建执行器

```typescript
// 简单的执行器示例
import { readFileSync } from 'fs';

async function executeQiePublishing(article: Article) {
  const script = JSON.parse(
    readFileSync('server/src/publishing-scripts/qie.json', 'utf-8')
  );
  
  // 使用 MCP 执行脚本
  // ...
}
```

## 注意事项

### 1. Cookie 管理
- 录制脚本需要先设置 Cookie
- 可以在脚本开始前注入 Cookie

### 2. 动态内容
- 标题、正文、图片需要动态替换
- 使用变量占位符

### 3. 错误处理
- 添加超时检测
- 添加元素等待
- 添加重试机制

### 4. 并发控制
- 同一浏览器实例不能并发执行
- 需要队列管理

## 下一步

1. **立即测试**: 安装 Chrome DevTools MCP，测试基本功能
2. **转换脚本**: 将企鹅号录制脚本转换为可执行格式
3. **集成系统**: 将 MCP 集成到现有的发布系统中
4. **扩展平台**: 录制其他平台的操作流程

## 相关资源

- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)
- [Puppeteer Recorder](https://developer.chrome.com/docs/devtools/recorder/)
- [MCP Puppeteer Server](https://github.com/modelcontextprotocol/servers/tree/main/src/puppeteer)

---

**结论**: Chrome DevTools MCP 是一个更现代、更灵活的方案，特别适合你已经有录制脚本的情况。建议优先尝试这个方案。
