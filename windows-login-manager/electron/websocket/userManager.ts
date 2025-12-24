/**
 * User WebSocket Manager for Windows App
 * 
 * Manages user management WebSocket connection lifecycle
 * Requirements: 7.1, 7.2, 7.3, 7.5
 */

import log from 'electron-log';
import { app, BrowserWindow } from 'electron';
import { UserWebSocketClient, UserEvent } from './userClient';
import { storageManager } from '../storage/manager';

export interface UserWebSocketManagerConfig {
  serverUrl: string;  // WebSocket URL (ws:// or wss://)
  token: string;      // Authentication token
}

export class UserWebSocketManager {
  private static instance: UserWebSocketManager;
  private wsClient: UserWebSocketClient | null = null;
  private config: UserWebSocketManagerConfig | null = null;
  private authenticated: boolean = false;
  private lastError: string | undefined = undefined;
  private mainWindow: BrowserWindow | null = null;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): UserWebSocketManager {
    if (!UserWebSocketManager.instance) {
      UserWebSocketManager.instance = new UserWebSocketManager();
    }
    return UserWebSocketManager.instance;
  }

  /**
   * Set main window reference
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  /**
   * Initialize WebSocket connection
   */
  async initialize(config: UserWebSocketManagerConfig): Promise<void> {
    try {
      log.info('[UserWebSocketManager] Initializing...');
      
      // Validate configuration
      if (!config.serverUrl || !config.token) {
        throw new Error('Invalid configuration: missing serverUrl or token');
      }

      // Store configuration
      this.config = config;

      // Create WebSocket client if not exists
      if (!this.wsClient) {
        this.wsClient = new UserWebSocketClient(config.serverUrl);
        this.setupEventHandlers();
      }

      // Connect to server
      this.wsClient.connect(config.token);
      
      log.info('[UserWebSocketManager] Initialized successfully');
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'Unknown error';
      log.error('[UserWebSocketManager] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Disconnect WebSocket
   */
  disconnect(): void {
    try {
      log.info('[UserWebSocketManager] Disconnecting...');
      
      if (this.wsClient) {
        this.wsClient.disconnect();
      }
      
      this.authenticated = false;
      this.config = null;
      
      log.info('[UserWebSocketManager] Disconnected successfully');
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'Unknown error';
      log.error('[UserWebSocketManager] Failed to disconnect:', error);
    }
  }

  /**
   * Reconnect with new configuration
   */
  async reconnect(config: UserWebSocketManagerConfig): Promise<void> {
    try {
      log.info('[UserWebSocketManager] Reconnecting...');
      
      // Disconnect existing connection
      this.disconnect();
      
      // Wait a bit before reconnecting
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Initialize with new config
      await this.initialize(config);
      
      log.info('[UserWebSocketManager] Reconnected successfully');
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'Unknown error';
      log.error('[UserWebSocketManager] Failed to reconnect:', error);
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
   * Setup event handlers for WebSocket client
   */
  private setupEventHandlers(): void {
    if (!this.wsClient) {
      return;
    }

    // Handle connection
    this.wsClient.on('connected', () => {
      log.info('[UserWebSocketManager] Connected');
      this.lastError = undefined;
    });

    // Handle authentication success
    this.wsClient.on('authenticated', (data) => {
      log.info('[UserWebSocketManager] Authenticated:', data);
      this.authenticated = true;
      this.lastError = undefined;
    });

    // Handle disconnection
    this.wsClient.on('disconnected', (data) => {
      log.warn('[UserWebSocketManager] Disconnected:', data);
      this.authenticated = false;
    });

    // Handle errors
    this.wsClient.on('error', (error) => {
      this.lastError = error instanceof Error ? error.message : 'Unknown error';
      log.error('[UserWebSocketManager] Error:', error);
    });

    // Handle server errors
    this.wsClient.on('server_error', (message) => {
      this.lastError = message;
      log.error('[UserWebSocketManager] Server error:', message);
    });

    // Handle user:updated event
    this.wsClient.on('user:updated', async (data) => {
      log.info('[UserWebSocketManager] User updated:', data);
      
      try {
        // Get current user
        const userInfo = await storageManager.getUser();
        
        if (userInfo && data.userId === userInfo.id) {
          // Update local user info
          const updatedUser = {
            ...userInfo,
            username: data.username,
            role: data.role
          };
          
          await storageManager.saveUser(updatedUser);
          
          // Send IPC message to renderer
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('user:updated', updatedUser);
          }
          
          log.info('[UserWebSocketManager] Local user info updated');
        }
      } catch (error) {
        log.error('[UserWebSocketManager] Failed to handle user:updated:', error);
      }
    });

    // Handle user:deleted event
    this.wsClient.on('user:deleted', async (data) => {
      log.info('[UserWebSocketManager] User deleted:', data);
      
      try {
        // Get current user
        const userInfo = await storageManager.getUser();
        
        if (userInfo && data.userId === userInfo.id) {
          log.warn('[UserWebSocketManager] Current user deleted, logging out...');
          
          // Clear local storage
          await storageManager.clearTokens();
          await storageManager.clearUser();
          
          // Send IPC message to renderer
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('user:deleted', data);
          }
          
          // Disconnect WebSocket
          this.disconnect();
          
          // Close the app after a delay
          setTimeout(() => {
            app.quit();
          }, 2000);
        }
      } catch (error) {
        log.error('[UserWebSocketManager] Failed to handle user:deleted:', error);
      }
    });

    // Handle user:password-changed event
    this.wsClient.on('user:password-changed', async (data) => {
      log.info('[UserWebSocketManager] Password changed:', data);
      
      try {
        // Get current user
        const userInfo = await storageManager.getUser();
        
        if (userInfo && data.userId === userInfo.id) {
          log.warn('[UserWebSocketManager] Current user password changed, logging out...');
          
          // Clear local storage
          await storageManager.clearTokens();
          await storageManager.clearUser();
          
          // Send IPC message to renderer
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('user:password-changed', data);
          }
          
          // Disconnect WebSocket
          this.disconnect();
        }
      } catch (error) {
        log.error('[UserWebSocketManager] Failed to handle user:password-changed:', error);
      }
    });
  }

  /**
   * Derive WebSocket URL from HTTP URL
   */
  static deriveWebSocketUrl(httpUrl: string): string {
    try {
      const url = new URL(httpUrl);
      const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${url.host}/ws`;
    } catch (error) {
      log.error('[UserWebSocketManager] Failed to derive WebSocket URL:', error);
      throw new Error(`Invalid HTTP URL: ${httpUrl}`);
    }
  }
}

// Export singleton instance
export const userWsManager = UserWebSocketManager.getInstance();
