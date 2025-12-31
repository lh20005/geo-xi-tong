# 🧪 BrowserView 全屏显示快速测试

## 📋 测试步骤

### 1. 重新编译
```bash
cd windows-login-manager
npm run build:electron
```

### 2. 启动应用
```bash
npm run dev
```

### 3. 查看日志

应用启动后，开发者工具会自动打开。查看控制台，应该看到：

```
Main window created, maximized and shown
Window ready-to-show event fired
```

### 4. 测试登录

1. 点击任意平台的"登录"按钮
2. 查看控制台日志，应该看到：

```
=== BrowserView Resize Debug ===
Window bounds: {"x":0,"y":0,"width":1920,"height":1080}
Content bounds: {"x":0,"y":38,"width":1920,"height":1042}
Window maximized: true
Window fullscreen: false
Setting BrowserView bounds: {"x":0,"y":50,"width":1920,"height":992}
BrowserView resized successfully
================================
```

### 5. 验证显示

✅ **正确的显示**：
- BrowserView 占满整个窗口
- 只有顶部 50px 是工具栏
- 登录页面全屏显示
- 没有白色空白区域

❌ **错误的显示**：
- BrowserView 只在左上角一小块
- 大部分区域是白色
- 登录页面很小

---

## 🔍 检查日志

### 关键指标

| 指标 | 期望值 | 说明 |
|------|--------|------|
| Window maximized | `true` | 窗口应该是最大化的 |
| Content bounds.width | 屏幕宽度（如 1920） | 内容区域宽度 |
| Content bounds.height | 屏幕高度 - 标题栏（如 1042） | 内容区域高度 |
| BrowserView bounds.width | = Content bounds.width | BrowserView 宽度 |
| BrowserView bounds.height | = Content bounds.height - 50 | BrowserView 高度 |

### 示例（1920x1080 屏幕）

```json
{
  "windowBounds": {
    "x": 0,
    "y": 0,
    "width": 1920,
    "height": 1080
  },
  "contentBounds": {
    "x": 0,
    "y": 38,
    "width": 1920,
    "height": 1042
  },
  "browserViewBounds": {
    "x": 0,
    "y": 50,
    "width": 1920,
    "height": 992
  }
}
```

---

## 🐛 如果问题仍然存在

### 检查 1：窗口是否最大化

在控制台执行：
```javascript
// 在主窗口的开发者工具中
require('electron').remote.getCurrentWindow().isMaximized()
```

应该返回 `true`。

### 检查 2：手动触发 resize

在控制台执行：
```javascript
// 触发窗口 resize 事件
window.dispatchEvent(new Event('resize'));
```

然后查看日志中是否有新的 "BrowserView Resize Debug" 输出。

### 检查 3：查看 Electron 日志

日志文件位置：
- macOS: `~/Library/Logs/平台登录管理器/main.log`
- Windows: `%USERPROFILE%\AppData\Roaming\平台登录管理器\logs\main.log`
- Linux: `~/.config/平台登录管理器/logs/main.log`

---

## 📸 截图对比

### ✅ 正确的显示

```
┌─────────────────────────────────────────┐
│ [工具栏] 正在登录平台... [✕ 关闭浏览器] │ ← 50px
├─────────────────────────────────────────┤
│                                         │
│                                         │
│         登录页面（全屏显示）              │
│                                         │
│                                         │
│                                         │
└─────────────────────────────────────────┘
```

### ❌ 错误的显示

```
┌─────────────────────────────────────────┐
│ [工具栏] 正在登录平台... [✕ 关闭浏览器] │
├─────────────────────────────────────────┤
│ ┌──────┐                                │
│ │登录页│                                │
│ │面    │                                │
│ └──────┘                                │
│                                         │
│         （大片白色区域）                  │
│                                         │
└─────────────────────────────────────────┘
```

---

## 💡 快速修复尝试

如果显示不正确，尝试以下操作：

### 1. 手动最大化窗口
- 点击窗口的最大化按钮
- 或双击标题栏

### 2. 重新打开登录
- 关闭当前登录浏览器
- 重新点击"登录"按钮

### 3. 重启应用
- 完全关闭应用
- 重新启动

---

## 📞 报告问题

如果问题仍然存在，请提供：

1. **日志输出**（完整的 "BrowserView Resize Debug" 部分）
2. **截图**（显示实际的 BrowserView 大小）
3. **系统信息**：
   - 操作系统版本
   - 屏幕分辨率
   - 是否使用多显示器

---

**现在重新启动应用并测试！🚀**
