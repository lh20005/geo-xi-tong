# WebSocket 实时同步实施指南

## 方案概述

使用 WebSocket 实现服务器到客户端的实时推送，当任务状态变化或文章生成完成时，服务器主动通知 Windows 客户端。

## 架构设计

```
服务器端                          Windows 客户端
┌─────────────────┐              ┌─────────────────┐
│ WebSocket 服务器 │◄────────────►│ WebSocket 客户端 │
│ (Socket.IO)     │   连接认证    │ (Socket.IO)     │
└────────┬────────┘              └────────┬────────┘
         │                                │
         │ 1. 任务创建                     │
         ├───────────────────────────────►│ 刷新任务列表
         │                                │
         │ 2. 任务状态变化                 │
         ├───────────────────────────────►│ 更新任务状态
         │                                │
         │ 3. 文章生成完成                 │
         ├───────────────────────────────►│ 自动同步文章
         │                                │
         │ 4. 心跳检测                     │
         │◄───────────────────────────────┤
         │                                │
```

## 实施步骤

### 第一步：服务器端实现

#### 1.1 安装依赖

```bash
cd server
npm install socket.io
npm install --save-dev @types/socket.io
```

#### 1.2 创建 WebSocket 服务

**文件**: `server/src/services/WebSocketService.ts`

```typescript
import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import log from '../utils/logger';

interface AuthenticatedSocket extends Socket {
  userId?: number;
  username?: string;
}

export class WebSocketService {
  private io: SocketIOServer;
  private userSockets: Map<number, Set<string>> = new Map(); // userId -> Set<socketId>

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: '*', // 生产环境应该限制具体域名
        methods: ['GET', 'POST']
      },
      path: '/ws/socket.io' // 自定义路径，避免与其他 WebSocket 冲突
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  /**
   * 设置认证中间件
   */
  private setupMiddleware() {
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('认证失败：缺少 token'));
        }

        // 验证 JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number; username: string };
        
        socket.userId = decoded.userId;
        socket.username = decoded.username;
        
        log.info(`WebSocket: 用户 ${decoded.username} (ID: ${decoded.userId}) 连接成功`);
        next();
      } catch (error) {
        log.error('WebSocket: 认证失败', error);
        next(new Error('认证失败：token 无效'));
      }
    });
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers() {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      const userId = socket.userId!;
      const username = socket.username!;

      // 记录用户的 socket 连接
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(socket.id);

      log.info(`WebSocket: 用户 ${username} (ID: ${userId}) 已连接，socket ID: ${socket.id}`);
      log.info(`WebSocket: 用户 ${username} 当前连接数: ${this.userSockets.get(userId)!.size}`);

      // 加入用户专属房间
      socket.join(`user:${userId}`);

      // 处理心跳
      socket.on('ping', () => {
        socket.emit('pong', { timestamp: Date.now() });
      });

      // 处理断开连接
      socket.on('disconnect', (reason) => {
        log.info(`WebSocket: 用户 ${username} (ID: ${userId}) 断开连接，原因: ${reason}`);
        
        const userSocketSet = this.userSockets.get(userId);
        if (userSocketSet) {
          userSocketSet.delete(socket.id);
          if (userSocketSet.size === 0) {
            this.userSockets.delete(userId);
          }
        }
      });

      // 处理错误
      socket.on('error', (error) => {
        log.error(`WebSocket: 用户 ${username} (ID: ${userId}) 发生错误:`, error);
      });
    });
  }

  /**
   * 通知用户任务已创建
   */
  notifyTaskCreated(userId: number, taskData: any) {
    this.io.to(`user:${userId}`).emit('task:created', {
      type: 'task:created',
      data: taskData,
      timestamp: Date.now()
    });
    log.info(`WebSocket: 通知用户 ${userId} 任务已创建, task ID: ${taskData.id}`);
  }

  /**
   * 通知用户任务状态变化
   */
  notifyTaskStatusChanged(userId: number, taskId: number, status: string, data?: any) {
    this.io.to(`user:${userId}`).emit('task:statusChanged', {
      type: 'task:statusChanged',
      taskId,
      status,
      data,
      timestamp: Date.now()
    });
    log.info(`WebSocket: 通知用户 ${userId} 任务 ${taskId} 状态变化: ${status}`);
  }

  /**
   * 通知用户文章生成完成
   */
  notifyArticleGenerated(userId: number, taskId: number, articleData: any) {
    this.io.to(`user:${userId}`).emit('article:generated', {
      type: 'article:generated',
      taskId,
      data: articleData,
      timestamp: Date.now()
    });
    log.info(`WebSocket: 通知用户 ${userId} 文章生成完成, task ID: ${taskId}, article ID: ${articleData.id}`);
  }

  /**
   * 通知用户任务进度更新
   */
  notifyTaskProgress(userId: number, taskId: number, progress: number, message?: string) {
    this.io.to(`user:${userId}`).emit('task:progress', {
      type: 'task:progress',
      taskId,
      progress,
      message,
      timestamp: Date.now()
    });
  }

  /**
   * 获取用户在线状态
   */
  isUserOnline(userId: number): boolean {
    return this.userSockets.has(userId) && this.userSockets.get(userId)!.size > 0;
  }

  /**
   * 获取在线用户数
   */
  getOnlineUserCount(): number {
    return this.userSockets.size;
  }

  /**
   * 获取总连接数
   */
  getTotalConnectionCount(): number {
    let total = 0;
    this.userSockets.forEach(sockets => {
      total += sockets.size;
    });
    return total;
  }
}

// 导出单例
let webSocketService: WebSocketService | null = null;

export function initWebSocketService(httpServer: HTTPServer): WebSocketService {
  if (!webSocketService) {
    webSocketService = new WebSocketService(httpServer);
  }
  return webSocketService;
}

export function getWebSocketService(): WebSocketService {
  if (!webSocketService) {
    throw new Error('WebSocket 服务未初始化');
  }
  return webSocketService;
}
```

