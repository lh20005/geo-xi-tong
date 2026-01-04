import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import jwt from 'jsonwebtoken';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: number;
  username?: string;
}

interface WebSocketMessage {
  type: string;
  data: any;
}

export class WebSocketService {
  private wss: WebSocketServer | null = null;
  private connections: Map<number, Set<AuthenticatedWebSocket>> = new Map();
  private jwtSecret: string;

  constructor(jwtSecret: string) {
    this.jwtSecret = jwtSecret;
  }

  /**
   * 初始化 WebSocket 服务器
   */
  initialize(server: Server): void {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws',
      // 添加验证选项，允许所有来源（因为我们通过 JWT 验证）
      verifyClient: (info) => {
        // 允许所有连接尝试，在连接后验证 JWT
        return true;
      }
    });

    this.wss.on('connection', (ws: AuthenticatedWebSocket, req) => {
      console.log('[WebSocket] New connection attempt from:', req.headers.origin || 'unknown origin');

      // 从 URL 参数或 header 中获取 token
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const token = url.searchParams.get('token') || req.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        console.log('[WebSocket] No token provided, closing connection');
        ws.close(1008, 'Authentication required');
        return;
      }

      try {
        // 验证 JWT token
        const decoded = jwt.verify(token, this.jwtSecret) as { userId: number; username: string };
        ws.userId = decoded.userId;
        ws.username = decoded.username;

        console.log(`[WebSocket] ✅ User ${decoded.username} (ID: ${decoded.userId}) authenticated`);

        // 订阅用户
        this.subscribe(decoded.userId, ws);

        // 发送连接成功消息
        this.sendToClient(ws, {
          type: 'connected',
          data: {
            message: 'WebSocket connection established',
            userId: decoded.userId
          }
        });

        // 处理客户端消息
        ws.on('message', (message: Buffer) => {
          try {
            const data = JSON.parse(message.toString());
            this.handleClientMessage(ws, data);
          } catch (error) {
            console.error('[WebSocket] Error parsing message:', error);
          }
        });

        // 处理连接关闭
        ws.on('close', (code, reason) => {
          if (ws.userId) {
            console.log(`[WebSocket] User ${ws.username} (ID: ${ws.userId}) disconnected (code: ${code})`);
            this.unsubscribe(ws.userId, ws);
          }
        });

        // 处理错误
        ws.on('error', (error) => {
          console.error('[WebSocket] Connection error for user', ws.userId, ':', error.message);
          if (ws.userId) {
            this.unsubscribe(ws.userId, ws);
          }
        });

        // 心跳检测
        ws.on('pong', () => {
          // 客户端响应了 ping
        });

      } catch (error) {
        console.error('[WebSocket] Authentication failed:', error instanceof Error ? error.message : error);
        ws.close(1008, 'Invalid token');
      }
    });

    // 定期清理死连接
    setInterval(() => {
      this.wss?.clients.forEach((ws: WebSocket) => {
        const authWs = ws as AuthenticatedWebSocket;
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        } else if (authWs.userId) {
          this.unsubscribe(authWs.userId, authWs);
        }
      });
    }, 30000); // 每30秒检查一次

    console.log('[WebSocket] Server initialized');
  }

  /**
   * 订阅用户连接
   */
  private subscribe(userId: number, ws: AuthenticatedWebSocket): void {
    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Set());
    }
    this.connections.get(userId)!.add(ws);
    console.log(`[WebSocket] User ${userId} subscribed. Total connections: ${this.connections.get(userId)!.size}`);
  }

  /**
   * 取消订阅用户连接
   */
  private unsubscribe(userId: number, ws: AuthenticatedWebSocket): void {
    const userConnections = this.connections.get(userId);
    if (userConnections) {
      userConnections.delete(ws);
      if (userConnections.size === 0) {
        this.connections.delete(userId);
      }
      console.log(`[WebSocket] User ${userId} unsubscribed. Remaining connections: ${userConnections.size}`);
    }
  }

  /**
   * 处理客户端消息
   */
  private handleClientMessage(ws: AuthenticatedWebSocket, message: WebSocketMessage): void {
    console.log(`[WebSocket] Received message from user ${ws.userId}:`, message.type);

    switch (message.type) {
      case 'ping':
        this.sendToClient(ws, { type: 'pong', data: { timestamp: Date.now() } });
        break;
      case 'subscribe':
        // 客户端可以订阅特定事件
        break;
      default:
        console.log(`[WebSocket] Unknown message type: ${message.type}`);
    }
  }

  /**
   * 发送消息给特定客户端
   */
  private sendToClient(ws: WebSocket, message: WebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * 发送消息给特定用户
   */
  sendToUser(userId: number, event: string, data: any): void {
    this.broadcast(userId, event, data);
  }

  /**
   * 广播消息给特定用户的所有连接
   */
  broadcast(userId: number, event: string, data: any): void {
    const userConnections = this.connections.get(userId);
    if (!userConnections || userConnections.size === 0) {
      console.log(`[WebSocket] No active connections for user ${userId}`);
      return;
    }

    const message: WebSocketMessage = {
      type: event,
      data
    };

    const messageStr = JSON.stringify(message);
    let sentCount = 0;

    userConnections.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
        sentCount++;
      }
    });

    console.log(`[WebSocket] Broadcasted ${event} to user ${userId} (${sentCount}/${userConnections.size} connections)`);
  }

  /**
   * 广播消息给所有连接的用户
   */
  broadcastToAll(event: string, data: any): void {
    const message: WebSocketMessage = {
      type: event,
      data
    };

    const messageStr = JSON.stringify(message);
    let sentCount = 0;

    this.wss?.clients.forEach((ws: WebSocket) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
        sentCount++;
      }
    });

    console.log(`[WebSocket] Broadcasted ${event} to all users (${sentCount} connections)`);
  }

  /**
   * 广播账号事件给账号所属用户（多租户隔离）
   */
  broadcastAccountEvent(eventType: 'created' | 'updated' | 'deleted', account: any, userId?: number): void {
    // 如果提供了userId，只发送给该用户；否则从account中提取user_id
    const targetUserId = userId || account.user_id;
    
    if (!targetUserId) {
      console.warn('[WebSocket] 无法确定账号所属用户，跳过广播');
      return;
    }
    
    // 只广播给账号所属的用户（多租户隔离）
    this.broadcast(targetUserId, `account.${eventType}`, account);
  }

  /**
   * 获取在线用户数
   */
  getOnlineUsersCount(): number {
    return this.connections.size;
  }

  /**
   * 获取特定用户的连接数
   */
  getUserConnectionsCount(userId: number): number {
    return this.connections.get(userId)?.size || 0;
  }

  /**
   * 关闭服务器
   */
  close(): void {
    this.wss?.close();
    this.connections.clear();
    console.log('[WebSocket] Server closed');
  }
}

// 单例实例
let webSocketServiceInstance: WebSocketService | null = null;

export function getWebSocketService(jwtSecret?: string): WebSocketService {
  if (!webSocketServiceInstance) {
    if (!jwtSecret) {
      throw new Error('JWT secret is required to initialize WebSocket service');
    }
    webSocketServiceInstance = new WebSocketService(jwtSecret);
  }
  return webSocketServiceInstance;
}
