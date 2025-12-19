# 静默发布/可视化发布功能

## 功能概述

在发布任务页面新增了"静默发布/可视化发布"切换功能，允许用户选择发布时浏览器的运行模式。

## 功能特性

### 1. 发布模式选择

- **静默发布（默认）**：浏览器在后台运行，不显示界面，速度更快，适合批量发布
- **可视化发布**：打开浏览器窗口，可以实时观看自动操作过程，便于调试和监控

### 2. 状态持久化

- 用户的选择会自动保存到浏览器的 localStorage
- 下次打开页面时会自动恢复上次的选择
- 默认状态为"静默发布"

### 3. 界面位置

滑块位于"发布间隔"配置模块的下方，在创建发布任务按钮的同一个配置卡片中。

## 使用方法

### 前端使用

1. 在发布任务页面选择文章和平台
2. 设置发布间隔
3. 切换"静默发布/可视化发布"滑块：
   - 关闭状态（默认）：静默发布
   - 开启状态：可视化发布
4. 点击"创建发布任务"按钮

### 技术实现

#### 前端实现

**状态管理**：
```typescript
// 从 localStorage 读取用户上次的选择，默认为 true（静默模式）
const [headlessMode, setHeadlessMode] = useState<boolean>(() => {
  const saved = localStorage.getItem('publishHeadlessMode');
  return saved !== null ? saved === 'true' : true;
});

// 保存用户选择到 localStorage
useEffect(() => {
  localStorage.setItem('publishHeadlessMode', headlessMode.toString());
}, [headlessMode]);
```

**UI 组件**：
```typescript
<Switch
  checked={!headlessMode}
  onChange={(checked) => setHeadlessMode(!checked)}
  checkedChildren="可视化发布"
  unCheckedChildren="静默发布"
  style={{ minWidth: 100 }}
/>
```

**任务创建**：
```typescript
createPublishingTask({
  article_id: articleId,
  platform_id: account.platform_id,
  account_id: accountId,
  scheduled_time: null,
  batch_id: batchId,
  batch_order: batchOrder,
  interval_minutes: publishInterval,
  config: {
    headless: headlessMode  // 传递 headless 参数
  }
})
```

#### 后端实现

**PublishingExecutor.ts**：
```typescript
// 从任务配置中读取 headless 参数
const headlessMode = task.config?.headless !== false; // 默认为静默模式
const modeText = headlessMode ? '静默模式' : '可视化模式';
await publishingService.logMessage(taskId, 'info', `🚀 启动浏览器（${modeText}）...`);
await browserAutomationService.launchBrowser({ headless: headlessMode });
```

## 文件修改清单

### 前端文件

1. **client/src/pages/PublishingTasksPage.tsx**
   - 添加 `headlessMode` 状态管理
   - 添加 localStorage 持久化逻辑
   - 添加 Switch 滑块 UI 组件
   - 在创建任务时传递 `config.headless` 参数

2. **client/src/api/publishing.ts**
   - 更新 `CreatePublishingTaskInput` 接口，明确 `config.headless` 类型

### 后端文件

1. **server/src/services/PublishingExecutor.ts**
   - 从任务配置中读取 `headless` 参数
   - 根据配置启动浏览器（静默或可视化模式）
   - 添加日志记录当前使用的模式

## 测试建议

### 功能测试

1. **静默模式测试**
   - 关闭滑块（默认状态）
   - 创建发布任务
   - 验证浏览器不显示窗口
   - 验证任务正常执行

2. **可视化模式测试**
   - 打开滑块
   - 创建发布任务
   - 验证浏览器窗口显示
   - 验证可以看到自动操作过程

3. **状态持久化测试**
   - 切换滑块状态
   - 刷新页面
   - 验证滑块状态保持不变

4. **批量任务测试**
   - 选择多篇文章和多个平台
   - 设置发布间隔
   - 切换发布模式
   - 验证所有任务使用相同的模式

## 注意事项

1. **默认行为**：为了提高性能和减少资源占用，默认使用静默模式
2. **调试建议**：首次使用或调试时建议使用可视化模式，确认流程正常后再切换到静默模式
3. **性能影响**：静默模式比可视化模式更快，占用资源更少
4. **兼容性**：该功能向后兼容，旧任务如果没有 `config.headless` 参数，会默认使用静默模式

## 用户体验优化

1. **图标提示**：
   - 静默模式显示 🔇 图标和"EyeInvisibleOutlined"
   - 可视化模式显示 👁️ 图标和"EyeOutlined"

2. **文字说明**：
   - 静默模式："后台运行，不显示浏览器"
   - 可视化模式："打开浏览器窗口观看操作"

3. **Tooltip 提示**：
   - 鼠标悬停时显示详细说明
   - 帮助用户理解两种模式的区别

## 未来扩展

可以考虑添加以下功能：

1. **账号级别配置**：为不同平台账号设置默认的发布模式
2. **任务级别查看**：在任务列表中显示每个任务使用的模式
3. **统计分析**：统计不同模式的成功率和执行时间
4. **智能推荐**：根据历史数据推荐最佳发布模式
