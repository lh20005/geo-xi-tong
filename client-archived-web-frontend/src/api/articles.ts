import { apiClient } from './client';

/**
 * 文章相关API
 */

export interface Article {
  id: number;
  title?: string;
  keyword: string;
  content: string;
  imageUrl?: string;
  isPublished: boolean;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  distillationId?: number;
  distillationKeyword?: string;
  topicId?: number;
  topicQuestion?: string;
  taskId?: number;
  conversionTargetId?: number;
  conversionTargetName?: string;
  articleSettingId?: number;
  articleSettingName?: string;
}

export interface ArticleStats {
  total: number;
  published: number;
  unpublished: number;
}

export interface KeywordStats {
  keyword: string;
  count: number;
}

/**
 * 更新文章发布状态
 */
export async function publishArticle(id: number, isPublished: boolean): Promise<Article> {
  const response = await apiClient.put(`/articles/${id}/publish`, {
    isPublished
  });
  return response.data;
}

/**
 * 智能排版文章
 */
export async function smartFormatArticle(
  id: number, 
  content: string, 
  imageUrl?: string
): Promise<{ content: string }> {
  const response = await apiClient.post(`/articles/${id}/smart-format`, {
    content,
    imageUrl
  });
  return response.data;
}

/**
 * 获取文章列表
 */
export async function getArticles(
  page = 1, 
  pageSize = 10, 
  filters?: {
    taskId?: number;
    publishStatus?: 'all' | 'published' | 'unpublished';
    distillationId?: number;
    keyword?: string;
  }
) {
  const params: any = { page, pageSize };
  if (filters) {
    if (filters.taskId) params.taskId = filters.taskId;
    if (filters.publishStatus && filters.publishStatus !== 'all') {
      params.publishStatus = filters.publishStatus;
    }
    if (filters.distillationId) params.distillationId = filters.distillationId;
    if (filters.keyword) params.keyword = filters.keyword;
  }
  const response = await apiClient.get('/articles', { params });
  return response.data;
}

/**
 * 获取文章详情
 */
export async function getArticle(id: number): Promise<Article> {
  const response = await apiClient.get(`/articles/${id}`);
  return response.data;
}

/**
 * 更新文章
 */
export async function updateArticle(
  id: number,
  data: { title: string; content: string; imageUrl?: string }
): Promise<Article> {
  const response = await apiClient.put(`/articles/${id}`, data);
  return response.data;
}

/**
 * 删除文章
 */
export async function deleteArticle(id: number): Promise<void> {
  await apiClient.delete(`/articles/${id}`);
}

/**
 * 获取文章统计数据
 */
export async function getArticleStats(): Promise<ArticleStats> {
  const response = await apiClient.get('/articles/stats');
  return response.data;
}

/**
 * 获取关键词统计数据
 */
export async function getKeywordStats(): Promise<{ keywords: KeywordStats[] }> {
  const response = await apiClient.get('/articles/stats/keywords');
  return response.data;
}

/**
 * 批量删除文章
 */
export async function batchDeleteArticles(ids: number[]): Promise<{ success: boolean; deletedCount: number }> {
  const response = await apiClient.delete('/articles/batch', { data: { ids } });
  return response.data;
}

/**
 * 删除所有文章
 */
export async function deleteAllArticles(): Promise<{ success: boolean; deletedCount: number }> {
  const response = await apiClient.delete('/articles/all');
  return response.data;
}
