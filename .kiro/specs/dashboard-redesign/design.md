# Design Document

## Overview

本设计文档描述了GEO优化系统工作台模块的技术设计方案。工作台采用现代化的数据可视化技术栈，使用Apache ECharts作为核心图表库，结合React和Ant Design构建响应式的数据展示界面。设计遵循组件化、模块化原则，确保代码的可维护性和可扩展性。

## Architecture

### 技术栈

- **前端框架**: React 18 + TypeScript
- **UI组件库**: Ant Design 5.x
- **图表库**: Apache ECharts 5.x (echarts-for-react)
- **状态管理**: React Hooks (useState, useEffect, useCallback)
- **HTTP客户端**: Axios
- **路由**: React Router v6
- **样式方案**: CSS-in-JS (Ant Design内置) + 内联样式

### 后端API设计

工作台需要新增以下API端点：

```
GET /api/dashboard/metrics - 获取核心业务指标
GET /api/dashboard/trends - 获取内容生产趋势数据
GET /api/dashboard/platform-distribution - 获取发布平台分布
GET /api/dashboard/publishing-status - 获取发布任务状态分布
GET /api/dashboard/resource-usage - 获取资源使用效率
GET /api/dashboard/generation-tasks - 获取文章生成任务概览
GET /api/dashboard/top-resources - 获取知识库和转化目标使用排行
GET /api/dashboard/export - 导出统计数据
```

所有API支持时间范围查询参数：
- `startDate`: 开始日期 (ISO 8601格式)
- `endDate`: 结束日期 (ISO 8601格式)

### 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      Dashboard Page                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Header (时间范围选择器 + 刷新按钮 + 导出按钮)        │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  MetricsCards (核心指标卡片组)                        │  │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                 │  │
│  │  │蒸馏  │ │文章  │ │发布  │ │成功率│                 │  │
│  │  └──────┘ └──────┘ └──────┘ └──────┘                 │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  TrendsChart (内容生产趋势折线图)                     │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌──────────────────────┐  ┌──────────────────────────┐   │
│  │ PlatformDistribution │  │ PublishingStatusChart    │   │
│  │ (平台分布柱状图)     │  │ (任务状态环形图)         │   │
│  └──────────────────────┘  └──────────────────────────┘   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  ResourceUsageChart (资源使用效率进度条)              │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌──────────────────────┐  ┌──────────────────────────┐   │
│  │ GenerationTasksChart │  │ TopResourcesChart        │   │
│  │ (任务概览堆叠柱状图) │  │ (资源使用排行柱状图)     │   │
│  └──────────────────────┘  └──────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Dashboard Page Component

主工作台页面组件，负责整体布局和数据协调。

```typescript
interface DashboardProps {}

interface DashboardState {
  timeRange: TimeRange;
  loading: boolean;
  lastUpdate: Date | null;
  error: string | null;
}

interface TimeRange {
  startDate: string;
  endDate: string;
  preset: '7d' | '30d' | '90d' | 'custom';
}
```

### 2. MetricsCards Component

核心指标卡片组件，展示关键业务指标。

```typescript
interface MetricsCardsProps {
  data: MetricsData;
  loading: boolean;
}

interface MetricsData {
  distillations: {
    total: number;
    todayIncrease: number;
    increaseRate: number;
  };
  articles: {
    total: number;
    todayIncrease: number;
    increaseRate: number;
  };
  publishingTasks: {
    total: number;
    todayIncrease: number;
    increaseRate: number;
  };
  successRate: {
    value: number;
    change: number;
  };
}
```

### 3. TrendsChart Component

内容生产趋势折线图组件。

```typescript
interface TrendsChartProps {
  data: TrendsData;
  loading: boolean;
  onDateClick?: (date: string) => void;
}

interface TrendsData {
  dates: string[];
  articles: number[];
  distillations: number[];
}
```

### 4. PlatformDistribution Component

发布平台分布横向柱状图组件。

```typescript
interface PlatformDistributionProps {
  data: PlatformData[];
  loading: boolean;
  onPlatformClick?: (platformId: string) => void;
}

interface PlatformData {
  platformId: string;
  platformName: string;
  count: number;
}
```

### 5. PublishingStatusChart Component

发布任务状态环形图组件。

```typescript
interface PublishingStatusChartProps {
  data: StatusData[];
  loading: boolean;
  onStatusClick?: (status: string) => void;
}

interface StatusData {
  status: 'pending' | 'running' | 'completed' | 'failed';
  count: number;
  percentage: number;
}
```

### 6. ResourceUsageChart Component

