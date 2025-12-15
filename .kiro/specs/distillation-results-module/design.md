# Design Document

## Overview

本设计文档描述了"蒸馏结果"独立模块的架构和实现方案。该模块将从现有的"关键词蒸馏"页面中分离出结果展示和管理功能，创建一个专注于历史记录管理的独立页面。设计遵循以下原则：

- **数据兼容性**: 完全复用现有的数据库表结构和API接口
- **功能分离**: 将蒸馏操作和结果管理分离到不同页面
- **用户体验**: 提供清晰的导航和直观的操作界面
- **代码复用**: 最大化利用现有的组件和服务逻辑

## Architecture

### 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                        前端层 (React)                         │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────────────────────┐ │
│  │  Sidebar         │  │  Pages                           │ │
│  │  - 关键词蒸馏     │  │  - DistillationPage (简化版)     │ │
│  │  - 蒸馏结果 (新)  │  │  - DistillationResultsPage (新)  │ │
│  │  - 其他菜单       │  │  - TopicsPage                    │ │
│  └──────────────────┘  │  - ArticlePage                   │ │
│                        └──────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                      路由层 (React Router)                   │
│  /distillation → DistillationPage                           │
│  /distillation-results → DistillationResultsPage (新)       │
├─────────────────────────────────────────────────────────────┤
│                      API层 (Axios)                           │
│  POST   /api/distillation                                   │
│  GET    /api/distillation/history                           │
│  GET    /api/distillation/:id                               │
│  PATCH  /api/distillation/:id                               │
│  DELETE /api/distillation/:id                               │
│  DELETE /api/distillation/all/records                       │
├─────────────────────────────────────────────────────────────┤
│                    后端层 (Express)                          │
│  distillationRouter (保持不变)                               │
├─────────────────────────────────────────────────────────────┤
│                    数据层 (PostgreSQL)                       │
│  distillations 表 (保持不变)                                 │
│  topics 表 (保持不变)                                        │
└─────────────────────────────────────────────────────────────┘
```

### 模块职责划分

**DistillationPage (关键词蒸馏页面 - 简化版)**
- 职责：执行新的关键词蒸馏操作
- 功能：
  - 关键词输入
  - 执行蒸馏
  - 显示成功消息
  - 引导用户前往蒸馏结果页面

**DistillationResultsPage (蒸馏结果页面 - 新增)**
- 职责：展示和管理所有历史蒸馏记录
- 功能：
  - 显示历史记录列表
  - 查看记录详情
  - 编辑关键词
  - 删除记录
  - 跳转到话题/文章页面

## Components and Interfaces

### 前端组件

#### 1. Sidebar 组件更新

```typescript
// 新增菜单项
{
  key: '/distillation-results',
  icon: <FileTextOutlined />,
  label: '蒸馏结果',
}
```

#### 2. DistillationPage 组件 (简化版)

```typescript
interface DistillationPageProps {}

interface DistillationState {
  keyword: string;
  loading: boolean;
}

// 主要功能
- handleDistill(): 执行蒸馏并导航到结果页面
```

#### 3. DistillationResultsPage 组件 (新增)

```typescript
interface DistillationResult {
  distillationId: number;
  keyword: string;
  questions: string[];
  count: number;
  provider: string;
  created_at: string;
}

interface HistoryRecord {
  id: number;
  keyword: string;
  topic_count: number;
  provider: string;
  created_at: string;
}

interface DistillationResultsPageState {
  result: DistillationResult | null;
  history: HistoryRecord[];
  loading: boolean;
  selectedRecordId: number | null;
}

