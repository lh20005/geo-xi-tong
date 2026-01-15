/**
 * 文章 IPC 处理器
 * 处理文章的本地 CRUD 操作
 * Requirements: Phase 6 - 注册 IPC 处理器
 */

import { ipcMain } from 'electron';
import log from 'electron-log';
import { articleService, CreateArticleParams, UpdateArticleParams, ArticleQueryParams } from '../../services';
import { storageManager } from '../../storage/manager';

/**
 * 注册文章相关 IPC 处理器
 */
export function registerArticleHandlers(): void {
  log.info('Registering article IPC handlers...');

  // 创建文章
  ipcMain.handle('article:create', async (_event, params: Omit<CreateArticleParams, 'user_id'>) => {
    try {
      log.info('IPC: article:create');
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      const article = articleService.create({
        ...params,
        user_id: user.id
      });

      return { success: true, data: article };
    } catch (error: any) {
      log.error('IPC: article:create failed:', error);
      return { success: false, error: error.message || '创建文章失败' };
    }
  });

  // 获取所有文章（分页）
  ipcMain.handle('article:findAll', async (_event, params?: ArticleQueryParams) => {
    try {
      log.info('IPC: article:findAll');
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      const result = articleService.query(user.id, params || {});
      return { success: true, data: result };
    } catch (error: any) {
      log.error('IPC: article:findAll failed:', error);
      return { success: false, error: error.message || '获取文章列表失败' };
    }
  });

  // 根据 ID 获取文章
  ipcMain.handle('article:findById', async (_event, id: string) => {
    try {
      log.info(`IPC: article:findById - ${id}`);
      const article = articleService.findById(id);
      
      if (!article) {
        return { success: false, error: '文章不存在' };
      }

      return { success: true, data: article };
    } catch (error: any) {
      log.error('IPC: article:findById failed:', error);
      return { success: false, error: error.message || '获取文章失败' };
    }
  });

  // 更新文章
  ipcMain.handle('article:update', async (_event, id: string, params: UpdateArticleParams) => {
    try {
      log.info(`IPC: article:update - ${id}`);
      const article = articleService.update(id, params);
      
      if (!article) {
        return { success: false, error: '文章不存在' };
      }

      return { success: true, data: article };
    } catch (error: any) {
      log.error('IPC: article:update failed:', error);
      return { success: false, error: error.message || '更新文章失败' };
    }
  });

  // 删除文章
  ipcMain.handle('article:delete', async (_event, id: string) => {
    try {
      log.info(`IPC: article:delete - ${id}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      const success = articleService.delete(id, user.id);
      
      if (!success) {
        return { success: false, error: '文章不存在或无权删除' };
      }

      return { success: true };
    } catch (error: any) {
      log.error('IPC: article:delete failed:', error);
      return { success: false, error: error.message || '删除文章失败' };
    }
  });

  // 搜索文章
  ipcMain.handle('article:search', async (_event, params: ArticleQueryParams) => {
    try {
      log.info('IPC: article:search');
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      const result = articleService.query(user.id, params);
      return { success: true, data: result };
    } catch (error: any) {
      log.error('IPC: article:search failed:', error);
      return { success: false, error: error.message || '搜索文章失败' };
    }
  });

  // 批量删除文章
  ipcMain.handle('article:deleteBatch', async (_event, ids: string[]) => {
    try {
      log.info(`IPC: article:deleteBatch - ${ids.length} articles`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      const result = articleService.deleteBatch(user.id, ids);
      return { success: true, data: result };
    } catch (error: any) {
      log.error('IPC: article:deleteBatch failed:', error);
      return { success: false, error: error.message || '批量删除失败' };
    }
  });

  // 删除所有文章
  ipcMain.handle('article:deleteAll', async () => {
    try {
      log.info('IPC: article:deleteAll');
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      const result = articleService.deleteAll(user.id);
      return { success: true, data: result };
    } catch (error: any) {
      log.error('IPC: article:deleteAll failed:', error);
      return { success: false, error: error.message || '删除所有文章失败' };
    }
  });

  // 获取文章统计
  ipcMain.handle('article:getStats', async () => {
    try {
      log.info('IPC: article:getStats');
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      const stats = articleService.getStats(user.id);
      return { success: true, data: stats };
    } catch (error: any) {
      log.error('IPC: article:getStats failed:', error);
      return { success: false, error: error.message || '获取统计失败' };
    }
  });

  // 获取关键词统计
  ipcMain.handle('article:getKeywordStats', async () => {
    try {
      log.info('IPC: article:getKeywordStats');
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      const stats = articleService.getKeywordStats(user.id);
      return { success: true, data: stats };
    } catch (error: any) {
      log.error('IPC: article:getKeywordStats failed:', error);
      return { success: false, error: error.message || '获取关键词统计失败' };
    }
  });

  // 标记文章为已发布
  ipcMain.handle('article:markAsPublished', async (_event, id: string, publishedAt?: string) => {
    try {
      log.info(`IPC: article:markAsPublished - ${id}`);
      const success = articleService.markAsPublished(id, publishedAt);
      return { success };
    } catch (error: any) {
      log.error('IPC: article:markAsPublished failed:', error);
      return { success: false, error: error.message || '标记发布状态失败' };
    }
  });

  // 获取未发布的文章
  ipcMain.handle('article:findUnpublished', async () => {
    try {
      log.info('IPC: article:findUnpublished');
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      const articles = articleService.findUnpublished(user.id);
      return { success: true, data: articles };
    } catch (error: any) {
      log.error('IPC: article:findUnpublished failed:', error);
      return { success: false, error: error.message || '获取未发布文章失败' };
    }
  });

  log.info('Article IPC handlers registered');
}
