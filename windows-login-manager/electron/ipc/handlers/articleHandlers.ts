/**
 * 文章 IPC 处理器
 * 处理文章的本地 CRUD 操作
 * Requirements: Phase 6 - PostgreSQL 迁移
 */

import { ipcMain } from 'electron';
import log from 'electron-log';
import { serviceFactory } from '../../services/ServiceFactory';
import { storageManager } from '../../storage/manager';
import { Article } from '../../services/ArticleServicePostgres';

/**
 * 将后端 snake_case 文章对象转换为前端 camelCase 格式
 */
function transformArticle(article: Article): any {
  if (!article) return null;
  return {
    id: article.id.toString(), // 转为字符串
    userId: article.user_id,
    title: article.title,
    keyword: article.keyword,
    content: article.content,
    imageUrl: article.image_url,
    imageSizeBytes: article.image_size_bytes,
    provider: article.provider,
    isPublished: article.is_published,
    publishingStatus: article.publishing_status,
    publishedAt: article.published_at ? new Date(article.published_at).toISOString() : null,
    distillationId: article.distillation_id,
    distillationKeywordSnapshot: article.distillation_keyword_snapshot,
    topicId: article.topic_id,
    topicQuestion: article.topic_question_snapshot, // 映射到前端显示的 topicQuestion
    topicQuestionSnapshot: article.topic_question_snapshot,
    articleSettingId: article.article_setting_id,
    articleSettingName: article.article_setting_snapshot, // 映射到前端显示的 articleSettingName
    articleSettingSnapshot: article.article_setting_snapshot,
    conversionTargetId: article.conversion_target_id,
    conversionTargetName: article.conversion_target_snapshot, // 映射到前端显示的 conversionTargetName
    conversionTargetSnapshot: article.conversion_target_snapshot,
    taskId: article.task_id,
    imageId: article.image_id,
    requirements: article.requirements,
    createdAt: article.created_at ? new Date(article.created_at).toISOString() : null,
    updatedAt: article.updated_at ? new Date(article.updated_at).toISOString() : null
  };
}

/**
 * 注册文章相关 IPC 处理器
 */