// 主要功能
- loadHistory(): 加载历史记录列表
- handleViewHistory(record): 查看记录详情
- handleEditKeyword(id, keyword): 编辑关键词
- handleDeleteRecord(id): 删除单条记录
- handleDeleteAll(): 删除所有记录
- navigateToTopics(id): 跳转到话题页面
- navigateToArticle(id): 跳转到文章页面
```

### 路由配置

```typescript
// App.tsx 中新增路由
<Route path="/distillation-results" element={<DistillationResultsPage />} />
```

### API接口

所有API接口保持不变，复用现有的 `/api/distillation` 路由：

```typescript
// 现有接口（无需修改）
POST   /api/distillation              // 执行蒸馏
GET    /api/distillation/history      // 获取历史记录
GET    /api/distillation/:id          // 获取单条记录详情
PATCH  /api/distillation/:id          // 更新关键词
DELETE /api/distillation/:id          // 删除单条记录
DELETE /api/distillation/all/records  // 删除所有记录
```

## Data Models

### 数据库表结构（保持不变）

```sql
-- 蒸馏记录表
CREATE TABLE distillations (
  id SERIAL PRIMARY KEY,
  keyword VARCHAR(255) NOT NULL,
  provider VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 话题表
CREATE TABLE topics (
  id SERIAL PRIMARY KEY,
  distillation_id INTEGER REFERENCES distillations(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### LocalStorage 数据结构

```typescript
// 存储键
const STORAGE_KEY = 'distillation_current_result';

// 存储数据格式
interface StoredResult {
  distillationId: number;
  keyword: string;
  questions: string[];
  count: number;
  timestamp: number;
}
```

### 前端数据流

```
用户操作 → 组件状态更新 → API调用 → 数据库操作 → 响应返回 → 状态更新 → UI刷新
                                                    ↓
                                              LocalStorage同步
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: 历史记录列表完整性

*For any* 时刻访问蒸馏结果页面，显示的历史记录列表应该包含数据库中所有的蒸馏记录，并按创建时间降序排列

**Validates: Requirements 2.1, 2.4**

### Property 2: 记录详情数据一致性

*For any* 选中的历史记录，显示的详情数据（关键词、话题列表）应该与数据库中该记录的实际数据完全一致

**Validates: Requirements 3.1, 3.2**

### Property 3: 删除操作原子性

*For any* 删除操作（单条或全部），要么完全成功（记录和关联话题都被删除），要么完全失败（数据保持不变）

**Validates: Requirements 6.2, 6.4**

### Property 4: 关键词更新一致性

*For any* 关键词更新操作，如果更新成功，则历史列表、详情显示和LocalStorage中的关键词应该同步更新为新值

**Validates: Requirements 5.2, 5.4**

### Property 5: 导航目标正确性

*For any* 从蒸馏结果页面发起的导航操作（查看话题、生成文章），目标页面应该接收到正确的distillationId参数

**Validates: Requirements 4.1, 4.2**

### Property 6: 空状态处理一致性

*For any* 空数据状态（无历史记录、无选中记录），UI应该显示相应的空状态提示，且不应该显示操作按钮

**Validates: Requirements 2.3, 4.3**

### Property 7: LocalStorage持久化一致性

*For any* 选中的记录，刷新页面后LocalStorage中保存的记录应该被正确恢复到UI显示中

**Validates: Requirements 7.4**

### Property 8: 蒸馏页面简化完整性

*For any* 蒸馏操作完成后，关键词蒸馏页面不应该显示结果详情或历史记录表格，只应该显示成功消息

**Validates: Requirements 8.2, 8.3, 8.4**

## Error Handling

### 前端错误处理

1. **API调用失败**
   - 捕获axios错误
   - 显示用户友好的错误消息
   - 保持UI状态稳定

2. **数据验证错误**
   - 关键词为空：显示警告消息
   - 无效的ID：显示错误提示
   - 数据格式错误：回退到安全状态

3. **LocalStorage错误**
   - 存储空间不足：显示警告，继续操作
   - 数据损坏：清除损坏数据，重新加载
   - 读取失败：使用默认空状态

### 后端错误处理

后端API保持不变，已有完善的错误处理：

1. **参数验证错误**: 返回400状态码和错误消息
2. **资源不存在**: 返回404状态码
3. **数据库错误**: 返回500状态码和错误详情
4. **级联删除**: 通过数据库外键约束自动处理

## Testing Strategy

### 单元测试

**前端组件测试**
- DistillationResultsPage组件渲染测试
- 用户交互事件处理测试
- 状态管理测试
- LocalStorage工具函数测试

**测试工具**: React Testing Library, Jest

### 集成测试

**页面导航测试**
- 侧边栏菜单点击导航
- 从蒸馏结果页面跳转到话题/文章页面
- 蒸馏完成后的导航流程

**API集成测试**
- 历史记录加载
- 记录详情获取
- 编辑和删除操作
- 错误场景处理

### 端到端测试

**完整用户流程**
1. 用户执行蒸馏 → 导航到结果页面 → 查看详情
2. 用户查看历史 → 编辑关键词 → 验证更新
3. 用户删除记录 → 验证UI更新
4. 用户刷新页面 → 验证状态恢复

### 属性测试

使用fast-check库进行属性测试，每个测试运行100次迭代：

**Property 1: 历史记录列表完整性测试**
- 生成随机数量的蒸馏记录
- 验证API返回的记录数量和顺序
- 标签: `Feature: distillation-results-module, Property 1: 历史记录列表完整性`

**Property 2: 记录详情数据一致性测试**
- 生成随机的蒸馏记录和话题
- 验证详情API返回的数据与数据库一致
- 标签: `Feature: distillation-results-module, Property 2: 记录详情数据一致性`

**Property 3: 删除操作原子性测试**
- 生成随机记录并执行删除
- 验证记录和关联话题都被删除或都保留
- 标签: `Feature: distillation-results-module, Property 3: 删除操作原子性`

**Property 4: 关键词更新一致性测试**
- 生成随机关键词进行更新
- 验证所有显示位置的关键词同步更新
- 标签: `Feature: distillation-results-module, Property 4: 关键词更新一致性`

## Implementation Notes

### 代码迁移策略

1. **从DistillationPage提取代码**
   - 提取历史记录表格组件
   - 提取结果详情展示组件
   - 提取编辑/删除操作函数
   - 提取LocalStorage工具函数

2. **创建新页面**
   - 创建DistillationResultsPage组件
   - 集成提取的代码
   - 调整布局和样式

3. **简化原页面**
   - 移除历史记录相关代码
   - 移除结果详情展示
   - 添加导航提示

4. **更新路由和导航**
   - 在App.tsx添加新路由
   - 在Sidebar添加新菜单项
   - 更新相关导航逻辑

### 状态管理

使用React Hooks进行状态管理：
- `useState`: 管理组件本地状态
- `useEffect`: 处理副作用（数据加载、LocalStorage同步）
- `useNavigate`: 处理页面导航

### 样式一致性

保持与现有页面一致的设计风格：
- 使用Ant Design组件库
- 复用现有的颜色方案和间距
- 保持卡片布局和表格样式

### 性能优化

1. **分页加载**: 历史记录表格使用分页，每页10条
2. **按需加载**: 只在点击"查看详情"时加载完整话题列表
3. **缓存策略**: 使用LocalStorage缓存当前选中的记录
4. **防抖处理**: 对频繁的API调用进行防抖处理

## Migration Checklist

- [ ] 创建DistillationResultsPage组件文件
- [ ] 从DistillationPage提取并迁移代码
- [ ] 简化DistillationPage组件
- [ ] 更新Sidebar添加新菜单项
- [ ] 在App.tsx添加新路由
- [ ] 测试所有功能正常工作
- [ ] 验证数据一致性
- [ ] 更新相关文档
