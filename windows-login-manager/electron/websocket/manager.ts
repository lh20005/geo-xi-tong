/**
 * WebSocket Manager
 * 
 * Manages WebSocket connection lifecycle and integrates with application
 * Requirements: 1.1, 1.2, 1.3, 1.4, 4.1, 4.2, 4.3, 4.4, 6.1, 6.2, 6.3
 */

import log from 'electron-log';
import { WebSocketClient, AccountEvent } from './client';
import { storageManager } from '../storage/manager';

export interface WebSocketManagerConfig {
  serverUrl: string;  // WebSocket URL (ws:// or wss://)
  token: string;      // Authentication token
}

export interface WebSocketStatus {
  connected: boolean;           // Is currently connected
  authenticated: boolean;       // Is authenticated
  reconnectAttempts: number;   // Number of reconnection attempts
  lastError?: string;          // Last error message
}

export class WebSocketManager {
  private static instance: WebSocketManager;
  private wsClient: WebSocketClient | null = null;
  private config: WebSocketManagerConfig | null = null;
  private authenticated: boolean = false;
  private lastError: string | undefined = undefined;
  private eventForwardCallback: ((event: AccountEvent) => void) | null = null;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  /**
   * Initialize WebSocket connection
   * Requirements: 1.1, 1.2, 1.3, 1.4
   */
  async initialize(config: WebSocketManagerConfig): Promise<void> {
    try {
      log.info('Initializing WebSocket Manager...');
      
      // Validate configuration
      if (!config.serverUrl || !config.token) {
        throw new Error('Invalid WebSocket configuration: missing serverUrl or token');
      }

      // Store configuration
      this.config = config;

      // Create WebSocket client if not exists
      if (!this.wsClient) {
        this.wsClient = new WebSocketClient(config.serverUrl);
        this.setupEventHandlers();
      }

      // Connect to server
      this.wsClient.connect(config.token);
      
      log.info('WebSocket Manager initialized successfully');
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'Unknown error';
      log.error('Failed to initialize WebSocket Manager:', error);
      throw error;
    }
  }

  /**
   * Disconnect WebSocket
   * Requirements: 4.1
   */
  disconnect(): void {
    try {
      log.info('Disconnecting WebSocket...');
      
      if (this.wsClient) {
        this.wsClient.disconnect();
      }
      
      this.authenticated = false;
      this.config = null;
      
      log.info('WebSocket disconnected successfully');
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'Unknown error';
      log.error('Failed to disconnect WebSocket:', error);
    }
  }

  /**
   * Reconnect with new configuration
   * Requirements: 4.2, 4.3
   */
  async reconnect(config: WebSocketManagerConfig): Promise<void> {
    try {
      log.info('Reconnecting WebSocket with new configuration...');
      
      // Disconnect existing connection
      this.disconnect();
      
      // Wait a bit before reconnecting
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Initialize with new config
      await this.initialize(config);
      
      log.info('WebSocket reconnected successfully');
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'Unknown error';
      log.error('Failed to reconnect WebSocket:', error);
      throw error;
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.wsClient?.isConnected() ?? false;
  }

  /**
   * Get connection status
   */
  getStatus(): WebSocketStatus {
    return {
      connected: this.isConnected(),
      authenticated: this.authenticated,
      reconnectAttempts: (this.wsClient as any)?.reconnectAttempts ?? 0,
      lastError: this.lastError
    };
  }

  /**
   * Set event forward callback
   * This callback will be called when account events are received
   */
  setEventForwardCallback(callback: (event: AccountEvent) => void): void {
    this.eventForwardCallback = callback;
  }

  /**
   * Derive WebSocket URL from HTTP URL
   * Requirements: 6.1, 6.2, 6.3
   */
  static deriveWebSocketUrl(httpUrl: string): string {
    try {
      const url = new URL(httpUrl);
      const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${url.host}/ws`;
    } catch (error) {
      log.error('Failed to derive WebSocket URL:', error);
      throw new Error(`Invalid HTTP URL: ${httpUrl}`);
    }
  }

  /**
   * Setup event handlers for WebSocket client
   * Requirements: 2.1, 2.2, 2.3, 2.4
   */
  private setupEventHandlers(): void {
    if (!this.wsClient) {
      return;
    }

    // Handle connection
    this.wsClient.on('connected', () => {
      log.info('WebSocket connected');
      this.lastError = undefined;
    });

    // Handle authentication success
    this.wsClient.on('authenticated', (data) => {
      log.info('WebSocket authenticated:', data);
      this.authenticated = true;
      this.lastError = undefined;
    });

    // Handle disconnection
    this.wsClient.on('disconnected', (data) => {
      log.warn('WebSocket disconnected:', data);
      this.authenticated = false;
    });

    // Handle errors
    this.wsClient.on('error', (error) => {
      this.lastError = error instanceof Error ? error.message : 'Unknown error';
      log.error('WebSocket error:', error);
    });

    // Handle server errors
    this.wsClient.on('server_error', (message) => {
      this.lastError = message;
      log.error('WebSocket server error:', message);
    });

    // Handle account events
    this.wsClient.on('account_event', async (event: AccountEvent) => {
      log.info('Received account event:', event.type);
      
      try {
        // Update local cache first
        await this.updateLocalCache(event);
        
        // Forward event to IPC handler (if callback is set)
        if (this.eventForwardCallback) {
          this.eventForwardCallback(event);
        }
      } catch (error) {
        log.error('Failed to process account event:', error);
      }
    });
  }

  /**
   * Update local cache based on account event
   * Requirements: 2.4
   */
  private async updateLocalCache(event: AccountEvent): Promise<void> {
    try {
      const accounts = await storageManager.getAccountsCache();
      
      switch (event.type) {
        case 'account.created':
          // Add new account to cache
          accounts.push(event.data);
          log.info(`Account created in cache: ${event.data.id}`);
          break;
          
        case 'account.updated':
          // Update existing account in cache
          const updateIndex = accounts.findIndex(a => a.id === event.data.id);
          if (updateIndex !== -1) {
            accounts[updateIndex] = event.data;
            log.info(`Account updated in cache: ${event.data.id}`);
          } else {
            log.warn(`Account not found in cache for update: ${event.data.id}`);
          }
          break;
          
        case 'account.deleted':
          // Remove account from cache
          const deleteIndex = accounts.findIndex(a => a.id === event.data.id);
          if (deleteIndex !== -1) {
            accounts.splice(deleteIndex, 1);
            log.info(`Account deleted from cache: ${event.data.id}`);
          } else {
            log.warn(`Account not found in cache for deletion: ${event.data.id}`);
          }
          break;
      }
      
      // Save updated cache
      await storageManager.saveAccountsCache(accounts);
    } catch (error) {
      log.error('Failed to update local cache:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const wsManager = WebSocketManager.getInstance();