#### 1.3 在服务器入口初始化 WebSocket

**文件**: `server/src/index.ts`

```typescript
import express from 'express';
import http from 'http';
import { initWebSocketService } from './services/WebSocketService';

const app = express();
const httpServer = http.createServer(app);

// 初始化 WebSocket 服务
const wsService = initWebSocketService(httpServer);

// ... 其他中间件和路由配置

// 启动服务器
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`✅ 服务器启动成功: http://localhost:${PORT}`);
  console.log(`✅ WebSocket 服务已启动: ws://localhost:${PORT}/ws/socket.io`);
});
```

#### 1.4 在文章生成服务中集成 WebSocket 通知

**文件**: `server/src/services/ArticleGenerationService.ts`

```typescript
import { getWebSocketService } from './WebSocketService';

export class ArticleGenerationService {
  // ... 其他代码

  /**
   * 创建任务
   */
  async createTask(config: TaskConfig): Promise<number[]> {
    // ... 创建任务逻辑

    const taskIds = [/* 创建的任务 ID 列表 */];

    // 🔔 通知客户端任务已创建
    try {
      const wsService = getWebSocketService();
      for (const taskId of taskIds) {
        wsService.notifyTaskCreated(userId, {
          id: taskId,
          keyword: config.keyword,
          status: 'pending',
          requestedCount: 1
        });
      }
    } catch (error) {
      // WebSocket 通知失败不影响主流程
      log.warn('WebSocket 通知失败:', error);
    }

    return taskIds;
  }

  /**
   * 执行任务
   */
  async executeTask(taskId: number): Promise<void> {
    const task = await this.getTaskDetail(taskId);
    const userId = task.userId;

    try {
      // 🔔 通知任务开始执行
      const wsService = getWebSocketService();
      wsService.notifyTaskStatusChanged(userId, taskId, 'running');

      // ... 执行任务逻辑

      // 🔔 通知文章生成完成
      wsService.notifyArticleGenerated(userId, taskId, {
        id: articleId,
        title: article.title,
        content: article.content
      });

      // 🔔 通知任务完成
      wsService.notifyTaskStatusChanged(userId, taskId, 'completed', {
        generatedCount: 1
      });

    } catch (error) {
      // 🔔 通知任务失败
      const wsService = getWebSocketService();
      wsService.notifyTaskStatusChanged(userId, taskId, 'failed', {
        error: error.message
      });
      throw error;
    }
  }
}
```

### 第二步：Windows 客户端实现

#### 2.1 安装依赖

```bash
cd windows-login-manager
npm install socket.io-client
npm install --save-dev @types/socket.io-client
```

#### 2.2 创建 WebSocket 客户端服务

**文件**: `windows-login-manager/src/services/WebSocketClient.ts`

```typescript
import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../config/env';

type EventCallback = (data: any) => void;

export class WebSocketClient {
  private socket: Socket | null = null;
  private token: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private eventHandlers: Map<string, Set<EventCallback>> = new Map();

