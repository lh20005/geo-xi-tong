# ✅ Antd 样式警告修复

## 问题描述

浏览器控制台出现 React 警告：

```
Warning: Updating a style property during rerender (borderLeft) when a conflicting 
property is set (borderLeftWidth) can lead to styling bugs.
```

## 问题原因

在 `PublishingTasksPage.tsx` 中，同时使用了 CSS 简写属性和非简写属性：

```tsx
style={{
  borderLeft: `4px solid ${color}`,  // 简写属性
  border: '1px solid #e2e8f0',
  borderLeftWidth: '4px',             // 非简写属性（冲突）
  borderLeftColor: color,             // 非简写属性（冲突）
}}
```

这会导致样式冲突，因为 `borderLeft` 是 `borderLeftWidth`、`borderLeftStyle` 和 `borderLeftColor` 的简写。

## 修复方案

删除简写属性 `borderLeft`，只保留非简写属性：

**修复前：**
```tsx
style={{
  borderLeft: `4px solid ${color}`,  // ❌ 删除
  border: '1px solid #e2e8f0',
  borderLeftWidth: '4px',
  borderLeftColor: color,
}}
```

**修复后：**
```tsx
style={{
  border: '1px solid #e2e8f0',
  borderLeftWidth: '4px',             // ✅ 保留
  borderLeftColor: color,             // ✅ 保留
}}
```

## 修复效果

✅ 控制台警告消失
✅ 样式显示正常
✅ 不影响功能

## 技术说明

### CSS 简写属性 vs 非简写属性

**简写属性：**
```css
border-left: 4px solid #1890ff;
/* 等同于 */
border-left-width: 4px;
border-left-style: solid;
border-left-color: #1890ff;
```

**最佳实践：**
- 不要混用简写和非简写属性
- 如果需要动态修改某个值，使用非简写属性
- 如果所有值都是固定的，可以使用简写属性

## 相关文件

- `client/src/pages/PublishingTasksPage.tsx` - 发布任务页面

## 完成时间

2025-12-31 20:40

---

**状态**: ✅ 已修复
**影响范围**: 前端样式警告
**优先级**: 低（不影响功能）
