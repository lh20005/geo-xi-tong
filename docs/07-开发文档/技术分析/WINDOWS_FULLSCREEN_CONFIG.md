# Windows 登录管理器全屏配置

## ✅ 已完成配置

Windows 登录管理器的主窗口现在会自动最大化显示。

---

## 🎯 修改内容

### 文件：`windows-login-manager/electron/main.ts`

在主窗口创建后添加了最大化调用：

```typescript
this.window = new BrowserWindow(windowConfig);

// 窗口创建后立即最大化
this.window.maximize();

logger.info('Main window created, maximized and shown');
```

---

## 📊 效果

### 启动时
- ✅ 主窗口会自动最大化
- ✅ 占满整个屏幕
- ✅ 保留窗口边框和标题栏

### 登录时
- ✅ BrowserView 会自动调整大小
- ✅ 占满窗口（除了顶部 50px 工具栏）
- ✅ 全屏显示登录页面

---

## 🔧 BrowserView 大小调整

BrowserView 的大小会自动根据主窗口大小调整：

```typescript
// 在 browser-view-manager.ts 中
private resizeBrowserView(): void {
  const bounds = this.parentWindow.getBounds();
  
  // 留出顶部50px空间用于显示控制栏
  const toolbarHeight = 50;
  this.currentView.setBounds({
    x: 0,
    y: toolbarHeight,
    width: bounds.width,
    height: bounds.height - toolbarHeight,
  });
}
```

---

## 🚀 如何使用

### 1. 重新启动 Windows 登录管理器

```bash
cd windows-login-manager
npm run dev
```

或者使用启动脚本：
```bash
./启动Windows管理器.command
```

### 2. 打开平台登录

- 点击任意平台的"登录"按钮
- 浏览器会以全屏模式打开
- 登录页面占满整个窗口

---

## 💡 其他选项

### 如果需要真正的全屏（无边框）

可以在窗口配置中添加：

```typescript
const windowConfig = {
  // ... 其他配置
  fullscreen: true,  // 真正的全屏，无边框
};
```

### 如果需要自定义窗口大小

可以修改初始大小：

```typescript
const windowConfig = {
  width: 1920,   // 自定义宽度
  height: 1080,  // 自定义高度
  // ...
};
```

---

## ✅ 验证清单

- [x] 主窗口创建后自动最大化
- [x] BrowserView 自动调整大小
- [x] 编译成功
- [x] 无 TypeScript 错误

---

## 📝 相关文件

- `windows-login-manager/electron/main.ts` - 主窗口配置
- `windows-login-manager/electron/login/browser-view-manager.ts` - BrowserView 管理

---

**Windows 登录管理器现在会以全屏模式显示！🎉**

重新启动应用即可看到效果。