资源使用效率进度条组件。

```typescript
interface ResourceUsageChartProps {
  data: ResourceUsageData;
  loading: boolean;
}

interface ResourceUsageData {
  distillations: {
    used: number;
    total: number;
    percentage: number;
  };
  topics: {
    used: number;
    total: number;
    percentage: number;
  };
  images: {
    used: number;
    total: number;
    percentage: number;
  };
}
```

### 7. GenerationTasksChart Component

文章生成任务概览堆叠柱状图组件。

```typescript
interface GenerationTasksChartProps {
  data: GenerationTasksData;
  loading: boolean;
}

interface GenerationTasksData {
  statusDistribution: StatusData[];
  avgCompletionTime: number;
  successRate: number;
}
```

### 8. TopResourcesChart Component

知识库和转化目标使用排行柱状图组件。

```typescript
interface TopResourcesChartProps {
  data: TopResourcesData;
  loading: boolean;
  onResourceClick?: (resourceId: number, type: 'knowledge' | 'target') => void;
}

interface TopResourcesData {
  knowledgeBases: ResourceItem[];
  conversionTargets: ResourceItem[];
}

interface ResourceItem {
  id: number;
  name: string;
  usageCount: number;
}
```

### 9. TimeRangeSelector Component

时间范围选择器组件。

```typescript
interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
}
```

### 10. ExportButton Component

数据导出按钮组件。

```typescript
interface ExportButtonProps {
  timeRange: TimeRange;
  onExport: (format: 'csv' | 'excel') => Promise<void>;
}
```

## Data Models

### API Response Models

```typescript
// 核心指标响应
interface MetricsResponse {
  distillations: {
    total: number;
    today: number;
    yesterday: number;
  };
  articles: {
    total: number;
    today: number;
    yesterday: number;
  };
  publishingTasks: {
    total: number;
    today: number;
    yesterday: number;
  };
  publishingSuccessRate: {
    total: number;
    success: number;
    rate: number;
    previousRate: number;
  };
}

// 趋势数据响应
interface TrendsResponse {
  data: Array<{
    date: string;
    articleCount: number;
    distillationCount: number;
  }>;
}

// 平台分布响应
interface PlatformDistributionResponse {
  data: Array<{
    platformId: string;
    platformName: string;
    publishCount: number;
  }>;
}

// 发布状态响应
interface PublishingStatusResponse {
  data: Array<{
    status: string;
    count: number;
  }>;
}

// 资源使用响应
interface ResourceUsageResponse {
  distillations: {
    total: number;
    used: number;
  };
  topics: {
    total: number;
    used: number;
  };
  images: {
    total: number;
    used: number;
  };
}

// 生成任务响应
interface GenerationTasksResponse {
  statusDistribution: Array<{
    status: string;
    count: number;
  }>;
  avgCompletionTime: number;
  successRate: number;
}

// 资源排行响应
interface TopResourcesResponse {
  knowledgeBases: Array<{
    id: number;
    name: string;
    usageCount: number;
  }>;
  conversionTargets: Array<{
    id: number;
    companyName: string;
    usageCount: number;
  }>;
}
```

## Correctness Properties

*属性是一个特征或行为，应该在系统的所有有效执行中保持为真——本质上是关于系统应该做什么的正式陈述。属性作为人类可读规范和机器可验证正确性保证之间的桥梁。*

### Property 1: 指标数据一致性

*For any* 时间范围，核心指标的今日新增数据应该等于今日总数减去昨日总数

**Validates: Requirements 1.5**

### Property 2: 趋势数据时间连续性

*For any* 趋势数据响应，日期数组应该按时间顺序排列且不包含重复日期

**Validates: Requirements 2.1, 2.2**

### Property 3: 百分比数据有效性

*For any* 包含百分比的数据（使用率、成功率等），百分比值应该在0到100之间

**Validates: Requirements 1.4, 5.4, 6.4**

### Property 4: 状态分布完整性

*For any* 状态分布数据，所有状态的数量总和应该等于总任务数

**Validates: Requirements 4.2, 6.2**

### Property 5: 排行数据排序正确性

*For any* 排行榜数据，资源应该按使用次数降序排列

**Validates: Requirements 7.3, 7.4**

### Property 6: 时间范围有效性

*For any* 用户选择的时间范围，开始日期应该早于或等于结束日期

**Validates: Requirements 8.5**

### Property 7: 导出数据完整性

*For any* 导出操作，导出的数据应该包含当前时间范围内所有可见图表的数据

**Validates: Requirements 12.4**

