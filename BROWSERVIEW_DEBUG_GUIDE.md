# BrowserView 全屏显示调试指南

## 🐛 问题描述

**症状**：
- 窗口是全屏的
- 但 BrowserView 内容只显示在左上角一小块区域
- 其余区域是白色的

---

## 🔧 已实施的修复

### 1. 修改窗口显示时机

**文件**：`windows-login-manager/electron/main.ts`

**修改**：
```typescript
// 旧代码
const windowConfig = {
  show: true,  // ❌ 立即显示，可能在最大化前
};
this.window = new BrowserWindow(windowConfig);
this.window.maximize();

// 新代码
const windowConfig = {
  show: false,  // ✅ 先不显示
};
this.window = new BrowserWindow(windowConfig);
this.window.maximize();  // 先最大化
this.window.show();      // 再显示
```

### 2. 添加调试日志

**文件**：`windows-login-manager/electron/login/browser-view-manager.ts`

**添加的日志**：
```typescript
private resizeBrowserView(): void {
  log.info('=== BrowserView Resize Debug ===');
  log.info(`Window bounds: ${JSON.stringify(windowBounds)}`);
  log.info(`Content bounds: ${JSON.stringify(contentBounds)}`);
  log.info(`Window maximized: ${this.parentWindow.isMaximized()}`);
  log.info(`Setting BrowserView bounds: ${JSON.stringify(viewBounds)}`);
  log.info('================================');
}
```

---

## 🔍 如何调试

### 1. 重新编译
```bash
cd windows-login-manager
npm run build:electron
```

### 2. 启动应用（开发模式）
```bash
npm run dev
```

### 3. 查看日志

打开开发者工具（应该会自动打开），查看控制台日志：

**期望看到的日志**：
```
=== BrowserView Resize Debug ===
Window bounds: {"x":0,"y":0,"width":1920,"height":1080}
Content bounds: {"x":0,"y":38,"width":1920,"height":1042}
Window maximized: true
Setting BrowserView bounds: {"x":0,"y":50,"width":1920,"height":992}
================================
```

**关键检查点**：
- ✅ `Window maximized: true` - 窗口应该是最大化的
- ✅ `Content bounds.width` 应该是屏幕宽度（如 1920）
- ✅ `Content bounds.height` 应该是屏幕高度减去标题栏（如 1042）
- ✅ `BrowserView bounds.width` 应该等于 `Content bounds.width`
- ✅ `BrowserView bounds.height` 应该等于 `Content bounds.height - 50`

### 4. 测试登录

1. 点击任意平台的"登录"按钮
2. 查看 BrowserView 是否占满整个窗口
3. 查看控制台日志中的尺寸信息

---

## 🎯 可能的问题和解决方案

### 问题 1：窗口没有最大化

**症状**：
```
Window maximized: false
Content bounds: {"width":1200,"height":800}
```

**解决**：
- 检查 `main.ts` 中的 `window.maximize()` 是否被调用
- 确保 `show: false` 在窗口配置中

### 问题 2：Content bounds 尺寸很小

**症状**：
```
Content bounds: {"width":1200,"height":800}
BrowserView bounds: {"width":1200,"height":750}
```

**解决**：
- 窗口可能没有真正最大化
- 尝试在 `ready-to-show` 事件中再次调用 `maximize()`

### 问题 3：BrowserView bounds 设置失败

**症状**：
- 日志显示正确的尺寸
- 但 BrowserView 仍然很小

**解决**：
- 检查是否有其他代码覆盖了 BrowserView 的尺寸
- 检查是否有 CSS 或其他样式影响

---

## 🔧 高级调试

### 在 BrowserView 中执行 JavaScript

添加以下代码到 `browser-view-manager.ts`：

```typescript
// 在 resizeBrowserView() 方法的最后添加
setTimeout(async () => {
  if (this.currentView) {
    const viewportSize = await this.currentView.webContents.executeJavaScript(`
      ({
        width: window.innerWidth,
        height: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio
      })
    `);
    log.info(`BrowserView viewport: ${JSON.stringify(viewportSize)}`);
  }
}, 1000);
```

这会显示 BrowserView 内部的实际视口尺寸。

---

## 📊 预期结果

### 正确的尺寸（1920x1080 屏幕）

```
Window bounds:
  width: 1920
  height: 1080

Content bounds:
  width: 1920
  height: 1042  (1080 - 38 标题栏)

BrowserView bounds:
  x: 0
  y: 50  (工具栏高度)
  width: 1920
  height: 992  (1042 - 50 工具栏)

BrowserView viewport:
  width: 1920
  height: 992
```

---

## ✅ 验证清单

- [ ] 重新编译成功
- [ ] 启动应用
- [ ] 查看日志中的窗口尺寸
- [ ] 确认 `Window maximized: true`
- [ ] 确认 Content bounds 是全屏尺寸
- [ ] 确认 BrowserView bounds 正确
- [ ] 测试登录，BrowserView 占满窗口

---

## 📞 如果问题仍然存在

### 收集信息

1. **截图**：
   - 窗口的实际显示
   - 开发者工具中的日志

2. **日志信息**：
   - Window bounds
   - Content bounds
   - BrowserView bounds
   - Window maximized 状态

3. **系统信息**：
   - 操作系统版本
   - 屏幕分辨率
   - 是否使用多显示器

### 临时解决方案

如果自动最大化不工作，可以尝试手动设置窗口大小：

```typescript
// 在 main.ts 中
const { screen } = require('electron');
const primaryDisplay = screen.getPrimaryDisplay();
const { width, height } = primaryDisplay.workAreaSize;

const windowConfig = {
  width: width,
  height: height,
  x: 0,
  y: 0,
  // ...
};
```

---

**重新启动应用并查看日志，应该能看到详细的调试信息！🔍**
