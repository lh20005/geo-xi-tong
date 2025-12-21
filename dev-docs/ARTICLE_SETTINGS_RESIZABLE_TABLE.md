# 文章设置页面列宽调整功能

## 改进概述

为文章设置页面的列表添加了列宽调整功能，使用 ResizableTable 组件替换了原有的普通 Table 组件。

## 主要改进

### 1. 替换为 ResizableTable 组件

**之前：**
- 使用普通的 antd Table 组件
- 列宽固定，无法调整
- 用户体验受限

**现在：**
- 使用 ResizableTable 组件
- 所有列都可以调整宽度
- 列宽保存到 localStorage
- 刷新页面后保持调整后的宽度

### 2. 列宽配置

| 列名 | 默认宽度 | 说明 |
|------|---------|------|
| 设置名称 | 200px | 显示文章设置的名称 |
| 提示词预览 | 400px | 显示提示词的前80个字符 |
| 创建时间 | 180px | 显示创建时间 |
| 操作 | 280px | 显示查看、编辑、删除按钮 |

总宽度：1060px

### 3. 列宽调整样式

- 默认状态：完全透明，不显示任何内容
- 鼠标悬停：显示蓝色细线（1px）
- 拖拽时：细线变粗（2px），提供视觉反馈
- 使用项目统一的蓝色主题 (#1890ff)

## 技术实现

### 导入 ResizableTable

```typescript
import ResizableTable from './ResizableTable';
```

### 添加列宽配置

```typescript
const columns: ColumnsType<ArticleSetting> = [
  {
    title: '设置名称',
    dataIndex: 'name',
    key: 'name',
    width: 200, // 添加默认宽度
    align: 'center',
    ellipsis: true,
  },
  // ... 其他列
];
```

### 使用 ResizableTable

```typescript
return (
  <ResizableTable<ArticleSetting>
    tableId="article-settings-list" // 唯一标识，用于存储列宽
    columns={columns}
    dataSource={settings}
    loading={loading}
    rowKey="id"
    pagination={false}
    scroll={{ x: 1060 }} // 设置横向滚动
    locale={{
      emptyText: (
        <Empty
          description="暂无文章设置"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ),
    }}
  />
);
```

## 用户体验提升

1. **更灵活的布局**：用户可以根据需要调整列宽
2. **更好的可读性**：可以扩大提示词预览列，查看更多内容
3. **持久化设置**：调整后的列宽自动保存，下次访问时保持
4. **统一的交互**：与其他页面的表格保持一致的交互体验

## 测试建议

1. 打开文章设置页面
2. 鼠标悬停在列的右边缘，观察蓝色细线
3. 拖拽调整各列的宽度
4. 刷新页面，验证列宽是否保持
5. 测试不同列的宽度调整
6. 验证最小宽度限制（30px）

## 文件变更

### 修改的文件
- `client/src/components/ArticleSettingList.tsx` - 替换为 ResizableTable 组件

### 变更内容
1. 导入 ResizableTable 组件
2. 为所有列添加 width 属性
3. 将 Table 组件替换为 ResizableTable
4. 添加 tableId 和 scroll 配置

## 总结

通过将文章设置页面的列表替换为 ResizableTable 组件，用户现在可以自由调整列宽，提升了使用体验。所有调整都会自动保存，确保用户的个性化设置得以保留。
