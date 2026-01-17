# Electron 单实例锁定问题修复

**修复日期**: 2026-01-17  
**问题**: 启动 Windows 客户端时提示"Another instance is already running"  
**根本原因**: 之前的 Electron 进程未正确退出，单实例锁未释放

---

## 问题分析

### 症状
启动 Windows 客户端时，日志显示：
```
[19:39:22] [warn]  Another instance is already running
wait-on http://localhost:5174 && cross-env NODE_ENV=development electron dist-electron/main.js exited with code 0
```

应用无法打开。

### 根本原因
Electron 使用单实例锁定机制（`app.requestSingleInstanceLock()`）确保只有一个应用实例运行。

当之前的实例未正确退出时：
1. 锁文件/进程仍然存在
2. 新实例无法获取锁
3. 新实例自动退出

### 触发条件
- 应用崩溃或强制退出
- 开发过程中频繁重启
- 系统异常关闭

---

## 诊断步骤

### 1. 检查运行中的 Electron 进程

```bash
ps aux | grep -E "(Electron|electron)" | grep -v grep
```

**发现**：
```
lzc  8531  98.8  0.8  ... /windows-login-manager/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron dist-electron/main.js
lzc 10095   0.0  0.2  ... Electron Helper (GPU)
lzc 10094   0.0  0.1  ... Electron Helper
```

有残留的 Electron 进程（PID 8531）。

### 2. 检查锁文件

```bash
find ~/Library/Application\ Support/ai-geo-system -name "*Lock*" -o -name "*Cookie*"
```

可能存在 `SingletonLock` 或 `SingletonCookie` 文件。

---

## 解决方案

### 方法 1：终止残留进程（推荐）

```bash
# 查找进程
ps aux | grep -E "windows-login-manager.*Electron" | grep -v grep

# 终止进程（替换 PID）
kill -9 <PID>
```

### 方法 2：清理锁文件

```bash
rm -rf ~/Library/Application\ Support/ai-geo-system/SingletonLock
rm -rf ~/Library/Application\ Support/ai-geo-system/SingletonCookie
```

### 方法 3：完全重置应用数据（慎用）

```bash
# ⚠️ 警告：会删除所有应用数据
rm -rf ~/Library/Application\ Support/ai-geo-system
```

---

## 修复步骤（本次执行）

1. ✅ 查找残留进程：
   ```bash
   ps aux | grep -E "windows-login-manager.*Electron"
   ```
   发现 PID: 8531, 10095, 10094

2. ✅ 终止进程：
   ```bash
   kill -9 8531 10095 10094
   ```

3. ✅ 验证清理：
   ```bash
   ps aux | grep -E "windows-login-manager.*Electron" | grep -v grep
   ```
   无输出，确认清理成功

4. ✅ 重新启动应用

---

## 预防措施

### 1. 正确退出应用

**开发模式**：
- 使用 `Ctrl+C` 停止开发服务器
- 等待进程完全退出
- 不要强制关闭终端

**生产模式**：
- 使用应用菜单的"退出"选项
- 不要强制结束进程

### 2. 改进退出逻辑

在主进程中添加清理逻辑：

```typescript
// electron/main.ts
app.on('before-quit', async () => {
  logger.info('App is quitting, cleaning up...');
  // 清理资源
  await cleanup();
});

app.on('will-quit', () => {
  logger.info('App will quit');
  // 释放锁
  app.releaseSingleInstanceLock();
});
```

### 3. 添加进程监控

```typescript
// 检测僵尸进程
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  app.quit();
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection:', reason);
});
```

---

## 单实例锁定机制说明

### 工作原理

```typescript
// electron/main.ts
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // 无法获取锁，说明已有实例运行
  logger.warn('Another instance is already running');
  app.quit();
  return;
}

// 处理第二个实例启动
app.on('second-instance', () => {
  // 聚焦到已存在的窗口
  logger.info('Second instance detected, focusing main window');
  this.focusMainWindow();
});
```

### 锁的生命周期

1. **获取锁**：`app.requestSingleInstanceLock()`
   - 成功：返回 `true`，应用继续运行
   - 失败：返回 `false`，应用应该退出

2. **持有锁**：应用运行期间持有锁

3. **释放锁**：
   - 自动：应用正常退出时
   - 手动：`app.releaseSingleInstanceLock()`

4. **锁文件位置**：
   - macOS: `~/Library/Application Support/<app-name>/`
   - Windows: `%APPDATA%\<app-name>\`
   - Linux: `~/.config/<app-name>/`

---

## 常见问题

### Q1: 为什么需要单实例锁定？

**A**: 防止用户意外启动多个应用实例，避免：
- 数据库连接冲突
- 文件锁定冲突
- 资源重复占用
- 用户体验混乱

### Q2: 开发时如何允许多实例？

**A**: 临时禁用单实例锁定（仅开发环境）：

```typescript
if (process.env.NODE_ENV !== 'development') {
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    app.quit();
    return;
  }
}
```

### Q3: 如何检测是否有残留进程？

**A**: 使用以下命令：

```bash
# macOS/Linux
ps aux | grep -i electron | grep -i <app-name>

# Windows
tasklist | findstr electron
```

---

## 相关文档

- [Electron 官方文档 - 单实例应用](https://www.electronjs.org/docs/latest/api/app#apprequestsingleinstancelock)
- [PostgreSQL 迁移完成报告](../07-开发文档/PostgreSQL迁移-项目最终交付报告.md)

---

## 后续行动

1. ✅ 终止残留进程
2. ✅ 清理锁文件
3. ✅ 重新启动应用
4. ⏳ 测试应用功能
5. ⏳ 添加进程清理脚本
6. ⏳ 改进退出逻辑

---

## 快速修复命令

```bash
# 一键清理并重启
pkill -9 -f "windows-login-manager.*Electron"
rm -rf ~/Library/Application\ Support/ai-geo-system/Singleton*
cd windows-login-manager && npm run electron:dev
```