### Property 8: 加载状态一致性

*For any* 数据加载操作，在数据加载完成前应该显示加载状态，加载完成后应该隐藏加载状态

**Validates: Requirements 9.2, 9.5**

### Property 9: 响应式布局适配性

*For any* 屏幕宽度，页面布局应该根据断点正确调整列数（<768px: 1列, 768-1024px: 2列, >1024px: 3-4列）

**Validates: Requirements 10.1, 10.2, 10.3**

### Property 10: 导航跳转正确性

*For any* 可点击的数据项，点击后应该导航到正确的目标页面或显示错误提示

**Validates: Requirements 11.1, 11.2, 11.4, 11.5**

## Error Handling

### 1. API错误处理

- **网络错误**: 显示友好的错误提示，提供重试按钮
- **超时错误**: 显示超时提示，建议用户检查网络连接
- **服务器错误**: 显示错误信息，记录错误日志
- **数据格式错误**: 使用默认值或空状态，记录警告日志

### 2. 数据验证

- 验证API响应数据的完整性和有效性
- 对异常数据进行过滤和清洗
- 使用TypeScript类型系统确保类型安全

### 3. 用户操作错误

- 时间范围选择错误：提示用户选择有效的时间范围
- 导出失败：显示具体错误原因，提供重试选项
- 导航失败：显示错误提示，保持在当前页面

### 4. 性能降级

- 数据量过大时自动启用分页或限制显示数量
- 图表渲染失败时显示简化版本或文本数据
- 网络慢时显示骨架屏而非空白页面

## Testing Strategy

### Unit Tests

使用Jest和React Testing Library进行单元测试：

1. **组件渲染测试**
   - 测试各组件在不同props下的渲染结果
   - 测试加载状态、错误状态、空状态的显示

2. **数据转换测试**
   - 测试API响应数据到组件props的转换逻辑
   - 测试百分比计算、增长率计算等工具函数

3. **用户交互测试**
   - 测试按钮点击、时间范围选择等交互
   - 测试导航跳转逻辑

### Property-Based Tests

使用fast-check进行属性测试，每个测试运行至少100次迭代：

1. **Property 1测试**: 生成随机的今日和昨日数据，验证增长计算正确性
2. **Property 2测试**: 生成随机日期数组，验证排序和去重逻辑
3. **Property 3测试**: 生成随机数值，验证百分比计算在有效范围内
4. **Property 5测试**: 生成随机排行数据，验证排序正确性
5. **Property 6测试**: 生成随机日期范围，验证验证逻辑
6. **Property 9测试**: 生成随机屏幕宽度，验证布局列数计算

### Integration Tests

1. **API集成测试**
   - 测试所有API端点的请求和响应
   - 测试错误处理和重试逻辑

2. **端到端测试**
   - 测试完整的用户流程：访问工作台 → 选择时间范围 → 查看图表 → 导出数据
   - 测试响应式布局在不同设备上的表现

### Performance Tests

1. **加载性能测试**
   - 测试首屏渲染时间（目标<3秒）
   - 测试数据更新响应时间（目标<1秒）

2. **内存泄漏测试**
   - 测试组件卸载后的内存释放
   - 测试长时间运行的内存占用

## Implementation Notes

### 1. 图表配置

使用ECharts的响应式配置，确保图表在不同屏幕尺寸下正常显示：

```typescript
const chartOption = {
  responsive: true,
  maintainAspectRatio: false,
  grid: {
    left: '3%',
    right: '4%',
    bottom: '3%',
    containLabel: true
  }
};
```

### 2. 性能优化

- 使用React.memo优化组件渲染
- 使用useCallback缓存事件处理函数
- 使用useMemo缓存计算结果
- 图表数据变化时使用ECharts的增量更新API

### 3. 样式设计

延续项目整体风格：
- 使用渐变色卡片（与现有Dashboard一致）
- 图表配色方案：
  - 主色调：#667eea, #764ba2, #f093fb, #f5576c, #4facfe, #00f2fe, #43e97b, #38f9d7
  - 成功：#52c41a
  - 警告：#faad14
  - 错误：#ff4d4f
  - 信息：#1890ff

### 4. 数据刷新策略

- 页面加载时自动获取数据
- 提供手动刷新按钮
- 不使用自动轮询（避免不必要的服务器负载）
- 显示最后更新时间

### 5. 导出功能实现

- CSV导出：使用papaparse库
- Excel导出：使用xlsx库
- 导出文件命名：`dashboard_export_${timestamp}.${format}`
- 包含所有当前可见的统计数据
