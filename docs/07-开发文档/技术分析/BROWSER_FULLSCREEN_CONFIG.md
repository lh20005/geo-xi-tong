# 浏览器全屏配置说明

## ✅ 已配置

浏览器窗口现在会以全屏模式打开。

---

## 🎯 配置详情

### 1. 浏览器启动参数

在 `server/src/config/browserConfig.ts` 中：

```typescript
args: [
  '--start-maximized',  // 启动时最大化窗口
  // ... 其他参数
]
```

### 2. 浏览器上下文配置

在 `server/src/services/BrowserAutomationService.ts` 中：

```typescript
this.context = await this.browser.newContext({
  viewport: null,  // null = 使用浏览器窗口的实际大小（全屏）
  userAgent: '...'
});
```

---

## 📊 效果

### 可视化模式（headless: false）
- ✅ 浏览器窗口会最大化
- ✅ 占满整个屏幕
- ✅ 保留浏览器控件（地址栏、工具栏）

### 静默模式（headless: true）
- ✅ 虚拟浏览器使用全屏尺寸
- ✅ 不显示窗口

---

## 🔧 如何使用

### 在发布任务中启用可视化模式

```json
{
  "headless": false
}
```

浏览器会以全屏模式打开，方便你观察发布过程。

---

## 💡 其他全屏选项

如果需要更激进的全屏模式（隐藏所有浏览器控件），可以添加：

```typescript
args: [
  '--start-maximized',
  '--kiosk',  // Kiosk 模式（真正的全屏，无地址栏）
]
```

**注意**：Kiosk 模式会隐藏所有浏览器控件，可能不方便调试。

---

## ✅ 验证

- [x] 浏览器启动时最大化
- [x] viewport 设置为 null（使用窗口实际大小）
- [x] 编译成功

---

**浏览器现在会以全屏模式打开！🎉**
