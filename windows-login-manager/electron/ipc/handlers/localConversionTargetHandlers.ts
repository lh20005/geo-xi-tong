/**
 * 转化目标模块 IPC 处理器（本地 PostgreSQL）
 * 处理转化目标的本地 CRUD 操作
 * Requirements: Phase 6 - PostgreSQL 迁移
 */

import { ipcMain } from 'electron';
import log from 'electron-log';
import { serviceFactory } from '../../services/ServiceFactory';
import { storageManager } from '../../storage/manager';

/**
 * 注册转化目标相关 IPC 处理器
 */
export function registerLocalConversionTargetHandlers(): void {
  log.info('Registering local conversion target IPC handlers (PostgreSQL)...');

  // 创建转化目标
  ipcMain.handle('conversionTarget:local:create', async (_event, params: any) => {
    try {
      log.info('IPC: conversionTarget:local:create');
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const conversionTargetService = serviceFactory.getConversionTargetService();

      const target = await conversionTargetService.create(params);

      return { success: true, data: target };
    } catch (error: any) {
      log.error('IPC: conversionTarget:local:create failed:', error);
      return { success: false, error: error.message || '创建转化目标失败' };
    }
  });

  // 获取所有转化目标（分页）
  ipcMain.handle('conversionTarget:local:findAll', async (_event, params?: any) => {
    try {
      log.info('IPC: conversionTarget:local:findAll');
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const conversionTargetService = serviceFactory.getConversionTargetService();

      const result = await conversionTargetService.findPaginated(
        params || {},
        ['company_name', 'address', 'industry']
      );

      return { success: true, data: result };
    } catch (error: any) {
      log.error('IPC: conversionTarget:local:findAll failed:', error);
      return { success: false, error: error.message || '获取转化目标列表失败' };
    }
  });

  // 根据 ID 获取转化目标
  ipcMain.handle('conversionTarget:local:findById', async (_event, id: number) => {
    try {
      log.info(`IPC: conversionTarget:local:findById - ${id}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const conversionTargetService = serviceFactory.getConversionTargetService();

      const target = await conversionTargetService.findById(id);

      if (!target) {
        return { success: false, error: '转化目标不存在' };
      }

      return { success: true, data: target };
    } catch (error: any) {
      log.error('IPC: conversionTarget:local:findById failed:', error);
      return { success: false, error: error.message || '获取转化目标失败' };
    }
  });

  // 更新转化目标
  ipcMain.handle('conversionTarget:local:update', async (_event, id: number, params: any) => {
    try {
      log.info(`IPC: conversionTarget:local:update - ${id}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const conversionTargetService = serviceFactory.getConversionTargetService();

      const target = await conversionTargetService.update(id, params);

      return { success: true, data: target };
    } catch (error: any) {
      log.error('IPC: conversionTarget:local:update failed:', error);
      return { success: false, error: error.message || '更新转化目标失败' };
    }
  });

  // 删除转化目标
  ipcMain.handle('conversionTarget:local:delete', async (_event, id: number) => {
    try {
      log.info(`IPC: conversionTarget:local:delete - ${id}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const conversionTargetService = serviceFactory.getConversionTargetService();

      await conversionTargetService.delete(id);

      return { success: true };
    } catch (error: any) {
      log.error('IPC: conversionTarget:local:delete failed:', error);
      return { success: false, error: error.message || '删除转化目标失败' };
    }
  });

  // 批量删除转化目标
  ipcMain.handle('conversionTarget:local:deleteBatch', async (_event, ids: number[]) => {
    try {
      log.info(`IPC: conversionTarget:local:deleteBatch - ${ids.length} records`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const conversionTargetService = serviceFactory.getConversionTargetService();

      const count = await conversionTargetService.deleteMany(ids);

      return { success: true, data: { deletedCount: count } };
    } catch (error: any) {
      log.error('IPC: conversionTarget:local:deleteBatch failed:', error);
      return { success: false, error: error.message || '批量删除转化目标失败' };
    }
  });

  // 根据类型获取转化目标
  ipcMain.handle('conversionTarget:local:getByType', async (_event, type: string) => {
    try {
      log.info(`IPC: conversionTarget:local:getByType - ${type}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const conversionTargetService = serviceFactory.getConversionTargetService();

      const targets = await conversionTargetService.getByType(type);

      return { success: true, data: targets };
    } catch (error: any) {
      log.error('IPC: conversionTarget:local:getByType failed:', error);
      return { success: false, error: error.message || '获取转化目标失败' };
    }
  });

  // 获取默认转化目标
  ipcMain.handle('conversionTarget:local:getDefault', async () => {
    try {
      log.info('IPC: conversionTarget:local:getDefault');
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const conversionTargetService = serviceFactory.getConversionTargetService();

      const target = await conversionTargetService.getDefaultTarget();

      return { success: true, data: target };
    } catch (error: any) {
      log.error('IPC: conversionTarget:local:getDefault failed:', error);
      return { success: false, error: error.message || '获取默认转化目标失败' };
    }
  });

  // 设置默认转化目标
  ipcMain.handle('conversionTarget:local:setDefault', async (_event, id: number) => {
    try {
      log.info(`IPC: conversionTarget:local:setDefault - ${id}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const conversionTargetService = serviceFactory.getConversionTargetService();

      await conversionTargetService.setDefaultTarget(id);

      return { success: true };
    } catch (error: any) {
      log.error('IPC: conversionTarget:local:setDefault failed:', error);
      return { success: false, error: error.message || '设置默认转化目标失败' };
    }
  });

  // 搜索转化目标
  ipcMain.handle('conversionTarget:local:search', async (_event, searchTerm: string) => {
    try {
      log.info(`IPC: conversionTarget:local:search - ${searchTerm}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const conversionTargetService = serviceFactory.getConversionTargetService();

      const targets = await conversionTargetService.searchTargets(searchTerm);

      return { success: true, data: targets };
    } catch (error: any) {
      log.error('IPC: conversionTarget:local:search failed:', error);
      return { success: false, error: error.message || '搜索转化目标失败' };
    }
  });

  // 增加使用次数
  ipcMain.handle('conversionTarget:local:incrementUsage', async (_event, id: number) => {
    try {
      log.info(`IPC: conversionTarget:local:incrementUsage - ${id}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const conversionTargetService = serviceFactory.getConversionTargetService();

      await conversionTargetService.incrementUsageCount(id);

      return { success: true };
    } catch (error: any) {
      log.error('IPC: conversionTarget:local:incrementUsage failed:', error);
      return { success: false, error: error.message || '增加使用次数失败' };
    }
  });

  // 获取统计信息
  ipcMain.handle('conversionTarget:local:getStats', async () => {
    try {
      log.info('IPC: conversionTarget:local:getStats');
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const conversionTargetService = serviceFactory.getConversionTargetService();

      const stats = await conversionTargetService.getStats();

      return { success: true, data: stats };
    } catch (error: any) {
      log.error('IPC: conversionTarget:local:getStats failed:', error);
      return { success: false, error: error.message || '获取统计信息失败' };
    }
  });

  // 检查转化目标是否存在
  ipcMain.handle('conversionTarget:local:exists', async (_event, id: number) => {
    try {
      log.info(`IPC: conversionTarget:local:exists - ${id}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const conversionTargetService = serviceFactory.getConversionTargetService();

      const exists = await conversionTargetService.exists(id);

      return { success: true, data: { exists } };
    } catch (error: any) {
      log.error('IPC: conversionTarget:local:exists failed:', error);
      return { success: false, error: error.message || '检查转化目标失败' };
    }
  });

  log.info('Local conversion target IPC handlers registered (PostgreSQL)');
}
