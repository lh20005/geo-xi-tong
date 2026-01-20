/**
 * 文章同步服务
 * 负责从服务器拉取文章并同步到本地数据库
 */

import { apiClient } from '../api/client';
import { localArticleApi } from '../api/local';
import { message } from 'antd';

interface ServerArticle {
  id: number;
  taskId: number;
  title: string;
  keyword: string;
  content: string;
  imageUrl?: string;
  provider: string;
  distillationKeywordSnapshot?: string;
  topicQuestionSnapshot?: string;
  createdAt: string;
}

interface SyncResult {
  success: boolean;
  synced: number;
  skipped: number;
  failed: number;
  errors: string[];
}

/**
 * 从服务器同步文章到本地
 * @param options 同步选项
 * @returns 同步结果
 */
export async function syncArticlesFromServer(options?: {
  limit?: number;
  showMessage?: boolean;
  silent?: boolean;
}): Promise<SyncResult> {
  const { limit = 50, showMessage = true, silent = false } = options || {};
  
  const result: SyncResult = {
    success: false,
    synced: 0,
    skipped: 0,
    failed: 0,
    errors: []
  };

  try {
    if (!silent) {
      console.log('[文章同步] 开始从服务器同步文章...');
    }

    // 1. 获取当前用户 ID
    const userResponse = await window.electron.storage.getUser();
    if (!userResponse.success || !userResponse.data) {
      throw new Error('无法获取用户信息');
    }
    const userId = userResponse.data.id;

    // 2. 从服务器获取最新文章列表
    const response = await apiClient.get('/article-generation/articles', {
      params: {
        page: 1,
        pageSize: limit,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      }
    });

    const serverArticles: ServerArticle[] = response.data?.articles || [];
    
    if (!silent) {
      console.log(`[文章同步] 服务器返回 ${serverArticles.length} 篇文章`);
    }

    if (serverArticles.length === 0) {
      result.success = true;
      if (showMessage) {
        message.info('服务器暂无新文章');
      }
      return result;
    }

    // 3. 逐篇检查并同步
    for (const article of serverArticles) {
      try {
        // 检查文章是否已存在
        const checkResult = await localArticleApi.checkArticleExists(
          article.taskId,
          article.title
        );

        if (checkResult.data?.exists) {
          result.skipped++;
          if (!silent) {
            console.log(`[文章同步] 跳过已存在的文章: ${article.title}`);
          }
          continue;
        }

        // 获取文章完整内容
        const contentResponse = await apiClient.get(`/article-generation/articles/${article.id}`);
        const fullContent = contentResponse.data?.content || article.content;

        // 保存到本地数据库
        await localArticleApi.create({
          userId,
          title: article.title,
          keyword: article.keyword,
          content: fullContent,
          imageUrl: article.imageUrl,
          provider: article.provider,
          taskId: article.taskId,
          distillationKeywordSnapshot: article.distillationKeywordSnapshot,
          topicQuestionSnapshot: article.topicQuestionSnapshot
        });

        result.synced++;
        if (!silent) {
          console.log(`[文章同步] ✅ 同步成功: ${article.title}`);
        }

      } catch (error: any) {
        result.failed++;
        const errorMsg = `同步文章失败 (${article.title}): ${error.message}`;
        result.errors.push(errorMsg);
        console.error(`[文章同步] ❌ ${errorMsg}`);
      }
    }

    result.success = true;

    // 4. 显示同步结果
    if (showMessage) {
      if (result.synced > 0) {
        message.success(`成功同步 ${result.synced} 篇文章`);
      } else if (result.skipped > 0) {
        message.info('所有文章已是最新');
      }
      
      if (result.failed > 0) {
        message.warning(`${result.failed} 篇文章同步失败`);
      }
    }

    if (!silent) {
      console.log('[文章同步] 同步完成:', {
        synced: result.synced,
        skipped: result.skipped,
        failed: result.failed
      });
    }

    // 5. 触发文章列表更新事件
    if (result.synced > 0) {
      window.dispatchEvent(new Event('articles:updated'));
    }

    return result;

  } catch (error: any) {
    result.success = false;
    result.errors.push(error.message);
    console.error('[文章同步] 同步失败:', error);
    
    if (showMessage) {
      message.error(`同步失败: ${error.message}`);
    }
    
    return result;
  }
}

/**
 * 静默同步（不显示消息提示）
 */
export async function silentSyncArticles(limit: number = 50): Promise<SyncResult> {
  return syncArticlesFromServer({
    limit,
    showMessage: false,
    silent: true
  });
}

/**
 * 同步指定任务的文章
 */
export async function syncArticlesByTaskId(taskId: number): Promise<SyncResult> {
  const result: SyncResult = {
    success: false,
    synced: 0,
    skipped: 0,
    failed: 0,
    errors: []
  };

  try {
    console.log(`[文章同步] 同步任务 ${taskId} 的文章...`);

    // 获取用户 ID
    const userResponse = await window.electron.storage.getUser();
    if (!userResponse.success || !userResponse.data) {
      throw new Error('无法获取用户信息');
    }
    const userId = userResponse.data.id;

    // 从服务器获取任务的文章
    const response = await apiClient.get(`/article-generation/tasks/${taskId}`);
    const articles: ServerArticle[] = response.data?.generatedArticles || [];

    console.log(`[文章同步] 任务 ${taskId} 有 ${articles.length} 篇文章`);

    for (const article of articles) {
      try {
        // 检查是否已存在
        const checkResult = await localArticleApi.checkArticleExists(
          taskId,
          article.title
        );

        if (checkResult.data?.exists) {
          result.skipped++;
          continue;
        }

        // 获取完整内容
        const contentResponse = await apiClient.get(`/article-generation/articles/${article.id}`);
        const fullContent = contentResponse.data?.content || article.content;

        // 保存到本地
        await localArticleApi.create({
          userId,
          title: article.title,
          keyword: article.keyword,
          content: fullContent,
          imageUrl: article.imageUrl,
          provider: article.provider,
          taskId,
          distillationKeywordSnapshot: article.distillationKeywordSnapshot,
          topicQuestionSnapshot: article.topicQuestionSnapshot
        });

        result.synced++;
        console.log(`[文章同步] ✅ 同步成功: ${article.title}`);

      } catch (error: any) {
        result.failed++;
        result.errors.push(error.message);
        console.error(`[文章同步] ❌ 同步失败:`, error);
      }
    }

    result.success = true;

    if (result.synced > 0) {
      window.dispatchEvent(new Event('articles:updated'));
    }

    return result;

  } catch (error: any) {
    result.success = false;
    result.errors.push(error.message);
    console.error('[文章同步] 同步任务文章失败:', error);
    return result;
  }
}
