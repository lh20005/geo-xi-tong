# Electron 日志不写入问题修复

**日期**: 2026-01-17  
**问题**: 用户操作后没有生成新的日志，日志文件停留在 1月14日  
**状态**: ✅ 已修复

---

## 问题分析

### 症状

1. 日志文件路径：`~/Library/Application Support/ai-geo-system/logs/main.log`
2. 日志文件最后修改时间：2026-01-14 16:26
3. 用户在 1月17日操作应用，但没有生成新的日志记录

### 根本原因

**日志轮转逻辑问题**

在 `windows-login-manager/electron/logger/logger.ts` 中：

```typescript
private initializeLogger(): void {
  // 配置 electron-log
  log.transports.file.resolvePathFn = () => path.join(this.logPath, 'main.log');
  
  // 在配置之后才轮转日志
  this.rotateLogs();  // ❌ 问题：此时 electron-log 已经打开了文件
}
```

**问题**：
1. `electron-log` 在配置时就打开了 `main.log` 文件
2. 之后调用 `rotateLogs()` 尝试重命名文件
3. 但文件已经被 `electron-log` 锁定，无法重命名
4. 轮转失败，导致旧日志文件一直被使用
5. 如果旧日志文件很大或很旧，可能导致写入失败

### 日志轮转逻辑问题

原来的轮转逻辑：

```typescript
// 只有当文件数量 >= maxLogFiles 时才轮转
if (files.length >= this.maxLogFiles) {
  // 轮转当前日志
}
```

**问题**：
- 如果只有 1 个日志文件（main.log），永远不会轮转
- 旧日志文件会一直增长，直到达到 10MB
- 没有基于时间的轮转策略

---

## 解决方案

### 1. 调整初始化顺序

修改 `initializeLogger()` 方法：

```typescript
private initializeLogger(): void {
  // 确保日志目录存在
  if (!fs.existsSync(this.logPath)) {
    fs.mkdirSync(this.logPath, { recursive: true });
  }

  // ✅ 在配置 electron-log 之前轮转日志
  this.rotateLogs();

  // 配置 electron-log
  log.transports.file.level = 'info';
  log.transports.file.maxSize = this.maxLogSize;
  log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';
  log.transports.file.resolvePathFn = () => path.join(this.logPath, 'main.log');

  // Console transport
  log.transports.console.level = process.env.NODE_ENV === 'development' ? 'debug' : 'info';
  log.transports.console.format = '[{h}:{i}:{s}] [{level}] {text}';

  // ✅ 写入启动日志
  this.info('='.repeat(80));
  this.info(`Logger initialized - ${new Date().toISOString()}`);
  this.info(`Log path: ${this.logPath}`);
  this.info(`Node environment: ${process.env.NODE_ENV || 'production'}`);
  this.info('='.repeat(80));
}
```

**关键改进**：
- 在配置 `electron-log` 之前轮转日志
- 添加启动日志，确认日志系统正常工作
- 记录日志路径和环境信息

### 2. 改进轮转逻辑

修改 `rotateLogs()` 方法：

```typescript
private rotateLogs(): void {
  try {
    const mainLogPath = path.join(this.logPath, 'main.log');
    
    // 检查 main.log 是否存在且不为空
    if (fs.existsSync(mainLogPath)) {
      const stats = fs.statSync(mainLogPath);
      
      // ✅ 如果日志文件大于 1MB 或超过 1 天，则轮转
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      const shouldRotate = stats.size > 1024 * 1024 || stats.mtime.getTime() < oneDayAgo;
      
      if (shouldRotate) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const archiveName = `main.${timestamp}.log`;
        const archivePath = path.join(this.logPath, archiveName);
        
        // 归档当前日志
        fs.renameSync(mainLogPath, archivePath);
        console.log(`[Logger] Rotated log to: ${archiveName}`);
      }
    }

    // ✅ 清理旧日志文件（保留最近 5 个归档）
    const files = fs.readdirSync(this.logPath)
      .filter(f => f.startsWith('main') && f.endsWith('.log') && f !== 'main.log')
      .map(f => ({
        name: f,
        path: path.join(this.logPath, f),
        time: fs.statSync(path.join(this.logPath, f)).mtime.getTime(),
      }))
      .sort((a, b) => b.time - a.time);

    // 删除旧日志（保留最近 5 个归档）
    if (files.length > this.maxLogFiles) {
      files.slice(this.maxLogFiles).forEach(file => {
        try {
          fs.unlinkSync(file.path);
          console.log(`[Logger] Deleted old log: ${file.name}`);
        } catch (err) {
          console.error(`[Logger] Failed to delete old log: ${file.name}`, err);
        }
      });
    }
  } catch (err) {
    console.error('[Logger] Failed to rotate logs:', err);
  }
}
```

