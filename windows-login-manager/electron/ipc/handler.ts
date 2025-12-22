import { ipcMain, app } from 'electron';
import log from 'electron-log';
import { appManager } from '../main';
import { loginManager, Platform, LoginResult } from '../login/login-manager';
import { storageManager, AppConfig } from '../storage/manager';
import { apiClient } from '../api/client';
import { syncService } from '../sync/service';
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
  registerHandlers(): void {
    log.info('Registering IPC handlers...');

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

    log.info('IPC handlers registered');
  }

  /**
   * 注册登录相关处理器
   */
  private registerLoginHandlers(): void {
    // 平台登录
    ipcMain.handle('login-platform', async (event, platformId: string) => {
      try {
        log.info(`IPC: login-platform - ${platformId}`);

        // 获取平台配置
        const platforms = await apiClient.getPlatforms();
        const platform = platforms.find((p) => p.platform_id === platformId);

        if (!platform) {
          throw new Error(`Platform not found: ${platformId}`);
        }

        // 获取主窗口
        const mainWindow = appManager.getMainWindow();
        if (!mainWindow) {
          throw new Error('Main window not available');
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
    ipcMain.handle('cancel-login', async () => {
      try {
        log.info('IPC: cancel-login');
        await loginManager.cancelLogin();
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

        // 从后端删除
        try {
          await apiClient.deleteAccount(accountId);
        } catch (error) {
          log.warn('Failed to delete from backend:', error);
        }

        // 从本地缓存删除
        const accounts = await storageManager.getAccountsCache();
        const filtered = accounts.filter((a) => a.id !== accountId);
        await storageManager.saveAccountsCache(filtered);

        return { success: true };
      } catch (error) {
        log.error('IPC: delete-account failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // 设置默认账号
    ipcMain.handle(
      'set-default-account',
      async (event, platformId: string, accountId: number) => {
        try {
          log.info(`IPC: set-default-account - ${platformId}, ${accountId}`);

          // 更新后端
          try {
            await apiClient.setDefaultAccount(platformId, accountId);
          } catch (error) {
            log.warn('Failed to set default on backend:', error);
          }

          // 更新本地缓存
          const accounts = await storageManager.getAccountsCache();
          accounts.forEach((a) => {
            if (a.platform_id === platformId) {
              a.is_default = a.id === accountId;
            }
          });
          await storageManager.saveAccountsCache(accounts);

          return { success: true };
        } catch (error) {
          log.error('IPC: set-default-account failed:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
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
