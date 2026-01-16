/**
 * 文章设置模块 IPC 处理器（本地 PostgreSQL）
 * 处理文章设置的本地 CRUD 操作
 * Requirements: Phase 6 - PostgreSQL 迁移
 */

import { ipcMain } from 'electron';
import log from 'electron-log';
import { serviceFactory } from '../../services/ServiceFactory';
import { storageManager } from '../../storage/manager';

/**
 * 注册文章设置相关 IPC 处理器
 */
export function registerLocalArticleSettingHandlers(): void {
  log.info('Registering local article setting IPC handlers (PostgreSQL)...');

  // 创建文章设置
  ipcMain.handle('articleSetting:local:create', async (_event, params: any) => {
    try {
      log.info('IPC: articleSetting:local:create');
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const articleSettingService = serviceFactory.getArticleSettingService();

      const setting = await articleSettingService.create(params);

      return { success: true, data: setting };
    } catch (error: any) {
      log.error('IPC: articleSetting:local:create failed:', error);
      return { success: false, error: error.message || '创建文章设置失败' };
    }
  });

  // 获取所有文章设置（分页）
  ipcMain.handle('articleSetting:local:findAll', async (_event, params?: any) => {
    try {
      log.info('IPC: articleSetting:local:findAll');
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const articleSettingService = serviceFactory.getArticleSettingService();

      const result = await articleSettingService.findPaginated(
        params || {},
        ['name', 'description']
      );

      return { success: true, data: result };
    } catch (error: any) {
      log.error('IPC: articleSetting:local:findAll failed:', error);
      return { success: false, error: error.message || '获取文章设置列表失败' };
    }
  });

  // 根据 ID 获取文章设置
  ipcMain.handle('articleSetting:local:findById', async (_event, id: number) => {
    try {
      log.info(`IPC: articleSetting:local:findById - ${id}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const articleSettingService = serviceFactory.getArticleSettingService();

      const setting = await articleSettingService.findById(id);

      if (!setting) {
        return { success: false, error: '文章设置不存在' };
      }

      return { success: true, data: setting };
    } catch (error: any) {
      log.error('IPC: articleSetting:local:findById failed:', error);
      return { success: false, error: error.message || '获取文章设置失败' };
    }
  });

  // 更新文章设置
  ipcMain.handle('articleSetting:local:update', async (_event, id: number, params: any) => {
    try {
      log.info(`IPC: articleSetting:local:update - ${id}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const articleSettingService = serviceFactory.getArticleSettingService();

      const setting = await articleSettingService.update(id, params);

      return { success: true, data: setting };
    } catch (error: any) {
      log.error('IPC: articleSetting:local:update failed:', error);
      return { success: false, error: error.message || '更新文章设置失败' };
    }
  });

  // 删除文章设置
  ipcMain.handle('articleSetting:local:delete', async (_event, id: number) => {
    try {
      log.info(`IPC: articleSetting:local:delete - ${id}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const articleSettingService = serviceFactory.getArticleSettingService();

      await articleSettingService.delete(id);

      return { success: true };
    } catch (error: any) {
      log.error('IPC: articleSetting:local:delete failed:', error);
      return { success: false, error: error.message || '删除文章设置失败' };
    }
  });

  // 批量删除文章设置
  ipcMain.handle('articleSetting:local:deleteBatch', async (_event, ids: number[]) => {
    try {
      log.info(`IPC: articleSetting:local:deleteBatch - ${ids.length} records`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const articleSettingService = serviceFactory.getArticleSettingService();

      const count = await articleSettingService.deleteMany(ids);

      return { success: true, data: { deletedCount: count } };
    } catch (error: any) {
      log.error('IPC: articleSetting:local:deleteBatch failed:', error);
      return { success: false, error: error.message || '批量删除文章设置失败' };
    }
  });

  // 获取默认文章设置
  ipcMain.handle('articleSetting:local:getDefault', async () => {
    try {
      log.info('IPC: articleSetting:local:getDefault');
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const articleSettingService = serviceFactory.getArticleSettingService();

      const setting = await articleSettingService.getDefaultSetting();

      return { success: true, data: setting };
    } catch (error: any) {
      log.error('IPC: articleSetting:local:getDefault failed:', error);
      return { success: false, error: error.message || '获取默认文章设置失败' };
    }
  });

  // 设置默认文章设置
  ipcMain.handle('articleSetting:local:setDefault', async (_event, id: number) => {
    try {
      log.info(`IPC: articleSetting:local:setDefault - ${id}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const articleSettingService = serviceFactory.getArticleSettingService();

      await articleSettingService.setDefaultSetting(id);

      return { success: true };
    } catch (error: any) {
      log.error('IPC: articleSetting:local:setDefault failed:', error);
      return { success: false, error: error.message || '设置默认文章设置失败' };
    }
  });

  // 搜索文章设置
  ipcMain.handle('articleSetting:local:search', async (_event, searchTerm: string) => {
    try {
      log.info(`IPC: articleSetting:local:search - ${searchTerm}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const articleSettingService = serviceFactory.getArticleSettingService();

      const settings = await articleSettingService.search(searchTerm);

      return { success: true, data: settings };
    } catch (error: any) {
      log.error('IPC: articleSetting:local:search failed:', error);
      return { success: false, error: error.message || '搜索文章设置失败' };
    }
  });

  // 获取统计信息
  ipcMain.handle('articleSetting:local:getStats', async () => {
    try {
      log.info('IPC: articleSetting:local:getStats');
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const articleSettingService = serviceFactory.getArticleSettingService();

      const stats = await articleSettingService.getStats();

      return { success: true, data: stats };
    } catch (error: any) {
      log.error('IPC: articleSetting:local:getStats failed:', error);
      return { success: false, error: error.message || '获取统计信息失败' };
    }
  });

  // 检查文章设置是否存在
  ipcMain.handle('articleSetting:local:exists', async (_event, id: number) => {
    try {
      log.info(`IPC: articleSetting:local:exists - ${id}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const articleSettingService = serviceFactory.getArticleSettingService();

      const exists = await articleSettingService.exists(id);

      return { success: true, data: { exists } };
    } catch (error: any) {
      log.error('IPC: articleSetting:local:exists failed:', error);
      return { success: false, error: error.message || '检查文章设置失败' };
    }
  });

  log.info('Local article setting IPC handlers registered (PostgreSQL)');
}
