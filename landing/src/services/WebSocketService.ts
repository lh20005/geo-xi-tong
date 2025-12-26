import { config } from '../config/env';

type EventHandler = (data: any) => void;

interface WebSocketMessage {
  type: string;
  data: any;
}

export class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // 初始重连延迟 1 秒
  private eventHandlers: Map<string, Set<EventHandler>> = new Map();
  private isConnecting = false;
  private shouldReconnect = true;
  private heartbeatInterval: number | null = null;

  /**
   * 连接到 WebSocket 服务器
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        console.log('[WebSocket] Already connected');
        resolve();
        return;
      }

      if (this.isConnecting) {
        console.log('[WebSocket] Connection already in progress');
        return;
      }

      this.isConnecting = true;
      const token = localStorage.getItem('auth_token');

      if (!token) {
        console.error('[WebSocket] No auth token found');
        this.isConnecting = false;
        reject(new Error('No auth token'));
        return;
      }

      // 构建 WebSocket URL
      const wsUrl = config.apiUrl.replace('http://', 'ws://').replace('https://', 'wss://');
      const url = `${wsUrl.replace('/api', '')}/ws?token=${token}`;

      console.log('[WebSocket] Connecting to:', url);

      try {
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          console.log('[WebSocket] Connected successfully');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.reconnectDelay = 1000;
          this.startHeartbeat();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            console.log('[WebSocket] Received message:', message.type);
            this.handleMessage(message);
          } catch (error) {
            console.error('[WebSocket] Error parsing message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('[WebSocket] Connection error:', error);
          this.isConnecting = false;
          reject(error);
        };

        this.ws.onclose = (event) => {
          console.log('[WebSocket] Connection closed:', event.code, event.reason);
          this.isConnecting = false;
          this.stopHeartbeat();

          if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };
      } catch (error) {
        console.error('[WebSocket] Error creating WebSocket:', error);
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    console.log('[WebSocket] Disconnecting...');
    this.shouldReconnect = false;
    this.stopHeartbeat();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.eventHandlers.clear();
  }

  /**
   * 订阅事件
   */
  on(event: string, handler: EventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
    console.log(`[WebSocket] Subscribed to event: ${event}`);
  }

  /**
   * 取消订阅事件
   */
  off(event: string, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.eventHandlers.delete(event);
      }
      console.log(`[WebSocket] Unsubscribed from event: ${event}`);
    }
  }

  /**
   * 发送消息
   */
  send(type: string, data: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message: WebSocketMessage = { type, data };
      this.ws.send(JSON.stringify(message));
      console.log(`[WebSocket] Sent message: ${type}`);
    } else {
      console.warn('[WebSocket] Cannot send message, not connected');
    }
  }

  /**
   * 处理接收到的消息
   */
  private handleMessage(message: WebSocketMessage): void {
    const handlers = this.eventHandlers.get(message.type);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(message.data);
        } catch (error) {
          console.error(`[WebSocket] Error in event handler for ${message.type}:`, error);
        }
      });
    }

    // 处理特殊消息
    switch (message.type) {
      case 'connected':
        console.log('[WebSocket] Server confirmed connection');
        break;
      case 'pong':
        // 心跳响应
        break;
      default:
        // 其他消息由订阅者处理
        break;
    }
  }

  /**
   * 安排重连
   */
  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // 指数退避

    console.log(`[WebSocket] Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

    setTimeout(() => {
      if (this.shouldReconnect) {
        console.log(`[WebSocket] Reconnecting (attempt ${this.reconnectAttempts})...`);
        this.connect().catch((error) => {
          console.error('[WebSocket] Reconnect failed:', error);
        });
      }
    }, delay);
  }

  /**
   * 启动心跳
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      this.send('ping', { timestamp: Date.now() });
    }, 30000); // 每30秒发送一次心跳
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * 获取连接状态
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

// 单例实例
let webSocketServiceInstance: WebSocketService | null = null;

export function getWebSocketService(): WebSocketService {
  if (!webSocketServiceInstance) {
    webSocketServiceInstance = new WebSocketService();
  }
  return webSocketServiceInstance;
}