  /**
   * 连接到 WebSocket 服务器
   */
  connect(token: string) {
    if (this.socket?.connected) {
      console.log('[WebSocket] 已连接，跳过');
      return;
    }

    this.token = token;
    const wsUrl = API_BASE_URL.replace('/api', '').replace('http', 'ws');

    console.log('[WebSocket] 正在连接...', wsUrl);

    this.socket = io(wsUrl, {
      path: '/ws/socket.io',
      auth: {
        token: this.token
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts
    });

    this.setupEventHandlers();
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers() {
    if (!this.socket) return;

    // 连接成功
    this.socket.on('connect', () => {
      console.log('[WebSocket] ✅ 连接成功, socket ID:', this.socket?.id);
      this.reconnectAttempts = 0;
    });

    // 连接错误
    this.socket.on('connect_error', (error) => {
      console.error('[WebSocket] ❌ 连接错误:', error.message);
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('[WebSocket] 达到最大重连次数，停止重连');
        this.disconnect();
      }
    });

    // 断开连接
    this.socket.on('disconnect', (reason) => {
      console.log('[WebSocket] 断开连接，原因:', reason);
    });

    // 任务创建通知
    this.socket.on('task:created', (data) => {
      console.log('[WebSocket] 📬 收到任务创建通知:', data);
      this.emit('task:created', data);
    });

    // 任务状态变化通知
    this.socket.on('task:statusChanged', (data) => {
      console.log('[WebSocket] 📬 收到任务状态变化通知:', data);
      this.emit('task:statusChanged', data);
    });

    // 文章生成完成通知
    this.socket.on('article:generated', (data) => {
      console.log('[WebSocket] 📬 收到文章生成完成通知:', data);
      this.emit('article:generated', data);
    });

    // 任务进度通知
    this.socket.on('task:progress', (data) => {
      console.log('[WebSocket] 📬 收到任务进度通知:', data);
      this.emit('task:progress', data);
    });

    // 心跳响应
    this.socket.on('pong', (data) => {
      // console.log('[WebSocket] 💓 心跳响应:', data);
    });
  }

  /**
   * 断开连接
   */
  disconnect() {
    if (this.socket) {
      console.log('[WebSocket] 断开连接');
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * 发送心跳
   */
  ping() {
    if (this.socket?.connected) {
      this.socket.emit('ping');
    }
  }

  /**
   * 订阅事件
   */
  on(event: string, callback: EventCallback) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(callback);
  }

  /**
   * 取消订阅事件
   */
  off(event: string, callback: EventCallback) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(callback);
    }
  }

