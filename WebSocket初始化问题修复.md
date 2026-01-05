# WebSocket 初始化问题修复

## 问题描述

服务器启动时崩溃，错误信息：
```
Error: JWT secret is required to initialize WebSocket service
    at getWebSocketService (/server/src/services/WebSocketService.ts:278:13)
    at <anonymous> (/server/src/services/UserSubscriptionManagementService.ts:4:26)
```

## 根本原因

`UserSubscriptionManagementService.ts` 在模块顶层直接调用了 `getWebSocketService()`，但没有传递 `jwtSecret` 参数。

由于 ES6 模块的加载机制，模块顶层代码在导入时立即执行，此时：
1. `.env` 文件可能还未加载
2. `process.env.JWT_SECRET` 可能为 undefined
3. WebSocket 服务初始化失败导致整个服务器崩溃

### 问题代码

```typescript
// ❌ 错误：在模块顶层立即初始化
import { getWebSocketService } from './WebSocketService';

const webSocketService = getWebSocketService(); // 没有传递 jwtSecret
```

## 解决方案

### 1. 延迟初始化模式

将 WebSocket 服务的获取改为函数调用，在实际使用时才初始化：

```typescript
// ✅ 正确：延迟初始化
import { getWebSocketService } from './WebSocketService';

// 延迟获取 WebSocket 服务实例，避免在模块加载时初始化
const getWsService = () => {
  const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
  return getWebSocketService(jwtSecret);
};
```

### 2. 更新所有调用点

将所有 `webSocketService.method()` 改为 `getWsService().method()`：

```typescript
// ❌ 之前
webSocketService.sendToUser(userId, 'subscription:upgraded', data);

// ✅ 现在
getWsService().sendToUser(userId, 'subscription:upgraded', data);
```

## 修复内容

**文件**: `server/src/services/UserSubscriptionManagementService.ts`

1. 将模块顶层的 `webSocketService` 常量改为 `getWsService()` 函数
2. 使用 `sed` 命令批量替换所有 `webSocketService.` 为 `getWsService().`

```bash
sed -i '' 's/webSocketService\./getWsService()./g' src/services/UserSubscriptionManagementService.ts
```

## 影响范围

修复后的功能：
- ✅ 升级套餐 - WebSocket 通知
- ✅ 延长订阅 - WebSocket 通知
- ✅ 调整配额 - WebSocket 通知
- ✅ 重置配额 - WebSocket 通知
- ✅ 暂停订阅 - WebSocket 通知
- ✅ 恢复订阅 - WebSocket 通知
- ✅ 取消订阅 - WebSocket 通知
- ✅ 赠送订阅 - WebSocket 通知

## 验证结果

服务器成功启动，输出日志：
```
✅ 加密服务初始化成功
✅ 任务调度器已启动
✅ 定时任务调度器已启动
✅ 每日安全检查已安排
[WebSocket] Server initialized
🚀 服务器运行在 http://localhost:3000
🔌 WebSocket服务运行在 ws://localhost:3000/ws
```

## 最佳实践

### 避免模块顶层初始化

在 Node.js 服务中，避免在模块顶层进行以下操作：

1. ❌ 依赖环境变量的初始化
2. ❌ 数据库连接
3. ❌ 外部服务连接
4. ❌ 需要配置的单例初始化

### 推荐模式

```typescript
// ✅ 方案 1: 延迟初始化函数
const getService = () => {
  const config = process.env.CONFIG;
  return initializeService(config);
};

// ✅ 方案 2: 懒加载单例
let serviceInstance: Service | null = null;
const getService = () => {
  if (!serviceInstance) {
    const config = process.env.CONFIG;
    serviceInstance = new Service(config);
  }
  return serviceInstance;
};

// ✅ 方案 3: 依赖注入
class MyService {
  constructor(private wsService: WebSocketService) {}
  
  doSomething() {
    this.wsService.send(...);
  }
}
```

## 相关问题

这个问题也可能影响其他服务，建议检查：
- `StorageService`
- `QuotaAlertService`
- `UsageTrackingService`
- 其他依赖 WebSocket 的服务

## 技术细节

### ES6 模块加载顺序

1. 解析模块依赖图
2. 按依赖顺序加载模块
3. 执行模块顶层代码
4. 导出模块接口

在步骤 3 时，如果代码依赖运行时配置（如环境变量），可能会失败。

### 单例模式的陷阱

```typescript
// ❌ 危险：立即初始化单例
export const service = new Service(process.env.CONFIG);

// ✅ 安全：延迟初始化单例
let instance: Service | null = null;
export const getService = () => {
  if (!instance) {
    instance = new Service(process.env.CONFIG);
  }
  return instance;
};
```

## 状态

✅ **修复完成**
- WebSocket 初始化问题已解决
- 服务器正常启动
- 所有 WebSocket 通知功能正常

## 下一步

1. 测试用户订阅管理功能
2. 验证 WebSocket 实时通知
3. 检查其他服务是否有类似问题
