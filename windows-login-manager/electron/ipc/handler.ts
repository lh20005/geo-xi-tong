import { ipcMain, app, BrowserWindow } from 'electron';
import log from 'electron-log';
import { appManager } from '../main';
import { loginManager, Platform, LoginResult } from '../login/login-manager';
import { toutiaoLoginManager } from '../login/toutiao-login-manager';
import { douyinLoginManager } from '../login/douyin-login-manager';
import { storageManager, AppConfig } from '../storage/manager';
import { apiClient } from '../api/client';
import { syncService } from '../sync/service';
import { wsManager, WebSocketManager } from '../websocket/manager';
import { AccountEvent } from '../websocket/client';
import path from 'path';
import fs from 'fs/promises';

/**
 * IPC处理器
 * 处理渲染进程的IPC请求
 * Requirements: 所有功能需求
 */

class IPCHandler {
  private static instance: IPCHandler;

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): IPCHandler {
    if (!IPCHandler.instance) {
      IPCHandler.instance = new IPCHandler();
    }
    return IPCHandler.instance;
  }

  /**
   * 注册所有IPC处理器
   */
  async registerHandlers(): Promise<void> {
    log.info('Registering IPC handlers...');

    // 初始化API客户端的baseURL
    await this.initializeAPIClient();

    // 平台登录
    this.registerLoginHandlers();

    // 账号管理
    this.registerAccountHandlers();

    // 配置管理
    this.registerConfigHandlers();

    // 日志管理
    this.registerLogHandlers();

    // 同步管理
    this.registerSyncHandlers();

    // WebSocket管理
    this.registerWebSocketHandlers();
    
    // 设置WebSocket事件转发回调
    wsManager.setEventForwardCallback((event: AccountEvent) => {
      this.broadcastAccountEvent(event);
    });

    log.info('IPC handlers registered');
  }

  /**
   * 初始化API客户端
   */
  private async initializeAPIClient(): Promise<void> {
    try {
      const config = await storageManager.getConfig();
      if (config && config.serverUrl) {
        await apiClient.setBaseURL(config.serverUrl);
        log.info(`API client initialized with baseURL: ${config.serverUrl}`);
      } else {
        // 使用默认配置
        const defaultUrl = 'http://localhost:3000';
        await apiClient.setBaseURL(defaultUrl);
        log.info(`API client initialized with default baseURL: ${defaultUrl}`);
      }
    } catch (error) {
      log.error('Failed to initialize API client:', error);
      // 使用默认配置作为后备
      await apiClient.setBaseURL('http://localhost:3000');
    }
  }

  /**
   * 注册登录相关处理器
   */
  private registerLoginHandlers(): void {
    // 系统登录
    ipcMain.handle('login', async (event, username: string, password: string) => {
      try {
        log.info(`IPC: login - ${username}`);
        
        // 调用API登录
        const loginResult = await apiClient.login(username, password);
        
        // 保存用户信息
        if (loginResult.user) {
          await storageManager.saveUser(loginResult.user);
        }
        
        // 登录成功后初始化WebSocket
        const config = await storageManager.getConfig();
        if (config) {
          const wsUrl = WebSocketManager.deriveWebSocketUrl(config.serverUrl);
          const tokens = await storageManager.getTokens();
          
          if (tokens?.accessToken) {
            await wsManager.initialize({
              serverUrl: wsUrl,
              token: tokens.accessToken
            });
            log.info('WebSocket initialized after login');
          }
        }
        
        return { 
          success: true,
          user: loginResult.user
        };
      } catch (error) {
        log.error('IPC: login failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : '登录失败',
        };
      }
    });

    // 系统登出
    ipcMain.handle('logout', async () => {
      try {
        log.info('IPC: logout');
        
        // 断开WebSocket
        wsManager.disconnect();
        
        // 清除用户信息
        await storageManager.clearUser();
        
        // 调用API登出
        await apiClient.logout();
        
        return { success: true };
      } catch (error) {
        log.error('IPC: logout failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : '登出失败',
        };
      }
    });

    // 检查认证状态
    ipcMain.handle('check-auth', async () => {
      try {
        const tokens = await storageManager.getTokens();
        const user = await storageManager.getUser();
        
        return {
          isAuthenticated: !!tokens?.accessToken,
          user: user || undefined
        };
      } catch (error) {
        log.error('IPC: check-auth failed:', error);
        return { 
          isAuthenticated: false,
          user: undefined
        };
      }
    });

    // 平台登录
    ipcMain.handle('login-platform', async (event, platformId: string) => {
      try {
        log.info(`IPC: login-platform - ${platformId}`);

        // 获取主窗口
        const mainWindow = appManager.getMainWindow();
        if (!mainWindow) {
          throw new Error('Main window not available');
        }

        // 头条号使用专用登录管理器
        if (platformId === 'toutiao') {
          log.info('IPC: 使用头条号专用登录管理器');
          const result = await toutiaoLoginManager.login(mainWindow);
          return result;
        }

        // 抖音号使用专用登录管理器
        if (platformId === 'douyin') {
          log.info('IPC: 使用抖音号专用登录管理器');
          const result = await douyinLoginManager.login(mainWindow);
          return result;
        }

        // 其他平台使用通用登录管理器
        const platforms = await apiClient.getPlatforms();
        const platform = platforms.find((p) => p.platform_id === platformId);

        if (!platform) {
          throw new Error(`Platform not found: ${platformId}`);
        }

        // 执行登录
        const result = await loginManager.loginWithBrowser(mainWindow, platform as Platform);
        return result;
      } catch (error) {
        log.error('IPC: login-platform failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // 取消登录
    ipcMain.handle('cancel-login', async (event, platformId?: string) => {
      try {
        log.info(`IPC: cancel-login - ${platformId || 'all'}`);
        
        // 如果是头条号，使用专用管理器
        if (platformId === 'toutiao') {
          await toutiaoLoginManager.cancelLogin();
        } else if (platformId === 'douyin') {
          await douyinLoginManager.cancelLogin();
        } else {
          await loginManager.cancelLogin();
        }
        
        return { success: true };
      } catch (error) {
        log.error('IPC: cancel-login failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // 获取登录状态
    ipcMain.handle('get-login-status', async () => {
      try {
        return {
          isLoggingIn: loginManager.isLoggingIn(),
        };
      } catch (error) {
        log.error('IPC: get-login-status failed:', error);
        return { isLoggingIn: false };
      }
    });
  }

  /**
   * 注册账号管理处理器
   */
  private registerAccountHandlers(): void {
    // 获取所有账号
    ipcMain.handle('get-accounts', async () => {
      try {
        log.info('IPC: get-accounts');

        // 先尝试从后端获取
        try {
          const accounts = await apiClient.getAccounts();
          // 更新本地缓存
          await storageManager.saveAccountsCache(accounts);
          return accounts;
        } catch (error) {
          // 后端失败，从本地缓存获取
          log.warn('Failed to get accounts from backend, using cache');
          return await storageManager.getAccountsCache();
        }
      } catch (error) {
        log.error('IPC: get-accounts failed:', error);
        return [];
      }
    });

    // 删除账号
    ipcMain.handle('delete-account', async (event, accountId: number) => {
      try {
        log.info(`IPC: delete-account - ${accountId}`);

        // 必须先从后端删除，确保数据同步
        try {
          await apiClient.deleteAccount(accountId);
          log.info(`Account ${accountId} deleted from backend`);
        } catch (error: any) {
          log.error('Failed to delete from backend:', error);
          
          // 区分不同类型的错误
          if (error.response) {
            // 后端返回了错误响应（如 400, 404 等）
            const message = error.response.data?.message || error.message || '删除失败';
            throw new Error(message);
          } else if (error.request) {
            // 请求已发送但没有收到响应（网络问题）
            throw new Error('无法连接到服务器，请检查网络连接后重试。为确保数据安全，删除操作已取消。');
          } else {
            // 其他错误
            throw new Error(error.message || '删除失败，请重试');
          }
        }

        // 只有后端删除成功，才删除本地缓存
        const accounts = await storageManager.getAccountsCache();
        const filtered = accounts.filter((a) => a.id !== accountId);
        await storageManager.saveAccountsCache(filtered);
        log.info(`Account ${accountId} removed from local cache`);

        return { success: true };
      } catch (error) {
        log.error('IPC: delete-account failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : '删除失败，请重试',
        };
      }
    });

    // 设置默认账号
    ipcMain.handle(
      'set-default-account',
      async (event, platformId: string, accountId: number) => {
        try {
          log.info(`IPC: set-default-account - ${platformId}, ${accountId}`);

          // 必须先更新后端，确保数据同步
          try {
            await apiClient.setDefaultAccount(platformId, accountId);
            log.info(`Default account set on backend: ${platformId} -> ${accountId}`);
          } catch (error: any) {
            log.error('Failed to set default on backend:', error);
            
            // 区分不同类型的错误
            if (error.response) {
              // 后端返回了错误响应
              const message = error.response.data?.message || error.message || '设置失败';
              throw new Error(message);
            } else if (error.request) {
              // 网络问题
              throw new Error('无法连接到服务器，请检查网络连接后重试。为确保数据安全，设置操作已取消。');
            } else {
              // 其他错误
              throw new Error(error.message || '设置失败，请重试');
            }
          }

          // 只有后端更新成功，才更新本地缓存
          const accounts = await storageManager.getAccountsCache();
          accounts.forEach((a) => {
            if (a.platform_id === platformId) {
              a.is_default = a.id === accountId;
            }
          });
          await storageManager.saveAccountsCache(accounts);
          log.info(`Default account updated in local cache`);

          return { success: true };
        } catch (error) {
          log.error('IPC: set-default-account failed:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : '设置失败，请重试',
          };
        }
      }
    );

    // 刷新账号列表
    ipcMain.handle('refresh-accounts', async () => {
      try {
        log.info('IPC: refresh-accounts');
        const accounts = await syncService.pullAccounts();
        return accounts;
      } catch (error) {
        log.error('IPC: refresh-accounts failed:', error);
        return [];
      }
    });
  }

  /**
   * 注册配置管理处理器
   */
  private registerConfigHandlers(): void {
    // 获取配置
    ipcMain.handle('get-config', async () => {
      try {
        log.info('IPC: get-config');
        const config = await storageManager.getConfig();
        return config;
      } catch (error) {
        log.error('IPC: get-config failed:', error);
        return null;
      }
    });

    // 保存配置
    ipcMain.handle('set-config', async (event, config: AppConfig) => {
      try {
        log.info('IPC: set-config');
        await storageManager.saveConfig(config);

        // 更新API客户端的baseURL
        if (config.serverUrl) {
          await apiClient.setBaseURL(config.serverUrl);
          
          // 重新连接WebSocket（如果有token）
          const tokens = await storageManager.getTokens();
          if (tokens?.accessToken) {
            try {
              const wsUrl = WebSocketManager.deriveWebSocketUrl(config.serverUrl);
              await wsManager.reconnect({
                serverUrl: wsUrl,
                token: tokens.accessToken
              });
              log.info('WebSocket reconnected with new server URL');
            } catch (error) {
              log.error('Failed to reconnect WebSocket:', error);
              // 不阻止配置保存
            }
          }
        }

        return { success: true };
      } catch (error) {
        log.error('IPC: set-config failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // 清除缓存
    ipcMain.handle('clear-cache', async () => {
      try {
        log.info('IPC: clear-cache');
        await storageManager.clearCache();
        return { success: true };
      } catch (error) {
        log.error('IPC: clear-cache failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // 清除所有数据
    ipcMain.handle('clear-all-data', async () => {
      try {
        log.info('IPC: clear-all-data');
        await storageManager.clearAll();
        return { success: true };
      } catch (error) {
        log.error('IPC: clear-all-data failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });
  }

  /**
   * 注册日志管理处理器
   */
  private registerLogHandlers(): void {
    // 获取日志
    ipcMain.handle('get-logs', async () => {
      try {
        log.info('IPC: get-logs');
        const logPath = log.transports.file.getFile().path;
        const content = await fs.readFile(logPath, 'utf-8');
        const lines = content.split('\n').slice(-1000); // 最后1000行
        return lines;
      } catch (error) {
        log.error('IPC: get-logs failed:', error);
        return [];
      }
    });

    // 导出日志
    ipcMain.handle('export-logs', async () => {
      try {
        log.info('IPC: export-logs');
        const logPath = log.transports.file.getFile().path;
        return logPath;
      } catch (error) {
        log.error('IPC: export-logs failed:', error);
        return '';
      }
    });

    // 清除日志
    ipcMain.handle('clear-logs', async () => {
      try {
        log.info('IPC: clear-logs');
        const logPath = log.transports.file.getFile().path;
        await fs.writeFile(logPath, '');
        return { success: true };
      } catch (error) {
        log.error('IPC: clear-logs failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });
  }

  /**
   * 注册同步管理处理器
   */
  private registerSyncHandlers(): void {
    // 获取同步状态
    ipcMain.handle('get-sync-status', async () => {
      try {
        return syncService.getSyncStatus();
      } catch (error) {
        log.error('IPC: get-sync-status failed:', error);
        return {
          isOnline: false,
          isSyncing: false,
          queueLength: 0,
        };
      }
    });

    // 手动触发同步
    ipcMain.handle('trigger-sync', async () => {
      try {
        log.info('IPC: trigger-sync');
        await syncService.triggerSync();
        return { success: true };
      } catch (error) {
        log.error('IPC: trigger-sync failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // 清空同步队列
    ipcMain.handle('clear-sync-queue', async () => {
      try {
        log.info('IPC: clear-sync-queue');
        await syncService.clearQueue();
        return { success: true };
      } catch (error) {
        log.error('IPC: clear-sync-queue failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });
  }

  /**
   * 注册WebSocket管理处理器
   * Requirements: 3.1, 3.2, 3.3
   */
  private registerWebSocketHandlers(): void {
    // 获取WebSocket状态
    ipcMain.handle('get-websocket-status', async () => {
      try {
        log.info('IPC: get-websocket-status');
        return wsManager.getStatus();
      } catch (error) {
        log.error('IPC: get-websocket-status failed:', error);
        return {
          connected: false,
          authenticated: false,
          reconnectAttempts: 0,
          lastError: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // 手动重新连接WebSocket
    ipcMain.handle('reconnect-websocket', async () => {
      try {
        log.info('IPC: reconnect-websocket');
        
        const config = await storageManager.getConfig();
        const tokens = await storageManager.getTokens();
        
        if (!config || !config.serverUrl) {
          return {
            success: false,
            error: 'No server URL configured'
          };
        }
        
        if (!tokens?.accessToken) {
          return {
            success: false,
            error: 'No access token available'
          };
        }
        
        const wsUrl = WebSocketManager.deriveWebSocketUrl(config.serverUrl);
        await wsManager.reconnect({
          serverUrl: wsUrl,
          token: tokens.accessToken
        });
        
        return { success: true };
      } catch (error) {
        log.error('IPC: reconnect-websocket failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });
  }

  /**
   * 广播账号事件到所有渲染进程
   * Requirements: 3.1, 3.2
   */
  broadcastAccountEvent(event: AccountEvent): void {
    try {
      log.info(`Broadcasting account event to renderers: ${event.type}`);
      
      BrowserWindow.getAllWindows().forEach(window => {
        if (!window.isDestroyed()) {
          window.webContents.send('account-event', event);
        }
      });
    } catch (error) {
      log.error('Failed to broadcast account event:', error);
    }
  }

  /**
   * 移除所有处理器
   */
  removeAllHandlers(): void {
    log.info('Removing all IPC handlers...');
    ipcMain.removeAllListeners();
  }
}

// 导出单例实例
export const ipcHandler = IPCHandler.getInstance();
export { IPCHandler };
