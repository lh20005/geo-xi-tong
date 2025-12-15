# Design Document

## Overview

本设计文档描述了将"蒸馏历史"功能从DistillationResultsPage迁移到DistillationPage的技术实现方案。这是一个纯前端重构任务，不涉及后端API或数据库的修改。重构的核心目标是改善信息架构和用户体验，使历史记录管理功能更贴近用户的工作流程。

重构后的页面结构：
- **DistillationPage (关键词蒸馏)**: 包含关键词输入区域 + 蒸馏历史表格
- **DistillationResultsPage (蒸馏结果)**: 仅包含当前选中的蒸馏结果详情卡片（或空状态）

## Architecture

### Component Structure

```
DistillationPage
├── Keyword Input Section (现有)
│   ├── Title & Description
│   ├── Input with Button
│   └── Info Box
└── Distillation History Section (新增)
    ├── Card Header with Actions
    ├── History Table
    └── Empty State

DistillationResultsPage
└── Result Detail Card (保留)
    ├── Card Header with Actions
    ├── Questions List
    └── Action Buttons
```

### Data Flow

1. **页面加载流程**:
   - DistillationPage加载 → 调用`/api/distillation/history` → 显示历史表格
   - DistillationResultsPage加载 → 从LocalStorage读取 → 显示结果详情或空状态

2. **蒸馏操作流程**:
   - 用户输入关键词 → 调用`/api/distillation` → 保存到LocalStorage → 导航到DistillationResultsPage

3. **查看历史记录流程**:
   - 用户点击"查看详情" → 调用`/api/distillation/:id` → 保存到LocalStorage → 导航到DistillationResultsPage

4. **删除操作流程**:
   - 单条删除: 调用`/api/distillation/:id` → 刷新历史列表 → 如果是当前选中记录则清除LocalStorage
   - 批量删除: 调用`/api/distillation/all/records` → 清空历史列表 → 清除LocalStorage

## Components and Interfaces

### DistillationPage Component

**新增状态**:
```typescript
const [history, setHistory] = useState<any[]>([]);
const [selectedRecordId, setSelectedRecordId] = useState<number | null>(null);
```

**新增函数**:
- `loadHistory()`: 加载历史记录列表
- `handleViewHistory(record)`: 查看历史记录详情
- `handleDeleteRecord(id)`: 删除单条记录
- `handleEditKeyword(id, currentKeyword)`: 编辑关键词
- `handleDeleteAll()`: 删除所有记录

**修改函数**:
- `handleDistill()`: 成功后保存到LocalStorage并导航到结果页面

### DistillationResultsPage Component

**移除内容**:
- 历史记录相关的所有状态和函数
- 历史记录表格的Card组件

**保留内容**:
- `result` 状态和相关的显示逻辑
- `loadResultFromLocalStorage()` 调用
- 结果详情卡片的所有功能

**新增内容**:
- 空状态显示（当没有选中记录时）

## Data Models

### History Record Type
```typescript
interface HistoryRecord {
  id: number;
  keyword: string;
  topic_count: number;
  provider: 'deepseek' | 'gemini' | 'ollama';
  created_at: string;
}
```

