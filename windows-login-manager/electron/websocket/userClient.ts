/**
 * User Management WebSocket Client for Windows App
 * 
 * Handles real-time user management events from the backend
 * Requirements: 7.1, 7.2, 7.3, 7.5
 */

import { EventEmitter } from 'events';
import log from 'electron-log';

export interface WebSocketMessage {
  type: string;
  data?: any;
  message?: string;
  timestamp?: string;
}

export interface UserEvent {
  type: 'user:updated' | 'user:deleted' | 'user:password-changed';
  data: any;
  timestamp?: string;
}

export class UserWebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private isManualClose = false;

  constructor(url: string) {
    super();
    this.url = url;
  }

  /**
   * Connect to WebSocket server
   */
  public connect(token: string): void {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      log.warn('[UserWebSocket] Already connected or connecting');
      return;
    }

    this.isConnecting = true;
    this.isManualClose = false;
    this.token = token;

    try {
      log.info(`[UserWebSocket] Connecting to: ${this.url}`);
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        log.info('[UserWebSocket] Connected');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        
        // Authenticate
        this.authenticate();
        
        // Start heartbeat
        this.startHeartbeat();
        
        this.emit('connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          log.error('[UserWebSocket] Failed to parse message:', error);
        }
      };

      this.ws.onerror = (error) => {
        log.error('[UserWebSocket] Connection error:', error);
        this.emit('error', error);
      };

      this.ws.onclose = (event) => {
        log.info(`[UserWebSocket] Closed: ${event.code} ${event.reason}`);
        this.isConnecting = false;
        this.stopHeartbeat();
        
        this.emit('disconnected', { code: event.code, reason: event.reason });
        
        // Auto reconnect if not manual close
        if (!this.isManualClose && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      };
    } catch (error) {
      log.error('[UserWebSocket] Failed to create connection:', error);
      this.isConnecting = false;
      this.emit('error', error);
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  public disconnect(): void {
    this.isManualClose = true;
    this.stopHeartbeat();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    log.info('[UserWebSocket] Disconnected');
  }

  /**
   * Send message to server
   */
  public send(message: WebSocketMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      log.warn('[UserWebSocket] Not connected, cannot send message');
      return;
    }

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      log.error('[UserWebSocket] Failed to send message:', error);
    }
  }

  /**
   * Check if connected
   */
  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Authenticate with server
   */
  private authenticate(): void {
    if (!this.token) {
      log.warn('[UserWebSocket] No token available for authentication');
      return;
    }

    this.send({
      type: 'auth',
      data: { token: this.token }
    });
  }

  /**
   * Handle incoming message
   */
  private handleMessage(message: WebSocketMessage): void {
    log.debug('[UserWebSocket] Message received:', message.type);

    switch (message.type) {
      case 'connected':
        log.info('[UserWebSocket] Connection confirmed');
        break;

      case 'auth_success':
        log.info('[UserWebSocket] Authentication successful');
        this.emit('authenticated', message.data);
        break;

      case 'pong':
        // Heartbeat response
        break;

      case 'user:updated':
      case 'user:deleted':
      case 'user:password-changed':
        log.info(`[UserWebSocket] User event: ${message.type}`);
        this.emit('user_event', message as UserEvent);
        this.emit(message.type, message.data);
        break;

      case 'error':
        log.error('[UserWebSocket] Server error:', message.message);
        this.emit('server_error', message.message);
        break;

      default:
        log.warn('[UserWebSocket] Unknown message type:', message.type);
        this.emit('message', message);
    }
  }

  /**
   * Start heartbeat
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected()) {
        this.send({ type: 'ping' });
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Schedule reconnection
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;

    log.info(`[UserWebSocket] Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      
      if (this.token) {
        this.connect(this.token);
      }
    }, delay);
  }
}

// Singleton instance
let userWsClient: UserWebSocketClient | null = null;

/**
 * Get User WebSocket client instance
 */
export function getUserWebSocketClient(url?: string): UserWebSocketClient {
  if (!userWsClient && url) {
    userWsClient = new UserWebSocketClient(url);
  }
  
  if (!userWsClient) {
    throw new Error('User WebSocket client not initialized. Provide URL on first call.');
  }
  
  return userWsClient;
}

/**
 * Initialize User WebSocket client
 */
export function initializeUserWebSocket(url: string): UserWebSocketClient {
  if (userWsClient) {
    userWsClient.disconnect();
  }
  
  userWsClient = new UserWebSocketClient(url);
  return userWsClient;
}
