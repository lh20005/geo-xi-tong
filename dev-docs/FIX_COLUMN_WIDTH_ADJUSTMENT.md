# 修复列宽调整功能

## 问题描述

文章设置页面的列表无法调整列宽，即使已经使用了 ResizableTable 组件。

## 问题原因

在 `client/src/index.css` 中有一个全局 CSS 规则强制固定了复选框列的宽度：

```css
/* 复选框列固定宽度 */
.ant-table-selection-column {
  width: 50px !important;
  min-width: 50px !important;
  max-width: 50px !important;
}
```

这个 `!important` 规则会覆盖 ResizableTable 组件动态设置的宽度，导致列宽无法调整。

## 解决方案

删除固定宽度的 CSS 规则，允许 ResizableTable 组件动态控制列宽：

```css
/* 复选框列默认宽度（可调整） */
.ant-table-selection-column {
  /* 移除固定宽度限制，允许用户调整 */
}
```

## 技术细节

### 为什么 !important 会影响列宽调整

1. **CSS 优先级**：`!important` 规则具有最高优先级
2. **动态样式被覆盖**：ResizableTable 通过内联样式动态设置列宽，但会被 `!important` 覆盖
3. **影响范围**：这个全局规则影响所有使用 ResizableTable 的页面

### ResizableTable 的列宽控制机制

ResizableTable 组件通过以下方式控制列宽：

1. **初始宽度**：从 localStorage 读取或使用列定义的默认宽度
2. **动态调整**：用户拖拽时，通过内联样式更新列宽
3. **持久化**：将调整后的宽度保存到 localStorage

如果有 `!important` 规则，这个机制就会失效。

## 影响范围

删除这个 CSS 规则后，以下页面的列宽调整功能都会正常工作：

1. ✅ 文章设置页面
2. ✅ 蒸馏结果页面
3. ✅ 发布任务页面
4. ✅ 文章列表页面
5. ✅ 转化目标页面
6. ✅ 文章生成页面
7. ✅ 所有使用 ResizableTable 的页面

## 测试步骤

1. 打开文章设置页面
2. 鼠标悬停在任意列的右边缘
3. 观察是否显示蓝色细线
4. 拖拽调整列宽
5. 验证列宽是否改变
6. 刷新页面，验证列宽是否保持

## 注意事项

### 复选框列的宽度控制

删除固定宽度后，复选框列的宽度由 ResizableTable 组件控制：

- **默认宽度**：60px
- **最小宽度**：40px
- **可调整**：用户可以拖拽调整
- **持久化**：调整后的宽度保存到 localStorage

### 其他列的宽度

所有列都遵循相同的规则：

- **默认宽度**：由列定义中的 `width` 属性指定
- **最小宽度**：30px（防止列完全消失）
- **可调整**：用户可以自由调整
- **持久化**：自动保存到 localStorage

## 后续建议

### 避免使用 !important

在 CSS 中应该避免使用 `!important`，特别是在全局样式中，因为：

1. 会覆盖组件的动态样式
2. 难以调试和维护
3. 破坏样式的层级结构

### 更好的做法

如果需要设置默认样式，应该：

1. 使用较低优先级的选择器
2. 让组件的内联样式可以覆盖
3. 通过组件的 props 传递样式配置

例如：

```css
/* 不好的做法 */
.ant-table-selection-column {
  width: 50px !important;
}

/* 好的做法 */
.ant-table-selection-column {
  width: 50px; /* 可以被内联样式覆盖 */
}
```

## 文件变更

### 修改的文件
- `client/src/index.css` - 删除固定宽度的 CSS 规则

### 变更内容
```diff
- /* 复选框列固定宽度 */
+ /* 复选框列默认宽度（可调整） */
  .ant-table-selection-column {
-   width: 50px !important;
-   min-width: 50px !important;
-   max-width: 50px !important;
+   /* 移除固定宽度限制，允许用户调整 */
  }
```

## 总结

通过删除全局 CSS 中的 `!important` 规则，ResizableTable 组件现在可以正常工作，用户可以自由调整所有列的宽度，包括复选框列。这个修复适用于所有使用 ResizableTable 的页面。
