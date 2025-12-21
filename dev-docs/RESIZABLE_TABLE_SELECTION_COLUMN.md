# ResizableTable 复选框列宽度调整功能

## 改进概述

为 ResizableTable 组件添加了复选框列（rowSelection）的宽度调整功能，使所有列都可以自由调整宽度。

## 主要改进

### 1. 复选框列可调整宽度

**之前：**
- 复选框列固定宽度 50px
- 无法调整宽度
- 在某些场景下可能过窄或过宽

**现在：**
- 复选框列默认宽度 60px
- 可以通过拖拽调整宽度
- 最小宽度 40px
- 宽度保存到 localStorage

### 2. 列宽调整样式优化

**隐藏默认符号：**
- 完全隐藏 react-resizable 默认的右下角调整手柄符号
- 只在鼠标悬停时显示蓝色细线
- 拖拽时细线变粗，提供视觉反馈

**样式细节：**
- 默认状态：完全透明
- 悬停状态：显示 1px 蓝色细线
- 拖拽状态：显示 2px 蓝色细线
- 使用项目统一的蓝色主题 (#1890ff)

## 技术实现

### 初始化复选框列宽度

```typescript
const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
  const stored = getStoredColumnWidths(tableId);
  const initial: Record<string, number> = {};
  
  // 如果有 rowSelection，添加选择列的宽度
  if (tableProps.rowSelection) {
    initial['__selection__'] = stored['__selection__'] || 60; // 默认 60px
  }
  
  initialColumns.forEach((col: any) => {
    const key = col.key || col.dataIndex;
    if (key) {
      const definedWidth = col.width || 150;
      const storedWidth = stored[key];
      initial[key] = storedWidth || definedWidth;
    }
  });
  
  return initial;
});
```

### 自定义表头单元格

```typescript
const components = {
  header: {
    cell: (props: any) => {
      // 如果是选择列的表头
      if (props.className?.includes('ant-table-selection-column')) {
        return (
          <ResizableTitle
            {...props}
            width={selectionColumnWidth}
            onResize={handleResize('__selection__')}
            minWidth={40}
          />
        );
      }
      // 其他列使用默认的 ResizableTitle
      return <ResizableTitle {...props} />;
    },
  },
};
```

### 动态计算总宽度

```typescript
// 计算所有列的总宽度
const totalWidth = resizableColumns.reduce((sum: number, col: any) => {
  return sum + (col.width || 150);
}, 0);

// 如果有 rowSelection，加上选择列的宽度
const selectionColumnWidth = columnWidths['__selection__'] || 60;
const finalTotalWidth = tableProps.rowSelection ? totalWidth + selectionColumnWidth : totalWidth;
```

### 样式优化

```css
/* 隐藏默认的调整手柄符号 */
.react-resizable-handle::before {
  display: none !important;
}

/* 只在悬停时显示一条细线 */
.react-resizable-handle::after {
  content: '';
  position: absolute;
  right: 4px;
  top: 0;
  width: 1px;
  height: 100%;
  background: transparent;
  transition: background 0.2s;
}

.react-resizable-handle:hover::after {
  background: #1890ff;
}

.react-resizable-handle:active::after {
  background: #1890ff;
  width: 2px;
  right: 3.5px;
}
```

## 使用方法

### 基本使用

```typescript
<ResizableTable
  tableId="my-table"
  columns={columns}
  dataSource={data}
  rowSelection={{
    selectedRowKeys,
    onChange: setSelectedRowKeys
  }}
/>
```

### 特点

1. **自动保存**：列宽调整后自动保存到 localStorage
2. **持久化**：刷新页面后保持调整后的宽度
3. **独立存储**：每个表格通过 `tableId` 独立存储列宽
4. **最小宽度**：复选框列最小宽度 40px，防止过窄

## 应用场景

### 蒸馏结果页面

```typescript
<ResizableTable<TopicWithReference>
  tableId="distillation-results-list"
  rowSelection={{
    selectedRowKeys,
    onChange: setSelectedRowKeys
  }}
  columns={columns}
  dataSource={data}
  rowKey="id"
/>
```

现在复选框列可以调整宽度，用户可以根据需要调整到合适的大小。

### 发布任务页面

```typescript
<ResizableTable<PublishingTask>
  tableId="publishing-tasks-batch"
  columns={batchColumns}
  dataSource={batchDataSource}
  rowKey="key"
  expandable={{...}}
/>
```

批次任务列表的复选框列也支持宽度调整。

## 用户体验提升

1. **更灵活的布局**：用户可以根据需要调整复选框列宽度
2. **更优雅的交互**：隐藏难看的调整手柄符号，只在需要时显示
3. **更统一的体验**：所有列都支持宽度调整，交互一致
4. **更持久的设置**：调整后的宽度自动保存，下次访问时保持

## 测试建议

1. 打开蒸馏结果页面
2. 鼠标悬停在复选框列的右边缘
3. 观察是否显示蓝色细线
4. 拖拽调整复选框列宽度
5. 刷新页面，验证宽度是否保持
6. 测试其他使用 ResizableTable 的页面

## 后续优化方向

1. 添加列宽重置功能（恢复默认宽度）
2. 支持列宽预设（保存多套列宽配置）
3. 添加列宽调整的撤销/重做功能
4. 优化移动端的列宽调整体验
5. 添加列宽调整的动画效果

## 文件变更

### 修改的文件
- `client/src/components/ResizableTable.tsx` - 添加复选框列宽度调整功能
- `client/src/index.css` - 优化列宽调整手柄样式

## 总结

通过这次改进，ResizableTable 组件现在支持所有列的宽度调整，包括复选框列。同时优化了列宽调整的视觉效果，隐藏了难看的默认符号，提供了更优雅的交互体验。