### Result Data Type
```typescript
interface ResultData {
  distillationId: number;
  keyword: string;
  questions: string[];
  count: number;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After reviewing all testable criteria from the prework analysis, I've identified the following properties that provide unique validation value. Many of the UI interaction tests (clicking buttons, opening modals) are better suited as integration tests rather than property-based tests, as they test specific examples rather than universal properties. The properties below focus on invariants and behaviors that should hold across all valid inputs and states.

### Core Properties

Property 1: Successful distillation saves to LocalStorage
*For any* successful distillation operation with valid keyword and response data, the system should save the result to LocalStorage with all required fields (distillationId, keyword, questions, count)
**Validates: Requirements 3.1**

Property 2: Distillation success triggers navigation
*For any* successful distillation operation, the system should automatically navigate to the Distillation Results Module
**Validates: Requirements 3.2**

Property 3: Post-distillation display consistency
*For any* navigation to the Distillation Results Module after a successful distillation, the displayed result should match the data saved in LocalStorage
**Validates: Requirements 3.3**

Property 4: Delete all button visibility
*For any* state where the history table contains one or more records, the delete all button should be visible in the table header
**Validates: Requirements 4.1**

Property 5: Delete all operation completeness
*For any* delete all operation, all distillation records should be removed from the database and the operation should return the correct count of deleted records
**Validates: Requirements 4.3**

Property 6: Delete all clears selected record
*For any* delete all operation where the currently selected record (in LocalStorage) is among the deleted records, LocalStorage should be cleared
**Validates: Requirements 4.4**

Property 7: Delete all success message accuracy
*For any* completed delete all operation, the success message should display the exact count of records that were deleted
**Validates: Requirements 4.5**

Property 8: Results page loads from LocalStorage
*For any* page load of the Distillation Results Module, the system should attempt to read the selected record from LocalStorage
**Validates: Requirements 5.1**

Property 9: Valid LocalStorage data displays correctly
*For any* valid record data in LocalStorage, the Distillation Results Module should display the result item with all fields matching the stored data
**Validates: Requirements 5.2**

Property 10: History page loads data on mount
*For any* page load of the Keyword Distillation Module, the system should fetch and display the distillation history from the API
**Validates: Requirements 5.4**

Property 11: Selected record highlighting
*For any* record in the history table that matches the currently selected record ID in LocalStorage, that row should have the selected styling applied
**Validates: Requirements 5.5**

Property 12: LocalStorage operations preservation
*For any* distillation result data, the LocalStorage utility functions (save, load, clear) should behave identically before and after the refactoring
**Validates: Requirements 6.3**



## Error Handling

### API Error Handling
- 所有API调用失败时显示用户友好的错误消息
- 网络错误时保持当前页面状态，不进行导航
- 删除操作失败时不修改本地状态

### LocalStorage Error Handling
- LocalStorage读取失败时优雅降级，显示空状态
- LocalStorage写入失败时记录错误但不阻塞用户操作
- 无效的LocalStorage数据应被忽略并清除

### UI Error States
- 空历史记录时显示友好的空状态提示
- 无选中记录时在结果页面显示引导用户的空状态
- 加载失败时显示重试选项

## Testing Strategy

### Unit Testing Approach

本项目将使用Jest和React Testing Library进行单元测试。测试重点关注：

1. **组件渲染测试**:
   - 验证DistillationPage正确渲染关键词输入区域和历史表格
   - 验证DistillationResultsPage在有/无数据时的正确渲染
   - 验证空状态的正确显示

2. **用户交互测试**:
   - 测试关键词输入和提交流程
   - 测试历史记录的查看、编辑、删除操作
   - 测试批量删除操作

3. **状态管理测试**:
   - 测试组件状态的正确更新
   - 测试LocalStorage的读写操作
   - 测试页面导航逻辑

### Property-Based Testing Approach

本项目将使用fast-check库进行属性测试。每个属性测试将运行至少100次迭代以确保充分覆盖。

**测试标注格式**: 每个属性测试必须使用以下格式标注：
```typescript
// Feature: distillation-history-relocation, Property {number}: {property_text}
```

**属性测试重点**:

1. **数据持久化属性** (Properties 1, 3, 8, 9, 12):
   - 生成随机的蒸馏结果数据
   - 验证LocalStorage操作的正确性
   - 验证数据在保存和加载后保持一致

2. **导航和显示属性** (Properties 2, 10):
   - 验证成功操作后的导航行为
   - 验证页面加载时的数据获取

3. **条件渲染属性** (Properties 4, 11):
   - 生成不同的数据状态
   - 验证UI元素的条件显示

4. **批量操作属性** (Properties 5, 6, 7):
   - 生成不同数量的记录
   - 验证批量删除的完整性和正确性

### Integration Testing

虽然不是本次重构的重点，但建议进行以下集成测试：

1. 完整的蒸馏工作流测试（输入 → 蒸馏 → 查看结果）
2. 历史记录管理工作流测试（查看 → 编辑 → 删除）
3. 跨页面导航测试

### Manual Testing Checklist

重构完成后应进行以下手动测试：

1. ✓ 在关键词蒸馏页面输入关键词并执行蒸馏
2. ✓ 验证自动导航到结果页面并显示新结果
3. ✓ 返回关键词蒸馏页面，验证历史表格显示新记录
4. ✓ 点击历史记录的"查看详情"，验证导航和数据加载
5. ✓ 在历史表格中编辑关键词，验证更新成功
6. ✓ 在历史表格中删除单条记录，验证删除成功
7. ✓ 点击"全部删除"，验证批量删除成功
8. ✓ 刷新页面，验证LocalStorage数据正确恢复
9. ✓ 清除LocalStorage，验证空状态正确显示

## Implementation Notes

### Code Migration Strategy

1. **Phase 1**: 在DistillationPage中添加历史记录功能
   - 复制历史记录相关的状态和函数
   - 复制历史表格的JSX代码
   - 调整样式以适应新布局

2. **Phase 2**: 简化DistillationResultsPage
   - 移除历史记录相关的状态和函数
   - 移除历史表格的JSX代码
   - 添加空状态处理

3. **Phase 3**: 更新导航和交互
   - 修改handleDistill函数以在成功后导航
   - 确保所有历史记录操作正确导航到结果页面

### Styling Considerations

- 历史表格在DistillationPage中应与关键词输入区域有适当的间距
- 空状态应使用Ant Design的Empty组件保持一致性
- 选中的历史记录行应有明显的视觉反馈

### Performance Considerations

- 历史记录列表限制为50条（已在API中实现）
- 使用React的useEffect依赖数组避免不必要的重新渲染
- LocalStorage操作应在必要时才执行

### Backward Compatibility

- 现有的LocalStorage数据格式保持不变
- 所有API接口保持不变
- 用户的现有数据和工作流不受影响
