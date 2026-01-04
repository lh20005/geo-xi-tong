/**
 * User Management WebSocket Service for Client App
 * 
 * Handles real-time user management events from the backend
 * Requirements: 7.1, 7.2, 7.3, 7.5, 6.10 (quota updates)
 */

import { config } from '../config/env';

type EventHandler = (data: any) => void;

interface WebSocketMessage {
  type: string;
  data: any;
}

export class UserWebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private eventHandlers: Map<string, Set<EventHandler>> = new Map();
  private isConnecting = false;
  private shouldReconnect = true;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Connect to WebSocket server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        console.log('[UserWebSocket] Already connected');
        resolve();
        return;
      }

      if (this.isConnecting) {
        console.log('[UserWebSocket] Connection already in progress');
        return;
      }

      this.isConnecting = true;
      const token = localStorage.getItem('auth_token');

      if (!token) {
        console.error('[UserWebSocket] No auth token found');
        this.isConnecting = false;
        reject(new Error('No auth token'));
        return;
      }

      // Build WebSocket URL
      // Use the configured wsUrl directly
      const wsUrl = config.wsUrl || 'ws://localhost:3000/ws';
      const url = `${wsUrl}?token=${token}`;

      console.log('[UserWebSocket] Connecting to:', url);

      try {
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          console.log('[UserWebSocket] Connected successfully');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.reconnectDelay = 1000;
          this.startHeartbeat();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            console.log('[UserWebSocket] Received message:', message.type);
            this.handleMessage(message);
          } catch (error) {
            console.error('[UserWebSocket] Error parsing message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('[UserWebSocket] Connection error:', error);
          this.isConnecting = false;
          reject(error);
        };

        this.ws.onclose = (event) => {
          console.log('[UserWebSocket] Connection closed:', event.code, event.reason);
          this.isConnecting = false;
          this.stopHeartbeat();

          if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };
      } catch (error) {
        console.error('[UserWebSocket] Error creating WebSocket:', error);
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    console.log('[UserWebSocket] Disconnecting...');
    this.shouldReconnect = false;
    this.stopHeartbeat();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.eventHandlers.clear();
  }

  /**
   * Subscribe to event
   */
  on(event: string, handler: EventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
    console.log(`[UserWebSocket] Subscribed to event: ${event}`);
  }

  /**
   * Unsubscribe from event
   */
  off(event: string, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.eventHandlers.delete(event);
      }
      console.log(`[UserWebSocket] Unsubscribed from event: ${event}`);
    }
  }

  /**
   * Send message to server
   */
  send(type: string, data: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message: WebSocketMessage = { type, data };
      this.ws.send(JSON.stringify(message));
      console.log(`[UserWebSocket] Sent message: ${type}`);
    } else {
      console.warn('[UserWebSocket] Cannot send message, not connected');
    }
  }

  /**
   * Handle received message
   */
  private handleMessage(message: WebSocketMessage): void {
    const handlers = this.eventHandlers.get(message.type);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(message.data);
        } catch (error) {
          console.error(`[UserWebSocket] Error in event handler for ${message.type}:`, error);
        }
      });
    }

    // Handle special messages
    switch (message.type) {
      case 'connected':
        console.log('[UserWebSocket] Server confirmed connection');
        break;
      case 'pong':
        // Heartbeat response
        break;
      case 'quota_updated':
        // Quota update notification
        console.log('[UserWebSocket] Quota updated:', message.data);
        break;
      case 'subscription_updated':
        // Subscription update notification
        console.log('[UserWebSocket] Subscription updated:', message.data);
        break;
      case 'order_status_changed':
        // Order status change notification
        console.log('[UserWebSocket] Order status changed:', message.data);
        break;
      default:
        // Other messages handled by subscribers
        break;
    }
  }

  /**
   * Schedule reconnection
   */
  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`[UserWebSocket] Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

    setTimeout(() => {
      if (this.shouldReconnect) {
        console.log(`[UserWebSocket] Reconnecting (attempt ${this.reconnectAttempts})...`);
        this.connect().catch((error) => {
          console.error('[UserWebSocket] Reconnect failed:', error);
        });
      }
    }, delay);
  }

  /**
   * Start heartbeat
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      this.send('ping', { timestamp: Date.now() });
    }, 30000); // Every 30 seconds
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

// Singleton instance
let userWebSocketServiceInstance: UserWebSocketService | null = null;

export function getUserWebSocketService(): UserWebSocketService {
  if (!userWebSocketServiceInstance) {
    userWebSocketServiceInstance = new UserWebSocketService();
  }
  return userWebSocketServiceInstance;
}