export function registerArticleHandlers(): void {
  log.info('Registering article IPC handlers (PostgreSQL)...');

  // 创建文章
  ipcMain.handle('article:create', async (_event, params: any) => {
    try {
      log.info('IPC: article:create');
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      // 设置用户 ID 并获取服务
      serviceFactory.setUserId(user.id);
      const articleService = serviceFactory.getArticleService();

      log.info('IPC: article:create params:', JSON.stringify(params, null, 2));

      const article = await articleService.createArticle(params);

      return { success: true, data: transformArticle(article) };
    } catch (error: any) {
      log.error('IPC: article:create failed:', error);
      return { success: false, error: error.message || '创建文章失败' };
    }
  });

  // 获取所有文章（分页）
  ipcMain.handle('article:findAll', async (_event, params?: any) => {
    try {
      log.info('IPC: article:findAll');
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      // 设置用户 ID 并获取服务
      serviceFactory.setUserId(user.id);
      const articleService = serviceFactory.getArticleService();

      const result = await articleService.findPaginated(params || {}, ['title', 'content', 'keyword']);
      
      // 转换列表数据
      const transformedResult = {
        ...result,
        data: result.data.map(transformArticle)
      };

      return { success: true, data: transformedResult };
    } catch (error: any) {
      log.error('IPC: article:findAll failed:', error);
      return { success: false, error: error.message || '获取文章列表失败' };
    }
  });

  // 根据 ID 获取文章
  ipcMain.handle('article:findById', async (_event, id: string) => {
    try {
      log.info(`IPC: article:findById - ${id}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      // 设置用户 ID 并获取服务
      serviceFactory.setUserId(user.id);
      const articleService = serviceFactory.getArticleService();

      const article = await articleService.findById(id);
      
      if (!article) {
        return { success: false, error: '文章不存在' };
      }

      return { success: true, data: transformArticle(article) };
    } catch (error: any) {
      log.error('IPC: article:findById failed:', error);
      return { success: false, error: error.message || '获取文章失败' };
    }
  });

  // 更新文章
  ipcMain.handle('article:update', async (_event, id: string, params: any) => {
    try {
      log.info(`IPC: article:update - ${id}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      // 设置用户 ID 并获取服务
      serviceFactory.setUserId(user.id);
      const articleService = serviceFactory.getArticleService();

      log.info(`IPC: article:update params for ${id}:`, JSON.stringify(params, null, 2));

      const article = await articleService.updateArticle(parseInt(id), params);
      
      if (!article) {
        return { success: false, error: '文章不存在' };
      }

      return { success: true, data: transformArticle(article) };
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

      // 设置用户 ID 并获取服务
      serviceFactory.setUserId(user.id);
      const articleService = serviceFactory.getArticleService();

      await articleService.delete(id);

      return { success: true };
    } catch (error: any) {
      log.error('IPC: article:delete failed:', error);
      return { success: false, error: error.message || '删除文章失败' };
    }
  });

  // 搜索文章
  ipcMain.handle('article:search', async (_event, params: any) => {
    try {
      log.info('IPC: article:search');
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      // 设置用户 ID 并获取服务
      serviceFactory.setUserId(user.id);
      const articleService = serviceFactory.getArticleService();

      const result = await articleService.findPaginated(params, ['title', 'content', 'keyword']);
      
      // 转换列表数据
      const transformedResult = {
        ...result,
        data: result.data.map(transformArticle)
      };

      return { success: true, data: transformedResult };
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

      // 设置用户 ID 并获取服务
      serviceFactory.setUserId(user.id);
      const articleService = serviceFactory.getArticleService();

      const count = await articleService.deleteMany(ids);
      return { success: true, data: { deletedCount: count } };
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

      // 设置用户 ID 并获取服务
      serviceFactory.setUserId(user.id);
      const articleService = serviceFactory.getArticleService();

      // 获取所有文章 ID 并删除
      const articles = await articleService.findAll();
      const ids = articles.map(a => a.id);
      const count = await articleService.deleteMany(ids);
      
      return { success: true, data: { deletedCount: count } };
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

      // 设置用户 ID 并获取服务
      serviceFactory.setUserId(user.id);
      const articleService = serviceFactory.getArticleService();

      const stats = await articleService.getStats();
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

      // 设置用户 ID 并获取服务
      serviceFactory.setUserId(user.id);
      const articleService = serviceFactory.getArticleService();

      const stats = await articleService.getKeywordStats();
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
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      // 设置用户 ID 并获取服务
      serviceFactory.setUserId(user.id);
      const articleService = serviceFactory.getArticleService();

      await articleService.markAsPublished(parseInt(id), publishedAt);
      return { success: true };
    } catch (error: any) {
      log.error('IPC: article:markAsPublished failed:', error);
      return { success: false, error: error.message || '标记发布状态失败' };
    }
  });

  // 检查文章是否存在
  ipcMain.handle('article:checkExists', async (_event, params: { taskId: number, title: string }) => {
    try {
      // log.info(`IPC: article:checkExists - taskId: ${params.taskId}, title: ${params.title}`); // 减少日志
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const articleService = serviceFactory.getArticleService();

      const exists = await articleService.checkArticleExists(params.taskId, params.title);
      return { success: true, data: { exists } };
    } catch (error: any) {
      log.error('IPC: article:checkExists failed:', error);
      return { success: false, error: error.message || '检查文章是否存在失败' };
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

      // 设置用户 ID 并获取服务
      serviceFactory.setUserId(user.id);
      const articleService = serviceFactory.getArticleService();

      const articles = await articleService.findUnpublished();
      return { success: true, data: articles.map(transformArticle) };
    } catch (error: any) {
      log.error('IPC: article:findUnpublished failed:', error);
      return { success: false, error: error.message || '获取未发布文章失败' };
    }
  });

  log.info('Article IPC handlers registered (PostgreSQL)');
}
