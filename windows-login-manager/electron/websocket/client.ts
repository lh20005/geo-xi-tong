/**
 * WebSocket Client for Electron App
 * 
 * Connects to backend WebSocket server for real-time account updates
 */

import { EventEmitter } from 'events';
import log from 'electron-log';
import WebSocket from 'ws';

export interface WebSocketMessage {
  type: string;
  data?: any;
  message?: string;
  timestamp?: string;
}

export interface AccountEvent {
  type: 'account.created' | 'account.updated' | 'account.deleted';
  data: any;
  timestamp: string;
}

export class WebSocketClient extends EventEmitter {
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
      log.warn('WebSocket already connected or connecting');
      return;
    }

    this.isConnecting = true;
    this.isManualClose = false;
    this.token = token;

    try {
      log.info(`Connecting to WebSocket: ${this.url}`);
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        log.info('WebSocket connected');
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
          const data = typeof event.data === 'string' ? event.data : event.data.toString();
          const message: WebSocketMessage = JSON.parse(data);
          this.handleMessage(message);
        } catch (error) {
          log.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        log.error('WebSocket error:', error);
        this.emit('error', error);
      };

      this.ws.onclose = (event) => {
        log.info(`WebSocket closed: ${event.code} ${event.reason}`);
        this.isConnecting = false;
        this.stopHeartbeat();
        
        this.emit('disconnected', { code: event.code, reason: event.reason });
        
        // 1008 = Policy Violation (authentication failed)
        // Don't reconnect if authentication failed - need to re-login
        if (event.code === 1008) {
          log.error('WebSocket authentication failed, stopping reconnection. Please re-login.');
          this.emit('auth_failed', { code: event.code, reason: event.reason });
          return;
        }
        
        // Auto reconnect if not manual close
        if (!this.isManualClose && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      };
    } catch (error) {
      log.error('Failed to create WebSocket connection:', error);
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

    log.info('WebSocket disconnected');
  }

  /**
   * Send message to server
   */
  public send(message: WebSocketMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      log.warn('WebSocket not connected, cannot send message');
      return;
    }

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      log.error('Failed to send WebSocket message:', error);
    }
  }

  /**
   * Subscribe to channels
   */
  public subscribe(channels: string[]): void {
    this.send({
      type: 'subscribe',
      data: { channels }
    });
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
      log.warn('No token available for authentication');
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
    log.debug('WebSocket message received:', message.type);

    switch (message.type) {
      case 'connected':
        log.info('WebSocket connection confirmed');
        break;

      case 'auth_success':
        log.info('WebSocket authentication successful');
        this.emit('authenticated', message.data);
        break;

      case 'subscribed':
        log.info('Subscribed to channels:', message.data);
        break;

      case 'pong':
        // Heartbeat response
        break;

      case 'account.created':
      case 'account.updated':
      case 'account.deleted':
        this.emit('account_event', message as AccountEvent);
        break;

      case 'error':
        log.error('WebSocket error message:', message.message);
        this.emit('server_error', message.message);
        break;

      default:
        log.warn('Unknown message type:', message.type);
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

    log.info(`Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      
      if (this.token) {
        this.connect(this.token);
      }
    }, delay);
  }
}

// Singleton instance
let wsClient: WebSocketClient | null = null;

/**
 * Get WebSocket client instance
 */
export function getWebSocketClient(url?: string): WebSocketClient {
  if (!wsClient && url) {
    wsClient = new WebSocketClient(url);
  }
  
  if (!wsClient) {
    throw new Error('WebSocket client not initialized. Provide URL on first call.');
  }
  
  return wsClient;
}

/**
 * Initialize WebSocket client
 */
export function initializeWebSocket(url: string): WebSocketClient {
  if (wsClient) {
    wsClient.disconnect();
  }
  
  wsClient = new WebSocketClient(url);
  return wsClient;
}
