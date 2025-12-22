# WebSocket 安全认证实现总结

## 已完成的修改

### 1. 后端 WebSocket 服务 ✅

**文件：** `server/src/services/WebSocketService.ts`

**修改内容：**
- ✅ 添加客户端类型支持（user, app, anonymous）
- ✅ 实现双层认证（用户JWT + 应用Secret）
- ✅ 实现签名验证（防止重放攻击）
- ✅ 更新broadcast方法支持客户端类型过滤
- ✅ 更新broadcastAccountEvent只发送给已认证客户端

**关键代码：**
```typescript
interface Client {
  ws: WebSocket;
  type: 'user' | 'app' | 'anonymous';
  userId?: number;
  username?: string;
  appId?: string;
  isAlive: boolean;
  connectedAt: Date;
}

// 用户认证
private handleUserAuth(ws: WebSocket, token: string): void {
  const decoded = jwt.verify(token, JWT_SECRET);
  client.type = 'user';
  client.userId = decoded.userId;
}

// 应用认证
private handleAppAuth(ws: WebSocket, appId, secret, timestamp, signature): void {
  // 验证签名
  if (!this.verifySignature(appId, timestamp, signature, APP_SECRET)) {
    throw new Error('签名验证失败');
  }
  // 验证密钥
  if (secret !== APP_SECRET) {
    throw new Error('应用密钥无效');
  }
  client.type = 'app';
  client.appId = appId;
}

// 广播给已认证客户端
public broadcastAccountEvent(event, account): void {
  this.broadcast(message, true, ['user', 'app']);
}
```

### 2. Windows端存储管理器 ✅

**文件：** `windows-login-manager/electron/storage/manager.ts`

**修改内容：**
- ✅ 添加 `getOrGenerateAppSecret()` 方法
- ✅ 添加 `rotateAppSecret()` 方法

**关键代码：**
```typescript
async getOrGenerateAppSecret(): Promise<string> {
  let appSecret = store.get('app_secret') as string;
  
  if (!appSecret) {
    const crypto = require('crypto');
    appSecret = crypto.randomBytes(32).toString('hex');
    store.set('app_secret', appSecret);
    log.info('Generated new app secret');
  }
  
  return appSecret;
}
```

### 3. Windows端 WebSocket 客户端 ⚠️ 部分完成

**文件：** `windows-login-manager/electron/websocket/client.ts`

**已修改：**
- ✅ 添加 `authType` 字段
- ✅ 添加 `appId` 和 `appSecret` 字段
- ✅ 添加 `connectAsUser()` 和 `connectAsApp()` 方法
- ✅ 修改 `connect()` 方法为私有

**需要手动修改：**
由于文件已被多次修改，需要手动更新 `authenticate()` 方法：

```typescript
// 在 windows-login-manager/electron/websocket/client.ts 中
// 找到 authenticate() 方法，替换为：

private authenticate(): void {
  if (this.authType === 'user') {
    // 用户认证（JWT）
    if (!this.token) {
      log.warn('No token available for user authentication');
      return;
    }

    this.send({
      type: 'auth',
      data: {
        type: 'user',
        token: this.token
      }
    });
    
    log.info('Sent user authentication request');
  } else if (this.authType === 'app') {
    // 应用认证（App Secret + Signature）
    if (!this.appSecret) {
      log.warn('No app secret available for app authentication');
      return;
    }

    // 生成签名
    const timestamp = Date.now();
    const signature = this.generateSignature(this.appId, timestamp, this.appSecret);

    this.send({
      type: 'auth',
      data: {
        type: 'app',
        appId: this.appId,
        secret: this.appSecret,
        timestamp,
        signature
      }
    });
    
    log.info('Sent app authentication request');
  }
}

// 添加签名生成方法
private generateSignature(appId: string, timestamp: number, secret: string): string {
  const crypto = require('crypto');
  const message = `${appId}:${timestamp}`;
  return crypto.createHmac('sha256', secret).update(message).digest('hex');
}
```

### 4. Windows端 WebSocket 管理器 ⚠️ 需要修改

**文件：** `windows-login-manager/electron/websocket/manager.ts`

**需要修改：**
```typescript
// 找到 initialize() 方法，修改为：

async initialize(config: WebSocketManagerConfig): Promise<void> {
  try {
    log.info('Initializing WebSocket Manager...');
    
    // 获取应用密钥
    const appSecret = await storageManager.getOrGenerateAppSecret();
    
    // Create WebSocket client if not exists
    if (!this.wsClient) {
      this.wsClient = new WebSocketClient(config.serverUrl);
      this.setupEventHandlers();
    }

    // 使用应用认证连接
    this.wsClient.connectAsApp(appSecret);
    
    log.info('WebSocket Manager initialized successfully');
  } catch (error) {
    this.lastError = error instanceof Error ? error.message : 'Unknown error';
    log.error('Failed to initialize WebSocket Manager:', error);
    throw error;
  }
}
```