  /**
   * 触发事件
   */
  private emit(event: string, data: any) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[WebSocket] 事件处理器错误 (${event}):`, error);
        }
      });
    }
  }

  /**
   * 检查连接状态
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

// 导出单例
export const webSocketClient = new WebSocketClient();
```

#### 2.3 在应用启动时初始化 WebSocket

**文件**: `windows-login-manager/src/App.tsx`

```typescript
import { useEffect } from 'react';
import { webSocketClient } from './services/WebSocketClient';
import { storageManager } from './utils/storage';

function App() {
  useEffect(() => {
    // 初始化 WebSocket 连接
    const initWebSocket = async () => {
      try {
        const token = await storageManager.getAuthToken();
        if (token) {
          webSocketClient.connect(token);
          
          // 启动心跳
          const heartbeatInterval = setInterval(() => {
            webSocketClient.ping();
          }, 30000); // 每 30 秒发送一次心跳
          
          return () => {
            clearInterval(heartbeatInterval);
            webSocketClient.disconnect();
          };
        }
      } catch (error) {
        console.error('[App] WebSocket 初始化失败:', error);
      }
    };

    initWebSocket();
  }, []);

  return (
    // ... 应用组件
  );
}
```

#### 2.4 在文章生成页面监听 WebSocket 事件

**文件**: `windows-login-manager/src/pages/ArticleGenerationPage.tsx`

```typescript
import { useEffect } from 'react';
import { webSocketClient } from '../services/WebSocketClient';

export default function ArticleGenerationPage() {
  // ... 其他代码

  // 监听 WebSocket 事件
  useEffect(() => {
    // 任务创建通知
    const handleTaskCreated = (data: any) => {
      console.log('[文章生成] 收到任务创建通知:', data);
      message.info(`新任务已创建: ${data.data.keyword}`);
      
      // 刷新任务列表
      refreshTasks(true);
    };

    // 任务状态变化通知
    const handleTaskStatusChanged = (data: any) => {
      console.log('[文章生成] 收到任务状态变化通知:', data);
      
      // 更新任务状态
      setTasks(prevTasks => 
        prevTasks.map(task => 
          task.id === data.taskId 
            ? { ...task, status: data.status, ...data.data }
            : task
        )
      );

      // 如果任务完成，触发自动同步
      if (data.status === 'completed') {
        message.success(`任务 ${data.taskId} 已完成`);
        // 自动同步会在下一次轮询时触发
      }
    };

    // 文章生成完成通知
    const handleArticleGenerated = async (data: any) => {
      console.log('[文章生成] 收到文章生成完成通知:', data);
      
      // 立即同步这篇文章到本地
      try {
        const userId = await getCurrentUserId();
        if (!userId) return;

        const article = data.data;
        const taskId = data.taskId;

        // 检查是否已存在
        const checkResult = await localArticleApi.checkArticleExists(taskId, article.title);
        if (checkResult.data?.exists) {
          console.log('[文章生成] 文章已存在，跳过同步');
          return;
        }

        // 获取完整内容
        const articleResponse = await apiClient.get(`/article-generation/articles/${article.id}`);
        const content = articleResponse.data?.content || '';

        // 保存到本地
        await localArticleApi.create({
          userId,
          title: article.title,
          keyword: article.keyword || '',
          content,
          provider: 'deepseek',
          taskId
        });

        message.success(`文章《${article.title}》已自动同步到本地`);
        
        // 刷新文章列表（如果在文章管理页面）
        // 这里可以通过事件总线通知文章管理页面刷新
        
      } catch (error: any) {
        console.error('[文章生成] 自动同步文章失败:', error);
        message.error(`自动同步失败: ${error.message}`);
      }
    };

    // 订阅事件
    webSocketClient.on('task:created', handleTaskCreated);
    webSocketClient.on('task:statusChanged', handleTaskStatusChanged);
    webSocketClient.on('article:generated', handleArticleGenerated);

    // 清理
    return () => {
      webSocketClient.off('task:created', handleTaskCreated);
      webSocketClient.off('task:statusChanged', handleTaskStatusChanged);
      webSocketClient.off('article:generated', handleArticleGenerated);
    };
  }, [refreshTasks]);

  // ... 其他代码
}
```

### 第三步：Nginx 配置 WebSocket 代理

**文件**: `/etc/nginx/sites-available/geo-system`

```nginx
# WebSocket 升级配置
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}

server {
    listen 443 ssl http2;
    server_name www.jzgeo.cc;

    # ... SSL 配置

    # WebSocket 代理
    location /ws/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket 超时设置
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
        proxy_connect_timeout 60;
    }

    # ... 其他配置
}
```

## 测试步骤

### 1. 服务器端测试

```bash
# 1. 编译服务器代码
cd server
npm run build

# 2. 部署到服务器
scp -i "私钥" dist/services/WebSocketService.js ubuntu@124.221.247.107:/var/www/geo-system/server/services/

# 3. 重启服务
ssh -i "私钥" ubuntu@124.221.247.107 "pm2 restart geo-server"

# 4. 查看日志
ssh -i "私钥" ubuntu@124.221.247.107 "pm2 logs geo-server --lines 50"
```

### 2. 客户端测试

```bash
# 1. 编译客户端代码
cd windows-login-manager
npm run build  # 完整构建

# 2. 启动应用
npm run dev

# 3. 观察控制台日志
# 应该看到 "[WebSocket] ✅ 连接成功"
```

### 3. 功能测试

1. **连接测试**：
   - 启动应用
   - 检查控制台是否显示 WebSocket 连接成功
   - 检查服务器日志是否显示用户连接

2. **任务创建测试**：
   - 创建新的文章生成任务
   - 观察是否收到 `task:created` 通知
   - 检查任务列表是否自动刷新

3. **文章生成测试**：
   - 等待文章生成完成
   - 观察是否收到 `article:generated` 通知
   - 检查文章是否自动同步到本地
   - 检查文章管理页面是否显示新文章

4. **断线重连测试**：
   - 断开网络连接
   - 观察是否自动重连
   - 恢复网络后检查功能是否正常

## 优势对比

| 特性 | 轮询方案 | WebSocket 方案 |
|------|---------|---------------|
| 实时性 | 10秒延迟 | 即时（<1秒） |
| 服务器负载 | 高（频繁请求） | 低（长连接） |
| 网络流量 | 高 | 低 |
| 实现复杂度 | 简单 | 中等 |
| 可靠性 | 高 | 需要处理断线重连 |
| 扩展性 | 一般 | 好（支持更多实时功能） |

## 注意事项

1. **认证安全**：
   - WebSocket 连接必须验证 JWT token
   - Token 过期后需要重新连接

2. **错误处理**：
   - WebSocket 通知失败不应影响主流程
   - 需要有降级方案（回退到轮询）

3. **性能优化**：
   - 控制心跳频率（30秒一次）
   - 避免发送大量数据

4. **生产部署**：
   - Nginx 需要正确配置 WebSocket 代理
   - 注意防火墙规则
   - 监控 WebSocket 连接数

5. **兼容性**：
   - Socket.IO 自动降级到轮询（如果 WebSocket 不可用）
   - 需要测试各种网络环境

## 总结

WebSocket 方案是最优雅的长期解决方案，提供：
- ✅ 实时性：文章生成完成立即通知
- ✅ 低延迟：无需等待轮询周期
- ✅ 低负载：减少服务器压力
- ✅ 可扩展：支持更多实时功能

建议实施顺序：
1. **短期**：先实施方案1（轮询），快速解决问题
2. **中期**：实施方案3（WebSocket），提升用户体验
3. **长期**：优化 WebSocket 性能，添加更多实时功能
