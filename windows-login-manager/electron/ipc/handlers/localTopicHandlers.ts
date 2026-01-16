/**
 * 话题模块 IPC 处理器（本地 PostgreSQL）
 * 处理话题的本地 CRUD 操作
 * Requirements: Phase 6 - PostgreSQL 迁移
 */

import { ipcMain } from 'electron';
import log from 'electron-log';
import { serviceFactory } from '../../services/ServiceFactory';
import { storageManager } from '../../storage/manager';

/**
 * 注册话题相关 IPC 处理器
 */
export function registerLocalTopicHandlers(): void {
  log.info('Registering local topic IPC handlers (PostgreSQL)...');

  // 创建话题
  ipcMain.handle('topic:local:create', async (_event, params: any) => {
    try {
      log.info('IPC: topic:local:create');
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const topicService = serviceFactory.getTopicService();

      const topic = await topicService.create(params);

      return { success: true, data: topic };
    } catch (error: any) {
      log.error('IPC: topic:local:create failed:', error);
      return { success: false, error: error.message || '创建话题失败' };
    }
  });

  // 获取所有话题（分页）
  ipcMain.handle('topic:local:findAll', async (_event, params?: any) => {
    try {
      log.info('IPC: topic:local:findAll');
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const topicService = serviceFactory.getTopicService();

      const result = await topicService.findPaginated(
        params || {},
        ['question', 'keyword']
      );

      return { success: true, data: result };
    } catch (error: any) {
      log.error('IPC: topic:local:findAll failed:', error);
      return { success: false, error: error.message || '获取话题列表失败' };
    }
  });

  // 根据 ID 获取话题
  ipcMain.handle('topic:local:findById', async (_event, id: number) => {
    try {
      log.info(`IPC: topic:local:findById - ${id}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const topicService = serviceFactory.getTopicService();

      const topic = await topicService.findById(id);

      if (!topic) {
        return { success: false, error: '话题不存在' };
      }

      return { success: true, data: topic };
    } catch (error: any) {
      log.error('IPC: topic:local:findById failed:', error);
      return { success: false, error: error.message || '获取话题失败' };
    }
  });

  // 更新话题
  ipcMain.handle('topic:local:update', async (_event, id: number, params: any) => {
    try {
      log.info(`IPC: topic:local:update - ${id}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const topicService = serviceFactory.getTopicService();

      const topic = await topicService.update(id, params);

      return { success: true, data: topic };
    } catch (error: any) {
      log.error('IPC: topic:local:update failed:', error);
      return { success: false, error: error.message || '更新话题失败' };
    }
  });

  // 删除话题
  ipcMain.handle('topic:local:delete', async (_event, id: number) => {
    try {
      log.info(`IPC: topic:local:delete - ${id}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const topicService = serviceFactory.getTopicService();

      await topicService.delete(id);

      return { success: true };
    } catch (error: any) {
      log.error('IPC: topic:local:delete failed:', error);
      return { success: false, error: error.message || '删除话题失败' };
    }
  });

  // 批量删除话题
  ipcMain.handle('topic:local:deleteBatch', async (_event, ids: number[]) => {
    try {
      log.info(`IPC: topic:local:deleteBatch - ${ids.length} records`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const topicService = serviceFactory.getTopicService();

      const count = await topicService.deleteMany(ids);

      return { success: true, data: { deletedCount: count } };
    } catch (error: any) {
      log.error('IPC: topic:local:deleteBatch failed:', error);
      return { success: false, error: error.message || '批量删除话题失败' };
    }
  });

  // 根据蒸馏 ID 获取话题
  ipcMain.handle('topic:local:getByDistillation', async (_event, distillationId: number) => {
    try {
      log.info(`IPC: topic:local:getByDistillation - ${distillationId}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const topicService = serviceFactory.getTopicService();

      const topics = await topicService.findByDistillation(distillationId);

      return { success: true, data: topics };
    } catch (error: any) {
      log.error('IPC: topic:local:getByDistillation failed:', error);
      return { success: false, error: error.message || '获取话题失败' };
    }
  });

  // 搜索话题
  ipcMain.handle('topic:local:search', async (_event, searchTerm: string) => {
    try {
      log.info(`IPC: topic:local:search - ${searchTerm}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const topicService = serviceFactory.getTopicService();

      const topics = await topicService.search(searchTerm);

      return { success: true, data: topics };
    } catch (error: any) {
      log.error('IPC: topic:local:search failed:', error);
      return { success: false, error: error.message || '搜索话题失败' };
    }
  });

  // 获取未使用的话题
  ipcMain.handle('topic:local:findUnused', async (_event, limit: number = 20) => {
    try {
      log.info(`IPC: topic:local:findUnused - limit: ${limit}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const topicService = serviceFactory.getTopicService();

      const topics = await topicService.findUnused(limit);

      return { success: true, data: topics };
    } catch (error: any) {
      log.error('IPC: topic:local:findUnused failed:', error);
      return { success: false, error: error.message || '获取未使用话题失败' };
    }
  });

  // 获取最近的话题
  ipcMain.handle('topic:local:findRecent', async (_event, limit: number = 10) => {
    try {
      log.info(`IPC: topic:local:findRecent - limit: ${limit}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const topicService = serviceFactory.getTopicService();

      const topics = await topicService.findRecent(limit);

      return { success: true, data: topics };
    } catch (error: any) {
      log.error('IPC: topic:local:findRecent failed:', error);
      return { success: false, error: error.message || '获取最近话题失败' };
    }
  });

  // 获取统计信息
  ipcMain.handle('topic:local:getStats', async () => {
    try {
      log.info('IPC: topic:local:getStats');
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const topicService = serviceFactory.getTopicService();

      const stats = await topicService.getStats();

      return { success: true, data: stats };
    } catch (error: any) {
      log.error('IPC: topic:local:getStats failed:', error);
      return { success: false, error: error.message || '获取统计信息失败' };
    }
  });

  // 检查话题是否存在
  ipcMain.handle('topic:local:exists', async (_event, id: number) => {
    try {
      log.info(`IPC: topic:local:exists - ${id}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const topicService = serviceFactory.getTopicService();

      const exists = await topicService.exists(id);

      return { success: true, data: { exists } };
    } catch (error: any) {
      log.error('IPC: topic:local:exists failed:', error);
      return { success: false, error: error.message || '检查话题失败' };
    }
  });

  log.info('Local topic IPC handlers registered (PostgreSQL)');
}
