/**
 * 本地账号 IPC 处理器
 * 处理平台账号的本地 CRUD 操作（使用 SQLite + 加密）
 * Requirements: Phase 6 - 注册 IPC 处理器
 */

import { ipcMain } from 'electron';
import log from 'electron-log';
import { accountService, CreateAccountParams, UpdateAccountParams } from '../../services';
import { storageManager } from '../../storage/manager';

/**
 * 注册本地账号相关 IPC 处理器
 * 注意：这些处理器使用 'account:local:' 前缀，与现有的服务器账号处理器区分
 */
export function registerLocalAccountHandlers(): void {
  log.info('Registering local account IPC handlers...');

  // 创建账号
  ipcMain.handle('account:local:create', async (_event, params: Omit<CreateAccountParams, 'user_id'>) => {
    try {
      log.info('IPC: account:local:create');
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      const account = accountService.create({
        ...params,
        user_id: user.id
      });

      return { success: true, data: account };
    } catch (error: any) {
      log.error('IPC: account:local:create failed:', error);
      return { success: false, error: error.message || '创建账号失败' };
    }
  });

  // 获取所有账号
  ipcMain.handle('account:local:findAll', async () => {
    try {
      log.info('IPC: account:local:findAll');
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      const accounts = accountService.findAll(user.id);
      return { success: true, data: accounts };
    } catch (error: any) {
      log.error('IPC: account:local:findAll failed:', error);
      return { success: false, error: error.message || '获取账号列表失败' };
    }
  });

  // 根据 ID 获取账号
  ipcMain.handle('account:local:findById', async (_event, id: string) => {
    try {
      log.info(`IPC: account:local:findById - ${id}`);
      const account = accountService.findById(id);
      
      if (!account) {
        return { success: false, error: '账号不存在' };
      }

      return { success: true, data: account };
    } catch (error: any) {
      log.error('IPC: account:local:findById failed:', error);
      return { success: false, error: error.message || '获取账号失败' };
    }
  });

  // 根据平台获取账号
  ipcMain.handle('account:local:findByPlatform', async (_event, platformId: string) => {
    try {
      log.info(`IPC: account:local:findByPlatform - ${platformId}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      const accounts = accountService.findByPlatform(user.id, platformId);
      return { success: true, data: accounts };
    } catch (error: any) {
      log.error('IPC: account:local:findByPlatform failed:', error);
      return { success: false, error: error.message || '获取平台账号失败' };
    }
  });

  // 更新账号
  ipcMain.handle('account:local:update', async (_event, id: string, params: UpdateAccountParams) => {
    try {
      log.info(`IPC: account:local:update - ${id}`);
      const account = accountService.update(id, params);
      
      if (!account) {
        return { success: false, error: '账号不存在' };
      }

      return { success: true, data: account };
    } catch (error: any) {
      log.error('IPC: account:local:update failed:', error);
      return { success: false, error: error.message || '更新账号失败' };
    }
  });

  // 删除账号
  ipcMain.handle('account:local:delete', async (_event, id: string) => {
    try {
      log.info(`IPC: account:local:delete - ${id}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      const success = accountService.delete(id, user.id);
      
      if (!success) {
        return { success: false, error: '账号不存在或无权删除' };
      }

      return { success: true };
    } catch (error: any) {
      log.error('IPC: account:local:delete failed:', error);
      return { success: false, error: error.message || '删除账号失败' };
    }
  });

  // 设置默认账号
  ipcMain.handle('account:local:setDefault', async (_event, platformId: string, accountId: string) => {
    try {
      log.info(`IPC: account:local:setDefault - ${platformId} -> ${accountId}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      const success = accountService.setDefaultAccount(user.id, platformId, accountId);
      return { success };
    } catch (error: any) {
      log.error('IPC: account:local:setDefault failed:', error);
      return { success: false, error: error.message || '设置默认账号失败' };
    }
  });

  // 获取默认账号
  ipcMain.handle('account:local:getDefault', async (_event, platformId: string) => {
    try {
      log.info(`IPC: account:local:getDefault - ${platformId}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      const account = accountService.getDefaultAccount(user.id, platformId);
      return { success: true, data: account };
    } catch (error: any) {
      log.error('IPC: account:local:getDefault failed:', error);
      return { success: false, error: error.message || '获取默认账号失败' };
    }
  });

  // 更新登录状态
  ipcMain.handle('account:local:updateLoginStatus', async (_event, id: string, status: string, errorMessage?: string) => {
    try {
      log.info(`IPC: account:local:updateLoginStatus - ${id} -> ${status}`);
      
      const success = accountService.updateStatus(id, status, errorMessage);
      return { success };
    } catch (error: any) {
      log.error('IPC: account:local:updateLoginStatus failed:', error);
      return { success: false, error: error.message || '更新登录状态失败' };
    }
  });

  // 保存 Cookies（加密存储）
  ipcMain.handle('account:local:saveCookies', async (_event, id: string, cookies: any[]) => {
    try {
      log.info(`IPC: account:local:saveCookies - ${id}`);
      
      const success = accountService.updateCookies(id, cookies);
      return { success };
    } catch (error: any) {
      log.error('IPC: account:local:saveCookies failed:', error);
      return { success: false, error: error.message || '保存 Cookies 失败' };
    }
  });

  // 获取 Cookies（解密）
  ipcMain.handle('account:local:getCookies', async (_event, id: string) => {
    try {
      log.info(`IPC: account:local:getCookies - ${id}`);
      
      const account = accountService.getDecrypted(id);
      return { success: true, data: account?.cookies || null };
    } catch (error: any) {
      log.error('IPC: account:local:getCookies failed:', error);
      return { success: false, error: error.message || '获取 Cookies 失败' };
    }
  });

  // 获取账号统计
  ipcMain.handle('account:local:getStats', async () => {
    try {
      log.info('IPC: account:local:getStats');
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      const stats = accountService.getStats(user.id);
      return { success: true, data: stats };
    } catch (error: any) {
      log.error('IPC: account:local:getStats failed:', error);
      return { success: false, error: error.message || '获取账号统计失败' };
    }
  });

  // 检查账号是否存在
  ipcMain.handle('account:local:exists', async (_event, platformId: string, platformUserId: string) => {
    try {
      log.info(`IPC: account:local:exists - ${platformId}/${platformUserId}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      const exists = accountService.existsByPlatform(user.id, platformId, platformUserId);
      return { success: true, data: { exists } };
    } catch (error: any) {
      log.error('IPC: account:local:exists failed:', error);
      return { success: false, error: error.message || '检查账号失败' };
    }
  });

  log.info('Local account IPC handlers registered');
}
