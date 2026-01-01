# ✅ Ant Design 警告修复 - message 静态方法

## 警告信息

```
PublishingTasksPage.tsx:307 Warning: [antd: message] Static function can not consume context like dynamic theme. Please use 'App' component instead.
```

## 问题说明

这是 Ant Design 5.x 的一个警告，表示：
- **静态方法**（如 `message.success()`、`message.error()` 等）无法使用动态主题等 Context 特性
- 建议使用 `App` 组件和 hooks API

## 影响

- ⚠️ 这只是一个警告，不影响功能
- 但不符合 Ant Design 5.x 的最佳实践
- 在使用动态主题时可能无法正确应用主题样式

## 修复方案

### 1. 使用 App.useApp() hooks

**修改前：**
```typescript
import { message } from 'antd';

export default function PublishingTasksPage() {
  // 直接使用静态方法
  message.success('操作成功');
}
```

**修改后：**
```typescript
import { App } from 'antd';

export default function PublishingTasksPage() {
  // 使用 hooks API
  const { message } = App.useApp();
  
  // 使用方式相同
  message.success('操作成功');
}
```

### 2. 确保根组件使用 App 组件

在 `windows-login-manager/src/App.tsx` 中已经正确配置：

```typescript
import { App as AntApp } from 'antd';

function App() {
  return (
    <AppProvider>
      <AntApp>  {/* ✅ 已配置 */}
        <AppContent />
      </AntApp>
    </AppProvider>
  );
}
```

## 修改的文件

- `windows-login-manager/src/pages/PublishingTasksPage.tsx`
  - 导入：`message` → `App`
  - 添加：`const { message } = App.useApp();`

## 其他需要修复的文件

如果其他页面也有类似警告，可以用同样的方法修复：

```bash
# 搜索使用 message 静态方法的文件
grep -r "import.*message.*from 'antd'" windows-login-manager/src/pages/
```

常见的静态方法：
- `message.success()` / `message.error()` / `message.warning()`
- `Modal.confirm()` / `Modal.info()`
- `notification.open()`

都应该改为使用 hooks API：
```typescript
const { message, modal, notification } = App.useApp();
```

## 验证

修复后，控制台不应再出现该警告。

## 参考文档

- [Ant Design - App 组件](https://ant.design/components/app-cn)
- [Ant Design 5.x 迁移指南](https://ant.design/docs/react/migration-v5-cn)

---

**修复时间：** 2024-12-30
**修复状态：** ✅ 已完成