### 5. Windows端主程序 ⚠️ 需要修改

**文件：** `windows-login-manager/electron/main.ts`

**需要修改：**
```typescript
// 找到 initializeWebSocket() 方法，修改为：

private async initializeWebSocket(): Promise<void> {
  try {
    logger.info('Initializing WebSocket connection...');
    
    // 获取配置
    const config = await storageManager.getConfig();
    
    if (!config || !config.serverUrl) {
      logger.warn('No server URL configured, skipping WebSocket initialization');
      return;
    }
    
    // 派生WebSocket URL
    const wsUrl = this.deriveWebSocketUrl(config.serverUrl);
    
    // 初始化WebSocket管理器（使用应用认证）
    await wsManager.initialize({
      serverUrl: wsUrl,
      token: '' // token字段不再使用，由manager内部处理
    });
    
    logger.info('WebSocket connection initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize WebSocket connection:', error);
    // 不抛出错误，允许应用继续运行
  }
}
```

## 环境变量配置

**文件：** `server/.env`

添加以下配置：
```bash
# 应用密钥（用于Windows端认证）
APP_SECRET=your-app-secret-change-in-production-use-64-chars-minimum
```

**生成安全的密钥：**
```bash
# 在终端运行
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 测试步骤

### 1. 重启后端服务
```bash
cd server
# 停止当前进程
# 重新启动
npm run dev
```

### 2. 重启Windows客户端
```bash
cd windows-login-manager
# 停止当前进程
# 重新启动
npm run electron:dev
```

### 3. 测试认证

**查看日志：**
- 后端应显示：`✅ 应用认证成功: windows-login-manager`
- Windows端应显示：`Sent app authentication request` 和 `WebSocket authentication successful`

### 4. 测试实时同步

**Windows端删除账号：**
1. 在Windows客户端删除一个账号
2. 观察网页端是否自动更新

**网页端创建账号：**
1. 在网页端创建一个账号
2. 观察Windows端是否自动更新

**预期日志：**
```
# 后端
📡 广播消息: account.deleted (发送给 2 个客户端)

# Windows端
[info] Received account event: account.deleted
[info] Account deleted from cache: 123

# 网页端
Account deleted: {id: 123}
账号已被删除
```

## 安全检查

### ✅ 已实现
- [x] 双层认证（用户 + 应用）
- [x] 签名验证（防重放攻击）
- [x] 时间戳验证（60秒有效期）
- [x] 客户端类型区分
- [x] 只向已认证客户端广播

### ⚠️ 待实现
- [ ] 环境变量配置APP_SECRET
- [ ] 手动修改Windows端代码
- [ ] 测试认证流程
- [ ] 测试实时同步

### 🔒 生产环境
- [ ] 使用wss://（TLS/SSL）
- [ ] 配置强密钥（64字符+）
- [ ] 启用连接限制
- [ ] 监控和日志

## 故障排除

### 问题1：Windows端认证失败
**症状：** `应用认证失败: 签名验证失败`

**原因：** 应用密钥不匹配

**解决：**
1. 检查后端 `.env` 文件中的 `APP_SECRET`
2. 删除Windows端存储的密钥：删除 `~/Library/Application Support/windows-login-manager/config.json` 中的 `app_secret`
3. 重启Windows客户端，会重新生成密钥
4. 将生成的密钥配置到后端 `.env`

### 问题2：时间戳过期
**症状：** `签名时间戳过期`

**原因：** 客户端和服务器时间不同步

**解决：**
1. 同步系统时间
2. 或增加时间戳有效期（不推荐）

### 问题3：网页端无法接收事件
**症状：** 网页端不更新

**原因：** 网页端未认证或认证失败

**解决：**
1. 检查网页端是否登录
2. 检查JWT token是否有效
3. 查看浏览器控制台WebSocket连接状态

## 下一步

1. **手动修改代码**：按照上面的说明修改Windows端代码
2. **配置环境变量**：在 `server/.env` 中添加 `APP_SECRET`
3. **重启服务**：重启后端和Windows客户端
4. **测试功能**：测试认证和实时同步
5. **查看文档**：参考 `WEBSOCKET_SECURITY_DESIGN.md` 了解完整设计

---

**实现日期：** 2025-12-22  
**状态：** 后端完成，Windows端需要手动修改  
**优先级：** 高（影响实时同步功能）
