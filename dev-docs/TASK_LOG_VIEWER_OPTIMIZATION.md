# 任务日志查看器优化

## 改进概述

简化了任务日志查看功能，将"历史"和"实时"两个按钮合并为一个"日志"按钮，提供统一的日志查看体验，并支持智能实时更新和自动滚动。同时优化了日志窗口样式和任务状态显示。

## 主要改进

### 1. 简化操作按钮

**之前：**
- "历史"按钮：查看历史日志（静态）
- "实时"按钮：查看实时日志流（动态）
- 两个独立的窗口，用户需要选择

**现在：**
- "日志"按钮：统一的日志查看入口
- 自动加载历史日志
- 智能判断是否需要实时更新
- 一个窗口完成所有功能

### 2. 智能实时更新

**条件判断**
- 只有 `pending` 和 `running` 状态的任务才开启实时更新
- `success`、`failed`、`cancelled`、`timeout` 状态的任务不开启实时更新
- 避免不必要的 WebSocket 连接

**实现代码：**
```typescript
const handleViewLogs = async (taskId: number, taskStatus: string) => {
  try {
    const logs = await getTaskLogs(taskId);
    // 只有 pending 和 running 状态的任务才开启实时更新
    const shouldLive = taskStatus === 'pending' || taskStatus === 'running';
    setLogsModal({
      visible: true,
      taskId,
      logs,
      isLive: shouldLive
    });
  } catch (error: any) {
    message.error('加载日志失败');
  }
};
```

**连接状态**
- 实时更新中：绿色图标 + "实时更新中"标签
- 已完成：灰色图标 + "已完成"标签

### 3. 自动滚动功能

**智能滚动**
- 新日志出现时自动滚动到底部
- 使用 `useEffect` 监听日志变化
- 延迟 100ms 确保 DOM 已更新
- 平滑滚动体验

**实现代码：**
```typescript
useEffect(() => {
  if (logsModal.visible && logsModal.logs.length > 0) {
    const container = document.getElementById('logs-container');
    if (container) {
      setTimeout(() => {
        container.scrollTop = container.scrollHeight;
      }, 100);
    }
  }
}, [logsModal.logs, logsModal.visible]);
```

### 4. 日志窗口样式优化

**之前：黑色终端风格**
- 黑色背景
- 白色文字
- 不统一的视觉风格

