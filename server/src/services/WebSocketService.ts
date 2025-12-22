import { Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

interface Client {
  ws: WebSocket;
  userId?: number;
  username?: string;
  isAlive: boolean;
}

export class WebSocketService {
  private static instance: WebSocketService;
  private wss: WebSocketServer | null = null;
  private clients: Map<WebSocket, Client> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  /**
   * 初始化WebSocket服务器
   */
  public initialize(server: HTTPServer): void {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: WebSocket, req) => {
      console.log('新的WebSocket连接');

      // 初始化客户端
      const client: Client = {
        ws,
        isAlive: true
      };
      this.clients.set(ws, client);

      // 处理消息
      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(ws, message);
        } catch (error) {
          console.error('解析WebSocket消息失败:', error);
          this.sendError(ws, '无效的消息格式');
        }
      });

      // 处理pong响应
      ws.on('pong', () => {
        const client = this.clients.get(ws);
        if (client) {
          client.isAlive = true;
        }
      });

      // 处理关闭
      ws.on('close', () => {
        console.log('WebSocket连接关闭');
        this.clients.delete(ws);
      });

      // 处理错误
      ws.on('error', (error) => {
        console.error('WebSocket错误:', error);
        this.clients.delete(ws);
      });

      // 发送欢迎消息
      this.send(ws, {
        type: 'connected',
        message: '连接成功',
        timestamp: new Date().toISOString()
      });
    });

    // 启动心跳检测
    this.startHeartbeat();

    console.log('✅ WebSocket服务器初始化成功');
  }

  /**
   * 处理客户端消息
   */
  private handleMessage(ws: WebSocket, message: any): void {
    const { type, data } = message;

    switch (type) {
      case 'auth':
        this.handleAuth(ws, data);
        break;
      case 'ping':
        this.send(ws, { type: 'pong', timestamp: new Date().toISOString() });
        break;
      case 'subscribe':
        this.handleSubscribe(ws, data);
        break;
      default:
        this.sendError(ws, `未知的消息类型: ${type}`);
    }
  }

  /**
   * 处理认证
   */
  private handleAuth(ws: WebSocket, data: any): void {
    try {
      const { token } = data;

      if (!token) {
        this.sendError(ws, '缺少认证令牌');
        return;
      }

      // 验证JWT令牌
      const decoded: any = jwt.verify(token, JWT_SECRET);
      
      // 更新客户端信息
      const client = this.clients.get(ws);
      if (client) {
        client.userId = decoded.userId;
        client.username = decoded.username;
      }

      this.send(ws, {
        type: 'auth_success',
        message: '认证成功',
        user: {
          id: decoded.userId,
          username: decoded.username
        }
      });

      console.log(`用户 ${decoded.username} 认证成功`);
    } catch (error) {
      this.sendError(ws, '认证失败: 令牌无效或已过期');
    }
  }

  /**
   * 处理订阅
   */
  private handleSubscribe(ws: WebSocket, data: any): void {
    const { channels } = data;

    if (!Array.isArray(channels)) {
      this.sendError(ws, '订阅频道必须是数组');
      return;
    }

    this.send(ws, {
      type: 'subscribed',
      channels,
      message: '订阅成功'
    });

    console.log(`客户端订阅频道: ${channels.join(', ')}`);
  }

  /**
   * 广播消息给所有已认证的客户端
   */
  public broadcast(message: any): void {
    this.clients.forEach((client) => {
      if (client.userId && client.ws.readyState === WebSocket.OPEN) {
        this.send(client.ws, message);
      }
    });
  }

  /**
   * 广播账号相关事件
   */
  public broadcastAccountEvent(event: 'created' | 'updated' | 'deleted', account: any): void {
    const message = {
      type: `account.${event}`,
      data: account,
      timestamp: new Date().toISOString()
    };

    this.broadcast(message);
    
    const authenticatedCount = this.getAuthenticatedClientCount();
    console.log(`[WebSocket] 广播账号事件: account.${event}`, {
      accountId: account.id,
      authenticatedClients: authenticatedCount,
      totalClients: this.getClientCount()
    });
  }

  /**
   * 发送消息给特定客户端
   */
  private send(ws: WebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * 发送错误消息
   */
  private sendError(ws: WebSocket, message: string): void {
    this.send(ws, {
      type: 'error',
      message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 启动心跳检测
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.clients.forEach((client, ws) => {
        if (!client.isAlive) {
          console.log('客户端心跳超时，断开连接');
          ws.terminate();
          this.clients.delete(ws);
          return;
        }

        client.isAlive = false;
        ws.ping();
      });
    }, 30000); // 每30秒检查一次

    console.log('✅ WebSocket心跳检测已启动');
  }

  /**
   * 停止心跳检测
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * 关闭WebSocket服务器
   */
  public close(): void {
    this.stopHeartbeat();

    if (this.wss) {
      this.wss.clients.forEach((ws) => {
        ws.close();
      });
      this.wss.close();
      this.wss = null;
    }

    this.clients.clear();
    console.log('WebSocket服务器已关闭');
  }

  /**
   * 获取连接的客户端数量
   */
  public getClientCount(): number {
    return this.clients.size;
  }

  /**
   * 获取已认证的客户端数量
   */
  public getAuthenticatedClientCount(): number {
    let count = 0;
    this.clients.forEach((client) => {
      if (client.userId) {
        count++;
      }
    });
    return count;
  }
}

export const webSocketService = WebSocketService.getInstance();
