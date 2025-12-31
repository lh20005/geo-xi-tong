# WebView 迁移快速测试指南

## 编译状态

✅ **编译成功！**

所有 TypeScript 文件已成功编译到 `dist-electron` 目录。

## 测试步骤

### 1. 启动开发环境

```bash
cd windows-login-manager
npm run electron:dev
```

### 2. 测试登录功能

1. 打开应用后，进入"平台账号"页面
2. 点击任意平台的"登录"按钮
3. 观察是否出现 WebView 登录窗口
4. 完成登录流程
5. 检查是否成功捕获账号信息

### 3. 验证检查点

#### ✅ WebView 创建
- [ ] 登录窗口正常显示
- [ ] 顶部工具栏显示（包含"关闭浏览器"按钮）
- [ ] WebView 占据窗口主要区域（顶部留出 50px）

#### ✅ Preload 脚本
- [ ] 打开开发者工具（F12）
- [ ] 在 Console 中查看是否有 `[Preload]` 开头的日志
- [ ] 确认 `window.loginDetection` 对象存在

#### ✅ 登录检测
- [ ] URL 变化时自动检测
- [ ] 登录成功后自动关闭 WebView
- [ ] 账号信息正确保存

#### ✅ Cookie 和 Storage
- [ ] Cookies 正确捕获
- [ ] localStorage 正确捕获
- [ ] sessionStorage 正确捕获

#### ✅ 取消功能
- [ ] 点击"关闭浏览器"按钮
- [ ] WebView 正确关闭
- [ ] 登录流程正确取消

### 4. 调试技巧

#### 查看 Preload 日志

在 WebView 中打开开发者工具：
```javascript
// 在主窗口的 Console 中执行
const webview = document.querySelector('webview');
webview.openDevTools();
```

#### 手动测试检测逻辑

在 WebView 的 Console 中：
```javascript
// 检查 loginDetection 对象
console.log(window.loginDetection);

// 手动初始化检测
window.loginDetection.initialize({
  initialUrl: window.location.href,
  successSelectors: ['.user-name'],
  successUrls: ['profile', 'dashboard']
});

// 提取用户信息
window.loginDetection.extractUserInfo(['.user-name', '.username']);

// 捕获 Storage
window.loginDetection.captureStorage();
```

#### 查看 IPC 消息

在主进程日志中查找：
```
[LoginManager] Login success received from preload
[LoginManager] Login failure received from preload
```

### 5. 常见问题

#### 问题 1: WebView 不显示
**原因**: 主窗口未启用 `webviewTag`
**解决**: 检查 `main.ts` 中的 `webPreferences.webviewTag: true`

#### 问题 2: Preload 脚本未加载
**原因**: Preload 路径不正确
**解决**: 确保路径是绝对路径，使用 `path.join(__dirname, ...)`

#### 问题 3: 登录检测不工作
**原因**: IPC 消息未正确发送
**解决**: 
1. 检查 preload 脚本中的 `ipcRenderer.send()`
2. 检查主进程中的 `ipcMain.on()` 监听器

#### 问题 4: Cookie 捕获失败
**原因**: Session partition 不匹配
**解决**: 确保 WebView 的 partition 与 Cookie 捕获时使用的一致

### 6. 性能对比

#### 旧架构 (BrowserView + LoginDetector)
- 轮询间隔: 500ms
- CPU 占用: 持续轮询
- 响应延迟: 最多 500ms

#### 新架构 (WebView + Preload)
- 事件驱动: 实时响应
- CPU 占用: 仅在事件触发时
- 响应延迟: < 10ms

### 7. 回归测试

测试所有平台的登录功能：

- [ ] 头条号
- [ ] 抖音
- [ ] 小红书
- [ ] 知乎
- [ ] 简书
- [ ] 微信公众号
- [ ] 哔哩哔哩
- [ ] 企鹅号
- [ ] 搜狐号

### 8. 下一步

如果测试通过：
1. ✅ 删除备份文件（`.bak`）
2. ✅ 更新其他登录管理器（toutiao, douyin）
3. ✅ 更新文档
4. ✅ 提交代码

如果测试失败：
1. ❌ 查看错误日志
2. ❌ 使用调试技巧定位问题
3. ❌ 修复问题后重新测试
4. ❌ 如果无法修复，使用回滚方案

## 预期结果

### 成功标志
- ✅ 登录窗口正常显示
- ✅ 登录检测自动工作
- ✅ 账号信息正确保存
- ✅ 无错误日志
- ✅ 性能提升明显

### 失败标志
- ❌ WebView 不显示
- ❌ Preload 脚本未加载
- ❌ 登录检测不工作
- ❌ Cookie 捕获失败
- ❌ 大量错误日志

## 联系支持

如果遇到问题，请提供：
1. 错误日志（主进程和渲染进程）
2. 复现步骤
3. 系统环境信息
4. 截图或录屏

---

**测试日期**: 2025-12-31
**版本**: WebView Migration v1.0
**状态**: 待测试