**关键改进**：
- 基于大小（1MB）和时间（1天）的轮转策略
- 只轮转需要轮转的日志文件
- 排除 `main.log` 本身，只清理归档文件
- 添加详细的 console.log 用于调试

---

## 测试步骤

### 1. 重新编译

```bash
cd windows-login-manager
npm run build:electron
```

### 2. 清理旧日志（可选）

```bash
# 备份旧日志
cp ~/Library/Application\ Support/ai-geo-system/logs/main.log ~/Desktop/main.log.backup

# 删除旧日志（让应用创建新的）
rm ~/Library/Application\ Support/ai-geo-system/logs/main.log
```

### 3. 启动应用

```bash
cd windows-login-manager
npm run dev
```

### 4. 验证日志

**查看启动日志**：
```bash
tail -f ~/Library/Application\ Support/ai-geo-system/logs/main.log
```

应该看到：
```
================================================================================
[2026-01-17 XX:XX:XX.XXX] [info] Logger initialized - 2026-01-17TXX:XX:XX.XXXZ
[2026-01-17 XX:XX:XX.XXX] [info] Log path: /Users/lzc/Library/Application Support/ai-geo-system/logs
[2026-01-17 XX:XX:XX.XXX] [info] Node environment: development
================================================================================
[2026-01-17 XX:XX:XX.XXX] [info] Initializing application...
```

**执行操作并验证**：
1. 登录应用
2. 创建相册
3. 上传图片
4. 查看日志文件是否有新记录

### 5. 验证轮转功能

**手动触发轮转**（可选）：
```bash
# 修改日志文件的修改时间为 2 天前
touch -t 202601150000 ~/Library/Application\ Support/ai-geo-system/logs/main.log

# 重启应用，应该会自动轮转
```

---

## 日志轮转策略

### 轮转条件

日志文件满足以下任一条件时会被轮转：

1. **大小超过 1MB**
2. **超过 1 天未更新**

### 归档命名

归档文件命名格式：`main.YYYY-MM-DDTHH-MM-SS.log`

示例：`main.2026-01-17T10-30-45.log`

### 保留策略

- 保留当前日志：`main.log`
- 保留最近 5 个归档文件
- 自动删除更旧的归档

### 日志目录结构

```
~/Library/Application Support/ai-geo-system/logs/
├── main.log                      # 当前日志
├── main.2026-01-17T10-30-45.log  # 归档 1
├── main.2026-01-16T15-20-30.log  # 归档 2
├── main.2026-01-15T09-10-15.log  # 归档 3
├── main.2026-01-14T14-05-20.log  # 归档 4
└── main.2026-01-13T11-00-00.log  # 归档 5
```

---

## 相关文件

- `windows-login-manager/electron/logger/logger.ts` - Logger 类实现
- `windows-login-manager/electron/main.ts` - 应用入口，初始化 Logger

---

## 后续优化建议

### 1. 添加日志级别配置

允许用户通过配置文件调整日志级别：

```typescript
// 从配置文件读取日志级别
const config = await storageManager.getConfig();
const logLevel = config.logLevel || 'info';
log.transports.file.level = logLevel;
```

### 2. 添加日志查看界面

在应用中添加日志查看功能：
- 查看当前日志
- 查看历史日志
- 导出日志
- 清理日志

### 3. 添加日志上传功能

当用户遇到问题时，可以一键上传日志到服务器：
- 压缩日志文件
- 上传到服务器
- 返回日志 ID 给用户

### 4. 添加性能日志

记录关键操作的性能指标：
- 数据库查询时间
- API 请求时间
- 文件上传时间
- 浏览器自动化操作时间

---

## 总结

这个问题的核心是 **日志轮转的时机不对**。解决方案是：

1. ✅ 在配置 `electron-log` 之前轮转日志
2. ✅ 改进轮转策略（基于大小和时间）
3. ✅ 添加启动日志确认系统正常
4. ✅ 添加详细的调试信息

修复后，应用每次启动都会：
- 检查是否需要轮转日志
- 创建新的日志文件（如果需要）
- 写入启动日志
- 正常记录所有操作

用户现在可以通过查看日志文件来调试问题。