**现在：统一页面风格**
- 浅灰色背景 (#fafafa)
- 黑色文字 (#1e293b)
- 根据日志级别使用不同的背景色：
  - info: 浅绿色背景 (#f6ffed)
  - warning: 浅黄色背景 (#fffbe6)
  - error: 浅红色背景 (#fff1f0)
- 左侧彩色边框区分日志级别
- 使用 Tag 组件显示日志级别
- 添加阴影和圆角，增强层次感

**视觉效果**
```
┌─────────────────────────────────────┐
│ 🔄 任务日志 #123  [实时更新中]      │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ 2024-01-01 12:00:00 [INFO]      │ │
│ │ 开始执行任务...                  │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ 2024-01-01 12:00:05 [SUCCESS]   │ │
│ │ 任务执行成功                     │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### 5. 任务状态显示优化

**问题：**
- 终止的任务显示为"等待中"
- 取消的任务显示为"等待中"
- 状态不准确，用户困惑

**解决方案：**
- 添加 `cancelled` 状态支持（已取消）
- 添加 `timeout` 状态支持（超时）
- 根据 `error_message` 智能判断终止原因
- 如果 `error_message` 包含"用户终止"，显示"已终止"

**状态映射：**
```typescript
const getStatusTag = (status: string, errorMessage?: string) => {
  // 如果是 failed 状态，检查是否是用户终止的
  if (status === 'failed' && errorMessage) {
    if (errorMessage.includes('用户终止') || errorMessage.includes('用户手动终止')) {
      return <Tag color="warning" icon={<StopOutlined />}>已终止</Tag>;
    }
  }
  
  const statusConfig = {
    pending: { color: 'default', icon: <ClockCircleOutlined />, text: '等待中' },
    running: { color: 'processing', icon: <SyncOutlined spin />, text: '执行中' },
    success: { color: 'success', icon: <CheckCircleOutlined />, text: '成功' },
    failed: { color: 'error', icon: <CloseCircleOutlined />, text: '失败' },
    cancelled: { color: 'default', icon: <StopOutlined />, text: '已取消' },
    timeout: { color: 'warning', icon: <ClockCircleOutlined />, text: '超时' }
  };
  
  // ...
};
```

**状态显示：**
- ⏰ 等待中 (pending)
- 🔄 执行中 (running)
- ✅ 成功 (success)
- ❌ 失败 (failed)
- 🛑 已取消 (cancelled)
- ⏱️ 超时 (timeout)
- 🛑 已终止 (failed + "用户终止")

## 技术实现

### 状态管理

```typescript
const [logsModal, setLogsModal] = useState<{ 
  visible: boolean; 
  taskId: number | null; 
  logs: PublishingLog[];
  isLive: boolean; // 实时更新标志
}>({
  visible: false,
  taskId: null,
  logs: [],
  isLive: false
});
```

### 智能实时订阅

```typescript
useEffect(() => {
  if (!logsModal.visible || !logsModal.taskId || !logsModal.isLive) {
    return;
  }

  const unsubscribe = subscribeToTaskLogs(
    logsModal.taskId,
    (log) => {
      setLogsModal(prev => ({
        ...prev,
        logs: [...prev.logs, log]
      }));
    },
    (error) => {
      message.error('日志流连接失败');
      setLogsModal(prev => ({ ...prev, isLive: false }));
    }
  );

  return () => {
    unsubscribe();
  };
}, [logsModal.visible, logsModal.taskId, logsModal.isLive]);
```

### 自动滚动

```typescript
useEffect(() => {
  if (logsModal.visible && logsModal.logs.length > 0) {
    const container = document.getElementById('logs-container');
    if (container) {
      setTimeout(() => {
        container.scrollTop = container.scrollHeight;
      }, 100);
    }
  }
}, [logsModal.logs, logsModal.visible]);
```

## 删除的代码

### 1. 实时日志流状态
```typescript
// 已删除
const [logStream, setLogStream] = useState<{
  visible: boolean;
  taskId: number | null;
  logs: PublishingLog[];
  isLive: boolean;
}>(...);
```

### 2. 实时日志流函数
```typescript
// 已删除
const handleOpenLogStream = (taskId: number) => {...};
const handleCloseLogStream = () => {...};
```

### 3. 实时日志流窗口
- 删除了独立的实时日志流 Card 组件
- 删除了重新连接按钮
- 功能已合并到统一的日志窗口

### 4. 未使用的导入
```typescript
// 已删除
import dayjs, { Dayjs } from 'dayjs';
DatePicker, Input // 从 antd 导入中删除
Paragraph // 从 Typography 中删除
getBatchInfo, BatchInfo // 从 API 导入中删除
```

## 用户体验提升

1. **操作更简单**：只需点击一个"日志"按钮即可查看所有日志

2. **信息更完整**：同时显示历史日志和实时更新，无需切换

3. **体验更流畅**：自动滚动到最新日志，无需手动滚动

4. **状态更清晰**：实时显示连接状态，用户知道是否在接收新日志

5. **界面更简洁**：减少了一个独立的日志流窗口，界面更整洁

6. **性能更优**：只对需要的任务开启实时更新，减少不必要的连接

7. **风格更统一**：日志窗口样式与页面整体风格一致

8. **状态更准确**：正确显示取消、终止等状态，避免用户困惑

## 测试建议

1. 创建一个发布任务
2. 点击"日志"按钮打开日志窗口
3. 观察历史日志是否正确加载
4. 观察实时更新状态指示器（pending/running 应显示"实时更新中"）
5. 等待新日志出现，验证自动滚动功能
6. 测试刷新按钮功能
7. 测试关闭窗口后重新打开
8. 测试已完成任务的日志查看（应显示"已完成"，不开启实时更新）
9. 测试取消任务后的状态显示（应显示"已取消"）
10. 测试终止任务后的状态显示（应显示"已终止"）

## 后续优化方向

1. 添加日志搜索和过滤功能
2. 支持日志导出（下载为文本文件）
3. 添加日志级别筛选（只显示 error/warning）
4. 支持暂停自动滚动（用户手动滚动时）
5. 添加日志高亮和语法着色
6. 支持日志分页（历史日志过多时）
7. 添加日志时间范围筛选
8. 支持日志实时搜索高亮
