/**
 * WebSocket Client Service for Web Frontend
 * 
 * Connects to backend WebSocket server for real-time account updates
 */

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

type EventCallback = (data: any) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private isManualClose = false;
  private eventListeners: Map<string, Set<EventCallback>> = new Map();

  constructor(url: string) {
    this.url = url;
  }

  /**
   * Connect to WebSocket server
   */
  public connect(token: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.warn('WebSocket already connected');
      return;
    }

    this.isManualClose = false;
    this.token = token;

    try {
      // Include token in URL for authentication
      const urlWithToken = `${this.url}${this.url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
      console.log(`Connecting to WebSocket: ${this.url}`);
      this.ws = new WebSocket(urlWithToken);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        
        // Token is already in URL, no need to authenticate again
        // Just start heartbeat and emit connected event
        this.startHeartbeat();
        
        this.emit('connected', {});
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.emit('error', error);
      };

      this.ws.onclose = (event) => {
        console.log(`WebSocket closed: ${event.code} ${event.reason}`);
        this.stopHeartbeat();
        
        this.emit('disconnected', { code: event.code, reason: event.reason });
        
        // Auto reconnect if not manual close
        if (!this.isManualClose && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
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

    console.log('WebSocket disconnected');
  }

  /**
   * Send message to server
   */
  public send(message: WebSocketMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected, cannot send message');
      return;
    }

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('Failed to send WebSocket message:', error);
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
   * Add event listener
   */
  public on(event: string, callback: EventCallback): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  /**
   * Remove event listener
   */
  public off(event: string, callback: EventCallback): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  /**
   * Emit event to listeners
   */
  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Check if connected
   */
  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Handle incoming message
   */
  private handleMessage(message: WebSocketMessage): void {
    console.debug('WebSocket message received:', message.type);

    switch (message.type) {
      case 'connected':
        console.log('WebSocket connection confirmed');
        break;

      case 'auth_success':
        console.log('WebSocket authentication successful');
        this.emit('authenticated', message.data);
        break;

      case 'subscribed':
        console.log('Subscribed to channels:', message.data);
        break;

      case 'pong':
        // Heartbeat response
        break;

      case 'account.created':
      case 'account.updated':
      case 'account.deleted':
        this.emit('account_event', message);
        this.emit(message.type, message.data);
        break;

      case 'error':
        console.error('WebSocket error message:', message.message);
        this.emit('server_error', message.message);
        break;

      default:
        console.warn('Unknown message type:', message.type);
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

    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

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
